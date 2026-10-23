import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { Lead, LeadStage } from "@/lib/types";
import { formatPercent } from "@/lib/utils";

const REACHED: Record<string, LeadStage[]> = {
  contacted: ["contacted", "qualified", "proposal", "negotiation", "won"],
  proposal: ["proposal", "negotiation", "won"],
  won: ["won"],
};

/**
 * Stage-to-stage conversion for leads added in the last `days` days, based on
 * each lead's current stage (lost leads count only toward "added").
 */
export function FunnelCard({ leads, now, days = 90 }: { leads: Lead[]; now: number; days?: number }) {
  const cohort = leads.filter((l) => new Date(l.created_at).getTime() >= now - days * 86_400_000);
  const steps = [
    { label: "Added", count: cohort.length },
    { label: "Contacted", count: cohort.filter((l) => REACHED.contacted!.includes(l.stage)).length },
    { label: "Proposal", count: cohort.filter((l) => REACHED.proposal!.includes(l.stage)).length },
    { label: "Won", count: cohort.filter((l) => REACHED.won!.includes(l.stage)).length },
  ];
  const max = Math.max(1, steps[0]!.count);

  return (
    <Card>
      <CardHeader title="Conversion funnel" description={`Leads added in the last ${days} days · compare with playbook section 13`} />
      <CardBody className="space-y-3">
        {steps.map((step, i) => {
          const prev = i > 0 ? steps[i - 1]!.count : null;
          return (
            <div key={step.label}>
              <div className="mb-1 flex items-baseline justify-between text-xs">
                <span className="text-muted">{step.label}</span>
                <span className="tabular-nums text-fg">
                  {step.count}
                  {prev !== null && <span className="ml-2 text-subtle">{prev ? formatPercent(step.count / prev, 0) : "—"} of previous</span>}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                <div className="h-full rounded-full bg-accent" style={{ width: `${(step.count / max) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}
