import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { Integration } from "@/lib/types";
import { CheckCircle2, Circle } from "lucide-react";

const statusBadge = {
  connected: { label: "Connected", variant: "success" },
  pending: { label: "Pending review", variant: "warning" },
  error: { label: "Error", variant: "danger" },
  disconnected: { label: "Not connected", variant: "neutral" },
} as const;

export function ConnectionCard({
  integration,
  envConfigured,
  envKeys,
  steps,
}: {
  integration: Integration;
  envConfigured: boolean;
  envKeys: string[];
  steps: string[];
}) {
  const badge = statusBadge[integration.status];
  return (
    <Card>
      <CardHeader title="Connection" description="Placeholder — dry-run only" action={<Badge variant={badge.variant}>{badge.label}</Badge>} />
      <CardBody className="space-y-5">
        <div>
          <p className="mb-2 text-xs font-medium text-muted">Server credentials</p>
          <ul className="space-y-1.5">
            {envKeys.map((key) => (
              <li key={key} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-2/60 px-3 py-2">
                <code className="truncate text-[11px] text-fg/80">{key}</code>
                <span className={envConfigured ? "text-[11px] text-emerald-300" : "text-[11px] text-subtle"}>{envConfigured ? "set" : "missing"}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] leading-relaxed text-subtle">
            Set these as server environment variables or in Supabase Vault. Values are never shown, stored in the database, or sent to the browser.
          </p>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-muted">To go live</p>
          <ol className="space-y-2">
            {steps.map((step, i) => {
              const done = i === 0 && envConfigured;
              return (
                <li key={step} className="flex gap-2.5 text-xs text-muted">
                  {done ? <CheckCircle2 className="mt-px size-3.5 shrink-0 text-emerald-300" /> : <Circle className="mt-px size-3.5 shrink-0 text-subtle" />}
                  {step}
                </li>
              );
            })}
          </ol>
        </div>
      </CardBody>
    </Card>
  );
}
