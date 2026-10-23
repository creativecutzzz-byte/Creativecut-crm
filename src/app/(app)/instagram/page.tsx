import { Composer } from "@/components/channels/composer";
import { ConnectionCard } from "@/components/channels/connection-card";
import { TemplatesCard } from "@/components/channels/templates-card";
import { InstagramIcon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { ScorePill } from "@/components/ui/score-pill";
import { templateVars } from "@/lib/channel-vars";
import { getIntegrations, getLeads, getTeam, getTemplates, getViewer } from "@/lib/data";
import { integrationEnvStatus } from "@/lib/integrations";
import { formatRelative } from "@/lib/utils";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Instagram" };

export default async function InstagramPage({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const [{ lead }, leads, team, templates, integrations, viewer] = await Promise.all([searchParams, getLeads(), getTeam(), getTemplates(), getIntegrations(), getViewer()]);
  const reachable = leads.filter((l) => l.instagram_handle);
  const fromInstagram = leads.filter((l) => l.source === "instagram");
  const channelTemplates = templates.filter((t) => t.channel === "instagram");

  return (
    <div className="space-y-6">
      <PageHeader title="Instagram" description="Turn DMs and comments into leads, and reply without leaving the CRM." />
      <Notice>
        <strong className="font-medium">Integration placeholder.</strong> Instagram Messaging isn&apos;t connected, and replies run in dry-run mode —
        nothing is posted or sent.
      </Notice>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Reply to a DM" description={`${reachable.length} leads with an Instagram handle`} />
          <CardBody>
            <Composer
              channel="instagram"
              initialLeadId={lead}
              templates={channelTemplates}
              leads={reachable.map((l) => ({ id: l.id, label: `@${l.instagram_handle} — ${l.company ?? l.name}`, vars: templateVars(l, team) }))}
            />
          </CardBody>
        </Card>
        <ConnectionCard
          integration={integrations.find((i) => i.provider === "instagram")!}
          envConfigured={integrationEnvStatus().instagram}
          envKeys={["INSTAGRAM_BUSINESS_ACCOUNT_ID", "INSTAGRAM_ACCESS_TOKEN"]}
          steps={[
            "Add server credentials (env vars or Supabase Vault)",
            "Link the Instagram professional account to a Facebook Page",
            "Request instagram_manage_messages via App Review",
            "Add a signed webhook route for DMs & comments",
            "Review and remove dry-run in code",
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Leads from Instagram" description="Captured from DMs, comments and profile visits" />
          <ul className="divide-y divide-line px-2 pt-2 pb-2">
            {fromInstagram.map((l) => (
              <li key={l.id}>
                <Link href={`/leads/${l.id}`} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-white/[0.03]">
                  <Avatar name={l.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm">
                      <InstagramIcon className="size-3.5 text-subtle" />@{l.instagram_handle}
                    </p>
                    <p className="truncate text-[11px] text-subtle">
                      {l.company} · {formatRelative(l.created_at)}
                    </p>
                  </div>
                  <ScorePill score={l.ai_score} />
                </Link>
              </li>
            ))}
            {fromInstagram.length === 0 && <li className="py-6 text-center text-xs text-subtle">No Instagram leads yet.</li>}
          </ul>
        </Card>
        <TemplatesCard channel="instagram" editable={viewer.mode === "live"} templates={channelTemplates} note="Quick replies for common DMs" />
      </div>
    </div>
  );
}
