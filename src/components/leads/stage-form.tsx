"use client";

import { updateLeadStage, type ActionState } from "@/app/actions/leads";
import { Select } from "@/components/ui/input";
import { LEAD_STAGES } from "@/lib/constants";
import type { LeadStage } from "@/lib/types";
import { useActionState } from "react";

export function StageForm({ id, stage }: { id: string; stage: LeadStage }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateLeadStage, {});

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <Select
        name="stage"
        defaultValue={stage}
        disabled={pending}
        aria-label="Lead stage"
        className="w-40"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        {LEAD_STAGES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </Select>
      {state.error && <span className="max-w-48 text-[11px] leading-tight text-amber-300">{state.error}</span>}
    </form>
  );
}
