import type { Lead, LeadSource } from "@/lib/types";

// Transparent, rule-based lead scoring. It is deliberately simple so the team
// can see *why* a lead scored the way it did. The `scoreLead` signature is the
// seam for swapping in an LLM-backed scorer later (see src/lib/ai/README.md).

const SOURCE_WEIGHT: Record<LeadSource, number> = {
  referral: 20,
  meta_ads: 12,
  instagram: 12,
  whatsapp: 14,
  website: 10,
  other: 5,
};

export interface ScoreFactor {
  label: string;
  points: number;
}

export interface LeadScore {
  score: number;
  factors: ScoreFactor[];
}

export function scoreLead(lead: Pick<Lead, "source" | "estimated_value" | "service_interest" | "last_contacted_at" | "email" | "phone" | "whatsapp_number" | "stage">, now = new Date()): LeadScore {
  const factors: ScoreFactor[] = [];

  factors.push({ label: `Source: ${lead.source.replace("_", " ")}`, points: SOURCE_WEIGHT[lead.source] });

  const valuePoints = Math.min(30, Math.round(lead.estimated_value / 2000));
  factors.push({ label: "Deal size", points: valuePoints });

  const servicePoints = Math.min(15, lead.service_interest.length * 5);
  if (servicePoints) factors.push({ label: "Multi-service interest", points: servicePoints });

  const reachable = [lead.email, lead.phone, lead.whatsapp_number].filter(Boolean).length;
  factors.push({ label: "Reachability", points: reachable * 4 });

  const stageBonus: Partial<Record<Lead["stage"], number>> = { qualified: 8, proposal: 12, negotiation: 18, won: 25 };
  if (stageBonus[lead.stage]) factors.push({ label: "Pipeline stage", points: stageBonus[lead.stage]! });

  if (lead.last_contacted_at) {
    const days = (now.getTime() - new Date(lead.last_contacted_at).getTime()) / 86_400_000;
    if (days > 7) factors.push({ label: "Going cold", points: -Math.min(20, Math.round(days)) });
  }

  const score = Math.max(0, Math.min(100, factors.reduce((sum, f) => sum + f.points, 0)));
  return { score, factors };
}

export function scoreTier(score: number | null): "hot" | "warm" | "cold" {
  if (score === null) return "cold";
  if (score >= 75) return "hot";
  if (score >= 50) return "warm";
  return "cold";
}
