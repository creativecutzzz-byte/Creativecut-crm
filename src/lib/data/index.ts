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
  Message,
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

export interface AgentRow {
  key: string;
  enabled: boolean;
  config: Record<string, unknown>;
  last_run_at: string | null;
  last_status: string | null;
  last_summary: string | null;
}

export interface AgentRun {
  id: string;
  agent_key: string;
  trigger: "cron" | "manual";
  status: "running" | "success" | "skipped" | "error";
  summary: string | null;
  items_created: number;
  items_updated: number;
  started_at: string;
  finished_at: string | null;
}

/** Saved agent switches/settings and recent runs. Empty in demo mode. */
export const getAgentData = cache(async (): Promise<{ rows: AgentRow[]; runs: AgentRun[] }> => {
  if (!isSupabaseConfigured) return { rows: [], runs: [] };
  const [rows, runs] = await Promise.all([
    liveQuery<AgentRow>("agents", (q) => q.select("key, enabled, config, last_run_at, last_status, last_summary")),
    liveQuery<AgentRun>("agent_runs", (q) => q.select("id, agent_key, trigger, status, summary, items_created, items_updated, started_at, finished_at").order("started_at", { ascending: false }).limit(30)),
  ]);
  return { rows, runs };
});

export interface OutreachDraft {
  id: string;
  lead_id: string;
  kind: "sequence" | "reply";
  sequence: string | null;
  step: number | null;
  step_label: string | null;
  channel: "email" | "whatsapp" | "instagram" | "linkedin";
  to_address: string | null;
  subject: string | null;
  body: string;
  template_name: string | null;
  notes: string | null;
  status: "pending" | "approved" | "sent" | "failed" | "rejected" | "cancelled";
  scheduled_for: string | null;
  sent_at: string | null;
  error: string | null;
  created_at: string;
  lead: { id: string; name: string; company: string | null; ai_score: number | null; linkedin_url: string | null; outreach_status: string | null } | null;
}

export type OutreachView = "pending" | "scheduled" | "sent" | "closed";

const VIEW_STATUSES: Record<OutreachView, OutreachDraft["status"][]> = {
  pending: ["pending", "failed"],
  scheduled: ["approved"],
  sent: ["sent"],
  closed: ["rejected", "cancelled"],
};

/** Approval queue drafts for one view, plus counts for every view. Empty in demo mode. */
export const getOutreachQueue = cache(async (view: OutreachView) => {
  const empty = { drafts: [] as OutreachDraft[], counts: { pending: 0, scheduled: 0, sent: 0, closed: 0 } as Record<OutreachView, number>, sentToday: 0, activeLeads: 0 };
  if (!isSupabaseConfigured) return empty;
  const viewer = await getViewer();
  if (!viewer.orgId) return empty;
  const supabase = await createClient();
  const count = (statuses: string[]) => supabase.from("outreach_drafts").select("id", { count: "exact", head: true }).in("status", statuses);
  const istMidnight = new Date(Date.now() + 5.5 * 3_600_000);
  istMidnight.setUTCHours(0, 0, 0, 0);
  const [drafts, pending, scheduled, sent, closed, sentToday, active] = await Promise.all([
    supabase
      .from("outreach_drafts")
      .select("id, lead_id, kind, sequence, step, step_label, channel, to_address, subject, body, template_name, notes, status, scheduled_for, sent_at, error, created_at, lead:leads(id, name, company, ai_score, linkedin_url, outreach_status)")
      .in("status", VIEW_STATUSES[view])
      .order(view === "sent" ? "sent_at" : "created_at", { ascending: view === "pending" || view === "scheduled" })
      .limit(100),
    count(VIEW_STATUSES.pending),
    count(VIEW_STATUSES.scheduled),
    count(VIEW_STATUSES.sent),
    count(VIEW_STATUSES.closed),
    supabase.from("messages").select("id", { count: "exact", head: true }).eq("channel", "email").eq("direction", "outbound").eq("status", "sent").gte("created_at", new Date(istMidnight.getTime() - 5.5 * 3_600_000).toISOString()),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("outreach_status", "active"),
  ]);
  if (drafts.error) throw new Error(`Failed to load outreach queue: ${drafts.error.message}`);
  return {
    drafts: (drafts.data ?? []).map((d) => ({ ...d, lead: Array.isArray(d.lead) ? (d.lead[0] ?? null) : d.lead })) as OutreachDraft[],
    counts: { pending: pending.count ?? 0, scheduled: scheduled.count ?? 0, sent: sent.count ?? 0, closed: closed.count ?? 0 },
    sentToday: sentToday.count ?? 0,
    activeLeads: active.count ?? 0,
  };
});

export interface Meeting {
  id: string;
  lead_id: string | null;
  title: string;
  starts_at: string;
  ends_at: string;
  meet_url: string | null;
  source: "booking_page" | "calendar";
  status: "scheduled" | "held" | "no_show" | "cancelled";
}

/** Meetings for one lead, newest first. Empty in demo mode. */
export const getLeadMeetings = cache(async (leadId: string): Promise<Meeting[]> => {
  if (!isSupabaseConfigured) return [];
  return liveQuery<Meeting>("meetings", (q) => q.select("id, lead_id, title, starts_at, ends_at, meet_url, source, status").eq("lead_id", leadId).order("starts_at", { ascending: false }).limit(10));
});

/** Autopilot drafts for one lead (lead page). */
export const getLeadOutreach = cache(async (leadId: string): Promise<OutreachDraft[]> => {
  if (!isSupabaseConfigured) return [];
  return liveQuery<OutreachDraft>("outreach_drafts", (q) =>
    q.select("id, lead_id, kind, sequence, step, step_label, channel, to_address, subject, body, template_name, notes, status, scheduled_for, sent_at, error, created_at").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(20),
  );
});

/** Latest WhatsApp / Instagram messages (both directions). Empty in demo mode. */
export const getMessages = cache(async (channel: "whatsapp" | "instagram", limit = 25): Promise<Message[]> => {
  if (!isSupabaseConfigured) return [];
  return liveQuery<Message>("messages", (q) =>
    q.select("id, channel, direction, status, lead_id, to_address, body, error, created_at").eq("channel", channel).order("created_at", { ascending: false }).limit(limit),
  );
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
