"use server";

import { firstIssue, optionalText, requireWorkspace, type ActionState } from "@/lib/actions";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const templateSchema = z.object({
  channel: z.enum(["whatsapp", "instagram", "email", "sms"]),
  name: z.string().trim().min(2, "Name the template").max(80),
  body: z.string().trim().min(2, "Write the message").max(1000),
  external_template_name: optionalText,
});

/** {{first_name}} placeholders used in a template body. */
function extractVariables(body: string) {
  return [...new Set([...body.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]!))];
}

export async function createTemplate(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = templateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const ws = await requireWorkspace();
  if ("error" in ws) return ws;

  const { error } = await ws.supabase.from("message_templates").insert({
    ...parsed.data,
    org_id: ws.viewer.orgId,
    variables: extractVariables(parsed.data.body),
  });
  if (error) return { error: error.code === "23505" ? "A template with that name already exists." : error.message };

  revalidatePath(`/${parsed.data.channel}`);
  return { ok: true, message: "Template saved" };
}

export async function deleteTemplate(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const ws = await requireWorkspace();
  if ("error" in ws) return;
  await ws.supabase.from("message_templates").delete().eq("id", id.data);
  revalidatePath("/whatsapp");
  revalidatePath("/instagram");
}
