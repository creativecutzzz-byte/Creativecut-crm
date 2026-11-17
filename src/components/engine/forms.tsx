"use client";

import { addDomainWithMailboxes, markMeeting, pauseMailbox, recordPostmaster, requeueReview, resumeDomain, resumeMailbox, uploadLeads } from "@/app/actions/engine";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import type { ActionState } from "@/lib/actions";
import { useActionState } from "react";

type Action = (s: ActionState, f: FormData) => Promise<ActionState>;

function Status({ state }: { state: ActionState }) {
  if (state.error) return <p className="text-xs text-rose-300">{state.error}</p>;
  if (state.message) return <p className="text-xs text-emerald-300">{state.message}</p>;
  return null;
}

function OneClick({ action, fields, label, variant = "secondary" }: { action: Action; fields: Record<string, string | number>; label: string; variant?: "primary" | "secondary" | "ghost" }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});
  return (
    <form action={formAction} className="inline-flex flex-col items-end gap-1">
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <Button type="submit" size="sm" variant={variant} disabled={pending}>
        {pending ? "…" : label}
      </Button>
      {state.error && <span className="text-[11px] text-rose-300">{state.error}</span>}
    </form>
  );
}

export const ResumeMailbox = ({ id }: { id: number }) => <OneClick action={resumeMailbox} fields={{ id }} label="Resume" variant="primary" />;
export const PauseMailbox = ({ id }: { id: number }) => <OneClick action={pauseMailbox} fields={{ id }} label="Pause" variant="ghost" />;
export const ResumeDomain = ({ id }: { id: number }) => <OneClick action={resumeDomain} fields={{ id }} label="Resume domain" variant="primary" />;
export const MarkMeeting = ({ leadId }: { leadId: string }) => <OneClick action={markMeeting} fields={{ lead_id: leadId }} label="Meeting booked" variant="ghost" />;
export const ReviewDecision = ({ leadId }: { leadId: string }) => (
  <span className="inline-flex gap-2">
    <OneClick action={requeueReview} fields={{ lead_id: leadId, decision: "qualify" }} label="Qualify" />
    <OneClick action={requeueReview} fields={{ lead_id: leadId, decision: "disqualify" }} label="Disqualify" variant="ghost" />
  </span>
);

export function UploadLeadsForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(uploadLeads, {});
  return (
    <form action={formAction} className="space-y-2">
      <Label htmlFor="engine-csv">Lead CSV (email, first_name, company, website; optional last_name, title, country, timezone, employees, segment)</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input id="engine-csv" name="file" type="file" accept=".csv,text/csv" required className="file:mr-3 file:rounded file:border-0 file:bg-surface-3 file:px-2 file:py-1 file:text-xs file:text-fg" />
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Importing…" : "Upload"}
        </Button>
      </div>
      <Status state={state} />
    </form>
  );
}

export function AddDomainForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(addDomainWithMailboxes, {});
  return (
    <form action={formAction} className="space-y-2">
      <div>
        <Label htmlFor="engine-domain">Sending domain (already authenticated with SPF, DKIM, DMARC)</Label>
        <Input id="engine-domain" name="domain" placeholder="trybrand.com" required />
      </div>
      <div>
        <Label htmlFor="engine-mailboxes">Mailboxes, one per line — real people who read them</Label>
        <Textarea id="engine-mailboxes" name="mailboxes" rows={3} placeholder={"Aanya Mehta <aanya@trybrand.com>\nRohan Das <rohan@trybrand.com>"} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Add domain"}
      </Button>
      <Status state={state} />
    </form>
  );
}

export function PostmasterForm({ domains }: { domains: { id: number; name: string }[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(recordPostmaster, {});
  if (!domains.length) return <p className="text-xs text-muted">Add a domain first.</p>;
  return (
    <form action={formAction} className="grid gap-2 sm:grid-cols-[1fr_7rem_8rem_auto] sm:items-end">
      <div>
        <Label htmlFor="pm-domain">Domain</Label>
        <Select id="pm-domain" name="domain_id">
          {domains.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="pm-spam">Spam rate %</Label>
        <Input id="pm-spam" name="spam_rate" inputMode="decimal" placeholder="0.05" />
      </div>
      <div>
        <Label htmlFor="pm-rep">Reputation</Label>
        <Select id="pm-rep" name="reputation" defaultValue="">
          <option value="">—</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
          <option value="BAD">Bad</option>
        </Select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "…" : "Save"}
      </Button>
      <div className="sm:col-span-4">
        <Status state={state} />
      </div>
    </form>
  );
}
