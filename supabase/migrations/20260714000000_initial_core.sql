begin;

create type public.organization_role as enum ('owner', 'teacher', 'student');
create type public.class_role as enum ('teacher', 'student');
create type public.task_publication_status as enum (
  'draft',
  'published',
  'archived'
);
create type public.student_task_status as enum (
  'not_started',
  'in_progress',
  'completed'
);
create type public.help_request_status as enum (
  'waiting',
  'claimed',
  'resolved',
  'cancelled',
  'expired'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length
    check (char_length(display_name) between 1 and 80)
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_name_length check (char_length(name) between 1 and 120)
);

create table public.memberships (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.organization_role not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  academic_year text,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint classes_name_length check (char_length(name) between 1 and 80),
  constraint classes_academic_year_length
    check (academic_year is null or char_length(academic_year) between 4 and 20),
  unique (id, organization_id)
);

create unique index classes_organization_name_unique
  on public.classes (organization_id, lower(name))
  where archived_at is null;

create table public.class_memberships (
  class_id uuid not null,
  organization_id uuid not null,
  user_id uuid not null,
  role public.class_role not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (class_id, user_id),
  unique (class_id, organization_id, user_id),
  foreign key (class_id, organization_id)
    references public.classes (id, organization_id) on delete cascade,
  foreign key (organization_id, user_id)
    references public.memberships (organization_id, user_id) on delete cascade
);

create table public.task_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  class_id uuid not null,
  title text not null,
  description text,
  subject text,
  estimated_minutes smallint,
  support_level smallint not null default 2,
  position integer not null default 0,
  publication_status public.task_publication_status not null default 'draft',
  created_by uuid not null references auth.users (id) on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, class_id, organization_id),
  foreign key (class_id, organization_id)
    references public.classes (id, organization_id) on delete cascade,
  constraint task_definitions_title_length check (char_length(title) between 1 and 160),
  constraint task_definitions_description_length
    check (description is null or char_length(description) <= 4000),
  constraint task_definitions_subject_length
    check (subject is null or char_length(subject) <= 80),
  constraint task_definitions_estimated_minutes
    check (estimated_minutes is null or estimated_minutes between 1 and 480),
  constraint task_definitions_support_level check (support_level between 1 and 3),
  constraint task_definitions_position check (position >= 0),
  constraint task_definitions_published_at check (
    publication_status <> 'published' or published_at is not null
  )
);

create index task_definitions_class_status_position_idx
  on public.task_definitions (class_id, publication_status, position);

create table public.task_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  class_id uuid not null,
  task_definition_id uuid not null,
  student_id uuid not null,
  assigned_by uuid not null references auth.users (id) on delete restrict,
  visible_from timestamptz not null default now(),
  due_at timestamptz,
  created_at timestamptz not null default now(),
  unique (task_definition_id, student_id),
  unique (id, organization_id, student_id),
  foreign key (task_definition_id, class_id, organization_id)
    references public.task_definitions (id, class_id, organization_id)
    on delete cascade,
  foreign key (class_id, organization_id, student_id)
    references public.class_memberships (class_id, organization_id, user_id)
    on delete cascade,
  constraint task_assignments_due_after_visible
    check (due_at is null or due_at >= visible_from)
);

create index task_assignments_student_visible_idx
  on public.task_assignments (student_id, visible_from, due_at);
create index task_assignments_class_idx
  on public.task_assignments (class_id, student_id);

create table public.student_task_state (
  assignment_id uuid primary key,
  organization_id uuid not null,
  student_id uuid not null,
  status public.student_task_status not null default 'not_started',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (assignment_id, organization_id, student_id)
    references public.task_assignments (id, organization_id, student_id)
    on delete cascade,
  constraint student_task_state_started_at check (
    status = 'not_started' or started_at is not null
  ),
  constraint student_task_state_completed_at check (
    status <> 'completed' or completed_at is not null
  )
);

create index student_task_state_student_status_idx
  on public.student_task_state (student_id, status);

create table public.help_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  class_id uuid not null,
  student_id uuid not null,
  task_assignment_id uuid,
  status public.help_request_status not null default 'waiting',
  claimed_by uuid references auth.users (id) on delete set null,
  requested_at timestamptz not null default now(),
  claimed_at timestamptz,
  resolved_at timestamptz,
  expires_at timestamptz not null default (now() + interval '2 hours'),
  updated_at timestamptz not null default now(),
  foreign key (class_id, organization_id, student_id)
    references public.class_memberships (class_id, organization_id, user_id)
    on delete cascade,
  foreign key (task_assignment_id, organization_id, student_id)
    references public.task_assignments (id, organization_id, student_id)
    on delete set null (task_assignment_id),
  constraint help_requests_expiry check (expires_at > requested_at),
  constraint help_requests_claimed_fields check (
    (status = 'claimed' and claimed_by is not null and claimed_at is not null)
    or status <> 'claimed'
  ),
  constraint help_requests_resolved_fields check (
    (status = 'resolved' and resolved_at is not null)
    or status <> 'resolved'
  )
);

create unique index help_requests_one_active_per_student
  on public.help_requests (organization_id, student_id)
  where status in ('waiting', 'claimed');
create index help_requests_class_queue_idx
  on public.help_requests (class_id, status, requested_at);
create index help_requests_expiry_idx
  on public.help_requests (expires_at)
  where status in ('waiting', 'claimed');

create table public.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  event_name text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint audit_events_event_name_length
    check (char_length(event_name) between 1 and 100),
  constraint audit_events_entity_type_length
    check (char_length(entity_type) between 1 and 80),
  constraint audit_events_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create index audit_events_organization_occurred_idx
  on public.audit_events (organization_id, occurred_at desc);
create index audit_events_entity_idx
  on public.audit_events (organization_id, entity_type, entity_id);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create trigger classes_set_updated_at
before update on public.classes
for each row execute function public.set_updated_at();

create trigger task_definitions_set_updated_at
before update on public.task_definitions
for each row execute function public.set_updated_at();

create trigger student_task_state_set_updated_at
before update on public.student_task_state
for each row execute function public.set_updated_at();

create trigger help_requests_set_updated_at
before update on public.help_requests
for each row execute function public.set_updated_at();

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate_name text;
begin
  candidate_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    'Klar-bruker'
  );

  insert into public.profiles (id, display_name)
  values (new.id, left(candidate_name, 80));

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create function public.validate_class_membership_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  membership_role public.organization_role;
begin
  select membership.role
  into membership_role
  from public.memberships as membership
  where membership.organization_id = new.organization_id
    and membership.user_id = new.user_id;

  if membership_role is null then
    raise exception 'User must be an organization member before joining a class';
  end if;

  if new.role = 'teacher' and membership_role not in ('owner', 'teacher') then
    raise exception 'Only organization owners or teachers can be class teachers';
  end if;

  if new.role = 'student' and membership_role <> 'student' then
    raise exception 'Only organization students can be class students';
  end if;

  return new;
end;
$$;

create trigger class_memberships_validate_role
before insert or update on public.class_memberships
for each row execute function public.validate_class_membership_role();

create function public.validate_task_assignment_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.class_memberships as student_membership
    where student_membership.class_id = new.class_id
      and student_membership.organization_id = new.organization_id
      and student_membership.user_id = new.student_id
      and student_membership.role = 'student'
  ) then
    raise exception 'Task assignee must be a student in the target class';
  end if;

  if not exists (
    select 1
    from public.class_memberships as teacher_membership
    where teacher_membership.class_id = new.class_id
      and teacher_membership.organization_id = new.organization_id
      and teacher_membership.user_id = new.assigned_by
      and teacher_membership.role = 'teacher'
  ) then
    raise exception 'Task assigner must be a teacher in the target class';
  end if;

  return new;
end;
$$;

create trigger task_assignments_validate_roles
before insert or update on public.task_assignments
for each row execute function public.validate_task_assignment_roles();

create function public.validate_help_request_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.class_memberships as student_membership
    where student_membership.class_id = new.class_id
      and student_membership.organization_id = new.organization_id
      and student_membership.user_id = new.student_id
      and student_membership.role = 'student'
  ) then
    raise exception 'Help requester must be a student in the target class';
  end if;

  if new.claimed_by is not null and not exists (
    select 1
    from public.class_memberships as teacher_membership
    where teacher_membership.class_id = new.class_id
      and teacher_membership.organization_id = new.organization_id
      and teacher_membership.user_id = new.claimed_by
      and teacher_membership.role = 'teacher'
  ) then
    raise exception 'Help request can only be claimed by a teacher in the class';
  end if;

  return new;
end;
$$;

create trigger help_requests_validate_roles
before insert or update on public.help_requests
for each row execute function public.validate_help_request_roles();

commit;
