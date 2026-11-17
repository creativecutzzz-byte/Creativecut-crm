import { alert } from "../alert";
import { guardConfig } from "../config";
import { logEvent } from "../db/queries";
import { one, q } from "../db/pool";
import { domainBounceRule, mailboxBounceRule, negativeReplyRule, postmasterRules, replyRateRule, type RuleResult } from "./rules";

// Deliverability guard (docs/guide.md, Step 9). Runs every 5 minutes, pauses a
// mailbox or domain before a problem spreads, logs an event and alerts. It
// never auto-resumes: a person resumes from the dashboard.

interface Counts {
  sends: number;
  bounced: number;
  negative: number;
}

/** Last `window` sent steps for a mailbox (or a domain) and how many of those leads bounced / opted out. */
async function lastSends(scope: "mailbox" | "domain", id: number, window: number): Promise<Counts> {
  const row = await one<{ sends: string; bounced: string; negative: string }>(
    `with last as (
       select s.lead_id from outreach.steps s join outreach.mailboxes m on m.id = s.mailbox_id
        where s.status = 'sent' and ${scope === "mailbox" ? "s.mailbox_id" : "m.domain_id"} = $1
        order by s.sent_at desc limit $2)
     select count(*) as sends,
            count(*) filter (where l.status = 'bounced' and exists (select 1 from outreach.suppression x where x.email = l.email and x.reason = 'bounced')) as bounced,
            count(*) filter (where l.status = 'unsubscribed' or exists (select 1 from outreach.suppression x where x.email = l.email and x.reason = 'complaint')) as negative
       from last join outreach.leads l on l.id = last.lead_id`,
    [id, window],
  );
  return { sends: Number(row?.sends ?? 0), bounced: Number(row?.bounced ?? 0), negative: Number(row?.negative ?? 0) };
}

async function pause(kind: "mailbox" | "domain", id: number, name: string, reason: string) {
  const table = kind === "mailbox" ? "outreach.mailboxes" : "outreach.domains";
  const changed = await q(`update ${table} set status = 'paused', paused_reason = $2 where id = $1 and status <> 'paused' returning id`, [id, reason]);
  if (changed.length) {
    await logEvent(`${kind}_paused`, { id, name, reason });
    await alert(`${kind === "mailbox" ? "Mailbox" : "Domain"} ${name} paused: ${reason}. Review it and resume from the dashboard.`);
  }
}

async function onceToday(type: string, key: string) {
  const exists = await one(`select 1 from outreach.events where type = $1 and payload->>'key' = $2 and created_at >= date_trunc('day', now())`, [type, key]);
  if (exists) return false;
  await logEvent(type, { key });
  return true;
}

export interface GuardReport {
  mailboxes: { id: number; email: string; rules: RuleResult[] }[];
  domains: { id: number; name: string; rules: RuleResult[] }[];
}

export async function evaluateGuard(apply: boolean): Promise<GuardReport> {
  const cfg = guardConfig();
  const report: GuardReport = { mailboxes: [], domains: [] };

  const mailboxes = await q<{ id: number; email: string; status: string }>(`select id, email, status from outreach.mailboxes order by id`);
  for (const m of mailboxes) {
    const c = await lastSends("mailbox", m.id, cfg.mailbox_bounce.window);
    const rule = mailboxBounceRule(c.bounced, c.sends, cfg);
    report.mailboxes.push({ id: m.id, email: m.email, rules: [rule] });
    if (apply && rule.action === "pause") await pause("mailbox", m.id, m.email, `hard bounces ${(Number(rule.value) * 100).toFixed(1)}% of last ${c.sends} sends`);
  }

  const domains = await q<{ id: number; name: string; daily_cap: number }>(`select id, name, daily_cap from outreach.domains order by id`);
  for (const d of domains) {
    const b = await lastSends("domain", d.id, cfg.domain_bounce.window);
    const n = await lastSends("domain", d.id, cfg.negative_replies.window);
    const pm = await one<{ spam_rate: string | null; reputation: string | null }>(
      `select spam_rate, reputation from outreach.postmaster where domain_id = $1 order by day desc limit 1`,
      [d.id],
    );
    const daily = await q<{ sends: string; replies: string }>(
      `select count(*) as sends, count(*) filter (where exists (
                select 1 from outreach.replies r where r.lead_id = s.lead_id and not r.is_auto and not r.is_bounce)) as replies
         from outreach.steps s join outreach.mailboxes m on m.id = s.mailbox_id
        where m.domain_id = $1 and s.status = 'sent' and s.step_no = 1 and s.sent_at >= now() - interval '8 days'
        group by date_trunc('day', s.sent_at) order by date_trunc('day', s.sent_at)`,
      [d.id],
    );
    // Recent = the last 2 days of first emails; baseline = daily rates before that.
    const rows = daily.map((r) => ({ sends: Number(r.sends), replies: Number(r.replies) }));
    const recentRows = rows.slice(-2);
    const recent = recentRows.reduce((a, r) => ({ sends: a.sends + r.sends, replies: a.replies + r.replies }), { sends: 0, replies: 0 });
    const baseline = rows.slice(0, -2).filter((r) => r.sends > 0).map((r) => r.replies / r.sends);

    const rules = [
      domainBounceRule(b.bounced, b.sends, cfg),
      negativeReplyRule(n.negative, n.sends, cfg),
      ...postmasterRules(pm ? { spam_rate: pm.spam_rate == null ? null : Number(pm.spam_rate), reputation: pm.reputation } : null, cfg),
      replyRateRule(recent, baseline, cfg),
    ];
    report.domains.push({ id: d.id, name: d.name, rules });
    if (!apply) continue;
    for (const r of rules) {
      if (r.action === "pause") await pause("domain", d.id, d.name, `${r.rule} = ${typeof r.value === "number" ? (r.value * 100).toFixed(2) + "%" : r.value}`);
      if (r.action === "halve" && (await onceToday("domain_cap_halved", String(d.id)))) {
        await q(`update outreach.domains set daily_cap = greatest(1, daily_cap / 2) where id = $1`, [d.id]);
        await alert(`Domain ${d.name}: Postmaster spam rate ${(Number(r.value) * 100).toFixed(2)}% — daily cap halved to ${Math.max(1, Math.floor(d.daily_cap / 2))}.`);
      }
      if (r.action === "alert" && (await onceToday("reply_rate_alert", String(d.id)))) {
        await alert(`Domain ${d.name}: reply rate ${(Number(r.value) * 100).toFixed(2)}% is under half its 7-day median. Check targeting and inbox placement.`);
      }
    }
  }
  return report;
}

export const runGuard = () => evaluateGuard(true);
