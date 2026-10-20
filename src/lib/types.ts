// Domain types mirroring supabase/migrations. Regenerate a full `Database`
// type with `supabase gen types typescript` once a project is linked.

export type MemberRole = "owner" | "admin" | "manager" | "member";
export type MemberStatus = "active" | "invited" | "disabled";
export type LeadStage = "new" | "contacted" | "qualified" | "proposal" | "negotiation" | "won" | "lost";
export type LeadSource = "website" | "instagram" | "whatsapp" | "meta_ads" | "referral" | "other";
export type ClientStatus = "onboarding" | "active" | "paused" | "churned";
export type ActivityType =
  | "note" | "call" | "email" | "whatsapp" | "instagram" | "meeting" | "stage_change" | "task" | "system";
export type Channel = "whatsapp" | "instagram" | "email" | "sms";
export type MessageStatus = "draft" | "queued" | "simulated" | "sent" | "delivered" | "read" | "failed";
export type WorkflowTrigger = "lead_created" | "stage_changed" | "no_reply" | "scheduled" | "manual";
export type WorkflowAction =
  | "wait" | "send_whatsapp" | "send_instagram_dm" | "send_email" | "create_task" | "update_stage" | "notify_team";
export type IntegrationProvider = "whatsapp" | "instagram" | "meta_ads";
export type IntegrationStatus = "disconnected" | "pending" | "connected" | "error";
export type CampaignStatus = "active" | "paused" | "archived" | "deleted";

export interface TeamMember {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  role: MemberRole;
  status: MemberStatus;
  title: string | null;
  department: string | null;
  avatar_url: string | null;
  open_leads: number;
  clients: number;
}

export interface Lead {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  instagram_handle: string | null;
  source: LeadSource;
  stage: LeadStage;
  estimated_value: number;
  service_interest: string[];
  ai_score: number | null;
  ai_summary: string | null;
  ai_next_action: string | null;
  owner_id: string | null;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  marketing_consent: boolean;
  tags: string[];
  created_at: string;
}

export interface Client {
  id: string;
  name: string;
  company: string | null;
  industry: string | null;
  email: string | null;
  phone: string | null;
  instagram_handle: string | null;
  website: string | null;
  status: ClientStatus;
  monthly_retainer: number;
  services: string[];
  owner_id: string | null;
  started_at: string | null;
  health_score: number | null;
}

export interface Activity {
  id: string;
  type: ActivityType;
  body: string | null;
  lead_id: string | null;
  client_id: string | null;
  actor_id: string | null;
  created_at: string;
}

export interface MessageTemplate {
  id: string;
  channel: Channel;
  name: string;
  body: string;
  variables: string[];
  external_template_name: string | null;
}

export interface WorkflowStep {
  id: string;
  position: number;
  action: WorkflowAction;
  config: Record<string, unknown>;
}

export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  trigger: WorkflowTrigger;
  trigger_config: Record<string, unknown>;
  is_active: boolean;
  steps: WorkflowStep[];
  runs_last_30d: number;
  reply_rate: number | null;
}

export interface Integration {
  provider: IntegrationProvider;
  status: IntegrationStatus;
  config: Record<string, string>;
  connected_at: string | null;
  last_sync_at: string | null;
}

export interface AdCampaign {
  id: string;
  external_id: string;
  name: string;
  client_id: string | null;
  objective: string | null;
  status: CampaignStatus;
  daily_budget: number | null;
}

export interface AdInsightDay {
  campaign_id: string;
  date: string;
  impressions: number;
  reach: number;
  clicks: number;
  spend: number;
  leads: number;
  conversions: number;
  revenue: number;
}
