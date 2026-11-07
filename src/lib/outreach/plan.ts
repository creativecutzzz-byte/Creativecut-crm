import { SEQUENCES, type SequenceChannel, type SequenceKey } from "@/lib/sequences";

// The step plan a lead is put on when autopilot starts. Stored on the lead
// (leads.outreach_plan) so later edits to the sequence copy don't shift the
// steps of leads already in progress.

export interface PlanStep {
  day: number;
  channel: SequenceChannel;
  label: string;
  subject?: string;
  body: string;
  /** Instruction for a person, not a message (e.g. "like their latest post"). */
  manual_action?: boolean;
}

export function buildPlan(key: SequenceKey, opts: { whatsappTemplate?: { name: string; body: string } | null }): PlanStep[] {
  const steps: PlanStep[] = SEQUENCES[key].steps.map((s) => ({
    day: s.day,
    channel: s.channel,
    label: s.label,
    subject: s.subject,
    body: s.body,
    manual_action: s.channel === "linkedin" && /no message|like or leave/i.test(`${s.label} ${s.body}`),
  }));
  if (opts.whatsappTemplate) {
    steps.push({ day: 1, channel: "whatsapp", label: `WhatsApp template “${opts.whatsappTemplate.name}”`, body: opts.whatsappTemplate.body });
  }
  return steps.sort((a, b) => a.day - b.day);
}

export const DAY = 86_400_000;

/** Sending window in IST: Mon–Sat, start..end hour. */
export function inSendWindow(now: Date, startHour: number, endHour: number, days: number[]) {
  const ist = new Date(now.getTime() + 5.5 * 3_600_000);
  const hour = ist.getUTCHours();
  return days.includes(ist.getUTCDay()) && hour >= startHour && hour < endHour;
}

/** Start of today in IST, as an ISO timestamp (for daily caps). */
export function istDayStart(now = new Date()) {
  const ist = new Date(now.getTime() + 5.5 * 3_600_000);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - 5.5 * 3_600_000).toISOString();
}

/** Text the sender must not send as-is: unfilled {{vars}} or "[Add …]" reminders. */
export function unresolvedPlaceholders(text: string) {
  return [...text.matchAll(/\{\{\s*\w+\s*\}\}|\[(?:Add|Your)[^\]]*\]/g)].map((m) => m[0]);
}
