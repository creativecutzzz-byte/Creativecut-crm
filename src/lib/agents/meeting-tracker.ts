import "server-only";

import { calendar } from "@/lib/integrations/calendar";
import { DEFAULT_MEETING_SETTINGS, meetingSettingsSchema, onMeetingBooked, type MeetingSettings } from "@/lib/meetings/book";
import { formatIst } from "@/lib/meetings/slots";
import { defineAgent } from "./types";

// Meeting Tracker: keeps the CRM in step with the Google Calendar.
// - Any event with a lead as a guest (booked through the CRM, Google's own
//   appointment page, or sent by hand) becomes a meeting: stage → Meeting
//   booked, outreach stops, a prep task is created.
// - Cancelled events are flagged with a "rebook" task.
// - Finished meetings get a "log the outcome" task (Held / No-show / Not a fit
//   on the lead page).
// Its settings also control the booking page (hours, length, notice).

export const meetingTrackerAgent = defineAgent<MeetingSettings>({
  key: "meeting_tracker",
  name: "Meeting Tracker & Booking",
  department: "sales_calling",
  description: "Runs the booking page on your Google Calendar and syncs every meeting with a lead: stage moves to Meeting booked, outreach stops, prep and outcome tasks appear.",
  requires: ["GOOGLE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_SERVICE_ACCOUNT_KEY", "GOOGLE_CALENDAR_USER"],
  needsAi: false,
  minIntervalHours: 0,
  configSchema: meetingSettingsSchema,
  defaultConfig: DEFAULT_MEETING_SETTINGS,
  configHelp:
    "Booking page: duration_minutes, start_hour/end_hour (IST), days (0=Sun…6=Sat), min_notice_hours, horizon_days, buffer_minutes around existing events, max_per_day slots offered, title ({{company}}, {{name}}). notify_email: who gets the \"meeting booked\" email.",

  async run(ctx, cfg) {
    const now = new Date();
    const lastSync = typeof ctx.state.last_sync === "string" ? new Date(ctx.state.last_sync) : null;
    const events = await calendar.listEvents({
      timeMin: new Date(now.getTime() - 3 * 86_400_000),
      timeMax: new Date(now.getTime() + 60 * 86_400_000),
      updatedMin: lastSync ? new Date(lastSync.getTime() - 10 * 60_000) : undefined,
    });

    const ownDomains = new Set([calendar.user(), process.env.GMAIL_SENDER ?? ""].map((e) => e.split("@")[1]?.toLowerCase()).filter(Boolean));
    let created = 0;
    let updated = 0;
    let cancelled = 0;

    for (const event of events) {
      const { data: existing } = await ctx.supabase.from("meetings").select("id, lead_id, status, starts_at").eq("org_id", ctx.orgId).eq("calendar_event_id", event.id).maybeSingle();

      if (event.status === "cancelled") {
        if (existing && existing.status === "scheduled") {
          await ctx.supabase.from("meetings").update({ status: "cancelled" }).eq("id", existing.id);
          if (existing.lead_id) {
            await ctx.supabase.from("activities").insert({ org_id: ctx.orgId, lead_id: existing.lead_id, type: "meeting", body: `Meeting on ${formatIst(existing.starts_at as string)} was cancelled` });
            await ctx.supabase.from("tasks").upsert(
              { org_id: ctx.orgId, lead_id: existing.lead_id, assignee_id: ctx.ownerId, title: "Meeting cancelled — offer new times", priority: "high", due_at: new Date(now.getTime() + 2 * 3_600_000).toISOString(), dedupe_key: `cancelled:${existing.id}` },
              { onConflict: "org_id,dedupe_key", ignoreDuplicates: true },
            );
          }
          cancelled++;
        }
        continue;
      }

      if (existing) {
        await ctx.supabase.from("meetings").update({ starts_at: event.start, ends_at: event.end, meet_url: event.meetUrl, title: event.summary }).eq("id", existing.id);
        updated++;
        continue;
      }

      // New event: does a lead attend?
      const guests = event.attendees
        .filter((a) => !a.self && !a.organizer && a.responseStatus !== "declined")
        .map((a) => a.email.toLowerCase())
        .filter((e) => !ownDomains.has(e.split("@")[1] ?? ""));
      if (!guests.length) continue;
      const { data: leads } = await ctx.supabase.from("leads").select("id, name, company, email, owner_id, stage").eq("org_id", ctx.orgId).in("email", guests).limit(1);
      const lead = leads?.[0];
      if (!lead) continue;

      const { data: meeting } = await ctx.supabase
        .from("meetings")
        .insert({ org_id: ctx.orgId, lead_id: lead.id, calendar_event_id: event.id, title: event.summary, starts_at: event.start, ends_at: event.end, meet_url: event.meetUrl, attendee_email: lead.email, source: "calendar", status: "scheduled" })
        .select("id")
        .single();
      if (meeting && new Date(event.end).getTime() > now.getTime()) {
        await onMeetingBooked(ctx.supabase, ctx.orgId, { id: lead.id as string, name: lead.name as string, company: lead.company as string | null, email: lead.email as string, owner_id: lead.owner_id as string | null }, { id: meeting.id as string, starts_at: event.start, meet_url: event.meetUrl }, cfg.notify_email);
      }
      created++;
    }

    // Finished meetings → "log the outcome".
    const { data: finished } = await ctx.supabase
      .from("meetings")
      .select("id, lead_id, title, starts_at")
      .eq("org_id", ctx.orgId)
      .eq("status", "scheduled")
      .lt("ends_at", new Date(now.getTime() - 15 * 60_000).toISOString())
      .not("lead_id", "is", null)
      .limit(50);
    for (const m of finished ?? []) {
      await ctx.supabase.from("tasks").upsert(
        {
          org_id: ctx.orgId,
          lead_id: m.lead_id,
          assignee_id: ctx.ownerId,
          title: `Log the outcome of your call (${formatIst(m.starts_at as string)})`,
          description: "On the lead page: Held → Proposal starts the proposal follow-ups; No-show starts the reschedule email; Not a fit closes the lead.",
          priority: "high",
          due_at: now.toISOString(),
          dedupe_key: `outcome:${m.id}`,
        },
        { onConflict: "org_id,dedupe_key", ignoreDuplicates: true },
      );
    }

    return {
      status: "success",
      summary: `Calendar synced: ${created} new meeting${created === 1 ? "" : "s"} with leads, ${updated} updated, ${cancelled} cancelled; ${finished?.length ?? 0} waiting for an outcome.`,
      created,
      updated,
      state: { last_sync: now.toISOString() },
    };
  },
});
