"use client";

import { startAutopilot, stopAutopilot } from "@/app/actions/outreach";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { Bot, Square } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

const statusLabel: Record<string, { label: string; variant: "success" | "info" | "warning" | "neutral" | "danger" }> = {
  active: { label: "On autopilot", variant: "success" },
  replied: { label: "Replied", variant: "info" },
  paused: { label: "Paused (not now)", variant: "warning" },
  completed: { label: "Sequence finished", variant: "neutral" },
  stopped: { label: "Stopped", variant: "neutral" },
  unsubscribed: { label: "Unsubscribed", variant: "danger" },
};

export function AutopilotControls({ leadId, status, step, steps, pending, closed }: { leadId: string; status: string | null; step: number | null; steps: number; pending: number; closed: boolean }) {
  const [busy, start] = useTransition();
  const [result, setResult] = useState<ActionState>({});
  const s = status ? statusLabel[status] : null;
  const canStart = !closed && status !== "active" && status !== "unsubscribed";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {s ? <Badge variant={s.variant}>{s.label}</Badge> : <Badge>Off</Badge>}
        {status === "active" && steps > 0 && (
          <span className="text-muted">
            Step {Math.max(0, (step ?? -1) + 1)} of {steps}
          </span>
        )}
        {pending > 0 && (
          <Link href="/outreach" className="text-accent-strong hover:underline">
            {pending} waiting for approval →
          </Link>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {canStart && (
          <Button size="sm" variant="primary" disabled={busy} onClick={() => start(async () => setResult(await startAutopilot(leadId)))}>
            <Bot className="size-3.5" /> {busy ? "Writing…" : status ? "Restart autopilot" : "Start autopilot"}
          </Button>
        )}
        {status === "active" && (
          <Button size="sm" disabled={busy} onClick={() => start(async () => setResult(await stopAutopilot(leadId)))}>
            <Square className="size-3.5" /> Stop autopilot
          </Button>
        )}
      </div>
      {(result.error || result.message) && <p className={cn("text-xs", result.error ? "text-rose-300" : "text-emerald-300")}>{result.error ?? result.message}</p>}
    </div>
  );
}
