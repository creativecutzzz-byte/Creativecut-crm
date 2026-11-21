"use client";

import { useMemo, useState, useTransition } from "react";
import { CalendarClock, ChevronDown, Pause, Play, Plus, Save, Send, Trash2 } from "lucide-react";
import { saveSchedule, type ActionResult } from "@/app/actions/agent";
import { cn } from "@/lib/utils";
import { describeSchedule, describeWindow, formatDateTime, formatRelative, formatTime, nextRuns, sortTimes, validateSchedule } from "@/lib/agent/schedule";
import { WEEKDAYS, type Schedule } from "@/lib/agent/types";
import { Button, Card, Notice } from "./ui";
import { Result } from "./home-client";

export function ScheduleView({ initial, now }: { initial: Schedule; now: string }) {
  const [s, setS] = useState<Schedule>(initial);
  const [newTime, setNewTime] = useState("16:00");
  const [adding, setAdding] = useState(false);
  const [custom, setCustom] = useState(initial.days.length !== 7 || !!initial.oneTime || !!initial.sendWindow || initial.times.length > 1);
  const [pending, start] = useTransition();
  const [r, setR] = useState<ActionResult | null>(null);
  const nowD = useMemo(() => new Date(now), [now]);
  // After a save the server sends the stored schedule back: adopt it, keep the confirmation visible.
  const savedKey = JSON.stringify(initial);
  const [prevKey, setPrevKey] = useState(savedKey);
  if (prevKey !== savedKey) {
    setPrevKey(savedKey);
    setS(initial);
  }
  const dirty = JSON.stringify(s) !== JSON.stringify(initial);
  const error = validateSchedule(s, nowD);
  const preview = nextRuns({ ...s, paused: false }, nowD, 3);

  const save = (next: Schedule) => start(async () => setR(await saveSchedule(next)));

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-6">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-ag-text-3">Your schedule</p>
        <p className="mt-2 flex items-start gap-2.5 text-[22px] font-semibold leading-snug">
          <CalendarClock aria-hidden className="mt-1 size-6 shrink-0 text-ag-brand" />
          {describeSchedule(initial)}
        </p>
        {describeWindow(initial) ? (
          <p className="mt-2 flex items-center gap-2 pl-8 text-[15px] text-ag-text-2">
            <Send aria-hidden className="size-4" /> {describeWindow(initial)}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={() => setAdding((a) => !a)} aria-expanded={adding}>
            <Plus aria-hidden className="size-4" /> Add Time
          </Button>
          <Button
            variant={initial.paused ? "primary" : "secondary"}
            disabled={pending}
            onClick={() => {
              const next = { ...initial, paused: !initial.paused };
              setS(next);
              save(next);
            }}
          >
            {initial.paused ? <Play aria-hidden className="size-4" /> : <Pause aria-hidden className="size-4" />}
            {initial.paused ? "Resume" : "Pause"}
          </Button>
        </div>
        {adding ? (
          <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl bg-ag-paper p-4">
            <label className="grid gap-1">
              <span className="text-[14px] font-medium">Start research at (IST)</span>
              <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="h-11 rounded-xl border border-ag-rule-2 bg-ag-card px-3 text-[15px]" />
            </label>
            <Button
              variant="primary"
              onClick={() => {
                setS((x) => ({ ...x, times: sortTimes([...x.times, newTime]) }));
                setAdding(false);
              }}
            >
              Add {formatTime(newTime)}
            </Button>
          </div>
        ) : null}
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-bold">Start research</h2>
        <p className="mt-1 text-[15px] text-ag-text-2">At each time, the agent starts looking for new leads, researches them and writes drafts. A run usually takes 10–15 minutes.</p>
        <ul className="mt-4 flex flex-col gap-2">
          {s.times.length === 0 ? <li className="text-[15px] text-ag-text-3">No daily times. Add one above.</li> : null}
          {s.times.map((t) => (
            <li key={t} className="flex items-center gap-3 rounded-xl border border-ag-rule px-4 py-3">
              <CalendarClock aria-hidden className="size-5 text-ag-text-3" />
              <span className="flex-1 text-[16px] font-medium">Start research at {formatTime(t)} IST</span>
              <Button variant="ghost" size="sm" aria-label={`Remove ${formatTime(t)}`} onClick={() => setS((x) => ({ ...x, times: x.times.filter((y) => y !== t) }))}>
                <Trash2 aria-hidden className="size-4" /> Remove
              </Button>
            </li>
          ))}
        </ul>

        <button type="button" aria-expanded={custom} onClick={() => setCustom((c) => !c)} className="mt-6 flex items-center gap-2 text-[15px] font-semibold text-ag-brand">
          <ChevronDown aria-hidden className={cn("size-4 transition-transform", custom && "rotate-180")} /> Customize
        </button>
        {custom ? (
          <div className="mt-4 flex flex-col gap-6 border-t border-ag-rule pt-5">
            <fieldset>
              <legend className="text-[15px] font-semibold">Days</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {WEEKDAYS.map((d) => {
                  const on = s.days.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setS((x) => ({ ...x, days: on ? x.days.filter((y) => y !== d) : WEEKDAYS.filter((y) => y === d || x.days.includes(y)) }))}
                      className={cn("h-11 min-w-14 rounded-xl border px-3 text-[15px] font-medium", on ? "border-ag-brand bg-ag-brand text-white" : "border-ag-rule-2 bg-ag-card text-ag-text-2")}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-[15px] font-semibold">One-time run</legend>
              <p className="text-[14px] text-ag-text-2">An extra run on a specific date, on top of the daily times.</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <input
                  type="datetime-local"
                  aria-label="One-time run date and time (IST)"
                  value={s.oneTime ? s.oneTime.replace(" ", "T") : ""}
                  onChange={(e) => setS((x) => ({ ...x, oneTime: e.target.value ? e.target.value.replace("T", " ") : null }))}
                  className="h-11 rounded-xl border border-ag-rule-2 bg-ag-card px-3 text-[15px]"
                />
                {s.oneTime ? (
                  <Button variant="ghost" size="sm" onClick={() => setS((x) => ({ ...x, oneTime: null }))}>
                    Clear
                  </Button>
                ) : null}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-[15px] font-semibold">Send window (optional)</legend>
              <p className="text-[14px] text-ag-text-2">Research can run any time; emails only go out inside this window.</p>
              <label className="mt-2 flex items-center gap-2 text-[15px]">
                <input type="checkbox" className="size-5 accent-[var(--color-ag-brand)]" checked={!!s.sendWindow} onChange={(e) => setS((x) => ({ ...x, sendWindow: e.target.checked ? { start: "10:00", end: "18:00" } : null }))} />
                Only send emails between set hours
              </label>
              {s.sendWindow ? (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <input type="time" aria-label="Send window start" value={s.sendWindow.start} onChange={(e) => setS((x) => ({ ...x, sendWindow: { ...x.sendWindow!, start: e.target.value } }))} className="h-11 rounded-xl border border-ag-rule-2 bg-ag-card px-3 text-[15px]" />
                  <span>to</span>
                  <input type="time" aria-label="Send window end" value={s.sendWindow.end} onChange={(e) => setS((x) => ({ ...x, sendWindow: { ...x.sendWindow!, end: e.target.value } }))} className="h-11 rounded-xl border border-ag-rule-2 bg-ag-card px-3 text-[15px]" />
                  <span className="text-ag-text-2">IST</span>
                </div>
              ) : null}
            </fieldset>
          </div>
        ) : null}
      </Card>

      {dirty ? (
        <Card className="sticky bottom-20 z-10 border-ag-brand p-5 shadow-lg lg:bottom-4">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-ag-text-3">Preview before saving</p>
          <p className="mt-1 text-[17px] font-semibold">{describeSchedule(s)}</p>
          {error ? (
            <div className="mt-3">
              <Notice tone="bad">{error}</Notice>
            </div>
          ) : (
            <>
              <p className="mt-2 text-[15px] text-ag-text-2">{s.paused ? "Paused — these would be the next runs once you resume:" : "Next runs:"}</p>
              <ol className="mt-1 list-inside list-decimal text-[15px]">
                {preview.map((d) => (
                  <li key={d.toISOString()}>
                    Start research {formatRelative(d, nowD)} IST <span className="text-ag-text-3">({formatDateTime(d)})</span>
                  </li>
                ))}
              </ol>
            </>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" disabled={!!error || pending} onClick={() => save(s)}>
              <Save aria-hidden className="size-4" /> Save schedule
            </Button>
            <Button disabled={pending} onClick={() => setS(initial)}>
              Undo changes
            </Button>
          </div>
        </Card>
      ) : null}
      <Result r={r} />
    </div>
  );
}
