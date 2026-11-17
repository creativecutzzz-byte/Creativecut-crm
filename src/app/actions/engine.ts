"use server";

import type { ActionState } from "@/lib/actions";
import { engineAccess } from "@/lib/engine/access";
import { isDatabaseConfigured, one, q } from "@/lib/engine/db/pool";
import { logEvent } from "@/lib/engine/db/queries";
import { importLeadsCsv } from "@/lib/engine/intake/upload";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Dashboard actions for the Outreach Engine. Every one checks engineAccess()
// (owner/admin on ALLOWED_LOGIN_DOMAIN). Resuming is always a person's call.

async function guard(): Promise<{ email: string } | { error: string }> {
  const access = await engineAccess();
  if (!access.ok) return { error: access.reason };
  if (!isDatabaseConfigured()) return { error: "DATABASE_URL is not set." };
  return { email: access.email };
}

const done = (message: string): ActionState => {
  revalidatePath("/engine");
  return { ok: true, message };
};

const id = z.coerce.number().int().positive();
const DOMAIN_RE = /^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

export async function resumeMailbox(_: ActionState, form: FormData): Promise<ActionState> {
  const g = await guard();
  if ("error" in g) return g;
  const mid = id.safeParse(form.get("id"));
  if (!mid.success) return { error: "Unknown mailbox" };
  await q(
    `update outreach.mailboxes set status = case when daily_cap >= 40 then 'active' else 'warming' end, paused_reason = null, paused_until = null where id = $1`,
    [mid.data],
  );
  await logEvent("mailbox_resumed", { id: mid.data, by: g.email });
  return done("Mailbox resumed");
}

export async function pauseMailbox(_: ActionState, form: FormData): Promise<ActionState> {
  const g = await guard();
  if ("error" in g) return g;
  const mid = id.safeParse(form.get("id"));
  if (!mid.success) return { error: "Unknown mailbox" };
  await q(`update outreach.mailboxes set status = 'paused', paused_reason = $2 where id = $1`, [mid.data, `Paused by ${g.email}`]);
  await logEvent("mailbox_paused", { id: mid.data, reason: "manual", by: g.email });
  return done("Mailbox paused");
}

export async function resumeDomain(_: ActionState, form: FormData): Promise<ActionState> {
  const g = await guard();
  if ("error" in g) return g;
  const did = id.safeParse(form.get("id"));
  if (!did.success) return { error: "Unknown domain" };
  await q(`update outreach.domains set status = 'active', paused_reason = null where id = $1`, [did.data]);
  await logEvent("domain_resumed", { id: did.data, by: g.email });
  return done("Domain resumed");
}

export async function addDomainWithMailboxes(_: ActionState, form: FormData): Promise<ActionState> {
  const g = await guard();
  if ("error" in g) return g;
  const domain = String(form.get("domain") ?? "").trim().toLowerCase();
  if (!DOMAIN_RE.test(domain)) return { error: "Enter a domain like trybrand.com" };
  const lines = String(form.get("mailboxes") ?? "")
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const boxes: { email: string; name: string | null }[] = [];
  for (const line of lines) {
    // "Aanya Mehta <aanya@trybrand.com>" or "aanya@trybrand.com"
    const m = line.match(/^(?:(.+?)\s*<)?([^\s<>]+@[^\s<>]+)>?$/);
    if (!m || !m[2]!.toLowerCase().endsWith(`@${domain}`)) return { error: `"${line}" is not a mailbox on ${domain}` };
    boxes.push({ email: m[2]!.toLowerCase(), name: m[1]?.trim() || null });
  }
  if (boxes.length > 5) return { error: "Use at most 5 mailboxes per domain (the guide uses 3)." };
  const d = await one<{ id: number }>(
    `insert into outreach.domains (name) values ($1) on conflict (name) do update set name = excluded.name returning id`,
    [domain],
  );
  for (const b of boxes) {
    await q(
      `insert into outreach.mailboxes (domain_id, email, sender_name) values ($1, $2, $3) on conflict (email) do update set sender_name = excluded.sender_name`,
      [d!.id, b.email, b.name],
    );
  }
  await logEvent("fleet_changed", { domain, mailboxes: boxes.length, by: g.email });
  return done(`Saved ${domain} with ${boxes.length} mailbox${boxes.length === 1 ? "" : "es"} (warming)`);
}

export async function recordPostmaster(_: ActionState, form: FormData): Promise<ActionState> {
  const g = await guard();
  if ("error" in g) return g;
  const parsed = z
    .object({
      domain_id: id,
      spam_rate: z.union([z.literal(""), z.coerce.number().min(0).max(100)]),
      reputation: z.enum(["", "HIGH", "MEDIUM", "LOW", "BAD"]),
    })
    .safeParse({ domain_id: form.get("domain_id"), spam_rate: form.get("spam_rate") ?? "", reputation: form.get("reputation") ?? "" });
  if (!parsed.success) return { error: "Enter the spam rate as a percentage (e.g. 0.08) and pick a reputation." };
  const spam = parsed.data.spam_rate === "" ? null : Number(parsed.data.spam_rate) / 100;
  await q(
    `insert into outreach.postmaster (domain_id, day, spam_rate, reputation) values ($1, current_date, $2, nullif($3, ''))
       on conflict (domain_id, day) do update set spam_rate = excluded.spam_rate, reputation = excluded.reputation`,
    [parsed.data.domain_id, spam, parsed.data.reputation],
  );
  return done("Postmaster numbers saved — the guard reads them on its next run");
}

export async function markMeeting(_: ActionState, form: FormData): Promise<ActionState> {
  const g = await guard();
  if ("error" in g) return g;
  const lid = z.coerce.number().int().positive().safeParse(form.get("lead_id"));
  if (!lid.success) return { error: "Unknown lead" };
  await q(`insert into outreach.meetings (lead_id, source) values ($1, 'manual') on conflict (lead_id) do nothing`, [lid.data]);
  await q(`update outreach.leads set status = 'meeting', updated_at = now() where id = $1`, [lid.data]);
  await logEvent("meeting", { lead_id: String(lid.data), by: g.email });
  return done("Marked as meeting booked");
}

export async function requeueReview(_: ActionState, form: FormData): Promise<ActionState> {
  const g = await guard();
  if ("error" in g) return g;
  const lid = z.coerce.number().int().positive().safeParse(form.get("lead_id"));
  const decision = form.get("decision");
  if (!lid.success || (decision !== "qualify" && decision !== "disqualify")) return { error: "Unknown lead" };
  await q(
    `update outreach.leads set status = $2, attempts = 0, locked_until = null, icp_reason = coalesce(icp_reason, '') || $3, updated_at = now() where id = $1 and status = 'review'`,
    [lid.data, decision === "qualify" ? "qualified" : "disqualified", ` (manual: ${decision} by ${g.email})`],
  );
  return done(decision === "qualify" ? "Sent to research" : "Disqualified");
}

export async function uploadLeads(_: ActionState, form: FormData): Promise<ActionState> {
  const g = await guard();
  if ("error" in g) return g;
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file." };
  if (file.size > 10 * 1024 * 1024) return { error: "CSV is larger than 10 MB. Split it into smaller files." };
  const s = await importLeadsCsv(await file.text(), file.name.slice(0, 80));
  const rejected = Object.entries(s.rejected)
    .map(([k, v]) => `${v} ${k.replace(/_/g, " ")}`)
    .join(", ");
  return done(`${s.inserted} of ${s.rows} rows imported${rejected ? ` · skipped: ${rejected}` : ""}`);
}
