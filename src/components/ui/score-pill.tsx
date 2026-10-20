import { scoreTier } from "@/lib/ai/lead-scoring";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

const tones = {
  hot: "text-rose-300 bg-rose-500/10 ring-rose-400/20",
  warm: "text-amber-300 bg-amber-500/10 ring-amber-400/20",
  cold: "text-sky-300 bg-sky-500/10 ring-sky-400/20",
};

export function ScorePill({ score, className }: { score: number | null; className?: string }) {
  const tier = scoreTier(score);
  return (
    <span title={`AI score · ${tier}`} className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ring-1 ring-inset", tones[tier], className)}>
      <Sparkles className="size-3" />
      {score ?? "—"}
    </span>
  );
}
