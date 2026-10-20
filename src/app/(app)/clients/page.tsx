import { InstagramIcon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/ui/stat-card";
import { CLIENT_STATUS } from "@/lib/constants";
import { getClients, getTeam } from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/utils";
import { memberByUserId } from "@/lib/team";
import { Briefcase, HeartPulse, Repeat, Wallet } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Clients" };

function healthTone(score: number) {
  if (score >= 80) return "bg-emerald-400";
  if (score >= 60) return "bg-amber-400";
  return "bg-rose-400";
}

export default async function ClientsPage() {
  const [clients, team] = await Promise.all([getClients(), getTeam()]);
  const live = clients.filter((c) => c.status === "active" || c.status === "onboarding");
  const mrr = live.reduce((s, c) => s + c.monthly_retainer, 0);
  const scored = live.filter((c) => c.health_score !== null);
  const avgHealth = scored.length ? Math.round(scored.reduce((s, c) => s + c.health_score!, 0) / scored.length) : 0;
  const retention = clients.length ? clients.filter((c) => c.status !== "churned").length / clients.length : 0;

  const order = { active: 0, onboarding: 1, paused: 2, churned: 3 };
  const sorted = [...clients].sort((a, b) => order[a.status] - order[b.status] || b.monthly_retainer - a.monthly_retainer);

  return (
    <div className="space-y-6">
      <PageHeader title="Clients" description="Retainers, services and account health across the agency." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active clients" value={String(live.length)} hint={`${clients.length} all-time`} icon={Briefcase} />
        <StatCard label="Monthly recurring revenue" value={formatCurrency(mrr)} hint="from retainers" icon={Wallet} />
        <StatCard label="Average health" value={`${avgHealth}/100`} hint="active accounts" icon={HeartPulse} />
        <StatCard label="Retention" value={`${Math.round(retention * 100)}%`} hint="clients not churned" icon={Repeat} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {sorted.map((client) => {
          const owner = memberByUserId(team, client.owner_id);
          const status = CLIENT_STATUS[client.status];
          return (
            <article key={client.id} className="card flex flex-col p-5 transition-colors hover:border-line-strong">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={client.company ?? client.name} />
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold">{client.company ?? client.name}</h2>
                    <p className="truncate text-xs text-subtle">
                      {client.name} · {client.industry ?? "—"}
                    </p>
                  </div>
                </div>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-subtle">Retainer</p>
                  <p className="mt-1 text-base font-semibold tabular-nums text-fg">
                    {formatCurrency(client.monthly_retainer)}
                    <span className="text-xs font-normal text-subtle">/mo</span>
                  </p>
                </div>
                <div>
                  <p className="text-subtle">Client since</p>
                  <p className="mt-1 text-sm text-fg">{formatDate(client.started_at, { month: "short", year: "numeric" })}</p>
                </div>
              </div>

              {client.health_score !== null && (
                <div className="mt-4">
                  <div className="mb-1.5 flex justify-between text-xs">
                    <span className="text-subtle">Account health</span>
                    <span className="tabular-nums text-fg">{client.health_score}</span>
                  </div>
                  <Progress value={client.health_score} tone={healthTone(client.health_score)} />
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-1.5">
                {client.services.map((s) => (
                  <Badge key={s}>{s}</Badge>
                ))}
              </div>

              <div className="mt-auto flex items-center justify-between border-t border-line pt-4 mt-5 text-xs text-muted">
                <span>{owner ? owner.full_name : "No owner"}</span>
                {client.instagram_handle && (
                  <span className="flex items-center gap-1">
                    <InstagramIcon className="size-3.5" />@{client.instagram_handle}
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
