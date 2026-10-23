import { ImportLeadsButton } from "@/components/leads/import-dialog";
import { LeadsView } from "@/components/leads/leads-view";
import { PageHeader } from "@/components/ui/page-header";
import { OPEN_STAGES } from "@/lib/constants";
import { getLeads, getRequestTime, getTeam, getViewer } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Leads" };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ filter?: string; new?: string }> }) {
  const [{ filter, new: openNew }, leads, team, viewer] = await Promise.all([searchParams, getLeads(), getTeam(), getViewer()]);
  const open = leads.filter((l) => OPEN_STAGES.includes(l.stage));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description={`${open.length} open leads · ${formatCurrency(open.reduce((s, l) => s + l.estimated_value, 0))} in pipeline`}
        actions={viewer.mode === "live" && <ImportLeadsButton />}
      />
      <LeadsView
        leads={leads}
        team={team.map((m) => ({ user_id: m.user_id, full_name: m.full_name, status: m.status }))}
        initialFilter={filter === "overdue" || filter === "unassigned" ? filter : undefined}
        openNew={openNew === "1"}
        now={getRequestTime()}
      />
    </div>
  );
}
