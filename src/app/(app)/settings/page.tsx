import { InstagramIcon, WhatsAppIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getViewer } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/env";
import { DRY_RUN, integrationEnvStatus } from "@/lib/integrations";
import { Database, Megaphone, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const viewer = await getViewer();
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
            <Row label="Name" value={viewer.orgName} />
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
