"use client";

import { createClientRecord, deleteClientRecord, updateClientRecord } from "@/app/actions/clients";
import { Button } from "@/components/ui/button";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import type { ActionState } from "@/lib/actions";
import { CLIENT_STATUS, SERVICES } from "@/lib/constants";
import { assignableMembers } from "@/lib/form-utils";
import type { Client } from "@/lib/types";
import { CURRENCY } from "@/lib/utils";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useActionState, useCallback, useEffect, useState } from "react";

type Member = { user_id: string | null; full_name: string; status?: string };

export function NewClientButton({ team }: { team: Member[] }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> New client
      </Button>
      <Modal open={open} onClose={close} title="New client">
        <ClientForm team={team} onDone={close} />
      </Modal>
    </>
  );
}

export function ClientActions({ client, team }: { client: Client; team: Member[] }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Pencil className="size-4" /> Edit
      </Button>
      <ConfirmForm action={deleteClientRecord} id={client.id} message={`Delete ${client.company ?? client.name}? This also removes its timeline and tasks.`}>
        <Button type="submit" variant="ghost" aria-label="Delete client" title="Delete client">
          <Trash2 className="size-4" />
        </Button>
      </ConfirmForm>
      <Modal open={open} onClose={close} title="Edit client">
        <ClientForm client={client} team={team} onDone={close} />
      </Modal>
    </>
  );
}

function ClientForm({ client, team, onDone }: { client?: Client; team: Member[]; onDone: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(client ? updateClientRecord : createClientRecord, {});
  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={action}>
      {client && <input type="hidden" name="id" value={client.id} />}
      <ModalBody>
        <div>
          <Label htmlFor="c-name">Contact name *</Label>
          <Input id="c-name" name="name" required defaultValue={client?.name} />
        </div>
        <div>
          <Label htmlFor="c-company">Company</Label>
          <Input id="c-company" name="company" defaultValue={client?.company ?? ""} />
        </div>
        <div>
          <Label htmlFor="c-industry">Industry</Label>
          <Input id="c-industry" name="industry" defaultValue={client?.industry ?? ""} />
        </div>
        <div>
          <Label htmlFor="c-status">Status</Label>
          <Select id="c-status" name="status" defaultValue={client?.status ?? "onboarding"}>
            {Object.entries(CLIENT_STATUS).map(([id, { label }]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="c-email">Email</Label>
          <Input id="c-email" name="email" type="email" defaultValue={client?.email ?? ""} />
        </div>
        <div>
          <Label htmlFor="c-phone">Phone</Label>
          <Input id="c-phone" name="phone" type="tel" defaultValue={client?.phone ?? ""} />
        </div>
        <div>
          <Label htmlFor="c-whatsapp">WhatsApp</Label>
          <Input id="c-whatsapp" name="whatsapp_number" type="tel" placeholder="+91…" defaultValue={client?.whatsapp_number ?? ""} />
        </div>
        <div>
          <Label htmlFor="c-instagram">Instagram</Label>
          <Input id="c-instagram" name="instagram_handle" placeholder="@handle" defaultValue={client?.instagram_handle ?? ""} />
        </div>
        <div>
          <Label htmlFor="c-website">Website</Label>
          <Input id="c-website" name="website" placeholder="example.com" defaultValue={client?.website ?? ""} />
        </div>
        <div>
          <Label htmlFor="c-retainer">Monthly retainer ({CURRENCY})</Label>
          <Input id="c-retainer" name="monthly_retainer" type="number" min={0} step={500} defaultValue={client?.monthly_retainer ?? 0} />
        </div>
        <div>
          <Label htmlFor="c-started">Client since</Label>
          <Input id="c-started" name="started_at" type="date" defaultValue={client?.started_at ?? new Date().toISOString().slice(0, 10)} />
        </div>
        <div>
          <Label htmlFor="c-health">Health score (0–100)</Label>
          <Input id="c-health" name="health_score" type="number" min={0} max={100} defaultValue={client?.health_score ?? ""} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="c-owner">Account owner</Label>
          <Select id="c-owner" name="owner_id" defaultValue={client ? (client.owner_id ?? "") : ""}>
            <option value="">{client ? "No owner" : "Me"}</option>
            {assignableMembers(team).map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.full_name}
              </option>
            ))}
          </Select>
        </div>
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-xs font-medium text-muted">Services</legend>
          <div className="flex flex-wrap gap-2">
            {SERVICES.map((service) => (
              <label key={service} className="cursor-pointer">
                <input type="checkbox" name="services" value={service} defaultChecked={client?.services.includes(service)} className="peer sr-only" />
                <span className="inline-block rounded-full border border-line px-3 py-1 text-xs text-muted transition-colors peer-checked:border-accent/50 peer-checked:bg-accent-soft peer-checked:text-accent-strong peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40">
                  {service}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </ModalBody>
      <ModalFooter error={state.error}>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : client ? "Save changes" : "Add client"}
        </Button>
      </ModalFooter>
    </form>
  );
}
