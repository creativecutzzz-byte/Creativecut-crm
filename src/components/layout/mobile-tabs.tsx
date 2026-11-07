"use client";

import type { MemberRole } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Inbox, ListChecks, Sun, Target } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { BadgeKey } from "./nav-items";

const TABS = [
  { href: "/today", label: "Today", icon: Sun },
  { href: "/tasks", label: "Tasks", icon: ListChecks, badge: "myTasksDue" as BadgeKey },
  { href: "/leads", label: "Leads", icon: Target },
  { href: "/outreach", label: "Outreach", icon: Inbox, badge: "approvals" as BadgeKey },
];

/** Thumb-friendly bottom bar on phones for the four things people do most. */
export function MobileTabs({ counts = {} }: { role: MemberRole; counts?: Partial<Record<BadgeKey, number>> }) {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <ul className="grid grid-cols-4">
        {TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
          const count = t.badge ? (counts[t.badge] ?? 0) : 0;
          const Icon = t.icon;
          return (
            <li key={t.href}>
              <Link href={t.href} className={cn("relative flex flex-col items-center gap-0.5 py-2 text-[11px]", active ? "text-fg" : "text-subtle")}>
                <Icon className={cn("size-5", active && "text-accent-strong")} />
                {t.label}
                {count > 0 && <span className="absolute top-1 right-[calc(50%-18px)] min-w-4 rounded-full bg-accent px-1 text-center text-[10px] leading-4 font-semibold text-white">{count > 99 ? "99+" : count}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
