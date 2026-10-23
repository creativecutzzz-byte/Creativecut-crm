import { InviteForm } from "@/components/team/invite-form";
import { MemberControls } from "@/components/team/member-controls";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ROLE_LABELS } from "@/lib/constants";
import { getTeam, getViewer } from "@/lib/data";
import type { MemberRole } from "@/lib/types";
import { Check, Minus } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Team" };

const roleVariant: Record<MemberRole, "accent" | "info" | "success" | "neutral"> = {
  owner: "accent",
  admin: "info",
  manager: "success",
  member: "neutral",
};

// Mirrors the RLS policies in supabase/migrations.
const permissions: { label: string; roles: MemberRole[] }[] = [
  { label: "View & edit leads, clients, tasks", roles: ["owner", "admin", "manager", "member"] },
  { label: "Build & activate workflows", roles: ["owner", "admin", "manager"] },
  { label: "Invite & manage teammates", roles: ["owner", "admin"] },
  { label: "Connect integrations", roles: ["owner", "admin"] },
  { label: "Workspace settings", roles: ["owner", "admin"] },
];

export default async function TeamPage() {
  const [team, viewer] = await Promise.all([getTeam(), getViewer()]);
  const canManage = viewer.mode === "live" && (viewer.role === "owner" || viewer.role === "admin");
  const maxLoad = Math.max(1, ...team.map((m) => m.open_leads + m.clients));

  return (
    <div className="space-y-6">
      <PageHeader title="Team" description={`${team.filter((m) => m.status === "active").length} active members · roles control what each person can change`} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="overflow-hidden xl:col-span-2">
          <CardHeader title="Members" />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-y border-line text-[11px] tracking-wide text-subtle uppercase">
                <tr>
                  <th className="px-5 py-3 font-medium">Member</th>
                  <th className="px-3 py-3 font-medium">Role</th>
                  <th className="px-3 py-3 font-medium">Department</th>
                  <th className="px-5 py-3 font-medium">Workload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {team.map((m) => {
                  const load = m.open_leads + m.clients;
                  return (
                    <tr key={m.id} className="hover:bg-white/[0.02]">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={m.full_name} />
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 font-medium">
                              {m.full_name}
                              {m.status === "invited" && <Badge variant="warning">Invited</Badge>}
                            </p>
                            <p className="truncate text-xs text-subtle">{m.title ?? m.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {canManage && m.role !== "owner" && m.user_id !== viewer.userId ? (
                          <MemberControls id={m.id} role={m.role} name={m.full_name} invited={m.status === "invited"} />
                        ) : (
                          <Badge variant={roleVariant[m.role]}>{ROLE_LABELS[m.role]}</Badge>
                        )}
                      </td>
                      <td className="px-3 py-3 text-muted">{m.department ?? "—"}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/5">
                            <div className="h-full rounded-full bg-accent" style={{ width: `${(load / maxLoad) * 100}%` }} />
                          </div>
                          <span className="text-xs whitespace-nowrap text-muted">
                            {m.open_leads} leads · {m.clients} clients
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-4">
          {(viewer.mode === "demo" || canManage) && (
            <Card>
              <CardHeader title="Invite a teammate" description="They join when they create an account with this email" />
              <CardBody>
                <InviteForm />
              </CardBody>
            </Card>
          )}
          <Card>
            <CardHeader title="Role permissions" description="Enforced by database row-level security" />
            <CardBody className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-subtle">
                    <th className="pb-2 text-left font-medium" />
                    {(Object.keys(ROLE_LABELS) as MemberRole[]).map((r) => (
                      <th key={r} className="px-1 pb-2 font-medium">
                        {ROLE_LABELS[r]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {permissions.map((p) => (
                    <tr key={p.label}>
                      <td className="py-2 pr-2 text-muted">{p.label}</td>
                      {(Object.keys(ROLE_LABELS) as MemberRole[]).map((r) => (
                        <td key={r} className="px-1 py-2 text-center">
                          {p.roles.includes(r) ? <Check className="mx-auto size-3.5 text-emerald-300" /> : <Minus className="mx-auto size-3.5 text-subtle" />}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
