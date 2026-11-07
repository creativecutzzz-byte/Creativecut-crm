import "server-only";

import { createSign } from "node:crypto";

// Google Workspace service account with domain-wide delegation. One access
// token per (user, scope), cached until shortly before it expires.
// Setup: docs/google-workspace-setup.md.

const cache = new Map<string, { token: string; expires: number }>();

export function hasServiceAccount() {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
}

export async function googleAccessToken(subject: string, scope: string) {
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
