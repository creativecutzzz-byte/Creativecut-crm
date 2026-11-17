import { SendsChart, ModelChainChart } from "@/components/engine/charts";
import { AddDomainForm, MarkMeeting, PauseMailbox, PostmasterForm, ResumeDomain, ResumeMailbox, ReviewDecision, UploadLeadsForm } from "@/components/engine/forms";
import { RangeSelect } from "@/components/engine/range-select";
import { AutoRefresh } from "@/components/live/auto-refresh";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { engineAccess } from "@/lib/engine/access";
import * as A from "@/lib/engine/db/analytics";
import { isDatabaseConfigured, q } from "@/lib/engine/db/pool";
import { isGmailConfigured } from "@/lib/engine/gmail/auth";
import { evaluateGuard } from "@/lib/engine/guard/run";
import { verificationMode } from "@/lib/engine/intake/verify";
import { isAiReady, modelChain } from "@/lib/engine/research/models";
import { isLive } from "@/lib/engine/sender/send";
import { cn } from "@/lib/utils";
import { Activity, CalendarCheck, Gauge, Mail, MessageSquareReply, Send, Server, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Outreach Engine" };
export const dynamic = "force-dynamic";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const pct = (n: number, digits = 1) => `${(n * 100).toFixed(digits)}%`;
const fmtTime = (d: Date) => new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const STATUS_VARIANT: Record<string, BadgeVariant> = { active: "success", warming: "info", paused: "danger", "paused (24h)": "warning" };
const INTENT_VARIANT: Record<string, BadgeVariant> = { interested: "success", question: "info", not_now: "warning", not_interested: "neutral", wrong_person: "neutral", referral: "accent", unsubscribe: "danger" };

function Setup() {
  const items: [string, boolean, string][] = [
    ["Database", isDatabaseConfigured(), "DATABASE_URL, then npm run migrate"],
    ["Claude API", isAiReady(), "ANTHROPIC_API_KEY (MODEL_CHAIN optional)"],
    ["Gmail service account", isGmailConfigured(), "GOOGLE_SA_KEY_B64 + domain-wide delegation (gmail.send, gmail.readonly)"],
    ["Email verification", verificationMode() !== null, "VERIFY_PROVIDER + VERIFY_API_KEY"],
    ["Cron secret", Boolean(process.env.CRON_SECRET), "CRON_SECRET"],
    ["Unsubscribe links", Boolean(process.env.UNSUB_SECRET && (process.env.UNSUB_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL)), "UNSUB_SECRET + UNSUB_BASE_URL"],
    ["Alerts", Boolean(process.env.ALERT_WEBHOOK_URL), "ALERT_WEBHOOK_URL (Slack incoming webhook)"],
    ["Dashboard login domain", Boolean(process.env.ALLOWED_LOGIN_DOMAIN), "ALLOWED_LOGIN_DOMAIN"],
    ["Live sending", isLive(), "MESSAGING_MODE=live — only after the go-live checklist"],
  ];
  return (
    <Card className="min-w-0">
      <CardHeader title="Setup" description="docs/outreach-engine/README.md walks through each item." />
      <CardBody className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(([label, ok, hint]) => (
          <div key={label} className="flex items-start gap-2 text-xs">
            <span className={cn("mt-1 size-2 shrink-0 rounded-full", ok ? "bg-emerald-400" : "bg-amber-400")} />
            <div className="min-w-0">
              <p className="font-medium text-fg">{label}</p>
              <p className="text-subtle break-words">{ok ? "Configured" : hint}</p>
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

export default async function EnginePage({ searchParams }: { searchParams: Promise<{ range?: string; feed?: string; sort?: string }> }) {
  const sp = await searchParams;
  const access = await engineAccess();
  if (!access.ok) {
    return (
      <div className="space-y-6">
        <PageHeader title="Outreach Engine" />
        <Notice icon={ShieldAlert}>{access.reason}</Notice>
      </div>
    );
  }
  if (!isDatabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Outreach Engine" description="Researches, writes, fact-checks and sends personalised plain-text emails from a fleet of warmed mailboxes." />
        <Setup />
      </div>
    );
  }

  const range = [7, 30, 90].includes(Number(sp.range)) ? Number(sp.range) : 30;
  const feed = sp.feed && sp.feed in A.ACTIVITY_FILTERS ? sp.feed : "all";
  const sort = (["sends", "replies", "interested", "meetings", "replyRate"] as const).find((s) => s === sp.sort) ?? "sends";

  let data;
  try {
    const fleet = await A.fleetStatus();
    const [today, perDay, funnel, intents, heat, regions, mailboxes, research, chain, events, replies, segs, guard, domains, review] = await Promise.all([
      A.todayWindow(),
      A.perDay(range),
      A.funnel(),
      A.replyIntents(range),
      A.replyHeatmap(range),
      A.sendRegions(range),
      A.mailboxFleet(),
      A.researchEngine(fleet.capacity),
      A.modelChainUsage(),
      A.activity(feed),
      A.recentReplies(),
      A.segments(range),
      evaluateGuard(false),
      q<{ id: number; name: string; status: string; paused_reason: string | null; daily_cap: number }>(`select id, name, status, paused_reason, daily_cap from outreach.domains order by name`),
      A.reviewLeads(),
    ]);
    data = { fleet, today, perDay, funnel, intents, heat, regions, mailboxes, research, chain, events, replies, segs, guard, domains, review };
  } catch (err) {
    return (
      <div className="space-y-6">
        <PageHeader title="Outreach Engine" />
        <Notice icon={ShieldAlert}>
          Couldn&apos;t read the outreach database ({err instanceof Error ? err.message : "unknown error"}). Run <code>npm run migrate</code> against DATABASE_URL.
        </Notice>
        <Setup />
      </div>
    );
  }
  const { fleet, today, perDay, funnel, intents, heat, regions, mailboxes, research, chain, events, replies, segs, guard, domains, review } = data;

  const nextIn = today.nextSendIn;
  const heatMax = Math.max(1, ...heat.map((h) => h.count));
  const heatAt = (dow: number, hour: number) => heat.find((h) => h.dow === dow && h.hour === hour)?.count ?? 0;
  const funnelMax = Math.max(1, ...funnel.map((f) => f.count));
  const intentTotal = intents.reduce((a, i) => a + i.count, 0);
  const regionMax = Math.max(1, ...regions.map((r) => r.count));
  const sortedSegs = [...segs].sort((a, b) => b[sort] - a[sort]);
  const guardRows = [
    ...guard.domains.flatMap((d) => d.rules.map((r) => ({ scope: d.name, ...r }))),
    ...guard.mailboxes.flatMap((m) => m.rules.map((r) => ({ scope: m.email, ...r }))),
  ];

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={30} />
      <PageHeader
        title="Outreach Engine"
        description={`Plain-text, fact-checked cold email from ${fleet.mailboxes} mailboxes on ${fleet.domains} domains. Model chain: ${modelChain().join(" → ")}.`}
        actions={<RangeSelect range={range} filter={feed} />}
      />

      {!isLive() && (
        <Notice icon={ShieldAlert}>
          <strong className="font-medium">Sending is off.</strong> Research and drafting run, but nothing is emailed until <code>MESSAGING_MODE=live</code>. Finish the
          go-live checklist and pilot with 50 leads first.
        </Notice>
      )}

      {/* Fleet status + today's send window */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Fleet" value={`${fleet.healthy}/${fleet.mailboxes}`} hint={`healthy mailboxes · ${fleet.activeDomains}/${fleet.domains} domains`} icon={Server} />
        <StatCard label="Sent today" value={`${today.sent}`} hint={`of ${fleet.capacity} capacity${nextIn !== null ? ` · next in ${nextIn}s` : ""}`} icon={Send} />
        <StatCard label="Replies today" value={`${today.replies}`} hint={`${today.interested} interested`} icon={MessageSquareReply} />
        <StatCard label="Meetings today" value={`${today.meetings}`} hint={`runway ${research.runwayDays === null ? "—" : `${research.runwayDays.toFixed(1)} days`}`} icon={CalendarCheck} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader title="Emails sent per day" description={`Last ${range} days, with replies, interested and meetings`} />
          <CardBody>
            <SendsChart data={perDay} />
          </CardBody>
        </Card>
        <Card className="min-w-0">
          <CardHeader title="Pipeline funnel" description="All-time lead counts by stage" />
          <CardBody className="space-y-2">
            {funnel.map((f) => (
              <div key={f.stage} className="text-xs">
                <div className="flex justify-between">
                  <span className="capitalize text-muted">{f.stage}</span>
                  <span className="tabular-nums text-fg">{f.count.toLocaleString()}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-white/5">
                  <div className="h-1.5 rounded-full bg-accent" style={{ width: `${(f.count / funnelMax) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="min-w-0">
          <CardHeader title="Reply intent" description={`${intentTotal} human replies, last ${range} days`} />
          <CardBody className="space-y-2">
            {intents.length === 0 && <p className="text-xs text-muted">No replies yet.</p>}
            {intents.map((i) => (
              <div key={i.intent} className="flex items-center justify-between text-xs">
                <Badge variant={INTENT_VARIANT[i.intent] ?? "neutral"}>{i.intent.replace(/_/g, " ")}</Badge>
                <span className="tabular-nums text-muted">
                  {i.count} · {pct(i.count / Math.max(1, intentTotal), 0)}
                </span>
              </div>
            ))}
          </CardBody>
        </Card>
        <Card className="min-w-0">
          <CardHeader title="When people reply" description="Recipient-local weekday × hour" />
          <CardBody>
            <div className="overflow-x-auto">
              <table className="text-[10px] text-subtle">
                <tbody>
                  {DAYS.map((d, i) => (
                    <tr key={d}>
                      <td className="pr-2">{d}</td>
                      {Array.from({ length: 24 }, (_, h) => {
                        const n = heatAt(i + 1, h);
                        return (
                          <td key={h} title={`${d} ${h}:00 — ${n}`} className="p-[1px]">
                            <div className="size-2.5 rounded-[2px] bg-accent" style={{ opacity: n ? 0.15 + 0.85 * (n / heatMax) : 0.04 }} />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr>
                    <td />
                    {Array.from({ length: 24 }, (_, h) => (
                      <td key={h} className="text-center">
                        {h % 6 === 0 ? h : ""}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
        <Card className="min-w-0">
          <CardHeader title="Where sends go" description={`By country, last ${range} days`} />
          <CardBody className="space-y-2">
            {regions.length === 0 && <p className="text-xs text-muted">Nothing sent yet.</p>}
            {regions.map((r) => (
              <div key={r.country} className="flex items-center gap-2 text-xs">
                <span className="w-8 text-muted">{r.country}</span>
                <div className="h-1.5 flex-1 rounded-full bg-white/5">
                  <div className="h-1.5 rounded-full bg-sky-400" style={{ width: `${(r.count / regionMax) * 100}%` }} />
                </div>
                <span className="w-12 text-right tabular-nums">{r.count}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      {/* Mailbox fleet */}
      <Card className="min-w-0">
        <CardHeader title="Mailbox fleet" description="Sent today vs allowed cap, warm-up week, bounce rate over the last 100 sends. Paused items only resume when you resume them." />
        <CardBody className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="text-subtle">
              <tr className="border-b border-line">
                <th className="px-5 py-2 font-medium">Mailbox</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Today</th>
                <th className="px-3 py-2 font-medium">Ramp</th>
                <th className="px-3 py-2 font-medium">Bounces</th>
                <th className="px-5 py-2 text-right font-medium" />
              </tr>
            </thead>
            <tbody>
              {mailboxes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-muted">
                    No mailboxes yet — add a domain below.
                  </td>
                </tr>
              )}
              {mailboxes.map((m) => (
                <tr key={m.id} className="border-b border-line/60 align-top">
                  <td className="px-5 py-2">
                    <p className="text-fg">{m.email}</p>
                    {m.domainStatus === "paused" && <p className="text-rose-300">Domain paused: {m.domainPausedReason}</p>}
                    {m.pausedReason && m.status !== "active" && m.status !== "warming" && <p className="text-amber-300">{m.pausedReason}</p>}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={STATUS_VARIANT[m.status] ?? "neutral"}>{m.status}</Badge>
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {m.sentToday}/{m.cap}
                  </td>
                  <td className="px-3 py-2">wk {m.rampWeek}</td>
                  <td className={cn("px-3 py-2 tabular-nums", m.bounceRate >= 0.02 && "text-rose-300")}>
                    {m.sends ? pct(m.bounceRate) : "—"}
                  </td>
                  <td className="px-5 py-2 text-right">{m.status.startsWith("paused") ? <ResumeMailbox id={m.id} /> : <PauseMailbox id={m.id} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {domains.some((d) => d.status === "paused") && (
            <div className="space-y-2 px-5 py-4">
              {domains
                .filter((d) => d.status === "paused")
                .map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-rose-300">
                      {d.name} paused: {d.paused_reason}
                    </span>
                    <ResumeDomain id={d.id} />
                  </div>
                ))}
            </div>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader title="Research engine" description="Today's research, queue sizes and the ready-copy runway (keep ≥ 2 days)" />
          <CardBody className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
            {[
              ["Researched today", research.researchedToday],
              ["Avg duration", research.avgMs ? `${(research.avgMs / 1000).toFixed(1)}s` : "—"],
              ["Gate failures today", research.gateFailedToday],
              ["Ready first emails", research.readyFirst],
              ["To verify", research.queue.uploaded],
              ["To qualify", research.queue.verified],
              ["To research", research.queue.qualified],
              ["Manual review", research.queue.review],
            ].map(([label, v]) => (
              <div key={label as string}>
                <p className="text-subtle">{label}</p>
                <p className="mt-1 font-display text-2xl tabular-nums text-fg">{v}</p>
              </div>
            ))}
            <p className={cn("col-span-full", research.runwayDays !== null && research.runwayDays < 2 ? "text-amber-300" : "text-muted")}>
              Runway: {research.runwayDays === null ? "no send capacity yet" : `${research.runwayDays.toFixed(1)} days of ready copy at ${fleet.capacity}/day`}
            </p>
          </CardBody>
        </Card>
        <Card className="min-w-0">
          <CardHeader title="Model chain" description="Which model wrote each draft, last 14 days" />
          <CardBody>
            <ModelChainChart models={chain.models} data={chain.data} />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader
            className="flex-wrap"
            title="Live activity"
            action={
              <div className="flex flex-wrap gap-1 text-[11px]">
                {Object.keys(A.ACTIVITY_FILTERS).map((f) => (
                  <Link key={f} href={`/engine?range=${range}&feed=${f}`} className={cn("rounded-md px-2 py-1 capitalize", f === feed ? "bg-surface-3 text-fg" : "text-muted hover:text-fg")}>
                    {f}
                  </Link>
                ))}
              </div>
            }
          />
          <CardBody className="max-h-[420px] space-y-1.5 overflow-y-auto text-xs">
            {events.length === 0 && <p className="text-muted">Nothing yet.</p>}
            {events.map((e) => (
              <div key={e.id} className="flex flex-wrap gap-x-3 sm:flex-nowrap">
                <span className="w-24 shrink-0 text-subtle tabular-nums">{fmtTime(e.created_at)}</span>
                <span className="w-32 shrink-0 font-medium text-fg">{e.type.replace(/_/g, " ")}</span>
                <span className="w-full min-w-0 truncate text-muted sm:w-auto" title={JSON.stringify(e.payload)}>
                  {Object.entries(e.payload ?? {})
                    .filter(([, v]) => v !== null && typeof v !== "object")
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(" · ")}
                </span>
              </div>
            ))}
          </CardBody>
        </Card>
        <Card className="min-w-0">
          <CardHeader title="Recent replies" description="Answer interested prospects quickly — the thread opens in Gmail" />
          <CardBody className="max-h-[420px] space-y-3 overflow-y-auto text-xs">
            {replies.length === 0 && <p className="text-muted">No human replies yet.</p>}
            {replies.map((r) => (
              <div key={r.id} className="rounded-lg border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-fg">
                    {r.first_name ?? r.email} · {r.company}
                  </span>
                  <Badge variant={INTENT_VARIANT[r.intent ?? ""] ?? "neutral"}>{(r.intent ?? "unclassified").replace(/_/g, " ")}</Badge>
                </div>
                <p className="mt-1 text-muted">{r.summary}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  {r.mailbox && r.thread ? (
                    <a className="text-accent hover:underline" href={`https://mail.google.com/mail/?authuser=${encodeURIComponent(r.mailbox)}#all/${r.thread}`} target="_blank" rel="noreferrer">
                      Open thread in {r.mailbox}
                    </a>
                  ) : (
                    <span />
                  )}
                  <MarkMeeting leadId={r.lead_id} />
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      {/* Deliverability */}
      <Card className="min-w-0">
        <CardHeader title="Deliverability" description="Each guard rule with its current value (config/guard.yaml). Breaches pause automatically; resuming is manual." />
        <CardBody className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="text-subtle">
              <tr className="border-b border-line">
                <th className="px-5 py-2 font-medium">Scope</th>
                <th className="px-3 py-2 font-medium">Rule</th>
                <th className="px-3 py-2 font-medium">Value</th>
                <th className="px-3 py-2 font-medium">Threshold</th>
                <th className="px-5 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {guardRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-muted">
                    No domains yet.
                  </td>
                </tr>
              )}
              {guardRows.map((r, i) => (
                <tr key={i} className="border-b border-line/60">
                  <td className="px-5 py-2 text-fg">{r.scope}</td>
                  <td className="px-3 py-2">{r.rule.replace(/_/g, " ")}</td>
                  <td className="px-3 py-2 tabular-nums">{r.value === null ? "—" : typeof r.value === "number" ? pct(r.value, 2) : r.value}</td>
                  <td className="px-3 py-2 text-muted">{r.threshold}</td>
                  <td className="px-5 py-2">
                    <Badge variant={r.action === "none" ? "success" : r.action === "alert" ? "warning" : "danger"}>{r.action === "none" ? "ok" : r.action}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-5 py-4">
            <p className="mb-2 text-xs font-medium text-fg">Today&apos;s Postmaster Tools numbers</p>
            <PostmasterForm domains={domains} />
          </div>
        </CardBody>
      </Card>

      {/* Segments */}
      <Card className="min-w-0">
        <CardHeader title="Segment performance" description={`First emails sent in the last ${range} days. Click a column to sort.`} />
        <CardBody className="overflow-x-auto p-0">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead className="text-subtle">
              <tr className="border-b border-line">
                <th className="px-5 py-2 font-medium">Segment</th>
                {(["sends", "replies", "interested", "meetings", "replyRate"] as const).map((k) => (
                  <th key={k} className="px-3 py-2 font-medium">
                    <Link href={`/engine?range=${range}&feed=${feed}&sort=${k}`} className={cn("hover:text-fg", sort === k && "text-fg")}>
                      {k === "replyRate" ? "Reply rate" : k[0]!.toUpperCase() + k.slice(1)}
                      {sort === k ? " ↓" : ""}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedSegs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-muted">
                    No sends in this range.
                  </td>
                </tr>
              )}
              {sortedSegs.map((s) => (
                <tr key={s.segment} className="border-b border-line/60 tabular-nums">
                  <td className="px-5 py-2 text-fg">{s.segment}</td>
                  <td className="px-3 py-2">{s.sends}</td>
                  <td className="px-3 py-2">{s.replies}</td>
                  <td className="px-3 py-2">{s.interested}</td>
                  <td className="px-3 py-2">{s.meetings}</td>
                  <td className="px-3 py-2">{pct(s.replyRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader title="Upload leads" description="Rows are normalised, deduped and checked against the suppression list and config/icp.yaml" />
          <CardBody>
            <UploadLeadsForm />
          </CardBody>
        </Card>
        <Card className="min-w-0">
          <CardHeader title="Add a sending domain" description="Mailboxes start in warm-up (10/day, rising weekly to 40)" />
          <CardBody>
            <AddDomainForm />
          </CardBody>
        </Card>
      </div>

      {review.length > 0 && (
        <Card className="min-w-0">
          <CardHeader title="Manual review" description="AI scoring failed twice for these leads — decide by hand" />
          <CardBody className="space-y-2 text-xs">
            {review.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-2">
                <div className="min-w-0">
                  <p className="text-fg">
                    {l.email} · {l.company}
                  </p>
                  <p className="truncate text-muted">{l.icp_reason}</p>
                </div>
                <ReviewDecision leadId={l.id} />
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      <Setup />
      <p className="flex items-center gap-2 text-[11px] text-subtle">
        <Activity className="size-3" /> Refreshes every 30 seconds. <Gauge className="size-3" /> Caps 40/mailbox, 120/domain. <Mail className="size-3" /> Plain text, no tracking.
      </p>
    </div>
  );
}
