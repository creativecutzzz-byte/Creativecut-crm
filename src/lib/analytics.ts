import type { AdCampaign, AdInsightDay } from "./types";

export interface AdTotals {
  spend: number;
  revenue: number;
  impressions: number;
  clicks: number;
  leads: number;
  conversions: number;
  roas: number;
  ctr: number;
  cpl: number;
  cpm: number;
}

export function totals(days: AdInsightDay[]): AdTotals {
  const t = days.reduce(
    (acc, d) => ({
      spend: acc.spend + d.spend,
      revenue: acc.revenue + d.revenue,
      impressions: acc.impressions + d.impressions,
      clicks: acc.clicks + d.clicks,
      leads: acc.leads + d.leads,
      conversions: acc.conversions + d.conversions,
    }),
    { spend: 0, revenue: 0, impressions: 0, clicks: 0, leads: 0, conversions: 0 },
  );
  return {
    ...t,
    roas: t.spend ? t.revenue / t.spend : 0,
    ctr: t.impressions ? t.clicks / t.impressions : 0,
    cpl: t.leads ? t.spend / t.leads : 0,
    cpm: t.impressions ? (t.spend / t.impressions) * 1000 : 0,
  };
}

/** Splits a window into the current and previous halves and returns the relative change of a metric. */
export function periodDelta(days: AdInsightDay[], metric: keyof AdTotals, windowDays = 14) {
  const dates = [...new Set(days.map((d) => d.date))].sort();
  const current = new Set(dates.slice(-windowDays));
  const previous = new Set(dates.slice(-windowDays * 2, -windowDays));
  const a = totals(days.filter((d) => current.has(d.date)))[metric];
  const b = totals(days.filter((d) => previous.has(d.date)))[metric];
  return b ? (a - b) / b : 0;
}

export function dailySeries(days: AdInsightDay[]) {
  const byDate = new Map<string, { spend: number; revenue: number; leads: number }>();
  for (const d of days) {
    const row = byDate.get(d.date) ?? { spend: 0, revenue: 0, leads: 0 };
    row.spend += d.spend;
    row.revenue += d.revenue;
    row.leads += d.leads;
    byDate.set(d.date, row);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, row]) => ({
      date: new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
      spend: Math.round(row.spend),
      revenue: Math.round(row.revenue),
      leads: row.leads,
    }));
}

export function byCampaign(campaigns: AdCampaign[], days: AdInsightDay[]) {
  return campaigns
    .map((campaign) => ({ campaign, ...totals(days.filter((d) => d.campaign_id === campaign.id)) }))
    .sort((a, b) => b.spend - a.spend);
}
