begin;

create type public.staff_job_label as enum (
  'contact_teacher',
  'subject_teacher',
  'special_educator',
  'substitute',
  'legacy_teacher',
  'operational_owner'
);

create type public.staff_assignment_source as enum (
  'manual',
  'legacy_backfill',
  'class_creation'
);

create type public.staff_capability as enum (
  'class.workspace.read',
  'task.publish',
  'plan.preview',
  'plan.publish',
  'help_queue.manage',
  'student_support.update'
);

create table public.staff_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid not null,
  job_label public.staff_job_label not null,
  profile_version text not null default 'class_pedagogy_v1',
  starts_at timestamptz not null,
  ends_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null,
  source public.staff_assignment_source not null,
  created_by uuid references auth.users (id) on delete set null,
  idempotency_key uuid not null,
  request_fingerprint text not null,
  expiry_audited_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default transaction_timestamp(),
  unique (id, organization_id),
  unique (organization_id, idempotency_key),
  foreign key (organization_id, user_id)
    references public.memberships (organization_id, user_id) on delete restrict,
  constraint staff_assignments_profile_version
    check (profile_version = 'class_pedagogy_v1'),
  constraint staff_assignments_time_range
    check (ends_at is null or ends_at > starts_at),
  constraint staff_assignments_manual_end_required
    check (source <> 'manual' or ends_at is not null),
  constraint staff_assignments_revocation_pair
    check (
      (revoked_at is null and revoked_by is null)
      or (revoked_at is not null and revoked_by is not null)
    ),
  constraint staff_assignments_fingerprint_format
    check (request_fingerprint ~ '^[0-9a-f]{32}$'),
  constraint staff_assignments_version check (version = 1)
);

create table public.staff_assignment_class_scopes (
  assignment_id uuid primary key,
  organization_id uuid not null,
  class_id uuid not null,
  created_at timestamptz not null default transaction_timestamp(),
  foreign key (assignment_id, organization_id)
    references public.staff_assignments (id, organization_id) on delete restrict,
  foreign key (class_id, organization_id)
    references public.classes (id, organization_id) on delete restrict
);

create table public.staff_assignment_capabilities (
  assignment_id uuid not null references public.staff_assignments (id)
    on delete restrict,
  capability public.staff_capability not null,
  profile_version text not null default 'class_pedagogy_v1',
  created_at timestamptz not null default transaction_timestamp(),
  primary key (assignment_id, capability),
  constraint staff_assignment_capabilities_profile
    check (profile_version = 'class_pedagogy_v1')
);

create index staff_assignments_active_actor_idx
  on public.staff_assignments (
    organization_id,
    user_id,
    starts_at,
    ends_at,
    revoked_at
  );
create index staff_assignments_expiry_idx
  on public.staff_assignments (ends_at)
  where revoked_at is null
    and ends_at is not null
    and expiry_audited_at is null;
create index staff_assignment_class_scopes_class_idx
  on public.staff_assignment_class_scopes (class_id, assignment_id);

alter table public.audit_events
  add column authorizing_staff_assignment_id uuid,
  add column authorizing_capability public.staff_capability,
  add constraint audit_events_staff_authorization_pair check (
    (authorizing_staff_assignment_id is null and authorizing_capability is null)
    or (
      authorizing_staff_assignment_id is not null
      and authorizing_capability is not null
    )
  ),
  add constraint audit_events_staff_assignment_organization_fk
    foreign key (authorizing_staff_assignment_id, organization_id)
    references public.staff_assignments (id, organization_id) on delete restrict;

create index audit_events_staff_assignment_idx
  on public.audit_events (
    organization_id,
    authorizing_staff_assignment_id,
    occurred_at desc
  )
  where authorizing_staff_assignment_id is not null;

create function public.validate_staff_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_role public.organization_role;
begin
  if tg_op = 'UPDATE' then
    if row(
      new.id,
      new.organization_id,
      new.user_id,
      new.job_label,
      new.profile_version,
      new.starts_at,
      new.ends_at,
      new.source,
      new.created_by,
      new.idempotency_key,
      new.request_fingerprint,
      new.version,
      new.created_at
    ) is distinct from row(
      old.id,
      old.organization_id,
      old.user_id,
      old.job_label,
      old.profile_version,
      old.starts_at,
      old.ends_at,
      old.source,
      old.created_by,
      old.idempotency_key,
      old.request_fingerprint,
      old.version,
      old.created_at
    ) then
      raise exception 'Staff assignment identity, scope, profile and validity are immutable';
    end if;

    if old.revoked_at is not null
      and row(new.revoked_at, new.revoked_by)
        is distinct from row(old.revoked_at, old.revoked_by)
    then
      raise exception 'A revoked staff assignment cannot be changed';
    end if;

    if old.expiry_audited_at is not null
      and new.expiry_audited_at is distinct from old.expiry_audited_at
    then
      raise exception 'An expiry audit marker cannot be changed';
    end if;
  end if;

  if tg_op = 'INSERT' then
    select membership.role
    into target_role
      from public.memberships as membership
      where membership.organization_id = new.organization_id
        and membership.user_id = new.user_id
      for share;

    if target_role is null or target_role not in ('owner', 'teacher') then
      raise exception 'Staff assignment target must be a current adult organization member';
    end if;
  end if;

  if new.source = 'manual'
    and new.job_label in ('legacy_teacher', 'operational_owner')
  then
    raise exception 'Internal job labels cannot be selected for manual assignments';
  end if;

  if new.source = 'legacy_backfill'
    and new.job_label not in ('legacy_teacher', 'operational_owner')
  then
    raise exception 'Legacy backfill requires an internal job label';
  end if;

  if new.source = 'class_creation'
    and new.job_label <> 'operational_owner'
  then
    raise exception 'Class creation requires operational owner access';
  end if;

  return new;
end;
$$;

create trigger staff_assignments_validate
before insert or update on public.staff_assignments
for each row execute function public.validate_staff_assignment();

create function public.prevent_staff_assignment_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Staff assignment history cannot be deleted';
end;
$$;

create trigger staff_assignments_prevent_delete
before delete on public.staff_assignments
for each row execute function public.prevent_staff_assignment_delete();

create function public.prevent_staff_assignment_child_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Staff assignment scope and capabilities are immutable';
end;
$$;

create trigger staff_assignment_scopes_immutable
before update or delete on public.staff_assignment_class_scopes
for each row execute function public.prevent_staff_assignment_child_mutation();

create trigger staff_assignment_capabilities_immutable
before update or delete on public.staff_assignment_capabilities
for each row execute function public.prevent_staff_assignment_child_mutation();

create function public.guard_adult_membership_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if exists (
      select 1
      from public.staff_assignments as assignment
      where assignment.organization_id = old.organization_id
        and assignment.user_id = old.user_id
    ) then
      raise exception 'Membership with staff assignment history cannot be deleted';
    end if;
    return old;
  end if;

  if old.role in ('owner', 'teacher')
    and new.role not in ('owner', 'teacher')
    and exists (
      select 1
      from public.staff_assignments as assignment
      where assignment.organization_id = old.organization_id
        and assignment.user_id = old.user_id
        and assignment.revoked_at is null
        and (
          assignment.ends_at is null
          or assignment.ends_at > transaction_timestamp()
        )
    )
  then
    raise exception 'Active staff assignments must be revoked before demotion';
  end if;

  return new;
end;
$$;

create trigger memberships_guard_staff_history
before update of role or delete on public.memberships
for each row execute function public.guard_adult_membership_change();

do $$
begin
  if exists (
    select 1
    from public.class_memberships as class_membership
    left join public.memberships as membership
      on membership.organization_id = class_membership.organization_id
      and membership.user_id = class_membership.user_id
    where class_membership.role = 'teacher'
      and coalesce(membership.role::text, '') not in ('owner', 'teacher')
  ) then
    raise exception 'A legacy teacher class membership has no current adult organization membership';
  end if;
end;
$$;

insert into public.staff_assignments (
  id,
  organization_id,
  user_id,
  job_label,
  starts_at,
  ends_at,
  source,
  created_by,
  idempotency_key,
  request_fingerprint
)
select
  overlay(
    overlay(
      md5('a1-assignment:' || class_membership.class_id::text || ':' || class_membership.user_id::text)
      placing '5' from 13 for 1
    ) placing '8' from 17 for 1
  )::uuid,
  class_membership.organization_id,
  class_membership.user_id,
  case membership.role
    when 'owner' then 'operational_owner'::public.staff_job_label
    else 'legacy_teacher'::public.staff_job_label
  end,
  class_membership.created_at,
  null,
  'legacy_backfill',
  null,
  overlay(
    overlay(
      md5('a1-idempotency:' || class_membership.class_id::text || ':' || class_membership.user_id::text)
      placing '5' from 13 for 1
    ) placing '8' from 17 for 1
  )::uuid,
  md5('a1-backfill:' || class_membership.class_id::text || ':' || class_membership.user_id::text)
from public.class_memberships as class_membership
join public.memberships as membership
  on membership.organization_id = class_membership.organization_id
  and membership.user_id = class_membership.user_id
where class_membership.role = 'teacher';

insert into public.staff_assignment_class_scopes (
  assignment_id,
  organization_id,
  class_id
)
select
  overlay(
    overlay(
      md5('a1-assignment:' || class_membership.class_id::text || ':' || class_membership.user_id::text)
      placing '5' from 13 for 1
    ) placing '8' from 17 for 1
  )::uuid,
  class_membership.organization_id,
  class_membership.class_id
from public.class_memberships as class_membership
where class_membership.role = 'teacher';

insert into public.staff_assignment_capabilities (
  assignment_id,
  capability
)
select
  assignment.id,
  capability.capability
from public.staff_assignments as assignment
cross join unnest(array[
  'class.workspace.read',
  'task.publish',
  'plan.preview',
  'plan.publish',
  'help_queue.manage',
  'student_support.update'
]::public.staff_capability[])
  as capability(capability)
where assignment.source = 'legacy_backfill';

insert into public.audit_events (
  organization_id,
  actor_id,
  event_name,
  entity_type,
  entity_id,
  metadata
)
select
  assignment.organization_id,
  null,
  'staff_assignment.backfilled',
  'staff_assignment',
  assignment.id,
  jsonb_build_object(
    'source', assignment.source,
    'job_label', assignment.job_label,
    'class_id', scope.class_id
  )
from public.staff_assignments as assignment
join public.staff_assignment_class_scopes as scope
  on scope.assignment_id = assignment.id
where assignment.source = 'legacy_backfill';

create function public.is_aal2()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

create function public.staff_assignment_authorizes(
  p_assignment_id uuid,
  p_actor_id uuid,
  p_class_id uuid,
  p_capability public.staff_capability
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_assignments as assignment
    join public.memberships as membership
      on membership.organization_id = assignment.organization_id
      and membership.user_id = assignment.user_id
      and membership.role in ('owner', 'teacher')
    join public.staff_assignment_class_scopes as scope
      on scope.assignment_id = assignment.id
      and scope.organization_id = assignment.organization_id
    join public.staff_assignment_capabilities as capability
      on capability.assignment_id = assignment.id
      and capability.profile_version = assignment.profile_version
    where assignment.id = p_assignment_id
      and assignment.user_id = p_actor_id
      and scope.class_id = p_class_id
      and capability.capability = p_capability
      and assignment.revoked_at is null
      and assignment.starts_at <= transaction_timestamp()
      and (
        assignment.ends_at is null
        or transaction_timestamp() < assignment.ends_at
      )
  );
$$;

create function public.lock_staff_assignment_authorization(
  p_assignment_id uuid,
  p_actor_id uuid,
  p_class_id uuid,
  p_capability public.staff_capability
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  authorized_organization_id uuid;
begin
  select assignment.organization_id
  into authorized_organization_id
  from public.staff_assignments as assignment
  join public.memberships as membership
    on membership.organization_id = assignment.organization_id
    and membership.user_id = assignment.user_id
    and membership.role in ('owner', 'teacher')
  join public.staff_assignment_class_scopes as scope
    on scope.assignment_id = assignment.id
    and scope.organization_id = assignment.organization_id
  join public.staff_assignment_capabilities as capability
    on capability.assignment_id = assignment.id
    and capability.profile_version = assignment.profile_version
  where assignment.id = p_assignment_id
    and assignment.user_id = p_actor_id
    and scope.class_id = p_class_id
    and capability.capability = p_capability
    and assignment.revoked_at is null
    and assignment.starts_at <= transaction_timestamp()
    and (
      assignment.ends_at is null
      or transaction_timestamp() < assignment.ends_at
    )
  for share of assignment, membership;

  return authorized_organization_id;
end;
$$;

create function public.lock_active_staff_assignment(
  p_actor_id uuid,
  p_class_id uuid,
  p_capability public.staff_capability
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  authorized_assignment_id uuid;
begin
  select assignment.id
  into authorized_assignment_id
  from public.staff_assignments as assignment
  join public.memberships as membership
    on membership.organization_id = assignment.organization_id
    and membership.user_id = assignment.user_id
    and membership.role in ('owner', 'teacher')
  join public.staff_assignment_class_scopes as scope
    on scope.assignment_id = assignment.id
    and scope.organization_id = assignment.organization_id
  join public.staff_assignment_capabilities as capability
    on capability.assignment_id = assignment.id
    and capability.profile_version = assignment.profile_version
  where assignment.user_id = p_actor_id
    and scope.class_id = p_class_id
    and capability.capability = p_capability
    and assignment.revoked_at is null
    and assignment.starts_at <= transaction_timestamp()
    and (
      assignment.ends_at is null
      or transaction_timestamp() < assignment.ends_at
    )
  order by assignment.starts_at desc, assignment.id
  limit 1
  for share of assignment, membership;

  return authorized_assignment_id;
end;
$$;

create function public.resolve_active_staff_assignment(
  p_actor_id uuid,
  p_class_id uuid,
  p_capability public.staff_capability
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select assignment.id
  from public.staff_assignments as assignment
  join public.memberships as membership
    on membership.organization_id = assignment.organization_id
    and membership.user_id = assignment.user_id
    and membership.role in ('owner', 'teacher')
  join public.staff_assignment_class_scopes as scope
    on scope.assignment_id = assignment.id
    and scope.organization_id = assignment.organization_id
  join public.staff_assignment_capabilities as capability
    on capability.assignment_id = assignment.id
    and capability.profile_version = assignment.profile_version
  where assignment.user_id = p_actor_id
    and scope.class_id = p_class_id
    and capability.capability = p_capability
    and assignment.revoked_at is null
    and assignment.starts_at <= transaction_timestamp()
    and (
      assignment.ends_at is null
      or transaction_timestamp() < assignment.ends_at
    )
  order by assignment.starts_at desc, assignment.id
  limit 1;
$$;

create function public.has_active_staff_capability(
  p_class_id uuid,
  p_capability public.staff_capability
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_aal2()
    and public.resolve_active_staff_assignment(
      auth.uid(),
      p_class_id,
      p_capability
    ) is not null;
$$;

create function public.is_control_plane_owner(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_aal2()
    and exists (
      select 1
      from public.memberships as membership
      where membership.organization_id = p_organization_id
        and membership.user_id = auth.uid()
        and membership.role = 'owner'
    );
$$;

create function public.reconcile_expired_staff_assignments(
  p_organization_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_rows integer;
begin
  with expired as (
    update public.staff_assignments as assignment
    set expiry_audited_at = transaction_timestamp()
    where assignment.revoked_at is null
      and assignment.ends_at is not null
      and assignment.ends_at <= transaction_timestamp()
      and assignment.expiry_audited_at is null
      and (
        p_organization_id is null
        or assignment.organization_id = p_organization_id
      )
    returning assignment.*
  ), audited as (
    insert into public.audit_events (
      organization_id,
      actor_id,
      event_name,
      entity_type,
      entity_id,
      metadata
    )
    select
      expired.organization_id,
      null,
      'staff_assignment.expired',
      'staff_assignment',
      expired.id,
      jsonb_build_object(
        'effective_at', expired.ends_at,
        'recorded_at', expired.expiry_audited_at
      )
    from expired
    returning 1
  )
  select count(*)::integer into affected_rows from audited;

  return affected_rows;
end;
$$;

create function public.create_staff_assignment(
  p_organization_id uuid,
  p_actor_id uuid,
  p_target_user_id uuid,
  p_class_id uuid,
  p_job_label public.staff_job_label,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_assignment public.staff_assignments;
  existing_class_id uuid;
  new_assignment_id uuid;
  fingerprint text;
begin
  if p_idempotency_key is null then
    raise exception 'Idempotency key is required';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_organization_id::text || ':' || p_idempotency_key::text,
      0
    )
  );

  perform actor_membership.user_id
    from public.memberships as actor_membership
    where actor_membership.organization_id = p_organization_id
      and actor_membership.user_id = p_actor_id
      and actor_membership.role = 'owner'
    for share;
  if not found then
    raise exception 'Only an organization owner can create staff assignments';
  end if;

  perform target_membership.user_id
    from public.memberships as target_membership
    where target_membership.organization_id = p_organization_id
      and target_membership.user_id = p_target_user_id
      and target_membership.role in ('owner', 'teacher')
    for share;
  if not found then
    raise exception 'Assignment target must be a current adult member in the organization';
  end if;

  if not exists (
    select 1
    from public.classes as class
    where class.id = p_class_id
      and class.organization_id = p_organization_id
  ) then
    raise exception 'Assignment class must belong to the organization';
  end if;

  if p_job_label not in (
    'contact_teacher',
    'subject_teacher',
    'special_educator',
    'substitute'
  ) then
    raise exception 'Internal job labels cannot be assigned manually';
  end if;

  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    raise exception 'Manual assignment requires a valid start and end';
  end if;

  fingerprint := md5(
    p_target_user_id::text || '|' ||
    p_class_id::text || '|' ||
    p_job_label::text || '|' ||
    p_starts_at::text || '|' ||
    p_ends_at::text
  );

  select assignment.*
  into existing_assignment
  from public.staff_assignments as assignment
  where assignment.organization_id = p_organization_id
    and assignment.idempotency_key = p_idempotency_key;

  if existing_assignment.id is not null then
    select scope.class_id
    into existing_class_id
    from public.staff_assignment_class_scopes as scope
    where scope.assignment_id = existing_assignment.id;

    if existing_assignment.source = 'manual'
      and existing_assignment.user_id = p_target_user_id
      and existing_class_id = p_class_id
      and existing_assignment.job_label = p_job_label
      and existing_assignment.starts_at = p_starts_at
      and existing_assignment.ends_at = p_ends_at
      and existing_assignment.request_fingerprint = fingerprint
    then
      return existing_assignment.id;
    end if;
    raise exception 'Idempotency key was already used with another payload';
  end if;

  insert into public.staff_assignments (
    organization_id,
    user_id,
    job_label,
    starts_at,
    ends_at,
    source,
    created_by,
    idempotency_key,
    request_fingerprint
  ) values (
    p_organization_id,
    p_target_user_id,
    p_job_label,
    p_starts_at,
    p_ends_at,
    'manual',
    p_actor_id,
    p_idempotency_key,
    fingerprint
  )
  returning id into new_assignment_id;

  insert into public.staff_assignment_class_scopes (
    assignment_id,
    organization_id,
    class_id
  ) values (
    new_assignment_id,
    p_organization_id,
    p_class_id
  );

  insert into public.staff_assignment_capabilities (
    assignment_id,
    capability
  )
  select new_assignment_id, capability
  from unnest(array[
    'class.workspace.read',
    'task.publish',
    'plan.preview',
    'plan.publish',
    'help_queue.manage',
    'student_support.update'
  ]::public.staff_capability[])
    as capability(capability);

  insert into public.audit_events (
    organization_id,
    actor_id,
    event_name,
    entity_type,
    entity_id,
    metadata
  ) values (
    p_organization_id,
    p_actor_id,
    'staff_assignment.created',
    'staff_assignment',
    new_assignment_id,
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'class_id', p_class_id,
      'job_label', p_job_label,
      'starts_at', p_starts_at,
      'ends_at', p_ends_at,
      'profile_version', 'class_pedagogy_v1'
    )
  );

  return new_assignment_id;
end;
$$;

create function public.revoke_staff_assignment(
  p_organization_id uuid,
  p_actor_id uuid,
  p_assignment_id uuid
)
returns public.staff_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  assignment public.staff_assignments;
begin
  perform membership.user_id
    from public.memberships as membership
    where membership.organization_id = p_organization_id
      and membership.user_id = p_actor_id
      and membership.role = 'owner'
    for share;
  if not found then
    raise exception 'Only an organization owner can revoke staff assignments';
  end if;

  select current_assignment.*
  into assignment
  from public.staff_assignments as current_assignment
  where current_assignment.id = p_assignment_id
    and current_assignment.organization_id = p_organization_id
  for update;

  if assignment.id is null then
    raise exception 'Staff assignment was not found in the organization';
  end if;

  if assignment.revoked_at is not null then
    return assignment;
  end if;

  if assignment.ends_at is not null
    and assignment.ends_at <= transaction_timestamp()
  then
    if assignment.expiry_audited_at is null then
      update public.staff_assignments
      set expiry_audited_at = transaction_timestamp()
      where id = assignment.id
        and expiry_audited_at is null
      returning * into assignment;

      if found then
        insert into public.audit_events (
          organization_id,
          actor_id,
          event_name,
          entity_type,
          entity_id,
          metadata
        ) values (
          assignment.organization_id,
          null,
          'staff_assignment.expired',
          'staff_assignment',
          assignment.id,
          jsonb_build_object(
            'effective_at', assignment.ends_at,
            'recorded_at', assignment.expiry_audited_at
          )
        );
      end if;
    end if;

    return assignment;
  end if;

  update public.staff_assignments
  set
    revoked_at = transaction_timestamp(),
    revoked_by = p_actor_id
  where id = assignment.id
  returning * into assignment;

  insert into public.audit_events (
    organization_id,
    actor_id,
    event_name,
    entity_type,
    entity_id,
    metadata
  ) values (
    assignment.organization_id,
    p_actor_id,
    'staff_assignment.revoked',
    'staff_assignment',
    assignment.id,
    jsonb_build_object(
      'target_user_id', assignment.user_id,
      'revoked_at', assignment.revoked_at
    )
  );

  return assignment;
end;
$$;

create or replace function public.create_class_for_teacher(
  p_organization_id uuid,
  p_actor_id uuid,
  p_name text,
  p_academic_year text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_class_id uuid;
  owner_assignment_id uuid;
begin
  perform membership.user_id
    from public.memberships as membership
    where membership.organization_id = p_organization_id
      and membership.user_id = p_actor_id
      and membership.role = 'owner'
    for share;
  if not found then
    raise exception 'Only an organization owner can create a class';
  end if;

  insert into public.classes (
    organization_id,
    name,
    academic_year,
    created_by
  ) values (
    p_organization_id,
    trim(p_name),
    nullif(trim(p_academic_year), ''),
    p_actor_id
  )
  returning id into new_class_id;

  insert into public.class_memberships (
    class_id,
    organization_id,
    user_id,
    role,
    created_by
  ) values (
    new_class_id,
    p_organization_id,
    p_actor_id,
    'teacher',
    p_actor_id
  );

  insert into public.staff_assignments (
    organization_id,
    user_id,
    job_label,
    starts_at,
    ends_at,
    source,
    created_by,
    idempotency_key,
    request_fingerprint
  ) values (
    p_organization_id,
    p_actor_id,
    'operational_owner',
    transaction_timestamp(),
    null,
    'class_creation',
    p_actor_id,
    gen_random_uuid(),
    md5('class-creation:' || new_class_id::text || ':' || p_actor_id::text)
  )
  returning id into owner_assignment_id;

  insert into public.staff_assignment_class_scopes (
    assignment_id,
    organization_id,
    class_id
  ) values (
    owner_assignment_id,
    p_organization_id,
    new_class_id
  );

  insert into public.staff_assignment_capabilities (
    assignment_id,
    capability
  )
  select owner_assignment_id, capability
  from unnest(array[
    'class.workspace.read',
    'task.publish',
    'plan.preview',
    'plan.publish',
    'help_queue.manage',
    'student_support.update'
  ]::public.staff_capability[])
    as capability(capability);

  insert into public.audit_events (
    organization_id,
    actor_id,
    event_name,
    entity_type,
    entity_id,
    metadata
  ) values
  (
    p_organization_id,
    p_actor_id,
    'class.created',
    'class',
    new_class_id,
    jsonb_build_object(
      'academic_year', p_academic_year,
      'operational_owner_assignment_id', owner_assignment_id
    )
  ),
  (
    p_organization_id,
    p_actor_id,
    'staff_assignment.created',
    'staff_assignment',
    owner_assignment_id,
    jsonb_build_object(
      'target_user_id', p_actor_id,
      'class_id', new_class_id,
      'job_label', 'operational_owner',
      'source', 'class_creation'
    )
  );

  return new_class_id;
end;
$$;

create or replace function public.validate_task_assignment_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  authorizing_assignment_id uuid;
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

  authorizing_assignment_id := public.lock_active_staff_assignment(
    new.assigned_by,
    new.class_id,
    'task.publish'
  );
  if authorizing_assignment_id is null then
    authorizing_assignment_id := public.lock_active_staff_assignment(
      new.assigned_by,
      new.class_id,
      'plan.publish'
    );
  end if;

  if authorizing_assignment_id is null then
    raise exception 'Task assigner must have an active publishing assignment';
  end if;

  return new;
end;
$$;

create or replace function public.validate_help_request_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  must_validate_claim boolean := false;
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

  if new.status in ('claimed', 'resolved') then
    must_validate_claim := true;
  elsif tg_op = 'UPDATE' then
    must_validate_claim := new.claimed_by is distinct from old.claimed_by;
  end if;

  if must_validate_claim
    and public.lock_active_staff_assignment(
      new.claimed_by,
      new.class_id,
      'help_queue.manage'
    ) is null
  then
    raise exception 'Help request staff transitions require an active staff assignment';
  end if;

  return new;
end;
$$;

drop function public.publish_plan_to_class(uuid, uuid, jsonb);
drop function public.publish_task_to_class(
  uuid,
  uuid,
  text,
  text,
  text,
  smallint,
  smallint,
  timestamptz,
  timestamptz
);

create function public.insert_published_task_to_class(
  p_class_id uuid,
  p_actor_id uuid,
  p_staff_assignment_id uuid,
  p_authorizing_capability public.staff_capability,
  p_title text,
  p_description text default null,
  p_subject text default null,
  p_estimated_minutes smallint default null,
  p_support_level smallint default 2,
  p_due_at timestamptz default null,
  p_visible_from timestamptz default transaction_timestamp()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_organization_id uuid;
  new_task_id uuid;
begin
  if p_authorizing_capability not in ('task.publish', 'plan.publish') then
    raise exception 'Unsupported task publishing capability';
  end if;

  target_organization_id := public.lock_staff_assignment_authorization(
    p_staff_assignment_id,
    p_actor_id,
    p_class_id,
    p_authorizing_capability
  );
  if target_organization_id is null then
    raise exception 'Staff assignment does not authorize task publishing';
  end if;

  insert into public.task_definitions (
    organization_id,
    class_id,
    title,
    description,
    subject,
    estimated_minutes,
    support_level,
    publication_status,
    created_by,
    published_at
  ) values (
    target_organization_id,
    p_class_id,
    trim(p_title),
    nullif(trim(p_description), ''),
    nullif(trim(p_subject), ''),
    p_estimated_minutes,
    p_support_level,
    'published',
    p_actor_id,
    transaction_timestamp()
  )
  returning id into new_task_id;

  insert into public.task_assignments (
    organization_id,
    class_id,
    task_definition_id,
    student_id,
    assigned_by,
    visible_from,
    due_at
  )
  select
    target_organization_id,
    p_class_id,
    new_task_id,
    class_membership.user_id,
    p_actor_id,
    p_visible_from,
    p_due_at
  from public.class_memberships as class_membership
  where class_membership.class_id = p_class_id
    and class_membership.organization_id = target_organization_id
    and class_membership.role = 'student';

  insert into public.student_task_state (
    assignment_id,
    organization_id,
    student_id
  )
  select
    task_assignment.id,
    task_assignment.organization_id,
    task_assignment.student_id
  from public.task_assignments as task_assignment
  where task_assignment.task_definition_id = new_task_id;

  insert into public.audit_events (
    organization_id,
    actor_id,
    event_name,
    entity_type,
    entity_id,
    metadata,
    authorizing_staff_assignment_id,
    authorizing_capability
  ) values (
    target_organization_id,
    p_actor_id,
    'task.published',
    'task_definition',
    new_task_id,
    jsonb_build_object('class_id', p_class_id),
    p_staff_assignment_id,
    p_authorizing_capability
  );

  return new_task_id;
end;
$$;

create function public.publish_task_to_class(
  p_class_id uuid,
  p_actor_id uuid,
  p_staff_assignment_id uuid,
  p_title text,
  p_description text default null,
  p_subject text default null,
  p_estimated_minutes smallint default null,
  p_support_level smallint default 2,
  p_due_at timestamptz default null,
  p_visible_from timestamptz default transaction_timestamp()
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select public.insert_published_task_to_class(
    p_class_id,
    p_actor_id,
    p_staff_assignment_id,
    'task.publish',
    p_title,
    p_description,
    p_subject,
    p_estimated_minutes,
    p_support_level,
    p_due_at,
    p_visible_from
  );
$$;

create function public.publish_plan_to_class(
  p_class_id uuid,
  p_actor_id uuid,
  p_staff_assignment_id uuid,
  p_tasks jsonb
)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  task_item jsonb;
  published_ids uuid[] := '{}';
  published_id uuid;
  target_organization_id uuid;
begin
  target_organization_id := public.lock_staff_assignment_authorization(
    p_staff_assignment_id,
    p_actor_id,
    p_class_id,
    'plan.publish'
  );
  if target_organization_id is null then
    raise exception 'Staff assignment does not authorize plan publishing';
  end if;

  if jsonb_typeof(p_tasks) <> 'array' then
    raise exception 'Imported tasks must be a JSON array';
  end if;

  if jsonb_array_length(p_tasks) < 1 or jsonb_array_length(p_tasks) > 50 then
    raise exception 'Imported plan must contain between 1 and 50 tasks';
  end if;

  for task_item in
    select value from jsonb_array_elements(p_tasks)
  loop
    published_id := public.insert_published_task_to_class(
      p_class_id,
      p_actor_id,
      p_staff_assignment_id,
      'plan.publish',
      task_item ->> 'title',
      task_item ->> 'description',
      task_item ->> 'subject',
      case
        when jsonb_typeof(task_item -> 'estimated_minutes') = 'number'
          then (task_item ->> 'estimated_minutes')::smallint
        else null
      end,
      case
        when jsonb_typeof(task_item -> 'support_level') = 'number'
          then (task_item ->> 'support_level')::smallint
        else 2::smallint
      end
    );
    published_ids := array_append(published_ids, published_id);
  end loop;

  insert into public.audit_events (
    organization_id,
    actor_id,
    event_name,
    entity_type,
    entity_id,
    metadata,
    authorizing_staff_assignment_id,
    authorizing_capability
  ) values (
    target_organization_id,
    p_actor_id,
    'plan.published',
    'class',
    p_class_id,
    jsonb_build_object(
      'class_id', p_class_id,
      'task_ids', to_jsonb(published_ids)
    ),
    p_staff_assignment_id,
    'plan.publish'
  );

  return published_ids;
end;
$$;

drop function public.claim_student_help(uuid, uuid);
drop function public.resolve_student_help(uuid, uuid);

create function public.claim_student_help(
  p_request_id uuid,
  p_teacher_id uuid,
  p_staff_assignment_id uuid
)
returns public.help_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_request public.help_requests;
  authorized_organization_id uuid;
begin
  perform public.expire_help_requests();

  select request.*
  into target_request
  from public.help_requests as request
  where request.id = p_request_id
  for update;

  if target_request.id is null then
    raise exception 'Help request was not found';
  end if;

  authorized_organization_id := public.lock_staff_assignment_authorization(
    p_staff_assignment_id,
    p_teacher_id,
    target_request.class_id,
    'help_queue.manage'
  );
  if authorized_organization_id is distinct from target_request.organization_id then
    raise exception 'Staff assignment does not authorize help queue management';
  end if;

  if target_request.status = 'claimed'
    and target_request.claimed_by = p_teacher_id
  then
    return target_request;
  end if;

  update public.help_requests
  set
    status = 'claimed',
    claimed_by = p_teacher_id,
    claimed_at = transaction_timestamp()
  where id = p_request_id
    and status = 'waiting'
  returning * into target_request;

  if target_request.id is null then
    raise exception 'Help request is no longer waiting';
  end if;

  insert into public.audit_events (
    organization_id,
    actor_id,
    event_name,
    entity_type,
    entity_id,
    metadata,
    authorizing_staff_assignment_id,
    authorizing_capability
  ) values (
    target_request.organization_id,
    p_teacher_id,
    'help.claimed',
    'help_request',
    target_request.id,
    jsonb_build_object('class_id', target_request.class_id),
    p_staff_assignment_id,
    'help_queue.manage'
  );

  return target_request;
end;
$$;

create function public.resolve_student_help(
  p_request_id uuid,
  p_teacher_id uuid,
  p_staff_assignment_id uuid
)
returns public.help_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_request public.help_requests;
  authorized_organization_id uuid;
begin
  select request.*
  into target_request
  from public.help_requests as request
  where request.id = p_request_id
  for update;

  if target_request.id is null then
    raise exception 'Help request was not found';
  end if;

  authorized_organization_id := public.lock_staff_assignment_authorization(
    p_staff_assignment_id,
    p_teacher_id,
    target_request.class_id,
    'help_queue.manage'
  );
  if authorized_organization_id is distinct from target_request.organization_id then
    raise exception 'Staff assignment does not authorize help queue management';
  end if;

  update public.help_requests
  set
    status = 'resolved',
    resolved_at = transaction_timestamp()
  where id = p_request_id
    and claimed_by = p_teacher_id
    and status = 'claimed'
  returning * into target_request;

  if target_request.id is null then
    raise exception 'Staff member must claim the active request before resolving it';
  end if;

  insert into public.audit_events (
    organization_id,
    actor_id,
    event_name,
    entity_type,
    entity_id,
    metadata,
    authorizing_staff_assignment_id,
    authorizing_capability
  ) values (
    target_request.organization_id,
    p_teacher_id,
    'help.resolved',
    'help_request',
    target_request.id,
    jsonb_build_object('class_id', target_request.class_id),
    p_staff_assignment_id,
    'help_queue.manage'
  );

  return target_request;
end;
$$;

create or replace function public.update_student_experience(
  p_organization_id uuid,
  p_student_id uuid,
  p_actor_id uuid,
  p_support_level smallint,
  p_progress_enabled boolean
)
returns public.student_experience_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.student_experience_settings;
begin
  if p_actor_id <> p_student_id then
    raise exception 'Staff updates require an explicit staff assignment';
  end if;

  if p_support_level not between 1 and 3 then
    raise exception 'Support level must be between 1 and 3';
  end if;
  if p_progress_enabled is null then
    raise exception 'Progress preference must be explicit';
  end if;

  if not exists (
    select 1
    from public.memberships as membership
    where membership.organization_id = p_organization_id
      and membership.user_id = p_student_id
      and membership.role = 'student'
  ) then
    raise exception 'Target user is not a student in the organization';
  end if;

  insert into public.student_experience_settings (
    organization_id,
    student_id,
    support_level,
    progress_enabled,
    updated_by
  ) values (
    p_organization_id,
    p_student_id,
    p_support_level,
    p_progress_enabled,
    p_actor_id
  )
  on conflict (organization_id, student_id) do update
  set support_level = excluded.support_level,
      progress_enabled = excluded.progress_enabled,
      updated_by = excluded.updated_by
  returning * into result;

  insert into public.audit_events (
    organization_id,
    actor_id,
    event_name,
    entity_type,
    entity_id,
    metadata
  ) values (
    p_organization_id,
    p_actor_id,
    'student.experience.updated',
    'profile',
    p_student_id,
    jsonb_build_object(
      'support_level', p_support_level,
      'progress_enabled', p_progress_enabled,
      'source', 'student'
    )
  );

  return result;
end;
$$;

create function public.update_student_experience_for_staff(
  p_organization_id uuid,
  p_class_id uuid,
  p_student_id uuid,
  p_actor_id uuid,
  p_staff_assignment_id uuid,
  p_support_level smallint,
  p_progress_enabled boolean
)
returns public.student_experience_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.student_experience_settings;
  authorized_organization_id uuid;
begin
  if p_support_level not between 1 and 3 then
    raise exception 'Support level must be between 1 and 3';
  end if;
  if p_progress_enabled is null then
    raise exception 'Progress preference must be explicit';
  end if;

  authorized_organization_id := public.lock_staff_assignment_authorization(
    p_staff_assignment_id,
    p_actor_id,
    p_class_id,
    'student_support.update'
  );
  if authorized_organization_id is distinct from p_organization_id then
    raise exception 'Staff assignment does not authorize student support updates';
  end if;

  if not exists (
    select 1
    from public.class_memberships as student_membership
    where student_membership.organization_id = p_organization_id
      and student_membership.class_id = p_class_id
      and student_membership.user_id = p_student_id
      and student_membership.role = 'student'
  ) then
    raise exception 'Target user is not a student in the assigned class';
  end if;

  if not exists (
    select 1
    from public.staff_assignment_class_scopes as scope
    where scope.assignment_id = p_staff_assignment_id
      and scope.organization_id = p_organization_id
      and scope.class_id = p_class_id
  ) then
    raise exception 'Assignment and student organization do not match';
  end if;

  insert into public.student_experience_settings (
    organization_id,
    student_id,
    support_level,
    progress_enabled,
    updated_by
  ) values (
    p_organization_id,
    p_student_id,
    p_support_level,
    p_progress_enabled,
    p_actor_id
  )
  on conflict (organization_id, student_id) do update
  set support_level = excluded.support_level,
      progress_enabled = excluded.progress_enabled,
      updated_by = excluded.updated_by
  returning * into result;

  insert into public.audit_events (
    organization_id,
    actor_id,
    event_name,
    entity_type,
    entity_id,
    metadata,
    authorizing_staff_assignment_id,
    authorizing_capability
  ) values (
    p_organization_id,
    p_actor_id,
    'student.experience.updated',
    'profile',
    p_student_id,
    jsonb_build_object(
      'class_id', p_class_id,
      'support_level', p_support_level,
      'progress_enabled', p_progress_enabled
    ),
    p_staff_assignment_id,
    'student_support.update'
  );

  return result;
end;
$$;

create or replace function public.can_access_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.class_memberships as class_membership
    where class_membership.class_id = p_class_id
      and class_membership.user_id = auth.uid()
      and class_membership.role = 'student'
  ) or public.has_active_staff_capability(
    p_class_id,
    'class.workspace.read'
  );
$$;

create or replace function public.can_view_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_profile_id = auth.uid()
  or exists (
    select 1
    from public.class_memberships as target
    where target.user_id = p_profile_id
      and target.role = 'student'
      and public.has_active_staff_capability(
        target.class_id,
        'class.workspace.read'
      )
  )
  or exists (
    select 1
    from public.memberships as target
    where target.user_id = p_profile_id
      and target.role in ('owner', 'teacher')
      and public.is_control_plane_owner(target.organization_id)
  );
$$;

create or replace function public.can_view_membership(
  p_organization_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id = auth.uid()
  or exists (
    select 1
    from public.memberships as target
    where target.organization_id = p_organization_id
      and target.user_id = p_user_id
      and target.role in ('owner', 'teacher')
      and public.is_control_plane_owner(p_organization_id)
  )
  or exists (
    select 1
    from public.class_memberships as target
    where target.organization_id = p_organization_id
      and target.user_id = p_user_id
      and target.role = 'student'
      and public.has_active_staff_capability(
        target.class_id,
        'class.workspace.read'
      )
  );
$$;

create or replace function public.can_view_task_definition(
  p_task_definition_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.task_definitions as task
    where task.id = p_task_definition_id
      and (
        public.has_active_staff_capability(
          task.class_id,
          'class.workspace.read'
        )
        or exists (
          select 1
          from public.task_assignments as assignment
          where assignment.task_definition_id = task.id
            and assignment.student_id = auth.uid()
            and assignment.visible_from <= transaction_timestamp()
            and task.publication_status = 'published'
        )
      )
  );
$$;

drop policy profiles_select_authorized on public.profiles;
drop policy memberships_select_authorized on public.memberships;
drop policy classes_select_authorized on public.classes;
drop policy class_memberships_select_authorized on public.class_memberships;
drop policy task_definitions_select_authorized on public.task_definitions;
drop policy task_assignments_select_authorized on public.task_assignments;
drop policy student_task_state_select_authorized on public.student_task_state;
drop policy help_requests_select_authorized on public.help_requests;
drop policy audit_events_select_teachers on public.audit_events;
drop policy student_experience_select_authorized
  on public.student_experience_settings;

create policy profiles_select_authorized
on public.profiles
for select
to authenticated
using (public.can_view_profile(id));

create policy memberships_select_authorized
on public.memberships
for select
to authenticated
using (public.can_view_membership(organization_id, user_id));

create policy classes_select_authorized
on public.classes
for select
to authenticated
using (
  public.can_access_class(id)
  or public.is_control_plane_owner(organization_id)
);

create policy class_memberships_select_authorized
on public.class_memberships
for select
to authenticated
using (
  (user_id = auth.uid() and role = 'student')
  or (
    role = 'student'
    and public.has_active_staff_capability(
      class_id,
      'class.workspace.read'
    )
  )
);

create policy task_definitions_select_authorized
on public.task_definitions
for select
to authenticated
using (public.can_view_task_definition(id));

create policy task_assignments_select_authorized
on public.task_assignments
for select
to authenticated
using (
  (student_id = auth.uid() and visible_from <= transaction_timestamp())
  or public.has_active_staff_capability(
    class_id,
    'class.workspace.read'
  )
);

create policy student_task_state_select_authorized
on public.student_task_state
for select
to authenticated
using (
  student_id = auth.uid()
  or exists (
    select 1
    from public.task_assignments as assignment
    where assignment.id = student_task_state.assignment_id
      and public.has_active_staff_capability(
        assignment.class_id,
        'class.workspace.read'
      )
  )
);

create policy help_requests_select_authorized
on public.help_requests
for select
to authenticated
using (
  student_id = auth.uid()
  or public.has_active_staff_capability(
    class_id,
    'help_queue.manage'
  )
);

create policy audit_events_select_owner_aal2
on public.audit_events
for select
to authenticated
using (public.is_control_plane_owner(organization_id));

create policy student_experience_select_authorized
on public.student_experience_settings
for select
to authenticated
using (
  student_id = auth.uid()
  or exists (
    select 1
    from public.class_memberships as target
    where target.organization_id = student_experience_settings.organization_id
      and target.user_id = student_experience_settings.student_id
      and target.role = 'student'
      and public.has_active_staff_capability(
        target.class_id,
        'class.workspace.read'
      )
  )
);

alter table public.staff_assignments enable row level security;
alter table public.staff_assignment_class_scopes enable row level security;
alter table public.staff_assignment_capabilities enable row level security;

create policy staff_assignments_select_authorized
on public.staff_assignments
for select
to authenticated
using (
  (user_id = auth.uid() and public.is_aal2())
  or public.is_control_plane_owner(organization_id)
);

create policy staff_assignment_scopes_select_authorized
on public.staff_assignment_class_scopes
for select
to authenticated
using (
  exists (
    select 1
    from public.staff_assignments as assignment
    where assignment.id = staff_assignment_class_scopes.assignment_id
      and assignment.organization_id = staff_assignment_class_scopes.organization_id
      and (
        (assignment.user_id = auth.uid() and public.is_aal2())
        or public.is_control_plane_owner(assignment.organization_id)
      )
  )
);

create policy staff_assignment_capabilities_select_authorized
on public.staff_assignment_capabilities
for select
to authenticated
using (
  exists (
    select 1
    from public.staff_assignments as assignment
    where assignment.id = staff_assignment_capabilities.assignment_id
      and (
        (assignment.user_id = auth.uid() and public.is_aal2())
        or public.is_control_plane_owner(assignment.organization_id)
      )
  )
);

revoke all on table
  public.staff_assignments,
  public.staff_assignment_class_scopes,
  public.staff_assignment_capabilities
from anon, authenticated, service_role;
grant select on table
  public.staff_assignments,
  public.staff_assignment_class_scopes,
  public.staff_assignment_capabilities
to authenticated;
grant select on table
  public.staff_assignments,
  public.staff_assignment_class_scopes,
  public.staff_assignment_capabilities
to service_role;

revoke all on function public.validate_staff_assignment()
from public, anon, authenticated;
revoke all on function public.prevent_staff_assignment_delete()
from public, anon, authenticated;
revoke all on function public.prevent_staff_assignment_child_mutation()
from public, anon, authenticated;
revoke all on function public.guard_adult_membership_change()
from public, anon, authenticated;
revoke all on function public.staff_assignment_authorizes(
  uuid,
  uuid,
  uuid,
  public.staff_capability
) from public, anon, authenticated;
revoke all on function public.lock_staff_assignment_authorization(
  uuid,
  uuid,
  uuid,
  public.staff_capability
) from public, anon, authenticated;
revoke all on function public.lock_active_staff_assignment(
  uuid,
  uuid,
  public.staff_capability
) from public, anon, authenticated;
revoke all on function public.resolve_active_staff_assignment(
  uuid,
  uuid,
  public.staff_capability
) from public, anon, authenticated;
revoke all on function public.reconcile_expired_staff_assignments(uuid)
from public, anon, authenticated;
revoke all on function public.create_staff_assignment(
  uuid,
  uuid,
  uuid,
  uuid,
  public.staff_job_label,
  timestamptz,
  timestamptz,
  uuid
) from public, anon, authenticated;
revoke all on function public.revoke_staff_assignment(uuid, uuid, uuid)
from public, anon, authenticated;
revoke all on function public.insert_published_task_to_class(
  uuid,
  uuid,
  uuid,
  public.staff_capability,
  text,
  text,
  text,
  smallint,
  smallint,
  timestamptz,
  timestamptz
) from public, anon, authenticated;
revoke all on function public.publish_task_to_class(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  smallint,
  smallint,
  timestamptz,
  timestamptz
) from public, anon, authenticated;
revoke all on function public.publish_plan_to_class(uuid, uuid, uuid, jsonb)
from public, anon, authenticated;
revoke all on function public.claim_student_help(uuid, uuid, uuid)
from public, anon, authenticated;
revoke all on function public.resolve_student_help(uuid, uuid, uuid)
from public, anon, authenticated;
revoke all on function public.update_student_experience_for_staff(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  smallint,
  boolean
) from public, anon, authenticated;

grant execute on function public.is_aal2() to authenticated, service_role;
grant execute on function public.has_active_staff_capability(
  uuid,
  public.staff_capability
) to authenticated, service_role;
grant execute on function public.is_control_plane_owner(uuid)
to authenticated, service_role;
grant execute on function public.can_access_class(uuid)
to authenticated, service_role;
grant execute on function public.can_view_profile(uuid)
to authenticated, service_role;
grant execute on function public.can_view_membership(uuid, uuid)
to authenticated, service_role;
grant execute on function public.can_view_task_definition(uuid)
to authenticated, service_role;

grant execute on function public.resolve_active_staff_assignment(
  uuid,
  uuid,
  public.staff_capability
) to service_role;
grant execute on function public.reconcile_expired_staff_assignments(uuid)
to service_role;
grant execute on function public.create_staff_assignment(
  uuid,
  uuid,
  uuid,
  uuid,
  public.staff_job_label,
  timestamptz,
  timestamptz,
  uuid
) to service_role;
grant execute on function public.revoke_staff_assignment(uuid, uuid, uuid)
to service_role;
grant execute on function public.insert_published_task_to_class(
  uuid,
  uuid,
  uuid,
  public.staff_capability,
  text,
  text,
  text,
  smallint,
  smallint,
  timestamptz,
  timestamptz
) to service_role;
grant execute on function public.publish_task_to_class(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  smallint,
  smallint,
  timestamptz,
  timestamptz
) to service_role;
grant execute on function public.publish_plan_to_class(uuid, uuid, uuid, jsonb)
to service_role;
grant execute on function public.claim_student_help(uuid, uuid, uuid)
to service_role;
grant execute on function public.resolve_student_help(uuid, uuid, uuid)
to service_role;
grant execute on function public.update_student_experience_for_staff(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  smallint,
  boolean
) to service_role;

commit;
