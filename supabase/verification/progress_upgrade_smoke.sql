\set ON_ERROR_STOP on

do $$
declare
  state_record public.student_task_state%rowtype;
  attempt_record public.task_completion_attempts%rowtype;
  transition_record public.task_state_transitions%rowtype;
  ledger_record public.student_xp_ledger%rowtype;
  progress_record public.student_progress%rowtype;
begin
  select state.*
  into state_record
  from public.student_task_state as state
  where state.assignment_id = '85000000-0000-4000-8000-000000000001';

  if state_record.status <> 'completed'
    or state_record.completed_at <> '2026-02-04T08:00:00Z'
    or state_record.completion_sequence <> 1
    or state_record.state_version <> 2
    or state_record.active_completion_attempt_id is null
    or state_record.last_transition_id is null
  then
    raise exception 'Legacy completion state was not upgraded deterministically';
  end if;

  select attempt.*
  into attempt_record
  from public.task_completion_attempts as attempt
  where attempt.assignment_id = state_record.assignment_id;

  if attempt_record.id <> state_record.active_completion_attempt_id
    or attempt_record.sequence <> 1
    or attempt_record.points_value_snapshot <> 10
    or attempt_record.completed_at <> '2026-02-04T08:00:00Z'
    or attempt_record.completed_by <> '81000000-0000-4000-8000-000000000004'
    or attempt_record.id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    raise exception 'Legacy completion attempt backfill is inconsistent';
  end if;

  select transition.*
  into transition_record
  from public.task_state_transitions as transition
  where transition.assignment_id = state_record.assignment_id;

  if transition_record.id <> state_record.last_transition_id
    or transition_record.completion_attempt_id <> attempt_record.id
    or transition_record.command <> 'legacy_backfill'
    or transition_record.from_status <> 'assigned'
    or transition_record.to_status <> 'completed'
    or transition_record.actor_id <> '81000000-0000-4000-8000-000000000004'
  then
    raise exception 'Legacy state transition backfill is inconsistent';
  end if;

  select ledger.*
  into ledger_record
  from public.student_xp_ledger as ledger
  where ledger.assignment_id = state_record.assignment_id;

  if ledger_record.completion_attempt_id <> attempt_record.id
    or ledger_record.entry_kind <> 'credit'
    or ledger_record.points_delta <> 10
    or ledger_record.reverses_entry_id is not null
    or ledger_record.request_id <> attempt_record.request_id
  then
    raise exception 'Legacy XP credit backfill is inconsistent';
  end if;

  select progress.*
  into progress_record
  from public.student_progress as progress
  where progress.organization_id = '82000000-0000-4000-8000-000000000001'
    and progress.student_id = '81000000-0000-4000-8000-000000000004';

  if progress_record.xp_balance <> 10
    or progress_record.current_level <> 1
    or progress_record.highest_level <> 1
    or progress_record.xp_balance <> (
      select sum(ledger.points_delta)
      from public.student_xp_ledger as ledger
      where ledger.organization_id = progress_record.organization_id
        and ledger.student_id = progress_record.student_id
    )
  then
    raise exception 'Legacy progress cache does not reconcile with its ledger';
  end if;

  if (select count(*) from public.task_completion_attempts) <> 1
    or (select count(*) from public.task_state_transitions) <> 1
    or (select count(*) from public.student_xp_ledger) <> 1
    or (select count(*) from public.level_milestones) <> 0
    or (select count(*) from public.level_reward_entitlements) <> 0
    or (select count(*) from public.progress_command_receipts) <> 0
  then
    raise exception 'Legacy progress upgrade created unexpected history';
  end if;

  if not exists (
    select 1
    from public.audit_events as audit
    where audit.event_name = 'task.progress_backfilled'
      and audit.entity_id = state_record.assignment_id
      and audit.actor_id is null
      and audit.metadata ->> 'completion_attempt_id' = attempt_record.id::text
      and audit.metadata ->> 'ledger_entry_id' = ledger_record.id::text
      and audit.metadata ->> 'request_id' = attempt_record.request_id::text
      and (audit.metadata ->> 'points_delta')::integer = 10
  ) then
    raise exception 'Legacy progress audit is missing technical trace IDs';
  end if;

  if exists (
    select 1
    from public.staff_assignments as assignment
    where assignment.profile_version <> 'class_pedagogy_v2'
      or assignment.version <> 2
  ) or exists (
    select 1
    from public.staff_assignments as assignment
    left join public.staff_assignment_capabilities as capability
      on capability.assignment_id = assignment.id
      and capability.profile_version = assignment.profile_version
    group by assignment.id
    having count(capability.capability) <> 8
  ) then
    raise exception 'Staff capability profiles were not upgraded atomically to v2';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'student_task_state'
      and column_name = 'started_at'
  ) or to_regprocedure(
    'public.update_student_task_status(uuid,uuid,public.student_task_status)'
  ) is not null then
    raise exception 'Legacy in-progress state surface survived B1';
  end if;

  if (
    select count(*)
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = any(array[
        'task_completion_attempts',
        'task_state_transitions',
        'student_xp_ledger',
        'student_progress',
        'level_milestones',
        'level_reward_entitlements',
        'progress_command_receipts'
      ])
      and relation.relrowsecurity
  ) <> 7
    or has_table_privilege('service_role', 'public.student_task_state', 'UPDATE')
    or has_table_privilege('service_role', 'public.student_xp_ledger', 'INSERT')
    or has_function_privilege(
      'authenticated',
      'public.complete_student_task(uuid,uuid,uuid)',
      'EXECUTE'
    )
  then
    raise exception 'Progress security posture changed during upgrade';
  end if;
end;
$$;
