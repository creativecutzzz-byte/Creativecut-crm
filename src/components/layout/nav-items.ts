import { InstagramIcon, WhatsAppIcon } from "@/components/icons";
import { Briefcase, ListChecks, LayoutDashboard, Megaphone, Settings, Target, Users, Workflow } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/leads", label: "Leads", icon: Target },
      { href: "/clients", label: "Clients", icon: Briefcase },
      { href: "/tasks", label: "Tasks", icon: ListChecks },
    ],
  },
  {
    title: "Channels",
    items: [
      { href: "/whatsapp", label: "WhatsApp", icon: WhatsAppIcon },
      { href: "/instagram", label: "Instagram", icon: InstagramIcon },
      { href: "/ads", label: "Meta Ads", icon: Megaphone },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/workflows", label: "Workflows", icon: Workflow },
      { href: "/team", label: "Team", icon: Users },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];
