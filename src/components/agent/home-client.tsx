"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Circle, Loader2, Play } from "lucide-react";
import { MODE_TEXT } from "./modes";
import { runNow, setMode, type ActionResult } from "@/app/actions/agent";
import { cn } from "@/lib/utils";
import type { Mode } from "@/lib/agent/types";
import { Button, Notice } from "./ui";


export function Result({ r }: { r: ActionResult | null }) {
  if (!r) return null;
  return <Notice tone={r.ok ? "ok" : "bad"}>{r.message}</Notice>;
}

export function RunNowButton({ running, size = "lg", label = "Run Now", variant = "primary" }: { running: boolean; size?: "lg" | "md"; label?: string; variant?: "primary" | "secondary" }) {
  const [pending, start] = useTransition();
  const [r, setR] = useState<ActionResult | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <Button variant={variant} size={size} disabled={pending || running} onClick={() => start(async () => setR(await runNow()))}>
        {pending || running ? <Loader2 aria-hidden className="size-5 animate-spin" /> : <Play aria-hidden className="size-5" />}
        {running ? "Running…" : pending ? "Starting…" : label}
      </Button>
      <Result r={r} />
    </div>
  );
}

export function ModePicker({ mode, compact = false }: { mode: Mode; compact?: boolean }) {
  const [pending, start] = useTransition();
  const [r, setR] = useState<ActionResult | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <fieldset className={cn("grid gap-3", compact ? "sm:grid-cols-2" : "md:grid-cols-2")} disabled={pending}>
        <legend className="sr-only">Choose your mode</legend>
        {(["REVIEW", "AUTO"] as Mode[]).map((m) => {
          const t = MODE_TEXT[m];
          const on = mode === m;
          return (
            <label
              key={m}
              className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors", on ? "border-ag-brand bg-ag-brand-soft" : "border-ag-rule-2 bg-ag-card hover:border-ag-text-3")}
            >
              <input type="radio" name="agent-mode" className="sr-only" checked={on} onChange={() => start(async () => setR(await setMode(m)))} />
              {on ? <CheckCircle2 aria-hidden className="mt-0.5 size-5 shrink-0 text-ag-brand" /> : <Circle aria-hidden className="mt-0.5 size-5 shrink-0 text-ag-text-3" />}
              <span>
                <span className="flex items-center gap-1.5 font-semibold">
                  <t.icon aria-hidden className="size-4" /> {t.title}
                  {on ? <span className="text-[13px] font-medium text-ag-brand">· Current</span> : null}
                </span>
                <span className="mt-1 block text-[14px] text-ag-text-2">{t.desc}</span>
              </span>
            </label>
          );
        })}
      </fieldset>
      <Result r={r} />
    </div>
  );
}
