\set ON_ERROR_STOP on

do $$
declare
  mismatch_count integer;
begin
  if to_regclass('verification.d2_upgrade_assignment_baseline') is null then
    raise exception 'D2 upgrade baseline is missing';
  end if;

  select count(*)
  into mismatch_count
  from verification.d2_upgrade_assignment_baseline as baseline
  left join public.task_assignments as assignment
    on assignment.id = baseline.assignment_id
  left join public.student_task_state as state
    on state.assignment_id = baseline.assignment_id
  where assignment.id is null
    or row(
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
      state.last_transition_id
    ) is distinct from row(
      baseline.organization_id,
      baseline.class_id,
      baseline.task_definition_id,
      baseline.student_id,
      baseline.assigned_by,
      baseline.visible_from,
      baseline.due_at,
      baseline.created_at,
      baseline.points_value_snapshot,
      baseline.plan_task_id,
      baseline.source_plan_revision_task_id,
      baseline.status,
      baseline.completed_at,
      baseline.state_version,
      baseline.completion_sequence,
      baseline.reopened_at,
      baseline.active_completion_attempt_id,
      baseline.last_transition_id
    )
    or baseline.attempt_count <> (
      select count(*)
      from public.task_completion_attempts as attempt
      where attempt.assignment_id = baseline.assignment_id
    )
    or baseline.transition_count <> (
      select count(*)
      from public.task_state_transitions as transition
      where transition.assignment_id = baseline.assignment_id
    )
    or baseline.ledger_count <> (
      select count(*)
      from public.student_xp_ledger as ledger
      where ledger.assignment_id = baseline.assignment_id
    )
    or baseline.ledger_points <> (
      select coalesce(sum(ledger.points_delta), 0)
      from public.student_xp_ledger as ledger
      where ledger.assignment_id = baseline.assignment_id
    );
  if mismatch_count <> 0 then
    raise exception 'D2 changed % historical assignment graphs during upgrade', mismatch_count;
  end if;

  if (
    select count(*)
    from public.task_iterations as iteration
    where iteration.class_id = '83000000-0000-4000-8000-000000000002'
  ) <> 2 then
    raise exception 'D2 did not create one base iteration per historical plan task';
  end if;

  if exists (
    select 1
    from verification.d2_upgrade_assignment_baseline as baseline
    join public.task_assignments as assignment
      on assignment.id = baseline.assignment_id
    join public.task_iterations as iteration
      on iteration.id = assignment.iteration_id
    join public.plan_revision_tasks as revision_task
      on revision_task.id = baseline.source_plan_revision_task_id
    join public.plan_revision_sessions as revision_session
      on revision_session.id = revision_task.revision_session_id
    where iteration.id <> overlay(
        overlay(
          md5('klar-d2-base-iteration:' || baseline.plan_task_id::text)
          placing '5' from 13 for 1
        ) placing '8' from 17 for 1
      )::uuid
      or iteration.plan_task_id <> baseline.plan_task_id
      or iteration.source_plan_revision_task_id <>
        baseline.source_plan_revision_task_id
      or iteration.iteration_number <> 1
      or iteration.reissued_from_iteration_id is not null
      or iteration.created_by_staff_assignment_id is not null
      or iteration.management_version <> 1
      or assignment.schedule_version <> 1
      or assignment.scheduled_from_revision_session_id <> revision_session.id
      or assignment.scheduled_teaching_session_id <>
        revision_session.teaching_session_id
  ) then
    raise exception 'D2 base-iteration or original schedule backfill is inconsistent';
  end if;

  if exists (
    select 1
    from public.task_assignments as first_assignment
    join public.task_assignments as second_assignment
      on second_assignment.plan_task_id = first_assignment.plan_task_id
    where first_assignment.id in (
      select assignment_id
      from verification.d2_upgrade_assignment_baseline
    )
      and second_assignment.id in (
        select assignment_id
        from verification.d2_upgrade_assignment_baseline
      )
      and first_assignment.iteration_id <> second_assignment.iteration_id
  ) then
    raise exception 'Recipients from one original dispatch did not share an iteration';
  end if;

  if exists (
    select 1
    from public.task_assignments as assignment
    where assignment.id = '85000000-0000-4000-8000-000000000001'
      and (
        assignment.iteration_id is not null
        or assignment.scheduled_teaching_session_id is not null
        or assignment.scheduled_from_revision_session_id is not null
        or assignment.schedule_version <> 1
      )
  ) then
    raise exception 'D2 invented plan provenance for the loose legacy task';
  end if;

  if (select count(*) from public.task_schedule_events) <> 0
    or (select count(*) from public.task_schedule_command_receipts) <> 0
    or (select count(*) from public.task_completion_v2_receipts) <> 0
    or (select count(*) from public.task_undo_v2_receipts) <> 0
    or exists (
      select 1
      from public.audit_events
      where event_name in ('task.iteration_moved', 'task.iteration_reissued')
    )
  then
    raise exception 'D2 invented command history during upgrade';
  end if;

  if (
    select count(*)
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = any(array[
        'task_iterations',
        'task_schedule_events',
        'task_schedule_command_receipts',
        'task_completion_v2_receipts',
        'task_undo_v2_receipts'
      ])
      and relation.relrowsecurity
      and relation.relforcerowsecurity
  ) <> 5 then
    raise exception 'D2 upgrade did not force RLS on every private table';
  end if;

  if not exists (
    select 1
    from public.staff_assignments as assignment
    join verification.d2_upgrade_assignment_baseline as baseline
      on baseline.assigned_by = assignment.user_id
     and baseline.organization_id = assignment.organization_id
    where assignment.revoked_at is not null
  ) then
    raise exception 'D2 upgrade did not exercise a revoked historical publisher';
  end if;
end;
$$;
