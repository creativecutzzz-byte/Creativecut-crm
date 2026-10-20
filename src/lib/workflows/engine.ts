import { LEAD_STAGES } from "@/lib/constants";
import type { Lead, MessageTemplate, WorkflowAction, WorkflowStep } from "@/lib/types";

// Pure planner for follow-up workflows. Given a workflow and a lead, it works
// out what each step *would* do. The scheduler (future cron job) executes the
// plan through src/lib/integrations, which is dry-run only — so this module
// never sends anything itself.

export interface PlannedStep {
  position: number;
  action: WorkflowAction;
  outcome: "would_run" | "skipped" | "wait";
  detail: string;
  at: string;
}

export const ACTION_LABELS: Record<WorkflowAction, string> = {
  wait: "Wait",
  send_whatsapp: "Send WhatsApp",
  send_instagram_dm: "Send Instagram DM",
  send_email: "Send email",
  create_task: "Create task",
  update_stage: "Update stage",
  notify_team: "Notify team",
};

export function describeStep(step: WorkflowStep): string {
  const c = step.config as Record<string, string | number | undefined>;
  switch (step.action) {
    case "wait": {
      const hours = Number(c.hours ?? 0);
      return hours >= 24 && hours % 24 === 0 ? `${hours / 24} day${hours === 24 ? "" : "s"}` : `${hours} hours`;
    }
    case "send_whatsapp":
    case "send_instagram_dm":
    case "send_email":
      return String(c.template ?? "Custom message");
    case "create_task":
      return String(c.title ?? "Follow up");
    case "update_stage":
      return `→ ${LEAD_STAGES.find((s) => s.id === c.stage)?.label ?? c.stage}${c.if === "no_reply" ? " if no reply" : ""}`;
    case "notify_team":
      return `#${c.channel ?? "team"}${c.if === "no_reply" ? " if no reply" : ""}`;
  }
}

export function planRun(steps: WorkflowStep[], lead: Lead, templates: MessageTemplate[], start = new Date()): PlannedStep[] {
  let clock = start.getTime();
  const out: PlannedStep[] = [];

  for (const step of [...steps].sort((a, b) => a.position - b.position)) {
    const c = step.config as Record<string, string | number | undefined>;
    const at = new Date(clock).toISOString();
    const base = { position: step.position, action: step.action, at };

    if (step.action === "wait") {
      clock += Number(c.hours ?? 0) * 3_600_000;
      out.push({ ...base, outcome: "wait", detail: `Pause ${describeStep(step)}` });
      continue;
    }

    if (step.action === "send_whatsapp" || step.action === "send_instagram_dm" || step.action === "send_email") {
      const address = step.action === "send_whatsapp" ? lead.whatsapp_number : step.action === "send_instagram_dm" ? lead.instagram_handle : lead.email;
      const template = templates.find((t) => t.name === c.template);
      if (!lead.marketing_consent) {
        out.push({ ...base, outcome: "skipped", detail: "Skipped — lead hasn't opted in to automated messages" });
      } else if (!address) {
        out.push({ ...base, outcome: "skipped", detail: `Skipped — no ${step.action === "send_whatsapp" ? "WhatsApp number" : step.action === "send_instagram_dm" ? "Instagram handle" : "email"}` });
      } else {
        out.push({ ...base, outcome: "would_run", detail: `Simulate “${template?.name ?? c.template ?? "message"}” (dry-run, not delivered)` });
      }
      continue;
    }

    out.push({ ...base, outcome: "would_run", detail: `${ACTION_LABELS[step.action]}: ${describeStep(step)}` });
  }

  return out;
}
