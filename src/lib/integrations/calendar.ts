import "server-only";

import { googleAccessToken, hasGoogleAccess, hasOAuthAccount, oauthEmail } from "./google";

// Google Calendar for the meeting calendar: the connected Google account, or
// GOOGLE_CALENDAR_USER through the Workspace service account.
// Scope: https://www.googleapis.com/auth/calendar (events + free/busy).

const SCOPE = "https://www.googleapis.com/auth/calendar";
const API = "https://www.googleapis.com/calendar/v3";

export interface CalendarEvent {
  id: string;
  status: "confirmed" | "tentative" | "cancelled";
  summary: string;
  start: string;
  end: string;
  meetUrl: string | null;
  htmlLink: string | null;
  attendees: { email: string; responseStatus?: string; self?: boolean; organizer?: boolean }[];
}

export const calendar = {
  isConfigured() {
    return hasGoogleAccess() && Boolean(calendarUser());
  },

  user() {
    return calendarUser();
  },

  /** Busy intervals on the meeting calendar. */
  async freeBusy(timeMin: Date, timeMax: Date): Promise<{ start: string; end: string }[]> {
    const res = await api<{ calendars?: Record<string, { busy?: { start: string; end: string }[] }> }>("freeBusy", {
      method: "POST",
      body: { timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(), timeZone: "Asia/Kolkata", items: [{ id: "primary" }] },
    });
    return Object.values(res.calendars ?? {}).flatMap((c) => c.busy ?? []);
  },

  /** Creates an event with a Google Meet link and emails the invite to attendees. */
  async createEvent(input: { summary: string; description: string; start: Date; end: Date; attendees: string[] }): Promise<CalendarEvent> {
    const event = await api<RawEvent>("calendars/primary/events?conferenceDataVersion=1&sendUpdates=all", {
      method: "POST",
      body: {
        summary: input.summary,
        description: input.description,
        start: { dateTime: input.start.toISOString(), timeZone: "Asia/Kolkata" },
        end: { dateTime: input.end.toISOString(), timeZone: "Asia/Kolkata" },
        attendees: input.attendees.map((email) => ({ email })),
        conferenceData: { createRequest: { requestId: `cc-${input.start.getTime()}-${Math.random().toString(36).slice(2, 10)}`, conferenceSolutionKey: { type: "hangoutsMeet" } } },
        reminders: { useDefault: true },
      },
    });
    return normalize(event);
  },

  /** Events (including cancelled ones) changed since `updatedMin`, within a time range. */
  async listEvents(input: { timeMin: Date; timeMax: Date; updatedMin?: Date }): Promise<CalendarEvent[]> {
    const params = new URLSearchParams({
      timeMin: input.timeMin.toISOString(),
      timeMax: input.timeMax.toISOString(),
      singleEvents: "true",
      showDeleted: "true",
      maxResults: "250",
      orderBy: "startTime",
    });
    if (input.updatedMin) params.set("updatedMin", input.updatedMin.toISOString());
    const res = await api<{ items?: RawEvent[] }>(`calendars/primary/events?${params}`);
    return (res.items ?? []).filter((e) => e.start?.dateTime).map(normalize);
  },
};

function calendarUser() {
  if (hasOAuthAccount()) return oauthEmail() || process.env.GOOGLE_CALENDAR_USER || "";
  return process.env.GOOGLE_CALENDAR_USER || process.env.GMAIL_SENDER || "";
}

interface RawEvent {
  id: string;
  status?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  hangoutLink?: string;
  htmlLink?: string;
  conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
  attendees?: { email: string; responseStatus?: string; self?: boolean; organizer?: boolean }[];
}

function normalize(e: RawEvent): CalendarEvent {
  return {
    id: e.id,
    status: (e.status as CalendarEvent["status"]) ?? "confirmed",
    summary: e.summary ?? "(no title)",
    start: e.start?.dateTime ?? e.start?.date ?? "",
    end: e.end?.dateTime ?? e.end?.date ?? "",
    meetUrl: e.hangoutLink ?? e.conferenceData?.entryPoints?.find((p) => p.entryPointType === "video")?.uri ?? null,
    htmlLink: e.htmlLink ?? null,
    attendees: e.attendees ?? [],
  };
}

async function api<T>(path: string, init?: { method?: "GET" | "POST"; body?: unknown }): Promise<T> {
  const token = await googleAccessToken(calendarUser(), SCOPE);
  const res = await fetch(`${API}/${path}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Bearer ${token}`, ...(init?.body ? { "Content-Type": "application/json" } : {}) },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(`Google Calendar: ${json.error?.message ?? `HTTP ${res.status}`}`);
  return json;
}
