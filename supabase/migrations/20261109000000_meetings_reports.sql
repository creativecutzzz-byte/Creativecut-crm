-- =============================================================================
-- Phase 3: meetings, call lists, daily brief, A/B subjects
--
-- * New pipeline stage "meeting" (Meeting booked) between qualified and proposal.
-- * meetings: calls booked through the CRM booking page or found on the
--   Google Calendar, with their outcome.
-- * outreach_drafts.variant: which subject line (A/B) an email used.
-- =============================================================================

alter type public.lead_stage add value if not exists 'meeting' before 'proposal';

create table public.meetings (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizations (id) on delete cascade,
  lead_id            uuid references public.leads (id) on delete cascade,
  calendar_event_id  text,
  title              text not null,
  starts_at          timestamptz not null,
  ends_at            timestamptz not null,
  meet_url           text,
  attendee_email     text,
  source             text not null default 'calendar' check (source in ('booking_page', 'calendar')),
  status             text not null default 'scheduled' check (status in ('scheduled', 'held', 'no_show', 'cancelled')),
  outcome_note       text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (org_id, calendar_event_id)
);
create index meetings_org_time_idx on public.meetings (org_id, starts_at);
create index meetings_lead_idx on public.meetings (lead_id, starts_at desc);

create trigger meetings_set_updated_at before update on public.meetings
  for each row execute function public.set_updated_at();

alter table public.meetings enable row level security;
create policy "members manage meetings" on public.meetings
  for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

alter table public.outreach_drafts add column if not exists variant text check (variant in ('A', 'B'));
