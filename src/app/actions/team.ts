"use server";

import { getViewer } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
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
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (!isSupabaseConfigured) return { error: "Demo mode — connect Supabase to invite teammates." };

  const viewer = await getViewer();
  if (!viewer.orgId || !["owner", "admin"].includes(viewer.role)) return { error: "Only owners and admins can invite teammates." };

  const supabase = await createClient();
  const { error } = await supabase.from("team_members").insert({
    org_id: viewer.orgId,
    invite_email: parsed.data.email.toLowerCase(),
    role: parsed.data.role,
    title: parsed.data.title || null,
    status: "invited",
  });
  if (error) return { error: error.code === "23505" ? "That email is already on the team." : error.message };

  revalidatePath("/team");
  return { ok: true, message: `Invitation recorded for ${parsed.data.email}. Ask them to sign up with that address.` };
}
