import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleDashed, Clock, Info, Loader2, MailX, Send, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConnectionStatus, DraftStatus } from "@/lib/agent/types";
import type { ButtonHTMLAttributes, ReactNode } from "react";

const BTN = {
  primary: "bg-ag-brand text-white hover:bg-ag-brand-hover",
  secondary: "bg-ag-card text-ag-text border border-ag-rule-2 hover:border-ag-text-3",
  ghost: "text-ag-text-2 hover:text-ag-text hover:bg-black/5",
  danger: "bg-ag-card text-ag-bad border border-ag-rule-2 hover:border-ag-bad",
};

export function btn(variant: keyof typeof BTN = "secondary", size: "md" | "lg" | "sm" = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors whitespace-nowrap",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ag-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ag-paper",
    "disabled:opacity-50 disabled:pointer-events-none",
    size === "lg" ? "h-12 px-6 text-base" : size === "sm" ? "h-9 px-3 text-sm" : "h-11 px-4 text-[15px]",
    BTN[variant],
    className,
  );
}

export function Button({ variant = "secondary", size = "md", className, type = "button", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BTN; size?: "md" | "lg" | "sm" }) {
  return <button type={type} className={btn(variant, size, className)} {...p} />;
}

export function ButtonLink({ href, variant = "secondary", size = "md", className, children }: { href: string; variant?: keyof typeof BTN; size?: "md" | "lg" | "sm"; className?: string; children: ReactNode }) {
  return (
    <Link href={href} className={btn(variant, size, className)}>
      {children}
    </Link>
  );
}

export function Card({ className, children, as: As = "section" }: { className?: string; children: ReactNode; as?: "section" | "div" | "article" }) {
  return <As className={cn("rounded-2xl border border-ag-rule bg-ag-card", className)}>{children}</As>;
}

type Tone = "ok" | "warn" | "bad" | "info" | "neutral" | "brand";
const TONE: Record<Tone, string> = {
  ok: "bg-ag-ok-soft text-ag-ok",
  warn: "bg-ag-warn-soft text-ag-warn",
  bad: "bg-ag-bad-soft text-ag-bad",
  info: "bg-ag-info-soft text-ag-info",
  neutral: "bg-black/[0.05] text-ag-text-2",
  brand: "bg-ag-brand-soft text-ag-brand",
};

export function Badge({ tone, icon: Icon, children, spin }: { tone: Tone; icon: LucideIcon; children: ReactNode; spin?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium leading-none", TONE[tone])}>
      <Icon aria-hidden className={cn("size-3.5 shrink-0", spin && "animate-spin")} />
      {children}
    </span>
  );
}

export const DRAFT_BADGE: Record<DraftStatus, { tone: Tone; icon: LucideIcon; label: string }> = {
  awaiting_approval: { tone: "info", icon: Clock, label: "Waiting for approval" },
  needs_review: { tone: "warn", icon: AlertTriangle, label: "Needs a look" },
  ready: { tone: "brand", icon: Clock, label: "Ready to send" },
  approved: { tone: "ok", icon: CheckCircle2, label: "Approved" },
  sending: { tone: "info", icon: Loader2, label: "Sending" },
  sent: { tone: "ok", icon: Send, label: "Sent" },
  replied: { tone: "ok", icon: CheckCircle2, label: "Replied" },
  bounced: { tone: "bad", icon: XCircle, label: "Bounced" },
  opted_out: { tone: "neutral", icon: XCircle, label: "Opted out" },
  skipped: { tone: "neutral", icon: XCircle, label: "Skipped" },
  failed: { tone: "bad", icon: XCircle, label: "Didn't send" },
  no_email: { tone: "neutral", icon: MailX, label: "No email — apply by form or DM" },
};

export function DraftBadge({ status }: { status: DraftStatus }) {
  const b = DRAFT_BADGE[status];
  return (
    <Badge tone={b.tone} icon={b.icon} spin={status === "sending"}>
      {b.label}
    </Badge>
  );
}

export const CONN_BADGE: Record<ConnectionStatus, { tone: Tone; icon: LucideIcon; label: string }> = {
  connected: { tone: "ok", icon: CheckCircle2, label: "Connected" },
  setup_required: { tone: "neutral", icon: CircleDashed, label: "Setup Required" },
  needs_reconnect: { tone: "bad", icon: AlertTriangle, label: "Needs reconnecting" },
  checking: { tone: "info", icon: Loader2, label: "Checking" },
};

export function ConnBadge({ status, label }: { status: ConnectionStatus; label?: string }) {
  const b = CONN_BADGE[status];
  return (
    <Badge tone={b.tone} icon={b.icon} spin={status === "checking"}>
      {label ?? b.label}
    </Badge>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "ok" | "bad"; children: ReactNode }) {
  const Icon = tone === "ok" ? CheckCircle2 : tone === "bad" ? AlertTriangle : Info;
  return (
    <div role="status" className={cn("flex items-start gap-2 rounded-xl px-4 py-3 text-[15px]", tone === "ok" ? TONE.ok : tone === "bad" ? TONE.bad : TONE.info)}>
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function PageTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <h1 className="text-[28px] font-bold leading-tight tracking-tight text-ag-text">{title}</h1>
      {children}
    </div>
  );
}
