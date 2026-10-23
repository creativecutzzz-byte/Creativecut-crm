"use server";

import { firstIssue, optionalDateTime, optionalText, optionalUuid, requireWorkspace, type ActionState } from "@/lib/actions";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const taskSchema = z.object({
  title: z.string().trim().min(2, "Give the task a title").max(200),
  description: optionalText,
  priority: z.enum(["low", "medium", "high"]),
  due_at: optionalDateTime,
  assignee_id: optionalUuid,
  lead_id: optionalUuid,
  client_id: optionalUuid,
});

function revalidateTasks(leadId?: string | null, clientId?: string | null) {
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  if (leadId) revalidatePath(`/leads/${leadId}`);
  if (clientId) revalidatePath(`/clients/${clientId}`);
}

export async function createTask(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = taskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const ws = await requireWorkspace();
  if ("error" in ws) return ws;
  const { supabase, viewer } = ws;

  const { error } = await supabase.from("tasks").insert({
    ...parsed.data,
    assignee_id: parsed.data.assignee_id ?? viewer.userId,
    org_id: viewer.orgId,
    created_by: viewer.userId,
  });
  if (error) return { error: error.message };

  revalidateTasks(parsed.data.lead_id, parsed.data.client_id);
  return { ok: true, message: "Task added" };
}

const statusSchema = z.object({ id: z.uuid(), status: z.enum(["open", "done", "cancelled"]) });

export async function setTaskStatus(formData: FormData) {
  const parsed = statusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const ws = await requireWorkspace();
  if ("error" in ws) return;
  const { supabase, viewer } = ws;

  const { data: task } = await supabase.from("tasks").update({ status: parsed.data.status }).eq("id", parsed.data.id).select("title, lead_id, client_id").single();
  if (task && parsed.data.status === "done") {
    await supabase.from("activities").insert({
      org_id: viewer.orgId,
      lead_id: task.lead_id,
      client_id: task.client_id,
      actor_id: viewer.userId,
      type: "task",
      body: `Completed task: ${task.title}`,
    });
  }
  revalidateTasks(task?.lead_id, task?.client_id);
}

export async function deleteTask(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const ws = await requireWorkspace();
  if ("error" in ws) return;
  const { data: task } = await ws.supabase.from("tasks").delete().eq("id", id.data).select("lead_id, client_id").single();
  revalidateTasks(task?.lead_id, task?.client_id);
}
