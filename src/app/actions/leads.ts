"use server";

import { scoreLead } from "@/lib/ai/lead-scoring";
import { createOnboardingTasks, hasOpenSequence, startSequence, stopSequences } from "@/lib/automation";
import { firstIssue, optionalDateTime, optionalEmail, optionalText, optionalUuid, requireWorkspace, type ActionState } from "@/lib/actions";
import { LEAD_SOURCES, LEAD_STAGES } from "@/lib/constants";
import type { ActivityType, LeadSource, LeadStage } from "@/lib/types";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

export type { ActionState } from "@/lib/actions";

const leadSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  company: optionalText,
  email: optionalEmail,
  phone: optionalText,
  whatsapp_number: optionalText,
  instagram_handle: optionalText.transform((v) => v?.replace(/^@/, "") || null),
  source: z.enum(Object.keys(LEAD_SOURCES) as [LeadSource, ...LeadSource[]]),
  estimated_value: z.coerce.number().min(0, "Value can't be negative").max(1_000_000_000),
  service_interest: z.array(z.string()).default([]),
  marketing_consent: z.boolean(),
  owner_id: optionalUuid,
  next_follow_up_at: optionalDateTime,
  website: optionalText,
  personalization: z
    .string()
    .trim()
    .max(600, "Keep the personalisation line under 600 characters")
    .optional()
    .transform((v) => v || null),
});

function parseLead(formData: FormData) {
  return leadSchema.safeParse({
    ...Object.fromEntries(formData),
    service_interest: formData.getAll("service_interest"),
    marketing_consent: formData.get("marketing_consent") === "on",
  });
}

function revalidateLeads(id?: string) {
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/leads/${id}`);
}

export async function createLead(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseLead(formData);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const ws = await requireWorkspace();
  if ("error" in ws) return ws;
  const { supabase, viewer } = ws;

  const lead = { ...parsed.data, stage: "new" as const, last_contacted_at: null };
  const { score } = scoreLead(lead);

  const { data, error } = await supabase
    .from("leads")
    .insert({
      ...lead,
      org_id: viewer.orgId,
      owner_id: lead.owner_id ?? viewer.userId,
      ai_score: score,
      next_follow_up_at: lead.next_follow_up_at ?? new Date(Date.now() + 3_600_000).toISOString(),
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await supabase.from("activities").insert({ org_id: viewer.orgId, lead_id: data.id, actor_id: viewer.userId, type: "system", body: "Lead created" });

  revalidateLeads();
  return { ok: true, message: "Lead created" };
}

export async function updateLead(_: ActionState, formData: FormData): Promise<ActionState> {
  const id = z.uuid().safeParse(formData.get("id"));
  const parsed = parseLead(formData);
  if (!id.success) return { error: "Invalid lead" };
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const ws = await requireWorkspace();
  if ("error" in ws) return ws;

  const { data: current, error: loadError } = await ws.supabase.from("leads").select("stage, last_contacted_at").eq("id", id.data).single();
  if (loadError) return { error: loadError.message };

  const { score } = scoreLead({ ...parsed.data, stage: current.stage as LeadStage, last_contacted_at: current.last_contacted_at });
  const { error } = await ws.supabase.from("leads").update({ ...parsed.data, ai_score: score }).eq("id", id.data);
  if (error) return { error: error.message };

  revalidateLeads(id.data);
  return { ok: true, message: "Lead updated" };
}

export async function deleteLead(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const ws = await requireWorkspace();
  if ("error" in ws) return;
  await ws.supabase.from("leads").delete().eq("id", id.data);
  revalidateLeads();
  redirect("/leads");
}

const stageSchema = z.object({
  id: z.uuid(),
  stage: z.enum(LEAD_STAGES.map((s) => s.id) as [LeadStage, ...LeadStage[]]),
});

export async function updateLeadStage(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = stageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid stage" };
  const ws = await requireWorkspace();
  if ("error" in ws) return ws;
  const { supabase, viewer } = ws;

  const closed = parsed.data.stage === "won" || parsed.data.stage === "lost";
  const { error } = await supabase
    .from("leads")
    .update({ stage: parsed.data.stage, ...(closed ? { next_follow_up_at: null } : {}) })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  await supabase.from("activities").insert({
    org_id: viewer.orgId,
    lead_id: parsed.data.id,
    actor_id: viewer.userId,
    type: "stage_change",
    body: `Moved to ${LEAD_STAGES.find((s) => s.id === parsed.data.stage)?.label}`,
  });

  // Automation: a proposal replaces earlier outreach with the proposal follow-up; closing a deal ends all sequences.
  let message = "Stage updated";
  if (parsed.data.stage === "proposal") {
    await stopSequences(supabase, parsed.data.id, ["cold_saas", "inbound", "no_show", "reengage"]);
    if (!(await hasOpenSequence(supabase, parsed.data.id, "proposal"))) {
      const { data: lead } = await supabase.from("leads").select("id, name, company, personalization, owner_id").eq("id", parsed.data.id).single();
      if (lead) {
        await startSequence(supabase, viewer, lead, "proposal");
        message = "Stage updated · proposal follow-ups scheduled";
      }
    }
  } else if (closed) {
    await stopSequences(supabase, parsed.data.id);
  }

  revalidateLeads(parsed.data.id);
  revalidatePath("/tasks");
  return { ok: true, message };
}

const LOGGABLE = ["note", "call", "email", "whatsapp", "instagram", "meeting"] as const satisfies ActivityType[];

const activitySchema = z.object({
  lead_id: optionalUuid,
  client_id: optionalUuid,
  type: z.enum(LOGGABLE),
  body: z.string().trim().min(1, "Write something to log").max(4000),
  next_follow_up_at: optionalDateTime,
});

/** Logs a note or touchpoint on a lead or client. Touchpoints update the lead's last-contacted time. */
export async function logActivity(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = activitySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { lead_id, client_id, type, body, next_follow_up_at } = parsed.data;
  if (!lead_id && !client_id) return { error: "Nothing to log against" };
  const ws = await requireWorkspace();
  if ("error" in ws) return ws;
  const { supabase, viewer } = ws;

  const { error } = await supabase.from("activities").insert({ org_id: viewer.orgId, lead_id, client_id, actor_id: viewer.userId, type, body });
  if (error) return { error: error.message };

  if (lead_id) {
    const updates: Record<string, string> = {};
    if (type !== "note") updates.last_contacted_at = new Date().toISOString();
    if (next_follow_up_at) updates.next_follow_up_at = next_follow_up_at;
    if (Object.keys(updates).length) await supabase.from("leads").update(updates).eq("id", lead_id);
    revalidateLeads(lead_id);
  }
  if (client_id) revalidatePath(`/clients/${client_id}`);
  revalidatePath("/dashboard");
  return { ok: true, message: "Logged" };
}

const convertSchema = z.object({
  id: z.uuid(),
  monthly_retainer: z.coerce.number().min(0).max(1_000_000_000),
  industry: optionalText,
});

/** Marks a lead as won and creates the matching client record. */
export async function convertLead(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = convertSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const ws = await requireWorkspace();
  if ("error" in ws) return ws;
  const { supabase, viewer } = ws;

  const { data: lead, error: loadError } = await supabase.from("leads").select("*").eq("id", parsed.data.id).single();
  if (loadError) return { error: loadError.message };
  if (lead.converted_client_id) return { error: "This lead is already a client." };

  const { data: client, error } = await supabase
    .from("clients")
    .insert({
      org_id: viewer.orgId,
      name: lead.name,
      company: lead.company,
      industry: parsed.data.industry,
      email: lead.email,
      phone: lead.phone,
      whatsapp_number: lead.whatsapp_number,
      instagram_handle: lead.instagram_handle,
      status: "onboarding",
      monthly_retainer: parsed.data.monthly_retainer,
      services: lead.service_interest,
      owner_id: lead.owner_id ?? viewer.userId,
      started_at: new Date().toISOString().slice(0, 10),
      health_score: 75,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await supabase.from("leads").update({ stage: "won", converted_client_id: client.id, next_follow_up_at: null }).eq("id", lead.id);
  await stopSequences(supabase, lead.id);
  await createOnboardingTasks(supabase, viewer, client.id, lead.owner_id ?? viewer.userId);
  await supabase.from("activities").insert([
    { org_id: viewer.orgId, lead_id: lead.id, actor_id: viewer.userId, type: "stage_change", body: "Won — converted to client" },
    { org_id: viewer.orgId, client_id: client.id, actor_id: viewer.userId, type: "system", body: `Client created from lead ${lead.company ?? lead.name}` },
  ]);

  revalidateLeads(lead.id);
  revalidatePath("/clients");
  revalidatePath("/tasks");
  redirect(`/clients/${client.id}`);
}
