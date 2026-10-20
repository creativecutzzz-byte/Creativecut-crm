"use client";

import { toggleWorkflow, type ToggleState } from "@/app/actions/workflows";
import { InstagramIcon, WhatsAppIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { ACTION_LABELS, describeStep } from "@/lib/workflows/engine";
import type { Workflow, WorkflowAction, WorkflowTrigger } from "@/lib/types";
import { cn, formatPercent } from "@/lib/utils";
import { ArrowRightLeft, Bell, ChevronRight, ListTodo, Mail, Timer, Zap } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { useActionState, useOptimistic, useTransition } from "react";

const stepIcons: Record<WorkflowAction, ComponentType<SVGProps<SVGSVGElement>>> = {
  wait: Timer,
  send_whatsapp: WhatsAppIcon,
  send_instagram_dm: InstagramIcon,
  send_email: Mail,
  create_task: ListTodo,
  update_stage: ArrowRightLeft,
  notify_team: Bell,
};

const triggerLabels: Record<WorkflowTrigger, string> = {
  lead_created: "When a lead is created",
  stage_changed: "When stage changes",
  no_reply: "When a lead goes quiet",
  scheduled: "On a schedule",
  manual: "Manually",
};

function triggerDetail(wf: Workflow) {
  const c = wf.trigger_config as { sources?: string[]; stage?: string; no_reply_hours?: number };
  if (c.sources) return `from ${c.sources.map((s) => s.replace("_", " ")).join(", ")}`;
  if (c.stage) return `to ${c.stage}`;
  if (c.no_reply_hours) return `for ${Math.round(c.no_reply_hours / 24)} days`;
  return "";
}

export function WorkflowCard({ workflow }: { workflow: Workflow }) {
  const [state, action] = useActionState<ToggleState, FormData>(toggleWorkflow, {});
  const [optimisticActive, setOptimisticActive] = useOptimistic(workflow.is_active);
  const [, startTransition] = useTransition();
  // If the save fails (e.g. demo mode) the optimistic value snaps back on its own.
  const active = optimisticActive;

  const toggle = () => {
    const fd = new FormData();
    fd.set("id", workflow.id);
    fd.set("active", String(!active));
    startTransition(() => {
      setOptimisticActive(!active);
      action(fd);
    });
  };

  return (
    <article className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">{workflow.name}</h2>
            <Badge variant={active ? "success" : "neutral"} dot={active ? "bg-emerald-400" : "bg-zinc-500"}>
              {active ? "Active" : "Paused"}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted">{workflow.description}</p>
        </div>
        <button
          role="switch"
          aria-checked={active}
          aria-label={`${active ? "Pause" : "Activate"} ${workflow.name}`}
          onClick={toggle}
          className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", active ? "bg-accent" : "bg-white/10")}
        >
          <span className={cn("absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform", active && "translate-x-4")} />
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-accent/25 bg-accent-soft px-2.5 py-1.5 text-xs text-accent-strong">
          <Zap className="size-3.5" />
          {triggerLabels[workflow.trigger]} {triggerDetail(workflow)}
        </span>
        {workflow.steps.map((step) => {
          const Icon = stepIcons[step.action];
          return (
            <span key={step.id} className="flex items-center gap-1.5">
              <ChevronRight className="size-3.5 text-subtle" />
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs">
                <Icon className="size-3.5 text-muted" />
                <span className="text-fg">{ACTION_LABELS[step.action]}</span>
                <span className="text-subtle">{describeStep(step)}</span>
              </span>
            </span>
          );
        })}
      </div>

      <div className="mt-5 flex items-center gap-6 border-t border-line pt-4 text-xs">
        <span className="text-subtle">
          Runs (30d) <span className="ml-1 font-medium text-fg tabular-nums">{workflow.runs_last_30d}</span>
        </span>
        <span className="text-subtle">
          Reply rate <span className="ml-1 font-medium text-fg tabular-nums">{workflow.reply_rate === null ? "—" : formatPercent(workflow.reply_rate, 0)}</span>
        </span>
        {state.error && <span className="ml-auto text-amber-300">{state.error}</span>}
      </div>
    </article>
  );
}
