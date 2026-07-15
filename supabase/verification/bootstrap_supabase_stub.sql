\set ON_ERROR_STOP on

-- Minimal Supabase-compatible roles and auth schema for migration CI.
-- This is test scaffolding only and is never pushed to a Supabase project.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

create function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
    nullif(current_setting('request.jwt.claim.sub', true), '')
  )::uuid;
$$;

create function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    jsonb_strip_nulls(
      jsonb_build_object(
        'sub', nullif(current_setting('request.jwt.claim.sub', true), ''),
        'aal', nullif(current_setting('request.jwt.claim.aal', true), ''),
        'role', nullif(current_setting('request.jwt.claim.role', true), '')
      )
    )
  );
$$;
