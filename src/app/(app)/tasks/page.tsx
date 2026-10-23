import { NewTaskButton } from "@/components/tasks/new-task-button";
import { TaskList } from "@/components/tasks/task-list";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getClients, getLeads, getRequestTime, getTasks, getTeam, getViewer } from "@/lib/data";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Tasks" };

const SCOPES = [
  { id: "mine", label: "My tasks" },
  { id: "all", label: "Everyone" },
] as const;

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const [{ scope: rawScope }, tasks, team, leads, clients, viewer] = await Promise.all([searchParams, getTasks(), getTeam(), getLeads(), getClients(), getViewer()]);
  const scope = rawScope === "all" ? "all" : "mine";
  const now = getRequestTime();

  const visible = scope === "mine" ? tasks.filter((t) => t.assignee_id === viewer.userId) : tasks;
  const open = visible.filter((t) => t.status === "open");
  const overdue = open.filter((t) => t.due_at && new Date(t.due_at).getTime() < now);
  const upcoming = open.filter((t) => !overdue.includes(t));
  const done = visible.filter((t) => t.status === "done").slice(0, 20);

  const related = (task: Task) => {
    if (task.lead_id) {
      const lead = leads.find((l) => l.id === task.lead_id);
      return lead ? { href: `/leads/${lead.id}`, label: lead.company ?? lead.name } : null;
    }
    if (task.client_id) {
      const client = clients.find((c) => c.id === task.client_id);
      return client ? { href: `/clients/${client.id}`, label: client.company ?? client.name } : null;
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        description={`${open.length} open · ${overdue.length} overdue`}
        actions={
          viewer.mode === "live" && (
            <NewTaskButton
              team={team.map((m) => ({ user_id: m.user_id, full_name: m.full_name, status: m.status }))}
              leads={leads.filter((l) => l.stage !== "won" && l.stage !== "lost").map((l) => ({ id: l.id, label: l.company ?? l.name }))}
              clients={clients.map((c) => ({ id: c.id, label: c.company ?? c.name }))}
            />
          )
        }
      />

      <div className="flex gap-1 rounded-lg border border-line bg-surface-2/60 p-1 text-xs w-fit">
        {SCOPES.map((s) => (
          <Link key={s.id} href={`/tasks?scope=${s.id}`} className={cn("rounded-md px-3 py-1.5", scope === s.id ? "bg-surface-3 text-fg" : "text-muted hover:text-fg")}>
            {s.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          {overdue.length > 0 && (
            <Card>
              <CardHeader title="Overdue" />
              <div className="mt-2">
                <TaskList tasks={overdue} team={team} now={now} related={related} />
              </div>
            </Card>
          )}
          <Card>
            <CardHeader title="Upcoming" />
            <div className="mt-2">
              <TaskList tasks={upcoming} team={team} now={now} related={related} empty="Nothing scheduled — add a task to stay on top of follow-ups." />
            </div>
          </Card>
        </div>
        <Card className="h-fit">
          <CardHeader title="Recently completed" />
          <div className="mt-2">
            <TaskList tasks={done} team={team} now={now} related={related} empty="No completed tasks yet." />
          </div>
        </Card>
      </div>
    </div>
  );
}
