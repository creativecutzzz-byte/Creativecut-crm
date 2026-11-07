import "server-only";

/**
 * Master switch for outbound messaging.
 *
 * Messages reach WhatsApp / Instagram only when MESSAGING_MODE is exactly
 * "live" *and* the provider's credentials are set. Anything else — unset, a
 * typo, "test" — keeps the CRM in dry-run mode, where sends are previewed and
 * nothing leaves the system. Set MESSAGING_MODE back to "dry-run" (or remove
 * it) to stop all outbound messages immediately.
 */
export function isMessagingLive() {
  return process.env.MESSAGING_MODE === "live";
}

export interface SendResult {
  status: "simulated" | "sent";
  provider: string;
  preview: string;
  externalId: string | null;
  at: string;
}

export function simulated(provider: string, preview: string): SendResult {
  return { status: "simulated", provider, preview, externalId: null, at: new Date().toISOString() };
}

/** Whether the env holds credentials for a provider. Values are never returned or logged. */
export function hasCredentials(...keys: string[]) {
  return keys.every((key) => Boolean(process.env[key]));
}

export function renderTemplate(body: string, vars: Record<string, string>) {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}
