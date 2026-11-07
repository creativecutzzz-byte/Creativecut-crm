import { InstagramIcon, WhatsAppIcon } from "@/components/icons";
import { OutreachLinksForm, ProfileForm, WorkspaceNameForm } from "@/components/settings/settings-forms";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getViewer } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/env";
import { instagram, integrationEnvStatus, isMessagingLive, whatsapp } from "@/lib/integrations";
import { hasOAuthAccount, hasServiceAccount, oauthEmail } from "@/lib/integrations/google";
import { oauthClientReady } from "@/lib/integrations/google-oauth";
import { hasAppsScript } from "@/lib/integrations/apps-script";
import { razorpay } from "@/lib/integrations/razorpay";
import { CURRENCY } from "@/lib/utils";
import { Database, Megaphone, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [viewer, headerList] = await Promise.all([getViewer(), headers()]);
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "";
  const siteUrl = `${headerList.get("x-forwarded-proto") ?? "https"}://${host}`;
  const env = integrationEnvStatus();
  const live = isMessagingLive();
  const liveChannels = [whatsapp.isLive() && "WhatsApp", instagram.isLive() && "Instagram"].filter(Boolean).join(" + ");

  const integrations = [
    { name: "WhatsApp Business", href: "/whatsapp", icon: WhatsAppIcon, ready: env.whatsapp, scope: whatsapp.isLive() ? "Messaging (live)" : "Messaging (dry-run)" },
    { name: "Instagram", href: "/instagram", icon: InstagramIcon, ready: env.instagram, scope: instagram.isLive() ? "DMs (live)" : "DMs (dry-run)" },
    { name: "Meta Ads", href: "/ads", icon: Megaphone, ready: env.meta_ads, scope: "Insights (read-only)" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Workspace, data and integration configuration." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Workspace" />
          <CardBody className="space-y-3 text-sm">
            {viewer.mode === "live" ? (
              <div className="space-y-4 pb-2">
                <WorkspaceNameForm name={viewer.orgName} canEdit={viewer.role === "owner" || viewer.role === "admin"} />
                <ProfileForm fullName={viewer.fullName === viewer.email ? "" : viewer.fullName} />
              </div>
            ) : (
              <Row label="Name" value={viewer.orgName} />
            )}
            <Row label="Signed in as" value={viewer.email} />
            <Row label="Currency" value={CURRENCY} />
            <Row label="Your role" value={<Badge variant="accent">{viewer.role}</Badge>} />
            <Row
              label="Database"
              value={
                <span className="flex items-center gap-2">
                  <Database className="size-3.5 text-subtle" />
                  {isSupabaseConfigured ? <Badge variant="success">Supabase connected</Badge> : <Badge variant="warning">Demo mode</Badge>}
                </span>
              }
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Safety" />
          <CardBody className="space-y-3 text-sm">
            <Row label="Outbound messaging" value={<Badge variant={liveChannels ? "warning" : "success"}>{liveChannels ? `Live: ${liveChannels}` : live ? "Live, but no credentials" : "Dry-run (nothing sent)"}</Badge>} />
            <Row label="Meta webhook" value={<Badge variant={env.webhook ? "success" : "neutral"}>{env.webhook ? "Configured" : "Not configured"}</Badge>} />
            <Row label="Ad management" value={<Badge variant="success">Read-only</Badge>} />
            <Row label="Credential storage" value={<span className="text-muted">Env vars / Supabase Vault</span>} />
            <p className="flex items-start gap-2 pt-1 text-xs leading-relaxed text-subtle">
              <ShieldCheck className="mt-px size-3.5 shrink-0 text-accent-strong" />
              API tokens are never stored in the database, shipped to the browser or committed to the repository.
            </p>
          </CardBody>
        </Card>
      </div>

      {viewer.mode === "live" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Outreach links" description="Filled into every sequence message" />
            <CardBody>
              <OutreachLinksForm bookingUrl={viewer.bookingUrl} portfolioUrl={viewer.portfolioUrl} canEdit={viewer.role === "owner" || viewer.role === "admin"} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Google account" description="Calendar for the booking page, and the mailbox for alerts and the daily brief" />
            <CardBody className="space-y-3 text-sm">
              <Row
                label="Status"
                value={
                  hasServiceAccount() ? (
                    <Badge variant="success">Workspace service account</Badge>
                  ) : hasOAuthAccount() ? (
                    <Badge variant="success">Connected: {oauthEmail() || "Google account"}</Badge>
                  ) : hasAppsScript() ? (
                    <Badge variant="success">Connected via Apps Script (free)</Badge>
                  ) : (
                    <Badge variant="neutral">Not connected</Badge>
                  )
                }
              />
              {!hasServiceAccount() && !hasAppsScript() && (
                <p className="text-xs leading-relaxed text-subtle">
                  Free and easiest: the Apps Script method (docs/google-apps-script-setup.md), no Google Cloud needed.
                </p>
              )}
              <Row label="Razorpay" value={razorpay.isConfigured() ? <Badge variant="success">Connected</Badge> : <Badge variant="neutral">Not connected</Badge>} />
              {!hasServiceAccount() && !hasAppsScript() && (viewer.role === "owner" || viewer.role === "admin") && (
                oauthClientReady() ? (
                  <a href="/api/google/connect" className={buttonClasses({ variant: hasOAuthAccount() ? "secondary" : "primary", size: "sm" })}>
                    {hasOAuthAccount() ? "Reconnect Google" : "Connect Google"}
                  </a>
                ) : (
                  <p className="text-xs leading-relaxed text-subtle">
                    Add <code>GOOGLE_OAUTH_CLIENT_ID</code> and <code>GOOGLE_OAUTH_CLIENT_SECRET</code> in Vercel (see docs/google-gmail-setup.md), redeploy, then connect here.
                  </p>
                )
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Website lead capture" description="Forms that post here create a lead plus a reply-within-1-hour task" />
            <CardBody className="space-y-3 text-sm">
              <Row label="Endpoint" value={<code className="text-xs">{`${siteUrl}/api/lead-capture`}</code>} />
              <Row label="Workspace key" value={<code className="text-xs">{viewer.orgSlug}</code>} />
              <p className="text-xs leading-relaxed text-subtle">
                Send <code>workspace</code>, <code>name</code>, <code>email</code> and optionally <code>company</code>, <code>website</code>,{" "}
                <code>message</code> as JSON or form data. The landing page in <code>landing/index.html</code> is already set up for this; put these two values
                at the top of its script.
              </p>
            </CardBody>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader title="Integrations" description="Each shows whether server credentials are present" />
        <ul className="grid grid-cols-1 gap-3 p-5 md:grid-cols-3">
          {integrations.map(({ name, href, icon: Icon, ready, scope }) => (
            <li key={name} className="rounded-xl border border-line bg-surface-2/60 p-4">
              <div className="flex items-center justify-between">
                <span className="grid size-9 place-items-center rounded-lg bg-white/5 text-fg">
                  <Icon className="size-4" />
                </span>
                <Badge variant={ready ? "success" : "neutral"}>{ready ? "Credentials set" : "Not configured"}</Badge>
              </div>
              <p className="mt-3 text-sm font-medium">{name}</p>
              <p className="text-xs text-subtle">{scope}</p>
              <Link href={href} className={buttonClasses({ variant: "secondary", size: "sm", className: "mt-4 w-full" })}>
                Open
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className="text-fg">{value}</span>
    </div>
  );
}
