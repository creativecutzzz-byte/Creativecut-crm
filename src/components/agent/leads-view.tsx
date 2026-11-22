"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, ExternalLink, Info, Link2, Mail, Save, X, XCircle } from "lucide-react";
import { approveDrafts, saveDraft, skipDraft, type ActionResult } from "@/app/actions/agent";
import { cn } from "@/lib/utils";
import type { DraftStatus, Lead, Mode, Sender } from "@/lib/agent/types";
import { Button, DraftBadge, Notice } from "./ui";
import { Result } from "./home-client";

type View = "review" | "approved" | "sent" | "no_email" | "all";
const VIEWS: { v: View; label: string; match: (l: Lead) => boolean }[] = [
  { v: "review", label: "Needs Review", match: (l) => !!l.draft && (l.draft.status === "awaiting_approval" || l.draft.status === "needs_review") },
  { v: "approved", label: "Approved", match: (l) => !!l.draft && ["approved", "ready", "sending"].includes(l.draft.status) },
  { v: "sent", label: "Sent", match: (l) => !!l.draft && ["sent", "replied", "bounced", "opted_out"].includes(l.draft.status) },
  { v: "no_email", label: "Form or DM only", match: (l) => !l.draft },
  { v: "all", label: "All", match: () => true },
];

export function statusOf(l: Lead): DraftStatus {
  return l.draft?.status ?? "no_email";
}

export function who(l: Lead) {
  if (l.person && l.company) return { title: l.person, sub: l.company };
  if (l.company) return { title: l.company, sub: "Company" };
  if (l.person) return { title: l.person, sub: l.source };
  return { title: "Unnamed poster", sub: l.source };
}

function initials(s: string) {
  return s.replace(/\(demo\)/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
}

/** Company logo from logoapi.sh (free, no key) when the brand's website is known; initials otherwise. */
function LeadAvatar({ website, name }: { website: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const domain = website ? website.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] : "";
  if (domain && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`https://logoapi.sh/${domain}.svg`} alt="" aria-hidden width={44} height={44} onError={() => setFailed(true)} className="size-11 shrink-0 rounded-full border border-ag-rule bg-white object-contain p-1.5" />
    );
  }
  return (
    <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-ag-brand-soft text-[14px] font-bold text-ag-brand">
      {initials(name)}
    </span>
  );
}

export function LeadsView({ leads, senders, mode, sendingLive }: { leads: Lead[]; senders: Sender[]; mode: Mode; sendingLive: boolean }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const waiting = leads.some(VIEWS[0]!.match);
  const view = (params.get("view") as View) || (waiting ? "review" : "all");
  const openId = params.get("lead");
  const list = useMemo(() => leads.filter(VIEWS.find((x) => x.v === view)!.match), [leads, view]);
  const open = leads.find((l) => l.id === openId) ?? null;
  const [selected, setSelected] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [r, setR] = useState<ActionResult | null>(null);

  const approvable = list.filter((l) => l.draft?.status === "awaiting_approval" || l.draft?.status === "ready");
  const chosen = leads.filter((l) => l.draft && selected.includes(l.draft.attemptId));

  const go = (next: Record<string, string | null>) => {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null) q.delete(k);
      else q.set(k, v);
    }
    router.push(`${path}?${q}`, { scroll: false });
  };

  return (
    <div>
      <div role="tablist" aria-label="Lead groups" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {VIEWS.map((x) => {
          const n = leads.filter(x.match).length;
          const on = x.v === view;
          return (
            <button
              key={x.v}
              role="tab"
              aria-selected={on}
              onClick={() => {
                setSelected([]);
                setConfirming(false);
                go({ view: x.v, lead: null });
              }}
              className={cn("h-10 shrink-0 rounded-full border px-4 text-[14px] font-medium", on ? "border-ag-brand bg-ag-brand text-white" : "border-ag-rule-2 bg-ag-card text-ag-text-2 hover:text-ag-text")}
            >
              {x.label} <span className={on ? "text-white/80" : "text-ag-text-3"}>{n}</span>
            </button>
          );
        })}
      </div>

      {view === "review" && approvable.length > 1 ? (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl border border-ag-rule bg-ag-card px-4 py-3">
          <label className="flex items-center gap-2 text-[15px]">
            <input
              type="checkbox"
              className="size-5 accent-[var(--color-ag-brand)]"
              checked={selected.length === approvable.length && approvable.length > 0}
              onChange={(e) => setSelected(e.target.checked ? approvable.map((l) => l.draft!.attemptId) : [])}
            />
            Select all ready drafts
          </label>
          {selected.length ? (
            confirming ? (
              <div className="flex w-full flex-col gap-3 sm:ml-auto sm:w-auto sm:flex-row sm:items-center">
                <p className="text-[15px]">
                  Approve <b>{chosen.length} email{chosen.length === 1 ? "" : "s"}</b> to <b>{new Set(chosen.map((l) => l.draft!.to)).size} recipient{new Set(chosen.map((l) => l.draft!.to)).size === 1 ? "" : "s"}</b>?
                  {sendingLive ? " They go out on the next run." : " Live sending is off, so they'll wait."}
                </p>
                <div className="flex gap-2">
                  <Button variant="primary" disabled={pending} onClick={() => start(async () => { const res = await approveDrafts(selected); setR(res); if (res.ok) { setSelected([]); setConfirming(false); } })}>
                    <CheckCircle2 aria-hidden className="size-4" /> Yes, approve
                  </Button>
                  <Button onClick={() => setConfirming(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <Button variant="primary" className="sm:ml-auto" onClick={() => setConfirming(true)}>
                Approve {selected.length} selected
              </Button>
            )
          ) : null}
        </div>
      ) : null}
      <div className="mb-3">
        <Result r={r} />
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ag-rule-2 bg-ag-card px-6 py-12 text-center">
          <CheckCircle2 aria-hidden className="mx-auto size-8 text-ag-ok" />
          <p className="mt-3 text-lg font-semibold">{view === "review" ? "Nothing waiting for you" : "Nothing here yet"}</p>
          <p className="mt-1 text-ag-text-2">{view === "review" ? "New drafts appear here after each run." : "Leads appear here after a run."}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((l) => {
            const w = who(l);
            const canPick = l.draft?.status === "awaiting_approval" || l.draft?.status === "ready";
            const isSel = !!l.draft && selected.includes(l.draft.attemptId);
            return (
              <li key={l.id} className={cn("flex items-stretch rounded-2xl border bg-ag-card", openId === l.id ? "border-ag-brand" : "border-ag-rule hover:border-ag-rule-2")}>
                {view === "review" && approvable.length > 1 ? (
                  <label className="flex items-center pl-4">
                    <input
                      type="checkbox"
                      aria-label={`Select ${w.title}`}
                      disabled={!canPick}
                      className="size-5 accent-[var(--color-ag-brand)] disabled:opacity-30"
                      checked={isSel}
                      onChange={(e) => setSelected((s) => (e.target.checked ? [...s, l.draft!.attemptId] : s.filter((x) => x !== l.draft!.attemptId)))}
                    />
                  </label>
                ) : null}
                <button type="button" onClick={() => go({ lead: l.id })} className="flex min-w-0 flex-1 items-center gap-4 p-4 text-left">
                  <LeadAvatar website={l.website ?? null} name={w.title} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {w.title} <span className="font-normal text-ag-text-3">· {w.sub}</span>
                    </span>
                    <span className="mt-0.5 block text-[14px] text-ag-text-2 sm:truncate">{l.reason}</span>
                    <span className="mt-2 block sm:hidden">
                      <DraftBadge status={statusOf(l)} />
                    </span>
                  </span>
                  <span className="hidden shrink-0 sm:block">
                    <DraftBadge status={statusOf(l)} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {open ? <LeadPanel key={open.id} lead={open} senders={senders} mode={mode} sendingLive={sendingLive} onClose={() => go({ lead: null })} /> : null}
    </div>
  );
}

function LeadPanel({ lead, senders, mode, sendingLive, onClose }: { lead: Lead; senders: Sender[]; mode: Mode; sendingLive: boolean; onClose: () => void }) {
  const d = lead.draft;
  const [subject, setSubject] = useState(d?.subject ?? "");
  const [body, setBody] = useState(d?.body ?? "");
  const [sender, setSender] = useState<string>(d?.sender ?? "");
  const [pending, start] = useTransition();
  const [r, setR] = useState<ActionResult | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const w = who(lead);
  const dirty = !!d && (subject !== d.subject || body !== d.body || sender !== (d.sender ?? ""));
  const editable = !!d && ["awaiting_approval", "needs_review", "ready", "approved"].includes(d.status);
  const connected = senders.filter((s) => s.status === "connected" && s.email);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const act = (fn: () => Promise<ActionResult>) => start(async () => setR(await fn()));
  const saveThen = async (next?: () => Promise<ActionResult>) => {
    if (dirty && d) {
      const s = await saveDraft(d.attemptId, subject, body, sender || null);
      if (!s.ok || !next) return s;
    }
    return next ? next() : { ok: true, message: "No changes to save." };
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`${w.title} — lead details`}>
      <button type="button" aria-label="Close" className="absolute inset-0 hidden bg-black/30 sm:block" onClick={onClose} />
      <div className="relative flex h-full w-full flex-col bg-ag-paper shadow-2xl sm:max-w-[600px] sm:border-l sm:border-ag-rule">
        <header className="flex items-start gap-3 border-b border-ag-rule bg-ag-card px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold">{w.title}</p>
            <p className="truncate text-[14px] text-ag-text-2">{w.sub}</p>
            <div className="mt-2">
              <DraftBadge status={statusOf(lead)} />
            </div>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="grid size-11 place-items-center rounded-xl hover:bg-black/5" aria-label="Close panel">
            <X aria-hidden className="size-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <section className="mb-6">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-ag-text-3">Why they qualified</h3>
            <p className="mt-1.5 text-[15px]">{lead.reason}</p>
          </section>

          <section className="mb-6">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-ag-text-3">Source</h3>
            <p className="mt-1.5 text-[14px] text-ag-text-2">
              {lead.source}
              {lead.postDate ? ` · posted ${lead.postDate}` : " · post date not found"}
            </p>
            <blockquote className="mt-2 rounded-xl border-l-4 border-ag-rule-2 bg-ag-card px-4 py-3 text-[15px] text-ag-text-2">“{lead.excerpt}”</blockquote>
            <a href={lead.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[15px] font-semibold text-ag-brand hover:underline">
              Open the original post <ExternalLink aria-hidden className="size-4" />
            </a>
            {lead.research ? <p className="mt-3 text-[14px] text-ag-text-2"><b className="font-semibold text-ag-text">Research:</b> {lead.research}</p> : null}
          </section>

          {!d ? (
            <section>
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-ag-text-3">How to reach them</h3>
              <p className="mt-1.5 flex items-center gap-2 text-[15px]">
                <Mail aria-hidden className="size-4 text-ag-text-3" /> {lead.contactChannel || "See the original post"}
              </p>
              <p className="mt-2 text-[14px] text-ag-text-2">They didn&apos;t publish an email for applications, so the agent won&apos;t email them. Reply through the post if it&apos;s a good fit.</p>
            </section>
          ) : (
            <section className="flex flex-col gap-4">
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-ag-text-3">Email</h3>
              {d.problem ? <Notice tone="bad">{d.problem}</Notice> : null}
              <div className="grid gap-1">
                <span className="text-[14px] font-medium">To</span>
                <p className="rounded-xl border border-ag-rule bg-black/[0.03] px-3 py-2.5 text-[15px]">{d.to}</p>
              </div>
              <label className="grid gap-1">
                <span className="text-[14px] font-medium">From</span>
                <select
                  value={sender}
                  disabled={!editable || pending}
                  onChange={(e) => setSender(e.target.value)}
                  className="h-11 rounded-xl border border-ag-rule-2 bg-ag-card px-3 text-[15px]"
                >
                  <option value="">Pick automatically (the sender with the most sends left)</option>
                  {connected.map((s) => (
                    <option key={s.slot} value={s.email!}>
                      {s.email} — {Math.max(0, (s.warmLimit === null ? s.dailyCap : Math.min(s.dailyCap, s.warmLimit)) - s.sentToday)} left today
                    </option>
                  ))}
                </select>
                {!connected.length ? <span className="text-[13px] text-ag-warn">No Gmail sender connected yet — connect one in Settings.</span> : null}
              </label>
              <label className="grid gap-1">
                <span className="text-[14px] font-medium">Subject</span>
                <input value={subject} disabled={!editable || pending} onChange={(e) => setSubject(e.target.value)} className="h-11 rounded-xl border border-ag-rule-2 bg-ag-card px-3 text-[15px]" />
              </label>
              <label className="grid gap-1">
                <span className="text-[14px] font-medium">Message</span>
                <textarea value={body} disabled={!editable || pending} onChange={(e) => setBody(e.target.value)} rows={14} className="rounded-xl border border-ag-rule-2 bg-ag-card px-3 py-2.5 text-[15px] leading-relaxed" />
                <span className="flex items-start gap-1.5 text-[13px] text-ag-text-3">
                  <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" /> Words followed by a web address in brackets, like “Creative Cut (https://creativecut.in)”, become a clickable link in the sent email.
                </span>
              </label>
              {d.sampleUrl ? (
                <p className="flex items-start gap-2 text-[14px] text-ag-text-2">
                  <Link2 aria-hidden className="mt-0.5 size-4 shrink-0" />
                  <span>
                    Portfolio sample: <a className="font-semibold text-ag-brand hover:underline" href={d.sampleUrl} target="_blank" rel="noopener noreferrer">{d.sampleTitle || "video"}</a> (checked: plays without signing in)
                  </span>
                </p>
              ) : null}
              {d.sentAt ? <p className="text-[14px] text-ag-text-2">Sent {d.sentAt}{d.sender ? ` from ${d.sender}` : ""}.</p> : null}
            </section>
          )}
          <div className="mt-4">
            <Result r={r} />
          </div>
        </div>

        {d && editable ? (
          <footer className="flex flex-wrap gap-2 border-t border-ag-rule bg-ag-card px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {d.status !== "approved" ? (
              <Button variant="primary" size="lg" className="flex-1" disabled={pending} onClick={() => act(() => saveThen(() => approveDrafts([d.attemptId])))}>
                <CheckCircle2 aria-hidden className="size-5" /> {dirty ? "Save & Approve" : "Approve"}
              </Button>
            ) : null}
            {dirty ? (
              <Button size="lg" disabled={pending} onClick={() => act(() => saveThen())}>
                <Save aria-hidden className="size-5" /> Save
              </Button>
            ) : null}
            <Button variant="danger" size="lg" disabled={pending} onClick={() => act(() => skipDraft(d.attemptId))}>
              <XCircle aria-hidden className="size-5" /> Skip
            </Button>
            <p className="w-full text-[13px] text-ag-text-3">
              {mode === "AUTO" && d.status === "ready" ? "Auto mode: this sends on the next run unless you skip it. " : ""}
              {sendingLive ? "Approved emails go out on the next run, inside your send window." : "Preview only — live sending is off, so nothing is sent yet."}
            </p>
          </footer>
        ) : null}
      </div>
    </div>
  );
}
