import type { SupabaseClient } from "@supabase/supabase-js";

// Which outreach steps and subject lines get replies. A reply is credited to
// the latest message we sent that lead before they replied (first reply only).

export interface StepStat {
  key: string;
  sequence: string;
  label: string;
  channel: string;
  sent: number;
  replies: number;
  positive: number;
  rate: number;
}

export interface VariantStat {
  label: string;
  variant: "A" | "B";
  sent: number;
  replies: number;
  rate: number;
  example: string | null;
}

const POSITIVE = new Set(["interested", "meeting_request", "question"]);

export async function outreachPerformance(supabase: SupabaseClient, orgId: string, sinceDays = 30) {
  const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString();
  const { data: sent } = await supabase
    .from("outreach_drafts")
    .select("id, lead_id, sequence, step_label, channel, subject, variant, sent_at")
    .eq("org_id", orgId)
    .eq("kind", "sequence")
    .eq("status", "sent")
    .gte("sent_at", since)
    .limit(5000);
  const drafts = sent ?? [];
  const leadIds = [...new Set(drafts.map((d) => d.lead_id as string))];
  const { data: inbound } = leadIds.length
    ? await supabase.from("messages").select("lead_id, created_at, classification").eq("org_id", orgId).eq("direction", "inbound").in("lead_id", leadIds).gte("created_at", since).order("created_at", { ascending: true })
    : { data: [] as { lead_id: string; created_at: string; classification: unknown }[] };

  const firstReply = new Map<string, { at: string; positive: boolean }>();
  for (const m of inbound ?? []) {
    if (firstReply.has(m.lead_id as string)) continue;
    const intent = (m.classification as { intent?: string } | null)?.intent ?? "";
    firstReply.set(m.lead_id as string, { at: m.created_at as string, positive: POSITIVE.has(intent) });
  }

  const credited = new Map<string, boolean>(); // draft id → positive?
  const byLead = new Map<string, typeof drafts>();
  for (const d of drafts) byLead.set(d.lead_id as string, [...(byLead.get(d.lead_id as string) ?? []), d]);
  for (const [leadId, list] of byLead) {
    const reply = firstReply.get(leadId);
    if (!reply) continue;
    const before = list.filter((d) => (d.sent_at as string) <= reply.at && d.channel !== "linkedin").sort((a, b) => ((a.sent_at as string) < (b.sent_at as string) ? 1 : -1));
    if (before[0]) credited.set(before[0].id as string, reply.positive);
  }

  const steps = new Map<string, StepStat>();
  const variants = new Map<string, VariantStat>();
  for (const d of drafts) {
    const key = `${d.sequence}:${d.step_label}`;
    const s = steps.get(key) ?? { key, sequence: d.sequence as string, label: d.step_label as string, channel: d.channel as string, sent: 0, replies: 0, positive: 0, rate: 0 };
    s.sent++;
    if (credited.has(d.id as string)) {
      s.replies++;
      if (credited.get(d.id as string)) s.positive++;
    }
    steps.set(key, s);
    if (d.variant === "A" || d.variant === "B") {
      const vk = `${key}:${d.variant}`;
      const v = variants.get(vk) ?? { label: d.step_label as string, variant: d.variant, sent: 0, replies: 0, rate: 0, example: (d.subject as string | null) ?? null };
      v.sent++;
      if (credited.has(d.id as string)) v.replies++;
      variants.set(vk, v);
    }
  }
  const withRate = <T extends { sent: number; replies: number; rate: number }>(x: T) => ({ ...x, rate: x.sent ? x.replies / x.sent : 0 });
  return {
    sent: drafts.filter((d) => d.channel !== "linkedin").length,
    replied: firstReply.size,
    steps: [...steps.values()].map(withRate).sort((a, b) => b.sent - a.sent),
    variants: [...variants.values()].map(withRate).sort((a, b) => a.label.localeCompare(b.label) || a.variant.localeCompare(b.variant)),
  };
}
