"use client";

import { LogoMark } from "@/components/icons";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_SECTIONS } from "./nav-items";

export function SidebarContent({ orgName, onNavigate }: { orgName: string; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-3 px-5">
        <LogoMark className="size-8" />
        <div className="leading-tight">
          <p className="text-sm font-semibold text-fg">{orgName}</p>
          <p className="text-[11px] text-subtle">AI CRM</p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="px-3 pb-2 text-[10px] font-semibold tracking-[0.12em] text-subtle uppercase">{section.title}</p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                        active ? "bg-white/[0.06] text-fg" : "text-muted hover:bg-white/[0.03] hover:text-fg",
                      )}
                    >
                      {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent" />}
                      <Icon className={cn("size-4 shrink-0", active ? "text-accent-strong" : "text-subtle group-hover:text-muted")} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="m-3 rounded-xl border border-line bg-surface-2/60 p-4">
        <p className="text-xs font-medium text-fg">Safe mode is on</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">Messages and ads run as dry-runs. Nothing is sent or launched.</p>
      </div>
    </div>
  );
}

export function Sidebar({ orgName }: { orgName: string }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-surface/80 backdrop-blur lg:block">
      <SidebarContent orgName={orgName} />
    </aside>
  );
}
