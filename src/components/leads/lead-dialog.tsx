"use client";

import { createLead, updateLead, type ActionState } from "@/app/actions/leads";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { LEAD_SOURCES, SERVICES } from "@/lib/constants";
import { assignableMembers, toDateTimeLocal } from "@/lib/form-utils";
import type { Lead } from "@/lib/types";
import { CURRENCY } from "@/lib/utils";
import { useActionState, useEffect } from "react";

type Member = { user_id: string | null; full_name: string; status?: string };

/** Create a lead, or edit one when `lead` is given. */
export function LeadDialog({ open, onClose, lead, team }: { open: boolean; onClose: () => void; lead?: Lead; team: Member[] }) {
  return (
    <Modal open={open} onClose={onClose} title={lead ? "Edit lead" : "New lead"} description={lead ? undefined : "AI scoring runs automatically on save."}>
      <LeadForm lead={lead} team={team} onDone={onClose} />
    </Modal>
  );
}

function LeadForm({ lead, team, onDone }: { lead?: Lead; team: Member[]; onDone: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(lead ? updateLead : createLead, {});

  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={action}>
      {lead && <input type="hidden" name="id" value={lead.id} />}
      <ModalBody>
        <div>
          <Label htmlFor="name">Contact name *</Label>
          <Input id="name" name="name" required defaultValue={lead?.name} />
        </div>
        <div>
          <Label htmlFor="company">Company</Label>
          <Input id="company" name="company" defaultValue={lead?.company ?? ""} />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={lead?.email ?? ""} />
        </div>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" type="tel" defaultValue={lead?.phone ?? ""} />
        </div>
        <div>
          <Label htmlFor="whatsapp_number">WhatsApp</Label>
          <Input id="whatsapp_number" name="whatsapp_number" type="tel" placeholder="+91…" defaultValue={lead?.whatsapp_number ?? ""} />
        </div>
        <div>
          <Label htmlFor="instagram_handle">Instagram</Label>
          <Input id="instagram_handle" name="instagram_handle" placeholder="@handle" defaultValue={lead?.instagram_handle ?? ""} />
        </div>
        <div>
          <Label htmlFor="source">Source</Label>
          <Select id="source" name="source" defaultValue={lead?.source ?? "website"}>
            {Object.entries(LEAD_SOURCES).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="estimated_value">Estimated value ({CURRENCY})</Label>
          <Input id="estimated_value" name="estimated_value" type="number" min={0} step={500} defaultValue={lead?.estimated_value ?? 0} />
        </div>
        <div>
          <Label htmlFor="owner_id">Owner</Label>
          <Select id="owner_id" name="owner_id" defaultValue={lead ? (lead.owner_id ?? "") : ""}>
            <option value="">{lead ? "Unassigned" : "Me"}</option>
            {assignableMembers(team).map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.full_name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="next_follow_up_at">Next follow-up</Label>
          <Input id="next_follow_up_at" name="next_follow_up_at" type="datetime-local" defaultValue={toDateTimeLocal(lead?.next_follow_up_at)} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="website">Website</Label>
          <Input id="website" name="website" placeholder="https://" defaultValue={lead?.website ?? ""} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="personalization">Personalisation line (used in outreach sequences)</Label>
          <Textarea
            id="personalization"
            name="personalization"
            maxLength={600}
            className="min-h-16"
            placeholder="Observation + why it matters + bridge to video. See playbook section 05."
            defaultValue={lead?.personalization ?? ""}
          />
        </div>
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-xs font-medium text-muted">Services of interest</legend>
          <div className="flex flex-wrap gap-2">
            {SERVICES.map((service) => (
              <label key={service} className="cursor-pointer">
                <input type="checkbox" name="service_interest" value={service} defaultChecked={lead?.service_interest.includes(service)} className="peer sr-only" />
                <span className="inline-block rounded-full border border-line px-3 py-1 text-xs text-muted transition-colors peer-checked:border-accent/50 peer-checked:bg-accent-soft peer-checked:text-accent-strong peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40">
                  {service}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex items-start gap-2 text-xs text-muted sm:col-span-2">
          <input type="checkbox" name="marketing_consent" defaultChecked={lead?.marketing_consent} className="mt-0.5 accent-[#8b7cf6]" />
          Lead has opted in to receive automated follow-ups (required for workflows).
        </label>
      </ModalBody>
      <ModalFooter error={state.error}>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : lead ? "Save changes" : "Create lead"}
        </Button>
      </ModalFooter>
    </form>
  );
}
