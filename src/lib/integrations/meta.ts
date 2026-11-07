import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

// Shared helpers for Meta's Graph APIs (WhatsApp Cloud API, Instagram Messaging).

export const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v23.0";

export class MetaApiError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message);
  }
}

/** POST/GET to a Graph API host with a bearer token. Never logs the token. */
export async function graphRequest<T>(host: "graph.facebook.com" | "graph.instagram.com", path: string, token: string, init?: { method?: "GET" | "POST"; body?: unknown }): Promise<T> {
  const response = await fetch(`https://${host}/${GRAPH_VERSION}/${path}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Bearer ${token}`, ...(init?.body ? { "Content-Type": "application/json" } : {}) },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await response.json().catch(() => ({}))) as T & { error?: { message?: string; code?: number; error_user_msg?: string } };
  if (!response.ok || json.error) {
    const err = json.error;
    throw new MetaApiError(err?.error_user_msg || err?.message || `Meta API error (HTTP ${response.status})`, err?.code);
  }
  return json;
}

/**
 * Verifies Meta's X-Hub-Signature-256 header (HMAC-SHA256 of the raw body).
 * Accepts any of the configured app secrets: the Meta app secret and, for
 * Instagram API with Instagram Login, the Instagram app secret.
 */
export function verifySignature(rawBody: string, header: string | null) {
  if (!header?.startsWith("sha256=")) return false;
  const received = Buffer.from(header.slice("sha256=".length), "hex");
  const secrets = [process.env.META_APP_SECRET, process.env.INSTAGRAM_APP_SECRET].filter((s): s is string => Boolean(s));
  return secrets.some((secret) => {
    const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest();
    return expected.length === received.length && timingSafeEqual(expected, received);
  });
}
