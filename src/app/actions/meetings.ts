"use server";

import { requireWorkspace, type ActionState } from "@/lib/actions";
import { DEFAULT_WRITER_CONFIG, startAutopilotForLead, type WriterConfig } from "@/lib/agents/outreach-writer";
import { getAgentDefinition } from "@/lib/agents/registry";
import { resolveConfig } from "@/lib/agents/runner";
import type { SequenceKey } from "@/lib/sequences";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// What happened on the call. Moves the pipeline and starts the right follow-up.

const schema = z.object({ id: z.uuid(), outcome: z.enum(["held", "no_show", "not_fit"]) });

export async function setMeetingOutcome(id: string, outcome: "held" | "no_show" | "not_fit"): Promise<ActionState> {
  const parsed = schema.safeParse({ id, outcome });
  if (!parsed.success) return { error: "Invalid request" };
  const ws = await requireWorkspace(["owner", "admin", "manager", "member"]);
  if ("error" in ws) return ws;
  const { supabase, viewer } = ws;

  const { data: meeting } = await supabase.from("meetings").select("id, lead_id, starts_at, status").eq("id", id).maybeSingle();
  if (!meeting?.lead_id) return { error: "Meeting not found" };
  const leadId = meeting.lead_id as string;

  await supabase.from("meetings").update({ status: outcome === "no_show" ? "no_show" : "held" }).eq("id", id);
  await supabase.from("tasks").update({ status: "done" }).eq("org_id", viewer.orgId).eq("dedupe_key", `outcome:${id}`);

  const followUp: Record<typeof outcome, { stage?: string; sequence?: SequenceKey; note: string }> = {
    held: { stage: "proposal", sequence: "proposal", note: "Call held → Proposal. Proposal follow-ups start on autopilot." },
    no_show: { sequence: "no_show", note: "No-show → reschedule email queued for approval." },
    not_fit: { stage: "lost", note: "Call held → not a fit. Lead closed." },
  };
  const f = followUp[outcome];
  await supabase
    .from("leads")
    .update({ ...(f.stage ? { stage: f.stage } : {}), ...(outcome === "not_fit" ? { lost_reason: "Not a fit after the call", outreach_status: "stopped" } : {}), last_contacted_at: new Date().toISOString() })
    .eq("id", leadId);
  await supabase.from("activities").insert({ org_id: viewer.orgId, lead_id: leadId, actor_id: viewer.userId, type: "meeting", body: f.note });

  let message = f.note;
  if (outcome === "held") {
    await supabase.from("tasks").insert({
      org_id: viewer.orgId,
      lead_id: leadId,
      assignee_id: viewer.userId,
      created_by: viewer.userId,
      title: "Send the proposal (within 2 hours of the call)",
      description: "Fill in the proposal template (playbook 07), set the deal value on the lead, and send it.",
      priority: "high",
      due_at: new Date(Date.now() + 2 * 3_600_000).toISOString(),
    });
  }
  if (f.sequence) {
    const def = getAgentDefinition("outreach_writer")!;
    const { data: row } = await supabase.from("agents").select("config").eq("org_id", viewer.orgId).eq("key", "outreach_writer").maybeSingle();
    const cfg = { ...DEFAULT_WRITER_CONFIG, ...resolveConfig(def, row?.config as Record<string, unknown> | null), sequence: f.sequence } as WriterConfig;
    try {
      await startAutopilotForLead({ supabase, orgId: viewer.orgId, ownerId: viewer.userId, state: {} }, cfg, leadId);
    } catch (err) {
      message += ` (Autopilot not started: ${err instanceof Error ? err.message : "error"})`;
    }
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/outreach");
  revalidatePath("/tasks");
  return { ok: true, message };
}
