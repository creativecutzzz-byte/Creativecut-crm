import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { calendar } from "@/lib/integrations/calendar";
import { gmail } from "@/lib/integrations/gmail";
import { bookingSettingsSchema, computeSlots, DEFAULT_BOOKING_SETTINGS, formatIst, type BookingSettings } from "./slots";

// Meeting booking and what happens to the pipeline when a meeting exists.

export const meetingSettingsSchema = bookingSettingsSchema.extend({
  notify_email: z.union([z.literal(""), z.email()]),
});
export type MeetingSettings = z.infer<typeof meetingSettingsSchema>;
export const DEFAULT_MEETING_SETTINGS: MeetingSettings = { ...DEFAULT_BOOKING_SETTINGS, notify_email: "creativecutzzz@gmail.com" };

export async function loadMeetingSettings(supabase: SupabaseClient, orgId: string): Promise<MeetingSettings> {
  const { data } = await supabase.from("agents").select("config").eq("org_id", orgId).eq("key", "meeting_tracker").maybeSingle();
  const parsed = meetingSettingsSchema.safeParse({ ...DEFAULT_MEETING_SETTINGS, ...((data?.config as object) ?? {}) });
  return parsed.success ? parsed.data : DEFAULT_MEETING_SETTINGS;
}

export async function availableSlots(settings: BookingSettings, now = new Date()) {
  const busy = await calendar.freeBusy(now, new Date(now.getTime() + (settings.horizon_days + 1) * 86_400_000));
  return computeSlots(busy, settings, now);
}

export interface BookingLead {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  owner_id: string | null;
}

/** Books `start` for the lead, if that slot is still free. Returns the meeting. */
export async function bookMeeting(supabase: SupabaseClient, input: { orgId: string; lead: BookingLead; start: string; note?: string }) {
  if (!input.lead.email) throw new Error("We need an email address to send the invite.");
  const settings = await loadMeetingSettings(supabase, input.orgId);
  const slot = (await availableSlots(settings)).find((s) => s.start === new Date(input.start).toISOString());
  if (!slot) throw new Error("That time was just taken. Please pick another slot.");

  const company = input.lead.company ?? input.lead.name;
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const event = await calendar.createEvent({
    summary: settings.title.replace(/\{\{\s*company\s*\}\}/g, company).replace(/\{\{\s*name\s*\}\}/g, input.lead.name),
    description: [
      `Intro call with ${input.lead.name}${input.lead.company ? ` (${input.lead.company})` : ""}.`,
      input.note ? `\nThey wrote: ${input.note}` : "",
      site ? `\nCRM: ${site}/leads/${input.lead.id}` : "",
    ].join(""),
    start: new Date(slot.start),
    end: new Date(slot.end),
    attendees: [input.lead.email],
  });

  const { data: meeting, error } = await supabase
    .from("meetings")
    .insert({
      org_id: input.orgId,
      lead_id: input.lead.id,
      calendar_event_id: event.id,
      title: event.summary,
      starts_at: slot.start,
      ends_at: slot.end,
      meet_url: event.meetUrl,
      attendee_email: input.lead.email,
      source: "booking_page",
      status: "scheduled",
    })
    .select("id, starts_at, ends_at, meet_url, title")
    .single();
  if (error) throw new Error(error.message);

  await onMeetingBooked(supabase, input.orgId, input.lead, { id: meeting.id as string, starts_at: slot.start, meet_url: event.meetUrl }, settings.notify_email);
  return { ...meeting, meet_url: event.meetUrl };
}

/** Pipeline effects of a new meeting: stage, stop outreach, prep task, owner alert. */
export async function onMeetingBooked(
  supabase: SupabaseClient,
  orgId: string,
  lead: BookingLead,
  meeting: { id: string; starts_at: string; meet_url: string | null },
  notifyEmail: string,
) {
  const { data: current } = await supabase.from("leads").select("stage, outreach_status").eq("id", lead.id).single();
  const update: Record<string, unknown> = { next_follow_up_at: meeting.starts_at };
  if (current && ["new", "contacted", "qualified"].includes(current.stage as string)) update.stage = "meeting";
  if (current?.outreach_status === "active") update.outreach_status = "replied";
  const when = formatIst(meeting.starts_at);

  await Promise.all([
    supabase.from("leads").update(update).eq("id", lead.id),
    supabase.from("outreach_drafts").update({ status: "cancelled", error: "Meeting booked" }).eq("lead_id", lead.id).eq("kind", "sequence").in("status", ["pending", "approved"]),
    supabase.from("activities").insert({ org_id: orgId, lead_id: lead.id, type: "meeting", body: `Meeting booked for ${when} IST${meeting.meet_url ? ` — ${meeting.meet_url}` : ""}` }),
    supabase.from("tasks").upsert(
      {
        org_id: orgId,
        lead_id: lead.id,
        assignee_id: lead.owner_id,
        title: `Prep for call with ${lead.name} (${when})`,
        description: "Read the research notes, pick 2 portfolio pieces close to their product, open the plans and proposal template (playbook 06). The Call List agent adds talking points on the day.",
        priority: "high",
        due_at: new Date(new Date(meeting.starts_at).getTime() - 3_600_000).toISOString(),
        dedupe_key: `prep:${meeting.id}`,
      },
      { onConflict: "org_id,dedupe_key", ignoreDuplicates: true },
    ),
  ]);

  if (notifyEmail && gmail.isConfigured()) {
    const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
    try {
      await gmail.send({
        to: notifyEmail,
        subject: `📅 Meeting booked: ${lead.name}${lead.company && lead.company !== lead.name ? ` (${lead.company})` : ""} — ${when}`,
        text: `${lead.name} booked a call for ${when} IST.\n${meeting.meet_url ? `Meet: ${meeting.meet_url}\n` : ""}${site ? `Lead: ${site}/leads/${lead.id}\n` : ""}`,
      });
    } catch {
      // A failed alert must not undo the booking.
    }
  }
}
