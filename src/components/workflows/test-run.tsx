"use client";

import { testWorkflow, type TestRunState } from "@/app/actions/workflows";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { ACTION_LABELS } from "@/lib/workflows/engine";
import { cn, formatDate } from "@/lib/utils";
import { CircleSlash, FlaskConical, PlayCircle, Timer } from "lucide-react";
import { useActionState } from "react";

const outcomeStyles = {
  would_run: { icon: PlayCircle, cls: "text-emerald-300" },
  skipped: { icon: CircleSlash, cls: "text-amber-300" },
  wait: { icon: Timer, cls: "text-sky-300" },
};

export function TestRun({ workflows, leads }: { workflows: { id: string; name: string }[]; leads: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState<TestRunState, FormData>(testWorkflow, {});

  return (
    <Card>
      <CardHeader title="Test run" description="Preview every step for a real lead. Dry-run — nothing is sent." />
      <CardBody>
        <form action={action} className="space-y-3">
          <div>
            <Label htmlFor="workflow_id">Workflow</Label>
            <Select id="workflow_id" name="workflow_id">
              {workflows.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="lead_id">Lead</Label>
            <Select id="lead_id" name="lead_id">
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="primary" className="w-full" disabled={pending}>
            <FlaskConical className="size-4" /> {pending ? "Simulating…" : "Simulate"}
          </Button>
        </form>

        {state.error && <p className="mt-4 text-xs text-rose-300">{state.error}</p>}
        {state.plan && (
          <ol className="mt-5 space-y-3 border-t border-line pt-4">
            <p className="text-xs text-muted">Plan for {state.leadName}</p>
            {state.plan.map((step) => {
              const s = outcomeStyles[step.outcome];
              const Icon = s.icon;
              return (
                <li key={step.position} className="flex gap-3">
                  <Icon className={cn("mt-0.5 size-4 shrink-0", s.cls)} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-fg">
                      {step.position}. {ACTION_LABELS[step.action]}
                      <span className="ml-2 font-normal text-subtle">{formatDate(step.at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                    </p>
                    <p className="text-xs text-muted">{step.detail}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardBody>
    </Card>
  );
}
