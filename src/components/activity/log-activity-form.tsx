"use client";

import { logActivity, type ActionState } from "@/app/actions/leads";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { useActionState, useEffect, useRef } from "react";

const TYPES = [
  { id: "note", label: "Note" },
  { id: "call", label: "Call" },
  { id: "meeting", label: "Meeting" },
  { id: "email", label: "Email" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "instagram", label: "Instagram" },
];

/** Logs a note or touchpoint against a lead or a client. */
export function LogActivityForm({ leadId, clientId }: { leadId?: string; clientId?: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(logActivity, {});
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="space-y-3">
      {leadId && <input type="hidden" name="lead_id" value={leadId} />}
      {clientId && <input type="hidden" name="client_id" value={clientId} />}
      <Textarea name="body" required placeholder="What happened? e.g. “Called — wants a quote for 4 reels/month”" aria-label="Activity details" className="min-h-20" />
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-32">
          <Label htmlFor="activity-type">Type</Label>
          <Select id="activity-type" name="type" defaultValue="note">
            {TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
        {leadId && (
          <div className="min-w-48 flex-1">
            <Label htmlFor="activity-follow-up">Next follow-up (optional)</Label>
            <Input id="activity-follow-up" name="next_follow_up_at" type="datetime-local" />
          </div>
        )}
        <Button type="submit" variant="primary" disabled={pending} className="ml-auto">
          {pending ? "Saving…" : "Log activity"}
        </Button>
      </div>
      {state.error && <p className="text-xs text-rose-300">{state.error}</p>}
    </form>
  );
}
