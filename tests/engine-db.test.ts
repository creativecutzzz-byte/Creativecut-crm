/* eslint-disable @typescript-eslint/no-explicit-any -- row shapes in assertions */
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { GmailMessageMeta, GmailPort } from "@/lib/engine/gmail/port";

// Integration tests against a real Postgres (never production):
//   TEST_DATABASE_URL=postgres://postgres@localhost:5433/oe_test DATABASE_SSL=disable npm test
// Skipped when TEST_DATABASE_URL is not set. Gmail is a fake in-memory mailbox.

const url = process.env.TEST_DATABASE_URL;
if (url) {
  process.env.DATABASE_URL = url;
  process.env.DATABASE_SSL ??= "disable";
}

// Tuesday 17 Nov 2026, 09:00 UTC — inside the window for leads in UTC.
const TUESDAY_9AM = new Date("2026-11-17T09:00:00Z");

type Sent = { mailbox: string; raw: string; threadId: string | null };

function fakeGmail(overrides: Partial<GmailPort> = {}) {
  const sent: Sent[] = [];
  const threads = new Map<string, GmailMessageMeta[]>();
  let n = 0;
  const port: GmailPort = {
    async send(mailbox, raw, threadId) {
      n++;
      sent.push({ mailbox, raw, threadId: threadId ?? null });
      const t = threadId ?? `thread-${n}`;
      const list = threads.get(t) ?? [];
      list.push({ id: `msg-${n}`, threadId: t, internalDate: Date.now(), from: mailbox, headers: {} });
      threads.set(t, list);
      return { id: `msg-${n}`, threadId: t };
    },
    async rfcMessageId(_m, id) {
      return `<${id}@fake.test>`;
    },
    async threadMessages(_m, threadId) {
      return threads.get(threadId) ?? [];
    },
    async historySince() {
      return { messageIds: [], historyId: "1" };
    },
    async currentHistoryId() {
      return "1";
    },
    async recentInbound() {
      return [];
    },
    async getMessage() {
      throw new Error("not used");
    },
    ...overrides,
  };
  return { port, sent, threads };
}

describe.skipIf(!url)("outreach engine against Postgres", async () => {
  const { pool, q, one, tx } = await import("@/lib/engine/db/pool");
  const queries = await import("@/lib/engine/db/queries");
  const { claimStep, sendFromMailbox } = await import("@/lib/engine/sender/send");
  const { applyReply, processMessage } = await import("@/lib/engine/replies/poll");
  const { evaluateGuard } = await import("@/lib/engine/guard/run");
  const { importLeadsCsv } = await import("@/lib/engine/intake/upload");
  const A = await import("@/lib/engine/db/analytics");

  beforeAll(async () => {
    await pool().query(readFileSync("docs/schema.sql", "utf8"));
  });

  beforeEach(async () => {
    await pool().query(
      `truncate outreach.replies, outreach.steps, outreach.research, outreach.meetings, outreach.leads, outreach.mailboxes,
                outreach.postmaster, outreach.domains, outreach.suppression, outreach.events, outreach.pages restart identity cascade`,
    );
  });

  afterAll(async () => {
    await pool().end();
    globalThis.__outreachPool = undefined;
  });

  async function fleet(mailboxes = 1, opts: { cap?: number } = {}) {
    const d = await one<{ id: number }>(`insert into outreach.domains (name, status) values ('trybrand.test', 'active') returning id`);
    const out = [];
    for (let i = 0; i < mailboxes; i++) {
      out.push(
        (await one<{ id: number; email: string; domain_id: number }>(
          `insert into outreach.mailboxes (domain_id, email, sender_name, status, daily_cap, next_send_at)
           values ($1, $2, 'Aanya', 'active', $3, now() - interval '1 minute') returning id, email, domain_id`,
          [d!.id, `sender${i}@trybrand.test`, opts.cap ?? 40],
        ))!,
      );
    }
    return out;
  }

  const mailboxRow = async (id: number) =>
    (await one<any>(
      `select m.id, m.email, m.sender_name, m.status, m.daily_cap, m.ramp_started_on, m.domain_id, d.daily_cap as domain_cap
         from outreach.mailboxes m join outreach.domains d on d.id = m.domain_id where m.id = $1`,
      [id],
    ))!;

  async function readyLead(email = "riya@acme.test") {
    const lead = await one<{ id: string }>(
      `insert into outreach.leads (email, first_name, company, website, country, timezone, status)
       values ($1, 'Riya', 'Acme', 'https://acme.test', 'IN', 'UTC', 'ready') returning id`,
      [email],
    );
    await q(
      `insert into outreach.steps (lead_id, step_no, subject, body, due_at, status) values
         ($1, 1, 'videos for the Pune team', 'Body one.', now() - interval '1 minute', 'ready'),
         ($1, 2, 'Re: videos for the Pune team', 'Follow up one.', null, 'ready'),
         ($1, 3, 'Re: videos for the Pune team', 'Follow up two.', null, 'ready')`,
      [lead!.id],
    );
    return lead!.id;
  }

  const steps = (leadId: string) => q<any>(`select * from outreach.steps where lead_id = $1 order by step_no`, [leadId]);

  it("claims leads with SKIP LOCKED: parallel runs never get the same lead", async () => {
    for (let i = 0; i < 20; i++) await q(`insert into outreach.leads (email, first_name, company, status) values ($1, 'X', 'Y', 'qualified')`, [`p${i}@a.test`]);
    const [a, b, c] = await Promise.all([queries.claimLeads("qualified", 8), queries.claimLeads("qualified", 8), queries.claimLeads("qualified", 8)]);
    const ids = [...a, ...b, ...c].map((l) => l.id);
    expect(ids.length).toBe(20);
    expect(new Set(ids).size).toBe(20);
    expect((await queries.claimLeads("qualified", 8)).length).toBe(0); // all leased
  });

  it("imports a CSV: dedupes, drops suppressed / role / free-mail / off-list rows", async () => {
    await queries.suppress("gone@acme.test", "unsubscribed");
    const csv = [
      "email,first_name,company,website,country,title",
      "riya@acme.test,Riya,Acme,acme.test,India,Founder",
      "RIYA@acme.test,Riya,Acme,acme.test,India,Founder",
      "gone@acme.test,Gone,Acme,acme.test,India,Founder",
      "info@acme.test,Info,Acme,acme.test,India,Founder",
      "x@gmail.com,X,Acme,acme.test,India,Founder",
      "y@beta.test,Y,Beta,beta.test,Germany,Founder",
    ].join("\n");
    const s1 = await importLeadsCsv(csv);
    expect(s1.inserted).toBe(1);
    expect(s1.rejected).toMatchObject({ duplicate: 1, suppressed: 1, role_address: 1, free_mail: 1, country: 1 });
    const s2 = await importLeadsCsv(csv);
    expect(s2.inserted).toBe(0); // dedupe against existing leads
  });

  it("double-send protection: two mailboxes racing for one step — only one claims it", async () => {
    const [m1, m2] = await fleet(2);
    const leadId = await readyLead();
    const [c1, c2] = await Promise.all([claimStep(m1!.id, TUESDAY_9AM), claimStep(m2!.id, TUESDAY_9AM)]);
    expect([c1, c2].filter(Boolean).length).toBe(1);
    expect((await steps(leadId))[0].status).toBe("sending");
    expect(await claimStep(m1!.id, TUESDAY_9AM)).toBeNull();
  });

  it("sends one email, paces the mailbox 45-180s, and schedules the follow-up on the same mailbox", async () => {
    const [m] = await fleet(1);
    const leadId = await readyLead();
    const gmail = fakeGmail();
    const out = await sendFromMailbox(await mailboxRow(m!.id), gmail.port, TUESDAY_9AM);
    expect(out.result).toBe("sent");
    expect(gmail.sent.length).toBe(1);
    const raw = Buffer.from(gmail.sent[0]!.raw, "base64url").toString();
    expect(raw).toMatch(/List-Unsubscribe: <mailto:sender0@trybrand.test\?subject=unsubscribe>, <https:\/\/example.test\/api\/engine\/unsubscribe\?t=/);
    expect(raw).toMatch(/reply "no" and I will not email again/);

    const [s1, s2] = await steps(leadId);
    expect(s1.status).toBe("sent");
    expect(s1.gmail_thread_id).toBe("thread-1");
    expect(s2.mailbox_id).toBe(m!.id);
    expect(new Date(s2.due_at).getTime()).toBeGreaterThan(Date.now());
    const gap = await one<{ s: number }>(`select extract(epoch from next_send_at - now())::int as s from outreach.mailboxes where id = $1`, [m!.id]);
    expect(gap!.s).toBeGreaterThanOrEqual(44);
    expect(gap!.s).toBeLessThanOrEqual(180);
    expect((await one<any>(`select status from outreach.leads where id = $1`, [leadId]))!.status).toBe("in_sequence");
  });

  it("does not send outside the recipient's window", async () => {
    const [m] = await fleet(1);
    await readyLead();
    const gmail = fakeGmail();
    const saturday = new Date("2026-11-21T09:00:00Z");
    expect((await sendFromMailbox(await mailboxRow(m!.id), gmail.port, saturday)).result).toBe("idle");
    expect(gmail.sent.length).toBe(0);
  });

  it("respects the mailbox cap", async () => {
    const [m] = await fleet(1, { cap: 1 });
    await readyLead("a@acme.test");
    await readyLead("b@beta.test");
    const gmail = fakeGmail();
    expect((await sendFromMailbox(await mailboxRow(m!.id), gmail.port, TUESDAY_9AM)).result).toBe("sent");
    await q(`update outreach.mailboxes set next_send_at = now() - interval '1 minute'`);
    expect((await sendFromMailbox(await mailboxRow(m!.id), gmail.port, TUESDAY_9AM)).result).toBe("capped");
    expect(gmail.sent.length).toBe(1);
  });

  it("re-checks suppression right before sending", async () => {
    const [m] = await fleet(1);
    const leadId = await readyLead();
    await queries.suppress("riya@acme.test", "unsubscribed"); // arrives after the step became ready
    const gmail = fakeGmail();
    const out = await sendFromMailbox(await mailboxRow(m!.id), gmail.port, TUESDAY_9AM);
    expect(out.result).toBe("skipped");
    expect(gmail.sent.length).toBe(0);
    expect((await steps(leadId)).map((s) => s.status)).toEqual(["skipped", "skipped", "skipped"]);
  });

  it("stop-on-reply: a classified human reply skips every remaining step", async () => {
    const [m] = await fleet(1);
    const leadId = await readyLead();
    await sendFromMailbox(await mailboxRow(m!.id), fakeGmail().port, TUESDAY_9AM);
    await tx((db) => applyReply(db, leadId, { intent: "interested", referral_name: null, referral_email: null, summary: "wants a call" }));
    expect((await steps(leadId)).map((s) => s.status)).toEqual(["sent", "skipped", "skipped"]);
    expect((await one<any>(`select status from outreach.leads where id = $1`, [leadId]))!.status).toBe("replied");
  });

  it("stop-on-reply: a reply that lands just before a follow-up (between polls) stops it", async () => {
    const [m] = await fleet(1);
    const leadId = await readyLead();
    const gmail = fakeGmail();
    await sendFromMailbox(await mailboxRow(m!.id), gmail.port, TUESDAY_9AM);
    // Make step 2 due now and add the prospect's reply to the thread.
    await q(`update outreach.steps set due_at = now() - interval '1 minute' where lead_id = $1 and step_no = 2`, [leadId]);
    await q(`update outreach.mailboxes set next_send_at = now() - interval '1 minute'`);
    gmail.threads.get("thread-1")!.push({ id: "reply-1", threadId: "thread-1", internalDate: Date.now() + 1000, from: "Riya <riya@acme.test>", headers: {} });
    const out = await sendFromMailbox(await mailboxRow(m!.id), gmail.port, TUESDAY_9AM);
    expect(out.result).toBe("stopped_on_reply");
    expect(gmail.sent.length).toBe(1);
    expect((await steps(leadId)).map((s) => s.status)).toEqual(["sent", "skipped", "skipped"]);
  });

  it("follow-ups go in the same thread with In-Reply-To", async () => {
    const [m] = await fleet(1);
    const leadId = await readyLead();
    const gmail = fakeGmail();
    await sendFromMailbox(await mailboxRow(m!.id), gmail.port, TUESDAY_9AM);
    await q(`update outreach.steps set due_at = now() - interval '1 minute' where lead_id = $1 and step_no = 2`, [leadId]);
    await q(`update outreach.mailboxes set next_send_at = now() - interval '1 minute'`);
    expect((await sendFromMailbox(await mailboxRow(m!.id), gmail.port, TUESDAY_9AM)).result).toBe("sent");
    expect(gmail.sent[1]!.threadId).toBe("thread-1");
    expect(Buffer.from(gmail.sent[1]!.raw, "base64url").toString()).toMatch(/In-Reply-To: <msg-1@fake.test>/);
  });

  it("auto-replies are saved but don't stop the sequence; an opt-out reply suppresses", async () => {
    const [m] = await fleet(1);
    const leadId = await readyLead();
    const gmail = fakeGmail();
    await sendFromMailbox(await mailboxRow(m!.id), gmail.port, TUESDAY_9AM);
    const mailbox = { id: m!.id, email: m!.email, domain_id: m!.domain_id, history_id: "1" };
    const ours = new Set([m!.email]);
    const messages: Record<string, { meta: GmailMessageMeta; body: string; labelIds: string[] }> = {
      ooo: { meta: { id: "ooo", threadId: "thread-1", internalDate: Date.now(), from: "Riya <riya@acme.test>", headers: { subject: "Automatic reply: back Monday", "auto-submitted": "auto-replied" } }, body: "I'm out", labelIds: ["INBOX"] },
      stop: { meta: { id: "stop", threadId: "thread-1", internalDate: Date.now(), from: "Riya <riya@acme.test>", headers: { subject: "Re: videos" } }, body: "Please remove me from your list.\n\nOn Tue wrote:\n> hi", labelIds: ["INBOX"] },
    };
    const port = { ...gmail.port, getMessage: async (_m: string, id: string) => messages[id]! };

    expect(await processMessage(mailbox, "ooo", ours, port)).toBe("auto");
    expect((await steps(leadId))[1].status).toBe("ready");

    expect(await processMessage(mailbox, "stop", ours, port)).toBe("unsubscribe");
    expect((await steps(leadId)).map((s) => s.status)).toEqual(["sent", "skipped", "skipped"]);
    expect(await queries.isSuppressed("riya@acme.test")).toBe(true);
    expect(await processMessage(mailbox, "stop", ours, port)).toBe("seen");
  });

  it("guard pauses the mailbox when simulated hard bounces cross 2% of 100 sends", async () => {
    const [m] = await fleet(1);
    for (let i = 0; i < 100; i++) {
      const lead = await one<{ id: string }>(`insert into outreach.leads (email, first_name, company, status) values ($1, 'X', 'Y', 'in_sequence') returning id`, [`b${i}@t.test`]);
      await q(`insert into outreach.steps (lead_id, step_no, status, mailbox_id, sent_at) values ($1, 1, 'sent', $2, now() - make_interval(mins => $3))`, [lead!.id, m!.id, i]);
    }
    // One bounce: 1% -> no pause.
    const bounce = async (email: string) => {
      await q(`update outreach.leads set status = 'bounced' where email = $1`, [email]);
      await queries.suppress(email, "bounced");
    };
    await bounce("b1@t.test");
    await evaluateGuard(true);
    expect((await one<any>(`select status from outreach.mailboxes where id = $1`, [m!.id]))!.status).toBe("active");
    await bounce("b2@t.test");
    await evaluateGuard(true);
    const after = await one<any>(`select status, paused_reason from outreach.mailboxes where id = $1`, [m!.id]);
    expect(after.status).toBe("paused");
    expect(after.paused_reason).toMatch(/hard bounces/);
    expect(await one(`select 1 from outreach.events where type = 'mailbox_paused'`)).toBeTruthy();
    // Never auto-resumes.
    await evaluateGuard(true);
    expect((await one<any>(`select status from outreach.mailboxes where id = $1`, [m!.id]))!.status).toBe("paused");
  });

  it("dashboard queries all run on real data", async () => {
    const [m] = await fleet(1);
    const leadId = await readyLead();
    await q(`update outreach.leads set segment = 'B2B SaaS', icp_score = 82, verify_result = 'valid' where id = $1`, [leadId]);
    await q(`insert into outreach.research (lead_id, evidence_quote, gate_passed, model, duration_ms) values ($1, 'q', true, 'claude-haiku-5-5', 12000)`, [leadId]);
    await sendFromMailbox(await mailboxRow(m!.id), fakeGmail().port, TUESDAY_9AM);
    await q(
      `insert into outreach.replies (lead_id, mailbox_id, gmail_message_id, gmail_thread_id, received_at, body, intent, summary)
       values ($1, $2, 'r1', 'thread-1', now(), 'yes please', 'interested', 'wants a call')`,
      [leadId, m!.id],
    );
    await queries.logEvent("sent", { lead_id: leadId });

    const fleetStatus = await A.fleetStatus();
    expect(fleetStatus).toMatchObject({ domains: 1, mailboxes: 1, healthy: 1, capacity: 40 });
    const today = await A.todayWindow();
    expect(today).toMatchObject({ sent: 1, replies: 1, interested: 1, meetings: 0 });
    expect((await A.perDay(7)).at(-1)).toMatchObject({ sent: 1, replies: 1, interested: 1 });
    const funnel = Object.fromEntries((await A.funnel()).map((f) => [f.stage, f.count]));
    expect(funnel).toMatchObject({ uploaded: 1, verified: 1, qualified: 1, researched: 1, sent: 1, replied: 1, interested: 1, meeting: 0 });
    expect(await A.replyIntents(30)).toEqual([{ intent: "interested", count: 1 }]);
    expect((await A.replyHeatmap(30)).length).toBe(1);
    expect(await A.sendRegions(30)).toEqual([{ country: "IN", count: 1 }]);
    expect((await A.mailboxFleet())[0]).toMatchObject({ sentToday: 1, cap: 40, status: "active" });
    expect(await A.researchEngine(40)).toMatchObject({ researchedToday: 1, readyFirst: 0 });
    expect((await A.modelChainUsage()).models).toEqual(["claude-haiku-5-5"]);
    expect((await A.activity("sends")).length).toBeGreaterThan(0);
    expect((await A.recentReplies())[0]).toMatchObject({ intent: "interested", mailbox: m!.email });
    expect(await A.segments(30)).toEqual([{ segment: "B2B SaaS", sends: 1, replies: 1, interested: 1, meetings: 0, replyRate: 1 }]);
    expect(await A.reviewLeads()).toEqual([]);
    const report = await evaluateGuard(false);
    expect(report.domains[0]!.rules.map((r) => r.action)).toEqual(["none", "none", "none", "none", "none"]);
  });
});
