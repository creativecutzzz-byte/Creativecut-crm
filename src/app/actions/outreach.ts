"use server";

import { requireWorkspace, type ActionState } from "@/lib/actions";
import { DEFAULT_WRITER_CONFIG, startAutopilotForLead, type WriterConfig } from "@/lib/agents/outreach-writer";
import { getAgentDefinition } from "@/lib/agents/registry";
import { resolveConfig, runAgent } from "@/lib/agents/runner";
import { loadSenderSettings, sendDraft } from "@/lib/outreach/sender";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Approval queue actions. Approving sends right away when it's inside the
// sending window and under the daily cap; otherwise it's queued.

const APPROVERS = ["owner", "admin", "manager"] as const;

function refresh(leadId?: string) {
  revalidatePath("/outreach");
  revalidatePath("/agents");
  if (leadId) revalidatePath(`/leads/${leadId}`);
}

const approveSchema = z.object({
  id: z.uuid(),
  subject: z.string().max(200).optional(),
  body: z.string().trim().min(1, "The message is empty").max(5000),
});

export async function approveDraft(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = approveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const ws = await requireWorkspace([...APPROVERS]);
  if ("error" in ws) return ws;

  const { data: draft, error } = await ws.supabase
    .from("outreach_drafts")
    .update({ body: parsed.data.body, ...(parsed.data.subject !== undefined ? { subject: parsed.data.subject || null } : {}) })
    .eq("id", parsed.data.id)
    .in("status", ["pending", "failed"])
    .select("id, lead_id, status")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!draft) return { error: "This message was already handled." };
  if (draft.status === "failed") await ws.supabase.from("outreach_drafts").update({ status: "pending", error: null }).eq("id", draft.id);

  const settings = await loadSenderSettings(ws.supabase, ws.viewer.orgId);
  const outcome = await sendDraft(ws.supabase, draft.id, { actorId: ws.viewer.userId, settings });
  refresh(draft.lead_id as string);
  if (outcome.status === "failed" || outcome.status === "blocked") return { error: outcome.message };
  return { ok: true, message: outcome.message };
}

export async function rejectDraft(id: string, stopLead: boolean): Promise<ActionState> {
  if (!z.uuid().safeParse(id).success) return { error: "Invalid message" };
  const ws = await requireWorkspace([...APPROVERS]);
  if ("error" in ws) return ws;
  const { data: draft } = await ws.supabase.from("outreach_drafts").update({ status: "rejected" }).eq("id", id).in("status", ["pending", "approved", "failed"]).select("lead_id").maybeSingle();
  if (!draft) return { error: "This message was already handled." };
  if (stopLead) await stopAutopilotFor(ws, draft.lead_id as string, "Stopped from the approval queue");
  refresh(draft.lead_id as string);
  return { ok: true, message: stopLead ? "Rejected and autopilot stopped for this lead" : "Rejected — the next step will follow on schedule" };
}

/** Approves every pending message without unfilled placeholders (emails and LinkedIn stay separate). */
export async function approveAllEmails(): Promise<ActionState> {
  const ws = await requireWorkspace([...APPROVERS]);
  if ("error" in ws) return ws;
  const { data: drafts } = await ws.supabase.from("outreach_drafts").select("id").eq("org_id", ws.viewer.orgId).eq("status", "pending").eq("channel", "email").eq("kind", "sequence").limit(100);
  const settings = await loadSenderSettings(ws.supabase, ws.viewer.orgId);
  const counts = { sent: 0, queued: 0, skipped: 0 };
  for (const d of drafts ?? []) {
    const o = await sendDraft(ws.supabase, d.id, { actorId: ws.viewer.userId, settings });
    if (o.status === "sent" || o.status === "simulated") counts.sent++;
    else if (o.status === "scheduled") counts.queued++;
    else counts.skipped++;
  }
  refresh();
  return { ok: true, message: `Approved ${drafts?.length ?? 0}: ${counts.sent} sent, ${counts.queued} queued, ${counts.skipped} need attention.` };
}

export async function checkRepliesNow(): Promise<ActionState> {
  const ws = await requireWorkspace([...APPROVERS]);
  if ("error" in ws) return ws;
  const outcome = await runAgent(ws.supabase, ws.viewer.orgId, "reply_handler", "manual", ws.viewer.userId);
  refresh();
  revalidatePath("/leads");
  return outcome.status === "error" ? { error: outcome.summary } : { ok: true, message: outcome.summary };
}

export async function writeNextStepsNow(): Promise<ActionState> {
  const ws = await requireWorkspace(["owner", "admin"]);
  if ("error" in ws) return ws;
  const outcome = await runAgent(ws.supabase, ws.viewer.orgId, "outreach_writer", "manual", ws.viewer.userId);
  refresh();
  return outcome.status === "error" ? { error: outcome.summary } : { ok: true, message: outcome.summary };
}

export async function startAutopilot(leadId: string): Promise<ActionState> {
  if (!z.uuid().safeParse(leadId).success) return { error: "Invalid lead" };
  const ws = await requireWorkspace([...APPROVERS]);
  if ("error" in ws) return ws;
  const def = getAgentDefinition("outreach_writer")!;
  const { data: row } = await ws.supabase.from("agents").select("config").eq("org_id", ws.viewer.orgId).eq("key", "outreach_writer").maybeSingle();
  const cfg = { ...DEFAULT_WRITER_CONFIG, ...resolveConfig(def, row?.config as Record<string, unknown> | null) } as WriterConfig;
  try {
    const { drafted } = await startAutopilotForLead({ supabase: ws.supabase, orgId: ws.viewer.orgId, ownerId: ws.viewer.userId, state: {} }, cfg, leadId);
    refresh(leadId);
    return { ok: true, message: drafted ? `Autopilot on — ${drafted} message${drafted === 1 ? "" : "s"} waiting in the approval queue` : "Autopilot on — the first step will be written on the next run" };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't start autopilot" };
  }
}

export async function stopAutopilot(leadId: string): Promise<ActionState> {
  if (!z.uuid().safeParse(leadId).success) return { error: "Invalid lead" };
  const ws = await requireWorkspace([...APPROVERS]);
  if ("error" in ws) return ws;
  await stopAutopilotFor(ws, leadId, "Autopilot stopped by a teammate");
  refresh(leadId);
  return { ok: true, message: "Autopilot stopped" };
}

async function stopAutopilotFor(ws: Exclude<Awaited<ReturnType<typeof requireWorkspace>>, { error: string }>, leadId: string, note: string) {
  await Promise.all([
    ws.supabase.from("leads").update({ outreach_status: "stopped" }).eq("id", leadId),
    ws.supabase.from("outreach_drafts").update({ status: "cancelled", error: note }).eq("lead_id", leadId).eq("kind", "sequence").in("status", ["pending", "approved"]),
    ws.supabase.from("activities").insert({ org_id: ws.viewer.orgId, lead_id: leadId, actor_id: ws.viewer.userId, type: "system", body: note }),
  ]);
}
