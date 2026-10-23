"use client";

import { createTemplate } from "@/app/actions/templates";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import type { ActionState } from "@/lib/actions";
import type { Channel } from "@/lib/types";
import { Plus } from "lucide-react";
import { useActionState, useCallback, useEffect, useState } from "react";

export function NewTemplateButton({ channel }: { channel: Channel }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-3.5" /> New template
      </Button>
      <Modal open={open} onClose={close} title="New template" description="Use {{first_name}}, {{company}}, {{owner_name}} or {{service}} as placeholders.">
        <TemplateForm channel={channel} onDone={close} />
      </Modal>
    </>
  );
}

function TemplateForm({ channel, onDone }: { channel: Channel; onDone: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createTemplate, {});
  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={action}>
      <input type="hidden" name="channel" value={channel} />
      <ModalBody className="grid grid-cols-1 gap-4">
        <div>
          <Label htmlFor="tpl-name">Name *</Label>
          <Input id="tpl-name" name="name" required placeholder="e.g. Quote follow-up" />
        </div>
        <div>
          <Label htmlFor="tpl-body">Message *</Label>
          <Textarea id="tpl-body" name="body" required placeholder="Hi {{first_name}}, …" />
        </div>
        {channel === "whatsapp" && (
          <div>
            <Label htmlFor="tpl-external">Meta template name (once approved)</Label>
            <Input id="tpl-external" name="external_template_name" placeholder="quote_follow_up_v1" />
          </div>
        )}
      </ModalBody>
      <ModalFooter error={state.error}>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Save template"}
        </Button>
      </ModalFooter>
    </form>
  );
}
