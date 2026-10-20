import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { ScorePill } from "@/components/ui/score-pill";
import type { Lead, TeamMember } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";
import { memberByUserId } from "@/lib/team";
import Link from "next/link";

export function FollowUps({ leads, team, className }: { leads: Lead[]; team: TeamMember[]; className?: string }) {
  const now = new Date();
  const upcoming = leads
    .filter((l) => l.next_follow_up_at)
    .sort((a, b) => new Date(a.next_follow_up_at!).getTime() - new Date(b.next_follow_up_at!).getTime())
    .slice(0, 6);

  return (
    <Card className={className}>
      <CardHeader
        title="Follow-ups"
        description="Next touches across the team"
        action={
          <Link href="/leads" className="text-xs text-muted hover:text-fg">
            View all
          </Link>
        }
      />
      <ul className="divide-y divide-line px-2 pt-2 pb-2">
        {upcoming.map((lead) => {
          const overdue = new Date(lead.next_follow_up_at!) < now;
          const owner = memberByUserId(team, lead.owner_id);
          return (
            <li key={lead.id}>
              <Link href={`/leads/${lead.id}`} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-white/[0.03]">
                <Avatar name={lead.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-fg">{lead.company ?? lead.name}</p>
                  <p className="truncate text-[11px] text-subtle">{owner ? `Owner: ${owner.full_name}` : "Unassigned"}</p>
                </div>
                <ScorePill score={lead.ai_score} />
                <Badge variant={overdue ? "danger" : "neutral"} className={cn("min-w-[84px] justify-center")}>
                  {formatRelative(lead.next_follow_up_at, now)}
                </Badge>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
