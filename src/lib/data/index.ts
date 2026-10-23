import "server-only";

import { connection } from "next/server";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type {
  Activity,
  AdCampaign,
  AdInsightDay,
  Client,
  Integration,
  Lead,
  MemberRole,
  MessageTemplate,
  Task,
  TeamMember,
  Workflow,
} from "@/lib/types";
import { ensureMonthlyReportTasks } from "@/lib/automation";
import * as demo from "./demo";

// Data access layer. Every page reads through these functions so the UI never
// cares whether it's talking to Supabase or the demo dataset.

export interface Viewer {
  mode: "demo" | "live";
  userId: string | null;
  orgId: string | null;
  orgName: string;
  orgSlug: string | null;
  bookingUrl: string | null;
  portfolioUrl: string | null;
  fullName: string;
  email: string;
  role: MemberRole;
}

export const getViewer = cache(async (): Promise<Viewer> => {
  if (!isSupabaseConfigured) {
    // Render per request so demo dates stay relative to "now".
    await connection();
    const owner = demo.demoTeam[0]!;
    return { mode: "demo", userId: owner.user_id, orgId: null, orgName: "Creative Cut", orgSlug: null, bookingUrl: null, portfolioUrl: null, fullName: owner.full_name, email: owner.email, role: owner.role };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) {
    return { mode: "live", userId: null, orgId: null, orgName: "Creative Cut", orgSlug: null, bookingUrl: null, portfolioUrl: null, fullName: "", email: "", role: "member" };
  }

  const loadMembership = () =>
    supabase
      .from("team_members")
      .select("org_id, role, organizations(name, slug, booking_url, portfolio_url)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at")
      .limit(1)
      .maybeSingle();

  let { data: membership } = await loadMembership();
  if (!membership) {
    // Picks up invitations sent to this email after the account was created.
    const { data: accepted } = await supabase.rpc("accept_invitations");
    if (accepted) ({ data: membership } = await loadMembership());
  }

  type OrgRow = { name: string; slug: string; booking_url: string | null; portfolio_url: string | null };
  const orgRaw = membership?.organizations as OrgRow | OrgRow[] | null | undefined;
  const org = Array.isArray(orgRaw) ? orgRaw[0] : orgRaw;

  return {
    mode: "live",
    userId: user.id,
    orgId: membership?.org_id ?? null,
    orgName: org?.name ?? "Creative Cut",
    orgSlug: org?.slug ?? null,
    bookingUrl: org?.booking_url ?? null,
    portfolioUrl: org?.portfolio_url ?? null,
    fullName: (user.user_metadata?.full_name as string | undefined) || user.email || "",
    email: user.email ?? "",
    role: (membership?.role as MemberRole | undefined) ?? "member",
  };
});

async function liveQuery<T>(table: string, build?: (q: ReturnType<Awaited<ReturnType<typeof createClient>>["from"]>) => unknown): Promise<T[]> {
  const viewer = await getViewer();
  if (!viewer.orgId) return [];
  const supabase = await createClient();
  const base = supabase.from(table);
  const query = (build ? build(base) : base.select("*")) as PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load ${table}: ${error.message}`);
  return data ?? [];
}

export const getLeads = cache(async (): Promise<Lead[]> => {
  if (!isSupabaseConfigured) return demo.demoLeads;
  return liveQuery<Lead>("leads", (q) => q.select("*").order("created_at", { ascending: false }));
});

export async function getLead(id: string): Promise<Lead | null> {
  const leads = await getLeads();
  return leads.find((lead) => lead.id === id) ?? null;
}

export const getClients = cache(async (): Promise<Client[]> => {
  if (!isSupabaseConfigured) return demo.demoClients;
  return liveQuery<Client>("clients", (q) => q.select("*").order("name"));
});

export async function getClient(id: string): Promise<Client | null> {
  const clients = await getClients();
  return clients.find((client) => client.id === id) ?? null;
}

/** Full timeline for one lead or client (the org-wide feed is capped). */
export async function getTimeline(target: { leadId?: string; clientId?: string }): Promise<Activity[]> {
  if (!isSupabaseConfigured) {
    return demo.demoActivities.filter((a) => (target.leadId && a.lead_id === target.leadId) || (target.clientId && a.client_id === target.clientId));
  }
  return liveQuery<Activity>("activities", (q) => {
    const scoped = q.select("*").order("created_at", { ascending: false }).limit(200);
    return target.leadId ? scoped.eq("lead_id", target.leadId) : scoped.eq("client_id", target.clientId!);
  });
}

export const getTasks = cache(async (): Promise<Task[]> => {
  if (!isSupabaseConfigured) return demo.demoTasks;
  const viewer = await getViewer();
  if (viewer.orgId) await ensureMonthlyReportTasks(await createClient(), viewer.orgId);
  return liveQuery<Task>("tasks", (q) => q.select("*").neq("status", "cancelled").order("due_at", { ascending: true, nullsFirst: false }).limit(500));
});

export const getActivities = cache(async (): Promise<Activity[]> => {
  if (!isSupabaseConfigured) return demo.demoActivities;
  return liveQuery<Activity>("activities", (q) => q.select("*").order("created_at", { ascending: false }).limit(50));
});

export const getTeam = cache(async (): Promise<TeamMember[]> => {
  if (!isSupabaseConfigured) return demo.demoTeam;

  type Row = {
    id: string; user_id: string | null; invite_email: string | null; role: MemberRole; status: TeamMember["status"];
    title: string | null; department: string | null;
    profiles: { full_name: string | null; email: string | null; avatar_url: string | null } | null;
  };
  const [rows, leads, clients] = await Promise.all([
    liveQuery<Row>("team_members", (q) => q.select("id, user_id, invite_email, role, status, title, department, profiles:user_id(full_name, email, avatar_url)").order("created_at")),
    getLeads(),
    getClients(),
  ]);

  return rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    full_name: row.profiles?.full_name ?? row.invite_email ?? "Unknown",
    email: row.profiles?.email ?? row.invite_email ?? "",
    role: row.role,
    status: row.status,
    title: row.title,
    department: row.department,
    avatar_url: row.profiles?.avatar_url ?? null,
    open_leads: row.user_id ? leads.filter((l) => l.owner_id === row.user_id && !["won", "lost"].includes(l.stage)).length : 0,
    clients: row.user_id ? clients.filter((c) => c.owner_id === row.user_id).length : 0,
  }));
});

export const getTemplates = cache(async (): Promise<MessageTemplate[]> => {
  if (!isSupabaseConfigured) return demo.demoTemplates;
  return liveQuery<MessageTemplate>("message_templates", (q) => q.select("*").order("name"));
});

export const getWorkflows = cache(async (): Promise<Workflow[]> => {
  if (!isSupabaseConfigured) return demo.demoWorkflows;

  type Row = Omit<Workflow, "steps" | "runs_last_30d" | "reply_rate"> & { workflow_steps: Workflow["steps"] };
  const rows = await liveQuery<Row>("workflows", (q) => q.select("*, workflow_steps(*)").order("created_at"));
  return rows.map(({ workflow_steps, ...wf }) => ({
    ...wf,
    steps: [...workflow_steps].sort((a, b) => a.position - b.position),
    runs_last_30d: 0,
    reply_rate: null,
  }));
});

export const getIntegrations = cache(async (): Promise<Integration[]> => {
  if (!isSupabaseConfigured) return demo.demoIntegrations;
  const rows = await liveQuery<Integration>("integrations", (q) => q.select("provider, status, config, connected_at, last_sync_at"));
  return demo.demoIntegrations.map((fallback) => rows.find((r) => r.provider === fallback.provider) ?? fallback);
});

export const getAdData = cache(async (): Promise<{ campaigns: AdCampaign[]; insights: AdInsightDay[] }> => {
  if (!isSupabaseConfigured) return { campaigns: demo.demoCampaigns, insights: demo.demoInsights };
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const [campaigns, insights] = await Promise.all([
    liveQuery<AdCampaign>("ad_campaigns", (q) => q.select("*").neq("status", "deleted")),
    liveQuery<AdInsightDay>("ad_insights_daily", (q) => q.select("*").gte("date", since).order("date")),
  ]);
  return { campaigns, insights };
});

export async function getRevenueTrend() {
  // Live mode: derive from won leads once there is history; demo shows a sample curve.
  if (!isSupabaseConfigured) return demo.demoRevenueTrend();
  const leads = await getLeads();
  const current = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const start = new Date(current.getFullYear(), current.getMonth() - (5 - i), 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    const inMonth = leads.filter((l) => new Date(l.created_at) >= start && new Date(l.created_at) < end);
    return {
      month: start.toLocaleString("en-US", { month: "short" }),
      revenue: inMonth.filter((l) => l.stage === "won").reduce((s, l) => s + l.estimated_value, 0),
      pipeline: inMonth.filter((l) => l.stage !== "lost").reduce((s, l) => s + l.estimated_value, 0),
    };
  });
}

/** One timestamp per request, so server and client render relative times identically. */
export const getRequestTime = cache(() => Date.now());
