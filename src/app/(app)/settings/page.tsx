import { InstagramIcon, WhatsAppIcon } from "@/components/icons";
import { OutreachLinksForm, ProfileForm, WorkspaceNameForm } from "@/components/settings/settings-forms";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getViewer } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/env";
import { DRY_RUN, integrationEnvStatus } from "@/lib/integrations";
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

  const integrations = [
    { name: "WhatsApp Business", href: "/whatsapp", icon: WhatsAppIcon, ready: env.whatsapp, scope: "Messaging (dry-run)" },
    { name: "Instagram", href: "/instagram", icon: InstagramIcon, ready: env.instagram, scope: "DMs (dry-run)" },
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
            <Row label="Outbound messaging" value={<Badge variant={DRY_RUN ? "success" : "danger"}>{DRY_RUN ? "Dry-run (nothing sent)" : "Live"}</Badge>} />
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
        <CardHeader title="Integrations" description="Placeholders — each shows whether server credentials are present" />
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
