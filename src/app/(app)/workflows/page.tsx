import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { TestRun } from "@/components/workflows/test-run";
import { WorkflowCard } from "@/components/workflows/workflow-card";
import { OPEN_STAGES } from "@/lib/constants";
import { getLeads, getWorkflows } from "@/lib/data";
import { formatPercent } from "@/lib/utils";
import { Activity, MessageCircleReply, Workflow as WorkflowIcon } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Workflows" };

export default async function WorkflowsPage() {
  const [workflows, leads] = await Promise.all([getWorkflows(), getLeads()]);
  const active = workflows.filter((w) => w.is_active);
  const runs = workflows.reduce((s, w) => s + w.runs_last_30d, 0);
  const rated = workflows.filter((w) => w.reply_rate !== null && w.runs_last_30d > 0);
  const replyRate = rated.length ? rated.reduce((s, w) => s + w.reply_rate! * w.runs_last_30d, 0) / rated.reduce((s, w) => s + w.runs_last_30d, 0) : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Automated follow-ups" description="Trigger-based sequences that keep every lead warm." />
      <Notice>
        Workflows run in <strong className="font-medium">dry-run mode</strong>: message steps are simulated and logged, never delivered. Leads without
        marketing consent are always skipped.
      </Notice>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Active workflows" value={`${active.length}/${workflows.length}`} icon={WorkflowIcon} />
        <StatCard label="Runs (30d)" value={String(runs)} icon={Activity} />
        <StatCard label="Reply rate" value={formatPercent(replyRate, 0)} icon={MessageCircleReply} hint="weighted by runs" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {workflows.map((w) => (
            <WorkflowCard key={w.id} workflow={w} />
          ))}
        </div>
        <div>
          <TestRun
            workflows={workflows.map((w) => ({ id: w.id, name: w.name }))}
            leads={leads.filter((l) => OPEN_STAGES.includes(l.stage)).map((l) => ({ id: l.id, label: `${l.company ?? l.name}${l.marketing_consent ? "" : " (no consent)"}` }))}
          />
        </div>
      </div>
    </div>
  );
}
