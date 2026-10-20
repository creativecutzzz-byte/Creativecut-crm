import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const variants = {
  neutral: "bg-white/5 text-muted ring-white/10",
  accent: "bg-accent-soft text-accent-strong ring-accent/25",
  success: "bg-emerald-500/10 text-emerald-300 ring-emerald-400/20",
  warning: "bg-amber-500/10 text-amber-300 ring-amber-400/20",
  danger: "bg-rose-500/10 text-rose-300 ring-rose-400/20",
  info: "bg-sky-500/10 text-sky-300 ring-sky-400/20",
};

export type BadgeVariant = keyof typeof variants;

export function Badge({ children, variant = "neutral", className, dot }: { children: ReactNode; variant?: BadgeVariant; className?: string; dot?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap", variants[variant], className)}>
      {dot && <span className={cn("size-1.5 rounded-full", dot)} />}
      {children}
    </span>
  );
}
