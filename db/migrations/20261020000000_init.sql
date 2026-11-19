-- =============================================================================
-- Creative Cut CRM — initial schema
--
-- Multi-tenant by organization. Every business table carries `org_id` and is
-- protected by Row Level Security so users only ever see their own agency's
-- data.
--
-- Credentials policy: no API token is ever stored in these tables. The
-- `integrations` table only holds non-secret configuration plus the *name* of
-- a Supabase Vault secret (`secret_ref`). Tokens live in Vault or in server
-- environment variables.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.member_role       as enum ('owner', 'admin', 'manager', 'member');
create type public.member_status     as enum ('active', 'invited', 'disabled');
create type public.lead_stage        as enum ('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost');
create type public.lead_source       as enum ('website', 'instagram', 'whatsapp', 'meta_ads', 'referral', 'other');
create type public.client_status     as enum ('onboarding', 'active', 'paused', 'churned');
create type public.activity_type     as enum ('note', 'call', 'email', 'whatsapp', 'instagram', 'meeting', 'stage_change', 'task', 'system');
create type public.task_status       as enum ('open', 'done', 'cancelled');
create type public.task_priority     as enum ('low', 'medium', 'high');
create type public.channel           as enum ('whatsapp', 'instagram', 'email', 'sms');
create type public.message_direction as enum ('inbound', 'outbound');
-- `simulated` = produced by dry-run mode; nothing left the system.
create type public.message_status    as enum ('draft', 'queued', 'simulated', 'sent', 'delivered', 'read', 'failed');
create type public.workflow_trigger  as enum ('lead_created', 'stage_changed', 'no_reply', 'scheduled', 'manual');
create type public.workflow_action   as enum ('wait', 'send_whatsapp', 'send_instagram_dm', 'send_email', 'create_task', 'update_stage', 'notify_team');
create type public.run_status        as enum ('pending', 'running', 'completed', 'failed', 'cancelled');
create type public.integration_provider as enum ('whatsapp', 'instagram', 'meta_ads');
create type public.integration_status   as enum ('disconnected', 'pending', 'connected', 'error');
create type public.campaign_status   as enum ('active', 'paused', 'archived', 'deleted');

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Organizations, profiles & team
-- -----------------------------------------------------------------------------
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  timezone    text not null default 'UTC',
  currency    char(3) not null default 'USD',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  email       text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.team_members (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  -- References profiles (not auth.users) so PostgREST can embed the profile.
  user_id       uuid references public.profiles (id) on delete cascade,
  invite_email  text,
  role          public.member_role not null default 'member',
  status        public.member_status not null default 'invited',
  title         text,
  department    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint team_members_identity check (user_id is not null or invite_email is not null),
  unique (org_id, user_id),
  unique (org_id, invite_email)
);
create index team_members_user_idx on public.team_members (user_id);

-- Membership checks used by every RLS policy. SECURITY DEFINER so policies on
-- team_members itself don't recurse.
create or replace function public.is_org_member(target_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.team_members
    where org_id = target_org and user_id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.has_org_role(target_org uuid, roles public.member_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.team_members
    where org_id = target_org and user_id = auth.uid() and status = 'active' and role = any (roles)
  );
$$;

-- Create a profile row whenever someone signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'avatar_url')
  on conflict (id) do nothing;

  -- Accept any pending invitations addressed to this email.
  update public.team_members
     set user_id = new.id, status = 'active'
   where invite_email = new.email and user_id is null;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Create an organization and make the caller its owner in one step.
create or replace function public.create_organization(org_name text, org_slug text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  new_org uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into public.organizations (name, slug) values (org_name, org_slug) returning id into new_org;
  insert into public.team_members (org_id, user_id, role, status) values (new_org, auth.uid(), 'owner', 'active');
  return new_org;
end;
$$;

-- -----------------------------------------------------------------------------
-- Clients & leads
-- -----------------------------------------------------------------------------
create table public.clients (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations (id) on delete cascade,
  name              text not null,
  company           text,
  industry          text,
  email             text,
  phone             text,
  whatsapp_number   text,
  instagram_handle  text,
  website           text,
  status            public.client_status not null default 'onboarding',
  monthly_retainer  numeric(12, 2) not null default 0,
  services          text[] not null default '{}',
  tags              text[] not null default '{}',
  owner_id          uuid references auth.users (id) on delete set null,
  started_at        date,
  health_score      smallint check (health_score between 0 and 100),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index clients_org_idx on public.clients (org_id, status);

create table public.leads (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizations (id) on delete cascade,
  name               text not null,
  company            text,
  email              text,
  phone              text,
  whatsapp_number    text,
  instagram_handle   text,
  source             public.lead_source not null default 'other',
  stage              public.lead_stage not null default 'new',
  estimated_value    numeric(12, 2) not null default 0,
  service_interest   text[] not null default '{}',
  -- AI-assisted fields. Written by the scoring job, never by the browser directly.
  ai_score           smallint check (ai_score between 0 and 100),
  ai_summary         text,
  ai_next_action     text,
  owner_id           uuid references auth.users (id) on delete set null,
  converted_client_id uuid references public.clients (id) on delete set null,
  last_contacted_at  timestamptz,
  next_follow_up_at  timestamptz,
  lost_reason        text,
  tags               text[] not null default '{}',
  -- Explicit opt-in for automated messaging. Workflows skip leads without it.
  marketing_consent  boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index leads_org_stage_idx on public.leads (org_id, stage);
create index leads_follow_up_idx on public.leads (org_id, next_follow_up_at) where stage not in ('won', 'lost');

-- -----------------------------------------------------------------------------
-- Activity, tasks & messaging
-- -----------------------------------------------------------------------------
create table public.activities (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  lead_id     uuid references public.leads (id) on delete cascade,
  client_id   uuid references public.clients (id) on delete cascade,
  actor_id    uuid references auth.users (id) on delete set null,
  type        public.activity_type not null,
  body        text,
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index activities_lead_idx on public.activities (lead_id, created_at desc);
create index activities_client_idx on public.activities (client_id, created_at desc);
create index activities_org_idx on public.activities (org_id, created_at desc);

create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  title        text not null,
  description  text,
  status       public.task_status not null default 'open',
  priority     public.task_priority not null default 'medium',
  due_at       timestamptz,
  assignee_id  uuid references auth.users (id) on delete set null,
  lead_id      uuid references public.leads (id) on delete cascade,
  client_id    uuid references public.clients (id) on delete cascade,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index tasks_assignee_idx on public.tasks (org_id, assignee_id, status, due_at);

create table public.message_templates (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  channel     public.channel not null,
  name        text not null,
  body        text not null,
  -- e.g. {"first_name", "company"} — rendered as {{first_name}} in the body.
  variables   text[] not null default '{}',
  -- Provider-side template name (WhatsApp requires pre-approved templates).
  external_template_name text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (org_id, channel, name)
);

-- -----------------------------------------------------------------------------
-- Automated follow-up workflows
-- -----------------------------------------------------------------------------
create table public.workflows (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations (id) on delete cascade,
  name            text not null,
  description     text,
  trigger         public.workflow_trigger not null,
  -- e.g. {"stage": "proposal"} or {"no_reply_hours": 48}
  trigger_config  jsonb not null default '{}',
  is_active       boolean not null default false,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.workflow_steps (
  id           uuid primary key default gen_random_uuid(),
  workflow_id  uuid not null references public.workflows (id) on delete cascade,
  position     smallint not null,
  action       public.workflow_action not null,
  -- e.g. {"hours": 24} for wait, {"template_id": "..."} for sends
  config       jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  unique (workflow_id, position)
);

create table public.workflow_runs (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  workflow_id   uuid not null references public.workflows (id) on delete cascade,
  lead_id       uuid references public.leads (id) on delete cascade,
  status        public.run_status not null default 'pending',
  current_step  smallint not null default 0,
  next_run_at   timestamptz,
  dry_run       boolean not null default true,
  log           jsonb not null default '[]',
  started_at    timestamptz not null default now(),
  finished_at   timestamptz
);
create index workflow_runs_due_idx on public.workflow_runs (status, next_run_at);

create table public.messages (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations (id) on delete cascade,
  channel          public.channel not null,
  direction        public.message_direction not null,
  status           public.message_status not null default 'draft',
  lead_id          uuid references public.leads (id) on delete set null,
  client_id        uuid references public.clients (id) on delete set null,
  workflow_run_id  uuid references public.workflow_runs (id) on delete set null,
  template_id      uuid references public.message_templates (id) on delete set null,
  to_address       text,
  body             text not null,
  external_id      text,
  error            text,
  sent_by          uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now()
);
create index messages_lead_idx on public.messages (lead_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Integrations (no secrets!)
-- -----------------------------------------------------------------------------
create table public.integrations (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  provider      public.integration_provider not null,
  status        public.integration_status not null default 'disconnected',
  -- Non-secret settings only: phone number id, business account id, ad account id…
  config        jsonb not null default '{}',
  -- Name of the Supabase Vault secret holding the access token. Never the token.
  secret_ref    text,
  connected_at  timestamptz,
  last_sync_at  timestamptz,
  last_error    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (org_id, provider)
);

-- -----------------------------------------------------------------------------
-- Meta Ads analytics (read-only mirror; the CRM never creates or launches ads)
-- -----------------------------------------------------------------------------
create table public.ad_campaigns (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  client_id     uuid references public.clients (id) on delete set null,
  external_id   text not null,
  name          text not null,
  objective     text,
  status        public.campaign_status not null default 'active',
  daily_budget  numeric(12, 2),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (org_id, external_id)
);

create table public.ad_insights_daily (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  campaign_id  uuid not null references public.ad_campaigns (id) on delete cascade,
  date         date not null,
  impressions  integer not null default 0,
  reach        integer not null default 0,
  clicks       integer not null default 0,
  spend        numeric(12, 2) not null default 0,
  leads        integer not null default 0,
  conversions  integer not null default 0,
  revenue      numeric(12, 2) not null default 0,
  unique (campaign_id, date)
);
create index ad_insights_org_date_idx on public.ad_insights_daily (org_id, date);

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'organizations', 'profiles', 'team_members', 'clients', 'leads', 'tasks',
    'message_templates', 'workflows', 'integrations', 'ad_campaigns'
  ] loop
    execute format(
      'create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t, t
    );
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.organizations     enable row level security;
alter table public.profiles          enable row level security;
alter table public.team_members      enable row level security;
alter table public.clients           enable row level security;
alter table public.leads             enable row level security;
alter table public.activities        enable row level security;
alter table public.tasks             enable row level security;
alter table public.message_templates enable row level security;
alter table public.workflows         enable row level security;
alter table public.workflow_steps    enable row level security;
alter table public.workflow_runs     enable row level security;
alter table public.messages          enable row level security;
alter table public.integrations      enable row level security;
alter table public.ad_campaigns      enable row level security;
alter table public.ad_insights_daily enable row level security;

-- Organizations: members read, owners/admins update.
create policy "members read org" on public.organizations
  for select using (public.is_org_member(id));
create policy "admins update org" on public.organizations
  for update using (public.has_org_role(id, array['owner', 'admin']::public.member_role[]));

-- Profiles: you, plus anyone who shares an organization with you.
create policy "read own and teammates' profiles" on public.profiles
  for select using (
    id = auth.uid() or exists (
      select 1 from public.team_members mine
      join public.team_members theirs on theirs.org_id = mine.org_id
      where mine.user_id = auth.uid() and mine.status = 'active' and theirs.user_id = profiles.id
    )
  );
create policy "update own profile" on public.profiles
  for update using (id = auth.uid());

-- Team: members read the roster; owners/admins manage it.
create policy "members read team" on public.team_members
  for select using (public.is_org_member(org_id));
create policy "admins manage team" on public.team_members
  for all using (public.has_org_role(org_id, array['owner', 'admin']::public.member_role[]))
  with check (public.has_org_role(org_id, array['owner', 'admin']::public.member_role[]));

-- Standard org-scoped CRUD for every member.
do $$
declare t text;
begin
  foreach t in array array[
    'clients', 'leads', 'activities', 'tasks', 'message_templates',
    'workflow_runs', 'messages', 'ad_campaigns', 'ad_insights_daily'
  ] loop
    execute format(
      'create policy "members manage %1$s" on public.%1$I for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id))',
      t
    );
  end loop;
end;
$$;

-- Workflows: everyone reads, managers and up edit.
create policy "members read workflows" on public.workflows
  for select using (public.is_org_member(org_id));
create policy "managers manage workflows" on public.workflows
  for all using (public.has_org_role(org_id, array['owner', 'admin', 'manager']::public.member_role[]))
  with check (public.has_org_role(org_id, array['owner', 'admin', 'manager']::public.member_role[]));

create policy "members read workflow steps" on public.workflow_steps
  for select using (exists (
    select 1 from public.workflows w where w.id = workflow_id and public.is_org_member(w.org_id)
  ));
create policy "managers manage workflow steps" on public.workflow_steps
  for all using (exists (
    select 1 from public.workflows w where w.id = workflow_id
      and public.has_org_role(w.org_id, array['owner', 'admin', 'manager']::public.member_role[])
  ))
  with check (exists (
    select 1 from public.workflows w where w.id = workflow_id
      and public.has_org_role(w.org_id, array['owner', 'admin', 'manager']::public.member_role[])
  ));

-- Integrations: members see status; only owners/admins connect or change them.
create policy "members read integrations" on public.integrations
  for select using (public.is_org_member(org_id));
create policy "admins manage integrations" on public.integrations
  for all using (public.has_org_role(org_id, array['owner', 'admin']::public.member_role[]))
  with check (public.has_org_role(org_id, array['owner', 'admin']::public.member_role[]));
