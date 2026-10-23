import { Composer } from "@/components/channels/composer";
import { ConnectionCard } from "@/components/channels/connection-card";
import { TemplatesCard } from "@/components/channels/templates-card";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { templateVars } from "@/lib/channel-vars";
import { getIntegrations, getLeads, getTeam, getTemplates, getViewer } from "@/lib/data";
import { integrationEnvStatus } from "@/lib/integrations";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "WhatsApp" };

export default async function WhatsAppPage({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const [{ lead }, leads, team, templates, integrations, viewer] = await Promise.all([searchParams, getLeads(), getTeam(), getTemplates(), getIntegrations(), getViewer()]);
  const reachable = leads.filter((l) => l.whatsapp_number);
  const channelTemplates = templates.filter((t) => t.channel === "whatsapp");

  return (
    <div className="space-y-6">
      <PageHeader title="WhatsApp Business" description="Message leads and clients from the CRM using approved templates." />
      <Notice>
        <strong className="font-medium">Integration placeholder.</strong> The WhatsApp Cloud API isn&apos;t connected, and this build runs in dry-run
        mode — “Simulate send” previews the exact message without contacting anyone.
      </Notice>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Compose" description={`${reachable.length} leads reachable on WhatsApp`} />
          <CardBody>
            <Composer
              channel="whatsapp"
              initialLeadId={lead}
              templates={channelTemplates}
              leads={reachable.map((l) => ({ id: l.id, label: `${l.company ?? l.name} — ${l.name}`, vars: templateVars(l, team) }))}
            />
          </CardBody>
        </Card>
        <ConnectionCard
          integration={integrations.find((i) => i.provider === "whatsapp")!}
          envConfigured={integrationEnvStatus().whatsapp}
          envKeys={["WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_ACCESS_TOKEN"]}
          steps={[
            "Add server credentials (env vars or Supabase Vault)",
            "Verify your Meta Business account",
            "Get message templates approved by Meta",
            "Add a signed webhook route for replies & receipts",
            "Review and remove dry-run in code",
          ]}
        />
      </div>

      <TemplatesCard channel="whatsapp" editable={viewer.mode === "live"} templates={channelTemplates} note="Business-initiated WhatsApp messages must use a Meta-approved template." />
    </div>
  );
}
