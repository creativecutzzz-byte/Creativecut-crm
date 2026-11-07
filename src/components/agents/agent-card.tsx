"use client";

import { runAgentNow, saveAgentConfig, setAgentEnabled } from "@/app/actions/agents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import type { ActionState } from "@/lib/actions";
import { cn, formatRelative } from "@/lib/utils";
import { Bot, Play, Settings2 } from "lucide-react";
import { useActionState, useOptimistic, useState, useTransition } from "react";

export interface AgentCardData {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  config: Record<string, unknown>;
  configHelp: string;
  missing: string[];
  lastRunAt: string | null;
  lastStatus: string | null;
  lastSummary: string | null;
}

const statusVariant: Record<string, "success" | "warning" | "danger" | "neutral"> = { success: "success", skipped: "warning", error: "danger", running: "neutral" };

export function AgentCard({ agent, canEdit }: { agent: AgentCardData; canEdit: boolean }) {
  const [enabled, setEnabled] = useOptimistic(agent.enabled);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionState>({});
  const [open, setOpen] = useState(false);
  const ready = agent.missing.length === 0;

  const toggle = () =>
    startTransition(async () => {
      setEnabled(!enabled);
      setResult(await setAgentEnabled(agent.key, !enabled));
    });

  const run = () =>
    startTransition(async () => {
      setResult({ message: "Running…" });
      setResult(await runAgentNow(agent.key));
    });

  return (
    <article className="card flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-strong">
            <Bot className="size-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">{agent.name}</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">{agent.description}</p>
          </div>
        </div>
        {canEdit && (
          <button
            role="switch"
            aria-checked={enabled}
            aria-label={`${enabled ? "Turn off" : "Turn on"} ${agent.name}`}
            onClick={toggle}
            disabled={pending}
            className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", enabled ? "bg-accent" : "bg-white/10")}
          >
            <span className={cn("absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform", enabled && "translate-x-4")} />
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px]">
        <Badge variant={enabled ? "success" : "neutral"}>{enabled ? "On · daily" : "Off"}</Badge>
        {ready ? <Badge variant="info">Ready</Badge> : <Badge variant="warning">Needs {agent.missing.join(", ")}</Badge>}
        {agent.lastStatus && <Badge variant={statusVariant[agent.lastStatus] ?? "neutral"}>Last run: {agent.lastStatus}</Badge>}
        {agent.lastRunAt && <span className="text-subtle">{formatRelative(agent.lastRunAt)}</span>}
      </div>
      {agent.lastSummary && <p className="mt-2 text-xs text-muted">{agent.lastSummary}</p>}
      {(result.error || result.message) && <p className={cn("mt-2 text-xs", result.error ? "text-rose-300" : "text-emerald-300")}>{result.error ?? result.message}</p>}

      {canEdit && (
        <div className="mt-auto flex gap-2 pt-4">
          <Button size="sm" variant="primary" onClick={run} disabled={pending}>
            <Play className="size-3.5" /> {pending ? "Working…" : "Run now"}
          </Button>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Settings2 className="size-3.5" /> Settings
          </Button>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={`${agent.name} settings`} description={agent.configHelp}>
        <SettingsForm agent={agent} onDone={() => setOpen(false)} />
      </Modal>
    </article>
  );
}

function SettingsForm({ agent, onDone }: { agent: AgentCardData; onDone: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const res = await saveAgentConfig(prev, fd);
    if (res.ok) onDone();
    return res;
  }, {});
  return (
    <form action={action}>
      <input type="hidden" name="key" value={agent.key} />
      <ModalBody className="space-y-2">
        <Textarea name="config" rows={14} defaultValue={JSON.stringify(agent.config, null, 2)} className="font-mono text-xs" spellCheck={false} />
      </ModalBody>
      <ModalFooter error={state.error}>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </ModalFooter>
    </form>
  );
}
