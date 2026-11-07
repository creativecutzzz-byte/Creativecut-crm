import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { gmail } from "@/lib/integrations/gmail";
import { instagram } from "@/lib/integrations/instagram";
import { whatsapp } from "@/lib/integrations/whatsapp";
import { DAY, inSendWindow, istDayStart, unresolvedPlaceholders } from "./plan";
import { unsubscribeUrl } from "./unsubscribe";

// Sends one approved draft, with every safety check in one place:
// suppression list, "they already replied", autopilot still active, unfilled
// placeholders, sending window, daily email cap, Meta's 24-hour rule.

export const senderSettingsSchema = z.object({
  daily_email_cap: z.number().int().min(1).max(500),
  window_start_hour: z.number().int().min(0).max(23),
  window_end_hour: z.number().int().min(1).max(24),
  send_days: z.array(z.number().int().min(0).max(6)).min(1),
  postal_address: z.string().max(200),
});
export type SenderSettings = z.infer<typeof senderSettingsSchema>;

export const DEFAULT_SENDER_SETTINGS: SenderSettings = {
  daily_email_cap: 25,
  window_start_hour: 10,
  window_end_hour: 18,
  send_days: [1, 2, 3, 4, 5],
  postal_address: "",
};

export async function loadSenderSettings(supabase: SupabaseClient, orgId: string): Promise<SenderSettings> {
  const { data } = await supabase.from("agents").select("config").eq("org_id", orgId).eq("key", "outreach_sender").maybeSingle();
  const parsed = senderSettingsSchema.safeParse({ ...DEFAULT_SENDER_SETTINGS, ...((data?.config as object) ?? {}) });
  return parsed.success ? parsed.data : DEFAULT_SENDER_SETTINGS;
}

export interface SendOutcome {
  status: "sent" | "simulated" | "scheduled" | "cancelled" | "failed" | "blocked";
  message: string;
}

interface DraftRow {
  id: string;
  org_id: string;
  lead_id: string;
  kind: "sequence" | "reply";
  sequence: string | null;
  step: number | null;
  channel: "email" | "whatsapp" | "instagram" | "linkedin";
  to_address: string | null;
  subject: string | null;
  body: string;
  template_name: string | null;
  template_params: string[];
  in_reply_to_message: string | null;
  status: string;
}

interface LeadRow {
  id: string;
  name: string;
  email: string | null;
  whatsapp_number: string | null;
  instagram_handle: string | null;
  instagram_user_id: string | null;
  stage: string;
  marketing_consent: boolean;
  outreach_status: string | null;
  outreach_started_at: string | null;
  email_status: string | null;
}

export async function sendDraft(supabase: SupabaseClient, draftId: string, opts: { actorId: string | null; settings: SenderSettings; now?: Date }): Promise<SendOutcome> {
  const now = opts.now ?? new Date();
  const { data: draft } = await supabase.from("outreach_drafts").select("*").eq("id", draftId).single<DraftRow>();
  if (!draft) return { status: "failed", message: "Draft not found" };
  if (!["pending", "approved"].includes(draft.status)) return { status: "blocked", message: `This message is already ${draft.status}.` };

  const { data: lead } = await supabase
    .from("leads")
    .select("id, name, email, whatsapp_number, instagram_handle, instagram_user_id, stage, marketing_consent, outreach_status, outreach_started_at, email_status")
    .eq("id", draft.lead_id)
    .single<LeadRow>();
  if (!lead) return cancel(supabase, draft, "Lead was deleted");

  // --- Guards ---------------------------------------------------------------
  const contactValues = [lead.email?.toLowerCase(), lead.whatsapp_number?.replace(/\D/g, "")].filter((v): v is string => Boolean(v));
  if (contactValues.length) {
    const { count } = await supabase.from("suppressions").select("id", { count: "exact", head: true }).eq("org_id", draft.org_id).in("value", contactValues);
    if (count) return cancel(supabase, draft, "This contact unsubscribed");
  }
  if (draft.kind === "sequence") {
    if (lead.outreach_status !== "active") return cancel(supabase, draft, `Autopilot is ${lead.outreach_status ?? "off"} for this lead`);
    if (lead.stage === "won" || lead.stage === "lost") return cancel(supabase, draft, "Lead is closed");
    const { count: replies } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", lead.id)
      .eq("direction", "inbound")
      .gte("created_at", lead.outreach_started_at ?? "1970-01-01");
    if (replies) {
      await supabase.from("leads").update({ outreach_status: "replied" }).eq("id", lead.id).eq("outreach_status", "active");
      return cancel(supabase, draft, "They already replied — answer them personally");
    }
  }
  const leftovers = unresolvedPlaceholders(`${draft.subject ?? ""}\n${draft.body}`);
  if (leftovers.length) return { status: "blocked", message: `Fill in ${leftovers.join(", ")} before sending.` };

  // LinkedIn has no sending API: approval means "I sent it myself".
  if (draft.channel === "linkedin") {
    await supabase.from("outreach_drafts").update({ status: "sent", sent_at: now.toISOString(), approved_by: opts.actorId, approved_at: now.toISOString() }).eq("id", draft.id);
    await supabase.from("activities").insert({ org_id: draft.org_id, lead_id: lead.id, actor_id: opts.actorId, type: "note", body: `LinkedIn (done manually): ${draft.body.slice(0, 400)}` });
    return { status: "sent", message: "Marked as done on LinkedIn" };
  }

  // Cold messages respect the sending window and the daily cap; replies go now.
  if (draft.kind === "sequence") {
    const s = opts.settings;
    if (!inSendWindow(now, s.window_start_hour, s.window_end_hour, s.send_days)) {
      return schedule(supabase, draft, opts.actorId, nextWindow(now, s), "Outside sending hours — queued for the next window");
    }
    if (draft.channel === "email") {
      const { count: sentToday } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("org_id", draft.org_id)
        .eq("channel", "email")
        .eq("direction", "outbound")
        .eq("status", "sent")
        .gte("created_at", istDayStart(now));
      if ((sentToday ?? 0) >= s.daily_email_cap) {
        return schedule(supabase, draft, opts.actorId, nextWindow(new Date(now.getTime() + DAY / 2), s), `Daily cap of ${s.daily_email_cap} emails reached — queued for tomorrow`);
      }
    }
  }

  // --- Send -----------------------------------------------------------------
  let status: "sent" | "simulated" = "simulated";
  let externalId: string | null = null;
  let threadId: string | null = null;
  let rfcId: string | null = null;
  let subject = draft.subject;
  let body = draft.body;
  const to = draft.to_address ?? (draft.channel === "email" ? lead.email : draft.channel === "whatsapp" ? lead.whatsapp_number : lead.instagram_handle);
  if (!to) return fail(supabase, draft, `This lead has no ${draft.channel} address`);

  try {
    if (draft.channel === "email") {
      if (lead.email_status === "bounced") return cancel(supabase, draft, "Email address bounced");
      const thread = await threadFor(supabase, draft);
      subject = thread?.subject ? (/^re:/i.test(thread.subject) ? thread.subject : `Re: ${thread.subject}`) : draft.subject || "(no subject)";
      if (draft.kind === "sequence") body = withFooter(body, opts.settings.postal_address, unsubscribeUrl(process.env.NEXT_PUBLIC_SITE_URL ?? null, lead.id));
      if (gmail.isLive()) {
        const res = await gmail.send({ to, subject, text: body, threadId: thread?.threadId, inReplyTo: thread?.rfcId, unsubscribeUrl: draft.kind === "sequence" ? unsubscribeUrl(process.env.NEXT_PUBLIC_SITE_URL ?? null, lead.id) : null });
        status = "sent";
        externalId = res.id;
        threadId = res.threadId;
        rfcId = res.messageId;
      }
    } else if (draft.channel === "whatsapp") {
      if (draft.kind === "sequence") {
        if (!lead.marketing_consent) return cancel(supabase, draft, "No marketing consent for WhatsApp");
        if (!draft.template_name) return fail(supabase, draft, "No approved WhatsApp template set");
        const res = await whatsapp.sendTemplate({ to, templateName: draft.template_name, params: draft.template_params, renderedBody: body });
        ({ status, externalId } = { status: res.status, externalId: res.externalId });
      } else {
        if (!(await windowOpen(supabase, lead.id, "whatsapp", now))) return fail(supabase, draft, "WhatsApp's 24-hour reply window has closed");
        const res = await whatsapp.sendText({ to, body });
        ({ status, externalId } = { status: res.status, externalId: res.externalId });
      }
    } else if (draft.channel === "instagram") {
      if (!(await windowOpen(supabase, lead.id, "instagram", now))) return fail(supabase, draft, "Instagram's 24-hour reply window has closed");
      const res = await instagram.sendDirectMessage({ recipientId: lead.instagram_user_id, handle: to.replace(/^@/, ""), body });
      ({ status, externalId } = { status: res.status, externalId: res.externalId });
    }
  } catch (err) {
    return fail(supabase, draft, err instanceof Error ? err.message : String(err));
  }

  const { data: message } = await supabase
    .from("messages")
    .insert({
      org_id: draft.org_id,
      channel: draft.channel,
      direction: "outbound",
      status,
      lead_id: lead.id,
      to_address: to,
      subject,
      body,
      external_id: externalId,
      thread_id: threadId,
      rfc_message_id: rfcId,
      sent_by: opts.actorId,
    })
    .select("id")
    .single();

  await supabase
    .from("outreach_drafts")
    .update({ status: "sent", sent_at: now.toISOString(), message_id: message?.id ?? null, error: null, ...(draft.status === "pending" ? { approved_by: opts.actorId, approved_at: now.toISOString() } : {}) })
    .eq("id", draft.id);

  if (status === "sent") {
    await Promise.all([
      supabase.from("leads").update({ last_contacted_at: now.toISOString(), ...(lead.stage === "new" ? { stage: "contacted" } : {}) }).eq("id", lead.id),
      supabase.from("activities").insert({
        org_id: draft.org_id,
        lead_id: lead.id,
        actor_id: opts.actorId,
        type: draft.channel,
        body: `Sent${draft.kind === "reply" ? " reply" : ""}: ${subject ? `${subject} — ` : ""}${body.slice(0, 300)}`,
        metadata: { direction: "outbound", draft_id: draft.id },
      }),
    ]);
    return { status: "sent", message: `Sent to ${to}` };
  }
  return { status: "simulated", message: "Dry-run: recorded, nothing was delivered (set MESSAGING_MODE=live and connect the channel to send)" };
}

/** Sends every approved draft whose time has come. */
export async function processQueue(supabase: SupabaseClient, orgId: string, settings: SenderSettings, limit = 40) {
  const now = new Date();
  const { data: drafts } = await supabase
    .from("outreach_drafts")
    .select("id")
    .eq("org_id", orgId)
    .eq("status", "approved")
    .or(`scheduled_for.is.null,scheduled_for.lte.${now.toISOString()}`)
    .order("approved_at", { ascending: true })
    .limit(limit);
  const counts: Record<SendOutcome["status"], number> = { sent: 0, simulated: 0, scheduled: 0, cancelled: 0, failed: 0, blocked: 0 };
  for (const d of drafts ?? []) counts[(await sendDraft(supabase, d.id, { actorId: null, settings, now })).status]++;
  return counts;
}

async function threadFor(supabase: SupabaseClient, draft: DraftRow) {
  let messageId: string | null = null;
  if (draft.kind === "reply" && draft.in_reply_to_message) {
    messageId = draft.in_reply_to_message;
  } else if (draft.kind === "sequence") {
    // Follow-ups continue the thread of the first email in this sequence.
    const { data: first } = await supabase
      .from("outreach_drafts")
      .select("message_id")
      .eq("lead_id", draft.lead_id)
      .eq("sequence", draft.sequence ?? "")
      .eq("channel", "email")
      .eq("status", "sent")
      .not("message_id", "is", null)
      .order("sent_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    messageId = (first?.message_id as string | undefined) ?? null;
  }
  if (!messageId) return null;
  const { data: m } = await supabase.from("messages").select("subject, thread_id, rfc_message_id").eq("id", messageId).maybeSingle();
  if (!m?.thread_id) return null;
  return { subject: m.subject as string | null, threadId: m.thread_id as string, rfcId: m.rfc_message_id as string | null };
}

async function windowOpen(supabase: SupabaseClient, leadId: string, channel: "whatsapp" | "instagram", now: Date) {
  const { data } = await supabase
    .from("messages")
    .select("created_at")
    .eq("lead_id", leadId)
    .eq("channel", channel)
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return Boolean(data && now.getTime() - new Date(data.created_at as string).getTime() < DAY);
}

function withFooter(body: string, address: string, url: string | null) {
  const lines = ["", "--", ...(address ? [address] : []), url ? `Not relevant? Reply "unsubscribe" or click: ${url}` : `Not relevant? Just reply "unsubscribe".`];
  return `${body.trimEnd()}\n${lines.join("\n")}`;
}

function nextWindow(from: Date, s: SenderSettings) {
  // Walk forward hour by hour (max 8 days) to the next allowed slot.
  const t = new Date(from);
  t.setUTCMinutes(0, 0, 0);
  for (let i = 0; i < 24 * 8; i++) {
    t.setTime(t.getTime() + 3_600_000);
    if (inSendWindow(t, s.window_start_hour, s.window_end_hour, s.send_days)) return t;
  }
  return new Date(from.getTime() + DAY);
}

async function schedule(supabase: SupabaseClient, draft: DraftRow, actorId: string | null, at: Date, message: string): Promise<SendOutcome> {
  await supabase
    .from("outreach_drafts")
    .update({ status: "approved", scheduled_for: at.toISOString(), ...(draft.status === "pending" ? { approved_by: actorId, approved_at: new Date().toISOString() } : {}) })
    .eq("id", draft.id);
  return { status: "scheduled", message: `${message} (${at.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} IST)` };
}

async function cancel(supabase: SupabaseClient, draft: DraftRow, reason: string): Promise<SendOutcome> {
  await supabase.from("outreach_drafts").update({ status: "cancelled", error: reason }).eq("id", draft.id);
  return { status: "cancelled", message: reason };
}

async function fail(supabase: SupabaseClient, draft: DraftRow, reason: string): Promise<SendOutcome> {
  await supabase.from("outreach_drafts").update({ status: "failed", error: reason.slice(0, 500) }).eq("id", draft.id);
  return { status: "failed", message: reason };
}
