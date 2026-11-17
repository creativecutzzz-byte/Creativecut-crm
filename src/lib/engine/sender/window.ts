// Recipient-local send window and business-day scheduling. Pure — covered by tests.

export const windowHours = () => ({
  start: Number(process.env.SEND_WINDOW_START ?? 8),
  end: Number(process.env.SEND_WINDOW_END ?? 11),
});

/** Weekday (1 = Mon .. 7 = Sun) and fractional hour of `at` in `timeZone`. */
export function localTime(at: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday")) + 1;
  return { weekday, hour: Number(get("hour")) + Number(get("minute")) / 60 };
}

/** True Monday-Friday between start (inclusive) and end (exclusive) o'clock in the recipient's time zone. */
export function inSendWindow(at: Date, timeZone: string, hours = windowHours()) {
  let local: ReturnType<typeof localTime>;
  try {
    local = localTime(at, timeZone);
  } catch {
    local = localTime(at, "UTC");
  }
  return local.weekday >= 1 && local.weekday <= 5 && local.hour >= hours.start && local.hour < hours.end;
}

/** `days` business days after `from` (skips Saturday and Sunday, UTC calendar). */
export function addBusinessDays(from: Date, days: number) {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) left--;
  }
  return d;
}

/** Follow-up spacing: step 2 is 3 business days after step 1, step 3 about 5 after step 2. */
export const FOLLOW_UP_GAP_DAYS: Record<number, number> = { 1: 3, 2: 5 };
