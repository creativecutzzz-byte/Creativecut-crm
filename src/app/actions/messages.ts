"use server";

import { getLeads, getViewer } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/env";
import { instagram, whatsapp } from "@/lib/integrations";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export interface SimulateState {
  error?: string;
  preview?: string;
  simulatedAt?: string;
}

const schema = z.object({
  channel: z.enum(["whatsapp", "instagram"]),
  lead_id: z.string().min(1, "Choose a lead"),
  body: z.string().trim().min(1, "Write a message").max(1000),
  template_name: z.string().optional(),
});

/**
 * Runs a message through the integration layer in dry-run mode. Nothing is
 * delivered; in live mode the simulated message is logged for the audit trail.
 */
export async function simulateMessage(_: SimulateState, formData: FormData): Promise<SimulateState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { channel, lead_id, body, template_name } = parsed.data;

  const lead = (await getLeads()).find((l) => l.id === lead_id);
  if (!lead) return { error: "Lead not found" };

  const result =
    channel === "whatsapp"
      ? lead.whatsapp_number
        ? await whatsapp.sendTemplateMessage({ to: lead.whatsapp_number, templateName: template_name || null, renderedBody: body })
        : null
      : lead.instagram_handle
        ? await instagram.sendDirectMessage({ handle: lead.instagram_handle, body })
        : null;
  if (!result) return { error: `This lead has no ${channel === "whatsapp" ? "WhatsApp number" : "Instagram handle"}.` };

  if (isSupabaseConfigured) {
    const viewer = await getViewer();
    const supabase = await createClient();
    await supabase.from("messages").insert({
      org_id: viewer.orgId,
      channel,
      direction: "outbound",
      status: "simulated",
      lead_id,
      to_address: channel === "whatsapp" ? lead.whatsapp_number : lead.instagram_handle,
      body,
      sent_by: viewer.userId,
    });
  }

  return { preview: result.preview, simulatedAt: result.simulated_at };
}
