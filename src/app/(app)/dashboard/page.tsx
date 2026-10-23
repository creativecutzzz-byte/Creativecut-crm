import { DonutChart } from "@/components/charts/donut-chart";
import { RevenueChart } from "@/components/charts/revenue-chart";
import { sourcePalette } from "@/components/charts/theme";
import { InsightsPanel } from "@/components/dashboard/insights-panel";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { FollowUps } from "@/components/dashboard/follow-ups";
import { FunnelCard } from "@/components/dashboard/funnel-card";
import { PipelineBars } from "@/components/dashboard/pipeline-bars";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { generateInsights } from "@/lib/ai/insights";
import { periodDelta, totals } from "@/lib/analytics";
import { LEAD_SOURCES, OPEN_STAGES } from "@/lib/constants";
import { getActivities, getAdData, getClients, getLeads, getRequestTime, getRevenueTrend, getTeam, getViewer } from "@/lib/data";
import { formatCompact, formatCurrency, formatPercent } from "@/lib/utils";
import { Briefcase, Megaphone, Plus, Target, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [viewer, leads, clients, activities, team, ads, trend] = await Promise.all([
    getViewer(),
    getLeads(),
    getClients(),
    getActivities(),
    getTeam(),
    getAdData(),
    getRevenueTrend(),
  ]);

  const open = leads.filter((l) => OPEN_STAGES.includes(l.stage));
  const pipelineValue = open.reduce((s, l) => s + l.estimated_value, 0);
  const won = leads.filter((l) => l.stage === "won").length;
  const closed = won + leads.filter((l) => l.stage === "lost").length;
  const winRate = closed ? won / closed : 0;
  const activeClients = clients.filter((c) => c.status === "active" || c.status === "onboarding");
  const mrr = activeClients.reduce((s, c) => s + c.monthly_retainer, 0);
  const adTotals = totals(ads.insights);

  const sources = Object.entries(
    leads.reduce<Record<string, number>>((acc, l) => ({ ...acc, [l.source]: (acc[l.source] ?? 0) + 1 }), {}),
  )
    .map(([source, value]) => ({ name: LEAD_SOURCES[source as keyof typeof LEAD_SOURCES], value }))
    .sort((a, b) => b.value - a.value);

  const insights = generateInsights({ leads, clients, insights: ads.insights });
  const firstName = viewer.fullName.split(" ")[0] || "there";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Good ${greeting()}, ${firstName}`}
        description="Here's what's happening across your pipeline, clients and campaigns."
        actions={
          <>
            <Link href="/ads" className={buttonClasses({ variant: "secondary" })}>
              <Megaphone className="size-4" /> Ads report
            </Link>
            <Link href="/leads?new=1" className={buttonClasses({ variant: "primary" })}>
              <Plus className="size-4" /> New lead
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open pipeline" value={formatCurrency(pipelineValue)} hint={`${open.length} open deals`} icon={Target} />
        <StatCard label="Monthly retainers" value={formatCurrency(mrr)} hint={`${activeClients.length} active clients`} icon={Briefcase} />
        <StatCard label="Win rate" value={formatPercent(winRate, 0)} hint={`${won} won · ${closed - won} lost`} icon={Wallet} />
        <StatCard label="Ad spend (30d)" value={formatCurrency(adTotals.spend)} hint={`${adTotals.roas.toFixed(2)}× ROAS · ${formatCompact(adTotals.leads)} leads`} icon={Megaphone} delta={periodDelta(ads.insights, "roas")} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="flex flex-col xl:col-span-2">
          <CardHeader title="Revenue & pipeline" description="Closed revenue vs. open pipeline, last 6 months" />
          <CardBody className="flex-1 pt-3">
            <RevenueChart data={trend} />
          </CardBody>
        </Card>
        <InsightsPanel insights={insights} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader title="Pipeline by stage" description="Deal value in each stage" />
          <CardBody>
            <PipelineBars leads={leads} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Lead sources" description="Where your leads come from" />
          <CardBody className="pt-2">
            <DonutChart data={sources} centerValue={String(leads.length)} centerLabel="total leads" />
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              {sources.map((s, i) => (
                <li key={s.name} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-muted">
                    <span className="size-2 rounded-full" style={{ background: sourcePalette[i % sourcePalette.length] }} />
                    {s.name}
                  </span>
                  <span className="tabular-nums text-fg">{s.value}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
        <FollowUps leads={open} team={team} className="lg:col-span-2 xl:col-span-1" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <FunnelCard leads={leads} now={getRequestTime()} />
        <div className="xl:col-span-2">
          <ActivityFeed activities={activities} team={team} />
        </div>
      </div>
    </div>
  );
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}
