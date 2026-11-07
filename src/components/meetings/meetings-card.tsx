"use client";

import { setMeetingOutcome } from "@/app/actions/meetings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/actions";
import type { Meeting } from "@/lib/data";
import { cn } from "@/lib/utils";
import { CalendarClock, Copy, Video } from "lucide-react";
import { useState, useTransition } from "react";

const statusVariant = { scheduled: "info", held: "success", no_show: "warning", cancelled: "neutral" } as const;
const statusLabel = { scheduled: "Scheduled", held: "Held", no_show: "No-show", cancelled: "Cancelled" } as const;

function when(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function MeetingsCard({ meetings, bookingUrl, now }: { meetings: Meeting[]; bookingUrl: string | null; now: number }) {
  const [busy, start] = useTransition();
  const [result, setResult] = useState<ActionState>({});
  const [copied, setCopied] = useState(false);

  const outcome = (id: string, o: "held" | "no_show" | "not_fit") => start(async () => setResult(await setMeetingOutcome(id, o)));

  return (
    <div className="space-y-3">
      {meetings.length === 0 && <p className="text-xs text-muted">No meetings yet.</p>}
      <ul className="space-y-3">
        {meetings.map((m) => {
          const past = new Date(m.ends_at).getTime() < now;
          return (
            <li key={m.id} className="rounded-lg border border-line bg-surface-2/60 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-xs font-medium">
                    <CalendarClock className="size-3.5 text-subtle" /> {when(m.starts_at)} IST
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-subtle">
                    {m.title} · {m.source === "booking_page" ? "booked online" : "from calendar"}
                  </p>
                </div>
                <Badge variant={statusVariant[m.status]}>{statusLabel[m.status]}</Badge>
              </div>
              {m.meet_url && m.status === "scheduled" && !past && (
                <a href={m.meet_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs text-accent-strong hover:underline">
                  <Video className="size-3.5" /> Join Google Meet
                </a>
              )}
              {m.status === "scheduled" && past && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="primary" disabled={busy} onClick={() => outcome(m.id, "held")}>
                    Held → Proposal
                  </Button>
                  <Button size="sm" disabled={busy} onClick={() => outcome(m.id, "no_show")}>
                    No-show
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => outcome(m.id, "not_fit")}>
                    Not a fit
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {bookingUrl && (
        <Button
          size="sm"
          onClick={async () => {
            await navigator.clipboard.writeText(bookingUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          <Copy className="size-3.5" /> {copied ? "Copied" : "Copy personal booking link"}
        </Button>
      )}
      {(result.error || result.message) && <p className={cn("text-xs", result.error ? "text-rose-300" : "text-emerald-300")}>{result.error ?? result.message}</p>}
    </div>
  );
}
