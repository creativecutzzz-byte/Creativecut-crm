"use client";

import { startLeadSequence, stopLeadSequence } from "@/app/actions/sequences";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import type { ActionState } from "@/lib/actions";
import { SEQUENCE_LIST } from "@/lib/sequences";
import { Play, Square } from "lucide-react";
import { useActionState } from "react";

/** Start or stop an outreach sequence on a lead. */
export function SequenceControls({ leadId, activeSequence, closed }: { leadId: string; activeSequence: string | null; closed: boolean }) {
  // One state for both forms, so the latest result is the one shown.
  const [state, action, pending] = useActionState<ActionState, FormData>(
    (prev, formData) => (formData.get("intent") === "stop" ? stopLeadSequence(prev, formData) : startLeadSequence(prev, formData)),
    {},
  );
  const active = SEQUENCE_LIST.find((s) => s.key === activeSequence);

  return (
    <div className="space-y-3">
      {active ? (
        <form action={action} className="flex items-center justify-between gap-3 rounded-xl border border-accent/25 bg-accent-soft/40 px-3 py-2.5">
          <input type="hidden" name="lead_id" value={leadId} />
          <input type="hidden" name="intent" value="stop" />
          <div className="min-w-0 text-xs">
            <p className="font-medium text-fg">Running: {active.name}</p>
            <p className="text-muted">Stop it as soon as they reply.</p>
          </div>
          <Button type="submit" size="sm" disabled={pending}>
            <Square className="size-3.5" /> Stop
          </Button>
        </form>
      ) : closed ? (
        <p className="text-xs text-subtle">This lead is closed. Sequences are off.</p>
      ) : null}

      {!closed && (
        <form action={action} className="space-y-2">
          <input type="hidden" name="lead_id" value={leadId} />
          <Select name="sequence" defaultValue="" aria-label="Sequence" required>
            <option value="" disabled>
              Choose a sequence…
            </option>
            {SEQUENCE_LIST.map((s) => (
              <option key={s.key} value={s.key}>
                {s.name}: {s.steps.length} steps
              </option>
            ))}
          </Select>
          <Button type="submit" variant={active ? "secondary" : "primary"} size="sm" className="w-full" disabled={pending}>
            <Play className="size-3.5" /> {pending ? "Working…" : active ? "Replace with this sequence" : "Start sequence"}
          </Button>
        </form>
      )}
      {state.error && <p className="text-xs text-rose-300">{state.error}</p>}
      {state.message && <p className="text-xs text-emerald-300">{state.message}</p>}
    </div>
  );
}
