-- =============================================================================
-- Outreach Engine schema (docs/guide.md, Step 4).
--
-- Lives in its own Postgres schema, `outreach`, next to the CRM's public tables,
-- so the engine's leads never mix with CRM leads. It is reached only from the
-- server through DATABASE_URL (pg); the schema is not exposed to the Supabase
-- REST API, and RLS is enabled with no policies as a second lock.
--
-- Idempotent: `npm run migrate` can run it any number of times.
-- =============================================================================

create schema if not exists outreach;

create table if not exists outreach.domains (
  id            serial primary key,
  name          text unique not null,
  status        text not null default 'warming' check (status in ('warming', 'active', 'paused')),
  daily_cap     int not null default 120,
  paused_reason text,
  created_at    timestamptz not null default now()
);

create table if not exists outreach.mailboxes (
  id              serial primary key,
  domain_id       int not null references outreach.domains(id),
  email           text unique not null,
  sender_name     text,
  status          text not null default 'warming' check (status in ('warming', 'active', 'paused')),
  daily_cap       int not null default 10,           -- raised by the warm-up ramp
  ramp_started_on date not null default current_date,
  next_send_at    timestamptz not null default now(),
  paused_reason   text,
  paused_until    timestamptz,                       -- quota pauses (24h); null = until a person resumes
  history_id      text,                              -- Gmail history cursor for the reply poller
  created_at      timestamptz not null default now()
);

create table if not exists outreach.leads (
  id          bigserial primary key,
  email       text unique not null,
  first_name  text, last_name text, title text,
  company     text, website text, country text, timezone text,
  employees   int,
  source      text, segment text,
  status      text not null default 'uploaded' check (status in (
                'uploaded', 'verified', 'qualified', 'disqualified', 'review', 'researched', 'ready',
                'in_sequence', 'replied', 'bounced', 'unsubscribed', 'completed', 'meeting', 'skipped')),
  icp_score   int, icp_reason text,
  verify_result text,
  attempts    int not null default 0,              -- AI retries for the current stage
  revisit_at  date,                                -- not_now replies
  referred_by bigint references outreach.leads(id),
  locked_until timestamptz,                        -- claim lease while a cron run works on the lead
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists leads_status_idx on outreach.leads (status, id);

create table if not exists outreach.pages (
  url        text primary key,
  text       text,
  status     int,
  links      text[],                              -- useful same-site links found on the page
  fetched_at timestamptz default now()
);

alter table outreach.pages add column if not exists links text[];

create table if not exists outreach.research (
  lead_id        bigint primary key references outreach.leads(id) on delete cascade,
  evidence_quote text, evidence_url text,
  facts          jsonb,
  gate_passed    boolean,
  gate_failures  text[],
  is_generic     boolean not null default false,
  model          text, duration_ms int,
  created_at     timestamptz default now()
);

create table if not exists outreach.steps (
  id               bigserial primary key,
  lead_id          bigint not null references outreach.leads(id) on delete cascade,
  step_no          int not null,                   -- 1 = first email, 2 and 3 = follow-ups
  subject          text, body text,
  due_at           timestamptz,                    -- earliest send time
  status           text not null default 'ready' check (status in ('ready', 'sending', 'sent', 'skipped', 'failed')),
  mailbox_id       int references outreach.mailboxes(id),
  gmail_message_id text, gmail_thread_id text, rfc_message_id text,
  dry_run          boolean not null default false,
  error            text,
  sent_at          timestamptz,
  unique (lead_id, step_no)
);
create index if not exists steps_due_idx on outreach.steps (status, due_at);
create index if not exists steps_sent_idx on outreach.steps (mailbox_id, sent_at) where status = 'sent';
create index if not exists steps_thread_idx on outreach.steps (gmail_thread_id) where gmail_thread_id is not null;

create table if not exists outreach.replies (
  id               bigserial primary key,
  lead_id          bigint references outreach.leads(id) on delete cascade,
  mailbox_id       int references outreach.mailboxes(id),
  gmail_message_id text unique,
  gmail_thread_id  text,
  received_at      timestamptz,
  from_address     text,
  subject          text,
  body             text,
  is_auto          boolean default false,
  is_bounce        boolean default false,
  intent           text check (intent in ('interested', 'not_now', 'not_interested', 'wrong_person', 'referral', 'unsubscribe', 'question')),
  summary          text,
  created_at       timestamptz default now()
);
create index if not exists replies_lead_idx on outreach.replies (lead_id);

create table if not exists outreach.suppression (
  email      text primary key,
  reason     text check (reason in ('unsubscribed', 'bounced', 'complaint', 'manual')),
  created_at timestamptz default now()
);

create table if not exists outreach.events (
  id         bigserial primary key,
  type       text not null,
  payload    jsonb,
  created_at timestamptz default now()
);
create index if not exists events_type_idx on outreach.events (type, created_at desc);
create index if not exists events_created_idx on outreach.events (created_at desc);

-- Postmaster Tools numbers, entered by hand daily or pulled from its API.
create table if not exists outreach.postmaster (
  domain_id  int not null references outreach.domains(id) on delete cascade,
  day        date not null,
  spam_rate  numeric,                               -- 0.001 = 0.1%
  reputation text check (reputation in ('HIGH', 'MEDIUM', 'LOW', 'BAD')),
  primary key (domain_id, day)
);

create table if not exists outreach.meetings (
  lead_id    bigint primary key references outreach.leads(id) on delete cascade,
  booked_at  timestamptz not null default now(),
  source     text not null default 'manual'
);

-- Second lock: RLS on, no policies -> the Supabase anon/authenticated roles see nothing.
do $$
declare t text;
begin
  foreach t in array array['domains','mailboxes','leads','pages','research','steps','replies','suppression','events','postmaster','meetings'] loop
    execute format('alter table outreach.%I enable row level security', t);
  end loop;
end $$;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on schema outreach from anon, authenticated';
  end if;
end $$;
