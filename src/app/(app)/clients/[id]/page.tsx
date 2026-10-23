import { LogActivityForm } from "@/components/activity/log-activity-form";
import { ClientActions } from "@/components/clients/client-dialog";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { InstagramIcon, WhatsAppIcon } from "@/components/icons";
import { NewTaskButton } from "@/components/tasks/new-task-button";
import { TaskList } from "@/components/tasks/task-list";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CLIENT_STATUS } from "@/lib/constants";
import { getClient, getLeads, getRequestTime, getTasks, getTeam, getTimeline, getViewer } from "@/lib/data";
import { memberByUserId } from "@/lib/team";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft, Globe, Mail, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const client = await getClient((await params).id);
  return { title: client ? (client.company ?? client.name) : "Client" };
}

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [client, timeline, team, tasks, leads, viewer] = await Promise.all([getClient(id), getTimeline({ clientId: id }), getTeam(), getTasks(), getLeads(), getViewer()]);
  if (!client) notFound();

  const owner = memberByUserId(team, client.owner_id);
  const status = CLIENT_STATUS[client.status];
  const clientTasks = tasks.filter((t) => t.client_id === client.id);
  const sourceLead = leads.find((l) => l.converted_client_id === client.id);
  const members = team.map((m) => ({ user_id: m.user_id, full_name: m.full_name, status: m.status }));

  const contact = [
    { icon: Mail, label: "Email", value: client.email },
    { icon: Phone, label: "Phone", value: client.phone },
    { icon: WhatsAppIcon, label: "WhatsApp", value: client.whatsapp_number },
    { icon: InstagramIcon, label: "Instagram", value: client.instagram_handle && `@${client.instagram_handle}` },
    { icon: Globe, label: "Website", value: client.website },
  ];

  return (
    <div className="space-y-6">
      <Link href="/clients" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg">
        <ArrowLeft className="size-3.5" /> All clients
      </Link>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={client.company ?? client.name} size="lg" />
          <div>
            <h1 className="flex items-center gap-3 text-xl font-semibold tracking-tight sm:text-2xl">
              {client.company ?? client.name} <Badge variant={status.variant}>{status.label}</Badge>
            </h1>
            <p className="mt-0.5 text-sm text-muted">
              {client.name} · {formatCurrency(client.monthly_retainer)}/mo · since {formatDate(client.started_at, { month: "short", year: "numeric" })}
            </p>
          </div>
        </div>
        {viewer.mode === "live" && (
          <div className="flex flex-wrap items-center gap-2">
            <ClientActions client={client} team={members} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Log activity" description="Meetings, calls and notes for this account" />
            <CardBody>
              <LogActivityForm clientId={client.id} />
            </CardBody>
          </Card>
          <ActivityFeed activities={timeline} team={team} title="Timeline" />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Details" />
            <CardBody>
              <dl className="space-y-3 text-sm">
                {contact.map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-3">
                    <Icon className="size-4 shrink-0 text-subtle" />
                    <dt className="sr-only">{label}</dt>
                    <dd className={value ? "truncate text-fg" : "text-subtle"}>{value || `No ${label.toLowerCase()}`}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-5 space-y-2 border-t border-line pt-4 text-xs">
                <Row label="Account owner" value={owner?.full_name ?? "No owner"} />
                <Row label="Industry" value={client.industry ?? "—"} />
                {sourceLead && (
                  <Row
                    label="Came from"
                    value={
                      <Link href={`/leads/${sourceLead.id}`} className="text-accent-strong hover:underline">
                        Lead
                      </Link>
                    }
                  />
                )}
              </div>
              {client.health_score !== null && (
                <div className="mt-4">
                  <div className="mb-1.5 flex justify-between text-xs">
                    <span className="text-subtle">Account health</span>
                    <span className="tabular-nums text-fg">{client.health_score}</span>
                  </div>
                  <Progress value={client.health_score} />
                </div>
              )}
              {client.services.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {client.services.map((s) => (
                    <Badge key={s} variant="accent">
                      {s}
                    </Badge>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Tasks" action={<NewTaskButton team={members} clientId={client.id} size="sm" variant="secondary" />} />
            <div className="mt-2">
              <TaskList tasks={clientTasks} team={team} now={getRequestTime()} empty="No tasks for this client." />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-subtle">{label}</span>
      <span className="text-fg">{value}</span>
    </div>
  );
}
