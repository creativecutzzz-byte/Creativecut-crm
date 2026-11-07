import { InstagramIcon, WhatsAppIcon } from "@/components/icons";
import type { MemberRole } from "@/lib/types";
import { Bot, Briefcase, IndianRupee, Inbox, ListChecks, LayoutDashboard, Megaphone, Settings, Sun, Target, Users, Workflow } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

export type BadgeKey = "myTasksDue" | "approvals";

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Who sees it. Omitted = everyone. */
  roles?: MemberRole[];
  /** Live counter shown next to the label. */
  badge?: BadgeKey;
}

const LEADERS: MemberRole[] = ["owner", "admin", "manager"];
const ADMINS: MemberRole[] = ["owner", "admin"];

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "My day",
    items: [
      { href: "/today", label: "Today", icon: Sun },
      { href: "/tasks", label: "Tasks", icon: ListChecks, badge: "myTasksDue" },
      { href: "/leads", label: "Leads", icon: Target },
      { href: "/clients", label: "Clients", icon: Briefcase },
    ],
  },
  {
    title: "Sales",
    items: [
      { href: "/outreach", label: "Outreach", icon: Inbox, badge: "approvals" },
      { href: "/whatsapp", label: "WhatsApp", icon: WhatsAppIcon },
      { href: "/instagram", label: "Instagram", icon: InstagramIcon },
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: LEADERS },
      { href: "/sales", label: "Revenue", icon: IndianRupee, roles: LEADERS },
      { href: "/ads", label: "Meta Ads", icon: Megaphone, roles: LEADERS },
    ],
  },
  {
    title: "Admin",
    items: [
      { href: "/team", label: "Team", icon: Users },
      { href: "/agents", label: "AI Agents", icon: Bot, roles: ADMINS },
      { href: "/workflows", label: "Workflows", icon: Workflow, roles: LEADERS },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

/** The menu for one role: hidden items removed, empty sections dropped. */
export function navFor(role: MemberRole) {
  return NAV_SECTIONS.map((s) => ({ ...s, items: s.items.filter((i) => !i.roles || i.roles.includes(role)) })).filter((s) => s.items.length > 0);
}
