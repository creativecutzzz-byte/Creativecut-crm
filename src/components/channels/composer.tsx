"use client";

import { simulateMessage, type SimulateState } from "@/app/actions/messages";
import { Button } from "@/components/ui/button";
import { Label, Select, Textarea } from "@/components/ui/input";
import type { MessageTemplate } from "@/lib/types";
import { CheckCircle2, FlaskConical } from "lucide-react";
import { useActionState, useState } from "react";

interface ComposerLead {
  id: string;
  label: string;
  vars: Record<string, string>;
}

function render(body: string, vars: Record<string, string>) {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

export function Composer({ channel, leads, templates, initialLeadId }: { channel: "whatsapp" | "instagram"; leads: ComposerLead[]; templates: MessageTemplate[]; initialLeadId?: string }) {
  const [leadId, setLeadId] = useState(initialLeadId && leads.some((l) => l.id === initialLeadId) ? initialLeadId : (leads[0]?.id ?? ""));
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const lead = leads.find((l) => l.id === leadId);
  const template = templates.find((t) => t.id === templateId);
  const [body, setBody] = useState(() => (template && lead ? render(template.body, lead.vars) : ""));
  const [state, action, pending] = useActionState<SimulateState, FormData>(simulateMessage, {});

  const applyTemplate = (tId: string, lId: string) => {
    const t = templates.find((x) => x.id === tId);
    const l = leads.find((x) => x.id === lId);
    if (t && l) setBody(render(t.body, l.vars));
  };

  if (leads.length === 0) {
    return <p className="text-sm text-muted">No leads have a {channel === "whatsapp" ? "WhatsApp number" : "Instagram handle"} yet.</p>;
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="channel" value={channel} />
      <input type="hidden" name="template_name" value={template?.external_template_name ?? ""} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="lead_id">To</Label>
          <Select
            id="lead_id"
            name="lead_id"
            value={leadId}
            onChange={(e) => {
              setLeadId(e.target.value);
              applyTemplate(templateId, e.target.value);
            }}
          >
            {leads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="template">Template</Label>
          <Select
            id="template"
            value={templateId}
            onChange={(e) => {
              setTemplateId(e.target.value);
              applyTemplate(e.target.value, leadId);
            }}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="body">Message</Label>
        <Textarea id="body" name="body" value={body} onChange={(e) => setBody(e.target.value)} rows={5} />
        <p className="mt-1 text-right text-[11px] text-subtle">{body.length}/1000</p>
      </div>

      {state.error && <p className="text-xs text-rose-300">{state.error}</p>}
      {state.preview && (
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-3 text-xs">
          <p className="flex items-center gap-1.5 font-medium text-emerald-300">
            <CheckCircle2 className="size-3.5" /> Dry run complete — nothing was sent
          </p>
          <p className="mt-1.5 break-words text-muted">{state.preview}</p>
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={pending}>
          <FlaskConical className="size-4" /> {pending ? "Simulating…" : "Simulate send"}
        </Button>
      </div>
    </form>
  );
}
