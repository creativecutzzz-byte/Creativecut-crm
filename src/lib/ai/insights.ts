import { OPEN_STAGES } from "@/lib/constants";
import type { AdInsightDay, Client, Lead } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export interface Insight {
  id: string;
  tone: "opportunity" | "risk" | "info";
  title: string;
  detail: string;
  href?: string;
}

// Derives the dashboard's "AI insights" from live CRM data. Rule-based today;
// the output shape is what an LLM summarizer would return.
export function generateInsights(input: { leads: Lead[]; clients: Client[]; insights: AdInsightDay[] }, now = new Date()): Insight[] {
  const out: Insight[] = [];
  const open = input.leads.filter((l) => OPEN_STAGES.includes(l.stage));

  const overdue = open.filter((l) => l.next_follow_up_at && new Date(l.next_follow_up_at) < now);
  if (overdue.length) {
    const value = overdue.reduce((s, l) => s + l.estimated_value, 0);
    out.push({
      id: "overdue",
      tone: "risk",
      title: `${overdue.length} follow-up${overdue.length > 1 ? "s" : ""} overdue`,
      detail: `${formatCurrency(value)} of pipeline is waiting on a reply — ${overdue.map((l) => l.company ?? l.name).slice(0, 2).join(", ")}${overdue.length > 2 ? "…" : ""}.`,
      href: "/leads?filter=overdue",
    });
  }

  const unassigned = open.filter((l) => !l.owner_id);
  if (unassigned.length) {
    out.push({
      id: "unassigned",
      tone: "info",
      title: `${unassigned.length} new lead${unassigned.length > 1 ? "s" : ""} without an owner`,
      detail: "Assign them now — leads contacted within an hour are far more likely to convert.",
      href: "/leads?filter=unassigned",
    });
  }

  const hot = open.filter((l) => (l.ai_score ?? 0) >= 80).sort((a, b) => b.estimated_value - a.estimated_value)[0];
  if (hot) {
    out.push({
      id: "hot",
      tone: "opportunity",
      title: `Prioritise ${hot.company ?? hot.name}`,
      detail: hot.ai_next_action ?? `Score ${hot.ai_score} with ${formatCurrency(hot.estimated_value)} on the table.`,
      href: `/leads/${hot.id}`,
    });
  }

  const atRisk = input.clients.filter((c) => (c.status === "active" || c.status === "paused") && (c.health_score ?? 100) < 60);
  for (const client of atRisk.slice(0, 1)) {
    out.push({
      id: `risk-${client.id}`,
      tone: "risk",
      title: `${client.company ?? client.name} account health is ${client.health_score}`,
      detail: "Schedule a check-in and review deliverables before the retainer renewal.",
      href: "/clients",
    });
  }

  const byCampaign = new Map<string, { spend: number; revenue: number }>();
  for (const day of input.insights) {
    const agg = byCampaign.get(day.campaign_id) ?? { spend: 0, revenue: 0 };
    agg.spend += day.spend;
    agg.revenue += day.revenue;
    byCampaign.set(day.campaign_id, agg);
  }
  const best = [...byCampaign.entries()]
    .filter(([, v]) => v.spend > 0 && v.revenue > 0)
    .sort((a, b) => b[1].revenue / b[1].spend - a[1].revenue / a[1].spend)[0];
  if (best) {
    out.push({
      id: "roas",
      tone: "opportunity",
      title: `Top ROAS campaign is returning ${(best[1].revenue / best[1].spend).toFixed(1)}×`,
      detail: "Consider recommending a budget increase to the client. (The CRM never changes budgets itself.)",
      href: "/ads",
    });
  }

  return out;
}
