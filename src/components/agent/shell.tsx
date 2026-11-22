"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { CalendarClock, Eye, FlaskConical, Home, Settings, Users } from "lucide-react";
import { chooseDemo } from "@/app/actions/agent";
import { cn } from "@/lib/utils";
import type { DemoScenario } from "@/lib/agent/types";

const NAV = [
  { href: "/agent", label: "Home", icon: Home },
  { href: "/agent/leads", label: "Leads", icon: Users },
  { href: "/agent/schedule", label: "Schedule", icon: CalendarClock },
  { href: "/agent/settings", label: "Settings", icon: Settings },
];

function active(path: string, href: string) {
  return href === "/agent" ? path === "/agent" || path === "/agent/activity" : path.startsWith(href);
}

export function AgentShell({
  children,
  needsReview,
  previewOnly,
  demo,
  snapshotAt = null,
  canUseLive,
  running,
}: {
  children: React.ReactNode;
  needsReview: number;
  previewOnly: boolean;
  demo: { scenario: DemoScenario; label: string } | null;
  snapshotAt?: string | null;
  canUseLive: boolean;
  running: boolean;
}) {
  const path = usePathname();
  const router = useRouter();

  // Jobs run on the server; while one is running, refresh so the status line moves on its own.
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => router.refresh(), 8000);
    return () => clearInterval(t);
  }, [running, router]);

  return (
    <div className="agent-app min-h-dvh">
      {demo ? <DemoBar demo={demo} canUseLive={canUseLive} /> : null}
      {snapshotAt ? (
        <p className="sticky top-0 z-40 flex min-h-12 items-center gap-2 bg-ag-brand px-4 py-2 text-[13px] text-white">
          <span className="font-bold text-ag-lime">REAL LEADS · SNAPSHOT</span>
          <span className="text-white/85">From the live run on {new Date(snapshotAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} IST. Read-only until Google Cloud is connected.</span>
        </p>
      ) : null}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-ag-rule bg-ag-paper px-4 py-6 lg:flex" style={demo || snapshotAt ? { top: 48 } : undefined}>
        <Link href="/agent" className="mb-8 flex items-center gap-2.5 px-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark.png" alt="Creative Cut" width={36} height={36} className="size-9 rounded-lg object-contain" />
          <span className="leading-tight">
            <span className="block text-[15px] font-bold">Creative Cut</span>
            <span className="block text-[13px] text-ag-text-3">Lead Agent</span>
          </span>
        </Link>
        <nav aria-label="Lead Agent" className="flex flex-col gap-1">
          {NAV.map((n) => {
            const on = active(path, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={on ? "page" : undefined}
                className={cn("flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium", on ? "bg-ag-brand-soft text-ag-brand" : "text-ag-text-2 hover:bg-black/5 hover:text-ag-text")}
              >
                <n.icon aria-hidden className="size-5" />
                {n.label}
                {n.href === "/agent/leads" && needsReview > 0 ? (
                  <span className="ml-auto rounded-full bg-ag-brand px-2 py-0.5 text-xs font-bold text-white" aria-label={`${needsReview} need review`}>
                    {needsReview}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        {previewOnly ? (
          <p className="mt-auto flex items-start gap-2 rounded-xl bg-ag-info-soft px-3 py-2.5 text-[13px] text-ag-info">
            <Eye aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              <b>Preview only.</b> Live sending is off, so no emails go out.
            </span>
          </p>
        ) : null}
      </aside>

      <div className="lg:pl-60">
        {previewOnly ? (
          <p className="flex items-center justify-center gap-2 border-b border-ag-rule bg-ag-info-soft px-4 py-2 text-[13px] font-medium text-ag-info lg:hidden">
            <Eye aria-hidden className="size-4" /> Preview only — no emails are sent
          </p>
        ) : null}
        <main className="mx-auto w-full max-w-5xl px-4 pt-6 pb-28 sm:px-8 lg:pt-10 lg:pb-16">{children}</main>
      </div>

      <nav aria-label="Lead Agent" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-ag-rule bg-ag-card pb-[env(safe-area-inset-bottom)] lg:hidden">
        {NAV.map((n) => {
          const on = active(path, n.href);
          return (
            <Link key={n.href} href={n.href} aria-current={on ? "page" : undefined} className={cn("relative flex flex-col items-center gap-1 py-2.5 text-[12px] font-medium", on ? "text-ag-brand" : "text-ag-text-3")}>
              <n.icon aria-hidden className="size-5" />
              {n.label}
              {n.href === "/agent/leads" && needsReview > 0 ? <span className="absolute top-1.5 left-1/2 ml-2 rounded-full bg-ag-brand px-1.5 text-[11px] font-bold text-white">{needsReview}</span> : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function DemoBar({ demo, canUseLive }: { demo: { scenario: DemoScenario; label: string }; canUseLive: boolean }) {
  const [pending, start] = useTransition();
  const opts: { v: DemoScenario; l: string }[] = [
    { v: "setup", l: "First-time setup" },
    { v: "running", l: "Run in progress" },
    { v: "finished", l: "Finished run" },
  ];
  return (
    <div className="sticky top-0 z-40 flex h-12 items-center gap-3 overflow-x-auto bg-ag-text px-4 text-[13px] text-white">
      <span className="flex shrink-0 items-center gap-1.5 font-bold">
        <FlaskConical aria-hidden className="size-4 text-ag-lime" /> DEMO DATA
      </span>
      <span className="hidden shrink-0 text-white/70 sm:inline">Fictional leads — nothing here is real or sent.</span>
      <label className="ml-auto flex shrink-0 items-center gap-2">
        <span className="text-white/70">Scenario</span>
        <select
          aria-label="Demo scenario"
          value={demo.scenario}
          disabled={pending}
          onChange={(e) => start(() => chooseDemo(e.target.value as DemoScenario))}
          className="h-8 rounded-lg bg-white/10 px-2 text-white"
        >
          {opts.map((o) => (
            <option key={o.v} value={o.v} className="text-black">
              {o.l}
            </option>
          ))}
        </select>
      </label>
      {canUseLive ? (
        <button type="button" disabled={pending} onClick={() => start(() => chooseDemo("live"))} className="h-8 shrink-0 rounded-lg bg-ag-lime px-3 font-semibold text-ag-text">
          Use live data
        </button>
      ) : null}
    </div>
  );
}
