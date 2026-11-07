-- =============================================================================
-- Phase 2: outreach autopilot with human approval
--
-- * outreach_drafts: every AI-written message (sequence step or reply) waits
--   here for Approve / Edit / Reject before anything is sent.
-- * Leads carry their autopilot state and the step plan they were started on.
-- * messages keep Gmail thread ids so replies can be matched to a lead, and
--   the reply handler's verdict.
-- * suppressions: emails / numbers that unsubscribed are never contacted or
--   re-imported again.
-- =============================================================================

alter table public.leads add column if not exists outreach_status text
  check (outreach_status in ('active', 'replied', 'paused', 'completed', 'stopped', 'unsubscribed'));
alter table public.leads add column if not exists outreach_sequence text;
alter table public.leads add column if not exists outreach_step integer;
alter table public.leads add column if not exists outreach_started_at timestamptz;
alter table public.leads add column if not exists outreach_plan jsonb;
alter table public.leads add column if not exists email_status text check (email_status in ('ok', 'bounced'));
create index if not exists leads_outreach_idx on public.leads (org_id, outreach_status) where outreach_status is not null;

alter table public.messages add column if not exists subject text;
alter table public.messages add column if not exists thread_id text;
alter table public.messages add column if not exists rfc_message_id text;
alter table public.messages add column if not exists classified_at timestamptz;
alter table public.messages add column if not exists classification jsonb;
create index if not exists messages_thread_idx on public.messages (org_id, thread_id) where thread_id is not null;
create index if not exists messages_unclassified_idx on public.messages (org_id, created_at) where direction = 'inbound' and classified_at is null;

create table public.outreach_drafts (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations (id) on delete cascade,
  lead_id          uuid not null references public.leads (id) on delete cascade,
  kind             text not null default 'sequence' check (kind in ('sequence', 'reply')),
  sequence         text,
  step             integer,
  step_label       text,
  channel          text not null check (channel in ('email', 'whatsapp', 'instagram', 'linkedin')),
  to_address       text,
  subject          text,
  body             text not null,
  -- WhatsApp: approved template name and its {{1}}, {{2}}… values.
  template_name    text,
  template_params  text[] not null default '{}',
  -- Why the AI wrote this, what it used, what to check.
  notes            text,
  in_reply_to_message uuid references public.messages (id) on delete set null,
  status           text not null default 'pending'
                     check (status in ('pending', 'approved', 'sent', 'failed', 'rejected', 'cancelled')),
  scheduled_for    timestamptz,
  approved_by      uuid references auth.users (id) on delete set null,
  approved_at      timestamptz,
  sent_at          timestamptz,
  message_id       uuid references public.messages (id) on delete set null,
  error            text,
  dedupe_key       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (org_id, dedupe_key)
);
create index outreach_drafts_queue_idx on public.outreach_drafts (org_id, status, scheduled_for);
create index outreach_drafts_lead_idx on public.outreach_drafts (lead_id, created_at desc);

create trigger outreach_drafts_set_updated_at before update on public.outreach_drafts
  for each row execute function public.set_updated_at();

create table public.suppressions (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  -- Lower-cased email, or phone digits.
  value       text not null,
  reason      text not null default 'unsubscribed',
  created_at  timestamptz not null default now(),
  unique (org_id, value)
);

alter table public.outreach_drafts enable row level security;
alter table public.suppressions enable row level security;

create policy "members manage outreach drafts" on public.outreach_drafts
  for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy "members manage suppressions" on public.suppressions
  for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
