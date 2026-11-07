import { z } from "zod";

// Booking settings and free-slot calculation. Pure functions, IST-based.

export const bookingSettingsSchema = z.object({
  duration_minutes: z.number().int().min(15).max(120),
  start_hour: z.number().int().min(0).max(23),
  end_hour: z.number().int().min(1).max(24),
  days: z.array(z.number().int().min(0).max(6)).min(1),
  min_notice_hours: z.number().int().min(0).max(168),
  horizon_days: z.number().int().min(1).max(30),
  buffer_minutes: z.number().int().min(0).max(60),
  max_per_day: z.number().int().min(1).max(20),
  title: z.string().min(3).max(120),
});
export type BookingSettings = z.infer<typeof bookingSettingsSchema>;

export const DEFAULT_BOOKING_SETTINGS: BookingSettings = {
  duration_minutes: 30,
  start_hour: 11,
  end_hour: 18,
  days: [1, 2, 3, 4, 5],
  min_notice_hours: 12,
  horizon_days: 10,
  buffer_minutes: 15,
  max_per_day: 4,
  title: "Creative Cut × {{company}} — intro call",
};

const IST = 5.5 * 3_600_000;

export interface Slot {
  start: string;
  end: string;
}

/** Free slots between now+notice and the horizon, avoiding busy intervals (padded by the buffer). */
export function computeSlots(busy: { start: string; end: string }[], s: BookingSettings, now = new Date()): Slot[] {
  const step = s.duration_minutes * 60_000;
  const pad = s.buffer_minutes * 60_000;
  const earliest = now.getTime() + s.min_notice_hours * 3_600_000;
  const blocks = busy.map((b) => [new Date(b.start).getTime() - pad, new Date(b.end).getTime() + pad] as const);
  const out: Slot[] = [];

  const todayIst = new Date(now.getTime() + IST);
  todayIst.setUTCHours(0, 0, 0, 0);
  for (let d = 0; d <= s.horizon_days; d++) {
    const dayStartIst = todayIst.getTime() + d * 86_400_000;
    if (!s.days.includes(new Date(dayStartIst).getUTCDay())) continue;
    let count = 0; // slots offered this day
    for (let t = dayStartIst + s.start_hour * 3_600_000; t + step <= dayStartIst + s.end_hour * 3_600_000; t += step) {
      if (count >= s.max_per_day) break;
      const start = t - IST;
      const end = start + step;
      if (start < earliest) continue;
      if (blocks.some(([a, b]) => start < b && end > a)) continue;
      out.push({ start: new Date(start).toISOString(), end: new Date(end).toISOString() });
      count++;
    }
  }
  return out;
}

export function formatIst(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) {
  return new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", ...opts });
}
