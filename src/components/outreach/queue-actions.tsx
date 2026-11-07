"use client";

import { approveAllEmails, checkRepliesNow, writeNextStepsNow } from "@/app/actions/outreach";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { CheckCheck, Inbox, PenLine } from "lucide-react";
import { useState, useTransition } from "react";

export function QueueActions({ pendingEmails, canWrite }: { pendingEmails: number; canWrite: boolean }) {
  const [busy, start] = useTransition();
  const [result, setResult] = useState<ActionState>({});
  const run = (fn: () => Promise<ActionState>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    start(async () => setResult(await fn()));
  };

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => run(checkRepliesNow)} disabled={busy}>
          <Inbox className="size-3.5" /> Check replies now
        </Button>
        {canWrite && (
          <Button size="sm" onClick={() => run(writeNextStepsNow)} disabled={busy}>
            <PenLine className="size-3.5" /> Write next steps now
          </Button>
        )}
        {pendingEmails > 0 && (
          <Button size="sm" variant="primary" onClick={() => run(approveAllEmails, `Approve and send all ${pendingEmails} pending sequence emails? Read a few first.`)} disabled={busy}>
            <CheckCheck className="size-3.5" /> Approve all emails ({pendingEmails})
          </Button>
        )}
      </div>
      {busy && <p className="text-xs text-muted">Working…</p>}
      {!busy && (result.error || result.message) && <p className={cn("max-w-md text-xs", result.error ? "text-rose-300" : "text-emerald-300")}>{result.error ?? result.message}</p>}
    </div>
  );
}
