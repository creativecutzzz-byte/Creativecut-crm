import { AdsChart } from "@/components/charts/ads-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { byCampaign, dailySeries, periodDelta, totals } from "@/lib/analytics";
import { getAdData, getClients } from "@/lib/data";
import { integrationEnvStatus } from "@/lib/integrations";
import { formatCompact, formatCurrency, formatPercent } from "@/lib/utils";
import { DollarSign, Eye, MousePointerClick, Target, TrendingUp, Users } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Meta Ads" };

export default async function AdsPage() {
  const [{ campaigns, insights }, clients] = await Promise.all([getAdData(), getClients()]);
  const t = totals(insights);
  const rows = byCampaign(campaigns, insights);
  const connected = integrationEnvStatus().meta_ads;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meta Ads analytics"
        description="Facebook & Instagram campaign performance across clients · last 30 days"
        actions={<Badge variant={connected ? "success" : "neutral"}>{connected ? "Credentials set" : "Sample data"}</Badge>}
      />
      <Notice>
        <strong className="font-medium">Read-only analytics.</strong> The CRM only ever reads insights (<code className="text-xs">ads_read</code>). It can&apos;t
        create, edit, budget or launch ads — make those changes in Meta Ads Manager.
      </Notice>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Spend" value={formatCurrency(t.spend)} icon={DollarSign} delta={periodDelta(insights, "spend")} hint="vs prev 14d" />
        <StatCard label="ROAS" value={`${t.roas.toFixed(2)}×`} icon={TrendingUp} delta={periodDelta(insights, "roas")} hint="vs prev 14d" />
        <StatCard label="Leads" value={formatCompact(t.leads)} icon={Users} delta={periodDelta(insights, "leads")} hint="vs prev 14d" />
        <StatCard label="Cost per lead" value={formatCurrency(t.cpl)} icon={Target} delta={periodDelta(insights, "cpl")} invertDelta hint="vs prev 14d" />
        <StatCard label="Impressions" value={formatCompact(t.impressions)} icon={Eye} hint={`${formatCurrency(t.cpm)} CPM`} />
        <StatCard label="CTR" value={formatPercent(t.ctr, 2)} icon={MousePointerClick} hint={`${formatCompact(t.clicks)} clicks`} />
      </div>

      <Card>
        <CardHeader title="Daily performance" description="Spend, attributed revenue and leads" />
        <CardBody className="pt-3">
          <AdsChart data={dailySeries(insights)} />
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="Campaigns" description={`${campaigns.length} campaigns synced`} />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-y border-line text-[11px] tracking-wide text-subtle uppercase">
              <tr>
                <th className="px-5 py-3 font-medium">Campaign</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 text-right font-medium">Spend</th>
                <th className="px-3 py-3 text-right font-medium">Impr.</th>
                <th className="px-3 py-3 text-right font-medium">CTR</th>
                <th className="px-3 py-3 text-right font-medium">Leads</th>
                <th className="px-3 py-3 text-right font-medium">CPL</th>
                <th className="px-5 py-3 text-right font-medium">ROAS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(({ campaign, ...m }) => {
                const client = clients.find((c) => c.id === campaign.client_id);
                return (
                  <tr key={campaign.id} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3">
                      <p className="font-medium text-fg">{campaign.name}</p>
                      <p className="text-xs text-subtle">
                        {client?.company ?? "Creative Cut (internal)"} · {campaign.objective}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={campaign.status === "active" ? "success" : "neutral"} dot={campaign.status === "active" ? "bg-emerald-400" : "bg-zinc-500"}>
                        {campaign.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(m.spend)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted">{formatCompact(m.impressions)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted">{formatPercent(m.ctr, 2)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{m.leads || "—"}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted">{m.leads ? formatCurrency(m.cpl) : "—"}</td>
                    <td className="px-5 py-3 text-right">
                      {m.revenue ? (
                        <span className={m.roas >= 3 ? "font-semibold text-emerald-300" : m.roas >= 1.5 ? "text-fg" : "text-amber-300"}>{m.roas.toFixed(2)}×</span>
                      ) : (
                        <span className="text-subtle">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
