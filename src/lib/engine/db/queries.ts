import { one, q, type Db, pool } from "./pool";

// Typed query helpers shared by the pipeline stages, the sender and the guard.

export type LeadStatus =
  | "uploaded" | "verified" | "qualified" | "disqualified" | "review" | "researched" | "ready"
  | "in_sequence" | "replied" | "bounced" | "unsubscribed" | "completed" | "meeting" | "skipped";

export interface LeadRow {
  id: string; // bigint comes back as a string
  email: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  company: string | null;
  website: string | null;
  country: string | null;
  timezone: string | null;
  employees: number | null;
  source: string | null;
  segment: string | null;
  status: LeadStatus;
  icp_score: number | null;
  icp_reason: string | null;
  attempts: number;
}

export interface MailboxRow {
  id: number;
  domain_id: number;
  email: string;
  sender_name: string | null;
  status: "warming" | "active" | "paused";
  daily_cap: number;
  ramp_started_on: string;
  next_send_at: Date;
  history_id: string | null;
}

/**
 * Claims up to `limit` leads in `status` for one cron run. FOR UPDATE SKIP LOCKED
 * means parallel runs never pick the same lead; the lease (locked_until) keeps
 * it claimed while the slow work (fetches, model calls) happens outside the
 * transaction. A crashed run's leads become claimable again after the lease.
 */
export async function claimLeads(status: LeadStatus, limit: number, leaseSeconds = 300, db: Db = pool()) {
  return q<LeadRow>(
    `update outreach.leads set locked_until = now() + make_interval(secs => $3), updated_at = now()
      where id in (
        select id from outreach.leads
         where status = $1 and (locked_until is null or locked_until < now())
         order by id
         limit $2
         for update skip locked)
      returning *`,
    [status, limit, leaseSeconds],
    db,
  );
}

/** Moves a claimed lead to its next status and releases the lease. */
export async function setLeadStatus(id: string, status: LeadStatus, extra: Record<string, unknown> = {}, db: Db = pool()) {
  const cols = Object.keys(extra);
  const sets = cols.map((c, i) => `${c} = $${i + 3}`).join(", ");
  await q(
    `update outreach.leads set status = $2, locked_until = null, updated_at = now()${sets ? ", " + sets : ""} where id = $1`,
    [id, status, ...cols.map((c) => extra[c])],
    db,
  );
}

export async function releaseLead(id: string, db: Db = pool()) {
  await q(`update outreach.leads set locked_until = null, attempts = attempts + 1 where id = $1`, [id], db);
}

/** Sends counted against today's caps (UTC day). Dry-run sends count too, so pacing is realistic. */
export async function sendsToday(mailboxId: number, db: Db = pool()) {
  const row = await one<{ n: string }>(
    `select count(*) as n from outreach.steps where mailbox_id = $1 and status = 'sent' and sent_at >= date_trunc('day', now())`,
    [mailboxId],
    db,
  );
  return Number(row?.n ?? 0);
}

export async function domainSendsToday(domainId: number, db: Db = pool()) {
  const row = await one<{ n: string }>(
    `select count(*) as n from outreach.steps s join outreach.mailboxes m on m.id = s.mailbox_id
      where m.domain_id = $1 and s.status = 'sent' and s.sent_at >= date_trunc('day', now())`,
    [domainId],
    db,
  );
  return Number(row?.n ?? 0);
}

export async function isSuppressed(email: string, db: Db = pool()) {
  const row = await one(`select 1 from outreach.suppression where email = lower($1)`, [email.trim()], db);
  return Boolean(row);
}

export async function suppress(email: string, reason: "unsubscribed" | "bounced" | "complaint" | "manual", db: Db = pool()) {
  await q(
    `insert into outreach.suppression (email, reason) values (lower($1), $2) on conflict (email) do nothing`,
    [email.trim(), reason],
    db,
  );
}

export async function logEvent(type: string, payload: Record<string, unknown> = {}, db: Db = pool()) {
  try {
    await q(`insert into outreach.events (type, payload) values ($1, $2)`, [type, JSON.stringify(payload)], db);
  } catch {
    // Logging must never break the pipeline.
  }
}

/**
 * Stops a lead's sequence: in one statement set the lead's status and skip every
 * step that has not been sent. Used for human replies, unsubscribes and bounces.
 */
export async function stopSequence(leadId: string, status: LeadStatus, db: Db) {
  await q(`update outreach.leads set status = $2, locked_until = null, updated_at = now() where id = $1`, [leadId, status], db);
  await q(`update outreach.steps set status = 'skipped' where lead_id = $1 and status in ('ready', 'sending')`, [leadId], db);
}
