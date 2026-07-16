begin;

create or replace function public.expected_staff_assignment_capabilities(
  p_profile_version text
)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case p_profile_version
    when 'class_pedagogy_v1' then array[
      'class.workspace.read',
      'task.publish',
      'plan.preview',
      'plan.publish',
      'help_queue.manage',
      'student_support.update'
    ]::text[]
    when 'class_pedagogy_v2' then array[
      'class.workspace.read',
      'task.publish',
      'plan.preview',
      'plan.publish',
      'help_queue.manage',
      'student_support.update',
      'student_progress.read',
      'task.return'
    ]::text[]
    else null
  end
$$;

revoke all on function public.expected_staff_assignment_capabilities(text)
from public, anon, authenticated, service_role;

-- Capability profile v2 is an explicit schema upgrade. Runtime mutations keep
-- assignment identity/profile immutable; only this migration rewrites v1 rows.
alter table public.staff_assignments
  drop constraint staff_assignments_profile_version,
  drop constraint staff_assignments_version;
alter table public.staff_assignment_capabilities
  drop constraint staff_assignment_capabilities_profile;

alter table public.staff_assignments
  disable trigger staff_assignments_validate;
alter table public.staff_assignment_capabilities
  disable trigger staff_assignment_capabilities_immutable;
alter table public.staff_assignment_capabilities
  disable trigger staff_assignment_capabilities_guard_insert;

update public.staff_assignment_capabilities
set profile_version = 'class_pedagogy_v2'
where profile_version = 'class_pedagogy_v1';

update public.staff_assignments
set profile_version = 'class_pedagogy_v2',
    version = 2
where profile_version = 'class_pedagogy_v1';

alter table public.staff_assignments
  enable trigger staff_assignments_validate;
alter table public.staff_assignment_capabilities
  enable trigger staff_assignment_capabilities_immutable;

alter table public.staff_assignments
  alter column profile_version set default 'class_pedagogy_v2',
  alter column version set default 2,
  add constraint staff_assignments_id_profile_version_key
    unique (id, profile_version),
  add constraint staff_assignments_id_organization_user_key
    unique (id, organization_id, user_id),
  add constraint staff_assignments_profile_version check (
    profile_version in ('class_pedagogy_v1', 'class_pedagogy_v2')
  ),
  add constraint staff_assignments_version check (
    (profile_version = 'class_pedagogy_v1' and version = 1)
    or (profile_version = 'class_pedagogy_v2' and version = 2)
  );

alter table public.staff_assignment_capabilities
  alter column profile_version set default 'class_pedagogy_v2',
  add constraint staff_assignment_capabilities_assignment_profile_fk
    foreign key (assignment_id, profile_version)
    references public.staff_assignments (id, profile_version)
    on delete cascade,
  add constraint staff_assignment_capabilities_profile check (
    profile_version in ('class_pedagogy_v1', 'class_pedagogy_v2')
  );

insert into public.staff_assignment_capabilities (
  assignment_id,
  capability,
  profile_version
)
select
  assignment.id,
  capability.capability,
  'class_pedagogy_v2'
from public.staff_assignments as assignment
cross join unnest(array[
  'student_progress.read',
  'task.return'
]::public.staff_capability[]) as capability(capability)
where assignment.profile_version = 'class_pedagogy_v2'
on conflict (assignment_id, capability) do nothing;

alter table public.staff_assignment_capabilities
  enable trigger staff_assignment_capabilities_guard_insert;

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
  'staff_assignment.profile_upgraded',
  'staff_assignment',
  assignment.id,
  jsonb_build_object(
    'from_profile_version', 'class_pedagogy_v1',
    'to_profile_version', 'class_pedagogy_v2'
  )
from public.staff_assignments as assignment
where assignment.profile_version = 'class_pedagogy_v2';

create function public.extend_staff_capability_profile_v2()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.profile_version = 'class_pedagogy_v2'
    and new.capability not in (
      'student_progress.read',
      'task.return'
    )
    and exists (
      select 1
      from unnest(array[
        'student_progress.read',
        'task.return'
      ]::public.staff_capability[]) as required(capability)
      where not exists (
        select 1
        from public.staff_assignment_capabilities as existing
        where existing.assignment_id = new.assignment_id
          and existing.capability = required.capability
      )
    )
  then
    insert into public.staff_assignment_capabilities (
      assignment_id,
      capability,
      profile_version
    ) values
      (new.assignment_id, 'student_progress.read', 'class_pedagogy_v2'),
      (new.assignment_id, 'task.return', 'class_pedagogy_v2')
    on conflict (assignment_id, capability) do nothing;
  end if;
  return new;
end;
$$;

create trigger staff_capability_profile_v2_extend
after insert on public.staff_assignment_capabilities
for each row execute function public.extend_staff_capability_profile_v2();

create function public.normalize_staff_assignment_audit_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actual_profile_version text;
begin
  if new.event_name = 'staff_assignment.created'
    and new.entity_type = 'staff_assignment'
    and new.entity_id is not null
  then
    select assignment.profile_version
    into actual_profile_version
    from public.staff_assignments as assignment
    where assignment.id = new.entity_id
      and assignment.organization_id = new.organization_id;

    if actual_profile_version is not null then
      new.metadata := jsonb_set(
        new.metadata,
        '{profile_version}',
        to_jsonb(actual_profile_version),
        true
      );
    end if;
  end if;
  return new;
end;
$$;

create trigger audit_events_normalize_staff_profile
before insert on public.audit_events
for each row execute function public.normalize_staff_assignment_audit_profile();

-- Replace the legacy generic status setter and status vocabulary.
drop function public.update_student_task_status(
  uuid,
  uuid,
  public.student_task_status
);

alter table public.student_task_state
  drop constraint student_task_state_started_at,
  drop constraint student_task_state_completed_at;

create type public.student_task_status_v2 as enum (
  'assigned',
  'completed',
  'reopened'
);

alter table public.student_task_state
  alter column status drop default,
  alter column status type public.student_task_status_v2
  using (
    case status::text
      when 'completed' then 'completed'
      else 'assigned'
    end
  )::public.student_task_status_v2;

drop type public.student_task_status;
alter type public.student_task_status_v2 rename to student_task_status;

alter table public.student_task_state
  alter column status set default 'assigned',
  drop column started_at,
  add column state_version integer not null default 1,
  add column completion_sequence bigint not null default 0,
  add column reopened_at timestamptz,
  add column active_completion_attempt_id uuid,
  add column last_transition_id uuid;

update public.student_task_state
set completed_at = null
where status = 'assigned';

alter table public.task_definitions
  add column points_value integer not null default 10,
  add constraint task_definitions_points_value
    check (points_value between 1 and 10000);

alter table public.task_assignments
  add column points_value_snapshot integer;

update public.task_assignments as assignment
set points_value_snapshot = task.points_value
from public.task_definitions as task
where task.id = assignment.task_definition_id;

alter table public.task_assignments
  alter column points_value_snapshot set not null,
  add constraint task_assignments_points_snapshot
    check (points_value_snapshot between 1 and 10000),
  add constraint task_assignments_id_class_organization_student_key
    unique (id, class_id, organization_id, student_id),
  drop constraint task_assignments_task_definition_id_student_id_key;

do $$
begin
  if exists (
    select 1
    from public.task_assignments as assignment
    left join public.class_memberships as class_membership
      on class_membership.class_id = assignment.class_id
      and class_membership.organization_id = assignment.organization_id
      and class_membership.user_id = assignment.student_id
      and class_membership.role = 'student'
    left join public.memberships as membership
      on membership.organization_id = assignment.organization_id
      and membership.user_id = assignment.student_id
      and membership.role = 'student'
    where class_membership.user_id is null
      or membership.user_id is null
  ) then
    raise exception 'Existing task assignments require current student memberships';
  end if;
end;
$$;

alter table public.task_assignments
  drop constraint task_assignments_class_id_organization_id_student_id_fkey;

create function public.has_current_student_membership(
  p_organization_id uuid,
  p_class_id uuid,
  p_student_id uuid
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships as membership
    join public.class_memberships as class_membership
      on class_membership.organization_id = membership.organization_id
      and class_membership.user_id = membership.user_id
      and class_membership.class_id = p_class_id
      and class_membership.role = 'student'
    where membership.organization_id = p_organization_id
      and membership.user_id = p_student_id
      and membership.role = 'student'
  );
$$;

create function public.enforce_task_assignment_student_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_current_student_membership(
    new.organization_id,
    new.class_id,
    new.student_id
  ) then
    raise exception 'Task assignments require a current student membership';
  end if;

  return new;
end;
$$;

create trigger task_assignments_require_current_student_membership
before insert or update of organization_id, class_id, student_id
on public.task_assignments
for each row execute function public.enforce_task_assignment_student_membership();

create index task_assignments_definition_student_idx
  on public.task_assignments (task_definition_id, student_id);

create type public.task_progress_command as enum (
  'complete',
  'undo',
  'reopen',
  'legacy_backfill'
);

create type public.task_reopen_reason as enum (
  'continue_working',
  'completed_by_mistake',
  'needs_review',
  'other'
);

create type public.xp_ledger_kind as enum ('credit', 'reversal');
create type public.reward_entitlement_status as enum (
  'pending',
  'available',
  'selected'
);

create table public.task_completion_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  class_id uuid not null,
  assignment_id uuid not null,
  student_id uuid not null,
  sequence integer not null,
  points_value_snapshot integer not null,
  request_id uuid not null,
  completed_by uuid not null references auth.users (id) on delete restrict,
  completed_at timestamptz not null default transaction_timestamp(),
  unique (assignment_id, sequence),
  unique (student_id, request_id),
  unique (id, assignment_id, organization_id, student_id),
  unique (id, assignment_id, class_id, organization_id, student_id),
  unique (id, organization_id, student_id),
  foreign key (assignment_id, class_id, organization_id, student_id)
    references public.task_assignments (
      id,
      class_id,
      organization_id,
      student_id
    )
    on delete restrict,
  constraint task_completion_attempts_completed_by_student
    check (completed_by = student_id),
  constraint task_completion_attempts_sequence check (sequence >= 1),
  constraint task_completion_attempts_points check (
    points_value_snapshot between 1 and 10000
  )
);

create table public.task_state_transitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  class_id uuid not null,
  assignment_id uuid not null,
  student_id uuid not null,
  from_status public.student_task_status not null,
  to_status public.student_task_status not null,
  command public.task_progress_command not null,
  completion_attempt_id uuid not null,
  request_id uuid not null,
  actor_id uuid not null references auth.users (id) on delete restrict,
  staff_assignment_id uuid,
  reason_code public.task_reopen_reason,
  student_message text,
  occurred_at timestamptz not null default transaction_timestamp(),
  unique (actor_id, request_id),
  unique (id, assignment_id, organization_id, student_id),
  foreign key (assignment_id, class_id, organization_id, student_id)
    references public.task_assignments (
      id,
      class_id,
      organization_id,
      student_id
    )
    on delete restrict,
  foreign key (
    completion_attempt_id,
    assignment_id,
    class_id,
    organization_id,
    student_id
  ) references public.task_completion_attempts (
    id,
    assignment_id,
    class_id,
    organization_id,
    student_id
  ) on delete restrict,
  foreign key (staff_assignment_id, organization_id, actor_id)
    references public.staff_assignments (id, organization_id, user_id)
    on delete restrict,
  constraint task_state_transitions_changed check (from_status <> to_status),
  constraint task_state_transitions_command_shape check (
    (
      command = 'complete'
      and from_status in ('assigned', 'reopened')
      and to_status = 'completed'
      and actor_id = student_id
    )
    or (
      command = 'undo'
      and from_status = 'completed'
      and to_status = 'assigned'
      and actor_id = student_id
    )
    or (
      command = 'reopen'
      and from_status = 'completed'
      and to_status = 'reopened'
      and actor_id is not null
    )
    or (
      command = 'legacy_backfill'
      and from_status = 'assigned'
      and to_status = 'completed'
      and actor_id = student_id
    )
  ),
  constraint task_state_transitions_staff_pair check (
    (command = 'reopen' and staff_assignment_id is not null)
    or (command <> 'reopen' and staff_assignment_id is null)
  ),
  constraint task_state_transitions_reason check (
    (
      command = 'reopen'
      and reason_code is not null
      and (
        reason_code <> 'other'
        or nullif(btrim(student_message), '') is not null
      )
    )
    or (command <> 'reopen' and reason_code is null and student_message is null)
  ),
  constraint task_state_transitions_message_length check (
    student_message is null or char_length(student_message) between 1 and 240
  )
);

create table public.student_xp_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  class_id uuid not null,
  student_id uuid not null,
  assignment_id uuid not null,
  completion_attempt_id uuid not null,
  entry_kind public.xp_ledger_kind not null,
  points_delta integer not null,
  reverses_entry_id uuid,
  request_id uuid not null,
  actor_id uuid not null references auth.users (id) on delete restrict,
  occurred_at timestamptz not null default transaction_timestamp(),
  unique (completion_attempt_id, entry_kind),
  unique (reverses_entry_id),
  foreign key (
    completion_attempt_id,
    assignment_id,
    class_id,
    organization_id,
    student_id
  )
    references public.task_completion_attempts (
      id,
      assignment_id,
      class_id,
      organization_id,
      student_id
    ) on delete restrict,
  foreign key (reverses_entry_id)
    references public.student_xp_ledger (id) on delete restrict,
  constraint student_xp_ledger_points_nonzero check (points_delta <> 0),
  constraint student_xp_ledger_shape check (
    (entry_kind = 'credit' and points_delta > 0 and reverses_entry_id is null)
    or (entry_kind = 'reversal' and points_delta < 0 and reverses_entry_id is not null)
  )
);

create table public.student_progress (
  organization_id uuid not null,
  student_id uuid not null,
  xp_balance bigint not null default 0,
  current_level bigint not null default 1,
  highest_level bigint not null default 1,
  scheme_version text not null default 'linear_1000_v1',
  updated_at timestamptz not null default transaction_timestamp(),
  primary key (organization_id, student_id),
  foreign key (organization_id, student_id)
    references public.memberships (organization_id, user_id) on delete restrict,
  constraint student_progress_balance check (xp_balance >= 0),
  constraint student_progress_levels check (
    current_level >= 1 and highest_level >= current_level
  ),
  constraint student_progress_scheme check (scheme_version = 'linear_1000_v1')
);

create table public.level_milestones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  student_id uuid not null,
  level bigint not null,
  first_completion_attempt_id uuid not null,
  first_reached_at timestamptz not null default transaction_timestamp(),
  unique (organization_id, student_id, level),
  unique (id, organization_id, student_id, level),
  foreign key (first_completion_attempt_id, organization_id, student_id)
    references public.task_completion_attempts (id, organization_id, student_id)
    on delete restrict,
  foreign key (organization_id, student_id)
    references public.memberships (organization_id, user_id) on delete restrict,
  constraint level_milestones_level check (level >= 2)
);

create table public.level_reward_entitlements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  student_id uuid not null,
  level bigint not null,
  milestone_id uuid not null unique,
  status public.reward_entitlement_status not null,
  available_at timestamptz,
  selected_at timestamptz,
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  unique (organization_id, student_id, level),
  unique (id, organization_id, student_id),
  foreign key (milestone_id, organization_id, student_id, level)
    references public.level_milestones (id, organization_id, student_id, level)
    on delete restrict,
  foreign key (organization_id, student_id)
    references public.memberships (organization_id, user_id) on delete restrict,
  constraint level_reward_entitlements_level check (level >= 2),
  constraint level_reward_entitlements_status_fields check (
    (status = 'pending' and selected_at is null)
    or (status = 'available' and available_at is not null and selected_at is null)
    or (status = 'selected' and available_at is not null and selected_at is not null)
  )
);

create table public.progress_command_receipts (
  organization_id uuid not null,
  class_id uuid not null,
  assignment_id uuid not null,
  student_id uuid not null,
  actor_id uuid not null references auth.users (id) on delete restrict,
  request_id uuid not null,
  command public.task_progress_command not null,
  request_fingerprint text not null,
  result jsonb not null,
  created_at timestamptz not null default transaction_timestamp(),
  completed_at timestamptz not null default transaction_timestamp(),
  primary key (actor_id, request_id),
  foreign key (assignment_id, class_id, organization_id, student_id)
    references public.task_assignments (
      id,
      class_id,
      organization_id,
      student_id
    ) on delete restrict,
  constraint progress_command_receipts_fingerprint
    check (request_fingerprint ~ '^[0-9a-f]{32}$'),
  constraint progress_command_receipts_runtime_command
    check (command <> 'legacy_backfill'),
  constraint progress_command_receipts_completed_after_created
    check (completed_at >= created_at),
  constraint progress_command_receipts_result check (
    jsonb_typeof(result) = 'object'
    and pg_column_size(result) <= 8192
  )
);

alter table public.student_task_state
  add constraint student_task_state_active_attempt_fk
    foreign key (
      active_completion_attempt_id,
      assignment_id,
      organization_id,
      student_id
    ) references public.task_completion_attempts (
      id,
      assignment_id,
      organization_id,
      student_id
    ) on delete restrict,
  add constraint student_task_state_last_transition_fk
    foreign key (
      last_transition_id,
      assignment_id,
      organization_id,
      student_id
    ) references public.task_state_transitions (
      id,
      assignment_id,
      organization_id,
      student_id
    ) on delete restrict;

create index task_completion_attempts_student_idx
  on public.task_completion_attempts (student_id, completed_at desc);
create index task_state_transitions_student_idx
  on public.task_state_transitions (student_id, occurred_at desc);
create index student_xp_ledger_student_idx
  on public.student_xp_ledger (student_id, occurred_at, id);
create index level_reward_entitlements_student_status_idx
  on public.level_reward_entitlements (student_id, status, level);

create function public.progress_level_for_xp(
  p_xp_balance bigint,
  p_scheme_version text default 'linear_1000_v1'
)
returns bigint
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_xp_balance is null or p_xp_balance < 0 then
    raise exception 'XP balance cannot be negative';
  end if;
  if p_scheme_version <> 'linear_1000_v1' then
    raise exception 'Unsupported progress scheme';
  end if;
  return 1 + (p_xp_balance / 1000);
end;
$$;

create function public.set_task_assignment_points_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  definition_points integer;
begin
  if tg_op = 'UPDATE' then
    if new.task_definition_id is distinct from old.task_definition_id
      or new.class_id is distinct from old.class_id
      or new.organization_id is distinct from old.organization_id
      or new.student_id is distinct from old.student_id
      or new.assigned_by is distinct from old.assigned_by
      or new.points_value_snapshot is distinct from old.points_value_snapshot
    then
      raise exception 'Task assignment identity and points snapshot are immutable';
    end if;
    return new;
  end if;

  select task.points_value
  into definition_points
  from public.task_definitions as task
  where task.id = new.task_definition_id
    and task.class_id = new.class_id
    and task.organization_id = new.organization_id;

  if definition_points is null then
    raise exception 'Task definition points are unavailable';
  end if;
  new.points_value_snapshot := definition_points;
  return new;
end;
$$;

create trigger task_assignments_points_snapshot
before insert or update on public.task_assignments
for each row execute function public.set_task_assignment_points_snapshot();

create function public.prevent_progress_history_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Progress history is append-only';
end;
$$;

create trigger task_completion_attempts_immutable
before update or delete on public.task_completion_attempts
for each row execute function public.prevent_progress_history_mutation();
create trigger task_state_transitions_immutable
before update or delete on public.task_state_transitions
for each row execute function public.prevent_progress_history_mutation();
create trigger student_xp_ledger_immutable
before update or delete on public.student_xp_ledger
for each row execute function public.prevent_progress_history_mutation();
create trigger level_milestones_immutable
before update or delete on public.level_milestones
for each row execute function public.prevent_progress_history_mutation();
create trigger progress_command_receipts_immutable
before update or delete on public.progress_command_receipts
for each row execute function public.prevent_progress_history_mutation();

create function public.validate_xp_ledger_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  credited public.student_xp_ledger;
  attempt public.task_completion_attempts;
begin
  if new.entry_kind = 'credit' then
    select completion.*
    into attempt
    from public.task_completion_attempts as completion
    where completion.id = new.completion_attempt_id
      and completion.assignment_id = new.assignment_id
      and completion.class_id = new.class_id
      and completion.organization_id = new.organization_id
      and completion.student_id = new.student_id
    for share;

    if attempt.id is null
      or new.points_delta <> attempt.points_value_snapshot
      or new.request_id <> attempt.request_id
      or new.actor_id <> attempt.completed_by
      or new.reverses_entry_id is not null
    then
      raise exception 'XP credit must exactly match its completion attempt';
    end if;
    return new;
  end if;

  select ledger.*
  into credited
  from public.student_xp_ledger as ledger
  where ledger.id = new.reverses_entry_id
    and ledger.entry_kind = 'credit'
  for share;

  if credited.id is null
    or credited.organization_id <> new.organization_id
    or credited.class_id <> new.class_id
    or credited.student_id <> new.student_id
    or credited.assignment_id <> new.assignment_id
    or credited.completion_attempt_id <> new.completion_attempt_id
    or new.points_delta <> -credited.points_delta
  then
    raise exception 'XP reversal must exactly compensate its credit';
  end if;
  return new;
end;
$$;

create trigger student_xp_ledger_validate
before insert on public.student_xp_ledger
for each row execute function public.validate_xp_ledger_entry();

-- Deterministic upgrade of existing completed prototype tasks.
insert into public.task_completion_attempts (
  id,
  organization_id,
  class_id,
  assignment_id,
  student_id,
  sequence,
  points_value_snapshot,
  request_id,
  completed_by,
  completed_at
)
select
  overlay(
    overlay(md5('b1-attempt:' || state.assignment_id::text) placing '5' from 13 for 1)
    placing '8' from 17 for 1
  )::uuid,
  state.organization_id,
  assignment.class_id,
  state.assignment_id,
  state.student_id,
  1,
  assignment.points_value_snapshot,
  overlay(
    overlay(md5('b1-request:' || state.assignment_id::text) placing '5' from 13 for 1)
    placing '8' from 17 for 1
  )::uuid,
  state.student_id,
  coalesce(state.completed_at, state.updated_at, state.created_at)
from public.student_task_state as state
join public.task_assignments as assignment on assignment.id = state.assignment_id
where state.status = 'completed';

insert into public.task_state_transitions (
  id,
  organization_id,
  class_id,
  assignment_id,
  student_id,
  from_status,
  to_status,
  command,
  completion_attempt_id,
  request_id,
  actor_id,
  occurred_at
)
select
  overlay(
    overlay(md5('b1-transition:' || state.assignment_id::text) placing '5' from 13 for 1)
    placing '8' from 17 for 1
  )::uuid,
  state.organization_id,
  assignment.class_id,
  state.assignment_id,
  state.student_id,
  'assigned',
  'completed',
  'legacy_backfill',
  attempt.id,
  attempt.request_id,
  state.student_id,
  attempt.completed_at
from public.student_task_state as state
join public.task_assignments as assignment on assignment.id = state.assignment_id
join public.task_completion_attempts as attempt
  on attempt.assignment_id = state.assignment_id
  and attempt.sequence = 1
where state.status = 'completed';

insert into public.student_xp_ledger (
  id,
  organization_id,
  class_id,
  student_id,
  assignment_id,
  completion_attempt_id,
  entry_kind,
  points_delta,
  request_id,
  actor_id,
  occurred_at
)
select
  overlay(
    overlay(md5('b1-credit:' || state.assignment_id::text) placing '5' from 13 for 1)
    placing '8' from 17 for 1
  )::uuid,
  state.organization_id,
  assignment.class_id,
  state.student_id,
  state.assignment_id,
  attempt.id,
  'credit',
  attempt.points_value_snapshot,
  attempt.request_id,
  state.student_id,
  attempt.completed_at
from public.student_task_state as state
join public.task_assignments as assignment on assignment.id = state.assignment_id
join public.task_completion_attempts as attempt
  on attempt.assignment_id = state.assignment_id
  and attempt.sequence = 1
where state.status = 'completed';

update public.student_task_state as state
set
  active_completion_attempt_id = attempt.id,
  last_transition_id = transition.id,
  completion_sequence = 1,
  state_version = 2
from public.task_completion_attempts as attempt
join public.task_state_transitions as transition
  on transition.assignment_id = attempt.assignment_id
  and transition.command = 'legacy_backfill'
where state.assignment_id = attempt.assignment_id
  and state.status = 'completed';

insert into public.student_progress (
  organization_id,
  student_id,
  xp_balance,
  current_level,
  highest_level
)
select
  assignment.organization_id,
  assignment.student_id,
  coalesce(sum(ledger.points_delta), 0)::bigint,
  public.progress_level_for_xp(coalesce(sum(ledger.points_delta), 0)::bigint),
  public.progress_level_for_xp(coalesce(sum(ledger.points_delta), 0)::bigint)
from public.task_assignments as assignment
left join public.student_xp_ledger as ledger
  on ledger.assignment_id = assignment.id
group by assignment.organization_id, assignment.student_id
on conflict (organization_id, student_id) do nothing;

with credit_balance as (
  select
    ledger.*,
    coalesce(
      sum(ledger.points_delta) over (
        partition by ledger.organization_id, ledger.student_id
        order by ledger.occurred_at, ledger.id
        rows between unbounded preceding and 1 preceding
      ),
      0
    )::bigint as previous_balance,
    sum(ledger.points_delta) over (
      partition by ledger.organization_id, ledger.student_id
      order by ledger.occurred_at, ledger.id
      rows between unbounded preceding and current row
    )::bigint as current_balance
  from public.student_xp_ledger as ledger
  where ledger.entry_kind = 'credit'
), crossed_levels as (
  select
    credit.organization_id,
    credit.student_id,
    credit.completion_attempt_id,
    credit.occurred_at,
    level.level
  from credit_balance as credit
  cross join lateral generate_series(
    public.progress_level_for_xp(credit.previous_balance) + 1,
    public.progress_level_for_xp(credit.current_balance)
  ) as level(level)
)
insert into public.level_milestones (
  organization_id,
  student_id,
  level,
  first_completion_attempt_id,
  first_reached_at
)
select
  crossed.organization_id,
  crossed.student_id,
  crossed.level,
  crossed.completion_attempt_id,
  crossed.occurred_at
from crossed_levels as crossed
on conflict (organization_id, student_id, level) do nothing;

insert into public.level_reward_entitlements (
  organization_id,
  student_id,
  level,
  milestone_id,
  status,
  available_at
)
select
  milestone.organization_id,
  milestone.student_id,
  milestone.level,
  milestone.id,
  'available',
  milestone.first_reached_at
from public.level_milestones as milestone
on conflict (organization_id, student_id, level) do nothing;

insert into public.audit_events (
  organization_id,
  actor_id,
  event_name,
  entity_type,
  entity_id,
  metadata,
  occurred_at
)
select
  state.organization_id,
  null,
  'task.progress_backfilled',
  'task_assignment',
  state.assignment_id,
  jsonb_build_object(
    'class_id', assignment.class_id,
    'completion_attempt_id', state.active_completion_attempt_id,
    'request_id', attempt.request_id,
    'ledger_entry_id', ledger.id,
    'points_delta', assignment.points_value_snapshot,
    'completed_at', state.completed_at,
    'scheme_version', 'linear_1000_v1'
  ),
  transaction_timestamp()
from public.student_task_state as state
join public.task_assignments as assignment on assignment.id = state.assignment_id
join public.task_completion_attempts as attempt
  on attempt.id = state.active_completion_attempt_id
join public.student_xp_ledger as ledger
  on ledger.completion_attempt_id = attempt.id
  and ledger.entry_kind = 'credit'
where state.status = 'completed';

alter table public.student_task_state
  add constraint student_task_state_version check (state_version >= 1),
  add constraint student_task_state_sequence check (completion_sequence >= 0),
  add constraint student_task_state_shape check (
    (
      status = 'assigned'
      and completed_at is null
      and reopened_at is null
      and active_completion_attempt_id is null
    )
    or (
      status = 'completed'
      and completion_sequence >= 1
      and completed_at is not null
      and reopened_at is null
      and active_completion_attempt_id is not null
      and last_transition_id is not null
    )
    or (
      status = 'reopened'
      and completion_sequence >= 1
      and completed_at is null
      and reopened_at is not null
      and active_completion_attempt_id is null
      and last_transition_id is not null
    )
  );

create function public.apply_task_progress_command(
  p_assignment_id uuid,
  p_actor_id uuid,
  p_request_id uuid,
  p_command public.task_progress_command,
  p_staff_assignment_id uuid default null,
  p_reason_code public.task_reopen_reason default null,
  p_student_message text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target record;
  task_state_record public.student_task_state%rowtype;
  progress_record public.student_progress%rowtype;
  receipt_record public.progress_command_receipts%rowtype;
  credit_record public.student_xp_ledger%rowtype;
  authorization_at timestamptz := transaction_timestamp();
  operation_at timestamptz;
  normalized_message text := nullif(trim(p_student_message), '');
  fingerprint text;
  authorized_organization_id uuid;
  transition_id uuid;
  completion_attempt_id uuid;
  ledger_entry_id uuid;
  xp_delta integer := 0;
  ledger_balance bigint;
  next_balance bigint;
  next_level bigint;
  new_milestone_levels bigint[] := array[]::bigint[];
  reactivated_levels bigint[] := array[]::bigint[];
  pending_levels bigint[] := array[]::bigint[];
  changed boolean := false;
  result_payload jsonb;
begin
  if p_assignment_id is null or p_actor_id is null or p_request_id is null then
    raise exception 'Assignment, actor and request are required';
  end if;

  if p_command not in ('complete', 'undo', 'reopen') then
    raise exception 'Unsupported progress command';
  end if;

  if normalized_message is not null and char_length(normalized_message) > 240 then
    raise exception 'Student message must contain at most 240 characters';
  end if;

  if p_command = 'reopen' then
    if p_staff_assignment_id is null or p_reason_code is null then
      raise exception 'Staff assignment and reason are required for reopening';
    end if;
    if p_reason_code = 'other' and normalized_message is null then
      raise exception 'A short explanation is required for the other reason';
    end if;
  elsif p_staff_assignment_id is not null
    or p_reason_code is not null
    or normalized_message is not null
  then
    raise exception 'Staff-only fields are not accepted for this command';
  end if;

  select
    assignment.id,
    assignment.organization_id,
    assignment.class_id,
    assignment.student_id,
    assignment.points_value_snapshot,
    assignment.visible_from,
    task.publication_status
  into target
  from public.task_assignments as assignment
  join public.task_definitions as task
    on task.id = assignment.task_definition_id
    and task.class_id = assignment.class_id
    and task.organization_id = assignment.organization_id
  where assignment.id = p_assignment_id
  for share of assignment, task;

  if target.id is null then
    raise exception 'Task assignment is unavailable';
  end if;

  if p_command in ('complete', 'undo')
    and target.student_id <> p_actor_id
  then
    raise exception 'Students can only update their own task assignment';
  end if;

  perform membership.user_id
  from public.memberships as membership
  join public.class_memberships as class_membership
    on class_membership.organization_id = membership.organization_id
    and class_membership.user_id = membership.user_id
    and class_membership.class_id = target.class_id
    and class_membership.role = 'student'
  where membership.organization_id = target.organization_id
    and membership.user_id = target.student_id
    and membership.role = 'student'
  for share of membership, class_membership;

  if not found then
    raise exception 'Student membership is unavailable';
  end if;

  if p_command in ('complete', 'undo') then
    if p_command = 'complete'
      and (
        target.visible_from > authorization_at
        or target.publication_status <> 'published'
      )
    then
      raise exception 'Task assignment is not available for completion';
    end if;
  else
    authorized_organization_id := public.lock_staff_assignment_authorization(
      p_staff_assignment_id,
      p_actor_id,
      target.class_id,
      'task.return'
    );
    if authorized_organization_id is null
      or authorized_organization_id <> target.organization_id
    then
      raise exception 'Staff assignment does not authorize task reopening';
    end if;
  end if;

  fingerprint := md5(jsonb_build_object(
    'assignment_id', p_assignment_id,
    'actor_id', p_actor_id,
    'command', p_command,
    'staff_assignment_id', p_staff_assignment_id,
    'reason_code', p_reason_code,
    'student_message', normalized_message
  )::text);

  perform pg_advisory_xact_lock(hashtextextended(
    target.organization_id::text || ':' || p_actor_id::text || ':' || p_request_id::text,
    0
  ));

  select receipt.*
  into receipt_record
  from public.progress_command_receipts as receipt
  where receipt.actor_id = p_actor_id
    and receipt.request_id = p_request_id;

  if found then
    if receipt_record.request_fingerprint <> fingerprint then
      raise exception 'Request ID was already used with another payload';
    end if;
    return receipt_record.result;
  end if;

  select state.*
  into task_state_record
  from public.student_task_state as state
  where state.assignment_id = target.id
    and state.organization_id = target.organization_id
    and state.student_id = target.student_id
  for update;

  if task_state_record.assignment_id is null then
    raise exception 'Task state is unavailable';
  end if;

  insert into public.student_progress (
    organization_id,
    student_id
  ) values (
    target.organization_id,
    target.student_id
  )
  on conflict (organization_id, student_id) do nothing;

  select progress.*
  into progress_record
  from public.student_progress as progress
  where progress.organization_id = target.organization_id
    and progress.student_id = target.student_id
  for update;

  select coalesce(sum(ledger.points_delta), 0)::bigint
  into ledger_balance
  from public.student_xp_ledger as ledger
  where ledger.organization_id = target.organization_id
    and ledger.student_id = target.student_id;

  if progress_record.xp_balance <> ledger_balance
    or progress_record.current_level <> public.progress_level_for_xp(ledger_balance)
  then
    raise exception 'Student progress is inconsistent with the XP ledger';
  end if;

  -- The event clock starts only after the per-assignment and per-student locks.
  -- This keeps ledger order monotonic when two assignments complete concurrently.
  operation_at := clock_timestamp();

  if p_command = 'complete' and task_state_record.status <> 'completed' then
    changed := true;
    completion_attempt_id := gen_random_uuid();
    transition_id := gen_random_uuid();
    ledger_entry_id := gen_random_uuid();
    xp_delta := target.points_value_snapshot;
    next_balance := progress_record.xp_balance + xp_delta;
    next_level := public.progress_level_for_xp(
      next_balance,
      progress_record.scheme_version
    );

    insert into public.task_completion_attempts (
      id,
      organization_id,
      class_id,
      assignment_id,
      student_id,
      sequence,
      points_value_snapshot,
      request_id,
      completed_by,
      completed_at
    ) values (
      completion_attempt_id,
      target.organization_id,
      target.class_id,
      target.id,
      target.student_id,
      task_state_record.completion_sequence + 1,
      target.points_value_snapshot,
      p_request_id,
      p_actor_id,
      operation_at
    );

    insert into public.task_state_transitions (
      id,
      organization_id,
      class_id,
      assignment_id,
      student_id,
      from_status,
      to_status,
      command,
      completion_attempt_id,
      request_id,
      actor_id,
      occurred_at
    ) values (
      transition_id,
      target.organization_id,
      target.class_id,
      target.id,
      target.student_id,
      task_state_record.status,
      'completed',
      'complete',
      completion_attempt_id,
      p_request_id,
      p_actor_id,
      operation_at
    );

    insert into public.student_xp_ledger (
      id,
      organization_id,
      class_id,
      student_id,
      assignment_id,
      completion_attempt_id,
      entry_kind,
      points_delta,
      request_id,
      actor_id,
      occurred_at
    ) values (
      ledger_entry_id,
      target.organization_id,
      target.class_id,
      target.student_id,
      target.id,
      completion_attempt_id,
      'credit',
      xp_delta,
      p_request_id,
      p_actor_id,
      operation_at
    );

    update public.student_progress as progress
    set
      xp_balance = next_balance,
      current_level = next_level,
      highest_level = greatest(progress.highest_level, next_level),
      updated_at = operation_at
    where progress.organization_id = target.organization_id
      and progress.student_id = target.student_id;

    with inserted_milestones as (
      insert into public.level_milestones (
        organization_id,
        student_id,
        level,
        first_completion_attempt_id,
        first_reached_at
      )
      select
        target.organization_id,
        target.student_id,
        level.level,
        completion_attempt_id,
        operation_at
      from generate_series(
        progress_record.highest_level + 1,
        next_level
      ) as level(level)
      on conflict (organization_id, student_id, level) do nothing
      returning id, organization_id, student_id, level
    ), inserted_entitlements as (
      insert into public.level_reward_entitlements (
        organization_id,
        student_id,
        level,
        milestone_id,
        status,
        available_at,
        created_at,
        updated_at
      )
      select
        milestone.organization_id,
        milestone.student_id,
        milestone.level,
        milestone.id,
        'available',
        operation_at,
        operation_at,
        operation_at
      from inserted_milestones as milestone
      on conflict (organization_id, student_id, level) do nothing
      returning level
    )
    select coalesce(
      array_agg(milestone.level order by milestone.level),
      array[]::bigint[]
    )
    into new_milestone_levels
    from inserted_milestones as milestone;

    with reactivated as (
      update public.level_reward_entitlements as entitlement
      set
        status = 'available',
        available_at = coalesce(entitlement.available_at, operation_at),
        updated_at = operation_at
      where entitlement.organization_id = target.organization_id
        and entitlement.student_id = target.student_id
        and entitlement.status = 'pending'
        and entitlement.level <= next_level
      returning entitlement.level
    )
    select coalesce(
      array_agg(reactivated.level order by reactivated.level),
      array[]::bigint[]
    )
    into reactivated_levels
    from reactivated;

    update public.student_task_state as state
    set
      status = 'completed',
      completed_at = operation_at,
      reopened_at = null,
      active_completion_attempt_id = completion_attempt_id,
      last_transition_id = transition_id,
      completion_sequence = task_state_record.completion_sequence + 1,
      state_version = task_state_record.state_version + 1,
      updated_at = operation_at
    where state.assignment_id = target.id;

    insert into public.audit_events (
      organization_id,
      actor_id,
      event_name,
      entity_type,
      entity_id,
      metadata,
      occurred_at
    ) values (
      target.organization_id,
      p_actor_id,
      'task.completed',
      'task_assignment',
      target.id,
      jsonb_build_object(
        'class_id', target.class_id,
        'from_status', task_state_record.status,
        'to_status', 'completed',
        'completion_attempt_id', completion_attempt_id,
        'ledger_entry_id', ledger_entry_id,
        'points_delta', xp_delta,
        'request_id', p_request_id,
        'state_version', task_state_record.state_version + 1,
        'scheme_version', progress_record.scheme_version
      ),
      operation_at
    );

    insert into public.audit_events (
      organization_id,
      actor_id,
      event_name,
      entity_type,
      entity_id,
      metadata,
      occurred_at
    )
    select
      milestone.organization_id,
      p_actor_id,
      'student.level_reached',
      'level_milestone',
      milestone.id,
      jsonb_build_object(
        'level', milestone.level,
        'completion_attempt_id', completion_attempt_id,
        'ledger_entry_id', ledger_entry_id
      ),
      operation_at
    from public.level_milestones as milestone
    where milestone.first_completion_attempt_id = completion_attempt_id;

    insert into public.audit_events (
      organization_id,
      actor_id,
      event_name,
      entity_type,
      entity_id,
      metadata,
      occurred_at
    )
    select
      entitlement.organization_id,
      p_actor_id,
      'reward.entitlement_created',
      'level_reward_entitlement',
      entitlement.id,
      jsonb_build_object(
        'level', entitlement.level,
        'milestone_id', entitlement.milestone_id,
        'completion_attempt_id', completion_attempt_id
      ),
      operation_at
    from public.level_reward_entitlements as entitlement
    join public.level_milestones as milestone
      on milestone.id = entitlement.milestone_id
    where milestone.first_completion_attempt_id = completion_attempt_id;
  elsif p_command in ('undo', 'reopen')
    and task_state_record.status = 'completed'
  then
    changed := true;
    completion_attempt_id := task_state_record.active_completion_attempt_id;
    transition_id := gen_random_uuid();
    ledger_entry_id := gen_random_uuid();

    select ledger.*
    into credit_record
    from public.student_xp_ledger as ledger
    where ledger.completion_attempt_id = task_state_record.active_completion_attempt_id
      and ledger.entry_kind = 'credit'
    for share;

    if credit_record.id is null or exists (
      select 1
      from public.student_xp_ledger as reversal
      where reversal.reverses_entry_id = credit_record.id
    ) then
      raise exception 'Active completion credit is unavailable for reversal';
    end if;

    xp_delta := -credit_record.points_delta;
    next_balance := progress_record.xp_balance + xp_delta;
    if next_balance < 0 then
      raise exception 'XP reversal cannot make the balance negative';
    end if;
    next_level := public.progress_level_for_xp(
      next_balance,
      progress_record.scheme_version
    );

    insert into public.task_state_transitions (
      id,
      organization_id,
      class_id,
      assignment_id,
      student_id,
      from_status,
      to_status,
      command,
      completion_attempt_id,
      request_id,
      actor_id,
      staff_assignment_id,
      reason_code,
      student_message,
      occurred_at
    ) values (
      transition_id,
      target.organization_id,
      target.class_id,
      target.id,
      target.student_id,
      'completed',
      case
        when p_command = 'undo' then 'assigned'::public.student_task_status
        else 'reopened'::public.student_task_status
      end,
      p_command,
      completion_attempt_id,
      p_request_id,
      p_actor_id,
      p_staff_assignment_id,
      p_reason_code,
      normalized_message,
      operation_at
    );

    insert into public.student_xp_ledger (
      id,
      organization_id,
      class_id,
      student_id,
      assignment_id,
      completion_attempt_id,
      entry_kind,
      points_delta,
      reverses_entry_id,
      request_id,
      actor_id,
      occurred_at
    ) values (
      ledger_entry_id,
      target.organization_id,
      target.class_id,
      target.student_id,
      target.id,
      completion_attempt_id,
      'reversal',
      xp_delta,
      credit_record.id,
      p_request_id,
      p_actor_id,
      operation_at
    );

    update public.student_progress as progress
    set
      xp_balance = next_balance,
      current_level = next_level,
      updated_at = operation_at
    where progress.organization_id = target.organization_id
      and progress.student_id = target.student_id;

    with paused as (
      update public.level_reward_entitlements as entitlement
      set
        status = 'pending',
        updated_at = operation_at
      where entitlement.organization_id = target.organization_id
        and entitlement.student_id = target.student_id
        and entitlement.status = 'available'
        and entitlement.level > next_level
      returning entitlement.level
    )
    select coalesce(
      array_agg(paused.level order by paused.level),
      array[]::bigint[]
    )
    into pending_levels
    from paused;

    update public.student_task_state as state
    set
      status = case
        when p_command = 'undo' then 'assigned'::public.student_task_status
        else 'reopened'::public.student_task_status
      end,
      completed_at = null,
      reopened_at = case when p_command = 'reopen' then operation_at else null end,
      active_completion_attempt_id = null,
      last_transition_id = transition_id,
      state_version = task_state_record.state_version + 1,
      updated_at = operation_at
    where state.assignment_id = target.id;

    insert into public.audit_events (
      organization_id,
      actor_id,
      event_name,
      entity_type,
      entity_id,
      metadata,
      occurred_at,
      authorizing_staff_assignment_id,
      authorizing_capability
    ) values (
      target.organization_id,
      p_actor_id,
      case
        when p_command = 'undo' then 'task.completion_undone'
        else 'task.reopened'
      end,
      'task_assignment',
      target.id,
      jsonb_strip_nulls(jsonb_build_object(
        'class_id', target.class_id,
        'from_status', 'completed',
        'to_status', case when p_command = 'undo' then 'assigned' else 'reopened' end,
        'completion_attempt_id', completion_attempt_id,
        'ledger_entry_id', ledger_entry_id,
        'reverses_entry_id', credit_record.id,
        'points_delta', xp_delta,
        'request_id', p_request_id,
        'reason_code', p_reason_code,
        'state_version', task_state_record.state_version + 1
      )),
      operation_at,
      case when p_command = 'reopen' then p_staff_assignment_id else null end,
      case
        when p_command = 'reopen' then 'task.return'::public.staff_capability
        else null
      end
    );
  else
    completion_attempt_id := task_state_record.active_completion_attempt_id;
  end if;

  select state.*
  into task_state_record
  from public.student_task_state as state
  where state.assignment_id = target.id;

  select progress.*
  into progress_record
  from public.student_progress as progress
  where progress.organization_id = target.organization_id
    and progress.student_id = target.student_id;

  select coalesce(sum(ledger.points_delta), 0)::bigint
  into ledger_balance
  from public.student_xp_ledger as ledger
  where ledger.organization_id = target.organization_id
    and ledger.student_id = target.student_id;

  if progress_record.xp_balance <> ledger_balance
    or progress_record.current_level <> public.progress_level_for_xp(
      ledger_balance,
      progress_record.scheme_version
    )
  then
    raise exception 'Progress transition did not reconcile with the XP ledger';
  end if;

  result_payload := jsonb_build_object(
    'request_id', p_request_id,
    'assignment_id', target.id,
    'status', task_state_record.status,
    'state_version', task_state_record.state_version,
    'changed', changed,
    'completion_attempt_id', completion_attempt_id,
    'ledger_entry_id', ledger_entry_id,
    'xp_delta', xp_delta,
    'xp_balance', progress_record.xp_balance,
    'current_level', progress_record.current_level,
    'highest_level', progress_record.highest_level,
    'scheme_version', progress_record.scheme_version,
    'new_milestone_levels', to_jsonb(new_milestone_levels),
    'reactivated_levels', to_jsonb(reactivated_levels),
    'pending_levels', to_jsonb(pending_levels)
  );

  insert into public.progress_command_receipts (
    organization_id,
    class_id,
    assignment_id,
    student_id,
    actor_id,
    request_id,
    command,
    request_fingerprint,
    result,
    created_at,
    completed_at
  ) values (
    target.organization_id,
    target.class_id,
    target.id,
    target.student_id,
    p_actor_id,
    p_request_id,
    p_command,
    fingerprint,
    result_payload,
    operation_at,
    operation_at
  );

  return result_payload;
end;
$$;

create function public.complete_student_task(
  p_assignment_id uuid,
  p_student_id uuid,
  p_request_id uuid
)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select public.apply_task_progress_command(
    p_assignment_id,
    p_student_id,
    p_request_id,
    'complete',
    null,
    null,
    null
  );
$$;

create function public.undo_student_task_completion(
  p_assignment_id uuid,
  p_student_id uuid,
  p_request_id uuid
)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select public.apply_task_progress_command(
    p_assignment_id,
    p_student_id,
    p_request_id,
    'undo',
    null,
    null,
    null
  );
$$;

create function public.reopen_student_task_for_staff(
  p_assignment_id uuid,
  p_actor_id uuid,
  p_staff_assignment_id uuid,
  p_request_id uuid,
  p_reason_code public.task_reopen_reason,
  p_student_message text default null
)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select public.apply_task_progress_command(
    p_assignment_id,
    p_actor_id,
    p_request_id,
    'reopen',
    p_staff_assignment_id,
    p_reason_code,
    p_student_message
  );
$$;

create function public.can_read_task_progress_resource(
  p_organization_id uuid,
  p_class_id uuid,
  p_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
    (
      p_student_id = auth.uid()
      and public.has_current_student_membership(
        p_organization_id,
        p_class_id,
        p_student_id
      )
    )
    or (
      exists (
        select 1
        from public.class_memberships as target
        where target.organization_id = p_organization_id
          and target.class_id = p_class_id
          and target.user_id = p_student_id
          and target.role = 'student'
      )
      and public.has_active_staff_capability(
        p_class_id,
        'student_progress.read'
      )
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
            and assignment.organization_id = task.organization_id
            and assignment.class_id = task.class_id
            and assignment.student_id = auth.uid()
            and assignment.visible_from <= transaction_timestamp()
            and task.publication_status = 'published'
            and public.has_current_student_membership(
              assignment.organization_id,
              assignment.class_id,
              assignment.student_id
            )
        )
      )
  );
$$;

create function public.can_read_student_progress_identity(
  p_organization_id uuid,
  p_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships as membership
    where membership.organization_id = p_organization_id
      and membership.user_id = auth.uid()
      and membership.user_id = p_student_id
      and membership.role = 'student'
  );
$$;

alter table public.task_completion_attempts enable row level security;
alter table public.task_state_transitions enable row level security;
alter table public.student_xp_ledger enable row level security;
alter table public.student_progress enable row level security;
alter table public.level_milestones enable row level security;
alter table public.level_reward_entitlements enable row level security;
alter table public.progress_command_receipts enable row level security;

drop policy task_definitions_select_authorized
on public.task_definitions;

create policy task_definitions_select_authorized
on public.task_definitions
for select
to authenticated
using (public.can_view_task_definition(id));

drop policy task_assignments_select_authorized
on public.task_assignments;

create policy task_assignments_select_authorized
on public.task_assignments
for select
to authenticated
using (
  (
    student_id = auth.uid()
    and visible_from <= transaction_timestamp()
    and public.has_current_student_membership(
      organization_id,
      class_id,
      student_id
    )
  )
  or public.has_active_staff_capability(
    class_id,
    'class.workspace.read'
  )
);

create policy task_completion_attempts_select_authorized
on public.task_completion_attempts
for select
to authenticated
using (
  public.can_read_task_progress_resource(
    organization_id,
    class_id,
    student_id
  )
);

create policy task_state_transitions_select_authorized
on public.task_state_transitions
for select
to authenticated
using (
  public.can_read_task_progress_resource(
    organization_id,
    class_id,
    student_id
  )
);

create policy student_xp_ledger_select_authorized
on public.student_xp_ledger
for select
to authenticated
using (
  public.can_read_task_progress_resource(
    organization_id,
    class_id,
    student_id
  )
);

create policy student_progress_select_authorized
on public.student_progress
for select
to authenticated
using (
  public.can_read_student_progress_identity(organization_id, student_id)
);

create policy level_milestones_select_authorized
on public.level_milestones
for select
to authenticated
using (
  public.can_read_student_progress_identity(organization_id, student_id)
);

create policy level_reward_entitlements_select_authorized
on public.level_reward_entitlements
for select
to authenticated
using (
  public.can_read_student_progress_identity(organization_id, student_id)
);

drop policy student_task_state_select_authorized
on public.student_task_state;

create policy student_task_state_select_authorized
on public.student_task_state
for select
to authenticated
using (
  exists (
    select 1
    from public.task_assignments as assignment
    where assignment.id = student_task_state.assignment_id
      and assignment.organization_id = student_task_state.organization_id
      and assignment.student_id = student_task_state.student_id
      and public.can_read_task_progress_resource(
        assignment.organization_id,
        assignment.class_id,
        assignment.student_id
      )
      and (
        assignment.student_id <> auth.uid()
        or assignment.visible_from <= transaction_timestamp()
      )
  )
);

create function public.set_progress_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

drop trigger if exists student_task_state_set_updated_at
on public.student_task_state;

create trigger student_task_state_set_updated_at
before update on public.student_task_state
for each row execute function public.set_progress_updated_at();

create trigger level_reward_entitlements_set_updated_at
before update on public.level_reward_entitlements
for each row execute function public.set_progress_updated_at();

revoke all on function public.set_progress_updated_at()
from public, anon, authenticated, service_role;
revoke all on function public.enforce_task_assignment_student_membership()
from public, anon, authenticated, service_role;
revoke all on function public.has_current_student_membership(uuid, uuid, uuid)
from public, anon, authenticated, service_role;

revoke all on table
  public.task_completion_attempts,
  public.task_state_transitions,
  public.student_xp_ledger,
  public.student_progress,
  public.level_milestones,
  public.level_reward_entitlements,
  public.progress_command_receipts
from anon, authenticated, service_role;

grant select on table
  public.task_completion_attempts,
  public.task_state_transitions,
  public.student_xp_ledger,
  public.student_progress,
  public.level_milestones,
  public.level_reward_entitlements
to authenticated, service_role;

grant select on table public.progress_command_receipts to service_role;

revoke all on table public.student_task_state from service_role;
grant select on table public.student_task_state to service_role;

revoke all on function public.extend_staff_capability_profile_v2()
from public, anon, authenticated, service_role;
revoke all on function public.normalize_staff_assignment_audit_profile()
from public, anon, authenticated, service_role;
revoke all on function public.progress_level_for_xp(bigint, text)
from public, anon, authenticated, service_role;
revoke all on function public.set_task_assignment_points_snapshot()
from public, anon, authenticated, service_role;
revoke all on function public.prevent_progress_history_mutation()
from public, anon, authenticated, service_role;
revoke all on function public.validate_xp_ledger_entry()
from public, anon, authenticated, service_role;
revoke all on function public.apply_task_progress_command(
  uuid,
  uuid,
  uuid,
  public.task_progress_command,
  uuid,
  public.task_reopen_reason,
  text
) from public, anon, authenticated, service_role;

revoke all on function public.complete_student_task(uuid, uuid, uuid)
from public, anon, authenticated, service_role;
revoke all on function public.undo_student_task_completion(uuid, uuid, uuid)
from public, anon, authenticated, service_role;
revoke all on function public.reopen_student_task_for_staff(
  uuid,
  uuid,
  uuid,
  uuid,
  public.task_reopen_reason,
  text
) from public, anon, authenticated, service_role;
revoke all on function public.can_read_task_progress_resource(uuid, uuid, uuid)
from public, anon, authenticated, service_role;
revoke all on function public.can_read_student_progress_identity(uuid, uuid)
from public, anon, authenticated, service_role;

grant execute on function public.complete_student_task(uuid, uuid, uuid)
to service_role;
grant execute on function public.undo_student_task_completion(uuid, uuid, uuid)
to service_role;
grant execute on function public.reopen_student_task_for_staff(
  uuid,
  uuid,
  uuid,
  uuid,
  public.task_reopen_reason,
  text
) to service_role;
grant execute on function public.can_read_task_progress_resource(uuid, uuid, uuid)
to authenticated, service_role;
grant execute on function public.can_read_student_progress_identity(uuid, uuid)
to authenticated, service_role;
grant execute on function public.has_current_student_membership(uuid, uuid, uuid)
to authenticated, service_role;

commit;
