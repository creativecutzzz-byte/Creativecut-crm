-- =============================================================================
-- Workspace onboarding
--
-- * Invitations are matched case-insensitively and can be accepted by people
--   who already had an account (not only brand-new sign-ups).
-- * Creating a workspace from the app seeds starter templates and workflows.
-- * The owner's membership can only be changed by an owner.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'avatar_url')
  on conflict (id) do nothing;

  update public.team_members
     set user_id = new.id, status = 'active'
   where lower(invite_email) = lower(new.email) and user_id is null;

  return new;
end;
$$;

-- Lets a signed-in user pick up invitations sent to their email after they signed up.
create or replace function public.accept_invitations()
returns integer language plpgsql security definer set search_path = public as $$
declare
  accepted integer;
  user_email text;
begin
  if auth.uid() is null then
    return 0;
  end if;

  select email into user_email from auth.users where id = auth.uid();

  insert into public.profiles (id, email)
  values (auth.uid(), user_email)
  on conflict (id) do nothing;

  update public.team_members
     set user_id = auth.uid(), status = 'active'
   where lower(invite_email) = lower(user_email)
     and user_id is null
     and not exists (
       select 1 from public.team_members existing
       where existing.org_id = team_members.org_id and existing.user_id = auth.uid()
     );
  get diagnostics accepted = row_count;
  return accepted;
end;
$$;

-- Starter templates and (inactive) workflows so a new workspace isn't empty.
create or replace function public.seed_workspace(target_org uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  wf uuid;
begin
  insert into public.message_templates (org_id, channel, name, body, variables, external_template_name) values
    (target_org, 'whatsapp', 'First touch',
     'Hi {{first_name}}! It''s {{owner_name}} from Creative Cut 👋 Thanks for reaching out about {{service}}. Do you have 15 minutes this week for a quick call?',
     '{first_name,owner_name,service}', 'first_touch_v1'),
    (target_org, 'whatsapp', 'Proposal nudge',
     'Hi {{first_name}}, just checking you received the proposal for {{company}}. Happy to walk through it whenever suits you.',
     '{first_name,company}', 'proposal_nudge_v1'),
    (target_org, 'instagram', 'DM reply — packages',
     'Hey {{first_name}}! Thanks for the message 🙌 Want me to send over our content packages and book a quick call?',
     '{first_name}', null)
  on conflict (org_id, channel, name) do nothing;

  insert into public.workflows (org_id, name, description, trigger, trigger_config, is_active)
  values (target_org, 'Speed-to-lead', 'Greets every new inbound lead and creates a call task.', 'lead_created', '{"sources": ["website", "meta_ads"]}', false)
  returning id into wf;
  insert into public.workflow_steps (workflow_id, position, action, config) values
    (wf, 1, 'send_whatsapp', '{"template": "First touch"}'),
    (wf, 2, 'create_task', '{"title": "Call new lead", "due_in_hours": 2}'),
    (wf, 3, 'wait', '{"hours": 24}'),
    (wf, 4, 'notify_team', '{"channel": "sales", "if": "no_reply"}');

  insert into public.workflows (org_id, name, description, trigger, trigger_config, is_active)
  values (target_org, 'Proposal follow-up', 'Nudges leads who haven''t replied 48h after a proposal.', 'stage_changed', '{"stage": "proposal"}', false)
  returning id into wf;
  insert into public.workflow_steps (workflow_id, position, action, config) values
    (wf, 1, 'wait', '{"hours": 48}'),
    (wf, 2, 'send_whatsapp', '{"template": "Proposal nudge"}'),
    (wf, 3, 'wait', '{"hours": 72}'),
    (wf, 4, 'create_task', '{"title": "Personal call — proposal pending", "due_in_hours": 4}');
end;
$$;
revoke execute on function public.seed_workspace(uuid) from public, anon, authenticated;

create or replace function public.create_organization(org_name text, org_slug text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  new_org uuid;
  user_email text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select email into user_email from auth.users where id = auth.uid();
  insert into public.profiles (id, email) values (auth.uid(), user_email) on conflict (id) do nothing;

  insert into public.organizations (name, slug) values (org_name, org_slug) returning id into new_org;
  insert into public.team_members (org_id, user_id, role, status) values (new_org, auth.uid(), 'owner', 'active');
  perform public.seed_workspace(new_org);
  return new_org;
end;
$$;

-- Only an owner may change or remove an owner's membership, and nobody but an
-- owner can grant the owner role.
create or replace function public.protect_owner_membership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;
  if tg_op in ('UPDATE', 'DELETE') and old.role = 'owner'
     and not public.has_org_role(old.org_id, array['owner']::public.member_role[]) then
    raise exception 'only an owner can change an owner';
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.role = 'owner'
     and (tg_op = 'INSERT' or old.role <> 'owner')
     and not public.has_org_role(new.org_id, array['owner']::public.member_role[])
     -- The very first member of a new workspace (create_organization) becomes its owner.
     and exists (select 1 from public.team_members where org_id = new.org_id) then
    raise exception 'only an owner can grant the owner role';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger team_members_protect_owner
  before insert or update or delete on public.team_members
  for each row execute function public.protect_owner_membership();
