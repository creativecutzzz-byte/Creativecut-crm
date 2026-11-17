import { icpConfig } from "../config";
import { rampCap } from "../sender/caps";
import { one, q } from "./pool";

// Server-side queries for the Outreach Engine dashboard (docs/guide.md, Step 11).
// Only real data: every number comes from the outreach schema.

const HUMAN_REPLY = "not r.is_auto and not r.is_bounce";

export async function fleetStatus() {
  const rows = await q<{ id: number; status: string; daily_cap: number; mailboxes: string; healthy: string; mailbox_caps: string }>(
    `select d.id, d.status, d.daily_cap,
            count(m.id) as mailboxes,
            count(m.id) filter (where m.status <> 'paused' and (m.paused_until is null or m.paused_until <= now())) as healthy,
            coalesce(sum(least(m.daily_cap, 40)) filter (where m.status <> 'paused' and (m.paused_until is null or m.paused_until <= now())), 0) as mailbox_caps
       from outreach.domains d left join outreach.mailboxes m on m.domain_id = d.id
      group by d.id order by d.id`,
  );
  const domains = rows.length;
  const activeDomains = rows.filter((r) => r.status !== "paused").length;
  const mailboxes = rows.reduce((a, r) => a + Number(r.mailboxes), 0);
  const healthy = rows.filter((r) => r.status !== "paused").reduce((a, r) => a + Number(r.healthy), 0);
  const capacity = rows.filter((r) => r.status !== "paused").reduce((a, r) => a + Math.min(Number(r.mailbox_caps), r.daily_cap, 120), 0);
  return { domains, activeDomains, mailboxes, healthy, capacity };
}

export async function todayWindow() {
  const row = await one<{ sent: string; next_send_in: number | null; replies: string; interested: string; meetings: string }>(
    `select (select count(*) from outreach.steps where status = 'sent' and sent_at >= date_trunc('day', now())) as sent,
            (select greatest(0, extract(epoch from min(next_send_at) - now()))::int from outreach.mailboxes m join outreach.domains d on d.id = m.domain_id
              where m.status <> 'paused' and d.status <> 'paused') as next_send_in,
            (select count(*) from outreach.replies r where ${HUMAN_REPLY} and r.received_at >= date_trunc('day', now())) as replies,
            (select count(*) from outreach.replies r where r.intent = 'interested' and r.received_at >= date_trunc('day', now())) as interested,
            (select count(*) from outreach.meetings where booked_at >= date_trunc('day', now())) as meetings`,
  );
  return {
    sent: Number(row?.sent ?? 0),
    nextSendIn: row?.next_send_in ?? null,
    replies: Number(row?.replies ?? 0),
    interested: Number(row?.interested ?? 0),
    meetings: Number(row?.meetings ?? 0),
  };
}

export async function perDay(days: number) {
  const rows = await q<{ day: string; sent: string; replies: string; interested: string; meetings: string }>(
    `with days as (select generate_series(date_trunc('day', now()) - make_interval(days => $1 - 1), date_trunc('day', now()), interval '1 day') as day)
     select to_char(days.day, 'YYYY-MM-DD') as day,
            (select count(*) from outreach.steps s where s.status = 'sent' and date_trunc('day', s.sent_at) = days.day) as sent,
            (select count(*) from outreach.replies r where ${HUMAN_REPLY} and date_trunc('day', r.received_at) = days.day) as replies,
            (select count(*) from outreach.replies r where r.intent = 'interested' and date_trunc('day', r.received_at) = days.day) as interested,
            (select count(*) from outreach.meetings mt where date_trunc('day', mt.booked_at) = days.day) as meetings
       from days order by days.day`,
    [days],
  );
  return rows.map((r) => ({ day: r.day.slice(5), sent: Number(r.sent), replies: Number(r.replies), interested: Number(r.interested), meetings: Number(r.meetings) }));
}

export async function funnel() {
  const min = icpConfig().min_score;
  const r = await one<Record<string, string>>(
    `select (select count(*) from outreach.leads) as uploaded,
            (select count(*) from outreach.leads where verify_result in ('valid', 'catch_all', 'risky', 'not_verified')) as verified,
            (select count(*) from outreach.leads where icp_score >= $1) as qualified,
            (select count(*) from outreach.research where gate_passed) as researched,
            (select count(distinct lead_id) from outreach.steps where status = 'sent') as sent,
            (select count(distinct r.lead_id) from outreach.replies r where ${HUMAN_REPLY}) as replied,
            (select count(distinct r.lead_id) from outreach.replies r where r.intent = 'interested') as interested,
            (select count(*) from outreach.meetings) as meeting`,
    [min],
  );
  const order = ["uploaded", "verified", "qualified", "researched", "sent", "replied", "interested", "meeting"];
  return order.map((stage) => ({ stage, count: Number(r?.[stage] ?? 0) }));
}

export async function replyIntents(days: number) {
  const rows = await q<{ intent: string; n: string }>(
    `select coalesce(intent, 'unclassified') as intent, count(*) as n from outreach.replies r
      where ${HUMAN_REPLY} and r.received_at >= now() - make_interval(days => $1) group by 1 order by 2 desc`,
    [days],
  );
  return rows.map((r) => ({ intent: r.intent, count: Number(r.n) }));
}

/** Replies by recipient-local weekday (1-7) and hour. */
export async function replyHeatmap(days: number) {
  const rows = await q<{ dow: number; hour: number; n: string }>(
    `select extract(isodow from r.received_at at time zone coalesce(l.timezone, 'UTC'))::int as dow,
            extract(hour from r.received_at at time zone coalesce(l.timezone, 'UTC'))::int as hour, count(*) as n
       from outreach.replies r join outreach.leads l on l.id = r.lead_id
      where ${HUMAN_REPLY} and r.received_at >= now() - make_interval(days => $1) group by 1, 2`,
    [days],
  );
  return rows.map((r) => ({ dow: r.dow, hour: r.hour, count: Number(r.n) }));
}

export async function sendRegions(days: number) {
  const rows = await q<{ country: string; n: string }>(
    `select coalesce(l.country, '??') as country, count(*) as n from outreach.steps s join outreach.leads l on l.id = s.lead_id
      where s.status = 'sent' and s.sent_at >= now() - make_interval(days => $1) group by 1 order by 2 desc limit 12`,
    [days],
  );
  return rows.map((r) => ({ country: r.country, count: Number(r.n) }));
}

export async function mailboxFleet() {
  const rows = await q<{
    id: number; email: string; domain: string; domain_status: string; status: string; daily_cap: number; ramp_started_on: Date;
    paused_reason: string | null; paused_until: Date | null; domain_paused_reason: string | null; sent_today: string; last100: string; bounced: string; domain_id: number;
  }>(
    `select m.id, m.email, d.name as domain, d.id as domain_id, d.status as domain_status, d.paused_reason as domain_paused_reason, m.status, m.daily_cap,
            m.ramp_started_on, m.paused_reason, m.paused_until,
            (select count(*) from outreach.steps s where s.mailbox_id = m.id and s.status = 'sent' and s.sent_at >= date_trunc('day', now())) as sent_today,
            x.n as last100, x.bounced
       from outreach.mailboxes m join outreach.domains d on d.id = m.domain_id
       cross join lateral (
         select count(*) as n, count(*) filter (where l.status = 'bounced') as bounced
           from (select lead_id from outreach.steps where mailbox_id = m.id and status = 'sent' order by sent_at desc limit 100) t
           join outreach.leads l on l.id = t.lead_id) x
      order by d.name, m.email`,
  );
  return rows.map((r) => {
    const days = Math.max(0, Math.floor((Date.now() - new Date(r.ramp_started_on).getTime()) / 86_400_000));
    const cap = r.status === "warming" ? Math.min(r.daily_cap, rampCap(r.ramp_started_on)) : r.daily_cap;
    return {
      id: r.id,
      domainId: r.domain_id,
      email: r.email,
      domain: r.domain,
      domainStatus: r.domain_status,
      domainPausedReason: r.domain_paused_reason,
      status: r.paused_until && new Date(r.paused_until) > new Date() ? "paused (24h)" : r.status,
      pausedReason: r.paused_reason,
      sentToday: Number(r.sent_today),
      cap,
      rampWeek: Math.min(4, Math.floor(days / 7) + 1),
      bounceRate: Number(r.last100) ? Number(r.bounced) / Number(r.last100) : 0,
      sends: Number(r.last100),
    };
  });
}

export async function researchEngine(capacity: number) {
  const r = await one<Record<string, string | null>>(
    `select (select count(*) from outreach.research where gate_passed and created_at >= date_trunc('day', now())) as researched_today,
            (select round(avg(duration_ms)) from outreach.research where created_at >= date_trunc('day', now())) as avg_ms,
            (select count(*) from outreach.research where not gate_passed and created_at >= date_trunc('day', now())) as gate_failed_today,
            (select count(*) from outreach.leads where status = 'uploaded') as q_uploaded,
            (select count(*) from outreach.leads where status = 'verified') as q_verified,
            (select count(*) from outreach.leads where status = 'qualified') as q_qualified,
            (select count(*) from outreach.leads where status = 'review') as q_review,
            (select count(*) from outreach.steps s join outreach.leads l on l.id = s.lead_id
              where s.step_no = 1 and s.status = 'ready' and l.status = 'ready') as ready_first`,
  );
  const ready = Number(r?.ready_first ?? 0);
  return {
    researchedToday: Number(r?.researched_today ?? 0),
    avgMs: r?.avg_ms ? Number(r.avg_ms) : null,
    gateFailedToday: Number(r?.gate_failed_today ?? 0),
    queue: { uploaded: Number(r?.q_uploaded ?? 0), verified: Number(r?.q_verified ?? 0), qualified: Number(r?.q_qualified ?? 0), review: Number(r?.q_review ?? 0) },
    readyFirst: ready,
    runwayDays: capacity > 0 ? ready / capacity : null,
  };
}

export async function modelChainUsage() {
  const rows = await q<{ day: string; model: string; n: string }>(
    `select to_char(date_trunc('day', created_at), 'MM-DD') as day, coalesce(model, 'none') as model, count(*) as n
       from outreach.research where created_at >= date_trunc('day', now()) - interval '13 days' and model is not null
      group by 1, 2 order by 1`,
  );
  const models = [...new Set(rows.map((r) => r.model))];
  const byDay = new Map<string, Record<string, number | string>>();
  for (const r of rows) {
    const d = byDay.get(r.day) ?? { day: r.day };
    d[r.model] = Number(r.n);
    byDay.set(r.day, d);
  }
  return { models, data: [...byDay.values()] };
}

export const ACTIVITY_FILTERS: Record<string, string[]> = {
  all: [],
  replies: ["reply", "auto_reply", "bounce", "unsubscribed"],
  sends: ["sent", "send_failed", "send_retry", "stopped_on_reply"],
  research: ["researched", "gate_failed", "leads_uploaded", "model_failed", "research_failed", "qualify_failed", "verify_failed"],
  issues: ["alert", "mailbox_paused", "domain_paused", "cron_failed", "model_failed", "send_failed", "reply_failed", "domain_cap_halved", "reply_rate_alert", "history_reset", "gate_failed"],
};

export async function activity(filter: string, limit = 40) {
  const types = ACTIVITY_FILTERS[filter] ?? [];
  return q<{ id: string; type: string; payload: Record<string, unknown>; created_at: Date }>(
    `select id, type, payload, created_at from outreach.events ${types.length ? "where type = any($2)" : ""} order by created_at desc limit $1`,
    types.length ? [limit, types] : [limit],
  );
}

export async function recentReplies(limit = 12) {
  return q<{ id: string; lead_id: string; email: string; first_name: string | null; company: string | null; intent: string | null; summary: string | null; body: string | null; received_at: Date; mailbox: string | null; thread: string | null }>(
    `select r.id, r.lead_id, l.email, l.first_name, l.company, r.intent, r.summary, left(r.body, 400) as body, r.received_at, m.email as mailbox, r.gmail_thread_id as thread
       from outreach.replies r join outreach.leads l on l.id = r.lead_id left join outreach.mailboxes m on m.id = r.mailbox_id
      where ${HUMAN_REPLY} order by r.received_at desc limit $1`,
    [limit],
  );
}

export async function segments(days: number) {
  const rows = await q<{ segment: string; sends: string; replies: string; interested: string; meetings: string }>(
    `select coalesce(l.segment, '(none)') as segment,
            count(distinct s.lead_id) as sends,
            count(distinct r.lead_id) filter (where ${HUMAN_REPLY}) as replies,
            count(distinct r.lead_id) filter (where r.intent = 'interested') as interested,
            count(distinct mt.lead_id) as meetings
       from outreach.steps s join outreach.leads l on l.id = s.lead_id
       left join outreach.replies r on r.lead_id = l.id
       left join outreach.meetings mt on mt.lead_id = l.id
      where s.status = 'sent' and s.step_no = 1 and s.sent_at >= now() - make_interval(days => $1)
      group by 1`,
    [days],
  );
  return rows.map((r) => {
    const sends = Number(r.sends);
    return { segment: r.segment, sends, replies: Number(r.replies), interested: Number(r.interested), meetings: Number(r.meetings), replyRate: sends ? Number(r.replies) / sends : 0 };
  });
}

export async function reviewLeads(limit = 20) {
  return q<{ id: string; email: string; company: string | null; icp_reason: string | null }>(
    `select id, email, company, icp_reason from outreach.leads where status = 'review' order by updated_at desc limit $1`,
    [limit],
  );
}
