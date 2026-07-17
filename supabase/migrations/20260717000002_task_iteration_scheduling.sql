begin;

create type public.task_schedule_command as enum ('move', 'reissue');

alter table public.plan_revision_sessions
  add constraint plan_revision_sessions_schedule_identity_key
  unique (id, teaching_session_id, organization_id, class_id);

create table public.task_iterations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  class_id uuid not null,
  task_definition_id uuid not null,
  plan_task_id uuid not null,
  source_plan_revision_task_id uuid not null,
  iteration_number integer not null,
  reissued_from_iteration_id uuid,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_by_staff_assignment_id uuid,
  management_version integer not null default 1,
  created_at timestamptz not null default transaction_timestamp(),
  unique (id, organization_id, class_id),
  unique (plan_task_id, iteration_number),
  unique (
    id,
    plan_task_id,
    source_plan_revision_task_id,
    organization_id,
    class_id,
    task_definition_id
  ),
  foreign key (
    source_plan_revision_task_id,
    plan_task_id,
    organization_id,
    class_id,
    task_definition_id
  ) references public.plan_revision_tasks (
    id,
    plan_task_id,
    organization_id,
    class_id,
    task_definition_id
  ) on delete restrict,
  foreign key (
    reissued_from_iteration_id,
    plan_task_id,
    source_plan_revision_task_id,
    organization_id,
    class_id,
    task_definition_id
  ) references public.task_iterations (
    id,
    plan_task_id,
    source_plan_revision_task_id,
    organization_id,
    class_id,
    task_definition_id
  ) on delete restrict,
  foreign key (
    created_by_staff_assignment_id,
    organization_id,
    created_by
  ) references public.staff_assignments (
    id,
    organization_id,
    user_id
  ) on delete restrict,
  constraint task_iterations_number check (iteration_number >= 1),
  constraint task_iterations_lineage_shape check (
    (
      iteration_number = 1
      and reissued_from_iteration_id is null
      and created_by_staff_assignment_id is null
    )
    or (
      iteration_number > 1
      and reissued_from_iteration_id is not null
      and created_by_staff_assignment_id is not null
    )
  ),
  constraint task_iterations_management_version check (management_version >= 1)
);

alter table public.task_assignments
  add column iteration_id uuid,
  add column scheduled_teaching_session_id uuid,
  add column scheduled_from_revision_session_id uuid,
  add column schedule_version integer not null default 1;

-- The backfill below is a schedule-only update. Replace the historical
-- authorization trigger before it runs so a task remains migratable after
-- its original publisher's staff assignment has ended.
create or replace function public.validate_task_assignment_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  authorizing_assignment_id uuid;
  validate_student boolean := tg_op = 'INSERT';
  validate_assigner boolean := tg_op = 'INSERT';
begin
  if tg_op = 'UPDATE' then
    validate_student :=
      new.class_id is distinct from old.class_id
      or new.organization_id is distinct from old.organization_id
      or new.student_id is distinct from old.student_id;
    validate_assigner :=
      new.class_id is distinct from old.class_id
      or new.organization_id is distinct from old.organization_id
      or new.assigned_by is distinct from old.assigned_by;
  end if;

  if validate_student and not exists (
    select 1
    from public.class_memberships as student_membership
    where student_membership.class_id = new.class_id
      and student_membership.organization_id = new.organization_id
      and student_membership.user_id = new.student_id
      and student_membership.role = 'student'
  ) then
    raise exception 'Task assignee must be a student in the target class';
  end if;

  if validate_assigner then
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
  end if;

  return new;
end;
$$;

do $$
begin
  if exists (
    select 1
    from public.task_assignments as assignment
    join public.plan_revision_tasks as revision_task
      on revision_task.id = assignment.source_plan_revision_task_id
     and revision_task.plan_task_id = assignment.plan_task_id
     and revision_task.organization_id = assignment.organization_id
     and revision_task.class_id = assignment.class_id
     and revision_task.task_definition_id = assignment.task_definition_id
    where assignment.plan_task_id is not null
      and (
        assignment.visible_from is distinct from revision_task.visible_from
        or assignment.due_at is distinct from revision_task.due_at
      )
  ) then
    raise exception 'Plan-linked assignments must match their published schedule before D2';
  end if;

  if exists (
    select 1
    from public.task_assignments as assignment
    where (assignment.plan_task_id is null)
      is distinct from (assignment.source_plan_revision_task_id is null)
  ) then
    raise exception 'Task assignment plan provenance is incomplete';
  end if;
end;
$$;

insert into public.task_iterations (
  id,
  organization_id,
  class_id,
  task_definition_id,
  plan_task_id,
  source_plan_revision_task_id,
  iteration_number,
  created_by,
  management_version,
  created_at
)
select
  overlay(
    overlay(
      md5('klar-d2-base-iteration:' || assignment.plan_task_id::text)
      placing '5' from 13 for 1
    ) placing '8' from 17 for 1
  )::uuid,
  assignment.organization_id,
  assignment.class_id,
  assignment.task_definition_id,
  assignment.plan_task_id,
  assignment.source_plan_revision_task_id,
  1,
  (array_agg(assignment.assigned_by order by assignment.created_at, assignment.id))[1],
  1,
  min(assignment.created_at)
from public.task_assignments as assignment
where assignment.plan_task_id is not null
group by
  assignment.organization_id,
  assignment.class_id,
  assignment.task_definition_id,
  assignment.plan_task_id,
  assignment.source_plan_revision_task_id;

update public.task_assignments as assignment
set
  iteration_id = iteration.id,
  scheduled_teaching_session_id = revision_session.teaching_session_id,
  scheduled_from_revision_session_id = revision_session.id,
  schedule_version = 1
from public.task_iterations as iteration
join public.plan_revision_tasks as revision_task
  on revision_task.id = iteration.source_plan_revision_task_id
 and revision_task.plan_task_id = iteration.plan_task_id
 and revision_task.organization_id = iteration.organization_id
 and revision_task.class_id = iteration.class_id
 and revision_task.task_definition_id = iteration.task_definition_id
join public.plan_revision_sessions as revision_session
  on revision_session.id = revision_task.revision_session_id
 and revision_session.revision_id = revision_task.revision_id
 and revision_session.weekly_plan_id = revision_task.weekly_plan_id
 and revision_session.organization_id = revision_task.organization_id
 and revision_session.class_id = revision_task.class_id
where assignment.plan_task_id = iteration.plan_task_id
  and assignment.source_plan_revision_task_id = iteration.source_plan_revision_task_id
  and assignment.organization_id = iteration.organization_id
  and assignment.class_id = iteration.class_id
  and assignment.task_definition_id = iteration.task_definition_id;

alter table public.task_assignments
  add constraint task_assignments_iteration_schedule_shape check (
    (
      plan_task_id is null
      and source_plan_revision_task_id is null
      and iteration_id is null
      and scheduled_teaching_session_id is null
      and scheduled_from_revision_session_id is null
    )
    or (
      plan_task_id is not null
      and source_plan_revision_task_id is not null
      and iteration_id is not null
      and scheduled_teaching_session_id is not null
      and scheduled_from_revision_session_id is not null
    )
  ),
  add constraint task_assignments_schedule_version check (schedule_version >= 1),
  add constraint task_assignments_iteration_fk
    foreign key (
      iteration_id,
      plan_task_id,
      source_plan_revision_task_id,
      organization_id,
      class_id,
      task_definition_id
    ) references public.task_iterations (
      id,
      plan_task_id,
      source_plan_revision_task_id,
      organization_id,
      class_id,
      task_definition_id
    ) on delete restrict,
  add constraint task_assignments_scheduled_session_fk
    foreign key (
      scheduled_from_revision_session_id,
      scheduled_teaching_session_id,
      organization_id,
      class_id
    ) references public.plan_revision_sessions (
      id,
      teaching_session_id,
      organization_id,
      class_id
    ) on delete restrict;

drop index public.task_assignments_plan_task_student_unique;

create unique index task_assignments_iteration_student_unique
  on public.task_assignments (iteration_id, student_id)
  where iteration_id is not null;

create unique index task_assignments_plan_student_session_unique
  on public.task_assignments (
    plan_task_id,
    student_id,
    scheduled_teaching_session_id
  )
  where plan_task_id is not null;

create index task_assignments_scheduled_session_student_idx
  on public.task_assignments (
    scheduled_teaching_session_id,
    student_id,
    visible_from
  )
  where scheduled_teaching_session_id is not null;

create table public.task_schedule_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  class_id uuid not null,
  actor_id uuid not null references auth.users (id) on delete restrict,
  authorizing_staff_assignment_id uuid not null,
  request_id uuid not null,
  command public.task_schedule_command not null,
  source_iteration_id uuid not null,
  result_iteration_id uuid not null,
  source_assignment_id uuid not null,
  result_assignment_id uuid not null,
  student_id uuid not null,
  from_teaching_session_id uuid not null,
  from_revision_session_id uuid not null,
  from_visible_from timestamptz not null,
  from_due_at timestamptz,
  to_teaching_session_id uuid not null,
  to_revision_session_id uuid not null,
  to_visible_from timestamptz not null,
  to_due_at timestamptz,
  occurred_at timestamptz not null default transaction_timestamp(),
  unique (actor_id, request_id, result_assignment_id),
  foreign key (
    authorizing_staff_assignment_id,
    organization_id,
    actor_id
  ) references public.staff_assignments (
    id,
    organization_id,
    user_id
  ) on delete restrict,
  foreign key (source_iteration_id, organization_id, class_id)
    references public.task_iterations (id, organization_id, class_id)
    on delete restrict,
  foreign key (result_iteration_id, organization_id, class_id)
    references public.task_iterations (id, organization_id, class_id)
    on delete restrict,
  foreign key (
    source_assignment_id,
    class_id,
    organization_id,
    student_id
  ) references public.task_assignments (
    id,
    class_id,
    organization_id,
    student_id
  ) on delete restrict,
  foreign key (
    result_assignment_id,
    class_id,
    organization_id,
    student_id
  ) references public.task_assignments (
    id,
    class_id,
    organization_id,
    student_id
  ) on delete restrict,
  foreign key (
    from_revision_session_id,
    from_teaching_session_id,
    organization_id,
    class_id
  ) references public.plan_revision_sessions (
    id,
    teaching_session_id,
    organization_id,
    class_id
  ) on delete restrict,
  foreign key (
    to_revision_session_id,
    to_teaching_session_id,
    organization_id,
    class_id
  ) references public.plan_revision_sessions (
    id,
    teaching_session_id,
    organization_id,
    class_id
  ) on delete restrict,
  constraint task_schedule_events_from_due check (
    from_due_at is null or from_due_at >= from_visible_from
  ),
  constraint task_schedule_events_to_due check (
    to_due_at is null or to_due_at >= to_visible_from
  ),
  constraint task_schedule_events_changed_session check (
    from_teaching_session_id <> to_teaching_session_id
  ),
  constraint task_schedule_events_shape check (
    (
      command = 'move'
      and source_iteration_id = result_iteration_id
      and source_assignment_id = result_assignment_id
    )
    or (
      command = 'reissue'
      and source_iteration_id <> result_iteration_id
      and source_assignment_id <> result_assignment_id
    )
  )
);

create table public.task_schedule_command_receipts (
  organization_id uuid not null,
  class_id uuid not null,
  actor_id uuid not null references auth.users (id) on delete restrict,
  authorizing_staff_assignment_id uuid not null,
  request_id uuid not null,
  command public.task_schedule_command not null,
  source_iteration_id uuid not null,
  target_teaching_session_id uuid not null,
  target_revision_session_id uuid not null,
  request_fingerprint text not null,
  result jsonb not null,
  created_at timestamptz not null default transaction_timestamp(),
  primary key (actor_id, request_id),
  foreign key (
    authorizing_staff_assignment_id,
    organization_id,
    actor_id
  ) references public.staff_assignments (
    id,
    organization_id,
    user_id
  ) on delete restrict,
  foreign key (source_iteration_id, organization_id, class_id)
    references public.task_iterations (id, organization_id, class_id)
    on delete restrict,
  foreign key (
    target_revision_session_id,
    target_teaching_session_id,
    organization_id,
    class_id
  ) references public.plan_revision_sessions (
    id,
    teaching_session_id,
    organization_id,
    class_id
  ) on delete restrict,
  constraint task_schedule_receipts_fingerprint
    check (request_fingerprint ~ '^[0-9a-f]{32}$'),
  constraint task_schedule_receipts_result
    check (
      jsonb_typeof(result) = 'object'
      and pg_column_size(result) <= 262144
    )
);

create table public.task_completion_v2_receipts (
  organization_id uuid not null,
  class_id uuid not null,
  assignment_id uuid not null,
  student_id uuid not null,
  actor_id uuid not null references auth.users (id) on delete restrict,
  request_id uuid not null,
  expected_state_version integer not null,
  expected_schedule_version integer not null,
  result jsonb not null,
  created_at timestamptz not null default transaction_timestamp(),
  primary key (actor_id, request_id),
  foreign key (
    assignment_id,
    class_id,
    organization_id,
    student_id
  ) references public.task_assignments (
    id,
    class_id,
    organization_id,
    student_id
  ) on delete restrict,
  constraint task_completion_v2_actor_is_student
    check (actor_id = student_id),
  constraint task_completion_v2_state_version
    check (expected_state_version >= 1),
  constraint task_completion_v2_schedule_version
    check (expected_schedule_version >= 1),
  constraint task_completion_v2_result
    check (
      jsonb_typeof(result) = 'object'
      and pg_column_size(result) <= 262144
    )
);

create table public.task_undo_v2_receipts (
  organization_id uuid not null,
  class_id uuid not null,
  assignment_id uuid not null,
  student_id uuid not null,
  actor_id uuid not null references auth.users (id) on delete restrict,
  request_id uuid not null,
  expected_state_version integer not null,
  expected_schedule_version integer not null,
  result jsonb not null,
  created_at timestamptz not null default transaction_timestamp(),
  primary key (actor_id, request_id),
  foreign key (
    assignment_id,
    class_id,
    organization_id,
    student_id
  ) references public.task_assignments (
    id,
    class_id,
    organization_id,
    student_id
  ) on delete restrict,
  constraint task_undo_v2_actor_is_student
    check (actor_id = student_id),
  constraint task_undo_v2_state_version
    check (expected_state_version >= 1),
  constraint task_undo_v2_schedule_version
    check (expected_schedule_version >= 1),
  constraint task_undo_v2_result
    check (
      jsonb_typeof(result) = 'object'
      and pg_column_size(result) <= 262144
    )
);

create index task_schedule_events_iteration_occurred_idx
  on public.task_schedule_events (
    organization_id,
    source_iteration_id,
    occurred_at,
    id
  );

create function public.prevent_task_schedule_history_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Task scheduling history is append-only';
end;
$$;

create trigger task_schedule_events_immutable
before update or delete on public.task_schedule_events
for each row execute function public.prevent_task_schedule_history_mutation();

create trigger task_schedule_command_receipts_immutable
before update or delete on public.task_schedule_command_receipts
for each row execute function public.prevent_task_schedule_history_mutation();

create trigger task_completion_v2_receipts_immutable
before update or delete on public.task_completion_v2_receipts
for each row execute function public.prevent_task_schedule_history_mutation();

create trigger task_undo_v2_receipts_immutable
before update or delete on public.task_undo_v2_receipts
for each row execute function public.prevent_task_schedule_history_mutation();

create function public.validate_task_iteration_shape()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.organization_id is distinct from old.organization_id
      or new.class_id is distinct from old.class_id
      or new.task_definition_id is distinct from old.task_definition_id
      or new.plan_task_id is distinct from old.plan_task_id
      or new.source_plan_revision_task_id
        is distinct from old.source_plan_revision_task_id
      or new.iteration_number is distinct from old.iteration_number
      or new.reissued_from_iteration_id
        is distinct from old.reissued_from_iteration_id
      or new.created_by is distinct from old.created_by
      or new.created_by_staff_assignment_id
        is distinct from old.created_by_staff_assignment_id
      or new.created_at is distinct from old.created_at
    then
      raise exception 'Task iteration identity and lineage are immutable';
    end if;

    if new.management_version <> old.management_version + 1 then
      raise exception 'Task iteration management version must advance once';
    end if;
  elsif new.reissued_from_iteration_id is not null and not exists (
    select 1
    from public.task_iterations as parent
    where parent.id = new.reissued_from_iteration_id
      and parent.organization_id = new.organization_id
      and parent.class_id = new.class_id
      and parent.plan_task_id = new.plan_task_id
      and parent.source_plan_revision_task_id = new.source_plan_revision_task_id
      and parent.task_definition_id = new.task_definition_id
  ) then
    raise exception 'Reissued task iteration must preserve the source lineage';
  end if;

  return new;
end;
$$;

create trigger task_iterations_validate_shape
before insert or update on public.task_iterations
for each row execute function public.validate_task_iteration_shape();

create function public.prepare_task_assignment_schedule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_record record;
  base_iteration_id uuid;
begin
  if new.schedule_version <> 1 then
    raise exception 'New task assignments start at schedule version one';
  end if;

  if new.plan_task_id is null then
    if new.source_plan_revision_task_id is not null
      or new.iteration_id is not null
      or new.scheduled_teaching_session_id is not null
      or new.scheduled_from_revision_session_id is not null
    then
      raise exception 'Loose task assignments cannot claim plan scheduling provenance';
    end if;
    return new;
  end if;

  select
    revision_task.id as source_revision_task_id,
    revision_task.visible_from,
    revision_task.due_at,
    revision_session.id as source_revision_session_id,
    revision_session.teaching_session_id
  into source_record
  from public.plan_revision_tasks as revision_task
  join public.plan_revision_sessions as revision_session
    on revision_session.id = revision_task.revision_session_id
   and revision_session.revision_id = revision_task.revision_id
   and revision_session.weekly_plan_id = revision_task.weekly_plan_id
   and revision_session.organization_id = revision_task.organization_id
   and revision_session.class_id = revision_task.class_id
  where revision_task.id = new.source_plan_revision_task_id
    and revision_task.plan_task_id = new.plan_task_id
    and revision_task.organization_id = new.organization_id
    and revision_task.class_id = new.class_id
    and revision_task.task_definition_id = new.task_definition_id;

  if source_record.source_revision_task_id is null then
    raise exception 'Task assignment source provenance is unavailable';
  end if;

  if new.iteration_id is null then
    base_iteration_id := overlay(
      overlay(
        md5('klar-d2-base-iteration:' || new.plan_task_id::text)
        placing '5' from 13 for 1
      ) placing '8' from 17 for 1
    )::uuid;

    insert into public.task_iterations (
      id,
      organization_id,
      class_id,
      task_definition_id,
      plan_task_id,
      source_plan_revision_task_id,
      iteration_number,
      created_by
    ) values (
      base_iteration_id,
      new.organization_id,
      new.class_id,
      new.task_definition_id,
      new.plan_task_id,
      new.source_plan_revision_task_id,
      1,
      new.assigned_by
    ) on conflict (plan_task_id, iteration_number) do nothing;

    select iteration.id
    into new.iteration_id
    from public.task_iterations as iteration
    where iteration.plan_task_id = new.plan_task_id
      and iteration.iteration_number = 1
      and iteration.organization_id = new.organization_id
      and iteration.class_id = new.class_id
      and iteration.task_definition_id = new.task_definition_id
      and iteration.source_plan_revision_task_id = new.source_plan_revision_task_id;

    if new.iteration_id is null then
      raise exception 'Base task iteration conflicts with existing lineage';
    end if;
  end if;

  if new.scheduled_teaching_session_id is null
    and new.scheduled_from_revision_session_id is null
  then
    new.scheduled_teaching_session_id := source_record.teaching_session_id;
    new.scheduled_from_revision_session_id :=
      source_record.source_revision_session_id;
    if new.visible_from is distinct from source_record.visible_from
      or new.due_at is distinct from source_record.due_at
    then
      raise exception 'Initial task assignment must use the published source schedule';
    end if;
  elsif new.scheduled_teaching_session_id is null
    or new.scheduled_from_revision_session_id is null
  then
    raise exception 'Task assignment schedule identity is incomplete';
  end if;

  return new;
end;
$$;

create trigger task_assignments_00_prepare_schedule
before insert on public.task_assignments
for each row execute function public.prepare_task_assignment_schedule();

create function public.protect_task_assignment_schedule()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  schedule_changed boolean;
begin
  if new.iteration_id is distinct from old.iteration_id then
    raise exception 'Task assignment iteration identity is immutable';
  end if;

  schedule_changed :=
    new.scheduled_teaching_session_id
      is distinct from old.scheduled_teaching_session_id
    or new.scheduled_from_revision_session_id
      is distinct from old.scheduled_from_revision_session_id
    or new.visible_from is distinct from old.visible_from
    or new.due_at is distinct from old.due_at;

  if schedule_changed then
    if old.iteration_id is null then
      raise exception 'Loose compatibility tasks cannot be moved by D2';
    end if;
    if new.schedule_version <> old.schedule_version + 1 then
      raise exception 'Task assignment schedule version must advance once';
    end if;
  elsif new.schedule_version is distinct from old.schedule_version then
    raise exception 'Task assignment schedule version changed without a move';
  end if;

  return new;
end;
$$;

create trigger task_assignments_10_protect_schedule
before update on public.task_assignments
for each row execute function public.protect_task_assignment_schedule();

create function public.lock_task_schedule_authorization(
  p_staff_assignment_id uuid,
  p_actor_id uuid,
  p_class_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  plan_organization_id uuid;
  task_organization_id uuid;
  workspace_organization_id uuid;
  progress_organization_id uuid;
begin
  plan_organization_id := public.lock_staff_assignment_authorization(
    p_staff_assignment_id,
    p_actor_id,
    p_class_id,
    'plan.publish'
  );
  task_organization_id := public.lock_staff_assignment_authorization(
    p_staff_assignment_id,
    p_actor_id,
    p_class_id,
    'task.publish'
  );
  workspace_organization_id := public.lock_staff_assignment_authorization(
    p_staff_assignment_id,
    p_actor_id,
    p_class_id,
    'class.workspace.read'
  );
  progress_organization_id := public.lock_staff_assignment_authorization(
    p_staff_assignment_id,
    p_actor_id,
    p_class_id,
    'student_progress.read'
  );

  if plan_organization_id is null
    or task_organization_id is null
    or workspace_organization_id is null
    or progress_organization_id is null
    or task_organization_id <> plan_organization_id
    or workspace_organization_id <> plan_organization_id
    or progress_organization_id <> plan_organization_id
  then
    return null;
  end if;

  return plan_organization_id;
end;
$$;

create function public.move_task_iteration_v1(
  p_class_id uuid,
  p_iteration_id uuid,
  p_assignment_ids uuid[],
  p_expected_state_versions integer[],
  p_expected_schedule_versions integer[],
  p_target_revision_session_id uuid,
  p_expected_iteration_version integer,
  p_expected_target_plan_lock_version integer,
  p_actor_id uuid,
  p_staff_assignment_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  authorized_organization_id uuid;
  iteration_record public.task_iterations%rowtype;
  receipt_record public.task_schedule_command_receipts%rowtype;
  target_record record;
  recipient_record record;
  assignment_record record;
  recipient_student_ids uuid[];
  student_lock_id uuid;
  normalized_recipients jsonb;
  fingerprint text;
  target_visible_from timestamptz;
  active_assignment_xp bigint;
  result_assignments jsonb := '[]'::jsonb;
  result_payload jsonb;
begin
  if p_class_id is null
    or p_iteration_id is null
    or p_target_revision_session_id is null
    or p_actor_id is null
    or p_staff_assignment_id is null
    or p_request_id is null
    or p_expected_iteration_version is null
    or p_expected_target_plan_lock_version is null
  then
    raise exception 'Task scheduling command identifiers are required';
  end if;

  if p_assignment_ids is null
    or cardinality(p_assignment_ids) < 1
    or cardinality(p_assignment_ids) > 200
    or cardinality(p_assignment_ids) <> cardinality(p_expected_state_versions)
    or cardinality(p_assignment_ids) <> cardinality(p_expected_schedule_versions)
    or exists (
      select 1
      from unnest(
        p_assignment_ids,
        p_expected_state_versions,
        p_expected_schedule_versions
      ) as input(assignment_id, state_version, schedule_version)
      where input.assignment_id is null
        or input.state_version is null
        or input.state_version < 1
        or input.schedule_version is null
        or input.schedule_version < 1
    )
    or cardinality(p_assignment_ids) <> (
      select count(distinct input.assignment_id)
      from unnest(p_assignment_ids) as input(assignment_id)
    )
  then
    raise exception 'Task scheduling recipients are invalid';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'assignment_id', input.assignment_id,
      'state_version', input.state_version,
      'schedule_version', input.schedule_version
    ) order by input.assignment_id
  )
  into normalized_recipients
  from unnest(
    p_assignment_ids,
    p_expected_state_versions,
    p_expected_schedule_versions
  ) as input(assignment_id, state_version, schedule_version);

  fingerprint := md5(jsonb_build_object(
    'command', 'move',
    'class_id', p_class_id,
    'iteration_id', p_iteration_id,
    'target_revision_session_id', p_target_revision_session_id,
    'expected_iteration_version', p_expected_iteration_version,
    'expected_target_plan_lock_version', p_expected_target_plan_lock_version,
    'recipients', normalized_recipients
  )::text);

  authorized_organization_id := public.lock_task_schedule_authorization(
    p_staff_assignment_id,
    p_actor_id,
    p_class_id
  );
  if authorized_organization_id is null then
    raise exception 'Staff assignment does not authorize task scheduling';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    authorized_organization_id::text || ':' || p_actor_id::text || ':' ||
      p_request_id::text,
    0
  ));

  select receipt.*
  into receipt_record
  from public.task_schedule_command_receipts as receipt
  where receipt.actor_id = p_actor_id
    and receipt.request_id = p_request_id;

  if found then
    if receipt_record.command <> 'move'
      or receipt_record.request_fingerprint <> fingerprint
    then
      raise exception 'Request ID was already used with another payload';
    end if;
    return receipt_record.result;
  end if;

  select iteration.*
  into iteration_record
  from public.task_iterations as iteration
  where iteration.id = p_iteration_id
    and iteration.organization_id = authorized_organization_id
    and iteration.class_id = p_class_id
  for update;

  if iteration_record.id is null then
    raise exception 'Task iteration is unavailable';
  end if;
  if iteration_record.management_version <> p_expected_iteration_version then
    raise exception 'Task iteration changed after preview';
  end if;

  select array_agg(assignment.student_id order by assignment.student_id)
  into recipient_student_ids
  from public.task_assignments as assignment
  where assignment.id = any(p_assignment_ids)
    and assignment.iteration_id = iteration_record.id
    and assignment.organization_id = iteration_record.organization_id
    and assignment.class_id = iteration_record.class_id;

  if coalesce(cardinality(recipient_student_ids), 0) <>
    cardinality(p_assignment_ids)
  then
    raise exception 'Task scheduling recipients are outside the source iteration';
  end if;

  foreach student_lock_id in array recipient_student_ids loop
    perform organization_membership.user_id
    from public.memberships as organization_membership
    join public.class_memberships as class_membership
      on class_membership.organization_id =
        organization_membership.organization_id
     and class_membership.user_id = organization_membership.user_id
     and class_membership.class_id = p_class_id
     and class_membership.role = 'student'
    where organization_membership.organization_id =
        authorized_organization_id
      and organization_membership.user_id = student_lock_id
      and organization_membership.role = 'student'
    for share of organization_membership, class_membership;

    if not found then
      raise exception 'Task assignment student membership is unavailable';
    end if;
  end loop;

  perform pg_advisory_xact_lock(hashtextextended(
    'klar.help-queue-class:' || p_class_id::text,
    0
  ));
  foreach student_lock_id in array recipient_student_ids loop
    perform pg_advisory_xact_lock(hashtextextended(
      'klar.help-student:' || student_lock_id::text,
      0
    ));
  end loop;

  select
    revision_session.id,
    revision_session.teaching_session_id,
    revision_session.starts_at,
    revision_session.ends_at,
    plan.id as weekly_plan_id,
    plan.lock_version,
    plan.timezone_name
  into target_record
  from public.plan_revision_sessions as revision_session
  join public.weekly_plans as plan
    on plan.id = revision_session.weekly_plan_id
   and plan.organization_id = revision_session.organization_id
   and plan.class_id = revision_session.class_id
   and plan.active_revision_id = revision_session.revision_id
  where revision_session.id = p_target_revision_session_id
    and revision_session.organization_id = authorized_organization_id
    and revision_session.class_id = p_class_id
  for share of plan;

  if target_record.id is null then
    raise exception 'Target teaching session is not in an active published plan';
  end if;
  if target_record.lock_version <> p_expected_target_plan_lock_version then
    raise exception 'Target plan changed after preview';
  end if;
  if target_record.starts_at <= transaction_timestamp() then
    raise exception 'Target teaching session must be in the future';
  end if;

  target_visible_from := date_trunc(
    'day',
    target_record.starts_at at time zone target_record.timezone_name
  ) at time zone target_record.timezone_name;

  for recipient_record in
    select input.*
    from unnest(
      p_assignment_ids,
      p_expected_state_versions,
      p_expected_schedule_versions
    ) as input(assignment_id, state_version, schedule_version)
    order by input.assignment_id
  loop
    select
      assignment.*,
      state.status as task_status,
      state.state_version,
      current_session.starts_at as current_starts_at
    into assignment_record
    from public.task_assignments as assignment
    join public.student_task_state as state
      on state.assignment_id = assignment.id
     and state.organization_id = assignment.organization_id
     and state.student_id = assignment.student_id
    join public.plan_revision_sessions as current_session
      on current_session.id = assignment.scheduled_from_revision_session_id
     and current_session.teaching_session_id =
       assignment.scheduled_teaching_session_id
     and current_session.organization_id = assignment.organization_id
     and current_session.class_id = assignment.class_id
    where assignment.id = recipient_record.assignment_id
      and assignment.iteration_id = iteration_record.id
      and assignment.organization_id = iteration_record.organization_id
      and assignment.class_id = iteration_record.class_id
    for update of assignment, state;

    if assignment_record.id is null then
      raise exception 'Task assignment is unavailable';
    end if;
    if assignment_record.state_version <> recipient_record.state_version
      or assignment_record.schedule_version <>
        recipient_record.schedule_version
    then
      raise exception 'Task assignment changed after preview';
    end if;
    if assignment_record.task_status not in ('assigned', 'reopened') then
      raise exception 'Only unfinished task assignments can be moved';
    end if;
    if target_record.starts_at <= assignment_record.current_starts_at then
      raise exception 'Target teaching session must be later than the current session';
    end if;

    select coalesce(sum(ledger.points_delta), 0)::bigint
    into active_assignment_xp
    from public.student_xp_ledger as ledger
    where ledger.assignment_id = assignment_record.id;
    if active_assignment_xp <> 0 then
      raise exception 'Unfinished task assignment has active XP';
    end if;

    update public.task_assignments
    set
      scheduled_teaching_session_id = target_record.teaching_session_id,
      scheduled_from_revision_session_id = target_record.id,
      visible_from = target_visible_from,
      due_at = target_record.ends_at,
      schedule_version = schedule_version + 1
    where id = assignment_record.id;

    insert into public.task_schedule_events (
      organization_id,
      class_id,
      actor_id,
      authorizing_staff_assignment_id,
      request_id,
      command,
      source_iteration_id,
      result_iteration_id,
      source_assignment_id,
      result_assignment_id,
      student_id,
      from_teaching_session_id,
      from_revision_session_id,
      from_visible_from,
      from_due_at,
      to_teaching_session_id,
      to_revision_session_id,
      to_visible_from,
      to_due_at
    ) values (
      assignment_record.organization_id,
      assignment_record.class_id,
      p_actor_id,
      p_staff_assignment_id,
      p_request_id,
      'move',
      iteration_record.id,
      iteration_record.id,
      assignment_record.id,
      assignment_record.id,
      assignment_record.student_id,
      assignment_record.scheduled_teaching_session_id,
      assignment_record.scheduled_from_revision_session_id,
      assignment_record.visible_from,
      assignment_record.due_at,
      target_record.teaching_session_id,
      target_record.id,
      target_visible_from,
      target_record.ends_at
    );

    result_assignments := result_assignments || jsonb_build_array(
      jsonb_build_object(
        'assignment_id', assignment_record.id,
        'student_id', assignment_record.student_id,
        'status', assignment_record.task_status,
        'state_version', assignment_record.state_version,
        'schedule_version', assignment_record.schedule_version + 1
      )
    );
  end loop;

  update public.task_iterations
  set management_version = management_version + 1
  where id = iteration_record.id;

  result_payload := jsonb_build_object(
    'request_id', p_request_id,
    'command', 'move',
    'source_iteration_id', iteration_record.id,
    'result_iteration_id', iteration_record.id,
    'iteration_version', iteration_record.management_version + 1,
    'target_teaching_session_id', target_record.teaching_session_id,
    'target_revision_session_id', target_record.id,
    'assignments', result_assignments
  );

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
    authorized_organization_id,
    p_actor_id,
    'task.iteration_moved',
    'task_iteration',
    iteration_record.id,
    jsonb_build_object(
      'class_id', p_class_id,
      'request_id', p_request_id,
      'assignment_ids', to_jsonb(p_assignment_ids),
      'target_teaching_session_id', target_record.teaching_session_id,
      'target_revision_session_id', target_record.id,
      'iteration_version', iteration_record.management_version + 1
    ),
    p_staff_assignment_id,
    'plan.publish'
  );

  insert into public.task_schedule_command_receipts (
    organization_id,
    class_id,
    actor_id,
    authorizing_staff_assignment_id,
    request_id,
    command,
    source_iteration_id,
    target_teaching_session_id,
    target_revision_session_id,
    request_fingerprint,
    result
  ) values (
    authorized_organization_id,
    p_class_id,
    p_actor_id,
    p_staff_assignment_id,
    p_request_id,
    'move',
    iteration_record.id,
    target_record.teaching_session_id,
    target_record.id,
    fingerprint,
    result_payload
  );

  return result_payload;
end;
$$;

create function public.reissue_task_iteration_v1(
  p_class_id uuid,
  p_iteration_id uuid,
  p_assignment_ids uuid[],
  p_expected_state_versions integer[],
  p_expected_schedule_versions integer[],
  p_target_revision_session_id uuid,
  p_expected_iteration_version integer,
  p_expected_target_plan_lock_version integer,
  p_actor_id uuid,
  p_staff_assignment_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  authorized_organization_id uuid;
  iteration_record public.task_iterations%rowtype;
  receipt_record public.task_schedule_command_receipts%rowtype;
  target_record record;
  recipient_record record;
  assignment_record record;
  recipient_student_ids uuid[];
  student_lock_id uuid;
  normalized_recipients jsonb;
  fingerprint text;
  target_visible_from timestamptz;
  result_assignments jsonb := '[]'::jsonb;
  result_payload jsonb;
  new_iteration_id uuid := gen_random_uuid();
  new_iteration_number integer;
  new_assignment_id uuid;
begin
  if p_class_id is null
    or p_iteration_id is null
    or p_target_revision_session_id is null
    or p_actor_id is null
    or p_staff_assignment_id is null
    or p_request_id is null
    or p_expected_iteration_version is null
    or p_expected_target_plan_lock_version is null
  then
    raise exception 'Task scheduling command identifiers are required';
  end if;

  if p_assignment_ids is null
    or cardinality(p_assignment_ids) < 1
    or cardinality(p_assignment_ids) > 200
    or cardinality(p_assignment_ids) <> cardinality(p_expected_state_versions)
    or cardinality(p_assignment_ids) <> cardinality(p_expected_schedule_versions)
    or exists (
      select 1
      from unnest(
        p_assignment_ids,
        p_expected_state_versions,
        p_expected_schedule_versions
      ) as input(assignment_id, state_version, schedule_version)
      where input.assignment_id is null
        or input.state_version is null
        or input.state_version < 1
        or input.schedule_version is null
        or input.schedule_version < 1
    )
    or cardinality(p_assignment_ids) <> (
      select count(distinct input.assignment_id)
      from unnest(p_assignment_ids) as input(assignment_id)
    )
  then
    raise exception 'Task scheduling recipients are invalid';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'assignment_id', input.assignment_id,
      'state_version', input.state_version,
      'schedule_version', input.schedule_version
    ) order by input.assignment_id
  )
  into normalized_recipients
  from unnest(
    p_assignment_ids,
    p_expected_state_versions,
    p_expected_schedule_versions
  ) as input(assignment_id, state_version, schedule_version);

  fingerprint := md5(jsonb_build_object(
    'command', 'reissue',
    'class_id', p_class_id,
    'iteration_id', p_iteration_id,
    'target_revision_session_id', p_target_revision_session_id,
    'expected_iteration_version', p_expected_iteration_version,
    'expected_target_plan_lock_version', p_expected_target_plan_lock_version,
    'recipients', normalized_recipients
  )::text);

  authorized_organization_id := public.lock_task_schedule_authorization(
    p_staff_assignment_id,
    p_actor_id,
    p_class_id
  );
  if authorized_organization_id is null then
    raise exception 'Staff assignment does not authorize task scheduling';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    authorized_organization_id::text || ':' || p_actor_id::text || ':' ||
      p_request_id::text,
    0
  ));

  select receipt.*
  into receipt_record
  from public.task_schedule_command_receipts as receipt
  where receipt.actor_id = p_actor_id
    and receipt.request_id = p_request_id;

  if found then
    if receipt_record.command <> 'reissue'
      or receipt_record.request_fingerprint <> fingerprint
    then
      raise exception 'Request ID was already used with another payload';
    end if;
    return receipt_record.result;
  end if;

  select iteration.*
  into iteration_record
  from public.task_iterations as iteration
  where iteration.id = p_iteration_id
    and iteration.organization_id = authorized_organization_id
    and iteration.class_id = p_class_id
  for update;

  if iteration_record.id is null then
    raise exception 'Task iteration is unavailable';
  end if;
  if iteration_record.management_version <> p_expected_iteration_version then
    raise exception 'Task iteration changed after preview';
  end if;

  select array_agg(assignment.student_id order by assignment.student_id)
  into recipient_student_ids
  from public.task_assignments as assignment
  where assignment.id = any(p_assignment_ids)
    and assignment.iteration_id = iteration_record.id
    and assignment.organization_id = iteration_record.organization_id
    and assignment.class_id = iteration_record.class_id;

  if coalesce(cardinality(recipient_student_ids), 0) <>
    cardinality(p_assignment_ids)
  then
    raise exception 'Task scheduling recipients are outside the source iteration';
  end if;

  foreach student_lock_id in array recipient_student_ids loop
    perform organization_membership.user_id
    from public.memberships as organization_membership
    join public.class_memberships as class_membership
      on class_membership.organization_id =
        organization_membership.organization_id
     and class_membership.user_id = organization_membership.user_id
     and class_membership.class_id = p_class_id
     and class_membership.role = 'student'
    where organization_membership.organization_id =
        authorized_organization_id
      and organization_membership.user_id = student_lock_id
      and organization_membership.role = 'student'
    for share of organization_membership, class_membership;

    if not found then
      raise exception 'Task assignment student membership is unavailable';
    end if;
  end loop;

  perform pg_advisory_xact_lock(hashtextextended(
    'klar.help-queue-class:' || p_class_id::text,
    0
  ));
  foreach student_lock_id in array recipient_student_ids loop
    perform pg_advisory_xact_lock(hashtextextended(
      'klar.help-student:' || student_lock_id::text,
      0
    ));
  end loop;

  select
    revision_session.id,
    revision_session.teaching_session_id,
    revision_session.starts_at,
    revision_session.ends_at,
    plan.id as weekly_plan_id,
    plan.lock_version,
    plan.timezone_name
  into target_record
  from public.plan_revision_sessions as revision_session
  join public.weekly_plans as plan
    on plan.id = revision_session.weekly_plan_id
   and plan.organization_id = revision_session.organization_id
   and plan.class_id = revision_session.class_id
   and plan.active_revision_id = revision_session.revision_id
  where revision_session.id = p_target_revision_session_id
    and revision_session.organization_id = authorized_organization_id
    and revision_session.class_id = p_class_id
  for share of plan;

  if target_record.id is null then
    raise exception 'Target teaching session is not in an active published plan';
  end if;
  if target_record.lock_version <> p_expected_target_plan_lock_version then
    raise exception 'Target plan changed after preview';
  end if;
  if target_record.starts_at <= transaction_timestamp() then
    raise exception 'Target teaching session must be in the future';
  end if;

  target_visible_from := date_trunc(
    'day',
    target_record.starts_at at time zone target_record.timezone_name
  ) at time zone target_record.timezone_name;

  for recipient_record in
    select input.*
    from unnest(
      p_assignment_ids,
      p_expected_state_versions,
      p_expected_schedule_versions
    ) as input(assignment_id, state_version, schedule_version)
    order by input.assignment_id
  loop
    select
      assignment.*,
      state.status as task_status,
      state.state_version,
      current_session.starts_at as current_starts_at
    into assignment_record
    from public.task_assignments as assignment
    join public.student_task_state as state
      on state.assignment_id = assignment.id
     and state.organization_id = assignment.organization_id
     and state.student_id = assignment.student_id
    join public.plan_revision_sessions as current_session
      on current_session.id = assignment.scheduled_from_revision_session_id
     and current_session.teaching_session_id =
       assignment.scheduled_teaching_session_id
     and current_session.organization_id = assignment.organization_id
     and current_session.class_id = assignment.class_id
    where assignment.id = recipient_record.assignment_id
      and assignment.iteration_id = iteration_record.id
      and assignment.organization_id = iteration_record.organization_id
      and assignment.class_id = iteration_record.class_id
    for update of assignment, state;

    if assignment_record.id is null then
      raise exception 'Task assignment is unavailable';
    end if;
    if assignment_record.state_version <> recipient_record.state_version
      or assignment_record.schedule_version <>
        recipient_record.schedule_version
    then
      raise exception 'Task assignment changed after preview';
    end if;
    if target_record.starts_at <= assignment_record.current_starts_at then
      raise exception 'Target teaching session must be later than the current session';
    end if;

    if exists (
      select 1
      from public.task_assignments as existing
      where existing.plan_task_id = assignment_record.plan_task_id
        and existing.student_id = assignment_record.student_id
        and existing.scheduled_teaching_session_id =
          target_record.teaching_session_id
    ) then
      raise exception 'Student already has this plan task in the target session';
    end if;
  end loop;

  perform plan_task.id
  from public.plan_tasks as plan_task
  where plan_task.id = iteration_record.plan_task_id
    and plan_task.organization_id = iteration_record.organization_id
    and plan_task.class_id = iteration_record.class_id
  for update;
  if not found then
    raise exception 'Task iteration plan identity is unavailable';
  end if;

  select coalesce(max(iteration.iteration_number), 0) + 1
  into new_iteration_number
  from public.task_iterations as iteration
  where iteration.plan_task_id = iteration_record.plan_task_id;

  insert into public.task_iterations (
    id,
    organization_id,
    class_id,
    task_definition_id,
    plan_task_id,
    source_plan_revision_task_id,
    iteration_number,
    reissued_from_iteration_id,
    created_by,
    created_by_staff_assignment_id
  ) values (
    new_iteration_id,
    iteration_record.organization_id,
    iteration_record.class_id,
    iteration_record.task_definition_id,
    iteration_record.plan_task_id,
    iteration_record.source_plan_revision_task_id,
    new_iteration_number,
    iteration_record.id,
    p_actor_id,
    p_staff_assignment_id
  );

  for recipient_record in
    select input.*
    from unnest(
      p_assignment_ids,
      p_expected_state_versions,
      p_expected_schedule_versions
    ) as input(assignment_id, state_version, schedule_version)
    order by input.assignment_id
  loop
    select
      assignment.*,
      state.status as task_status,
      state.state_version
    into assignment_record
    from public.task_assignments as assignment
    join public.student_task_state as state
      on state.assignment_id = assignment.id
     and state.organization_id = assignment.organization_id
     and state.student_id = assignment.student_id
    where assignment.id = recipient_record.assignment_id
      and assignment.iteration_id = iteration_record.id;

    new_assignment_id := gen_random_uuid();
    insert into public.task_assignments (
      id,
      organization_id,
      class_id,
      task_definition_id,
      student_id,
      assigned_by,
      visible_from,
      due_at,
      plan_task_id,
      source_plan_revision_task_id,
      iteration_id,
      scheduled_teaching_session_id,
      scheduled_from_revision_session_id,
      schedule_version
    ) values (
      new_assignment_id,
      assignment_record.organization_id,
      assignment_record.class_id,
      assignment_record.task_definition_id,
      assignment_record.student_id,
      p_actor_id,
      target_visible_from,
      target_record.ends_at,
      assignment_record.plan_task_id,
      assignment_record.source_plan_revision_task_id,
      new_iteration_id,
      target_record.teaching_session_id,
      target_record.id,
      1
    );

    if (
      select assignment.points_value_snapshot
      from public.task_assignments as assignment
      where assignment.id = new_assignment_id
    ) <> assignment_record.points_value_snapshot
    then
      raise exception 'Reissued task points snapshot changed unexpectedly';
    end if;

    insert into public.student_task_state (
      assignment_id,
      organization_id,
      student_id,
      status
    ) values (
      new_assignment_id,
      assignment_record.organization_id,
      assignment_record.student_id,
      'assigned'
    );

    insert into public.task_schedule_events (
      organization_id,
      class_id,
      actor_id,
      authorizing_staff_assignment_id,
      request_id,
      command,
      source_iteration_id,
      result_iteration_id,
      source_assignment_id,
      result_assignment_id,
      student_id,
      from_teaching_session_id,
      from_revision_session_id,
      from_visible_from,
      from_due_at,
      to_teaching_session_id,
      to_revision_session_id,
      to_visible_from,
      to_due_at
    ) values (
      assignment_record.organization_id,
      assignment_record.class_id,
      p_actor_id,
      p_staff_assignment_id,
      p_request_id,
      'reissue',
      iteration_record.id,
      new_iteration_id,
      assignment_record.id,
      new_assignment_id,
      assignment_record.student_id,
      assignment_record.scheduled_teaching_session_id,
      assignment_record.scheduled_from_revision_session_id,
      assignment_record.visible_from,
      assignment_record.due_at,
      target_record.teaching_session_id,
      target_record.id,
      target_visible_from,
      target_record.ends_at
    );

    result_assignments := result_assignments || jsonb_build_array(
      jsonb_build_object(
        'source_assignment_id', assignment_record.id,
        'assignment_id', new_assignment_id,
        'student_id', assignment_record.student_id,
        'status', 'assigned',
        'state_version', 1,
        'schedule_version', 1
      )
    );
  end loop;

  update public.task_iterations
  set management_version = management_version + 1
  where id = iteration_record.id;

  result_payload := jsonb_build_object(
    'request_id', p_request_id,
    'command', 'reissue',
    'source_iteration_id', iteration_record.id,
    'result_iteration_id', new_iteration_id,
    'source_iteration_version', iteration_record.management_version + 1,
    'result_iteration_version', 1,
    'iteration_number', new_iteration_number,
    'target_teaching_session_id', target_record.teaching_session_id,
    'target_revision_session_id', target_record.id,
    'assignments', result_assignments
  );

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
    authorized_organization_id,
    p_actor_id,
    'task.iteration_reissued',
    'task_iteration',
    new_iteration_id,
    jsonb_build_object(
      'class_id', p_class_id,
      'request_id', p_request_id,
      'source_iteration_id', iteration_record.id,
      'assignment_ids', to_jsonb(p_assignment_ids),
      'target_teaching_session_id', target_record.teaching_session_id,
      'target_revision_session_id', target_record.id,
      'source_iteration_version', iteration_record.management_version + 1,
      'iteration_number', new_iteration_number
    ),
    p_staff_assignment_id,
    'plan.publish'
  );

  insert into public.task_schedule_command_receipts (
    organization_id,
    class_id,
    actor_id,
    authorizing_staff_assignment_id,
    request_id,
    command,
    source_iteration_id,
    target_teaching_session_id,
    target_revision_session_id,
    request_fingerprint,
    result
  ) values (
    authorized_organization_id,
    p_class_id,
    p_actor_id,
    p_staff_assignment_id,
    p_request_id,
    'reissue',
    iteration_record.id,
    target_record.teaching_session_id,
    target_record.id,
    fingerprint,
    result_payload
  );

  return result_payload;
end;
$$;

create or replace function public.get_student_day_projection_at(
  p_organization_id uuid,
  p_student_id uuid,
  p_reference_at timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with eligible_sessions as (
    select
      revision_session.id,
      revision_session.teaching_session_id,
      revision_session.organization_id,
      revision_session.class_id,
      revision_session.title,
      revision_session.subject,
      revision_session.starts_at,
      revision_session.ends_at,
      revision_session.position,
      plan.timezone_name,
      case
        when revision_session.starts_at <= p_reference_at
          and p_reference_at < revision_session.ends_at then 'current'
        when revision_session.ends_at <= p_reference_at then 'previous'
        else 'next'
      end as temporal_relation
    from public.class_memberships as student_membership
    join public.weekly_plans as plan
      on plan.class_id = student_membership.class_id
     and plan.organization_id = student_membership.organization_id
     and plan.active_revision_id is not null
    join public.plan_revision_sessions as revision_session
      on revision_session.revision_id = plan.active_revision_id
     and revision_session.weekly_plan_id = plan.id
     and revision_session.organization_id = plan.organization_id
     and revision_session.class_id = plan.class_id
    where student_membership.user_id = p_student_id
      and student_membership.organization_id = p_organization_id
      and student_membership.role = 'student'
      and (revision_session.starts_at at time zone plan.timezone_name)::date
        = (p_reference_at at time zone plan.timezone_name)::date
  ),
  chosen_sessions as (
    (select session.*
     from eligible_sessions as session
     where session.temporal_relation = 'previous'
     order by session.ends_at desc, session.id
     limit 1)
    union all
    (select session.*
     from eligible_sessions as session
     where session.temporal_relation = 'current'
     order by session.starts_at, session.id
     limit 1)
    union all
    (select session.*
     from eligible_sessions as session
     where session.temporal_relation = 'next'
     order by session.starts_at, session.id
     limit 1)
  ),
  projection as (
    select
      chosen.id,
      chosen.teaching_session_id,
      chosen.organization_id,
      chosen.class_id,
      chosen.title,
      chosen.subject,
      chosen.starts_at,
      chosen.ends_at,
      chosen.position,
      chosen.timezone_name,
      chosen.temporal_relation,
      case chosen.temporal_relation
        when 'previous' then 0
        when 'current' then 1
        else 2
      end as relation_position,
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'assignment_id', assignment.id,
            'title', task_definition.title,
            'description', task_definition.description,
            'subject', task_definition.subject,
            'estimated_minutes', task_definition.estimated_minutes,
            'support_level', task_definition.support_level,
            'points_value', assignment.points_value_snapshot,
            'status', task_state.status,
            'state_version', task_state.state_version,
            'schedule_version', assignment.schedule_version,
            'reopen_message', case
              when task_state.status <> 'reopened' then null
              else coalesce(
                nullif(btrim(reopen_transition.student_message), ''),
                case reopen_transition.reason_code
                  when 'continue_working' then 'Jobb litt videre med oppgaven.'
                  when 'completed_by_mistake' then 'Oppgaven ble markert ferdig ved en feil.'
                  when 'needs_review' then 'Se på oppgaven én gang til.'
                  else 'Oppgaven er åpnet igjen. Du kan jobbe videre.'
                end
              )
            end,
            'due_at', assignment.due_at
          ) order by
            case
              when assignment.scheduled_from_revision_session_id =
                revision_task.revision_session_id then 0
              else 1
            end,
            revision_task.position,
            iteration.iteration_number,
            assignment.created_at,
            assignment.id
        )
        from public.task_assignments as assignment
        join public.task_iterations as iteration
          on iteration.id = assignment.iteration_id
         and iteration.organization_id = assignment.organization_id
         and iteration.class_id = assignment.class_id
        join public.plan_revision_tasks as revision_task
          on revision_task.id = assignment.source_plan_revision_task_id
         and revision_task.plan_task_id = assignment.plan_task_id
         and revision_task.organization_id = assignment.organization_id
         and revision_task.class_id = assignment.class_id
         and revision_task.task_definition_id = assignment.task_definition_id
        join public.task_definitions as task_definition
          on task_definition.id = assignment.task_definition_id
         and task_definition.class_id = assignment.class_id
         and task_definition.organization_id = assignment.organization_id
         and task_definition.publication_status = 'published'
        join public.student_task_state as task_state
          on task_state.assignment_id = assignment.id
         and task_state.organization_id = assignment.organization_id
         and task_state.student_id = p_student_id
        left join public.task_state_transitions as reopen_transition
          on reopen_transition.id = task_state.last_transition_id
         and reopen_transition.organization_id = assignment.organization_id
         and reopen_transition.student_id = p_student_id
         and reopen_transition.assignment_id = assignment.id
        where assignment.student_id = p_student_id
          and assignment.scheduled_teaching_session_id =
            chosen.teaching_session_id
          and assignment.visible_from <= p_reference_at
      ), '[]'::jsonb) as tasks
    from chosen_sessions as chosen
  )
  select jsonb_build_object(
    'reference_at', p_reference_at,
    'local_date', coalesce(
      (p_reference_at at time zone (select timezone_name from projection limit 1))::date,
      (p_reference_at at time zone 'Europe/Oslo')::date
    ),
    'timezone', coalesce(
      (select timezone_name from projection limit 1),
      'Europe/Oslo'
    ),
    'sessions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', item.id,
          'teaching_session_id', item.teaching_session_id,
          'class_id', item.class_id,
          'title', item.title,
          'subject', item.subject,
          'starts_at', item.starts_at,
          'ends_at', item.ends_at,
          'relation', item.temporal_relation,
          'tasks', item.tasks
        ) order by item.relation_position, item.starts_at, item.id
      )
      from projection as item
    ), '[]'::jsonb)
  )
$$;

create or replace function public.request_student_help_v2(
  p_queue_session_id uuid,
  p_student_id uuid,
  p_request_id uuid,
  p_task_assignment_id uuid default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  queue_row public.help_queue_sessions;
  request_row public.help_requests;
  fingerprint text;
  prior_result jsonb;
  result jsonb;
  changed boolean := false;
begin
  perform public.lock_help_queue_command(p_student_id, p_request_id);
  fingerprint := md5(jsonb_build_object(
    'queue_session_id', p_queue_session_id,
    'task_assignment_id', p_task_assignment_id
  )::text);

  select queue.*
  into queue_row
  from public.help_queue_sessions as queue
  where queue.id = p_queue_session_id;
  if queue_row.id is null then
    raise exception 'Help queue was not found';
  end if;
  if not exists (
    select 1
    from public.class_memberships as class_membership
    join public.memberships as organization_membership
      on organization_membership.organization_id = class_membership.organization_id
     and organization_membership.user_id = class_membership.user_id
     and organization_membership.role = 'student'
    where class_membership.organization_id = queue_row.organization_id
      and class_membership.class_id = queue_row.class_id
      and class_membership.user_id = p_student_id
      and class_membership.role = 'student'
  ) then
    raise exception 'Student is not a member of the help queue class';
  end if;

  prior_result := public.read_help_queue_command_receipt(
    p_student_id,
    p_request_id,
    'request_help',
    fingerprint
  );
  if prior_result is not null then
    return prior_result;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('klar.help-queue-class:' || queue_row.class_id::text, 0)
  );
  perform pg_advisory_xact_lock(
    hashtextextended('klar.help-student:' || p_student_id::text, 0)
  );
  if not exists (
    select 1
    from public.class_memberships as class_membership
    join public.memberships as organization_membership
      on organization_membership.organization_id = class_membership.organization_id
     and organization_membership.user_id = class_membership.user_id
     and organization_membership.role = 'student'
    where class_membership.organization_id = queue_row.organization_id
      and class_membership.class_id = queue_row.class_id
      and class_membership.user_id = p_student_id
      and class_membership.role = 'student'
  ) then
    raise exception 'Student is not a member of the help queue class';
  end if;
  perform public.reconcile_help_queue_sessions(queue_row.class_id);
  select queue.*
  into queue_row
  from public.help_queue_sessions as queue
  where queue.id = p_queue_session_id
  for update;
  if queue_row.status <> 'open' then
    raise exception 'Help queue is not open for new requests';
  end if;

  if p_task_assignment_id is not null then
    perform assignment.id
    from public.task_assignments as assignment
    join public.plan_revision_sessions as queue_revision_session
      on queue_revision_session.id = queue_row.revision_session_id
     and queue_revision_session.organization_id = queue_row.organization_id
     and queue_revision_session.class_id = queue_row.class_id
    where assignment.id = p_task_assignment_id
      and assignment.organization_id = queue_row.organization_id
      and assignment.class_id = queue_row.class_id
      and assignment.student_id = p_student_id
      and assignment.scheduled_teaching_session_id =
        queue_revision_session.teaching_session_id
      and assignment.visible_from <= transaction_timestamp()
    for share of assignment;

    if not found then
      raise exception 'Task assignment is not part of the student and queue session';
    end if;
  end if;

  select request.*
  into request_row
  from public.help_requests as request
  where request.queue_session_id = queue_row.id
    and request.organization_id = queue_row.organization_id
    and request.student_id = p_student_id
    and request.status in ('waiting', 'claimed')
  order by request.requested_at, request.id
  limit 1
  for update;

  if request_row.id is null then
    insert into public.help_requests (
      organization_id,
      class_id,
      student_id,
      queue_session_id,
      task_assignment_id,
      expires_at
    ) values (
      queue_row.organization_id,
      queue_row.class_id,
      p_student_id,
      queue_row.id,
      p_task_assignment_id,
      'infinity'::timestamptz
    ) returning * into request_row;
    changed := true;

    insert into public.audit_events (
      organization_id,
      actor_id,
      event_name,
      entity_type,
      entity_id,
      metadata
    ) values (
      queue_row.organization_id,
      p_student_id,
      'help.requested',
      'help_request',
      request_row.id,
      jsonb_build_object(
        'class_id', queue_row.class_id,
        'queue_session_id', queue_row.id,
        'task_assignment_id', p_task_assignment_id
      )
    );
  elsif p_task_assignment_id is not null
    and request_row.task_assignment_id is null
  then
    update public.help_requests
    set task_assignment_id = p_task_assignment_id,
        updated_at = transaction_timestamp()
    where id = request_row.id
    returning * into request_row;
    changed := true;

    insert into public.audit_events (
      organization_id,
      actor_id,
      event_name,
      entity_type,
      entity_id,
      metadata
    ) values (
      queue_row.organization_id,
      p_student_id,
      'help.context_updated',
      'help_request',
      request_row.id,
      jsonb_build_object(
        'class_id', queue_row.class_id,
        'queue_session_id', queue_row.id,
        'task_assignment_id', p_task_assignment_id
      )
    );
  elsif p_task_assignment_id is not null
    and request_row.task_assignment_id is distinct from p_task_assignment_id
  then
    raise exception 'Help request is already linked to another task';
  end if;

  if changed then
    perform public.touch_help_queue_session(queue_row.id, p_student_id);
  end if;
  result := public.help_request_result(request_row, changed);
  perform public.store_help_queue_command_receipt(
    queue_row.organization_id,
    p_student_id,
    p_request_id,
    'request_help',
    fingerprint,
    queue_row.id,
    result
  );
  return result;
end;
$$;

create function public.complete_student_task_v2(
  p_organization_id uuid,
  p_assignment_id uuid,
  p_student_id uuid,
  p_request_id uuid,
  p_expected_state_version integer,
  p_expected_schedule_version integer
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_record record;
  receipt_record public.task_completion_v2_receipts%rowtype;
  result_payload jsonb;
begin
  if p_organization_id is null
    or p_assignment_id is null
    or p_student_id is null
    or p_request_id is null
    or p_expected_state_version is null
    or p_expected_state_version < 1
    or p_expected_schedule_version is null
    or p_expected_schedule_version < 1
  then
    raise exception 'Task completion preconditions are required';
  end if;

  select
    assignment.organization_id,
    assignment.class_id,
    assignment.student_id,
    assignment.schedule_version
  into target_record
  from public.task_assignments as assignment
  where assignment.id = p_assignment_id
    and assignment.organization_id = p_organization_id;

  if target_record.organization_id is null
    or target_record.student_id <> p_student_id
  then
    raise exception 'Task assignment is unavailable';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'klar.progress-v2-request:' || p_student_id::text || ':' ||
      p_request_id::text,
    0
  ));

  perform organization_membership.user_id
  from public.memberships as organization_membership
  join public.class_memberships as class_membership
    on class_membership.organization_id = organization_membership.organization_id
   and class_membership.user_id = organization_membership.user_id
   and class_membership.class_id = target_record.class_id
   and class_membership.role = 'student'
  where organization_membership.organization_id = target_record.organization_id
    and organization_membership.user_id = p_student_id
    and organization_membership.role = 'student'
  for share of organization_membership, class_membership;

  if not found then
    raise exception 'Student membership is unavailable';
  end if;

  select receipt.*
  into receipt_record
  from public.task_completion_v2_receipts as receipt
  where receipt.actor_id = p_student_id
    and receipt.request_id = p_request_id;

  if found then
    if receipt_record.organization_id <> p_organization_id
      or receipt_record.assignment_id <> p_assignment_id
      or receipt_record.student_id <> p_student_id
      or receipt_record.expected_state_version <> p_expected_state_version
      or receipt_record.expected_schedule_version <>
        p_expected_schedule_version
    then
      raise exception 'Request ID was already used with another payload';
    end if;
    return receipt_record.result;
  end if;

  if exists (
    select 1
    from public.task_undo_v2_receipts as undo_receipt
    where undo_receipt.actor_id = p_student_id
      and undo_receipt.request_id = p_request_id
  ) then
    raise exception 'Request ID was already used with another payload';
  end if;

  if exists (
    select 1
    from public.progress_command_receipts as legacy_receipt
    where legacy_receipt.actor_id = p_student_id
      and legacy_receipt.request_id = p_request_id
  ) then
    raise exception 'Request ID predates task schedule preconditions';
  end if;

  select
    assignment.organization_id,
    assignment.class_id,
    assignment.student_id,
    assignment.schedule_version,
    state.state_version
  into target_record
  from public.task_assignments as assignment
  join public.student_task_state as state
    on state.assignment_id = assignment.id
   and state.organization_id = assignment.organization_id
   and state.student_id = assignment.student_id
  where assignment.id = p_assignment_id
    and assignment.organization_id = p_organization_id
    and assignment.student_id = p_student_id
  for update of assignment, state;

  if target_record.organization_id is null then
    raise exception 'Task assignment is unavailable';
  end if;
  if target_record.state_version <> p_expected_state_version
    or target_record.schedule_version <> p_expected_schedule_version
  then
    raise exception 'Task assignment changed after it was opened';
  end if;

  result_payload := public.apply_task_progress_command(
    p_assignment_id,
    p_student_id,
    p_request_id,
    'complete',
    null,
    null,
    null
  );

  result_payload := result_payload || jsonb_build_object(
    'schedule_version', target_record.schedule_version
  );

  insert into public.task_completion_v2_receipts (
    organization_id,
    class_id,
    assignment_id,
    student_id,
    actor_id,
    request_id,
    expected_state_version,
    expected_schedule_version,
    result
  ) values (
    target_record.organization_id,
    target_record.class_id,
    p_assignment_id,
    p_student_id,
    p_student_id,
    p_request_id,
    p_expected_state_version,
    p_expected_schedule_version,
    result_payload
  );

  return result_payload;
end;
$$;

create function public.undo_student_task_completion_v2(
  p_organization_id uuid,
  p_assignment_id uuid,
  p_student_id uuid,
  p_request_id uuid,
  p_expected_state_version integer,
  p_expected_schedule_version integer
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_record record;
  receipt_record public.task_undo_v2_receipts%rowtype;
  result_payload jsonb;
begin
  if p_organization_id is null
    or p_assignment_id is null
    or p_student_id is null
    or p_request_id is null
    or p_expected_state_version is null
    or p_expected_state_version < 1
    or p_expected_schedule_version is null
    or p_expected_schedule_version < 1
  then
    raise exception 'Task undo preconditions are required';
  end if;

  select
    assignment.organization_id,
    assignment.class_id,
    assignment.student_id,
    assignment.schedule_version
  into target_record
  from public.task_assignments as assignment
  where assignment.id = p_assignment_id
    and assignment.organization_id = p_organization_id;

  if target_record.organization_id is null
    or target_record.student_id <> p_student_id
  then
    raise exception 'Task assignment is unavailable';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'klar.progress-v2-request:' || p_student_id::text || ':' ||
      p_request_id::text,
    0
  ));

  perform organization_membership.user_id
  from public.memberships as organization_membership
  join public.class_memberships as class_membership
    on class_membership.organization_id = organization_membership.organization_id
   and class_membership.user_id = organization_membership.user_id
   and class_membership.class_id = target_record.class_id
   and class_membership.role = 'student'
  where organization_membership.organization_id = p_organization_id
    and organization_membership.user_id = p_student_id
    and organization_membership.role = 'student'
  for share of organization_membership, class_membership;

  if not found then
    raise exception 'Student membership is unavailable';
  end if;

  select receipt.*
  into receipt_record
  from public.task_undo_v2_receipts as receipt
  where receipt.actor_id = p_student_id
    and receipt.request_id = p_request_id;

  if found then
    if receipt_record.organization_id <> p_organization_id
      or receipt_record.assignment_id <> p_assignment_id
      or receipt_record.student_id <> p_student_id
      or receipt_record.expected_state_version <> p_expected_state_version
      or receipt_record.expected_schedule_version <>
        p_expected_schedule_version
    then
      raise exception 'Request ID was already used with another payload';
    end if;
    return receipt_record.result;
  end if;

  if exists (
    select 1
    from public.task_completion_v2_receipts as completion_receipt
    where completion_receipt.actor_id = p_student_id
      and completion_receipt.request_id = p_request_id
  ) then
    raise exception 'Request ID was already used with another payload';
  end if;

  if exists (
    select 1
    from public.progress_command_receipts as legacy_receipt
    where legacy_receipt.actor_id = p_student_id
      and legacy_receipt.request_id = p_request_id
  ) then
    raise exception 'Request ID predates task schedule preconditions';
  end if;

  select
    assignment.organization_id,
    assignment.class_id,
    assignment.student_id,
    assignment.schedule_version,
    state.state_version
  into target_record
  from public.task_assignments as assignment
  join public.student_task_state as state
    on state.assignment_id = assignment.id
   and state.organization_id = assignment.organization_id
   and state.student_id = assignment.student_id
  where assignment.id = p_assignment_id
    and assignment.organization_id = p_organization_id
    and assignment.student_id = p_student_id
  for update of assignment, state;

  if target_record.organization_id is null then
    raise exception 'Task assignment is unavailable';
  end if;
  if target_record.state_version <> p_expected_state_version
    or target_record.schedule_version <> p_expected_schedule_version
  then
    raise exception 'Task assignment changed after it was opened';
  end if;

  result_payload := public.apply_task_progress_command(
    p_assignment_id,
    p_student_id,
    p_request_id,
    'undo',
    null,
    null,
    null
  );

  result_payload := result_payload || jsonb_build_object(
    'schedule_version', target_record.schedule_version
  );

  insert into public.task_undo_v2_receipts (
    organization_id,
    class_id,
    assignment_id,
    student_id,
    actor_id,
    request_id,
    expected_state_version,
    expected_schedule_version,
    result
  ) values (
    target_record.organization_id,
    target_record.class_id,
    p_assignment_id,
    p_student_id,
    p_student_id,
    p_request_id,
    p_expected_state_version,
    p_expected_schedule_version,
    result_payload
  );

  return result_payload;
end;
$$;

alter table public.task_iterations enable row level security;
alter table public.task_iterations force row level security;
alter table public.task_schedule_events enable row level security;
alter table public.task_schedule_events force row level security;
alter table public.task_schedule_command_receipts enable row level security;
alter table public.task_schedule_command_receipts force row level security;
alter table public.task_completion_v2_receipts enable row level security;
alter table public.task_completion_v2_receipts force row level security;
alter table public.task_undo_v2_receipts enable row level security;
alter table public.task_undo_v2_receipts force row level security;

revoke all on table
  public.task_iterations,
  public.task_schedule_events,
  public.task_schedule_command_receipts,
  public.task_completion_v2_receipts,
  public.task_undo_v2_receipts
from public, anon, authenticated, service_role;

grant select on table
  public.task_iterations,
  public.task_schedule_events,
  public.task_schedule_command_receipts,
  public.task_completion_v2_receipts,
  public.task_undo_v2_receipts
to service_role;

revoke all on table public.task_assignments from service_role;
grant select on table public.task_assignments to service_role;

revoke all on function public.prevent_task_schedule_history_mutation()
from public, anon, authenticated, service_role;
revoke all on function public.validate_task_iteration_shape()
from public, anon, authenticated, service_role;
revoke all on function public.prepare_task_assignment_schedule()
from public, anon, authenticated, service_role;
revoke all on function public.protect_task_assignment_schedule()
from public, anon, authenticated, service_role;
revoke all on function public.validate_task_assignment_roles()
from public, anon, authenticated, service_role;
revoke all on function public.lock_task_schedule_authorization(uuid, uuid, uuid)
from public, anon, authenticated, service_role;

revoke all on function public.move_task_iteration_v1(
  uuid,
  uuid,
  uuid[],
  integer[],
  integer[],
  uuid,
  integer,
  integer,
  uuid,
  uuid,
  uuid
) from public, anon, authenticated, service_role;

revoke all on function public.reissue_task_iteration_v1(
  uuid,
  uuid,
  uuid[],
  integer[],
  integer[],
  uuid,
  integer,
  integer,
  uuid,
  uuid,
  uuid
) from public, anon, authenticated, service_role;

revoke all on function public.complete_student_task_v2(
  uuid,
  uuid,
  uuid,
  uuid,
  integer,
  integer
) from public, anon, authenticated, service_role;

revoke all on function public.complete_student_task(uuid, uuid, uuid)
from public, anon, authenticated, service_role;

revoke all on function public.undo_student_task_completion_v2(
  uuid,
  uuid,
  uuid,
  uuid,
  integer,
  integer
) from public, anon, authenticated, service_role;

revoke all on function public.undo_student_task_completion(uuid, uuid, uuid)
from public, anon, authenticated, service_role;

grant execute on function public.move_task_iteration_v1(
  uuid,
  uuid,
  uuid[],
  integer[],
  integer[],
  uuid,
  integer,
  integer,
  uuid,
  uuid,
  uuid
) to service_role;

grant execute on function public.reissue_task_iteration_v1(
  uuid,
  uuid,
  uuid[],
  integer[],
  integer[],
  uuid,
  integer,
  integer,
  uuid,
  uuid,
  uuid
) to service_role;

grant execute on function public.complete_student_task_v2(
  uuid,
  uuid,
  uuid,
  uuid,
  integer,
  integer
) to service_role;

grant execute on function public.undo_student_task_completion_v2(
  uuid,
  uuid,
  uuid,
  uuid,
  integer,
  integer
) to service_role;

commit;
