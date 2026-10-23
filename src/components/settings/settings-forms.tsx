"use client";

import { renameWorkspace, updateOutreachLinks, updateProfile } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import type { ActionState } from "@/lib/actions";
import { useActionState } from "react";

function InlineForm({ action, name, label, defaultValue, disabled }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; name: string; label: string; defaultValue: string; disabled?: boolean }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});
  return (
    <form action={formAction} className="space-y-2">
      <Label htmlFor={`settings-${name}`}>{label}</Label>
      <div className="flex gap-2">
        <Input id={`settings-${name}`} name={name} defaultValue={defaultValue} required disabled={disabled} />
        <Button type="submit" disabled={pending || disabled}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
      {state.error && <p className="text-xs text-rose-300">{state.error}</p>}
      {state.message && <p className="text-xs text-emerald-300">{state.message}</p>}
    </form>
  );
}

export function WorkspaceNameForm({ name, canEdit }: { name: string; canEdit: boolean }) {
  return <InlineForm action={renameWorkspace} name="name" label={canEdit ? "Workspace name" : "Workspace name (owners and admins can change this)"} defaultValue={name} disabled={!canEdit} />;
}

export function ProfileForm({ fullName }: { fullName: string }) {
  return <InlineForm action={updateProfile} name="full_name" label="Your name" defaultValue={fullName} />;
}

export function OutreachLinksForm({ bookingUrl, portfolioUrl, canEdit }: { bookingUrl: string | null; portfolioUrl: string | null; canEdit: boolean }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateOutreachLinks, {});
  return (
    <form action={formAction} className="space-y-3">
      <div>
        <Label htmlFor="booking_url">Booking link ({"{{booking_link}}"})</Label>
        <Input id="booking_url" name="booking_url" type="url" placeholder="https://calendar.app.google/…" defaultValue={bookingUrl ?? ""} disabled={!canEdit} />
      </div>
      <div>
        <Label htmlFor="portfolio_url">Portfolio link ({"{{portfolio_link}}"})</Label>
        <Input id="portfolio_url" name="portfolio_url" type="url" placeholder="https://www.creativecut.in/saas" defaultValue={portfolioUrl ?? ""} disabled={!canEdit} />
      </div>
      <Button type="submit" disabled={pending || !canEdit}>
        {pending ? "Saving…" : "Save links"}
      </Button>
      {state.error && <p className="text-xs text-rose-300">{state.error}</p>}
      {state.message && <p className="text-xs text-emerald-300">{state.message}</p>}
    </form>
  );
}
