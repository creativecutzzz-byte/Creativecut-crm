// Schedule wording and next-run calculation. Pure functions, shared by the
// server (Cloud Scheduler sync) and the browser (live preview before saving).
// All times are Asia/Kolkata (IST, UTC+5:30, no daylight saving).

import { WEEKDAYS, type Schedule, type Weekday } from "./types";

const IST_OFFSET_MIN = 330;

export function parseTime(t: string): { h: number; m: number } | null {
  const m = /^\s*([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?\s*$/.exec(t || "");
  return m ? { h: Number(m[1]), m: Number(m[2]) } : null;
}

export function formatTime(t: string): string {
  const p = parseTime(t);
  if (!p) return t;
  const h12 = p.h % 12 === 0 ? 12 : p.h % 12;
  return `${h12}:${String(p.m).padStart(2, "0")} ${p.h < 12 ? "AM" : "PM"}`;
}

function joinList(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const DAY_NAMES: Record<Weekday, string> = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };

export function describeDays(days: Weekday[]): string {
  const set = WEEKDAYS.filter((d) => days.includes(d));
  if (set.length === 7) return "Every day";
  if (set.length === 5 && !set.includes("Sat") && !set.includes("Sun")) return "Every weekday";
  if (set.length === 2 && set.includes("Sat") && set.includes("Sun")) return "Every weekend";
  if (set.length === 1) return `Every ${DAY_NAMES[set[0]!]}`;
  if (set.length === 0) return "No days selected";
  return `Every ${joinList(set)}`;
}

/** "Every day at 9:00 AM IST" — the one line shown on the Schedule page. */
export function describeSchedule(s: Schedule): string {
  const times = sortTimes(s.times);
  const recurring = times.length && s.days.length ? `${describeDays(s.days)} at ${joinList(times.map(formatTime))} IST` : "";
  const once = s.oneTime ? `Once on ${formatDateTime(oneTimeToDate(s.oneTime))}` : "";
  const text = [recurring, once].filter(Boolean).join(", plus ") || "No runs scheduled";
  return s.paused ? `Paused — ${text.charAt(0).toLowerCase()}${text.slice(1)}` : text;
}

export function describeWindow(s: Schedule): string | null {
  if (!s.sendWindow) return null;
  return `Emails only go out between ${formatTime(s.sendWindow.start)} and ${formatTime(s.sendWindow.end)} IST`;
}

export function sortTimes(times: string[]) {
  return [...new Set(times.filter((t) => parseTime(t)))].sort((a, b) => toMin(a) - toMin(b));
}

function toMin(t: string) {
  const p = parseTime(t)!;
  return p.h * 60 + p.m;
}

/** IST wall-clock parts for a UTC instant. */
export function istParts(d: Date) {
  const shifted = new Date(d.getTime() + IST_OFFSET_MIN * 60_000);
  return { y: shifted.getUTCFullYear(), mo: shifted.getUTCMonth(), d: shifted.getUTCDate(), dow: shifted.getUTCDay(), h: shifted.getUTCHours(), m: shifted.getUTCMinutes() };
}

/** UTC instant for an IST wall-clock time. */
export function istToDate(y: number, mo: number, d: number, h: number, m: number) {
  return new Date(Date.UTC(y, mo, d, h, m) - IST_OFFSET_MIN * 60_000);
}

export function oneTimeToDate(v: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/.exec(v);
  if (!m) return new Date(NaN);
  return istToDate(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
}

const DOW_INDEX: Record<Weekday, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Next `count` "Start research" times after `now`. Empty when paused. */
export function nextRuns(s: Schedule, now: Date, count = 3): Date[] {
  if (s.paused) return [];
  const out: Date[] = [];
  const times = sortTimes(s.times);
  const days = new Set(s.days.map((d) => DOW_INDEX[d]));
  const start = istParts(now);
  for (let i = 0; i < 15 && times.length && days.size; i++) {
    const base = istToDate(start.y, start.mo, start.d + i, 12, 0);
    const p = istParts(base);
    if (!days.has(p.dow)) continue;
    for (const t of times) {
      const { h, m } = parseTime(t)!;
      const at = istToDate(p.y, p.mo, p.d, h, m);
      if (at.getTime() > now.getTime()) out.push(at);
    }
  }
  if (s.oneTime) {
    const once = oneTimeToDate(s.oneTime);
    if (!Number.isNaN(once.getTime()) && once.getTime() > now.getTime()) out.push(once);
  }
  return out.sort((a, b) => a.getTime() - b.getTime()).slice(0, count);
}

/** "today at 4:00 PM", "tomorrow at 9:00 AM", "Thu 27 Nov at 9:00 AM" (IST). */
export function formatRelative(d: Date, now: Date): string {
  const a = istParts(d);
  const b = istParts(now);
  const dayDiff = Math.round((Date.UTC(a.y, a.mo, a.d) - Date.UTC(b.y, b.mo, b.d)) / 86_400_000);
  const time = formatTime(`${a.h}:${String(a.m).padStart(2, "0")}`);
  if (dayDiff === 0) return `today at ${time}`;
  if (dayDiff === 1) return `tomorrow at ${time}`;
  return `${formatDateTime(d, false)} at ${time}`;
}

export function formatDateTime(d: Date, withTime = true): string {
  if (Number.isNaN(d.getTime())) return "—";
  const p = istParts(d);
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][p.dow];
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][p.mo];
  const date = `${wd} ${p.d} ${mon}`;
  return withTime ? `${date}, ${formatTime(`${p.h}:${String(p.m).padStart(2, "0")}`)} IST` : date;
}

/** Validation message for the Customize form, or null when the schedule is valid. */
export function validateSchedule(s: Schedule, now: Date): string | null {
  if (s.times.some((t) => !parseTime(t))) return "Use times like 09:00 or 16:30.";
  if (s.times.length > 6) return "Up to 6 start times per day.";
  if (s.times.length && !s.days.length) return "Pick at least one day.";
  if (s.oneTime) {
    const d = oneTimeToDate(s.oneTime);
    if (Number.isNaN(d.getTime())) return "Pick a date and time for the one-time run.";
    if (d.getTime() <= now.getTime()) return "The one-time run must be in the future.";
  }
  if (s.sendWindow) {
    const a = parseTime(s.sendWindow.start);
    const b = parseTime(s.sendWindow.end);
    if (!a || !b) return "Use times like 09:00 for the send window.";
    if (a.h * 60 + a.m >= b.h * 60 + b.m) return "The send window must end after it starts.";
  }
  if (!s.times.length && !s.oneTime) return "Add at least one start time.";
  return null;
}

/** Cloud Scheduler cron lines for this schedule (one job per time + the one-time run). */
export function cronJobs(s: Schedule): { id: string; cron: string }[] {
  const dows = WEEKDAYS.filter((d) => s.days.includes(d)).map((d) => DOW_INDEX[d]).join(",");
  const jobs = sortTimes(s.times).map((t) => {
    const { h, m } = parseTime(t)!;
    return { id: `t${String(h).padStart(2, "0")}${String(m).padStart(2, "0")}`, cron: `${m} ${h} * * ${s.days.length === 7 ? "*" : dows}` };
  });
  if (s.oneTime) {
    const p = istParts(oneTimeToDate(s.oneTime));
    jobs.push({ id: "once", cron: `${p.m} ${p.h} ${p.d} ${p.mo + 1} *` });
  }
  return jobs;
}
