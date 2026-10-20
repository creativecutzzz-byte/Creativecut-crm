"use server";

import { scoreLead } from "@/lib/ai/lead-scoring";
import { LEAD_SOURCES, LEAD_STAGES } from "@/lib/constants";
import { getViewer } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { LeadSource, LeadStage } from "@/lib/types";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export interface ActionState {
  ok?: boolean;
  error?: string;
  message?: string;
}

const DEMO_ERROR = "Demo mode — connect Supabase (see README) to save changes.";

const optional = z
  .string()
  .trim()
  .optional()
  .transform((v) => v || null);

const leadSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  company: optional,
  email: z.union([z.literal(""), z.email("Invalid email")]).transform((v) => v || null),
  phone: optional,
  whatsapp_number: optional,
  instagram_handle: optional.transform((v) => v?.replace(/^@/, "") ?? null),
  source: z.enum(Object.keys(LEAD_SOURCES) as [LeadSource, ...LeadSource[]]),
  estimated_value: z.coerce.number().min(0).max(10_000_000),
  service_interest: z.array(z.string()).default([]),
  marketing_consent: z.boolean(),
});

export async function createLead(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = leadSchema.safeParse({
    ...Object.fromEntries(formData),
    service_interest: formData.getAll("service_interest"),
    marketing_consent: formData.get("marketing_consent") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  if (!isSupabaseConfigured) return { error: DEMO_ERROR };

  const viewer = await getViewer();
  if (!viewer.orgId) return { error: "You're not part of a workspace." };

  const lead = { ...parsed.data, stage: "new" as const, last_contacted_at: null };
  const { score } = scoreLead(lead);

  const supabase = await createClient();
  const { error } = await supabase.from("leads").insert({
    ...lead,
    org_id: viewer.orgId,
    owner_id: viewer.userId,
    ai_score: score,
    next_follow_up_at: new Date(Date.now() + 3_600_000).toISOString(),
  });
  if (error) return { error: error.message };

  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return { ok: true, message: "Lead created" };
}

const stageSchema = z.object({
  id: z.uuid(),
  stage: z.enum(LEAD_STAGES.map((s) => s.id) as [LeadStage, ...LeadStage[]]),
});

export async function updateLeadStage(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = stageSchema.safeParse(Object.fromEntries(formData));
  if (!isSupabaseConfigured) return { error: DEMO_ERROR };
  if (!parsed.success) return { error: "Invalid stage" };

  const viewer = await getViewer();
  const supabase = await createClient();
  const { error } = await supabase.from("leads").update({ stage: parsed.data.stage }).eq("id", parsed.data.id);
  if (error) return { error: error.message };

  await supabase.from("activities").insert({
    org_id: viewer.orgId,
    lead_id: parsed.data.id,
    actor_id: viewer.userId,
    type: "stage_change",
    body: `Moved to ${LEAD_STAGES.find((s) => s.id === parsed.data.stage)?.label}`,
  });

  revalidatePath(`/leads/${parsed.data.id}`);
  revalidatePath("/leads");
  return { ok: true, message: "Stage updated" };
}
