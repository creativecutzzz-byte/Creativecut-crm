import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import type { Lead, Message } from "@/lib/types";
import { formatRelative } from "@/lib/utils";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";

const statusVariant = {
  failed: "danger",
  read: "success",
  delivered: "success",
  sent: "accent",
  simulated: "neutral",
  queued: "neutral",
  draft: "neutral",
} as const;

export function RecentMessages({ messages, leads, emptyText }: { messages: Message[]; leads: Lead[]; emptyText: string }) {
  const byId = new Map(leads.map((l) => [l.id, l]));
  return (
    <Card>
      <CardHeader title="Recent messages" description="Incoming messages arrive through the webhook and create or update leads" />
      <ul className="divide-y divide-line px-2 pt-2 pb-2">
        {messages.map((m) => {
          const lead = m.lead_id ? byId.get(m.lead_id) : undefined;
          const inbound = m.direction === "inbound";
          return (
            <li key={m.id}>
              <Link href={lead ? `/leads/${lead.id}` : "#"} className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-white/[0.03]">
                <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-md ${inbound ? "bg-sky-500/10 text-sky-300" : "bg-emerald-500/10 text-emerald-300"}`}>
                  {inbound ? <ArrowDownLeft className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    {lead?.name ?? m.to_address ?? "Unknown"} <span className="text-[11px] text-subtle">· {formatRelative(m.created_at)}</span>
                  </p>
                  <p className="line-clamp-2 break-words text-xs text-muted">{m.body}</p>
                  {m.error && <p className="mt-0.5 text-[11px] text-rose-300">{m.error}</p>}
                </div>
                {!inbound && <Badge variant={statusVariant[m.status]}>{m.status}</Badge>}
              </Link>
            </li>
          );
        })}
        {messages.length === 0 && <li className="py-6 text-center text-xs text-subtle">{emptyText}</li>}
      </ul>
    </Card>
  );
}
