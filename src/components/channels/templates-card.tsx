import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import type { MessageTemplate } from "@/lib/types";

export function TemplatesCard({ templates, note }: { templates: MessageTemplate[]; note?: string }) {
  return (
    <Card>
      <CardHeader title="Templates" description={note} />
      <ul className="divide-y divide-line px-5 pt-2 pb-3">
        {templates.map((t) => (
          <li key={t.id} className="py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{t.name}</p>
              {t.external_template_name && <Badge>{t.external_template_name}</Badge>}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted">{t.body}</p>
          </li>
        ))}
        {templates.length === 0 && <li className="py-6 text-center text-xs text-subtle">No templates yet.</li>}
      </ul>
    </Card>
  );
}
