import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CheckCircle2, Circle } from "lucide-react";

export interface ConnectionStep {
  label: string;
  done: boolean;
}

export function ConnectionCard({
  live,
  envKeys,
  steps,
  webhookUrl,
}: {
  live: boolean;
  envKeys: { key: string; set: boolean }[];
  steps: ConnectionStep[];
  webhookUrl: string;
}) {
  const allSet = envKeys.every((k) => k.set);
  const badge = live ? { label: "Live", variant: "success" as const } : allSet ? { label: "Dry-run", variant: "warning" as const } : { label: "Not connected", variant: "neutral" as const };
  return (
    <Card>
      <CardHeader title="Connection" description={live ? "Messages are delivered for real" : "Sends are previewed, nothing is delivered"} action={<Badge variant={badge.variant}>{badge.label}</Badge>} />
      <CardBody className="space-y-5">
        <div>
          <p className="mb-2 text-xs font-medium text-muted">Server environment variables</p>
          <ul className="space-y-1.5">
            {envKeys.map(({ key, set }) => (
              <li key={key} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-2/60 px-3 py-2">
                <code className="truncate text-[11px] text-fg/80">{key}</code>
                <span className={set ? "text-[11px] text-emerald-300" : "text-[11px] text-subtle"}>{set ? "set" : "missing"}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] leading-relaxed text-subtle">
            Set these in your host&apos;s environment variables (e.g. Vercel → Settings → Environment Variables), then redeploy. Values are never shown, stored in the database, or sent to the browser.
          </p>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted">Webhook callback URL</p>
          <code className="block break-all rounded-lg border border-line bg-surface-2/60 px-3 py-2 text-[11px] text-fg/80">{webhookUrl}</code>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-muted">To go live</p>
          <ol className="space-y-2">
            {steps.map((step) => (
              <li key={step.label} className="flex gap-2.5 text-xs text-muted">
                {step.done ? <CheckCircle2 className="mt-px size-3.5 shrink-0 text-emerald-300" /> : <Circle className="mt-px size-3.5 shrink-0 text-subtle" />}
                {step.label}
              </li>
            ))}
          </ol>
        </div>
      </CardBody>
    </Card>
  );
}
