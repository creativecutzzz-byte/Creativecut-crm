"use server";

import { firstIssue, requireWorkspace, type ActionState } from "@/lib/actions";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function renameWorkspace(_: ActionState, formData: FormData): Promise<ActionState> {
  const name = z.string().trim().min(2, "Name is too short").max(80).safeParse(formData.get("name"));
  if (!name.success) return { error: firstIssue(name.error) };
  const ws = await requireWorkspace(["owner", "admin"]);
  if ("error" in ws) return ws;

  const { error } = await ws.supabase.from("organizations").update({ name: name.data }).eq("id", ws.viewer.orgId);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, message: "Workspace renamed" };
}

export async function updateProfile(_: ActionState, formData: FormData): Promise<ActionState> {
  const fullName = z.string().trim().min(2, "Enter your name").max(80).safeParse(formData.get("full_name"));
  if (!fullName.success) return { error: firstIssue(fullName.error) };
  const ws = await requireWorkspace();
  if ("error" in ws) return ws;

  const { error } = await ws.supabase.from("profiles").update({ full_name: fullName.data }).eq("id", ws.viewer.userId);
  if (error) return { error: error.message };
  await ws.supabase.auth.updateUser({ data: { full_name: fullName.data } });
  revalidatePath("/", "layout");
  return { ok: true, message: "Profile updated" };
}
