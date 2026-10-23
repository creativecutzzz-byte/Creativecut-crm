"use client";

import { createTask } from "@/app/actions/tasks";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import type { ActionState } from "@/lib/actions";
import { assignableMembers } from "@/lib/form-utils";
import { Plus } from "lucide-react";
import { useActionState, useCallback, useEffect, useState } from "react";

type Option = { id: string; label: string };

/**
 * Opens a "new task" form. Pass `leadId`/`clientId` to attach the task to a
 * record, or `leads`/`clients` to let the user pick one.
 */
export function NewTaskButton({
  team,
  leadId,
  clientId,
  leads,
  clients,
  size = "md",
  variant = "primary",
}: {
  team: { user_id: string | null; full_name: string; status?: string }[];
  leadId?: string;
  clientId?: string;
  leads?: Option[];
  clients?: Option[];
  size?: "sm" | "md";
  variant?: "primary" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <Plus className="size-4" /> New task
      </Button>
      <Modal open={open} onClose={close} title="New task">
        <TaskForm team={team} leadId={leadId} clientId={clientId} leads={leads} clients={clients} onDone={close} />
      </Modal>
    </>
  );
}

function TaskForm({
  team,
  leadId,
  clientId,
  leads,
  clients,
  onDone,
}: {
  team: { user_id: string | null; full_name: string; status?: string }[];
  leadId?: string;
  clientId?: string;
  leads?: Option[];
  clients?: Option[];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createTask, {});
  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={action}>
      {leadId && <input type="hidden" name="lead_id" value={leadId} />}
      {clientId && <input type="hidden" name="client_id" value={clientId} />}
      <ModalBody>
        <div className="sm:col-span-2">
          <Label htmlFor="task-title">Task *</Label>
          <Input id="task-title" name="title" required placeholder="e.g. Send revised quote" />
        </div>
        <div>
          <Label htmlFor="task-due">Due</Label>
          <Input id="task-due" name="due_at" type="datetime-local" />
        </div>
        <div>
          <Label htmlFor="task-priority">Priority</Label>
          <Select id="task-priority" name="priority" defaultValue="medium">
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="task-assignee">Assignee</Label>
          <Select id="task-assignee" name="assignee_id" defaultValue="">
            <option value="">Me</option>
            {assignableMembers(team).map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.full_name}
              </option>
            ))}
          </Select>
        </div>
        {!leadId && !clientId && leads && clients && (
          <div>
            <Label htmlFor="task-related">Related to</Label>
            <Select
              id="task-related"
              defaultValue=""
              onChange={(e) => {
                const form = e.currentTarget.form!;
                const [kind, id] = e.currentTarget.value.split(":");
                (form.elements.namedItem("lead_id") as HTMLInputElement).value = kind === "lead" ? id! : "";
                (form.elements.namedItem("client_id") as HTMLInputElement).value = kind === "client" ? id! : "";
              }}
            >
              <option value="">Nothing</option>
              <optgroup label="Leads">
                {leads.map((l) => (
                  <option key={l.id} value={`lead:${l.id}`}>
                    {l.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Clients">
                {clients.map((c) => (
                  <option key={c.id} value={`client:${c.id}`}>
                    {c.label}
                  </option>
                ))}
              </optgroup>
            </Select>
            <input type="hidden" name="lead_id" defaultValue="" />
            <input type="hidden" name="client_id" defaultValue="" />
          </div>
        )}
        <div className="sm:col-span-2">
          <Label htmlFor="task-description">Notes</Label>
          <Textarea id="task-description" name="description" className="min-h-16" />
        </div>
      </ModalBody>
      <ModalFooter error={state.error}>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Add task"}
        </Button>
      </ModalFooter>
    </form>
  );
}
