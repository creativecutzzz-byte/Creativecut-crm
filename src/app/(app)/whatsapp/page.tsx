import { Composer } from "@/components/channels/composer";
import { ConnectionCard } from "@/components/channels/connection-card";
import { RecentMessages } from "@/components/channels/recent-messages";
import { TemplatesCard } from "@/components/channels/templates-card";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { templateVars } from "@/lib/channel-vars";
import { getLeads, getMessages, getTeam, getTemplates, getViewer } from "@/lib/data";
import { envKeyStatus, integrationEnvStatus, isMessagingLive, whatsapp } from "@/lib/integrations";
import { webhookUrl } from "@/lib/site-url";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "WhatsApp" };

export default async function WhatsAppPage({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const [{ lead }, leads, team, templates, messages, viewer, hookUrl] = await Promise.all([searchParams, getLeads(), getTeam(), getTemplates(), getMessages("whatsapp"), getViewer(), webhookUrl()]);
  const live = whatsapp.isLive();
  const env = integrationEnvStatus();
  const reachable = leads.filter((l) => l.whatsapp_number);
  const channelTemplates = templates.filter((t) => t.channel === "whatsapp");

  return (
    <div className="space-y-6">
      <PageHeader title="WhatsApp Business" description="Message leads and clients from the CRM using approved templates." />
      {live ? (
        <Notice>
          <strong className="font-medium">Live.</strong> Messages are delivered through the WhatsApp Cloud API. Free-form text only goes to people who
          messaged you in the last 24 hours; otherwise the selected approved template is sent (marketing-consent leads only).
        </Notice>
      ) : (
        <Notice>
          <strong className="font-medium">Dry-run mode.</strong> “Simulate send” previews the exact message without contacting anyone. Add the credentials
          below and set <code>MESSAGING_MODE=live</code> to send for real.
        </Notice>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Compose" description={`${reachable.length} leads reachable on WhatsApp`} />
          <CardBody>
            <Composer
              channel="whatsapp"
              initialLeadId={lead}
              templates={channelTemplates}
              live={live}
              leads={reachable.map((l) => ({ id: l.id, label: `${l.company ?? l.name} — ${l.name}`, vars: templateVars(l, team) }))}
            />
          </CardBody>
        </Card>
        <ConnectionCard
          live={live}
          webhookUrl={hookUrl}
          envKeys={envKeyStatus([...whatsapp.envKeys, "META_APP_SECRET", "META_WEBHOOK_VERIFY_TOKEN", "SUPABASE_SERVICE_ROLE_KEY", "META_WEBHOOK_WORKSPACE"])}
          steps={[
            { label: "Add the phone number ID and a permanent access token", done: env.whatsapp },
            { label: "Set the webhook URL and subscribe to “messages”", done: env.webhook },
            { label: "Get message templates approved in WhatsApp Manager", done: channelTemplates.some((t) => t.external_template_name) },
            { label: "Set MESSAGING_MODE=live", done: isMessagingLive() },
          ]}
        />
      </div>

      <RecentMessages messages={messages} leads={leads} emptyText="No WhatsApp messages yet." />

      <TemplatesCard channel="whatsapp" editable={viewer.mode === "live"} templates={channelTemplates} note="Outside the 24-hour window WhatsApp only allows Meta-approved templates. Set each template’s Meta name; {{variables}} are sent as {{1}}, {{2}}… in order." />
    </div>
  );
}
