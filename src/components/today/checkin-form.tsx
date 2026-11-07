"use client";

import { saveCheckin } from "@/app/actions/checkins";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import type { ActionState } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { useActionState } from "react";

export function CheckinForm({ initial, disabled }: { initial: { doing: string; done: string; stuck: string } | null; disabled?: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveCheckin, {});
  return (
    <form action={action} className="space-y-3">
      <div>
        <Label htmlFor="doing">🎯 Aaj kya karunga / What I&apos;m doing today</Label>
        <Textarea id="doing" name="doing" rows={2} defaultValue={initial?.doing ?? ""} placeholder="e.g. Call 5 funded startups, finish Acme explainer script" />
      </div>
      <div>
        <Label htmlFor="done">✅ Ho gaya / Done</Label>
        <Textarea id="done" name="done" rows={2} defaultValue={initial?.done ?? ""} placeholder="Update this in the evening" />
      </div>
      <div>
        <Label htmlFor="stuck">🧱 Atka hua / Stuck on</Label>
        <Textarea id="stuck" name="stuck" rows={2} defaultValue={initial?.stuck ?? ""} placeholder="Anything blocking you? The team sees this first." />
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className={cn("text-xs", state.error ? "text-rose-300" : "text-emerald-300")}>{state.error ?? state.message}</p>
        <Button type="submit" variant="primary" size="sm" disabled={pending || disabled}>
          {pending ? "Saving…" : initial ? "Update check-in" : "Save check-in"}
        </Button>
      </div>
    </form>
  );
}
