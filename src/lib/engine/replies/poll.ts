import { z } from "zod/v4";
import { alert } from "../alert";
import { logEvent, stopSequence, suppress } from "../db/queries";
import { one, q, tx, type Db } from "../db/pool";
import { googleGmail, type GmailPort } from "../gmail/port";
import { prompt } from "../prompts";
import { jsonWithFallback, isAiReady, smallModelChain } from "../research/models";
import { bouncedAddress, isAutoReply, isBounce, isHardBounce, isOptOut, stripQuoted } from "./detect";

// Reply poller (docs/guide.md, Step 8): Gmail history API per mailbox -> match
// thread to lead -> bounce / auto-reply / opt-out checks -> classify -> apply
// the actions in docs/reply-actions.md in one transaction.

export const INTENTS = ["interested", "question", "not_now", "not_interested", "wrong_person", "referral", "unsubscribe"] as const;
export type Intent = (typeof INTENTS)[number];

export const ClassifySchema = z.object({
  intent: z.enum(INTENTS),
  referral_name: z.string().nullable(),
  referral_email: z.string().nullable(),
  summary: z.string(),
});
export type Classification = z.infer<typeof ClassifySchema>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Mailbox {
  id: number;
  email: string;
  domain_id: number;
  history_id: string | null;
}

export async function classifyReply(text: string): Promise<Classification> {
  if (isOptOut(text)) return { intent: "unsubscribe", referral_name: null, referral_email: null, summary: "Opt-out phrase" };
  if (!isAiReady()) return { intent: "question", referral_name: null, referral_email: null, summary: "Not classified (AI off): needs a person" };
  const p = prompt("classify", { body: text.slice(0, 4000) });
  try {
    const { data } = await jsonWithFallback(ClassifySchema, p.system, p.input, { chain: smallModelChain(), maxTokens: 800, purpose: "classify" });
    return data;
  } catch {
    // Never guess: route to a person.
    return { intent: "question", referral_name: null, referral_email: null, summary: "Classification failed: needs a person" };
  }
}

/** Applies a human reply's intent in one transaction (stop-on-reply always). */
export async function applyReply(db: Db, leadId: string, c: Classification) {
  await stopSequence(leadId, c.intent === "unsubscribe" ? "unsubscribed" : "replied", db);
  if (c.intent === "unsubscribe") {
    const lead = await one<{ email: string }>(`select email from outreach.leads where id = $1`, [leadId], db);
    if (lead) await suppress(lead.email, "unsubscribed", db);
  }
  if (c.intent === "not_now") await db.query(`update outreach.leads set revisit_at = current_date + 75 where id = $1`, [leadId]);
  if ((c.intent === "referral" || c.intent === "wrong_person") && c.referral_email && EMAIL_RE.test(c.referral_email.trim())) {
    const email = c.referral_email.trim().toLowerCase();
    const [first, ...rest] = (c.referral_name ?? "").trim().split(/\s+/);
    await db.query(
      `insert into outreach.leads (email, first_name, last_name, company, website, country, timezone, segment, source, referred_by)
       select $2, nullif($3, ''), nullif($4, ''), company, website, country, timezone, segment, 'referral', id from outreach.leads where id = $1
       and not exists (select 1 from outreach.suppression where email = $2)
       on conflict (email) do nothing`,
      [leadId, email, first ?? "", rest.join(" ")],
    );
  }
}

async function ourMailboxes() {
  return new Set((await q<{ email: string }>(`select lower(email) as email from outreach.mailboxes`)).map((r) => r.email));
}

const addressOf = (from: string) => (from.match(/<([^>]+)>/)?.[1] ?? from).trim().toLowerCase();

export async function processMessage(mailbox: Mailbox, messageId: string, ours: Set<string>, gmail: GmailPort) {
  const seen = await one(`select 1 from outreach.replies where gmail_message_id = $1`, [messageId]);
  if (seen) return "seen";
  const { meta, body, labelIds } = await gmail.getMessage(mailbox.email, messageId);
  if (labelIds.includes("SENT") || ours.has(addressOf(meta.from))) return "ours";
  const subject = meta.headers["subject"] ?? "";

  const step = await one<{ lead_id: string; mailbox_id: number }>(
    `select lead_id, mailbox_id from outreach.steps where gmail_thread_id = $1 and status = 'sent' order by step_no limit 1`,
    [meta.threadId],
  );

  if (isBounce(meta.from, meta.headers, subject)) {
    const failed = bouncedAddress(body);
    const lead = step
      ? await one<{ id: string; email: string }>(`select id, email from outreach.leads where id = $1`, [step.lead_id])
      : failed
        ? await one<{ id: string; email: string }>(`select id, email from outreach.leads where email = $1`, [failed])
        : null;
    const hard = isHardBounce(body);
    await tx(async (db) => {
      await db.query(
        `insert into outreach.replies (lead_id, mailbox_id, gmail_message_id, gmail_thread_id, received_at, from_address, subject, body, is_bounce)
         values ($1, $2, $3, $4, to_timestamp($5 / 1000.0), $6, $7, $8, true) on conflict (gmail_message_id) do nothing`,
        [lead?.id ?? null, mailbox.id, messageId, meta.threadId, meta.internalDate, meta.from, subject, body.slice(0, 5000)],
      );
      if (lead && hard) {
        await stopSequence(lead.id, "bounced", db);
        await suppress(lead.email, "bounced", db);
      }
    });
    await logEvent("bounce", { lead_id: lead?.id ?? null, mailbox_id: mailbox.id, domain_id: mailbox.domain_id, hard, address: failed });
    return "bounce";
  }

  if (!step) return "unmatched"; // not one of our sequences

  const auto = isAutoReply(meta.headers, subject);
  const text = stripQuoted(body);
  if (auto) {
    await q(
      `insert into outreach.replies (lead_id, mailbox_id, gmail_message_id, gmail_thread_id, received_at, from_address, subject, body, is_auto)
       values ($1, $2, $3, $4, to_timestamp($5 / 1000.0), $6, $7, $8, true) on conflict (gmail_message_id) do nothing`,
      [step.lead_id, mailbox.id, messageId, meta.threadId, meta.internalDate, meta.from, subject, text.slice(0, 5000)],
    );
    await logEvent("auto_reply", { lead_id: step.lead_id, mailbox_id: mailbox.id });
    return "auto";
  }

  const c = await classifyReply(text);
  await tx(async (db) => {
    await db.query(
      `insert into outreach.replies (lead_id, mailbox_id, gmail_message_id, gmail_thread_id, received_at, from_address, subject, body, intent, summary)
       values ($1, $2, $3, $4, to_timestamp($5 / 1000.0), $6, $7, $8, $9, $10) on conflict (gmail_message_id) do nothing`,
      [step.lead_id, mailbox.id, messageId, meta.threadId, meta.internalDate, meta.from, subject, text.slice(0, 5000), c.intent, c.summary],
    );
    await applyReply(db, step.lead_id, c);
  });
  await logEvent("reply", { lead_id: step.lead_id, mailbox_id: mailbox.id, domain_id: mailbox.domain_id, intent: c.intent });
  if (c.intent === "interested" || c.intent === "question") {
    await alert(`${c.intent === "interested" ? "Interested" : "Question"} reply from ${addressOf(meta.from)} to ${mailbox.email}: ${c.summary}`, { lead_id: step.lead_id });
  }
  return c.intent;
}

export async function pollMailbox(mailbox: Mailbox, ours: Set<string>, gmail: GmailPort = googleGmail) {
  let ids: string[] = [];
  let nextHistory: string;
  if (!mailbox.history_id) {
    nextHistory = await gmail.currentHistoryId(mailbox.email);
    ids = await gmail.recentInbound(mailbox.email, 7);
  } else {
    const h = await gmail.historySince(mailbox.email, mailbox.history_id);
    if (h) {
      ids = h.messageIds;
      nextHistory = h.historyId;
    } else {
      // History id expired: reset it and fall back to a scan of recent mail.
      nextHistory = await gmail.currentHistoryId(mailbox.email);
      ids = await gmail.recentInbound(mailbox.email, 14);
      await logEvent("history_reset", { mailbox: mailbox.email });
    }
  }
  const results: string[] = [];
  for (const id of ids) {
    try {
      results.push(await processMessage(mailbox, id, ours, gmail));
    } catch (err) {
      await logEvent("reply_failed", { mailbox: mailbox.email, message_id: id, error: String(err).slice(0, 300) });
      // Keep the old history id so this message is retried next time.
      return { mailbox: mailbox.email, results, error: true };
    }
  }
  await q(`update outreach.mailboxes set history_id = $2 where id = $1`, [mailbox.id, nextHistory]);
  return { mailbox: mailbox.email, results, error: false };
}

export async function pollReplies(gmail: GmailPort = googleGmail) {
  // Paused mailboxes are polled too: replies to mail they already sent still matter.
  const mailboxes = await q<Mailbox>(`select id, email, domain_id, history_id from outreach.mailboxes order by id`);
  const ours = await ourMailboxes();
  const settled = await Promise.allSettled(mailboxes.map((m) => pollMailbox(m, ours, gmail)));
  return settled.map((r, i) => (r.status === "fulfilled" ? r.value : { mailbox: mailboxes[i]!.email, results: [], error: true }));
}
