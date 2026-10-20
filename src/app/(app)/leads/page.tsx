import { LeadsView } from "@/components/leads/leads-view";
import { PageHeader } from "@/components/ui/page-header";
import { OPEN_STAGES } from "@/lib/constants";
import { getLeads, getRequestTime, getTeam } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Leads" };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ filter?: string; new?: string }> }) {
  const [{ filter, new: openNew }, leads, team] = await Promise.all([searchParams, getLeads(), getTeam()]);
  const open = leads.filter((l) => OPEN_STAGES.includes(l.stage));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description={`${open.length} open leads · ${formatCurrency(open.reduce((s, l) => s + l.estimated_value, 0))} in pipeline`}
      />
      <LeadsView
        leads={leads}
        team={team.map((m) => ({ user_id: m.user_id, full_name: m.full_name }))}
        initialFilter={filter === "overdue" || filter === "unassigned" ? filter : undefined}
        openNew={openNew === "1"}
        now={getRequestTime()}
      />
    </div>
  );
}
