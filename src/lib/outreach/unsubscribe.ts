import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

// Signed one-click unsubscribe links: /api/unsubscribe?t=<leadId>.<signature>

function secret() {
  return process.env.OUTREACH_SECRET || process.env.CRON_SECRET || "";
}

export function unsubscribeToken(leadId: string) {
  return `${leadId}.${createHmac("sha256", secret()).update(`unsub:${leadId}`).digest("base64url").slice(0, 32)}`;
}

export function verifyUnsubscribeToken(token: string | null): string | null {
  if (!token || !secret()) return null;
  const [leadId, sig] = token.split(".");
  if (!leadId || !sig) return null;
  const expected = unsubscribeToken(leadId).split(".")[1]!;
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? leadId : null;
}

export function unsubscribeUrl(siteUrl: string | null, leadId: string) {
  if (!siteUrl || !secret()) return null;
  return `${siteUrl.replace(/\/$/, "")}/api/unsubscribe?t=${unsubscribeToken(leadId)}`;
}
