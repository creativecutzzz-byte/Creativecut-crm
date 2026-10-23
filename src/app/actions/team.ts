"use server";

import { firstIssue, requireWorkspace } from "@/lib/actions";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export interface InviteState {
  ok?: boolean;
  error?: string;
  message?: string;
}

const inviteSchema = z.object({
  email: z.email("Enter a valid email"),
  role: z.enum(["admin", "manager", "member"]),
  title: z.string().trim().max(80).optional(),
});

/**
 * Records a pending invitation. No email is sent from here: the invitee signs
 * up with this address and `handle_new_user` attaches them to the workspace.
 */
export async function inviteMember(_: InviteState, formData: FormData): Promise<InviteState> {
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const ws = await requireWorkspace(["owner", "admin"]);
  if ("error" in ws) return ws;
  const { supabase, viewer } = ws;

  const { error } = await supabase.from("team_members").insert({
    org_id: viewer.orgId,
    invite_email: parsed.data.email.toLowerCase(),
    role: parsed.data.role,
    title: parsed.data.title || null,
    status: "invited",
  });
  if (error) return { error: error.code === "23505" ? "That email is already on the team." : error.message };

  revalidatePath("/team");
  return { ok: true, message: `Invitation recorded for ${parsed.data.email}. Ask them to create an account at /signup with that address.` };
}

const memberSchema = z.object({
  id: z.uuid(),
  role: z.enum(["admin", "manager", "member"]).optional(),
});

async function loadManageableMember(formData: FormData) {
  const parsed = memberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid member" } as const;
  const ws = await requireWorkspace(["owner", "admin"]);
  if ("error" in ws) return ws;

  const { data: member, error } = await ws.supabase.from("team_members").select("id, user_id, role").eq("id", parsed.data.id).single();
  if (error) return { error: error.message } as const;
  if (member.user_id === ws.viewer.userId) return { error: "You can't change your own membership." } as const;
  if (member.role === "owner") return { error: "The workspace owner can't be changed here." } as const;
  return { ws, member, role: parsed.data.role };
}

export async function updateMemberRole(_: InviteState, formData: FormData): Promise<InviteState> {
  const result = await loadManageableMember(formData);
  if ("error" in result) return { error: result.error };
  if (!result.role) return { error: "Choose a role" };

  const { error } = await result.ws.supabase.from("team_members").update({ role: result.role }).eq("id", result.member.id);
  if (error) return { error: error.message };
  revalidatePath("/team");
  return { ok: true };
}

export async function removeMember(_: InviteState, formData: FormData): Promise<InviteState> {
  const result = await loadManageableMember(formData);
  if ("error" in result) return { error: result.error };

  const { error } = await result.ws.supabase.from("team_members").delete().eq("id", result.member.id);
  if (error) return { error: error.message };
  revalidatePath("/team");
  return { ok: true };
}
