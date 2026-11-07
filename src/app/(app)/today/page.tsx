import { AutoRefresh } from "@/components/live/auto-refresh";
import { TaskList } from "@/components/tasks/task-list";
import { CheckinForm } from "@/components/today/checkin-form";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { getCheckins, getLeads, getRecentReplies, getRequestTime, getTasks, getTeam, getTodayCounts, getTodayMeetings, getViewer, istToday } from "@/lib/data";
import { razorpay } from "@/lib/integrations/razorpay";
import { memberByUserId } from "@/lib/team";
import type { Task } from "@/lib/types";
import { formatCurrency, formatRelative } from "@/lib/utils";
import { CalendarClock, CheckSquare, Flame, IndianRupee, Inbox, Plus, Sparkles, Video } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Today" };

const HOT = new Set(["interested", "meeting_request", "question"]);

export default async function TodayPage() {
  const [viewer, tasks, team, leads, checkins, meetings, replies, counts] = await Promise.all([
    getViewer(),
    getTasks(),
    getTeam(),
    getLeads(),
    getCheckins(),
    getTodayMeetings(),
    getRecentReplies(48),
    getTodayCounts(),
  ]);
  const now = getRequestTime();
  const day = istToday(now);
  const endOfDay = Date.parse(`${day}T23:59:59+05:30`);
  const firstName = (viewer.fullName || "there").split(" ")[0];
  const leadName = new Map(leads.map((l) => [l.id, l.company && l.company !== l.name ? `${l.name} · ${l.company}` : l.name]));
  const canApprove = ["owner", "admin", "manager"].includes(viewer.role);

  const mine = tasks.filter((t) => t.status === "open" && t.assignee_id === viewer.userId && (!t.due_at || new Date(t.due_at).getTime() <= endOfDay));
  const myOverdue = mine.filter((t) => t.due_at && new Date(t.due_at).getTime() < now).length;
  const newLeadsToday = leads.filter((l) => l.created_at >= new Date(Date.parse(`${day}T00:00:00+05:30`)).toISOString()).length;
  const hot = replies.filter((r) => HOT.has(r.classification?.intent ?? ""));
  const myCheckin = checkins.find((c) => c.user_id === viewer.userId) ?? null;
  const teamCheckins = [...checkins].sort((a, b) => Number(Boolean(b.stuck)) - Number(Boolean(a.stuck)));
  const notCheckedIn = team.filter((m) => m.status === "active" && m.user_id && !checkins.some((c) => c.user_id === m.user_id));

  let salesToday: number | null = null;
  if (razorpay.isConfigured() && canApprove) {
    try {
      const payments = await razorpay.payments(new Date(Date.parse(`${day}T00:00:00+05:30`)), new Date(now));
      salesToday = payments.filter((p) => p.status === "captured").reduce((s, p) => s + p.amount, 0);
    } catch {
      salesToday = null;
    }
  }

  const related = (task: Task) => (task.lead_id ? { href: `/leads/${task.lead_id}`, label: leadName.get(task.lead_id) ?? "Lead" } : task.client_id ? { href: `/clients/${task.client_id}`, label: "Client" } : null);

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={60} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs text-subtle">{new Date(now).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 className="mt-1 font-display text-4xl leading-none tracking-wide uppercase sm:text-5xl">Namaste, <span className="text-accent">{firstName}</span> 👋</h1>
          <p className="mt-1 text-sm text-muted">
            {mine.length ? `${mine.length} task${mine.length === 1 ? "" : "s"} for today${myOverdue ? ` (${myOverdue} overdue)` : ""}` : "No tasks due — a good day to add leads."}
            {meetings.length ? ` · ${meetings.length} meeting${meetings.length === 1 ? "" : "s"}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/leads" className={buttonClasses({ variant: "primary", size: "sm" })}>
            <Plus className="size-3.5" /> New lead
          </Link>
          <Link href="/tasks" className={buttonClasses({ size: "sm" })}>
            <CheckSquare className="size-3.5" /> All tasks
          </Link>
          {canApprove && (
            <Link href="/outreach" className={buttonClasses({ size: "sm" })}>
              <Inbox className="size-3.5" /> Approvals {counts.approvals ? `(${counts.approvals})` : ""}
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="My tasks today" value={String(mine.length)} icon={CheckSquare} hint={myOverdue ? `${myOverdue} overdue` : undefined} />
        <StatCard label="Meetings today" value={String(meetings.length)} icon={CalendarClock} />
        {canApprove ? <StatCard label="Waiting for approval" value={String(counts.approvals)} icon={Inbox} /> : <StatCard label="Hot replies (48h)" value={String(hot.length)} icon={Flame} />}
        {salesToday !== null ? <StatCard label="Sales today" value={formatCurrency(salesToday)} icon={IndianRupee} /> : <StatCard label="New leads today" value={String(newLeadsToday)} icon={Sparkles} />}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader title="My tasks" description="Due today or overdue · tick them off as you go" />
            <TaskList tasks={mine} team={team} now={now} related={related} empty="All clear for today 🎉" />
          </Card>

          <Card>
            <CardHeader title="Meetings today" description="Booked online or on the calendar" />
            <ul className="divide-y divide-line px-2 pb-2">
              {meetings.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="w-20 shrink-0 text-sm font-medium">{new Date(m.starts_at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" })}</span>
                  <Link href={m.lead_id ? `/leads/${m.lead_id}` : "#"} className="min-w-0 flex-1 truncate text-sm hover:underline">
                    {(m.lead_id && leadName.get(m.lead_id)) || m.title}
                  </Link>
                  {m.meet_url && (
                    <a href={m.meet_url} target="_blank" rel="noreferrer" className={buttonClasses({ size: "sm" })}>
                      <Video className="size-3.5" /> Join
                    </a>
                  )}
                </li>
              ))}
              {meetings.length === 0 && <li className="py-6 text-center text-xs text-subtle">No meetings today.</li>}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Replies (last 48 hours)" description="Hot ones first — answer them before anything else" />
            <ul className="divide-y divide-line px-2 pb-2">
              {[...replies].sort((a, b) => Number(HOT.has(b.classification?.intent ?? "")) - Number(HOT.has(a.classification?.intent ?? ""))).slice(0, 8).map((r) => (
                <li key={r.id}>
                  <Link href={r.lead_id ? `/leads/${r.lead_id}` : "#"} className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-white/[0.03]">
                    {HOT.has(r.classification?.intent ?? "") ? <Flame className="mt-0.5 size-4 shrink-0 text-amber-300" /> : <Inbox className="mt-0.5 size-4 shrink-0 text-subtle" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">
                        {(r.lead_id && leadName.get(r.lead_id)) || r.to_address} <span className="text-[11px] text-subtle">· {r.channel} · {formatRelative(r.created_at)}</span>
                      </p>
                      <p className="line-clamp-2 text-xs text-muted">{r.body}</p>
                    </div>
                    {r.classification?.intent && <Badge variant={HOT.has(r.classification.intent) ? "warning" : "neutral"}>{r.classification.intent.replace(/_/g, " ")}</Badge>}
                  </Link>
                </li>
              ))}
              {replies.length === 0 && <li className="py-6 text-center text-xs text-subtle">No replies in the last 48 hours.</li>}
            </ul>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="My check-in" description="30 seconds · helps the team know who needs help" />
            <CardBody>
              <CheckinForm disabled={viewer.mode !== "live"} initial={myCheckin ? { doing: myCheckin.doing ?? "", done: myCheckin.done ?? "", stuck: myCheckin.stuck ?? "" } : null} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Team today" description="Stuck people first" />
            <ul className="space-y-3 px-5 pb-5">
              {teamCheckins.map((c) => {
                const m = memberByUserId(team, c.user_id);
                return (
                  <li key={c.id} className="rounded-lg border border-line bg-surface-2/60 p-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={m?.full_name ?? "?"} size="sm" />
                      <p className="flex-1 truncate text-sm font-medium">{m?.full_name ?? "Teammate"}</p>
                      {c.stuck ? <Badge variant="danger">Stuck</Badge> : <Badge variant="success">On track</Badge>}
                    </div>
                    {c.stuck && <p className="mt-2 text-xs text-rose-200">🧱 {c.stuck}</p>}
                    {c.doing && <p className="mt-1.5 text-xs text-muted">🎯 {c.doing}</p>}
                    {c.done && <p className="mt-1 text-xs text-muted">✅ {c.done}</p>}
                  </li>
                );
              })}
              {teamCheckins.length === 0 && <li className="py-4 text-center text-xs text-subtle">No check-ins yet today.</li>}
              {notCheckedIn.length > 0 && <li className="text-[11px] text-subtle">Not checked in: {notCheckedIn.map((m) => m.full_name.split(" ")[0]).join(", ")}</li>}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
