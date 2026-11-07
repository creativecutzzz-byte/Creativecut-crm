"use client";

import { approveDraft, rejectDraft } from "@/app/actions/outreach";
import { InstagramIcon, LinkedInIcon, WhatsAppIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { ScorePill } from "@/components/ui/score-pill";
import type { ActionState } from "@/lib/actions";
import type { OutreachDraft } from "@/lib/data";
import { cn, formatRelative } from "@/lib/utils";
import { Check, Copy, ExternalLink, Mail, Reply, X } from "lucide-react";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";

const channelMeta = {
  email: { label: "Email", icon: Mail },
  whatsapp: { label: "WhatsApp", icon: WhatsAppIcon },
  instagram: { label: "Instagram", icon: InstagramIcon },
  linkedin: { label: "LinkedIn", icon: LinkedInIcon },
} as const;

const statusVariant = { pending: "warning", approved: "info", sent: "success", failed: "danger", rejected: "neutral", cancelled: "neutral" } as const;

const PLACEHOLDER = /\{\{\s*\w+\s*\}\}|\[(?:Add|Your)[^\]]*\]/;

export function DraftCard({ draft, canApprove }: { draft: OutreachDraft; canApprove: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(approveDraft, {});
  const [rejecting, startReject] = useTransition();
  const [rejectState, setRejectState] = useState<ActionState>({});
  const [subject, setSubject] = useState(draft.subject ?? "");
  const [body, setBody] = useState(draft.body);
  const [copied, setCopied] = useState(false);
  const editable = canApprove && (draft.status === "pending" || draft.status === "failed");
  const locked = draft.channel === "whatsapp" && draft.kind === "sequence"; // template text is fixed by Meta
  const hasPlaceholder = PLACEHOLDER.test(`${subject}\n${body}`);
  const done = state.ok || rejectState.ok;
  const meta = channelMeta[draft.channel];
  const Icon = meta.icon;
  const manual = draft.channel === "linkedin";

  const reject = (stop: boolean) =>
    startReject(async () => {
      setRejectState(await rejectDraft(draft.id, stop));
    });

  const copy = async () => {
    await navigator.clipboard.writeText(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <article className={cn("card p-5", done && "opacity-60")}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/5">
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
              {draft.lead ? (
                <Link href={`/leads/${draft.lead.id}`} className="truncate hover:underline">
                  {draft.lead.name}
                  {draft.lead.company && draft.lead.company !== draft.lead.name ? ` · ${draft.lead.company}` : ""}
                </Link>
              ) : (
                "Unknown lead"
              )}
              {draft.lead && <ScorePill score={draft.lead.ai_score} />}
            </p>
            <p className="truncate text-[11px] text-subtle">
              {draft.kind === "reply" ? (
                <span className="inline-flex items-center gap-1">
                  <Reply className="size-3" /> {draft.step_label}
                </span>
              ) : (
                <>
                  {meta.label} · {draft.step_label} {draft.step !== null ? `(step ${draft.step + 1})` : ""}
                </>
              )}{" "}
              · {draft.to_address ?? "no address"} · written {formatRelative(draft.created_at)}
            </p>
          </div>
        </div>
        <Badge variant={statusVariant[draft.status]}>
          {draft.status === "approved" && draft.scheduled_for ? `scheduled ${formatRelative(draft.scheduled_for)}` : draft.status}
        </Badge>
      </header>

      {draft.notes && <p className="mt-3 rounded-lg border border-line bg-surface-2/60 px-3 py-2 text-xs text-muted">{draft.notes}</p>}
      {draft.error && <p className="mt-2 text-xs text-rose-300">{draft.error}</p>}

      <form action={action} className="mt-3 space-y-2">
        <input type="hidden" name="id" value={draft.id} />
        {draft.channel === "email" && (
          <Input name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!editable} placeholder="Subject" aria-label="Subject" />
        )}
        {locked && <input type="hidden" name="body" value={body} />}
        <Textarea
          name={locked ? undefined : "body"}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={!editable || locked}
          rows={Math.min(14, Math.max(4, body.split("\n").length + 1))}
          aria-label="Message"
          className="text-[13px] leading-relaxed"
        />
        {hasPlaceholder && editable && <p className="text-xs text-amber-300">Fill in the highlighted [Add …] / {"{{…}}"} parts before approving.</p>}
        {(state.error || state.message || rejectState.error || rejectState.message) && (
          <p className={cn("text-xs", state.error || rejectState.error ? "text-rose-300" : "text-emerald-300")}>
            {state.error ?? rejectState.error ?? state.message ?? rejectState.message}
          </p>
        )}

        {editable && !done && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {manual ? (
              <>
                <Button size="sm" onClick={copy}>
                  <Copy className="size-3.5" /> {copied ? "Copied" : "Copy text"}
                </Button>
                {draft.lead?.linkedin_url && (
                  <a href={draft.lead.linkedin_url} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 text-xs hover:bg-surface-3">
                    <ExternalLink className="size-3.5" /> Open LinkedIn
                  </a>
                )}
                <Button size="sm" variant="primary" type="submit" disabled={pending || hasPlaceholder}>
                  <Check className="size-3.5" /> {pending ? "Saving…" : "I did this"}
                </Button>
              </>
            ) : (
              <Button size="sm" variant="primary" type="submit" disabled={pending || hasPlaceholder}>
                <Check className="size-3.5" /> {pending ? "Sending…" : "Approve & send"}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => reject(false)} disabled={rejecting}>
              <X className="size-3.5" /> Skip this one
            </Button>
            {draft.kind === "sequence" && (
              <Button size="sm" variant="ghost" onClick={() => reject(true)} disabled={rejecting}>
                Stop autopilot for this lead
              </Button>
            )}
          </div>
        )}
      </form>
    </article>
  );
}
