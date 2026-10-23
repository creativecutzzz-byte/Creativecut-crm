import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { CLIENT_STATUS, LEAD_STAGES } from "@/lib/constants";
import { getClients, getLeads } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Search" };

function matches(q: string, values: (string | null | undefined)[]) {
  return values.some((v) => v?.toLowerCase().includes(q));
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [{ q: raw = "" }, leads, clients] = await Promise.all([searchParams, getLeads(), getClients()]);
  const q = raw.trim().toLowerCase();

  const leadHits = q ? leads.filter((l) => matches(q, [l.name, l.company, l.email, l.phone, l.whatsapp_number, l.instagram_handle])) : [];
  const clientHits = q ? clients.filter((c) => matches(q, [c.name, c.company, c.email, c.phone, c.instagram_handle, c.industry, c.website])) : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Search" description={q ? `${leadHits.length + clientHits.length} results for “${raw.trim()}”` : "Search by name, company, email, phone or Instagram handle."} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={`Leads (${leadHits.length})`} />
          <ul className="divide-y divide-line px-2 py-2">
            {leadHits.map((lead) => (
              <li key={lead.id}>
                <Link href={`/leads/${lead.id}`} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-white/[0.03]">
                  <Avatar name={lead.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{lead.company ?? lead.name}</p>
                    <p className="truncate text-[11px] text-subtle">
                      {lead.name} · {formatCurrency(lead.estimated_value)}
                    </p>
                  </div>
                  <Badge>{LEAD_STAGES.find((s) => s.id === lead.stage)?.label}</Badge>
                </Link>
              </li>
            ))}
            {leadHits.length === 0 && <li className="py-6 text-center text-xs text-subtle">No matching leads.</li>}
          </ul>
        </Card>
        <Card>
          <CardHeader title={`Clients (${clientHits.length})`} />
          <ul className="divide-y divide-line px-2 py-2">
            {clientHits.map((client) => (
              <li key={client.id}>
                <Link href={`/clients/${client.id}`} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-white/[0.03]">
                  <Avatar name={client.company ?? client.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{client.company ?? client.name}</p>
                    <p className="truncate text-[11px] text-subtle">
                      {client.name} · {formatCurrency(client.monthly_retainer)}/mo
                    </p>
                  </div>
                  <Badge variant={CLIENT_STATUS[client.status].variant}>{CLIENT_STATUS[client.status].label}</Badge>
                </Link>
              </li>
            ))}
            {clientHits.length === 0 && <li className="py-6 text-center text-xs text-subtle">No matching clients.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}
