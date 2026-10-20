import { Card, CardHeader } from "@/components/ui/card";
import type { Insight } from "@/lib/ai/insights";
import { cn } from "@/lib/utils";
import { AlertTriangle, ArrowRight, Info, Sparkles, TrendingUp } from "lucide-react";
import Link from "next/link";

const tone = {
  opportunity: { icon: TrendingUp, cls: "text-emerald-300 bg-emerald-500/10" },
  risk: { icon: AlertTriangle, cls: "text-amber-300 bg-amber-500/10" },
  info: { icon: Info, cls: "text-sky-300 bg-sky-500/10" },
};

export function InsightsPanel({ insights }: { insights: Insight[] }) {
  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute -top-24 -right-24 size-56 rounded-full bg-accent/20 blur-3xl" />
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Sparkles className="size-4 text-accent-strong" /> AI insights
          </span>
        }
        description="Prioritised from your live CRM data"
      />
      <ul className="relative space-y-1 p-3">
        {insights.length === 0 && <li className="px-2 py-6 text-center text-sm text-muted">All caught up — nothing needs attention.</li>}
        {insights.map((insight) => {
          const t = tone[insight.tone];
          const Icon = t.icon;
          const content = (
            <>
              <span className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg", t.cls)}>
                <Icon className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-fg">{insight.title}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted">{insight.detail}</span>
              </span>
              {insight.href && <ArrowRight className="mt-1 size-3.5 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-fg" />}
            </>
          );
          return (
            <li key={insight.id}>
              {insight.href ? (
                <Link href={insight.href} className="group flex gap-3 rounded-xl p-2.5 transition-colors hover:bg-white/[0.03]">
                  {content}
                </Link>
              ) : (
                <div className="flex gap-3 p-2.5">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
