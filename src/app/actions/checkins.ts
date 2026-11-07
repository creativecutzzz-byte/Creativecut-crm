"use server";

import { requireWorkspace, type ActionState } from "@/lib/actions";
import { istToday } from "@/lib/data";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const schema = z.object({
  doing: z.string().trim().max(1000).optional(),
  done: z.string().trim().max(1000).optional(),
  stuck: z.string().trim().max(1000).optional(),
});

export async function saveCheckin(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { doing, done, stuck } = parsed.data;
  if (!doing && !done && !stuck) return { error: "Write at least one line" };
  const ws = await requireWorkspace();
  if ("error" in ws) return ws;

  const { error } = await ws.supabase
    .from("checkins")
    .upsert({ org_id: ws.viewer.orgId, user_id: ws.viewer.userId, day: istToday(), doing: doing || null, done: done || null, stuck: stuck || null }, { onConflict: "org_id,user_id,day" });
  if (error) return { error: error.message };
  revalidatePath("/today");
  revalidatePath("/team");
  return { ok: true, message: stuck ? "Saved — your team can see where you're stuck" : "Check-in saved" };
}
