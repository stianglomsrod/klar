\set ON_ERROR_STOP on

begin;

do $$
declare
  staff_assignment_id uuid;
  revoked_staff_assignment_id uuid;
  plan_lock_version integer;
  source_move record;
  source_reissue record;
  source_batch record;
  help_source_preserved record;
  help_source_stale record;
  help_queue_id uuid;
  target_two record;
  target_three record;
  target_four record;
  move_result jsonb;
  move_retry jsonb;
  reissue_result jsonb;
  reissue_retry jsonb;
  batch_result jsonb;
  batch_assignment_ids uuid[];
  batch_state_versions integer[];
  batch_schedule_versions integer[];
  stale_batch_schedule_versions integer[];
  denial_message text;
  role_message text;
  role_assignment_id uuid;
  role_index integer;
  role_actor_ids uuid[] := array[
    'a0000000-0000-4000-8000-000000000002'::uuid,
    'a0000000-0000-4000-8000-000000000003'::uuid,
    'a0000000-0000-4000-8000-000000000005'::uuid,
    'a0000000-0000-4000-8000-000000000004'::uuid
  ];
  role_labels public.staff_job_label[] := array[
    'contact_teacher'::public.staff_job_label,
    'subject_teacher'::public.staff_job_label,
    'special_educator'::public.staff_job_label,
    'substitute'::public.staff_job_label
  ];
  role_idempotency_ids uuid[] := array[
    'd2b10000-0000-4000-8000-000000000001'::uuid,
    'd2b10000-0000-4000-8000-000000000002'::uuid,
    'd2b10000-0000-4000-8000-000000000003'::uuid,
    'd2b10000-0000-4000-8000-000000000004'::uuid
  ];
  role_request_ids uuid[] := array[
    'd2b20000-0000-4000-8000-000000000001'::uuid,
    'd2b20000-0000-4000-8000-000000000002'::uuid,
    'd2b20000-0000-4000-8000-000000000003'::uuid,
    'd2b20000-0000-4000-8000-000000000004'::uuid
  ];
  help_request_result jsonb;
  graph_before jsonb;
  graph_after jsonb;
  day_projection jsonb;
begin
  select assignment.id
  into staff_assignment_id
  from public.staff_assignments as assignment
  join public.staff_assignment_class_scopes as scope
    on scope.assignment_id = assignment.id
   and scope.organization_id = assignment.organization_id
  where assignment.user_id = 'a0000000-0000-4000-8000-000000000004'
    and scope.class_id = 'c0000000-0000-4000-8000-000000000001'
    and assignment.revoked_at is null
  order by assignment.starts_at desc, assignment.id
  limit 1;

  select assignment.id
  into revoked_staff_assignment_id
  from public.staff_assignments as assignment
  where assignment.user_id = 'a0000000-0000-4000-8000-000000000008'
    and assignment.revoked_at is not null
  order by assignment.revoked_at desc, assignment.id
  limit 1;

  select plan.lock_version
  into plan_lock_version
  from public.weekly_plans as plan
  where plan.organization_id = 'b0000000-0000-4000-8000-000000000001'
    and plan.class_id = 'c0000000-0000-4000-8000-000000000001'
    and plan.week_start_date = '2099-07-13';

  select
    assignment.id as assignment_id,
    assignment.iteration_id,
    assignment.schedule_version,
    state.state_version,
    iteration.management_version
  into source_move
  from public.task_assignments as assignment
  join public.student_task_state as state
    on state.assignment_id = assignment.id
  join public.task_iterations as iteration
    on iteration.id = assignment.iteration_id
  join public.plan_revision_tasks as revision_task
    on revision_task.id = assignment.source_plan_revision_task_id
  join public.plan_revision_sessions as revision_session
    on revision_session.id = revision_task.revision_session_id
  join public.weekly_plans as source_plan
    on source_plan.id = revision_task.weekly_plan_id
  where assignment.organization_id = 'b0000000-0000-4000-8000-000000000001'
    and assignment.class_id = 'c0000000-0000-4000-8000-000000000001'
    and assignment.student_id = 'a0000000-0000-4000-8000-000000000006'
    and source_plan.week_start_date = '2099-07-13'
  order by revision_session.starts_at, revision_task.position
  limit 1;

  select
    assignment.id as assignment_id,
    assignment.iteration_id,
    assignment.schedule_version,
    state.state_version,
    iteration.management_version
  into source_reissue
  from public.task_assignments as assignment
  join public.student_task_state as state
    on state.assignment_id = assignment.id
  join public.task_iterations as iteration
    on iteration.id = assignment.iteration_id
  join public.plan_revision_tasks as revision_task
    on revision_task.id = assignment.source_plan_revision_task_id
  join public.plan_revision_sessions as revision_session
    on revision_session.id = revision_task.revision_session_id
  join public.weekly_plans as source_plan
    on source_plan.id = revision_task.weekly_plan_id
  where assignment.organization_id = 'b0000000-0000-4000-8000-000000000001'
    and assignment.class_id = 'c0000000-0000-4000-8000-000000000001'
    and assignment.student_id = 'a0000000-0000-4000-8000-000000000006'
    and source_plan.week_start_date = '2099-07-13'
  order by revision_session.starts_at, revision_task.position
  offset 1
  limit 1;

  select
    assignment.iteration_id,
    iteration.management_version
  into source_batch
  from public.task_assignments as assignment
  join public.task_iterations as iteration
    on iteration.id = assignment.iteration_id
  join public.plan_revision_tasks as revision_task
    on revision_task.id = assignment.source_plan_revision_task_id
  join public.plan_revision_sessions as revision_session
    on revision_session.id = revision_task.revision_session_id
  join public.weekly_plans as source_plan
    on source_plan.id = revision_task.weekly_plan_id
  where assignment.organization_id = 'b0000000-0000-4000-8000-000000000001'
    and assignment.class_id = 'c0000000-0000-4000-8000-000000000001'
    and assignment.student_id = 'a0000000-0000-4000-8000-000000000006'
    and source_plan.week_start_date = '2099-07-13'
  order by revision_session.starts_at, revision_task.position
  offset 2
  limit 1;

  select
    assignment.id as assignment_id,
    assignment.iteration_id,
    assignment.schedule_version,
    state.state_version,
    iteration.management_version
  into help_source_preserved
  from public.task_assignments as assignment
  join public.task_definitions as definition
    on definition.id = assignment.task_definition_id
  join public.student_task_state as state
    on state.assignment_id = assignment.id
  join public.task_iterations as iteration
    on iteration.id = assignment.iteration_id
  where assignment.organization_id = 'b0000000-0000-4000-8000-000000000001'
    and assignment.class_id = 'c0000000-0000-4000-8000-000000000001'
    and assignment.student_id = 'a0000000-0000-4000-8000-000000000015'
    and definition.title = 'Kontekstoppgave'
  limit 1;

  select
    assignment.id as assignment_id,
    assignment.iteration_id,
    assignment.schedule_version,
    state.state_version,
    iteration.management_version
  into help_source_stale
  from public.task_assignments as assignment
  join public.task_definitions as definition
    on definition.id = assignment.task_definition_id
  join public.student_task_state as state
    on state.assignment_id = assignment.id
  join public.task_iterations as iteration
    on iteration.id = assignment.iteration_id
  where assignment.organization_id = 'b0000000-0000-4000-8000-000000000001'
    and assignment.class_id = 'c0000000-0000-4000-8000-000000000001'
    and assignment.student_id = 'a0000000-0000-4000-8000-000000000015'
    and definition.title = 'Andre kontekstoppgave'
  limit 1;

  select queue.id
  into help_queue_id
  from public.help_queue_sessions as queue
  where queue.organization_id = 'b0000000-0000-4000-8000-000000000001'
    and queue.class_id = 'c0000000-0000-4000-8000-000000000001'
    and queue.status = 'open'
  limit 1;

  select
    array_agg(assignment.id order by assignment.id),
    array_agg(state.state_version order by assignment.id),
    array_agg(assignment.schedule_version order by assignment.id)
  into
    batch_assignment_ids,
    batch_state_versions,
    batch_schedule_versions
  from public.task_assignments as assignment
  join public.student_task_state as state
    on state.assignment_id = assignment.id
  where assignment.iteration_id = source_batch.iteration_id;

  select revision_session.id, revision_session.teaching_session_id
  into target_two
  from public.plan_revision_sessions as revision_session
  join public.weekly_plans as plan on plan.id = revision_session.weekly_plan_id
  where plan.organization_id = 'b0000000-0000-4000-8000-000000000001'
    and plan.class_id = 'c0000000-0000-4000-8000-000000000001'
    and plan.week_start_date = '2099-07-13'
  order by revision_session.starts_at
  offset 1
  limit 1;

  select revision_session.id, revision_session.teaching_session_id
  into target_three
  from public.plan_revision_sessions as revision_session
  join public.weekly_plans as plan on plan.id = revision_session.weekly_plan_id
  where plan.organization_id = 'b0000000-0000-4000-8000-000000000001'
    and plan.class_id = 'c0000000-0000-4000-8000-000000000001'
    and plan.week_start_date = '2099-07-13'
  order by revision_session.starts_at
  offset 2
  limit 1;

  select revision_session.id, revision_session.teaching_session_id
  into target_four
  from public.plan_revision_sessions as revision_session
  join public.weekly_plans as plan on plan.id = revision_session.weekly_plan_id
  where plan.organization_id = 'b0000000-0000-4000-8000-000000000001'
    and plan.class_id = 'c0000000-0000-4000-8000-000000000001'
    and plan.week_start_date = '2099-07-13'
  order by revision_session.starts_at
  offset 3
  limit 1;

  if staff_assignment_id is null
    or revoked_staff_assignment_id is null
    or source_move.assignment_id is null
    or source_reissue.assignment_id is null
    or source_batch.iteration_id is null
    or help_source_preserved.assignment_id is null
    or help_source_stale.assignment_id is null
    or help_queue_id is null
    or target_two.id is null
    or target_three.id is null
    or target_four.id is null
    or cardinality(batch_assignment_ids) <> 2
  then
    raise exception 'D2 smoke could not resolve its published source graph';
  end if;

  if (
    select count(distinct assignment.iteration_id)
    from public.task_assignments as assignment
    join public.plan_revision_tasks as revision_task
      on revision_task.id = assignment.source_plan_revision_task_id
    join public.weekly_plans as plan
      on plan.id = revision_task.weekly_plan_id
    where plan.organization_id = 'b0000000-0000-4000-8000-000000000001'
      and plan.class_id = 'c0000000-0000-4000-8000-000000000001'
      and plan.week_start_date = '2099-07-13'
  ) <> 3
    or exists (
      select 1
      from public.task_assignments as assignment
      where assignment.plan_task_id is not null
        and (
          assignment.iteration_id is null
          or assignment.scheduled_teaching_session_id is null
          or assignment.scheduled_from_revision_session_id is null
          or assignment.schedule_version <> 1
        )
    )
  then
    raise exception 'Initial weekly plan did not create deterministic D2 scheduling';
  end if;

  for role_index in 1..cardinality(role_labels) loop
    role_message := null;
    begin
      role_assignment_id := public.create_staff_assignment(
        'b0000000-0000-4000-8000-000000000001',
        'a0000000-0000-4000-8000-000000000001',
        role_actor_ids[role_index],
        'c0000000-0000-4000-8000-000000000001',
        role_labels[role_index],
        transaction_timestamp() - interval '1 hour',
        transaction_timestamp() + interval '1 day',
        role_idempotency_ids[role_index]
      );
      perform public.reissue_task_iteration_v1(
        'c0000000-0000-4000-8000-000000000001',
        source_reissue.iteration_id,
        array[source_reissue.assignment_id],
        array[source_reissue.state_version],
        array[source_reissue.schedule_version],
        target_four.id,
        source_reissue.management_version,
        plan_lock_version,
        role_actor_ids[role_index],
        role_assignment_id,
        role_request_ids[role_index]
      );
      raise exception 'D2 role authorization succeeded';
    exception when others then
      get stacked diagnostics role_message = message_text;
    end;
    if role_message is distinct from 'D2 role authorization succeeded' then
      raise exception 'D2 role % was not positively authorized: %',
        role_labels[role_index], role_message;
    end if;
  end loop;

  move_result := public.move_task_iteration_v1(
    'c0000000-0000-4000-8000-000000000001',
    source_move.iteration_id,
    array[source_move.assignment_id],
    array[source_move.state_version],
    array[source_move.schedule_version],
    target_two.id,
    source_move.management_version,
    plan_lock_version,
    'a0000000-0000-4000-8000-000000000004',
    staff_assignment_id,
    'd2000000-0000-4000-8000-000000000001'
  );

  move_retry := public.move_task_iteration_v1(
    'c0000000-0000-4000-8000-000000000001',
    source_move.iteration_id,
    array[source_move.assignment_id],
    array[source_move.state_version],
    array[source_move.schedule_version],
    target_two.id,
    source_move.management_version,
    plan_lock_version,
    'a0000000-0000-4000-8000-000000000004',
    staff_assignment_id,
    'd2000000-0000-4000-8000-000000000001'
  );

  if move_retry <> move_result
    or move_result ->> 'command' <> 'move'
    or move_result ->> 'source_iteration_id' <>
      source_move.iteration_id::text
    or move_result ->> 'result_iteration_id' <>
      source_move.iteration_id::text
    or move_result #>> '{assignments,0,assignment_id}' <>
      source_move.assignment_id::text
    or (move_result #>> '{assignments,0,schedule_version}')::integer <> 2
    or (
      select state.status
      from public.student_task_state as state
      where state.assignment_id = source_move.assignment_id
    ) <> 'assigned'
    or exists (
      select 1 from public.student_xp_ledger as ledger
      where ledger.assignment_id = source_move.assignment_id
    )
  then
    raise exception 'Move did not preserve assignment, status and XP: %', move_result;
  end if;

  denial_message := null;
  begin
    perform public.move_task_iteration_v1(
      'c0000000-0000-4000-8000-000000000001',
      source_move.iteration_id,
      array[source_move.assignment_id],
      array[source_move.state_version],
      array[source_move.schedule_version],
      target_three.id,
      source_move.management_version,
      plan_lock_version,
      'a0000000-0000-4000-8000-000000000004',
      staff_assignment_id,
      'd2000000-0000-4000-8000-000000000002'
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from 'Task iteration changed after preview' then
    raise exception 'Stale move was not rejected: %', denial_message;
  end if;

  reissue_result := public.reissue_task_iteration_v1(
    'c0000000-0000-4000-8000-000000000001',
    source_reissue.iteration_id,
    array[source_reissue.assignment_id],
    array[source_reissue.state_version],
    array[source_reissue.schedule_version],
    target_three.id,
    source_reissue.management_version,
    plan_lock_version,
    'a0000000-0000-4000-8000-000000000004',
    staff_assignment_id,
    'd2000000-0000-4000-8000-000000000003'
  );

  reissue_retry := public.reissue_task_iteration_v1(
    'c0000000-0000-4000-8000-000000000001',
    source_reissue.iteration_id,
    array[source_reissue.assignment_id],
    array[source_reissue.state_version],
    array[source_reissue.schedule_version],
    target_three.id,
    source_reissue.management_version,
    plan_lock_version,
    'a0000000-0000-4000-8000-000000000004',
    staff_assignment_id,
    'd2000000-0000-4000-8000-000000000003'
  );

  if reissue_retry <> reissue_result
    or reissue_result ->> 'command' <> 'reissue'
    or reissue_result ->> 'source_iteration_id' <>
      source_reissue.iteration_id::text
    or reissue_result ->> 'result_iteration_id' =
      source_reissue.iteration_id::text
    or reissue_result #>> '{assignments,0,source_assignment_id}' <>
      source_reissue.assignment_id::text
    or reissue_result #>> '{assignments,0,assignment_id}' =
      source_reissue.assignment_id::text
    or (reissue_result #>> '{assignments,0,state_version}')::integer <> 1
    or (reissue_result #>> '{assignments,0,schedule_version}')::integer <> 1
    or (
      select count(*)
      from public.student_task_state as state
      where state.assignment_id =
        (reissue_result #>> '{assignments,0,assignment_id}')::uuid
        and state.status = 'assigned'
    ) <> 1
    or exists (
      select 1
      from public.student_xp_ledger as ledger
      where ledger.assignment_id =
        (reissue_result #>> '{assignments,0,assignment_id}')::uuid
    )
  then
    raise exception 'Reissue did not create one clean independent assignment: %',
      reissue_result;
  end if;

  if (
    select row(
      assignment.iteration_id,
      assignment.scheduled_teaching_session_id,
      assignment.schedule_version,
      state.status,
      assignment.points_value_snapshot
    )
    from public.task_assignments as assignment
    join public.student_task_state as state on state.assignment_id = assignment.id
    where assignment.id = source_reissue.assignment_id
  ) is distinct from row(
    source_reissue.iteration_id,
    (
      select revision_session.teaching_session_id
      from public.plan_revision_sessions as revision_session
      join public.task_assignments as assignment
        on assignment.scheduled_from_revision_session_id = revision_session.id
      where assignment.id = source_reissue.assignment_id
    ),
    source_reissue.schedule_version,
    'assigned'::public.student_task_status,
    (
      select assignment.points_value_snapshot
      from public.task_assignments as assignment
      where assignment.id = source_reissue.assignment_id
    )
  ) then
    raise exception 'Reissue mutated the source assignment';
  end if;

  select jsonb_build_object(
    'iterations', (select count(*) from public.task_iterations),
    'assignments', (select count(*) from public.task_assignments),
    'states', (select count(*) from public.student_task_state),
    'events', (select count(*) from public.task_schedule_events),
    'receipts', (select count(*) from public.task_schedule_command_receipts),
    'audits', (select count(*) from public.audit_events)
  ) into graph_before;

  denial_message := null;
  begin
    perform public.reissue_task_iteration_v1(
      'c0000000-0000-4000-8000-000000000001',
      source_reissue.iteration_id,
      array[source_reissue.assignment_id],
      array[source_reissue.state_version],
      array[source_reissue.schedule_version],
      target_three.id,
      source_reissue.management_version + 1,
      plan_lock_version,
      'a0000000-0000-4000-8000-000000000004',
      staff_assignment_id,
      'd2000000-0000-4000-8000-000000000004'
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from
    'Student already has this plan task in the target session'
  then
    raise exception 'Duplicate target reissue was not rejected: %', denial_message;
  end if;

  select jsonb_build_object(
    'iterations', (select count(*) from public.task_iterations),
    'assignments', (select count(*) from public.task_assignments),
    'states', (select count(*) from public.student_task_state),
    'events', (select count(*) from public.task_schedule_events),
    'receipts', (select count(*) from public.task_schedule_command_receipts),
    'audits', (select count(*) from public.audit_events)
  ) into graph_after;
  if graph_after is distinct from graph_before then
    raise exception 'Rejected D2 command left a partial graph. Before %, after %',
      graph_before,
      graph_after;
  end if;

  day_projection := public.get_student_day_projection_at(
    'b0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000006',
    '2099-07-16T09:30:00Z'
  );
  if jsonb_array_length(day_projection #> '{sessions,1,tasks}') <> 2
    or not exists (
      select 1
      from jsonb_array_elements(day_projection #> '{sessions,1,tasks}') as task
      where task ->> 'assignment_id' = source_move.assignment_id::text
        and (task ->> 'schedule_version')::integer = 2
        and (task ->> 'state_version')::integer = 1
    )
  then
    raise exception 'Moved task is not projected once in the target session: %',
      day_projection;
  end if;

  day_projection := public.get_student_day_projection_at(
    'b0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000006',
    '2099-07-17T08:30:00Z'
  );
  if jsonb_array_length(day_projection #> '{sessions,0,tasks}') <> 2
    or not exists (
      select 1
      from jsonb_array_elements(day_projection #> '{sessions,0,tasks}') as task
      where task ->> 'assignment_id' =
        reissue_result #>> '{assignments,0,assignment_id}'
    )
  then
    raise exception 'Reissued task is not projected beside the untouched plan task: %',
      day_projection;
  end if;

  select jsonb_build_object(
    'iteration_version', (
      select iteration.management_version
      from public.task_iterations as iteration
      where iteration.id = source_batch.iteration_id
    ),
    'assignments', (
      select jsonb_agg(jsonb_build_object(
        'id', assignment.id,
        'session', assignment.scheduled_teaching_session_id,
        'revision_session', assignment.scheduled_from_revision_session_id,
        'schedule_version', assignment.schedule_version,
        'status', state.status,
        'state_version', state.state_version
      ) order by assignment.id)
      from public.task_assignments as assignment
      join public.student_task_state as state
        on state.assignment_id = assignment.id
      where assignment.iteration_id = source_batch.iteration_id
    ),
    'events', (select count(*) from public.task_schedule_events),
    'receipts', (select count(*) from public.task_schedule_command_receipts),
    'audits', (select count(*) from public.audit_events)
  ) into graph_before;

  stale_batch_schedule_versions := batch_schedule_versions;
  stale_batch_schedule_versions[2] := stale_batch_schedule_versions[2] + 1;
  denial_message := null;
  begin
    perform public.move_task_iteration_v1(
      'c0000000-0000-4000-8000-000000000001',
      source_batch.iteration_id,
      batch_assignment_ids,
      batch_state_versions,
      stale_batch_schedule_versions,
      target_four.id,
      source_batch.management_version,
      plan_lock_version,
      'a0000000-0000-4000-8000-000000000004',
      staff_assignment_id,
      'd2000000-0000-4000-8000-000000000005'
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from 'Task assignment changed after preview' then
    raise exception 'A stale recipient did not roll back the batch: %',
      denial_message;
  end if;

  select jsonb_build_object(
    'iteration_version', (
      select iteration.management_version
      from public.task_iterations as iteration
      where iteration.id = source_batch.iteration_id
    ),
    'assignments', (
      select jsonb_agg(jsonb_build_object(
        'id', assignment.id,
        'session', assignment.scheduled_teaching_session_id,
        'revision_session', assignment.scheduled_from_revision_session_id,
        'schedule_version', assignment.schedule_version,
        'status', state.status,
        'state_version', state.state_version
      ) order by assignment.id)
      from public.task_assignments as assignment
      join public.student_task_state as state
        on state.assignment_id = assignment.id
      where assignment.iteration_id = source_batch.iteration_id
    ),
    'events', (select count(*) from public.task_schedule_events),
    'receipts', (select count(*) from public.task_schedule_command_receipts),
    'audits', (select count(*) from public.audit_events)
  ) into graph_after;
  if graph_after is distinct from graph_before then
    raise exception 'A rejected two-recipient move left a partial graph';
  end if;

  batch_result := public.move_task_iteration_v1(
    'c0000000-0000-4000-8000-000000000001',
    source_batch.iteration_id,
    batch_assignment_ids,
    batch_state_versions,
    batch_schedule_versions,
    target_four.id,
    source_batch.management_version,
    plan_lock_version,
    'a0000000-0000-4000-8000-000000000004',
    staff_assignment_id,
    'd2000000-0000-4000-8000-000000000006'
  );
  if jsonb_array_length(batch_result -> 'assignments') <> 2
    or (batch_result ->> 'iteration_version')::integer <>
      source_batch.management_version + 1
    or (
      select count(*)
      from public.task_assignments as assignment
      join public.student_task_state as state
        on state.assignment_id = assignment.id
      where assignment.id = any(batch_assignment_ids)
        and assignment.scheduled_teaching_session_id =
          target_four.teaching_session_id
        and assignment.scheduled_from_revision_session_id = target_four.id
        and assignment.schedule_version = 2
        and state.status = 'assigned'
        and state.state_version = 1
    ) <> 2
    or (
      select count(*)
      from public.task_schedule_events as event
      where event.request_id = 'd2000000-0000-4000-8000-000000000006'
        and event.command = 'move'
    ) <> 2
  then
    raise exception 'The valid two-recipient move was not atomic: %', batch_result;
  end if;

  help_request_result := public.request_student_help_v2(
    help_queue_id,
    'a0000000-0000-4000-8000-000000000015',
    'd2d60000-0000-4000-8000-000000000001',
    help_source_preserved.assignment_id
  );
  perform public.move_task_iteration_v1(
    'c0000000-0000-4000-8000-000000000001',
    help_source_preserved.iteration_id,
    array[help_source_preserved.assignment_id],
    array[help_source_preserved.state_version],
    array[help_source_preserved.schedule_version],
    target_two.id,
    help_source_preserved.management_version,
    plan_lock_version,
    'a0000000-0000-4000-8000-000000000004',
    staff_assignment_id,
    'd2d50000-0000-4000-8000-000000000001'
  );
  if help_request_result ->> 'status' <> 'waiting'
    or not exists (
      select 1
      from public.help_requests as request
      where request.queue_session_id = help_queue_id
        and request.student_id = 'a0000000-0000-4000-8000-000000000015'
        and request.task_assignment_id = help_source_preserved.assignment_id
        and request.status = 'waiting'
    )
  then
    raise exception 'Move did not preserve active help context: %',
      help_request_result;
  end if;

  perform public.move_task_iteration_v1(
    'c0000000-0000-4000-8000-000000000001',
    help_source_stale.iteration_id,
    array[help_source_stale.assignment_id],
    array[help_source_stale.state_version],
    array[help_source_stale.schedule_version],
    target_three.id,
    help_source_stale.management_version,
    plan_lock_version,
    'a0000000-0000-4000-8000-000000000004',
    staff_assignment_id,
    'd2d50000-0000-4000-8000-000000000002'
  );
  denial_message := null;
  begin
    perform public.request_student_help_v2(
      help_queue_id,
      'a0000000-0000-4000-8000-000000000015',
      'd2d60000-0000-4000-8000-000000000002',
      help_source_stale.assignment_id
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from
      'Task assignment is not part of the student and queue session'
    or exists (
      select 1
      from public.help_queue_command_receipts as receipt
      where receipt.actor_id = 'a0000000-0000-4000-8000-000000000015'
        and receipt.request_id = 'd2d60000-0000-4000-8000-000000000002'
    )
  then
    raise exception 'Move-first help request was not rejected atomically: %',
      denial_message;
  end if;

  select jsonb_build_object(
    'iterations', (select count(*) from public.task_iterations),
    'assignments', (select count(*) from public.task_assignments),
    'states', (select count(*) from public.student_task_state),
    'events', (select count(*) from public.task_schedule_events),
    'receipts', (select count(*) from public.task_schedule_command_receipts),
    'audits', (select count(*) from public.audit_events)
  ) into graph_before;

  denial_message := null;
  begin
    perform public.move_task_iteration_v1(
      'c0000000-0000-4000-8000-000000000001',
      source_reissue.iteration_id,
      array[source_reissue.assignment_id],
      array[source_reissue.state_version],
      array[source_reissue.schedule_version],
      target_four.id,
      source_reissue.management_version + 1,
      plan_lock_version,
      'a0000000-0000-4000-8000-000000000002',
      staff_assignment_id,
      'd2000000-0000-4000-8000-000000000007'
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from
    'Staff assignment does not authorize task scheduling'
  then
    raise exception 'A stolen D2 staff assignment was not rejected: %',
      denial_message;
  end if;

  denial_message := null;
  begin
    perform public.move_task_iteration_v1(
      'c0000000-0000-4000-8000-000000000001',
      source_reissue.iteration_id,
      array[source_reissue.assignment_id],
      array[source_reissue.state_version],
      array[source_reissue.schedule_version],
      target_four.id,
      source_reissue.management_version + 1,
      plan_lock_version,
      'a0000000-0000-4000-8000-000000000008',
      revoked_staff_assignment_id,
      'd2000000-0000-4000-8000-000000000008'
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from
    'Staff assignment does not authorize task scheduling'
  then
    raise exception 'A revoked D2 staff assignment was not rejected: %',
      denial_message;
  end if;

  denial_message := null;
  begin
    perform public.move_task_iteration_v1(
      'c0000000-0000-4000-8000-000000000002',
      source_reissue.iteration_id,
      array[source_reissue.assignment_id],
      array[source_reissue.state_version],
      array[source_reissue.schedule_version],
      target_four.id,
      source_reissue.management_version + 1,
      plan_lock_version,
      'a0000000-0000-4000-8000-000000000004',
      staff_assignment_id,
      'd2000000-0000-4000-8000-000000000009'
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from
    'Staff assignment does not authorize task scheduling'
  then
    raise exception 'A cross-class D2 command was not rejected: %',
      denial_message;
  end if;

  denial_message := null;
  begin
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
    ) values (
      'd2a10000-0000-4000-8000-000000000001',
      'b0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000002',
      'substitute',
      transaction_timestamp() - interval '1 minute',
      transaction_timestamp() + interval '1 hour',
      'manual',
      'a0000000-0000-4000-8000-000000000002',
      'd2a20000-0000-4000-8000-000000000001',
      md5('d2-incomplete-capability-profile')
    );
    insert into public.staff_assignment_class_scopes (
      assignment_id,
      organization_id,
      class_id
    ) values (
      'd2a10000-0000-4000-8000-000000000001',
      'b0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000001'
    );
    insert into public.staff_assignment_capabilities (
      assignment_id,
      capability
    ) values (
      'd2a10000-0000-4000-8000-000000000001',
      'plan.publish'
    );

    perform public.reissue_task_iteration_v1(
      'c0000000-0000-4000-8000-000000000001',
      source_reissue.iteration_id,
      array[source_reissue.assignment_id],
      array[source_reissue.state_version],
      array[source_reissue.schedule_version],
      target_four.id,
      source_reissue.management_version + 1,
      plan_lock_version,
      'a0000000-0000-4000-8000-000000000002',
      'd2a10000-0000-4000-8000-000000000001',
      'd2000000-0000-4000-8000-000000000010'
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from
      'Staff assignment does not authorize task scheduling'
    or exists (
      select 1 from public.staff_assignments
      where id = 'd2a10000-0000-4000-8000-000000000001'
    )
  then
    raise exception 'A reduced D2 capability profile was not rejected: %',
      denial_message;
  end if;

  select jsonb_build_object(
    'iterations', (select count(*) from public.task_iterations),
    'assignments', (select count(*) from public.task_assignments),
    'states', (select count(*) from public.student_task_state),
    'events', (select count(*) from public.task_schedule_events),
    'receipts', (select count(*) from public.task_schedule_command_receipts),
    'audits', (select count(*) from public.audit_events)
  ) into graph_after;
  if graph_after is distinct from graph_before then
    raise exception 'Rejected D2 authorization changed the graph';
  end if;

  if (select count(*) from public.task_schedule_events where command = 'move') <> 5
    or (select count(*) from public.task_schedule_events where command = 'reissue') <> 1
    or (select count(*) from public.task_schedule_command_receipts) <> 5
    or exists (
      select 1
      from public.audit_events as audit
      where audit.event_name in ('task.iteration_moved', 'task.iteration_reissued')
        and (
          lower(audit.metadata::text) ~ '(les side|regn oppgave|elev progresjon|@)'
          or audit.metadata ?| array[
            'title',
            'description',
            'student_name',
            'display_name',
            'message',
            'task_text'
          ]
          or (
            audit.event_name = 'task.iteration_moved'
            and (
              not audit.metadata ?& array[
                'class_id',
                'request_id',
                'assignment_ids',
                'target_teaching_session_id',
                'target_revision_session_id',
                'iteration_version'
              ]
              or audit.metadata - array[
                'class_id',
                'request_id',
                'assignment_ids',
                'target_teaching_session_id',
                'target_revision_session_id',
                'iteration_version'
              ] <> '{}'::jsonb
            )
          )
          or (
            audit.event_name = 'task.iteration_reissued'
            and (
              not audit.metadata ?& array[
                'class_id',
                'request_id',
                'source_iteration_id',
                'assignment_ids',
                'target_teaching_session_id',
                'target_revision_session_id',
                'source_iteration_version',
                'iteration_number'
              ]
              or audit.metadata - array[
                'class_id',
                'request_id',
                'source_iteration_id',
                'assignment_ids',
                'target_teaching_session_id',
                'target_revision_session_id',
                'source_iteration_version',
                'iteration_number'
              ] <> '{}'::jsonb
            )
          )
          or audit.authorizing_staff_assignment_id is null
          or audit.authorizing_capability <> 'plan.publish'
        )
    )
  then
    raise exception 'D2 audit or receipt history is incomplete or leaks content';
  end if;

  if has_table_privilege('authenticated', 'public.task_iterations', 'SELECT')
    or has_table_privilege('authenticated', 'public.task_schedule_events', 'SELECT')
    or has_table_privilege('authenticated', 'public.task_completion_v2_receipts', 'SELECT')
    or has_table_privilege('authenticated', 'public.task_undo_v2_receipts', 'SELECT')
    or has_table_privilege('service_role', 'public.task_assignments', 'UPDATE')
    or has_table_privilege('service_role', 'public.task_iterations', 'INSERT')
    or has_table_privilege('service_role', 'public.task_completion_v2_receipts', 'INSERT')
    or has_table_privilege('service_role', 'public.task_undo_v2_receipts', 'INSERT')
    or has_function_privilege(
      'authenticated',
      'public.move_task_iteration_v1(uuid,uuid,uuid[],integer[],integer[],uuid,integer,integer,uuid,uuid,uuid)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'service_role',
      'public.move_task_iteration_v1(uuid,uuid,uuid[],integer[],integer[],uuid,integer,integer,uuid,uuid,uuid)',
      'EXECUTE'
    )
    or has_function_privilege(
      'service_role',
      'public.complete_student_task(uuid,uuid,uuid)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'service_role',
      'public.complete_student_task_v2(uuid,uuid,uuid,uuid,integer,integer)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'service_role',
      'public.undo_student_task_completion_v2(uuid,uuid,uuid,uuid,integer,integer)',
      'EXECUTE'
    )
    or has_function_privilege(
      'service_role',
      'public.undo_student_task_completion(uuid,uuid,uuid)',
      'EXECUTE'
    )
  then
    raise exception 'D2 privilege boundary is incomplete';
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
    raise exception 'Every D2 private table must have forced RLS';
  end if;
end;
$$;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000015","aal":"aal1","role":"authenticated"}',
  true
);

do $$
declare
  student_projection jsonb;
begin
  if exists (
    select 1
    from public.task_assignments as assignment
    join public.task_definitions as definition
      on definition.id = assignment.task_definition_id
    where assignment.student_id = 'a0000000-0000-4000-8000-000000000015'
      and definition.title in ('Kontekstoppgave', 'Andre kontekstoppgave')
  ) then
    raise exception 'Moved future assignments remained browser-readable';
  end if;

  student_projection := public.get_my_student_day_v1(
    'b0000000-0000-4000-8000-000000000001'
  );
  if student_projection::text like '%Kontekstoppgave%'
    or student_projection::text like '%Andre kontekstoppgave%'
  then
    raise exception 'Moved future assignments remained in the student projection: %',
      student_projection;
  end if;
end;
$$;

reset role;

rollback;
