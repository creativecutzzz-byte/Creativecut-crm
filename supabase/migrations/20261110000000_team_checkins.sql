-- =============================================================================
-- Daily team check-ins: what each member is doing today, what got done, and
-- where they're stuck. One row per person per day (IST).
-- =============================================================================

create table public.checkins (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  day         date not null,
  doing       text,
  done        text,
  stuck       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (org_id, user_id, day)
);
create index checkins_org_day_idx on public.checkins (org_id, day desc);

create trigger checkins_set_updated_at before update on public.checkins
  for each row execute function public.set_updated_at();

alter table public.checkins enable row level security;

create policy "members read checkins" on public.checkins
  for select using (public.is_org_member(org_id));
create policy "members write own checkin" on public.checkins
  for insert with check (public.is_org_member(org_id) and user_id = auth.uid());
create policy "members update own checkin" on public.checkins
  for update using (user_id = auth.uid()) with check (public.is_org_member(org_id) and user_id = auth.uid());
