import type { ClientStatus, LeadSource, LeadStage, MemberRole } from "./types";

export const LEAD_STAGES: { id: LeadStage; label: string; tone: string }[] = [
  { id: "new", label: "New", tone: "bg-sky-400" },
  { id: "contacted", label: "Contacted", tone: "bg-indigo-400" },
  { id: "qualified", label: "Qualified", tone: "bg-violet-400" },
  { id: "proposal", label: "Proposal", tone: "bg-fuchsia-400" },
  { id: "negotiation", label: "Negotiation", tone: "bg-amber-400" },
  { id: "won", label: "Won", tone: "bg-emerald-400" },
  { id: "lost", label: "Lost", tone: "bg-zinc-500" },
];

export const OPEN_STAGES: LeadStage[] = ["new", "contacted", "qualified", "proposal", "negotiation"];

export const LEAD_SOURCES: Record<LeadSource, string> = {
  website: "Website",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  meta_ads: "Meta Ads",
  referral: "Referral",
  other: "Other",
};

export const CLIENT_STATUS: Record<ClientStatus, { label: string; variant: "success" | "info" | "warning" | "neutral" }> = {
  onboarding: { label: "Onboarding", variant: "info" },
  active: { label: "Active", variant: "success" },
  paused: { label: "Paused", variant: "warning" },
  churned: { label: "Churned", variant: "neutral" },
};

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  member: "Member",
};

export const SERVICES = ["Branding", "Video production", "Social media", "Paid ads", "Web design", "Photography"];
