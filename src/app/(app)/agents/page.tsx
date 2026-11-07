import { AgentCard } from "@/components/agents/agent-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { AGENTS } from "@/lib/agents/registry";
import { DEPARTMENTS, PLANNED_AGENTS } from "@/lib/agents/roadmap";
import { missingRequirements, resolveConfig } from "@/lib/agents/runner";
import { AI_MODEL, isAiConfigured } from "@/lib/ai/claude";
import { getAgentData, getViewer } from "@/lib/data";
import { formatRelative } from "@/lib/utils";
import { Brain } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "AI Agents" };

const plannedBadge = {
  "built-in": { label: "Built in", variant: "success" },
  "phase-2": { label: "Phase 2", variant: "info" },
  "phase-3": { label: "Phase 3", variant: "neutral" },
  "phase-4": { label: "Phase 4", variant: "neutral" },
} as const;

const runVariant = { success: "success", skipped: "warning", error: "danger", running: "neutral" } as const;

export default async function AgentsPage() {
  const [viewer, { rows, runs }] = await Promise.all([getViewer(), getAgentData()]);
  const canEdit = viewer.mode === "live" && (viewer.role === "owner" || viewer.role === "admin");
  const names = new Map(AGENTS.map((a) => [a.key, a.name]));
  const scheduler = Boolean(process.env.CRON_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY);

  return (
    <div className="space-y-6">
      <PageHeader title="AI Agents" description="Automated sales departments. Agents run every morning at 9:00 IST, or whenever you press Run now." />

      <Notice icon={Brain}>
        <strong className="font-medium">AI brain:</strong>{" "}
        {isAiConfigured() ? (
          <>
            Claude connected (<code>{AI_MODEL}</code>).
          </>
        ) : (
          <>
            add <code>ANTHROPIC_API_KEY</code> in your host&apos;s environment variables to turn on qualification and personalisation.
          </>
        )}{" "}
        <strong className="font-medium">Scheduler:</strong> {scheduler ? "daily run configured." : <>set <code>CRON_SECRET</code> and <code>SUPABASE_SERVICE_ROLE_KEY</code> for the daily run.</>}{" "}
        Agents only add and research leads — nothing is sent to anyone.
      </Notice>

      {DEPARTMENTS.map((dept) => {
        const live = AGENTS.filter((a) => a.department === dept.key);
        const planned = PLANNED_AGENTS.filter((p) => p.department === dept.key);
        return (
          <section key={dept.key} className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold">{dept.title}</h2>
              <p className="text-xs text-muted">{dept.blurb}</p>
            </div>
            {live.length > 0 && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {live.map((def) => {
                  const row = rows.find((r) => r.key === def.key);
                  const saved = { ...(row?.config ?? {}) };
                  delete saved.state;
                  return (
                    <AgentCard
                      key={def.key}
                      canEdit={canEdit}
                      agent={{
                        key: def.key,
                        name: def.name,
                        description: def.description,
                        enabled: row?.enabled ?? false,
                        config: resolveConfig(def, saved),
                        configHelp: def.configHelp,
                        missing: [...missingRequirements(def), ...(def.needsAi && !isAiConfigured() && !def.requires.includes("ANTHROPIC_API_KEY") ? ["ANTHROPIC_API_KEY"] : [])],
                        lastRunAt: row?.last_run_at ?? null,
                        lastStatus: row?.last_status ?? null,
                        lastSummary: row?.last_summary ?? null,
                      }}
                    />
                  );
                })}
              </div>
            )}
            {planned.length > 0 && (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {planned.map((p) => (
                  <li key={p.name} className="rounded-xl border border-line bg-surface-2/40 px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-medium">{p.name}</p>
                      <Badge variant={plannedBadge[p.status].variant}>{plannedBadge[p.status].label}</Badge>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-subtle">{p.note}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <Card>
        <CardHeader title="Run log" description="Last 30 agent runs" />
        <ul className="divide-y divide-line px-2 pt-2 pb-2">
          {runs.map((r) => (
            <li key={r.id} className="flex items-start gap-3 px-3 py-2.5">
              <Badge variant={runVariant[r.status]}>{r.status}</Badge>
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  {names.get(r.agent_key) ?? r.agent_key}{" "}
                  <span className="text-[11px] text-subtle">
                    · {r.trigger === "cron" ? "scheduled" : "manual"} · {formatRelative(r.started_at)}
                  </span>
                </p>
                {r.summary && <p className="break-words text-xs text-muted">{r.summary}</p>}
              </div>
              {(r.items_created > 0 || r.items_updated > 0) && (
                <span className="shrink-0 text-[11px] text-subtle">
                  +{r.items_created} new · {r.items_updated} updated
                </span>
              )}
            </li>
          ))}
          {runs.length === 0 && <li className="py-6 text-center text-xs text-subtle">No runs yet. Turn an agent on, or press Run now.</li>}
        </ul>
      </Card>
    </div>
  );
}
