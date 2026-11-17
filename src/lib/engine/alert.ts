import { logEvent } from "./db/queries";

// Posts to ALERT_WEBHOOK_URL (Slack incoming webhook or anything accepting {"text": ...}).
export async function alert(text: string, payload: Record<string, unknown> = {}) {
  await logEvent("alert", { text, ...payload });
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `[Outreach engine] ${text}` }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // Alert delivery failures are already recorded in events.
  }
}
