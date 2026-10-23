import { deleteTemplate } from "@/app/actions/templates";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import type { Channel, MessageTemplate } from "@/lib/types";
import { Trash2 } from "lucide-react";
import { NewTemplateButton } from "./new-template-button";

export function TemplatesCard({ templates, note, channel, editable }: { templates: MessageTemplate[]; note?: string; channel: Channel; editable?: boolean }) {
  return (
    <Card>
      <CardHeader title="Templates" description={note} action={editable && <NewTemplateButton channel={channel} />} />
      <ul className="divide-y divide-line px-5 pt-2 pb-3">
        {templates.map((t) => (
          <li key={t.id} className="group py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{t.name}</p>
              <div className="flex items-center gap-2">
                {t.external_template_name && <Badge>{t.external_template_name}</Badge>}
                {editable && (
                  <ConfirmForm action={deleteTemplate} id={t.id} message={`Delete the “${t.name}” template?`}>
                    <button type="submit" aria-label={`Delete ${t.name}`} className="grid size-7 place-items-center rounded-md text-subtle opacity-60 hover:bg-white/5 hover:text-rose-300 group-hover:opacity-100">
                      <Trash2 className="size-3.5" />
                    </button>
                  </ConfirmForm>
                )}
              </div>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted">{t.body}</p>
          </li>
        ))}
        {templates.length === 0 && <li className="py-6 text-center text-xs text-subtle">No templates yet.</li>}
      </ul>
    </Card>
  );
}
