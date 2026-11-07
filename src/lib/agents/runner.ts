import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isAiConfigured } from "@/lib/ai/claude";
import { AGENTS, getAgentDefinition } from "./registry";
import type { AgentDefinition } from "./types";

// Orchestrator: runs one agent (or every enabled agent) for a workspace and
// records each run in agent_runs. The cron route uses the service-role client;
// "Run now" uses the signed-in admin's client, so RLS still applies.

export interface RunOutcome {
  key: string;
  status: "success" | "skipped" | "error";
  summary: string;
}

interface AgentRow {
  key: string;
  enabled: boolean;
  config: Record<string, unknown>;
}

/** Effective config: saved values over defaults; invalid saved config falls back to defaults. */
export function resolveConfig(def: AgentDefinition, saved: Record<string, unknown> | null | undefined) {
  const rest = { ...(saved ?? {}) };
  delete rest.state;
  const merged = { ...def.defaultConfig, ...rest };
  const parsed = def.configSchema.safeParse(merged);
  return parsed.success ? (parsed.data as Record<string, unknown>) : def.defaultConfig;
}

export function missingRequirements(def: AgentDefinition) {
  return def.requires.filter((k) => !process.env[k]);
}

export async function runAgent(supabase: SupabaseClient, orgId: string, key: string, trigger: "cron" | "manual", startedBy: string | null = null): Promise<RunOutcome> {
  const def = getAgentDefinition(key);
  if (!def) return { key, status: "error", summary: `Unknown agent "${key}"` };

  const [{ data: row }, { data: owner }] = await Promise.all([
    supabase.from("agents").select("key, enabled, config").eq("org_id", orgId).eq("key", key).maybeSingle<AgentRow>(),
    supabase.from("team_members").select("user_id").eq("org_id", orgId).eq("role", "owner").eq("status", "active").order("created_at").limit(1).maybeSingle(),
  ]);
  const savedConfig = row?.config ?? {};
  const config = resolveConfig(def, savedConfig);
  const state = (savedConfig.state as Record<string, unknown> | undefined) ?? {};

  const { data: run } = await supabase
    .from("agent_runs")
    .insert({ org_id: orgId, agent_key: key, trigger, status: "running", started_by: startedBy })
    .select("id")
    .single();

  let outcome: RunOutcome;
  let created = 0;
  let updated = 0;
  let error: string | null = null;
  let nextState = state;

  const missing = missingRequirements(def);
  if (missing.length > 0) {
    outcome = { key, status: "skipped", summary: `Missing server settings: ${missing.join(", ")}` };
  } else if (def.needsAi && !isAiConfigured()) {
    outcome = { key, status: "skipped", summary: process.env.ANTHROPIC_API_KEY ? "AI is switched off (AI_ENABLED=false)" : "Needs ANTHROPIC_API_KEY" };
  } else {
    try {
      const result = await def.run({ supabase, orgId, ownerId: (owner?.user_id as string | undefined) ?? null, state }, config);
      created = result.created;
      updated = result.updated;
      nextState = result.state ?? state;
      outcome = { key, status: result.status, summary: result.summary };
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      outcome = { key, status: "error", summary: error.slice(0, 300) };
    }
  }

  const finishedAt = new Date().toISOString();
  await Promise.all([
    run
      ? supabase.from("agent_runs").update({ status: outcome.status, summary: outcome.summary, items_created: created, items_updated: updated, error, finished_at: finishedAt }).eq("id", run.id)
      : Promise.resolve(),
    supabase.from("agents").upsert(
      {
        org_id: orgId,
        key,
        enabled: row?.enabled ?? false,
        config: { ...savedConfig, state: nextState },
        last_run_at: finishedAt,
        last_status: outcome.status,
        last_summary: outcome.summary,
      },
      { onConflict: "org_id,key" },
    ),
  ]);
  return outcome;
}

/** Every enabled agent in every workspace, sources before enrichment. */
export async function runScheduled(supabase: SupabaseClient) {
  const { data: rows, error } = await supabase.from("agents").select("org_id, key, last_run_at").eq("enabled", true);
  if (error) throw new Error(error.message);
  const order = new Map(AGENTS.map((a, i) => [a.key, i]));
  const byOrg = new Map<string, string[]>();
  const now = Date.now();
  const due = (rows ?? []).filter((r) => {
    const interval = getAgentDefinition(r.key as string)?.minIntervalHours ?? 20;
    return !r.last_run_at || now - new Date(r.last_run_at as string).getTime() >= interval * 3_600_000 - 5 * 60_000;
  });
  for (const r of due) byOrg.set(r.org_id as string, [...(byOrg.get(r.org_id as string) ?? []), r.key as string]);

  const results: (RunOutcome & { orgId: string })[] = [];
  for (const [orgId, keys] of byOrg) {
    for (const key of keys.sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99))) {
      results.push({ orgId, ...(await runAgent(supabase, orgId, key, "cron")) });
    }
  }
  return results;
}
