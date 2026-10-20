"use client";

import { createLead, type ActionState } from "@/app/actions/leads";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { LEAD_SOURCES, SERVICES } from "@/lib/constants";
import { X } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";

export function NewLeadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState<ActionState, FormData>(createLead, {});

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (state.ok) onClose();
  }, [state, onClose]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-line bg-surface p-0 text-fg shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <form action={action}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">New lead</h2>
            <p className="text-xs text-muted">AI scoring runs automatically on save.</p>
          </div>
          <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-white/5" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        <div className="grid max-h-[65vh] grid-cols-1 gap-4 overflow-y-auto px-5 py-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="name">Contact name *</Label>
            <Input id="name" name="name" required />
          </div>
          <div>
            <Label htmlFor="company">Company</Label>
            <Input id="company" name="company" />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" type="tel" />
          </div>
          <div>
            <Label htmlFor="whatsapp_number">WhatsApp</Label>
            <Input id="whatsapp_number" name="whatsapp_number" type="tel" placeholder="+1…" />
          </div>
          <div>
            <Label htmlFor="instagram_handle">Instagram</Label>
            <Input id="instagram_handle" name="instagram_handle" placeholder="@handle" />
          </div>
          <div>
            <Label htmlFor="source">Source</Label>
            <Select id="source" name="source" defaultValue="website">
              {Object.entries(LEAD_SOURCES).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="estimated_value">Estimated value (USD)</Label>
            <Input id="estimated_value" name="estimated_value" type="number" min={0} step={500} defaultValue={0} />
          </div>
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-xs font-medium text-muted">Services of interest</legend>
            <div className="flex flex-wrap gap-2">
              {SERVICES.map((service) => (
                <label key={service} className="cursor-pointer">
                  <input type="checkbox" name="service_interest" value={service} className="peer sr-only" />
                  <span className="inline-block rounded-full border border-line px-3 py-1 text-xs text-muted transition-colors peer-checked:border-accent/50 peer-checked:bg-accent-soft peer-checked:text-accent-strong peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40">
                    {service}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-start gap-2 text-xs text-muted sm:col-span-2">
            <input type="checkbox" name="marketing_consent" className="mt-0.5 accent-[#8b7cf6]" />
            Lead has opted in to receive automated follow-ups (required for workflows).
          </label>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-4">
          <p className="min-h-4 text-xs text-rose-300">{state.error}</p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Saving…" : "Create lead"}
            </Button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
