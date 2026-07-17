begin;

create table public.student_login_codes (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  organization_id uuid not null,
  code_digest text not null unique,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  disabled_at timestamptz,
  foreign key (organization_id, user_id)
    references public.memberships (organization_id, user_id) on delete cascade,
  constraint student_login_codes_digest_format
    check (code_digest ~ '^[0-9a-f]{64}$')
);

create index student_login_codes_active_lookup_idx
  on public.student_login_codes (code_digest)
  where disabled_at is null;

alter table public.student_login_codes enable row level security;

-- No authenticated policy is intentional. Student codes are resolved only by
-- the server after hashing with a server-side pepper.
revoke all on public.student_login_codes from anon, authenticated;
grant all on public.student_login_codes to service_role;

commit;
