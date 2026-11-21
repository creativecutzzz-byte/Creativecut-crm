"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ExternalLink, Globe, KeyRound, LogIn, Mail, Search, Sparkles, Trash2, type LucideIcon } from "lucide-react";
import { disconnectSender, removeApiKey, saveApiKey, setSenderCap, type ActionResult } from "@/app/actions/agent";
import { PROVIDERS, VIBE_SHUTDOWN } from "@/lib/agent/connections";
import { cn } from "@/lib/utils";
import type { ApiProvider, ApiSlot, Connection, Sender } from "@/lib/agent/types";
import { Button, ButtonLink, ConnBadge, Notice } from "./ui";
import { Result } from "./home-client";

const ICON: Record<Connection["key"], LucideIcon> = { web_research: Globe, vibe: Sparkles, apollo: Search, gmail: Mail };

export function ConnectionsView({ connections, apiSlots, senders, demo }: { connections: Connection[]; apiSlots: ApiSlot[]; senders: Sender[]; demo: boolean }) {
  const params = useSearchParams();
  const [open, setOpen] = useState<string | null>(params.get("open"));
  const notice = params.get("notice");
  // Links like "Reconnect" open and scroll to the right row.
  useEffect(() => {
    const id = params.get("open");
    if (id) document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, [params]);
  return (
    <div className="flex flex-col gap-3">
      {notice ? <Notice>{notice}</Notice> : null}
      {connections.map((c) => {
        const Icon = ICON[c.key];
        const isOpen = open === c.key;
        const methodLabel = c.method === "Google sign-in" ? "Google sign-in" : c.method;
        return (
          <section key={c.key} id={c.key} className={cn("scroll-mt-24 rounded-2xl border bg-ag-card", isOpen ? "border-ag-brand" : "border-ag-rule")}>
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-start gap-4">
                <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-xl bg-ag-brand-soft text-ag-brand">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[17px] font-semibold">{c.name}</h3>
                  <p className="text-[14px] text-ag-text-2">{c.purpose}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-ag-rule-2 px-2.5 py-1 text-[13px] font-medium text-ag-text-2">
                      {c.method === "Google sign-in" ? <LogIn aria-hidden className="size-3.5" /> : <KeyRound aria-hidden className="size-3.5" />}
                      {methodLabel}
                    </span>
                    <ConnBadge status={c.status} label={c.statusText} />
                  </div>
                </div>
              </div>
              <Button variant={c.status === "connected" ? "secondary" : "primary"} aria-expanded={isOpen} aria-controls={`${c.key}-details`} onClick={() => setOpen(isOpen ? null : c.key)}>
                {c.nextAction}
                <ChevronDown aria-hidden className={cn("size-4 transition-transform", isOpen && "rotate-180")} />
              </Button>
            </div>
            {isOpen ? (
              <div id={`${c.key}-details`} className="border-t border-ag-rule px-5 py-5">
                {c.key === "gmail" ? <Senders senders={senders} demo={demo} /> : <ApiKeyForm provider={c.key} slot={apiSlots.find((a) => a.provider === c.key)} />}
                <dl className="mt-6 grid gap-x-6 gap-y-3 text-[14px] sm:grid-cols-[180px_1fr]">
                  {c.details.map((d) => (
                    <div key={d.label} className="contents">
                      <dt className="font-medium text-ag-text-3">{d.label}</dt>
                      <dd className="break-words text-ag-text">{d.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function ApiKeyForm({ provider, slot }: { provider: ApiProvider; slot: ApiSlot | undefined }) {
  const [key, setKey] = useState("");
  const [pending, start] = useTransition();
  const [r, setR] = useState<ActionResult | null>(null);
  const p = PROVIDERS[provider];
  return (
    <div className="flex flex-col gap-4">
      {provider === "vibe" ? <Notice tone="bad">{VIBE_SHUTDOWN}</Notice> : null}
      {slot?.status === "needs_reconnect" && slot.error ? <Notice tone="bad">{slot.error}</Notice> : null}
      <div className="grid gap-1">
        <label htmlFor={`${provider}-key`} className="text-[15px] font-medium">
          {slot?.status === "connected" ? "Replace API Key" : "API Key"} <span className="font-normal text-ag-text-3">(credential slot {slot?.slot ?? "—"})</span>
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id={`${provider}-key`}
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={slot?.hint ? `Saved: ${slot.hint}` : "Paste your key here"}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="h-11 flex-1 rounded-xl border border-ag-rule-2 bg-ag-card px-3 font-mono text-[15px]"
          />
          <Button variant="primary" disabled={pending || !key.trim()} onClick={() => start(async () => { const res = await saveApiKey(provider, key); setR(res); if (res.ok) setKey(""); })}>
            {pending ? "Checking…" : "Check & Save"}
          </Button>
        </div>
        <p className="text-[13px] text-ag-text-3">We test the key with {p.name === "Web Research" ? "Apify" : p.name} first, then store it in Google Secret Manager. It&apos;s never shown again.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <a href={p.keyUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-ag-brand hover:underline">
          Where do I find my key? <ExternalLink aria-hidden className="size-4" />
        </a>
        {slot?.status === "connected" ? (
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => start(async () => setR(await removeApiKey(provider)))}>
            <Trash2 aria-hidden className="size-4" /> Disconnect
          </Button>
        ) : null}
      </div>
      <Result r={r} />
    </div>
  );
}

function Senders({ senders, demo }: { senders: Sender[]; demo: boolean }) {
  const [pending, start] = useTransition();
  const [r, setR] = useState<ActionResult | null>(null);
  const [caps, setCaps] = useState<Record<number, number>>(Object.fromEntries(senders.map((s) => [s.slot, s.dailyCap])));
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[15px] text-ag-text-2">Up to three Gmail addresses. Each email goes from the sender with the most sends left today. Replies stay in the same Gmail thread.</p>
      <ul className="grid gap-3 md:grid-cols-3">
        {senders.map((s) => {
          const left = Math.max(0, s.dailyCap - s.sentToday);
          return (
            <li key={s.slot} className="flex flex-col gap-3 rounded-xl border border-ag-rule p-4">
              <div>
                <p className="text-[13px] font-semibold uppercase tracking-wide text-ag-text-3">Sender {s.slot}</p>
                <p className="mt-1 break-all font-semibold">{s.email ?? "Empty slot"}</p>
              </div>
              <div>
                <ConnBadge status={s.status} />
              </div>
              {s.email ? (
                <>
                  <p className="text-[15px]">
                    <b className="tabular-nums">{left}</b> of {s.dailyCap} sends left today
                  </p>
                  <label className="flex items-center gap-2 text-[14px]">
                    Daily limit
                    <input type="number" min={1} max={50} value={caps[s.slot] ?? s.dailyCap} onChange={(e) => setCaps((c) => ({ ...c, [s.slot]: Number(e.target.value) }))} className="h-10 w-20 rounded-lg border border-ag-rule-2 bg-ag-card px-2" />
                    {caps[s.slot] !== s.dailyCap ? (
                      <Button size="sm" disabled={pending} onClick={() => start(async () => setR(await setSenderCap(s.slot, caps[s.slot]!)))}>
                        Save
                      </Button>
                    ) : null}
                  </label>
                </>
              ) : null}
              <div className="mt-auto flex flex-wrap gap-2">
                {s.status !== "connected" ? (
                  <ButtonLink href={`/api/agent/gmail/start?slot=${s.slot}`} variant="primary" size="sm">
                    <LogIn aria-hidden className="size-4" /> {s.status === "needs_reconnect" ? "Reconnect with Google" : "Connect with Google"}
                  </ButtonLink>
                ) : (
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => setR(await disconnectSender(s.slot)))}>
                    Disconnect
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {demo ? <p className="text-[13px] text-ag-text-3">Demo data: Google sign-in is only available with live data.</p> : null}
      <Result r={r} />
    </div>
  );
}
