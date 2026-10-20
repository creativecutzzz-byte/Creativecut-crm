import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

export function StatCard({
  label,
  value,
  delta,
  hint,
  icon: Icon,
  invertDelta,
}: {
  label: string;
  value: string;
  delta?: number;
  hint?: string;
  icon?: LucideIcon;
  /** For metrics where down is good (e.g. cost per lead). */
  invertDelta?: boolean;
}) {
  const positive = delta !== undefined && (invertDelta ? delta < 0 : delta >= 0);
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted">{label}</p>
        {Icon && (
          <span className="grid size-8 place-items-center rounded-lg bg-white/[0.04] text-muted ring-1 ring-white/5">
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-fg tabular-nums">{value}</p>
      <div className="mt-1.5 flex items-center gap-2 text-xs">
        {delta !== undefined && (
          <span className={cn("inline-flex items-center gap-0.5 font-medium", positive ? "text-emerald-400" : "text-rose-400")}>
            {delta >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {Math.abs(delta * 100).toFixed(1)}%
          </span>
        )}
        {hint && <span className="text-subtle">{hint}</span>}
      </div>
    </div>
  );
}
