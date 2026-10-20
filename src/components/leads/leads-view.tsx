"use client";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { ScorePill } from "@/components/ui/score-pill";
import { LEAD_SOURCES, LEAD_STAGES, OPEN_STAGES } from "@/lib/constants";
import type { Lead, LeadSource, LeadStage } from "@/lib/types";
import { cn, formatCurrency, formatRelative } from "@/lib/utils";
import { memberByUserId } from "@/lib/team";
import { Kanban, List, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { NewLeadDialog } from "./new-lead-dialog";

type QuickFilter = "all" | "open" | "overdue" | "unassigned" | "hot";

export function LeadsView({
  leads,
  team,
  initialFilter,
  openNew,
  now,
}: {
  leads: Lead[];
  team: { user_id: string | null; full_name: string }[];
  initialFilter?: QuickFilter;
  openNew?: boolean;
  now: number;
}) {
  const [view, setView] = useState<"table" | "board">("table");
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<LeadStage | "all">("all");
  const [source, setSource] = useState<LeadSource | "all">("all");
  const [quick, setQuick] = useState<QuickFilter>(initialFilter ?? "open");
  const [dialogOpen, setDialogOpen] = useState(Boolean(openNew));

  const ownerName = (id: string | null) => memberByUserId(team, id)?.full_name;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      if (q && ![l.name, l.company, l.email, l.instagram_handle].some((v) => v?.toLowerCase().includes(q))) return false;
      if (stage !== "all" && l.stage !== stage) return false;
      if (source !== "all" && l.source !== source) return false;
      const isOpen = OPEN_STAGES.includes(l.stage);
      switch (quick) {
        case "open":
          return isOpen;
        case "overdue":
          return isOpen && !!l.next_follow_up_at && new Date(l.next_follow_up_at).getTime() < now;
        case "unassigned":
          return isOpen && !l.owner_id;
        case "hot":
          return isOpen && (l.ai_score ?? 0) >= 75;
        default:
          return true;
      }
    });
  }, [leads, query, stage, source, quick, now]);

  const quickFilters: { id: QuickFilter; label: string }[] = [
    { id: "open", label: "Open" },
    { id: "hot", label: "Hot" },
    { id: "overdue", label: "Overdue" },
    { id: "unassigned", label: "Unassigned" },
    { id: "all", label: "All" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-line bg-surface p-1">
          {quickFilters.map((f) => (
            <button
              key={f.id}
              onClick={() => setQuick(f.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                quick === f.id ? "bg-white/[0.08] text-fg" : "text-muted hover:text-fg",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search leads" className="pl-9" aria-label="Search leads" />
          </div>
          <div className="flex gap-2">
            <Select value={stage} onChange={(e) => setStage(e.target.value as LeadStage | "all")} aria-label="Filter by stage" className="sm:w-36">
              <option value="all">All stages</option>
              {LEAD_STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
            <Select value={source} onChange={(e) => setSource(e.target.value as LeadSource | "all")} aria-label="Filter by source" className="sm:w-36">
              <option value="all">All sources</option>
              {Object.entries(LEAD_SOURCES).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex gap-2">
            <div className="flex rounded-lg border border-line bg-surface p-0.5">
              <button onClick={() => setView("table")} aria-label="Table view" className={cn("grid size-8 place-items-center rounded-md", view === "table" ? "bg-white/[0.08] text-fg" : "text-subtle hover:text-fg")}>
                <List className="size-4" />
              </button>
              <button onClick={() => setView("board")} aria-label="Board view" className={cn("grid size-8 place-items-center rounded-md", view === "board" ? "bg-white/[0.08] text-fg" : "text-subtle hover:text-fg")}>
                <Kanban className="size-4" />
              </button>
            </div>
            <Button variant="primary" onClick={() => setDialogOpen(true)} className="flex-1 sm:flex-none">
              <Plus className="size-4" /> New lead
            </Button>
          </div>
        </div>
      </div>

      {view === "table" ? <LeadsTable leads={filtered} ownerName={ownerName} now={now} /> : <LeadsBoard leads={filtered} />}

      <NewLeadDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}

function StageBadge({ stage }: { stage: LeadStage }) {
  const s = LEAD_STAGES.find((x) => x.id === stage)!;
  return (
    <Badge dot={s.tone} variant="neutral">
      {s.label}
    </Badge>
  );
}

function LeadsTable({ leads, ownerName, now }: { leads: Lead[]; ownerName: (id: string | null) => string | undefined; now: number }) {
  if (leads.length === 0) {
    return <div className="card px-6 py-16 text-center text-sm text-muted">No leads match these filters.</div>;
  }

  return (
    <div className="card overflow-hidden">
      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-[11px] tracking-wide text-subtle uppercase">
            <tr>
              <th className="px-5 py-3 font-medium">Lead</th>
              <th className="px-3 py-3 font-medium">Stage</th>
              <th className="px-3 py-3 font-medium">Source</th>
              <th className="px-3 py-3 font-medium">AI score</th>
              <th className="px-3 py-3 text-right font-medium">Value</th>
              <th className="px-3 py-3 font-medium">Owner</th>
              <th className="px-5 py-3 font-medium">Next follow-up</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {leads.map((lead) => {
              const overdue = lead.next_follow_up_at && new Date(lead.next_follow_up_at).getTime() < now && OPEN_STAGES.includes(lead.stage);
              return (
                <tr key={lead.id} className="group transition-colors hover:bg-white/[0.02]">
                  <td className="px-5 py-3">
                    <Link href={`/leads/${lead.id}`} className="flex items-center gap-3">
                      <Avatar name={lead.name} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-fg group-hover:text-accent-strong">{lead.company ?? lead.name}</span>
                        <span className="block truncate text-xs text-subtle">{lead.name}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-3"><StageBadge stage={lead.stage} /></td>
                  <td className="px-3 py-3 text-muted">{LEAD_SOURCES[lead.source]}</td>
                  <td className="px-3 py-3"><ScorePill score={lead.ai_score} /></td>
                  <td className="px-3 py-3 text-right font-medium tabular-nums">{formatCurrency(lead.estimated_value)}</td>
                  <td className="px-3 py-3 text-muted">{ownerName(lead.owner_id) ?? <span className="text-amber-300/80">Unassigned</span>}</td>
                  <td className={cn("px-5 py-3 text-xs", overdue ? "text-rose-300" : "text-muted")}>
                    {lead.next_follow_up_at ? formatRelative(lead.next_follow_up_at, new Date(now)) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile list */}
      <ul className="divide-y divide-line md:hidden">
        {leads.map((lead) => (
          <li key={lead.id}>
            <Link href={`/leads/${lead.id}`} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={lead.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{lead.company ?? lead.name}</p>
                <div className="mt-1 flex items-center gap-2">
                  <StageBadge stage={lead.stage} />
                  <span className="text-xs text-subtle">{LEAD_SOURCES[lead.source]}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium tabular-nums">{formatCurrency(lead.estimated_value)}</p>
                <ScorePill score={lead.ai_score} className="mt-1" />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LeadsBoard({ leads }: { leads: Lead[] }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-3">
        {LEAD_STAGES.map((stage) => {
          const column = leads.filter((l) => l.stage === stage.id);
          return (
            <section key={stage.id} className="w-72 shrink-0 rounded-2xl border border-line bg-surface/60 p-2">
              <header className="flex items-center justify-between px-2 py-2">
                <span className="flex items-center gap-2 text-xs font-medium text-fg">
                  <span className={`size-1.5 rounded-full ${stage.tone}`} />
                  {stage.label}
                  <span className="text-subtle">{column.length}</span>
                </span>
                <span className="text-[11px] text-subtle tabular-nums">{formatCurrency(column.reduce((s, l) => s + l.estimated_value, 0))}</span>
              </header>
              <div className="space-y-2">
                {column.map((lead) => (
                  <Link key={lead.id} href={`/leads/${lead.id}`} className="block rounded-xl border border-line bg-surface-2 p-3 transition-colors hover:border-line-strong">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-fg">{lead.company ?? lead.name}</p>
                      <ScorePill score={lead.ai_score} />
                    </div>
                    <p className="mt-0.5 text-xs text-subtle">{lead.name}</p>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="text-muted">{LEAD_SOURCES[lead.source]}</span>
                      <span className="font-medium tabular-nums">{formatCurrency(lead.estimated_value)}</span>
                    </div>
                  </Link>
                ))}
                {column.length === 0 && <p className="px-2 py-6 text-center text-xs text-subtle">No leads</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
