-- =============================================================================
-- AI agents (Phase 1: lead generation)
--
-- * agents: per-workspace on/off switch and settings for each agent.
-- * agent_runs: one row per run (cron or "Run now") for the audit trail.
-- * Leads remember where an agent found them (external_ref) so the same
--   person/company is never imported twice, plus what enrichment learned.
-- =============================================================================

alter type public.lead_source add value if not exists 'apollo';
alter type public.lead_source add value if not exists 'google_maps';
alter type public.lead_source add value if not exists 'funding_news';

alter table public.leads add column if not exists external_ref text;
alter table public.leads add column if not exists linkedin_url text;
alter table public.leads add column if not exists enrichment jsonb;
alter table public.leads add column if not exists enriched_at timestamptz;
create unique index if not exists leads_org_external_ref_idx on public.leads (org_id, external_ref) where external_ref is not null;
create index if not exists leads_enrichment_queue_idx on public.leads (org_id, created_at) where enriched_at is null and website is not null;

create table public.agents (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  key           text not null,
  enabled       boolean not null default false,
  config        jsonb not null default '{}',
  last_run_at   timestamptz,
  last_status   text,
  last_summary  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (org_id, key)
);

create table public.agent_runs (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations (id) on delete cascade,
  agent_key      text not null,
  trigger        text not null check (trigger in ('cron', 'manual')),
  status         text not null default 'running' check (status in ('running', 'success', 'skipped', 'error')),
  summary        text,
  items_created  integer not null default 0,
  items_updated  integer not null default 0,
  error          text,
  started_by     uuid references auth.users (id) on delete set null,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz
);
create index agent_runs_org_idx on public.agent_runs (org_id, started_at desc);

create trigger agents_set_updated_at before update on public.agents
  for each row execute function public.set_updated_at();

alter table public.agents enable row level security;
alter table public.agent_runs enable row level security;

create policy "members read agents" on public.agents
  for select using (public.is_org_member(org_id));
create policy "admins manage agents" on public.agents
  for all using (public.has_org_role(org_id, array['owner', 'admin']::public.member_role[]))
  with check (public.has_org_role(org_id, array['owner', 'admin']::public.member_role[]));

create policy "members read agent runs" on public.agent_runs
  for select using (public.is_org_member(org_id));
create policy "admins manage agent runs" on public.agent_runs
  for all using (public.has_org_role(org_id, array['owner', 'admin']::public.member_role[]))
  with check (public.has_org_role(org_id, array['owner', 'admin']::public.member_role[]));
