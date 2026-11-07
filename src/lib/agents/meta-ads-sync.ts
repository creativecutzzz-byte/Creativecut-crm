import "server-only";

import { z } from "zod";
import { graphRequest } from "@/lib/integrations/meta";
import { defineAgent } from "./types";

// Meta Ads Sync (read-only, free): copies campaigns and the last N days of
// daily insights from the Marketing API into ad_campaigns / ad_insights_daily
// for the Meta Ads screen and the daily brief. Needs an ads_read token.

const config = z.object({ days: z.number().int().min(1).max(90) });
type Config = z.infer<typeof config>;

interface Campaign {
  id: string;
  name: string;
  objective?: string;
  status?: string;
  daily_budget?: string;
}

interface Insight {
  campaign_id: string;
  date_start: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  spend?: string;
  actions?: { action_type: string; value: string }[];
  action_values?: { action_type: string; value: string }[];
}

const STATUS: Record<string, string> = { ACTIVE: "active", PAUSED: "paused", ARCHIVED: "archived", DELETED: "deleted" };
const LEAD = /(^lead$|leadgen|onsite_conversion\.lead)/;
const PURCHASE = /(^purchase$|fb_pixel_purchase|onsite_web_purchase)/;

export const metaAdsSyncAgent = defineAgent<Config>({
  key: "meta_ads_sync",
  name: "Meta Ads Sync",
  department: "crm_operations",
  description: "Pulls your Meta ad campaigns and daily spend, clicks, leads and purchases into the Meta Ads screen (read-only, free).",
  requires: ["META_ADS_ACCESS_TOKEN", "META_ADS_ACCOUNT_ID"],
  needsAi: false,
  minIntervalHours: 3,
  configSchema: config,
  defaultConfig: { days: 30 },
  configHelp: "days: how many days of daily insights to refresh each run.",

  async run(ctx, cfg) {
    const token = process.env.META_ADS_ACCESS_TOKEN!;
    const account = `act_${process.env.META_ADS_ACCOUNT_ID!.replace(/^act_/, "")}`;

    const campaigns = await pages<Campaign>(`${account}/campaigns?fields=id,name,objective,status,daily_budget&limit=200`, token);
    const idMap = new Map<string, string>();
    for (const c of campaigns) {
      const { data } = await ctx.supabase
        .from("ad_campaigns")
        .upsert(
          { org_id: ctx.orgId, external_id: c.id, name: c.name, objective: c.objective ?? null, status: STATUS[c.status ?? ""] ?? "active", daily_budget: c.daily_budget ? Number(c.daily_budget) / 100 : null },
          { onConflict: "org_id,external_id" },
        )
        .select("id")
        .single();
      if (data) idMap.set(c.id, data.id as string);
    }

    const since = new Date(Date.now() - cfg.days * 86_400_000).toISOString().slice(0, 10);
    const until = new Date().toISOString().slice(0, 10);
    const range = encodeURIComponent(JSON.stringify({ since, until }));
    const insights = await pages<Insight>(
      `${account}/insights?level=campaign&time_increment=1&time_range=${range}&fields=campaign_id,impressions,reach,clicks,spend,actions,action_values&limit=500`,
      token,
    );

    let rows = 0;
    for (const i of insights) {
      const campaignId = idMap.get(i.campaign_id);
      if (!campaignId) continue;
      const sum = (list: { action_type: string; value: string }[] | undefined, re: RegExp) => (list ?? []).filter((a) => re.test(a.action_type)).reduce((s, a) => s + Number(a.value || 0), 0);
      await ctx.supabase.from("ad_insights_daily").upsert(
        {
          org_id: ctx.orgId,
          campaign_id: campaignId,
          date: i.date_start,
          impressions: Number(i.impressions ?? 0),
          reach: Number(i.reach ?? 0),
          clicks: Number(i.clicks ?? 0),
          spend: Number(i.spend ?? 0),
          leads: Math.round(sum(i.actions, LEAD)),
          conversions: Math.round(sum(i.actions, PURCHASE)),
          revenue: sum(i.action_values, PURCHASE),
        },
        { onConflict: "campaign_id,date" },
      );
      rows++;
    }

    const spend = insights.reduce((s, i) => s + Number(i.spend ?? 0), 0);
    return { status: "success", summary: `Synced ${campaigns.length} campaigns and ${rows} daily rows (last ${cfg.days} days, spend ₹${Math.round(spend).toLocaleString("en-IN")}).`, created: rows, updated: campaigns.length };
  },
});

async function pages<T>(path: string, token: string): Promise<T[]> {
  const out: T[] = [];
  let next: string | null = path;
  for (let i = 0; next && i < 20; i++) {
    const res: { data?: T[]; paging?: { next?: string } } = await graphRequest("graph.facebook.com", next, token);
    out.push(...(res.data ?? []));
    const url: string | undefined = res.paging?.next;
    next = url ? url.replace(/^https:\/\/graph\.facebook\.com\/v[\d.]+\//, "") : null;
  }
  return out;
}
