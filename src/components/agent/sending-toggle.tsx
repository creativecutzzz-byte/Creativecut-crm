"use client";

import { useState, useTransition } from "react";
import { Eye, Send } from "lucide-react";
import { setSending, type ActionResult } from "@/app/actions/agent";
import { cn } from "@/lib/utils";
import { Button } from "./ui";
import { Result } from "./home-client";

export function SendingToggle({ on, dailyCap }: { on: boolean; dailyCap: number }) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [r, setR] = useState<ActionResult | null>(null);
  return (
    <div className="flex flex-col gap-3 border-t border-ag-rule pt-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className={cn("flex flex-1 items-start gap-3")}>
          {on ? <Send aria-hidden className="mt-0.5 size-5 text-ag-ok" /> : <Eye aria-hidden className="mt-0.5 size-5 text-ag-info" />}
          <div>
            <p className="font-semibold">{on ? "Live sending is on" : "Preview only"}</p>
            <p className="text-[15px] text-ag-text-2">
              {on ? `Eligible emails are sent from your Gmail, up to ${dailyCap} first emails a day across all senders.` : "Drafts are prepared but nothing is sent. Turn on live sending when you're ready."}
            </p>
          </div>
        </div>
        {on ? (
          <Button disabled={pending} onClick={() => start(async () => setR(await setSending(false)))}>
            Switch to Preview only
          </Button>
        ) : confirm ? (
          <div className="flex gap-2">
            <Button variant="primary" disabled={pending} onClick={() => start(async () => { setR(await setSending(true)); setConfirm(false); })}>
              Yes, start sending
            </Button>
            <Button onClick={() => setConfirm(false)}>Cancel</Button>
          </div>
        ) : (
          <Button variant="primary" onClick={() => setConfirm(true)}>
            Turn on live sending
          </Button>
        )}
      </div>
      {confirm ? <p className="text-[14px] text-ag-text-2">Real emails will go to real people on the next run, up to {dailyCap} a day.</p> : null}
      <Result r={r} />
    </div>
  );
}
