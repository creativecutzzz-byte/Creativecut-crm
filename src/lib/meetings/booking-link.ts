import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

// Personal booking links: /book?t=<leadId>.<signature>. The lead is known, so
// they only pick a time. Generic links use the workspace key: /book?w=<slug>.

function secret() {
  return process.env.OUTREACH_SECRET || process.env.CRON_SECRET || "";
}

function sign(leadId: string) {
  return createHmac("sha256", secret()).update(`book:${leadId}`).digest("base64url").slice(0, 24);
}

export function bookingToken(leadId: string) {
  return `${leadId}.${sign(leadId)}`;
}

export function verifyBookingToken(token: string | null | undefined): string | null {
  if (!token || !secret()) return null;
  const [leadId, sig] = token.split(".");
  if (!leadId || !sig) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(leadId));
  return a.length === b.length && timingSafeEqual(a, b) ? leadId : null;
}

/** Personal booking URL, or null when the CRM booking page can't be used (no site URL / secret / calendar). */
export function personalBookingUrl(leadId: string) {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const calendarReady = Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_KEY && (process.env.GOOGLE_CALENDAR_USER || process.env.GMAIL_SENDER));
  if (!site || !secret() || !calendarReady) return null;
  return `${site}/book?t=${bookingToken(leadId)}`;
}
