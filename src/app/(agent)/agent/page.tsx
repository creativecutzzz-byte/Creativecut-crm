import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Circle, ClipboardCheck, Loader2, PauseCircle } from "lucide-react";
import { ModePicker, RunNowButton } from "@/components/agent/home-client";
import { MODE_TEXT } from "@/components/agent/modes";
import { ButtonLink, Card } from "@/components/agent/ui";
import { formatRelative, nextRuns } from "@/lib/agent/schedule";
import { getSnapshot } from "@/lib/agent/store";
import type { AgentSnapshot } from "@/lib/agent/types";

export const metadata = { title: "Home" };

function minutesAgo(iso: string | null, now: Date) {
  if (!iso) return null;
  const m = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000));
  return m < 1 ? "just now" : `${m} min ago`;
}

function StatusLine({ s }: { s: AgentSnapshot }) {
  const now = new Date(s.now);
  if (s.run.running) {
    return (
      <div className="flex flex-col gap-1">
        <p className="flex items-center gap-2.5 text-[22px] font-semibold text-ag-text" role="status" aria-live="polite">
          <Loader2 aria-hidden className="size-6 animate-spin text-ag-brand" />
          {s.run.stage ?? "Working"}…
        </p>
        <p className="pl-8 text-[15px] text-ag-text-2">Started {minutesAgo(s.run.startedAt, now)}. You can close this page — the run keeps going and the results will be here when you come back.</p>
      </div>
    );
  }
  if (s.schedule.paused) {
    return (
      <p className="flex items-center gap-2.5 text-[22px] font-semibold">
        <PauseCircle aria-hidden className="size-6 text-ag-warn" /> Schedule paused — runs only when you press Run Now
      </p>
    );
  }
  const next = nextRuns(s.schedule, now, 1)[0];
  return (
    <p className="flex items-center gap-2.5 text-[22px] font-semibold">
      <CalendarClock aria-hidden className="size-6 text-ag-brand" />
      {next ? `Next run ${formatRelative(next, now)} IST` : "No runs scheduled"}
    </p>
  );
}

function Checklist({ s }: { s: AgentSnapshot }) {
  const steps = [
    { done: s.setup.leadSource, title: "Connect a lead source", text: "Web Research, Apollo or Vibe Prospecting.", action: <ButtonLink href="/agent/settings?open=web_research" size="sm">Connect</ButtonLink> },
    { done: s.setup.sender, title: "Connect a sender", text: "Sign in with the Gmail address emails should come from.", action: <ButtonLink href="/agent/settings?open=gmail" size="sm">Connect Gmail</ButtonLink> },
    { done: s.setup.previewRun, title: "Preview a run", text: "Finds real leads and writes drafts. Nothing is sent.", action: <RunNowButton running={s.run.running} size="md" label="Preview a run" variant="secondary" /> },
    { done: s.setup.mode, title: "Choose your mode", text: "Decide whether emails wait for you or go out on their own.", action: null },
  ];
  const doneCount = steps.filter((x) => x.done).length;
  const current = steps.findIndex((x) => !x.done);
  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">Get set up</h2>
        <p className="text-[14px] text-ag-text-2">
          {doneCount} of 4 done
        </p>
      </div>
      <ol className="mt-4 flex flex-col divide-y divide-ag-rule">
        {steps.map((st, i) => (
          <li key={st.title} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-start gap-3">
              {st.done ? <CheckCircle2 aria-label="Done" className="mt-0.5 size-5 shrink-0 text-ag-ok" /> : <Circle aria-label="Not done yet" className="mt-0.5 size-5 shrink-0 text-ag-text-3" />}
              <div>
                <p className={st.done ? "font-semibold text-ag-text-3 line-through" : "font-semibold"}>
                  {i + 1}. {st.title}
                </p>
                <p className="text-[14px] text-ag-text-2">{st.done ? "Done" : st.text}</p>
              </div>
            </div>
            {!st.done && i === current && st.action ? <div className="sm:shrink-0">{st.action}</div> : null}
          </li>
        ))}
      </ol>
      {!s.setup.mode && current === 3 ? <ModePicker mode={s.mode} compact /> : null}
    </Card>
  );
}

export default async function AgentHome() {
  const s = await getSnapshot();
  const setupDone = s.setup.leadSource && s.setup.sender && s.setup.previewRun && s.setup.mode;
  const reviewFirst = s.mode === "REVIEW" && s.today.needsReview > 0;
  const mode = MODE_TEXT[s.mode];
  const last = s.runs.find((r) => r.result !== "running");

  return (
    <div className="flex flex-col gap-6">
      <StatusLine s={s} />

      {!setupDone ? <Checklist s={s} /> : null}

      {s.attention ? (
        <Card className="flex flex-col gap-4 border-ag-bad/30 bg-ag-bad-soft p-5 sm:flex-row sm:items-center">
          <AlertTriangle aria-hidden className="size-6 shrink-0 text-ag-bad" />
          <div className="flex-1">
            <p className="font-semibold text-ag-text">{s.attention.message}</p>
            <p className="text-[15px] text-ag-text-2">{s.attention.fix}</p>
          </div>
          <ButtonLink href={s.attention.href} variant="primary">
            {s.attention.actionLabel}
          </ButtonLink>
        </Card>
      ) : null}

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {[
          { n: s.today.qualified, l: "Qualified Leads Today", href: "/agent/leads?view=all" },
          { n: s.today.needsReview, l: "Needs Review", href: "/agent/leads" },
          { n: s.today.sent, l: "Emails Sent Today", href: "/agent/leads?view=sent" },
        ].map((x) => (
          <Link key={x.l} href={x.href} className="rounded-2xl border border-ag-rule bg-ag-card p-4 hover:border-ag-rule-2 sm:p-5">
            <span className="block text-[32px] font-bold leading-none tabular-nums sm:text-[40px]">{x.n}</span>
            <span className="mt-2 block text-[13px] font-medium text-ag-text-2 sm:text-[15px]">{x.l}</span>
          </Link>
        ))}
      </div>

      <Card className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <div className="flex-1">
          {reviewFirst ? (
            <>
              <p className="text-lg font-semibold">
                {s.today.needsReview} draft{s.today.needsReview === 1 ? " is" : "s are"} waiting for you
              </p>
              <p className="text-[15px] text-ag-text-2">Read them, edit if you like, then approve. Nothing is sent until you do.</p>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold">{s.run.running ? "A run is in progress" : "Want fresh leads now?"}</p>
              <p className="text-[15px] text-ag-text-2">
                {s.sendingLive ? "Runs research now. Eligible emails go out within today's limit." : "Runs research now and writes drafts. Preview only — nothing is sent."}
              </p>
            </>
          )}
        </div>
        <div className="sm:shrink-0">
          {reviewFirst ? (
            <ButtonLink href="/agent/leads" variant="primary" size="lg">
              <ClipboardCheck aria-hidden className="size-5" /> Review Leads
            </ButtonLink>
          ) : (
            <RunNowButton running={s.run.running} />
          )}
        </div>
      </Card>

      {s.setup.mode || setupDone ? (
        <Card className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-wide text-ag-text-3">Mode</p>
              <p className="mt-1 flex items-center gap-2 text-lg font-semibold">
                <mode.icon aria-hidden className="size-5 text-ag-brand" /> {mode.title}
              </p>
              <p className="mt-1 max-w-xl text-[15px] text-ag-text-2">{mode.desc}</p>
              {s.mode === "AUTO" && !s.sendingLive ? <p className="mt-2 text-[14px] text-ag-info">Live sending is off, so Auto is only preparing drafts for now.</p> : null}
            </div>
            <ButtonLink href="/agent/settings#mode" size="sm">
              Change mode
            </ButtonLink>
          </div>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <p className="text-[15px] text-ag-text-2">{last ? `Last run: ${last.summary || "finished"}` : "No runs yet."}</p>
        <Link href="/agent/activity" className="inline-flex items-center gap-1 text-[15px] font-semibold text-ag-brand hover:underline">
          View Activity <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
    </div>
  );
}
