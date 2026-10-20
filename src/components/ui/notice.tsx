import { cn } from "@/lib/utils";
import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

/** Inline callout used for dry-run / safety messaging. */
export function Notice({ children, className, icon: Icon = ShieldCheck }: { children: ReactNode; className?: string; icon?: typeof ShieldCheck }) {
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border border-accent/20 bg-accent-soft/60 px-4 py-3 text-sm text-fg/90", className)}>
      <Icon className="mt-0.5 size-4 shrink-0 text-accent-strong" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
