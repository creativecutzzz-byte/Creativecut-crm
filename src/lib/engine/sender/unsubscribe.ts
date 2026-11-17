import { createHmac, timingSafeEqual } from "node:crypto";

// Signed unsubscribe tokens: "<leadId>.<HMAC-SHA256(UNSUB_SECRET, leadId)>" so
// nobody can unsubscribe other people.

function secret() {
  const s = process.env.UNSUB_SECRET;
  if (!s) throw new Error("UNSUB_SECRET is not set.");
  return s;
}

const sign = (leadId: string) => createHmac("sha256", secret()).update(`engine-unsub:${leadId}`).digest("base64url").slice(0, 32);

export const unsubToken = (leadId: string) => `${leadId}.${sign(leadId)}`;

export function verifyUnsubToken(token: string | null | undefined): string | null {
  if (!token || !process.env.UNSUB_SECRET) return null;
  const [leadId, sig] = token.split(".");
  if (!leadId || !sig || !/^\d+$/.test(leadId)) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(leadId));
  return a.length === b.length && timingSafeEqual(a, b) ? leadId : null;
}

export function unsubUrl(leadId: string) {
  const base = (process.env.UNSUB_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  if (!base) throw new Error("Set UNSUB_BASE_URL (or NEXT_PUBLIC_SITE_URL) so emails carry a working unsubscribe link.");
  return `${base}/api/engine/unsubscribe?t=${unsubToken(leadId)}`;
}
