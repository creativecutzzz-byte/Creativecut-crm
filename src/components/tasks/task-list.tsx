import { deleteTask, setTaskStatus } from "@/app/actions/tasks";
import { Badge } from "@/components/ui/badge";
import { memberByUserId } from "@/lib/team";
import type { Task, TeamMember } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";
import { Check, Trash2 } from "lucide-react";
import Link from "next/link";
import { CopyButton } from "./copy-button";

const priorityVariant = { high: "danger", medium: "warning", low: "neutral" } as const;

export function TaskList({
  tasks,
  team,
  now,
  related,
  empty = "No tasks.",
}: {
  tasks: Task[];
  team: TeamMember[];
  now: number;
  /** Shows a link to the related lead/client when provided. */
  related?: (task: Task) => { href: string; label: string } | null;
  empty?: string;
}) {
  if (tasks.length === 0) return <p className="px-5 py-6 text-center text-xs text-subtle">{empty}</p>;

  return (
    <ul className="divide-y divide-line">
      {tasks.map((task) => {
        const done = task.status === "done";
        const overdue = !done && task.due_at !== null && new Date(task.due_at).getTime() < now;
        const assignee = memberByUserId(team, task.assignee_id);
        const link = related?.(task);
        return (
          <li key={task.id} className="group flex items-start gap-3 px-5 py-3">
            <form action={setTaskStatus}>
              <input type="hidden" name="id" value={task.id} />
              <input type="hidden" name="status" value={done ? "open" : "done"} />
              <button
                type="submit"
                aria-label={done ? "Mark as not done" : "Mark as done"}
                className={cn(
                  "mt-0.5 grid size-5 place-items-center rounded-md border transition-colors",
                  done ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-300" : "border-line-strong text-transparent hover:border-accent hover:text-accent-strong",
                )}
              >
                <Check className="size-3.5" />
              </button>
            </form>
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm", done ? "text-subtle line-through" : "text-fg")}>{task.title}</p>
              {task.description &&
                (task.sequence ? (
                  <details className="mt-1 text-xs" open={!done && task.due_at !== null && new Date(task.due_at).getTime() <= now + 86_400_000}>
                    <summary className="cursor-pointer text-muted hover:text-fg">Message</summary>
                    <p className="mt-1.5 rounded-lg border border-line bg-surface-2/60 p-3 leading-relaxed whitespace-pre-line text-fg/90">{task.description}</p>
                    <div className="mt-1.5">
                      <CopyButton text={task.description} />
                    </div>
                  </details>
                ) : (
                  <p className="mt-0.5 text-xs whitespace-pre-line text-muted">{task.description}</p>
                ))}
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-subtle">
                <Badge variant={priorityVariant[task.priority]}>{task.priority}</Badge>
                {task.due_at && <span className={overdue ? "text-rose-300" : undefined}>Due {formatRelative(task.due_at, new Date(now))}</span>}
                <span>· {assignee?.full_name ?? "Unassigned"}</span>
                {link && (
                  <Link href={link.href} className="text-accent-strong hover:underline">
                    · {link.label}
                  </Link>
                )}
              </div>
            </div>
            <form action={deleteTask}>
              <input type="hidden" name="id" value={task.id} />
              <button type="submit" aria-label="Delete task" className="grid size-7 place-items-center rounded-md text-subtle opacity-60 hover:bg-white/5 hover:text-rose-300 group-hover:opacity-100">
                <Trash2 className="size-3.5" />
              </button>
            </form>
          </li>
        );
      })}
    </ul>
  );
}
