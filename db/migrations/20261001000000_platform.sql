-- =============================================================================
-- Platform: accounts, sessions and database roles
--
-- The CRM runs on plain Postgres (e.g. a Neon database from Vercel). This
-- migration provides what the rest of the schema expects:
--
-- * auth.users     — accounts (email + bcrypt password hash + profile metadata)
-- * auth.sessions  — sign-in sessions (only a SHA-256 hash of each token)
-- * auth.uid()     — the signed-in user for the current transaction, read from
--                    the `app.user_id` setting the app sets per request
-- * roles          — `authenticated` and `anon` run app queries under Row Level
--                    Security; `service_role` is used for grants only. The
--                    app's own database user owns the tables and can switch
--                    into these roles.
-- =============================================================================

create schema if not exists auth;

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role'] loop
    if not exists (select 1 from pg_roles where rolname = r) then
      execute format('create role %I nologin', r);
    end if;
    -- The app's database user must be able to `set role` into these.
    execute format('grant %I to %I', r, current_user);
  end loop;
end;
$$;

create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text not null,
  encrypted_password  text not null,
  raw_user_meta_data  jsonb not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  last_sign_in_at     timestamptz
);
create unique index if not exists users_email_key on auth.users (lower(email));

create table if not exists auth.sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  token_hash  text not null unique,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
create index if not exists sessions_user_idx on auth.sessions (user_id);

create or replace function auth.uid()
returns uuid language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')::uuid
$$;

-- Accounts and sessions are only ever read by the server as the owner.
revoke all on auth.users, auth.sessions from public;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Tables in public are reachable by the app roles; Row Level Security on each
-- table decides which rows.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated, service_role;
