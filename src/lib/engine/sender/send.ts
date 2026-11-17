import { randomInt } from "node:crypto";
import { alert } from "../alert";
import { domainSendsToday, isSuppressed, logEvent, sendsToday, stopSequence } from "../db/queries";
import { one, q, tx } from "../db/pool";
import { formatFrom, newMessageId, rawMessage } from "../gmail/message";
import { classifyGmailError, googleGmail, type GmailPort } from "../gmail/port";
import { guardConfig } from "../config";
import { allowedSends, nextGapSeconds, rampCap } from "./caps";
import { composeBody } from "./compose";
import { unsubUrl } from "./unsubscribe";
import { addBusinessDays, FOLLOW_UP_GAP_DAYS, inSendWindow, windowHours } from "./window";

// The sending engine (docs/guide.md, Step 7). It never loops or sleeps: each
// cron tick looks at every mailbox and sends at most ONE due email from each.

export const SENDABLE_LEAD_STATUSES = ["qualified", "ready", "in_sequence"];

export function isLive() {
  return process.env.MESSAGING_MODE === "live";
}

interface MailboxDue {
  id: number;
  email: string;
  sender_name: string | null;
  status: string;
  daily_cap: number;
  ramp_started_on: Date;
  domain_id: number;
  domain_cap: number;
}

interface ClaimedStep {
  id: string;
  lead_id: string;
  step_no: number;
  subject: string;
  body: string;
  email: string;
  first_name: string | null;
  timezone: string | null;
  prev_thread_id: string | null;
  prev_rfc_id: string | null;
  prev_sent_at: Date | null;
}

export type SendOutcome =
  | { mailbox: string; result: "sent"; stepId: string; leadId: string }
  | { mailbox: string; result: "idle" | "capped" | "skipped" | "stopped_on_reply" | "error"; detail?: string };

/** Raises each warming mailbox's cap with its ramp week; warming becomes active at the full cap. */
export async function applyWarmupRamp() {
  const rows = await q<{ id: number; daily_cap: number; ramp_started_on: Date; status: string }>(
    `select id, daily_cap, ramp_started_on, status from outreach.mailboxes where status = 'warming'`,
  );
  for (const m of rows) {
    const cap = rampCap(m.ramp_started_on);
    if (cap > m.daily_cap) {
      await q(`update outreach.mailboxes set daily_cap = $2, status = case when $2 >= 40 then 'active' else status end where id = $1`, [m.id, cap]);
      await logEvent("ramp_raised", { mailbox_id: m.id, daily_cap: cap });
    }
  }
}

/** Atomically claims ONE ready, due step for this mailbox and flips it to "sending". */
export async function claimStep(mailboxId: number, at = new Date()): Promise<ClaimedStep | null> {
  const { start, end } = windowHours();
  return tx(async (db) => {
    const row = await one<ClaimedStep>(
      `select s.id, s.lead_id, s.step_no, s.subject, s.body, l.email, l.first_name, l.timezone,
              p.gmail_thread_id as prev_thread_id, p.rfc_message_id as prev_rfc_id, p.sent_at as prev_sent_at
         from outreach.steps s
         join outreach.leads l on l.id = s.lead_id
         left join outreach.steps p on p.lead_id = s.lead_id and p.step_no = s.step_no - 1
        where s.status = 'ready' and s.due_at is not null and s.due_at <= now()
          and l.status = any($2)
          and ((s.step_no = 1 and s.mailbox_id is null) or (s.step_no > 1 and s.mailbox_id = $1 and p.status = 'sent'))
          and extract(isodow from $5::timestamptz at time zone coalesce(l.timezone, 'UTC')) between 1 and 5
          and extract(hour from $5::timestamptz at time zone coalesce(l.timezone, 'UTC')) >= $3
          and extract(hour from $5::timestamptz at time zone coalesce(l.timezone, 'UTC')) < $4
        order by s.step_no desc, s.due_at, s.id
        limit 1
        for update of s skip locked`,
      [mailboxId, SENDABLE_LEAD_STATUSES, start, end, at],
      db,
    );
    if (!row) return null;
    await db.query(`update outreach.steps set status = 'sending', mailbox_id = $2 where id = $1`, [row.id, mailboxId]);
    return row;
  });
}

/** Puts a claimed step back (first emails are untied from the mailbox so another one can pick them up). */
async function putBack(step: ClaimedStep, error?: string) {
  await q(
    `update outreach.steps set status = 'ready', error = $2, mailbox_id = case when step_no = 1 then null else mailbox_id end where id = $1 and status = 'sending'`,
    [step.id, error ?? null],
  );
}

export async function sendFromMailbox(m: MailboxDue, gmail: GmailPort = googleGmail, now = new Date()): Promise<SendOutcome> {
  const [sent, domainSent] = await Promise.all([sendsToday(m.id), domainSendsToday(m.domain_id)]);
  const cap = m.status === "warming" ? Math.min(m.daily_cap, rampCap(m.ramp_started_on, now)) : m.daily_cap;
  if (allowedSends({ cap, sentToday: sent, domainCap: m.domain_cap, domainSentToday: domainSent }) <= 0) return { mailbox: m.email, result: "capped" };

  const step = await claimStep(m.id, now);
  if (!step) return { mailbox: m.email, result: "idle" };

  // Belt and braces: the claim query already filtered on the window.
  if (!inSendWindow(now, step.timezone ?? "UTC")) {
    await putBack(step);
    return { mailbox: m.email, result: "skipped", detail: "outside recipient window" };
  }

  // Re-check suppression and lead status immediately before sending.
  const lead = await one<{ status: string }>(`select status from outreach.leads where id = $1`, [step.lead_id]);
  if (await isSuppressed(step.email)) {
    await tx((db) => stopSequence(step.lead_id, "unsubscribed", db));
    return { mailbox: m.email, result: "skipped", detail: "suppressed" };
  }
  if (!lead || !SENDABLE_LEAD_STATUSES.includes(lead.status)) {
    await q(`update outreach.steps set status = 'skipped' where id = $1`, [step.id]);
    return { mailbox: m.email, result: "skipped", detail: `lead is ${lead?.status ?? "missing"}` };
  }

  // Follow-ups: fetch the thread once and stop if anyone else wrote since our last send.
  if (step.step_no > 1 && step.prev_thread_id) {
    try {
      const messages = await gmail.threadMessages(m.email, step.prev_thread_id);
      const since = step.prev_sent_at ? new Date(step.prev_sent_at).getTime() : 0;
      const replied = messages.some((msg) => msg.internalDate > since && !msg.from.toLowerCase().includes(m.email.toLowerCase()));
      if (replied) {
        await tx((db) => stopSequence(step.lead_id, "replied", db));
        await logEvent("stopped_on_reply", { lead_id: step.lead_id, step_no: step.step_no, source: "pre-send thread check" });
        return { mailbox: m.email, result: "stopped_on_reply" };
      }
    } catch (err) {
      await putBack(step, "thread check failed");
      return handleGmailError(m, err);
    }
  }

  const messageId = newMessageId(m.email);
  let raw: string;
  try {
    raw = rawMessage({
      from: formatFrom(m.sender_name, m.email),
      to: step.email,
      subject: step.subject,
      body: composeBody({ firstName: step.first_name, body: step.body, senderName: m.sender_name, stepNo: step.step_no }),
      messageId,
      inReplyTo: step.step_no > 1 ? step.prev_rfc_id : null,
      unsubMailto: `${m.email}?subject=unsubscribe`,
      unsubUrl: unsubUrl(step.lead_id),
    });
  } catch (err) {
    await putBack(step, String(err));
    return { mailbox: m.email, result: "error", detail: err instanceof Error ? err.message : String(err) };
  }

  let sentMsg: { id: string; threadId: string };
  try {
    sentMsg = await gmail.send(m.email, raw, step.step_no > 1 ? step.prev_thread_id : null);
  } catch (err) {
    const kind = classifyGmailError(err);
    if (kind === "permanent") {
      await q(`update outreach.steps set status = 'failed', error = $2 where id = $1`, [step.id, String(err).slice(0, 500)]);
      await logEvent("send_failed", { step_id: step.id, mailbox: m.email, error: String(err).slice(0, 300) });
      return { mailbox: m.email, result: "error", detail: "permanent send error" };
    }
    await putBack(step, `${kind}: ${String(err).slice(0, 300)}`);
    return handleGmailError(m, err);
  }

  const rfc = (await gmail.rfcMessageId(m.email, sentMsg.id).catch(() => null)) ?? messageId;
  const gap = nextGapSeconds(randomInt);
  const nextStep = step.step_no + 1;
  const nextDue = FOLLOW_UP_GAP_DAYS[step.step_no] ? addBusinessDays(now, FOLLOW_UP_GAP_DAYS[step.step_no]!) : null;

  await tx(async (db) => {
    await db.query(
      `update outreach.steps set status = 'sent', sent_at = now(), gmail_message_id = $2, gmail_thread_id = $3, rfc_message_id = $4, error = null where id = $1`,
      [step.id, sentMsg.id, sentMsg.threadId, rfc],
    );
    await db.query(`update outreach.mailboxes set next_send_at = now() + make_interval(secs => $2) where id = $1`, [m.id, gap]);
    if (nextDue) {
      await db.query(
        `update outreach.steps set due_at = $3, mailbox_id = $4 where lead_id = $1 and step_no = $2 and status = 'ready'`,
        [step.lead_id, nextStep, nextDue, m.id],
      );
      await db.query(`update outreach.leads set status = 'in_sequence', updated_at = now() where id = $1 and status in ('qualified', 'ready')`, [step.lead_id]);
    } else {
      await db.query(`update outreach.leads set status = 'completed', updated_at = now() where id = $1 and status in ('ready', 'in_sequence')`, [step.lead_id]);
    }
  });
  await logEvent("sent", { step_id: step.id, lead_id: step.lead_id, step_no: step.step_no, mailbox: m.email, next_gap_s: gap });
  return { mailbox: m.email, result: "sent", stepId: step.id, leadId: step.lead_id };
}

async function handleGmailError(m: MailboxDue, err: unknown): Promise<SendOutcome> {
  const kind = classifyGmailError(err);
  const detail = String(err instanceof Error ? err.message : err).slice(0, 300);
  if (kind === "quota") {
    const hours = guardConfig().quota_pause_hours;
    await q(`update outreach.mailboxes set paused_until = now() + make_interval(hours => $2), paused_reason = $3 where id = $1`, [m.id, hours, `Gmail quota/rate error: ${detail}`]);
    await logEvent("mailbox_paused", { mailbox: m.email, reason: "quota", hours, error: detail });
  } else if (kind === "auth") {
    await q(`update outreach.mailboxes set status = 'paused', paused_reason = $2 where id = $1`, [m.id, `Auth/suspension error: ${detail}`]);
    await alert(`Mailbox ${m.email} paused: authentication or suspension error (${detail}). Check the Admin console.`, { mailbox: m.email });
  } else {
    await logEvent("send_retry", { mailbox: m.email, error: detail });
  }
  return { mailbox: m.email, result: "error", detail: `${kind}: ${detail}` };
}

/** One sender tick across the fleet. */
export async function sendTick(gmail: GmailPort = googleGmail) {
  if (!isLive()) return { live: false, outcomes: [] as SendOutcome[], note: "MESSAGING_MODE is not \"live\": nothing is sent." };
  await applyWarmupRamp();
  const mailboxes = await q<MailboxDue>(
    `select m.id, m.email, m.sender_name, m.status, m.daily_cap, m.ramp_started_on, m.domain_id, d.daily_cap as domain_cap
       from outreach.mailboxes m join outreach.domains d on d.id = m.domain_id
      where m.status in ('active', 'warming') and d.status in ('active', 'warming')
        and m.next_send_at <= now() and (m.paused_until is null or m.paused_until <= now())
      order by m.next_send_at`,
  );
  const results = await Promise.allSettled(mailboxes.map((m) => sendFromMailbox(m, gmail)));
  const outcomes = results.map((r, i) =>
    r.status === "fulfilled" ? r.value : ({ mailbox: mailboxes[i]!.email, result: "error", detail: String(r.reason).slice(0, 300) } as SendOutcome),
  );
  return { live: true, outcomes };
}
