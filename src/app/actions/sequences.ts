"use server";

import { firstIssue, requireWorkspace, type ActionState } from "@/lib/actions";
import { startSequence, stopSequences } from "@/lib/automation";
import { SEQUENCES, type SequenceKey } from "@/lib/sequences";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const startSchema = z.object({
  lead_id: z.uuid(),
  sequence: z.enum(Object.keys(SEQUENCES) as [SequenceKey, ...SequenceKey[]], "Choose a sequence"),
});

export async function startLeadSequence(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = startSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const ws = await requireWorkspace();
  if ("error" in ws) return ws;
  const { supabase, viewer } = ws;

  const { data: lead, error } = await supabase.from("leads").select("id, name, company, personalization, owner_id, stage").eq("id", parsed.data.lead_id).single();
  if (error) return { error: error.message };
  if (lead.stage === "won" || lead.stage === "lost") return { error: "This lead is closed. Reopen it before starting a sequence." };

  // One sequence at a time keeps the follow-ups from overlapping.
  await stopSequences(supabase, lead.id);
  const result = await startSequence(supabase, viewer, lead, parsed.data.sequence);
  if ("error" in result) return { error: result.error };

  revalidatePath(`/leads/${lead.id}`);
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  const steps = SEQUENCES[parsed.data.sequence].steps.length;
  return { ok: true, message: `${steps} follow-up tasks scheduled` };
}

export async function stopLeadSequence(_: ActionState, formData: FormData): Promise<ActionState> {
  const id = z.uuid().safeParse(formData.get("lead_id"));
  if (!id.success) return { error: "Invalid lead" };
  const ws = await requireWorkspace();
  if ("error" in ws) return ws;

  const cancelled = await stopSequences(ws.supabase, id.data);
  await ws.supabase.from("activities").insert({
    org_id: ws.viewer.orgId,
    lead_id: id.data,
    actor_id: ws.viewer.userId,
    type: "system",
    body: `Stopped sequence (${cancelled} remaining step${cancelled === 1 ? "" : "s"} cancelled)`,
  });

  revalidatePath(`/leads/${id.data}`);
  revalidatePath("/tasks");
  return { ok: true, message: "Sequence stopped" };
}
