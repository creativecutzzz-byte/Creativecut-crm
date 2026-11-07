import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { OAUTH_SCOPES } from "./google";

// "Connect Google" for a plain @gmail.com account: one-time consent that gives
// the CRM a refresh token for sending alerts (gmail.send) and the calendar.

export function oauthClientReady() {
  return Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
}

export function redirectUri(site: string) {
  return `${site.replace(/\/$/, "")}/api/google/callback`;
}

function secret() {
  return process.env.CRON_SECRET || process.env.OUTREACH_SECRET || "";
}

/** State bound to the signed-in user, valid for 15 minutes. */
export function makeState(userId: string) {
  const payload = `${userId}.${Date.now()}`;
  return `${payload}.${createHmac("sha256", secret()).update(`goauth:${payload}`).digest("base64url").slice(0, 32)}`;
}

export function checkState(state: string | null, userId: string) {
  if (!state || !secret()) return false;
  const parts = state.split(".");
  if (parts.length !== 3) return false;
  const [uid, ts, sig] = parts as [string, string, string];
  if (uid !== userId || Date.now() - Number(ts) > 15 * 60_000) return false;
  const expected = createHmac("sha256", secret()).update(`goauth:${uid}.${ts}`).digest("base64url").slice(0, 32);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function consentUrl(site: string, state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
    redirect_uri: redirectUri(site),
    response_type: "code",
    scope: OAUTH_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeCode(site: string, code: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri(site),
      grant_type: "authorization_code",
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as { refresh_token?: string; id_token?: string; scope?: string; error?: string; error_description?: string };
  if (!res.ok) throw new Error(json.error_description || json.error || `HTTP ${res.status}`);
  let email = "";
  if (json.id_token) {
    try {
      email = (JSON.parse(Buffer.from(json.id_token.split(".")[1] ?? "", "base64url").toString("utf8")) as { email?: string }).email ?? "";
    } catch {
      email = "";
    }
  }
  return { refreshToken: json.refresh_token ?? null, email, scopes: json.scope ?? "" };
}
