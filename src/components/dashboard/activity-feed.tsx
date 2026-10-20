import { InstagramIcon, WhatsAppIcon } from "@/components/icons";
import { Card, CardHeader } from "@/components/ui/card";
import type { Activity, ActivityType, TeamMember } from "@/lib/types";
import { formatRelative } from "@/lib/utils";
import { memberByUserId } from "@/lib/team";
import { ArrowRightLeft, Bot, CalendarDays, CheckCircle2, Mail, Phone, StickyNote } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

const icons: Record<ActivityType, ComponentType<SVGProps<SVGSVGElement>>> = {
  note: StickyNote,
  call: Phone,
  email: Mail,
  whatsapp: WhatsAppIcon,
  instagram: InstagramIcon,
  meeting: CalendarDays,
  stage_change: ArrowRightLeft,
  task: CheckCircle2,
  system: Bot,
};

export function ActivityFeed({ activities, team, title = "Recent activity" }: { activities: Activity[]; team: TeamMember[]; title?: string }) {
  return (
    <Card>
      <CardHeader title={title} description="Everything your team and automations did" />
      <ol className="relative px-5 pt-4 pb-5">
        {activities.length === 0 && <li className="py-6 text-center text-sm text-muted">No activity yet.</li>}
        {activities.map((activity, i) => {
          const Icon = icons[activity.type];
          const actor = memberByUserId(team, activity.actor_id);
          return (
            <li key={activity.id} className="relative flex gap-4 pb-5 last:pb-0">
              {i < activities.length - 1 && <span className="absolute top-8 bottom-0 left-[15px] w-px bg-line" />}
              <span className="relative grid size-8 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-muted">
                <Icon className="size-3.5" />
              </span>
              <div className="min-w-0 pt-1">
                <p className="text-sm text-fg">{activity.body}</p>
                <p className="mt-0.5 text-[11px] text-subtle">
                  {actor ? actor.full_name : "Automation"} · {formatRelative(activity.created_at)}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
