"use client";

import { convertLead, deleteLead, type ActionState } from "@/app/actions/leads";
import { Button } from "@/components/ui/button";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { Input, Label } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import type { Lead } from "@/lib/types";
import { CURRENCY } from "@/lib/utils";
import { BadgeCheck, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useCallback, useState } from "react";
import { LeadDialog } from "./lead-dialog";

export function LeadActions({ lead, team }: { lead: Lead; team: { user_id: string | null; full_name: string; status?: string }[] }) {
  const [editing, setEditing] = useState(false);
  const [converting, setConverting] = useState(false);
  const closeEdit = useCallback(() => setEditing(false), []);
  const closeConvert = useCallback(() => setConverting(false), []);

  return (
    <>
      <Button onClick={() => setEditing(true)}>
        <Pencil className="size-4" /> Edit
      </Button>
      {lead.converted_client_id ? (
        <Link href={`/clients/${lead.converted_client_id}`} className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm text-emerald-300 hover:bg-white/5">
          <BadgeCheck className="size-4" /> View client
        </Link>
      ) : (
        lead.stage !== "lost" && (
          <Button onClick={() => setConverting(true)}>
            <BadgeCheck className="size-4" /> Convert to client
          </Button>
        )
      )}
      <ConfirmForm action={deleteLead} id={lead.id} message={`Delete ${lead.company ?? lead.name}? This also removes its timeline and tasks.`}>
        <Button type="submit" variant="ghost" aria-label="Delete lead" title="Delete lead">
          <Trash2 className="size-4" />
        </Button>
      </ConfirmForm>

      <LeadDialog open={editing} onClose={closeEdit} lead={lead} team={team} />
      <Modal open={converting} onClose={closeConvert} title="Convert to client" description="Marks the lead as won and creates a client record.">
        <ConvertForm lead={lead} onCancel={closeConvert} />
      </Modal>
    </>
  );
}

function ConvertForm({ lead, onCancel }: { lead: Lead; onCancel: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(convertLead, {});
  return (
    <form action={action}>
      <input type="hidden" name="id" value={lead.id} />
      <ModalBody>
        <div>
          <Label htmlFor="monthly_retainer">Monthly retainer ({CURRENCY})</Label>
          <Input id="monthly_retainer" name="monthly_retainer" type="number" min={0} step={500} defaultValue={0} />
        </div>
        <div>
          <Label htmlFor="industry">Industry</Label>
          <Input id="industry" name="industry" placeholder="e.g. Hospitality" />
        </div>
      </ModalBody>
      <ModalFooter error={state.error}>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Converting…" : "Create client"}
        </Button>
      </ModalFooter>
    </form>
  );
}
