"use server";

import { getLeads, getTeam, getTemplates, getViewer } from "@/lib/data";
import { templateVars } from "@/lib/channel-vars";
import { isSupabaseConfigured } from "@/lib/env";
import { instagram, renderTemplate, whatsapp } from "@/lib/integrations";
import type { SendResult } from "@/lib/integrations/safety";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export interface SendState {
  error?: string;
  preview?: string;
  status?: SendResult["status"];
  note?: string;
  at?: string;
}

const schema = z.object({
  channel: z.enum(["whatsapp", "instagram"]),
  lead_id: z.string().min(1, "Choose a lead"),
  body: z.string().trim().min(1, "Write a message").max(1000),
  template_id: z.string().optional(),
});

const WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Sends a WhatsApp message or Instagram DM to a lead — for real when
 * MESSAGING_MODE=live and credentials are set, otherwise as a dry-run preview.
 *
 * Meta's 24-hour rule is enforced here: inside the window the typed text is
 * sent; outside it WhatsApp falls back to the selected approved template
 * (only for leads with marketing consent) and Instagram refuses.
 */
export async function sendMessage(_: SendState, formData: FormData): Promise<SendState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { channel, lead_id, body, template_id } = parsed.data;

  const provider = channel === "whatsapp" ? whatsapp : instagram;
  const live = provider.isLive();
  if (live && !isSupabaseConfigured) return { error: "Connect Supabase before sending live messages, so every message is logged." };

  const [leads, viewer] = await Promise.all([getLeads(), getViewer()]);
  const lead = leads.find((l) => l.id === lead_id);
  if (!lead) return { error: "Lead not found" };
  const address = channel === "whatsapp" ? lead.whatsapp_number : lead.instagram_handle;
  if (!address) return { error: `This lead has no ${channel === "whatsapp" ? "WhatsApp number" : "Instagram handle"}.` };

  const supabase = isSupabaseConfigured ? await createClient() : null;

  // When did this person last message us on this channel?
  let windowOpen = false;
  if (supabase) {
    const { data: last } = await supabase
      .from("messages")
      .select("created_at")
      .eq("lead_id", lead.id)
      .eq("channel", channel)
      .eq("direction", "inbound")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    windowOpen = Boolean(last && Date.now() - new Date(last.created_at as string).getTime() < WINDOW_MS);
  }

  let result: SendResult;
  let loggedBody = body;
  let note: string | undefined;
  let templateId: string | null = null;

  try {
    if (channel === "whatsapp") {
      if (windowOpen || !live) {
        result = await whatsapp.sendText({ to: address, body });
        if (!live && !windowOpen) note = "Live, this would need an approved template: they haven't messaged you in the last 24 hours.";
      } else {
        const template = (await getTemplates()).find((t) => t.id === template_id && t.channel === "whatsapp");
        if (!template?.external_template_name) {
          return { error: "They haven't messaged you in the last 24 hours, so WhatsApp only allows an approved template. Pick a template that has its Meta template name set." };
        }
        if (!lead.marketing_consent) return { error: "This lead hasn't given marketing consent, so a business-initiated template can't be sent. Wait for them to message you first." };
        const vars = templateVars(lead, await getTeam());
        loggedBody = renderTemplate(template.body, vars);
        templateId = template.id;
        result = await whatsapp.sendTemplate({ to: address, templateName: template.external_template_name, params: template.variables.map((v) => vars[v] ?? ""), renderedBody: loggedBody });
        note = `Sent as the approved template “${template.external_template_name}” because the 24-hour window is closed.`;
      }
    } else {
      if (live && !windowOpen) {
        return { error: lead.instagram_user_id ? "Instagram only allows replies within 24 hours of their last DM. Wait for them to message you again." : `@${address} hasn't messaged your Instagram account yet. Instagram only allows replies to people who DM you first.` };
      }
      result = await instagram.sendDirectMessage({ recipientId: lead.instagram_user_id ?? null, handle: address.replace(/^@/, ""), body });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sending failed";
    if (supabase && viewer.orgId) {
      await supabase.from("messages").insert({ org_id: viewer.orgId, channel, direction: "outbound", status: "failed", lead_id, to_address: address, body: loggedBody, template_id: templateId, error: message.slice(0, 500), sent_by: viewer.userId });
    }
    return { error: `${channel === "whatsapp" ? "WhatsApp" : "Instagram"} rejected the message: ${message}` };
  }

  if (supabase && viewer.orgId) {
    await supabase.from("messages").insert({
      org_id: viewer.orgId,
      channel,
      direction: "outbound",
      status: result.status,
      lead_id,
      to_address: address,
      body: loggedBody,
      template_id: templateId,
      external_id: result.externalId,
      sent_by: viewer.userId,
    });
    if (result.status === "sent") {
      await Promise.all([
        supabase.from("activities").insert({ org_id: viewer.orgId, lead_id, actor_id: viewer.userId, type: channel, body: `Sent: ${loggedBody.slice(0, 500)}`, metadata: { direction: "outbound" } }),
        supabase.from("leads").update({ last_contacted_at: result.at }).eq("id", lead_id),
        // Replying closes the "they messaged you" task.
        supabase.from("tasks").update({ status: "done" }).eq("lead_id", lead_id).eq("status", "open").like("dedupe_key", "inbound-reply:%"),
      ]);
    }
    revalidatePath(`/${channel}`);
    revalidatePath(`/leads/${lead_id}`);
  }

  return { preview: result.preview, status: result.status, note, at: result.at };
}
