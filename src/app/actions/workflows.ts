"use server";

import { getLeads, getTemplates, getWorkflows } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { planRun, type PlannedStep } from "@/lib/workflows/engine";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export interface TestRunState {
  error?: string;
  plan?: PlannedStep[];
  leadName?: string;
}

export async function testWorkflow(_: TestRunState, formData: FormData): Promise<TestRunState> {
  const workflowId = String(formData.get("workflow_id") ?? "");
  const leadId = String(formData.get("lead_id") ?? "");
  const [workflows, leads, templates] = await Promise.all([getWorkflows(), getLeads(), getTemplates()]);
  const workflow = workflows.find((w) => w.id === workflowId);
  const lead = leads.find((l) => l.id === leadId);
  if (!workflow || !lead) return { error: "Choose a workflow and a lead." };
  return { plan: planRun(workflow.steps, lead, templates), leadName: lead.company ?? lead.name };
}

export interface ToggleState {
  error?: string;
}

export async function toggleWorkflow(_: ToggleState, formData: FormData): Promise<ToggleState> {
  const parsed = z.object({ id: z.uuid(), active: z.enum(["true", "false"]) }).safeParse(Object.fromEntries(formData));
  if (!isSupabaseConfigured) return { error: "Demo mode — connect Supabase to save changes." };
  if (!parsed.success) return { error: "Invalid workflow" };

  const supabase = await createClient();
  const { error } = await supabase.from("workflows").update({ is_active: parsed.data.active === "true" }).eq("id", parsed.data.id);
  if (error) return { error: error.message };
  revalidatePath("/workflows");
  return {};
}
