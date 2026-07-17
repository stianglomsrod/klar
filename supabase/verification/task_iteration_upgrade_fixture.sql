\set ON_ERROR_STOP on

create schema if not exists verification;

do $$
#variable_conflict use_variable
declare
  organization_id uuid := '82000000-0000-4000-8000-000000000001';
  class_id uuid := '83000000-0000-4000-8000-000000000002';
  actor_id uuid := '81000000-0000-4000-8000-000000000003';
  owner_id uuid := '81000000-0000-4000-8000-000000000001';
  completed_student_id uuid := '81000000-0000-4000-8000-000000000004';
  staff_assignment_id uuid;
  week_start date;
  session_starts_at timestamptz;
  session_ends_at timestamptz;
  publish_result jsonb;
  completed_assignment_id uuid;
  completion_result jsonb;
begin
  select assignment.id
  into staff_assignment_id
  from public.staff_assignments as assignment
  join public.staff_assignment_class_scopes as scope
    on scope.assignment_id = assignment.id
   and scope.organization_id = assignment.organization_id
  join public.staff_assignment_capabilities as plan_capability
    on plan_capability.assignment_id = assignment.id
   and plan_capability.profile_version = assignment.profile_version
   and plan_capability.capability = 'plan.publish'
  join public.staff_assignment_capabilities as task_capability
    on task_capability.assignment_id = assignment.id
   and task_capability.profile_version = assignment.profile_version
   and task_capability.capability = 'task.publish'
  where assignment.organization_id = organization_id
    and assignment.user_id = actor_id
    and scope.class_id = class_id
    and assignment.revoked_at is null
    and assignment.starts_at <= transaction_timestamp()
    and (assignment.ends_at is null or transaction_timestamp() < assignment.ends_at)
  order by assignment.starts_at desc, assignment.id
  limit 1;
  if staff_assignment_id is null then
    raise exception 'D2 upgrade fixture lacks a current publishing assignment';
  end if;

  week_start := (
    (transaction_timestamp() at time zone 'Europe/Oslo')::date
      - (extract(isodow from transaction_timestamp() at time zone 'Europe/Oslo')::integer - 1)
      - 14
  );
  session_starts_at := (
    (week_start + 1)::timestamp + time '09:00'
  ) at time zone 'Europe/Oslo';
  session_ends_at := (
    (week_start + 1)::timestamp + time '10:00'
  ) at time zone 'Europe/Oslo';

  publish_result := public.publish_initial_weekly_plan(
    class_id,
    actor_id,
    staff_assignment_id,
    week_start,
    'Europe/Oslo',
    0,
    'd2900000-0000-4000-8000-000000000001',
    repeat('d', 64),
    jsonb_build_object(
      'schema_version', 'weekly_plan_v1',
      'sessions', jsonb_build_array(jsonb_build_object(
        'logical_key', 'd2910000-0000-4000-8000-000000000001',
        'title', 'Historisk D2-økt',
        'subject', 'Norsk',
        'starts_at', session_starts_at,
        'ends_at', session_ends_at,
        'tasks', jsonb_build_array(
          jsonb_build_object(
            'logical_key', 'd2920000-0000-4000-8000-000000000001',
            'title', 'Historisk ferdig oppgave',
            'description', 'Syntetisk D2-oppgraderingsfixture.',
            'subject', 'Norsk',
            'estimated_minutes', 10,
            'support_level', 2
          ),
          jsonb_build_object(
            'logical_key', 'd2920000-0000-4000-8000-000000000002',
            'title', 'Historisk uferdig oppgave',
            'description', 'Syntetisk D2-oppgraderingsfixture.',
            'subject', 'Norsk',
            'estimated_minutes', 12,
            'support_level', 2
          )
        )
      ))
    )
  );
  if publish_result ->> 'already_published' <> 'false' then
    raise exception 'D2 upgrade fixture was unexpectedly replayed';
  end if;

  select assignment.id
  into completed_assignment_id
  from public.task_assignments as assignment
  join public.task_definitions as definition
    on definition.id = assignment.task_definition_id
  where assignment.class_id = class_id
    and assignment.student_id = completed_student_id
    and definition.title = 'Historisk ferdig oppgave';

  completion_result := public.complete_student_task(
    completed_assignment_id,
    completed_student_id,
    'd2930000-0000-4000-8000-000000000001'
  );
  if completion_result ->> 'status' <> 'completed' then
    raise exception 'D2 upgrade fixture completion failed: %', completion_result;
  end if;

  create table verification.d2_upgrade_assignment_baseline as
  select
    assignment.id as assignment_id,
    assignment.organization_id,
    assignment.class_id,
    assignment.task_definition_id,
    assignment.student_id,
    assignment.assigned_by,
    assignment.visible_from,
    assignment.due_at,
    assignment.created_at,
    assignment.points_value_snapshot,
    assignment.plan_task_id,
    assignment.source_plan_revision_task_id,
    state.status,
    state.completed_at,
    state.state_version,
    state.completion_sequence,
    state.reopened_at,
    state.active_completion_attempt_id,
    state.last_transition_id,
    (select count(*)::integer
     from public.task_completion_attempts as attempt
     where attempt.assignment_id = assignment.id) as attempt_count,
    (select count(*)::integer
     from public.task_state_transitions as transition
     where transition.assignment_id = assignment.id) as transition_count,
    (select count(*)::integer
     from public.student_xp_ledger as ledger
     where ledger.assignment_id = assignment.id) as ledger_count,
    (select coalesce(sum(ledger.points_delta), 0)::integer
     from public.student_xp_ledger as ledger
     where ledger.assignment_id = assignment.id) as ledger_points
  from public.task_assignments as assignment
  join public.student_task_state as state
    on state.assignment_id = assignment.id
  where assignment.class_id = class_id
    and assignment.plan_task_id is not null
    and assignment.source_plan_revision_task_id is not null;

  if (select count(*) from verification.d2_upgrade_assignment_baseline) <> 6 then
    raise exception 'D2 upgrade fixture expected six plan-linked assignments';
  end if;

  perform public.revoke_staff_assignment(
    organization_id,
    owner_id,
    staff_assignment_id
  );
  if not exists (
    select 1
    from public.staff_assignments as assignment
    where assignment.id = staff_assignment_id
      and assignment.revoked_at is not null
  ) then
    raise exception 'D2 upgrade fixture did not revoke the original publisher';
  end if;
end;
$$;
