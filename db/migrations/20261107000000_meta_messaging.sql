-- =============================================================================
-- Live WhatsApp Cloud API + Instagram Messaging
--
-- * Leads remember the Instagram-scoped user id (IGSID). Instagram only lets a
--   business message people who have messaged it first, and addresses them by
--   this id, not by @handle.
-- * ingest_inbound_message() and update_message_status() are called only by
--   the signed Meta webhook (/api/webhooks/meta) with the service-role key.
--   They are not executable by anon or signed-in users.
-- =============================================================================

alter table public.leads add column instagram_user_id text;
create index leads_instagram_user_idx on public.leads (org_id, instagram_user_id) where instagram_user_id is not null;

create index messages_external_idx on public.messages (external_id) where external_id is not null;
create index messages_lead_channel_idx on public.messages (lead_id, channel, direction, created_at desc);

-- Inbound WhatsApp message or Instagram DM → message row, activity, and a
-- "reply" task. Finds the lead by WhatsApp number or IGSID, creating one when
-- the sender is new. Repeat deliveries of the same message are ignored.
create or replace function public.ingest_inbound_message(
  p_org_slug text,
  p_channel public.channel,
  p_from text,
  p_name text default null,
  p_handle text default null,
  p_body text default null,
  p_external_id text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  target_org uuid;
  owner_id uuid;
  target_lead uuid;
  from_digits text := regexp_replace(coalesce(p_from, ''), '\D', '', 'g');
  clean_body text := left(coalesce(nullif(trim(p_body), ''), '[message]'), 4000);
  clean_handle text := nullif(ltrim(trim(coalesce(p_handle, '')), '@'), '');
begin
  if p_channel not in ('whatsapp', 'instagram') then
    raise exception 'unsupported channel';
  end if;
  if coalesce(trim(p_from), '') = '' then
    raise exception 'missing sender';
  end if;

  select id into target_org from public.organizations where slug = p_org_slug;
  if target_org is null then
    raise exception 'unknown workspace';
  end if;

  if p_external_id is not null and exists (select 1 from public.messages where external_id = p_external_id and org_id = target_org) then
    return null;
  end if;

  if p_channel = 'whatsapp' then
    select id into target_lead from public.leads
    where org_id = target_org and whatsapp_number is not null
      and (
        regexp_replace(whatsapp_number, '\D', '', 'g') = from_digits
        or (length(from_digits) >= 10 and length(regexp_replace(whatsapp_number, '\D', '', 'g')) >= 10
            and right(regexp_replace(whatsapp_number, '\D', '', 'g'), 10) = right(from_digits, 10))
      )
    order by created_at desc limit 1;
  else
    select id into target_lead from public.leads
    where org_id = target_org and instagram_user_id = p_from
    order by created_at desc limit 1;
    if target_lead is null and clean_handle is not null then
      select id into target_lead from public.leads
      where org_id = target_org and lower(ltrim(instagram_handle, '@')) = lower(clean_handle)
      order by created_at desc limit 1;
      if target_lead is not null then
        update public.leads set instagram_user_id = p_from where id = target_lead;
      end if;
    end if;
  end if;

  select user_id into owner_id from public.team_members
  where org_id = target_org and role = 'owner' and status = 'active'
  order by created_at limit 1;

  if target_lead is null then
    insert into public.leads (org_id, name, whatsapp_number, instagram_handle, instagram_user_id, source, stage, owner_id, next_follow_up_at, ai_score)
    values (
      target_org,
      left(coalesce(nullif(trim(p_name), ''), case when p_channel = 'instagram' and clean_handle is not null then '@' || clean_handle else '+' || from_digits end), 120),
      case when p_channel = 'whatsapp' then '+' || from_digits end,
      case when p_channel = 'instagram' then clean_handle end,
      case when p_channel = 'instagram' then p_from end,
      p_channel::text::public.lead_source,
      'new', owner_id, now() + interval '1 hour', 55
    )
    returning id into target_lead;

    insert into public.activities (org_id, lead_id, type, body)
    values (target_org, target_lead, 'system', 'New lead from ' || case when p_channel = 'whatsapp' then 'WhatsApp' else 'Instagram DM' end);
  end if;

  insert into public.messages (org_id, channel, direction, status, lead_id, to_address, body, external_id)
  values (target_org, p_channel, 'inbound', 'delivered', target_lead, p_from, clean_body, p_external_id);

  insert into public.activities (org_id, lead_id, type, body, metadata)
  values (target_org, target_lead, p_channel::text::public.activity_type, 'Received: ' || left(clean_body, 500), jsonb_build_object('direction', 'inbound'));

  if not exists (
    select 1 from public.tasks
    where lead_id = target_lead and status = 'open' and dedupe_key like 'inbound-reply:%'
  ) then
    insert into public.tasks (org_id, title, description, priority, due_at, assignee_id, lead_id, dedupe_key)
    values (
      target_org,
      'Reply on ' || case when p_channel = 'whatsapp' then 'WhatsApp' else 'Instagram' end,
      'They messaged you. Free-form replies are only allowed within 24 hours of their last message.',
      'high', now() + interval '1 hour', owner_id, target_lead,
      'inbound-reply:' || coalesce(p_external_id, gen_random_uuid()::text)
    );
  end if;

  return target_lead;
end;
$$;

-- Delivery receipts from WhatsApp. Statuses only move forward
-- (sent → delivered → read); "failed" always wins.
create or replace function public.update_message_status(
  p_external_id text,
  p_status public.message_status,
  p_error text default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.messages
  set status = p_status,
      error = coalesce(left(p_error, 500), error)
  where external_id = p_external_id
    and direction = 'outbound'
    and (
      p_status = 'failed'
      or array_position(array['queued', 'sent', 'delivered', 'read']::public.message_status[], p_status)
         > coalesce(array_position(array['queued', 'sent', 'delivered', 'read']::public.message_status[], status), 0)
    );
end;
$$;

revoke execute on function public.ingest_inbound_message(text, public.channel, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.update_message_status(text, public.message_status, text) from public, anon, authenticated;
grant execute on function public.ingest_inbound_message(text, public.channel, text, text, text, text, text) to service_role;
grant execute on function public.update_message_status(text, public.message_status, text) to service_role;
