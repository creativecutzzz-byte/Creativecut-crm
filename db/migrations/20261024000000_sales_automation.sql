-- =============================================================================
-- Sales automation
--
-- * Leads carry a website and a personalisation line for outreach.
-- * Workspaces store the booking and portfolio links used in messages.
-- * Tasks can belong to an outreach sequence, and automation-created tasks
--   carry a dedupe key so they are never created twice.
-- * capture_lead() lets the public landing page create a lead without
--   exposing any table to anonymous users.
-- =============================================================================

alter table public.leads add column website text;
alter table public.leads add column personalization text;

alter table public.organizations add column booking_url text;
alter table public.organizations add column portfolio_url text;

alter table public.tasks add column sequence text;
alter table public.tasks add column dedupe_key text;
alter table public.tasks add constraint tasks_org_dedupe_key unique (org_id, dedupe_key);
create index tasks_lead_sequence_idx on public.tasks (lead_id, sequence) where sequence is not null;

-- Public website enquiry → lead + activity + "reply within 1 hour" task for
-- the workspace owner. SECURITY DEFINER so anonymous callers never get table
-- access; inputs are validated and size-limited, and repeat submissions from
-- the same email within 10 minutes are ignored.
create or replace function public.capture_lead(
  p_org_slug text,
  p_name text,
  p_email text,
  p_company text default null,
  p_website text default null,
  p_message text default null
)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  target_org uuid;
  owner_id uuid;
  new_lead uuid;
  clean_email text := lower(trim(p_email));
  clean_name text := trim(p_name);
begin
  if clean_name is null or length(clean_name) < 2 or length(clean_name) > 120 then
    raise exception 'invalid name';
  end if;
  if clean_email is null or length(clean_email) > 254 or clean_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid email';
  end if;
  if length(coalesce(p_company, '')) > 160 or length(coalesce(p_website, '')) > 300 or length(coalesce(p_message, '')) > 2000 then
    raise exception 'input too long';
  end if;

  select id into target_org from public.organizations where slug = p_org_slug;
  if target_org is null then
    raise exception 'unknown workspace';
  end if;

  if exists (
    select 1 from public.leads
    where org_id = target_org and lower(email) = clean_email and created_at > now() - interval '10 minutes'
  ) then
    return true;
  end if;

  select user_id into owner_id from public.team_members
  where org_id = target_org and role = 'owner' and status = 'active'
  order by created_at limit 1;

  insert into public.leads (org_id, name, company, email, website, source, stage, owner_id, next_follow_up_at, ai_score)
  values (target_org, clean_name, nullif(trim(p_company), ''), clean_email, nullif(trim(p_website), ''), 'website', 'new', owner_id, now() + interval '1 hour', 60)
  returning id into new_lead;

  insert into public.activities (org_id, lead_id, type, body)
  values (target_org, new_lead, 'system', 'Website enquiry' || coalesce(': ' || nullif(trim(p_message), ''), ''));

  insert into public.tasks (org_id, title, description, priority, due_at, assignee_id, lead_id, sequence)
  values (target_org, 'Reply to website enquiry within 1 hour',
          'Start the "Inbound enquiry" sequence from the lead page.', 'high', now() + interval '1 hour', owner_id, new_lead, null);

  return true;
end;
$$;

revoke execute on function public.capture_lead(text, text, text, text, text, text) from public;
grant execute on function public.capture_lead(text, text, text, text, text, text) to anon, authenticated;
