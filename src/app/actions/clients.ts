"use server";

import { firstIssue, optionalDateTime, optionalEmail, optionalText, optionalUuid, requireWorkspace, type ActionState } from "@/lib/actions";
import { CLIENT_STATUS } from "@/lib/constants";
import type { ClientStatus } from "@/lib/types";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const clientSchema = z.object({
  name: z.string().trim().min(2, "Contact name is required"),
  company: optionalText,
  industry: optionalText,
  email: optionalEmail,
  phone: optionalText,
  whatsapp_number: optionalText,
  instagram_handle: optionalText.transform((v) => v?.replace(/^@/, "") || null),
  website: optionalText,
  status: z.enum(Object.keys(CLIENT_STATUS) as [ClientStatus, ...ClientStatus[]]),
  monthly_retainer: z.coerce.number().min(0, "Retainer can't be negative").max(1_000_000_000),
  services: z.array(z.string()).default([]),
  owner_id: optionalUuid,
  started_at: optionalDateTime.transform((v) => v?.slice(0, 10) ?? null),
  health_score: z
    .union([z.literal(""), z.coerce.number().int().min(0).max(100)])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
});

function parseClient(formData: FormData) {
  return clientSchema.safeParse({ ...Object.fromEntries(formData), services: formData.getAll("services") });
}

export async function createClientRecord(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseClient(formData);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const ws = await requireWorkspace();
  if ("error" in ws) return ws;
  const { supabase, viewer } = ws;

  const { data, error } = await supabase
    .from("clients")
    .insert({ ...parsed.data, org_id: viewer.orgId, owner_id: parsed.data.owner_id ?? viewer.userId })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await supabase.from("activities").insert({ org_id: viewer.orgId, client_id: data.id, actor_id: viewer.userId, type: "system", body: "Client added" });
  revalidatePath("/clients");
  revalidatePath("/dashboard");
  return { ok: true, message: "Client added" };
}

export async function updateClientRecord(_: ActionState, formData: FormData): Promise<ActionState> {
  const id = z.uuid().safeParse(formData.get("id"));
  const parsed = parseClient(formData);
  if (!id.success) return { error: "Invalid client" };
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const ws = await requireWorkspace();
  if ("error" in ws) return ws;

  const { error } = await ws.supabase.from("clients").update(parsed.data).eq("id", id.data);
  if (error) return { error: error.message };

  revalidatePath("/clients");
  revalidatePath(`/clients/${id.data}`);
  return { ok: true, message: "Client updated" };
}

export async function deleteClientRecord(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const ws = await requireWorkspace();
  if ("error" in ws) return;
  await ws.supabase.from("clients").delete().eq("id", id.data);
  revalidatePath("/clients");
  redirect("/clients");
}
