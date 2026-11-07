"use client";

import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CalendarCheck2 } from "lucide-react";
import { useActionState, useState } from "react";
import { bookSlot, type BookState } from "./actions";

export interface DaySlots {
  day: string;
  slots: { start: string; label: string }[];
}

export function BookingForm({ days, token, workspace, needsDetails, needsEmail }: { days: DaySlots[]; token?: string; workspace?: string; needsDetails: boolean; needsEmail: boolean }) {
  const [state, action, pending] = useActionState<BookState, FormData>(bookSlot, {});
  const [picked, setPicked] = useState<string>("");

  if (state.bookedAt) {
    return (
      <div className="space-y-3 text-center">
        <CalendarCheck2 className="mx-auto size-10 text-emerald-300" />
        <p className="text-base font-medium">You&apos;re booked for {state.bookedAt} (IST).</p>
        <p className="text-sm text-muted">A calendar invite is on its way to your inbox.</p>
        {state.meetUrl && (
          <a href={state.meetUrl} className="text-sm text-accent-strong hover:underline">
            {state.meetUrl}
          </a>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      {token && <input type="hidden" name="t" value={token} />}
      {workspace && <input type="hidden" name="w" value={workspace} />}
      <input type="hidden" name="start" value={picked} />
      <input type="text" name="fax" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

      <div className="space-y-4">
        {days.map((d) => (
          <div key={d.day}>
            <p className="mb-2 text-xs font-medium text-muted">{d.day}</p>
            <div className="flex flex-wrap gap-2">
              {d.slots.map((s) => (
                <button
                  type="button"
                  key={s.start}
                  onClick={() => setPicked(s.start)}
                  className={cn(
                    "h-9 rounded-lg border px-3 text-sm transition-colors",
                    picked === s.start ? "border-accent bg-accent text-white" : "border-line bg-surface-2 hover:border-line-strong",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {(needsDetails || needsEmail) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {needsDetails && (
            <>
              <div>
                <Label htmlFor="name">Your name</Label>
                <Input id="name" name="name" required autoComplete="name" />
              </div>
              <div>
                <Label htmlFor="company">Company</Label>
                <Input id="company" name="company" autoComplete="organization" />
              </div>
            </>
          )}
          <div className={needsDetails ? "sm:col-span-2" : "sm:col-span-2"}>
            <Label htmlFor="email">Work email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
        </div>
      )}
      <div>
        <Label htmlFor="note">Anything we should know? (optional)</Label>
        <Textarea id="note" name="note" rows={3} placeholder="What are you launching next?" />
      </div>

      {state.error && <p className="text-sm text-rose-300">{state.error}</p>}
      <Button type="submit" variant="primary" disabled={!picked || pending} className="w-full">
        {pending ? "Booking…" : picked ? "Confirm booking" : "Pick a time above"}
      </Button>
    </form>
  );
}
