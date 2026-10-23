"use client";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Bell, Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SidebarContent } from "./sidebar";

export function Topbar({
  orgName,
  userName,
  email,
  mode,
  signOut,
  openTasks = 0,
}: {
  orgName: string;
  userName: string;
  email: string;
  mode: "demo" | "live";
  signOut?: () => Promise<void>;
  /** Open tasks due now or earlier for the viewer; lights the bell. */
  openTasks?: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-canvas/80 px-4 backdrop-blur-xl sm:px-6">
        <button onClick={() => setOpen(true)} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-white/5 hover:text-fg lg:hidden" aria-label="Open navigation">
          <Menu className="size-5" />
        </button>

        <form action="/search" role="search" className="relative hidden max-w-md flex-1 sm:block">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
          <input
            type="search"
            name="q"
            placeholder="Search leads and clients…"
            aria-label="Search leads and clients"
            className="h-9 w-full rounded-lg border border-line bg-surface-2/70 pr-3 pl-9 text-sm text-fg placeholder:text-subtle focus:border-accent/40 focus:outline-none"
          />
        </form>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {mode === "demo" && (
            <Badge variant="warning" dot="bg-amber-400" className="hidden sm:inline-flex">
              Demo data
            </Badge>
          )}
          <Link href="/search" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-white/5 hover:text-fg sm:hidden" aria-label="Search">
            <Search className="size-4" />
          </Link>
          <Link href="/tasks" className="relative grid size-9 place-items-center rounded-lg text-muted hover:bg-white/5 hover:text-fg" aria-label={openTasks ? `My tasks (${openTasks} due)` : "My tasks"}>
            <Bell className="size-4" />
            {openTasks > 0 && <span className="absolute top-2 right-2 size-1.5 rounded-full bg-accent" />}
          </Link>
          <div className="flex items-center gap-2.5 border-l border-line pl-3">
            <Avatar name={userName || email || "User"} />
            <div className="hidden leading-tight md:block">
              <p className="text-sm font-medium text-fg">{userName}</p>
              <p className="text-[11px] text-subtle">{email}</p>
            </div>
            {signOut && (
              <form action={signOut}>
                <button type="submit" className="ml-1 text-xs text-muted hover:text-fg">
                  Sign out
                </button>
              </form>
            )}
          </div>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 border-r border-line bg-surface shadow-2xl">
            <button onClick={() => setOpen(false)} className="absolute top-4 right-3 grid size-8 place-items-center rounded-lg text-muted hover:bg-white/5" aria-label="Close navigation">
              <X className="size-4" />
            </button>
            <SidebarContent orgName={orgName} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
