import { LEAD_STAGES } from "@/lib/constants";
import type { Lead } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export function PipelineBars({ leads }: { leads: Lead[] }) {
  const stages = LEAD_STAGES.filter((s) => s.id !== "lost").map((stage) => {
    const inStage = leads.filter((l) => l.stage === stage.id);
    return { ...stage, count: inStage.length, value: inStage.reduce((s, l) => s + l.estimated_value, 0) };
  });
  const max = Math.max(1, ...stages.map((s) => s.value));

  return (
    <ul className="space-y-3.5">
      {stages.map((stage) => (
        <li key={stage.id}>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-muted">
              <span className={`size-1.5 rounded-full ${stage.tone}`} />
              {stage.label}
              <span className="text-subtle">· {stage.count}</span>
            </span>
            <span className="font-medium tabular-nums text-fg">{formatCurrency(stage.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.04]">
            <div className={`h-full rounded-full ${stage.tone} opacity-80`} style={{ width: `${(stage.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
