import "server-only";

import type { ApiProvider } from "./types";

// Checks a pasted API key against the provider before saving it, and reads the
// balance or usage where the provider's API reports one. Free calls only.

export interface KeyCheck {
  ok: boolean;
  usage: string | null;
  error: string | null;
}

async function call(url: string, init: RequestInit): Promise<{ status: number; json: Record<string, unknown> }> {
  try {
    const res = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(15_000) });
    return { status: res.status, json: (await res.json().catch(() => ({}))) as Record<string, unknown> };
  } catch {
    return { status: 0, json: {} };
  }
}

export async function checkKey(provider: ApiProvider, key: string): Promise<KeyCheck> {
  if (provider === "web_research") {
    // Apify: account limits and this month's usage.
    const r = await call("https://api.apify.com/v2/users/me/limits", { headers: { Authorization: `Bearer ${key}` } });
    if (r.status !== 200) return { ok: false, usage: null, error: r.status === 401 ? "Apify rejected this key." : `Couldn't reach Apify (HTTP ${r.status}).` };
    const d = (r.json.data ?? {}) as { current?: { monthlyUsageUsd?: number }; limits?: { maxMonthlyUsageUsd?: number } };
    const used = d.current?.monthlyUsageUsd ?? 0;
    const max = d.limits?.maxMonthlyUsageUsd ?? 0;
    return { ok: true, usage: `$${used.toFixed(2)} of $${max.toFixed(2)} used this month`, error: null };
  }
  if (provider === "apollo") {
    // People search is free on Apollo; one result is enough to prove the key works.
    const r = await call("https://api.apollo.io/api/v1/mixed_people/api_search?per_page=1&page=1", { method: "POST", headers: { "x-api-key": key, "Content-Type": "application/json", "Cache-Control": "no-cache" } });
    if (r.status === 200) return { ok: true, usage: null, error: null };
    return { ok: false, usage: null, error: r.status === 401 || r.status === 403 ? "Apollo rejected this key, or it doesn't have API search access." : `Couldn't reach Apollo (HTTP ${r.status}).` };
  }
  // Vibe Prospecting → Explorium AgentSource API (GET /v2/credits, api_key header).
  const r = await call("https://api.explorium.ai/v2/credits", { headers: { api_key: key } });
  if (r.status !== 200) return { ok: false, usage: null, error: r.status === 401 || r.status === 403 ? "Explorium rejected this key." : `Couldn't reach Explorium (HTTP ${r.status}).` };
  const remaining = Number(r.json.remaining_credits ?? NaN);
  const allocated = Number(r.json.allocated_credits ?? NaN);
  return { ok: true, usage: Number.isFinite(remaining) ? `${remaining} of ${Number.isFinite(allocated) ? allocated : "?"} credits left` : null, error: null };
}

export const SECRET_NAME: Record<ApiProvider, string> = { web_research: "APIFY_TOKEN", apollo: "APOLLO_API_KEY", vibe: "EXPLORIUM_API_KEY" };
