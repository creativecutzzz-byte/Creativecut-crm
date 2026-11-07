import { Composer } from "@/components/channels/composer";
import { ConnectionCard } from "@/components/channels/connection-card";
import { RecentMessages } from "@/components/channels/recent-messages";
import { TemplatesCard } from "@/components/channels/templates-card";
import { InstagramIcon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { ScorePill } from "@/components/ui/score-pill";
import { templateVars } from "@/lib/channel-vars";
import { getLeads, getMessages, getTeam, getTemplates, getViewer } from "@/lib/data";
import { envKeyStatus, instagram, integrationEnvStatus, isMessagingLive } from "@/lib/integrations";
import { webhookUrl } from "@/lib/site-url";
import { formatRelative } from "@/lib/utils";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Instagram" };

export default async function InstagramPage({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const [{ lead }, leads, team, templates, messages, viewer, hookUrl] = await Promise.all([searchParams, getLeads(), getTeam(), getTemplates(), getMessages("instagram"), getViewer(), webhookUrl()]);
  const live = instagram.isLive();
  const env = integrationEnvStatus();
  const reachable = leads.filter((l) => l.instagram_handle);
  const fromInstagram = leads.filter((l) => l.source === "instagram");
  const channelTemplates = templates.filter((t) => t.channel === "instagram");

  return (
    <div className="space-y-6">
      <PageHeader title="Instagram" description="Turn DMs and comments into leads, and reply without leaving the CRM." />
      {live ? (
        <Notice>
          <strong className="font-medium">Live.</strong> Replies are delivered as Instagram DMs. Instagram only allows replies to people who DM you first,
          within 24 hours of their last message. New DMs appear below and become leads automatically.
        </Notice>
      ) : (
        <Notice>
          <strong className="font-medium">Dry-run mode.</strong> Replies are previewed, nothing is sent. Add the credentials below and set{" "}
          <code>MESSAGING_MODE=live</code> to send for real.
        </Notice>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Reply to a DM" description={`${reachable.length} leads with an Instagram handle`} />
          <CardBody>
            <Composer
              channel="instagram"
              initialLeadId={lead}
              templates={channelTemplates}
              live={live}
              leads={reachable.map((l) => ({ id: l.id, label: `@${l.instagram_handle} — ${l.company ?? l.name}`, vars: templateVars(l, team) }))}
            />
          </CardBody>
        </Card>
        <ConnectionCard
          live={live}
          webhookUrl={hookUrl}
          envKeys={envKeyStatus([...instagram.envKeys, "INSTAGRAM_APP_SECRET", "META_WEBHOOK_VERIFY_TOKEN", "SUPABASE_SERVICE_ROLE_KEY", "META_WEBHOOK_WORKSPACE"])}
          steps={[
            { label: "Add the Instagram account ID and access token", done: env.instagram },
            { label: "Set the webhook URL and subscribe to “messages”", done: env.webhook },
            { label: "Allow access to messages in the Instagram app (Settings → Messages)", done: messages.some((m) => m.direction === "inbound") },
            { label: "Set MESSAGING_MODE=live", done: isMessagingLive() },
          ]}
        />
      </div>

      <RecentMessages messages={messages} leads={leads} emptyText="No Instagram DMs yet." />

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
