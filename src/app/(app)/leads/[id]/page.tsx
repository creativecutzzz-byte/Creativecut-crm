import { LogActivityForm } from "@/components/activity/log-activity-form";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { InstagramIcon, WhatsAppIcon } from "@/components/icons";
import { LeadActions } from "@/components/leads/lead-actions";
import { SequenceControls } from "@/components/leads/sequence-controls";
import { StageForm } from "@/components/leads/stage-form";
import { NewTaskButton } from "@/components/tasks/new-task-button";
import { TaskList } from "@/components/tasks/task-list";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScorePill } from "@/components/ui/score-pill";
import { scoreLead } from "@/lib/ai/lead-scoring";
import { LEAD_SOURCES } from "@/lib/constants";
import { getLead, getRequestTime, getTasks, getTeam, getTimeline, getViewer } from "@/lib/data";
import { formatCurrency, formatDate, formatRelative } from "@/lib/utils";
import { memberByUserId } from "@/lib/team";
import { ArrowLeft, Globe, Mail, Phone, Send, Sparkles, Target } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const lead = await getLead((await params).id);
  return { title: lead ? (lead.company ?? lead.name) : "Lead" };
}

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [lead, timeline, team, tasks, viewer] = await Promise.all([getLead(id), getTimeline({ leadId: id }), getTeam(), getTasks(), getViewer()]);
  if (!lead) notFound();
  const leadTasks = tasks.filter((t) => t.lead_id === lead.id);
  const activeSequence = leadTasks.find((t) => t.sequence && t.status === "open")?.sequence ?? null;
  const members = team.map((m) => ({ user_id: m.user_id, full_name: m.full_name, status: m.status }));

  const owner = memberByUserId(team, lead.owner_id);
  const { factors } = scoreLead(lead);

  const contact = [
    { icon: Mail, label: "Email", value: lead.email },
    { icon: Phone, label: "Phone", value: lead.phone },
    { icon: WhatsAppIcon, label: "WhatsApp", value: lead.whatsapp_number },
    { icon: InstagramIcon, label: "Instagram", value: lead.instagram_handle && `@${lead.instagram_handle}` },
    { icon: Globe, label: "Website", value: lead.website },
    { icon: Target, label: "Source", value: LEAD_SOURCES[lead.source] },
  ];

  return (
    <div className="space-y-6">
      <Link href="/leads" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg">
        <ArrowLeft className="size-3.5" /> All leads
      </Link>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={lead.name} size="lg" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{lead.company ?? lead.name}</h1>
            <p className="mt-0.5 text-sm text-muted">
              {lead.name} · {formatCurrency(lead.estimated_value)} · added {formatDate(lead.created_at)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {lead.whatsapp_number && (
            <Link href={`/whatsapp?lead=${lead.id}`} className={buttonClasses({ variant: "secondary" })}>
              <WhatsAppIcon className="size-4" /> Draft WhatsApp
            </Link>
          )}
          {lead.instagram_handle && (
            <Link href={`/instagram?lead=${lead.id}`} className={buttonClasses({ variant: "secondary" })}>
              <InstagramIcon className="size-4" /> Draft DM
            </Link>
          )}
          <StageForm id={lead.id} stage={lead.stage} />
          {viewer.mode === "live" && <LeadActions lead={lead} team={members} />}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="relative overflow-hidden">
            <div className="pointer-events-none absolute -top-20 -right-20 size-48 rounded-full bg-accent/15 blur-3xl" />
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Sparkles className="size-4 text-accent-strong" /> AI summary
                </span>
              }
              action={<ScorePill score={lead.ai_score} />}
            />
            <CardBody className="relative space-y-4">
              <p className="text-sm leading-relaxed text-fg/90">{lead.ai_summary ?? "No summary yet — it will appear after the first conversation is logged."}</p>
              {lead.ai_next_action && (
                <div className="rounded-xl border border-accent/20 bg-accent-soft/50 p-3">
                  <p className="text-[11px] font-semibold tracking-wide text-accent-strong uppercase">Suggested next action</p>
                  <p className="mt-1 text-sm text-fg">{lead.ai_next_action}</p>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Log activity" description="Calls, meetings and notes update the timeline and last-contact date" />
            <CardBody>
              <LogActivityForm leadId={lead.id} />
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
                    <dd className={value ? "truncate text-fg" : "text-subtle"}>{value || `No ${label === "WhatsApp" || label === "Instagram" ? label : label.toLowerCase()}`}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-5 space-y-2 border-t border-line pt-4 text-xs">
                <Row label="Owner" value={owner?.full_name ?? "Unassigned"} />
                <Row label="Last contact" value={formatRelative(lead.last_contacted_at)} />
                <Row label="Next follow-up" value={formatRelative(lead.next_follow_up_at)} />
                <Row label="Automations" value={lead.marketing_consent ? <Badge variant="success">Opted in</Badge> : <Badge>No consent</Badge>} />
              </div>
              {lead.service_interest.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {lead.service_interest.map((s) => (
                    <Badge key={s} variant="accent">
                      {s}
                    </Badge>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {viewer.mode === "live" && (
            <Card>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <Send className="size-4 text-accent-strong" /> Outreach sequence
                  </span>
                }
                description="Creates a dated task per step with the message filled in"
              />
              <CardBody className="space-y-3">
                {lead.personalization ? (
                  <p className="rounded-lg border border-line bg-surface-2/60 p-3 text-xs leading-relaxed text-fg/90">{lead.personalization}</p>
                ) : (
                  <p className="text-xs text-amber-300">Add a personalisation line (Edit) before starting cold outreach.</p>
                )}
                <SequenceControls leadId={lead.id} activeSequence={activeSequence} closed={lead.stage === "won" || lead.stage === "lost"} />
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Tasks" action={<NewTaskButton team={members} leadId={lead.id} size="sm" variant="secondary" />} />
            <div className="mt-2">
              <TaskList tasks={leadTasks} team={team} now={getRequestTime()} empty="No tasks for this lead." />
            </div>
          </Card>

          <Card>
            <CardHeader title="Why this score" description="Transparent scoring factors" />
            <CardBody className="space-y-3">
              {factors.map((f) => (
                <div key={f.label}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-muted">{f.label}</span>
                    <span className={f.points < 0 ? "text-rose-300" : "text-fg"}>{f.points > 0 ? `+${f.points}` : f.points}</span>
                  </div>
                  <Progress value={Math.abs(f.points) * 3.3} tone={f.points < 0 ? "bg-rose-400/70" : "bg-accent"} />
                </div>
              ))}
            </CardBody>
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
