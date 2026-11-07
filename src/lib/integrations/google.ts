import "server-only";

import { createSign } from "node:crypto";

// Two ways to reach Google:
// 1. Google Workspace service account with domain-wide delegation (any user in
//    the Workspace). Setup: docs/google-workspace-setup.md.
// 2. A connected Google account (works with a plain @gmail.com): OAuth refresh
//    token from Settings → Connect Google. Setup: docs/google-gmail-setup.md.
// Access tokens are cached until shortly before they expire.

const cache = new Map<string, { token: string; expires: number }>();

export function hasServiceAccount() {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
}

/** A Google account connected with OAuth (refresh token in env). */
export function hasOAuthAccount() {
  return Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET && process.env.GOOGLE_OAUTH_REFRESH_TOKEN);
}

export function hasGoogleAccess() {
  return hasServiceAccount() || hasOAuthAccount();
}

/** The connected account's address (OAuth), used as the default sender / calendar. */
export function oauthEmail() {
  return process.env.GOOGLE_OAUTH_EMAIL ?? "";
}

export async function googleAccessToken(subject: string, scope: string) {
  if (!hasServiceAccount() && hasOAuthAccount()) return oauthAccessToken();
  const key = `${subject}|${scope}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now() + 60_000) return hit.token;

  const now = Math.floor(Date.now() / 1000);
  const claims = { iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, sub: subject, scope, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 };
  const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify(claims))}`;
  // Env vars often store the PEM with literal "\n".
  const pem = (process.env.GOOGLE_SERVICE_ACCOUNT_KEY ?? "").replace(/\\n/g, "\n");
  const signature = createSign("RSA-SHA256").update(unsigned).sign(pem);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${b64url(signature)}` }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(`Google sign-in failed for ${subject}: ${json.error_description || json.error || `HTTP ${res.status}`}. Check domain-wide delegation for ${scope}.`);
  }
  cache.set(key, { token: json.access_token, expires: Date.now() + (json.expires_in ?? 3600) * 1000 });
  return json.access_token;
}

export function b64url(input: string | Buffer) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function oauthAccessToken() {
  const hit = cache.get("oauth");
  if (hit && hit.expires > Date.now() + 60_000) return hit.token;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN ?? "",
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(`Google sign-in failed: ${json.error_description || json.error || `HTTP ${res.status}`}. Reconnect Google in Settings.`);
  }
  cache.set("oauth", { token: json.access_token, expires: Date.now() + (json.expires_in ?? 3600) * 1000 });
  return json.access_token;
}

export const OAUTH_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar",
];
