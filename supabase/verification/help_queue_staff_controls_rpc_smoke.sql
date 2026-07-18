\set ON_ERROR_STOP on

begin;

do $$
#variable_conflict use_variable
declare
  organization_id uuid := 'b0000000-0000-4000-8000-000000000001';
  class_id uuid := 'c0000000-0000-4000-8000-000000000001';
  first_student_id uuid := 'a0000000-0000-4000-8000-000000000006';
  second_student_id uuid := 'a0000000-0000-4000-8000-000000000009';
  third_student_id uuid := 'a0000000-0000-4000-8000-00000000000b';
  first_staff_id uuid := 'a0000000-0000-4000-8000-000000000003';
  second_staff_id uuid := 'a0000000-0000-4000-8000-000000000004';
  first_staff_assignment_id uuid;
  second_staff_assignment_id uuid;
  queue_row public.help_queue_sessions;
  context_task_assignment_id uuid;
  first_request jsonb;
  second_request jsonb;
  third_request jsonb;
  no_op_result jsonb;
  move_result jsonb;
  move_retry jsonb;
  claim_result jsonb;
  release_result jsonb;
  reclaim_result jsonb;
  transfer_to_second jsonb;
  transfer_to_first jsonb;
  transfer_retry jsonb;
  resolve_result jsonb;
  staff_snapshot jsonb;
  first_staff_join jsonb;
  first_staff_join_retry jsonb;
  original_requested_at timestamptz;
  original_claimed_at timestamptz;
  student_signal_version bigint;
  activity_before_stale bigint;
  staff_signal_before_stale bigint;
  staff_signal_before_noop bigint;
  denial_message text;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (
    third_student_id,
    'help-staff-controls-third@verification.test',
    '{"display_name":"Elev kø tre"}'::jsonb
  );
  insert into public.memberships (
    organization_id, user_id, role, created_by
  ) values (
    organization_id,
    third_student_id,
    'student',
    'a0000000-0000-4000-8000-000000000001'
  );
  insert into public.class_memberships (
    class_id, organization_id, user_id, role, created_by
  ) values (
    class_id,
    organization_id,
    third_student_id,
    'student',
    'a0000000-0000-4000-8000-000000000001'
  );

  select queue.*
  into queue_row
  from public.help_queue_sessions as queue
  where queue.organization_id = organization_id
    and queue.class_id = class_id
    and queue.status = 'open';

  select assignment.id
  into first_staff_assignment_id
  from public.staff_assignments as assignment
  join public.staff_assignment_class_scopes as scope
    on scope.assignment_id = assignment.id
   and scope.organization_id = assignment.organization_id
  join public.staff_assignment_capabilities as capability
    on capability.assignment_id = assignment.id
   and capability.profile_version = assignment.profile_version
   and capability.capability = 'help_queue.manage'
  where assignment.user_id = first_staff_id
    and scope.class_id = class_id
    and assignment.revoked_at is null
    and assignment.starts_at <= transaction_timestamp()
    and (assignment.ends_at is null or transaction_timestamp() < assignment.ends_at)
  order by assignment.starts_at desc, assignment.id
  limit 1;
  select assignment.id
  into second_staff_assignment_id
  from public.staff_assignments as assignment
  join public.staff_assignment_class_scopes as scope
    on scope.assignment_id = assignment.id
   and scope.organization_id = assignment.organization_id
  join public.staff_assignment_capabilities as capability
    on capability.assignment_id = assignment.id
   and capability.profile_version = assignment.profile_version
   and capability.capability = 'help_queue.manage'
  where assignment.user_id = second_staff_id
    and scope.class_id = class_id
    and assignment.revoked_at is null
    and assignment.starts_at <= transaction_timestamp()
    and (assignment.ends_at is null or transaction_timestamp() < assignment.ends_at)
  order by assignment.starts_at desc, assignment.id
  limit 1;
  if first_staff_assignment_id is null or second_staff_assignment_id is null then
    raise exception 'E2 fixture lacks two authorized help queue managers';
  end if;

  first_staff_join := public.join_help_queue_staff_v1(
    queue_row.id,
    first_staff_id,
    first_staff_assignment_id,
    'e2510000-0000-4000-8000-000000000001'
  );
  first_staff_join_retry := public.join_help_queue_staff_v1(
    queue_row.id,
    first_staff_id,
    first_staff_assignment_id,
    'e2510000-0000-4000-8000-000000000001'
  );
  if first_staff_join is distinct from first_staff_join_retry
    or first_staff_join ->> 'changed' <> 'true'
    or first_staff_join ->> 'participating' <> 'true'
    or (first_staff_join ->> 'participant_count')::integer <> 2
    or (
      select count(*)
      from public.audit_events
      where event_name = 'help_queue.staff_joined'
        and actor_id = first_staff_id
        and metadata ->> 'queue_session_id' = queue_row.id::text
    ) <> 1
  then
    raise exception 'Shared queue join was not atomic and receipt-idempotent';
  end if;

  select assignment.id
  into context_task_assignment_id
  from public.task_assignments as assignment
  join public.plan_revision_tasks as revision_task
    on revision_task.id = assignment.source_plan_revision_task_id
  where assignment.student_id = first_student_id
    and revision_task.revision_session_id = queue_row.revision_session_id
  order by assignment.id
  limit 1;

  first_request := public.request_student_help_v2(
    queue_row.id,
    first_student_id,
    'e2500000-0000-4000-8000-000000000001',
    context_task_assignment_id
  );
  second_request := public.request_student_help_v2(
    queue_row.id,
    second_student_id,
    'e2500000-0000-4000-8000-000000000002',
    null
  );
  third_request := public.request_student_help_v2(
    queue_row.id,
    third_student_id,
    'e2500000-0000-4000-8000-000000000003',
    null
  );

  if not exists (
    select 1
    from public.help_queue_request_order
    where request_id = (first_request ->> 'request_id')::uuid
      and position = 1 and active
  ) or not exists (
    select 1
    from public.help_queue_request_order
    where request_id = (second_request ->> 'request_id')::uuid
      and position = 2 and active
  ) or not exists (
    select 1
    from public.help_queue_request_order
    where request_id = (third_request ->> 'request_id')::uuid
      and position = 3 and active
  ) then
    raise exception 'E2 did not append active requests in one contiguous order';
  end if;

  staff_snapshot := public.read_help_queue_staff_snapshot_v1(
    organization_id,
    class_id,
    queue_row.id
  );
  if staff_snapshot #>> '{queue,id}' is distinct from queue_row.id::text
    or staff_snapshot #>> '{queue,organization_id}' is distinct from organization_id::text
    or staff_snapshot #>> '{queue,class_id}' is distinct from class_id::text
    or staff_snapshot #>> '{queue,status}' is distinct from 'open'
    or jsonb_array_length(staff_snapshot -> 'order_rows') <> 3
    or jsonb_array_length(staff_snapshot -> 'request_rows') <> 3
    or (staff_snapshot #>> '{queue,activity_version}')::bigint is distinct from (
      select queue.activity_version
      from public.help_queue_sessions as queue
      where queue.id = queue_row.id
    )
    or (
      select array_agg((item ->> 'position')::integer order by ordinal)
      from jsonb_array_elements(staff_snapshot -> 'order_rows')
        with ordinality as snapshot_order(item, ordinal)
    ) <> array[1, 2, 3]
    or (
      select array_agg(item ->> 'request_id' order by item ->> 'request_id')
      from jsonb_array_elements(staff_snapshot -> 'order_rows') as item
    ) is distinct from (
      select array_agg(item ->> 'id' order by item ->> 'id')
      from jsonb_array_elements(staff_snapshot -> 'request_rows') as item
    )
    or public.read_help_queue_staff_snapshot_v1(
      organization_id,
      'c0000000-0000-4000-8000-000000000002',
      queue_row.id
    ) is not null
    or public.read_help_queue_staff_snapshot_v1(
      'b0000000-0000-4000-8000-000000000002',
      class_id,
      queue_row.id
    ) is not null
  then
    raise exception 'E2 staff snapshot is incomplete or not scope-bound';
  end if;

  select queue.* into queue_row
  from public.help_queue_sessions as queue
  where queue.id = queue_row.id;
  select signal.signal_version
  into staff_signal_before_noop
  from public.help_queue_signals as signal
  where signal.queue_session_id = queue_row.id
    and signal.staff_only;
  no_op_result := public.reorder_student_help_v1(
    queue_row.id,
    (first_request ->> 'request_id')::uuid,
    'first',
    'staff_coordination',
    queue_row.activity_version,
    first_staff_id,
    first_staff_assignment_id,
    'e2600000-0000-4000-8000-000000000001'
  );
  if no_op_result ->> 'changed' <> 'false'
    or (no_op_result ->> 'activity_version')::bigint <> queue_row.activity_version
    or exists (
      select 1 from public.audit_events
      where event_name = 'help.reordered'
        and entity_id = (first_request ->> 'request_id')::uuid
    )
    or (select signal_version from public.help_queue_signals
        where queue_session_id = queue_row.id and staff_only)
      is distinct from staff_signal_before_noop
  then
    raise exception 'Boundary reorder no-op produced audit or signal noise';
  end if;

  move_result := public.reorder_student_help_v1(
    queue_row.id,
    (third_request ->> 'request_id')::uuid,
    'first',
    'support_needed_now',
    queue_row.activity_version,
    first_staff_id,
    first_staff_assignment_id,
    'e2600000-0000-4000-8000-000000000002'
  );
  move_retry := public.reorder_student_help_v1(
    queue_row.id,
    (third_request ->> 'request_id')::uuid,
    'first',
    'support_needed_now',
    queue_row.activity_version,
    first_staff_id,
    first_staff_assignment_id,
    'e2600000-0000-4000-8000-000000000002'
  );
  if move_result is distinct from move_retry
    or move_result ->> 'changed' <> 'true'
    or not exists (
      select 1 from public.help_queue_request_order
      where request_id = (third_request ->> 'request_id')::uuid
        and position = 1
        and last_changed_by = first_staff_id
        and last_reason_code = 'support_needed_now'
        and last_changed_at is not null
    )
    or not exists (
      select 1 from public.help_queue_request_order
      where request_id = (first_request ->> 'request_id')::uuid and position = 2
    )
    or not exists (
      select 1 from public.help_queue_request_order
      where request_id = (second_request ->> 'request_id')::uuid and position = 3
    )
    or (select count(*) from public.audit_events
        where event_name = 'help.reordered'
          and entity_id = (third_request ->> 'request_id')::uuid) <> 1
    or (select count(*) from public.help_queue_signals
        where queue_session_id = queue_row.id and staff_only) <> 1
  then
    raise exception 'E2 reorder was not atomic, audited and receipt-idempotent';
  end if;

  denial_message := null;
  begin
    perform public.reorder_student_help_v1(
      queue_row.id,
      (third_request ->> 'request_id')::uuid,
      'down',
      'support_needed_now',
      queue_row.activity_version,
      first_staff_id,
      first_staff_assignment_id,
      'e2600000-0000-4000-8000-000000000002'
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from
    'Help queue request identifier was reused with another command'
  then
    raise exception 'Changed reorder fingerprint was not rejected: %', denial_message;
  end if;

  denial_message := null;
  begin
    perform public.reorder_student_help_v1(
      queue_row.id,
      (second_request ->> 'request_id')::uuid,
      'up',
      'short_clarification',
      queue_row.activity_version,
      second_staff_id,
      second_staff_assignment_id,
      'e2600000-0000-4000-8000-000000000003'
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from 'Help queue activity version is stale'
    or exists (
      select 1 from public.help_queue_command_receipts
      where actor_id = second_staff_id
        and request_id = 'e2600000-0000-4000-8000-000000000003'
    )
  then
    raise exception 'Stale reorder changed receipt state: %', denial_message;
  end if;

  select signal.signal_version
  into student_signal_version
  from public.help_queue_signals as signal
  where signal.queue_session_id = queue_row.id
    and signal.student_id = first_student_id;
  select request.requested_at
  into original_requested_at
  from public.help_requests as request
  where request.id = (first_request ->> 'request_id')::uuid;

  claim_result := public.claim_student_help_v3(
    (first_request ->> 'request_id')::uuid,
    (first_request ->> 'ownership_version')::bigint,
    first_staff_id,
    first_staff_assignment_id,
    'e2700000-0000-4000-8000-000000000001'
  );
  release_result := public.release_student_help_v1(
    (first_request ->> 'request_id')::uuid,
    (claim_result ->> 'ownership_version')::bigint,
    first_staff_id,
    first_staff_assignment_id,
    'e2700000-0000-4000-8000-000000000002'
  );
  if release_result ->> 'status' <> 'waiting'
    or (release_result ->> 'position')::integer <> 2
    or not exists (
      select 1 from public.help_requests as request
      where request.id = (first_request ->> 'request_id')::uuid
        and request.requested_at = original_requested_at
        and request.task_assignment_id is not distinct from context_task_assignment_id
        and request.claimed_by is null
        and request.claimed_at is null
        and request.ownership_changed_at is null
    )
  then
    raise exception 'E2 release did not preserve rank, context and FIFO identity';
  end if;

  reclaim_result := public.claim_student_help_v3(
    (first_request ->> 'request_id')::uuid,
    (release_result ->> 'ownership_version')::bigint,
    first_staff_id,
    first_staff_assignment_id,
    'e2700000-0000-4000-8000-000000000003'
  );
  select request.claimed_at
  into original_claimed_at
  from public.help_requests as request
  where request.id = (first_request ->> 'request_id')::uuid;
  transfer_to_second := public.transfer_student_help_v1(
    (first_request ->> 'request_id')::uuid,
    (reclaim_result ->> 'ownership_version')::bigint,
    first_staff_id,
    first_staff_assignment_id,
    second_staff_assignment_id,
    'e2700000-0000-4000-8000-000000000004'
  );
  transfer_to_first := public.transfer_student_help_v1(
    (first_request ->> 'request_id')::uuid,
    (transfer_to_second ->> 'ownership_version')::bigint,
    second_staff_id,
    second_staff_assignment_id,
    first_staff_assignment_id,
    'e2700000-0000-4000-8000-000000000005'
  );
  if transfer_to_first ->> 'claimed_by' <> first_staff_id::text
    or (transfer_to_first ->> 'position')::integer <> 2
    or not exists (
      select 1 from public.help_requests as request
      where request.id = (first_request ->> 'request_id')::uuid
        and request.claimed_by = first_staff_id
        and request.claimed_at = original_claimed_at
        and request.requested_at = original_requested_at
        and request.task_assignment_id is not distinct from context_task_assignment_id
    )
  then
    raise exception 'E2 transfer did not preserve claim time, rank and context';
  end if;

  select activity_version into activity_before_stale
  from public.help_queue_sessions where id = queue_row.id;
  select signal_version into staff_signal_before_stale
  from public.help_queue_signals
  where queue_session_id = queue_row.id and staff_only;
  denial_message := null;
  begin
    perform public.release_student_help_v1(
      (first_request ->> 'request_id')::uuid,
      (reclaim_result ->> 'ownership_version')::bigint,
      first_staff_id,
      first_staff_assignment_id,
      'e2700000-0000-4000-8000-000000000006'
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from 'Help request ownership version is stale' then
    raise exception 'ABA-stale release was not rejected: %', denial_message;
  end if;
  denial_message := null;
  begin
    perform public.resolve_student_help_v3(
      (first_request ->> 'request_id')::uuid,
      (reclaim_result ->> 'ownership_version')::bigint,
      first_staff_id,
      first_staff_assignment_id,
      'e2700000-0000-4000-8000-000000000007'
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from 'Help request ownership version is stale'
    or (select activity_version from public.help_queue_sessions
        where id = queue_row.id) <> activity_before_stale
    or (select signal_version from public.help_queue_signals
        where queue_session_id = queue_row.id and staff_only) <> staff_signal_before_stale
    or exists (
      select 1 from public.help_queue_command_receipts
      where actor_id = first_staff_id
        and request_id in (
          'e2700000-0000-4000-8000-000000000006',
          'e2700000-0000-4000-8000-000000000007'
        )
    )
  then
    raise exception 'ABA-stale ownership command changed state: %', denial_message;
  end if;

  transfer_retry := public.transfer_student_help_v1(
    (first_request ->> 'request_id')::uuid,
    (reclaim_result ->> 'ownership_version')::bigint,
    first_staff_id,
    first_staff_assignment_id,
    second_staff_assignment_id,
    'e2700000-0000-4000-8000-000000000004'
  );
  if transfer_retry is distinct from transfer_to_second
    or not exists (
      select 1 from public.help_requests
      where id = (first_request ->> 'request_id')::uuid
        and claimed_by = first_staff_id
        and ownership_version = (transfer_to_first ->> 'ownership_version')::bigint
    )
  then
    raise exception 'Receipt replay mutated the newer ownership generation';
  end if;

  if (select signal_version from public.help_queue_signals
      where queue_session_id = queue_row.id
        and student_id = first_student_id) <> student_signal_version
  then
    raise exception 'Internal E2 ownership or priority churn reached the student signal';
  end if;

  resolve_result := public.resolve_student_help_v3(
    (first_request ->> 'request_id')::uuid,
    (transfer_to_first ->> 'ownership_version')::bigint,
    first_staff_id,
    first_staff_assignment_id,
    'e2700000-0000-4000-8000-000000000008'
  );
  if resolve_result ->> 'status' <> 'resolved'
    or exists (
      select 1 from public.help_queue_request_order
      where request_id = (first_request ->> 'request_id')::uuid and active
    )
    or (select array_agg(position order by position)
        from public.help_queue_request_order
        where queue_session_id = queue_row.id and active) <> array[1,2]
  then
    raise exception 'E2 terminal transition did not compact the staff order';
  end if;
end;
$$;

do $$
declare
  function_row record;
begin
  select procedure.provolatile, procedure.prosecdef, procedure.proconfig
  into function_row
  from pg_proc as procedure
  where procedure.oid =
    'public.read_help_queue_staff_snapshot_v1(uuid,uuid,uuid)'::regprocedure;
  if has_function_privilege(
      'anon',
      'public.read_help_queue_staff_snapshot_v1(uuid,uuid,uuid)',
      'execute'
    )
    or has_function_privilege(
      'authenticated',
      'public.read_help_queue_staff_snapshot_v1(uuid,uuid,uuid)',
      'execute'
    )
    or not has_function_privilege(
      'service_role',
      'public.read_help_queue_staff_snapshot_v1(uuid,uuid,uuid)',
      'execute'
    )
    or has_function_privilege(
      'service_role',
      'public.claim_student_help_v2(uuid,uuid,uuid,uuid)',
      'execute'
    )
    or has_function_privilege(
      'service_role',
      'public.resolve_student_help_v2(uuid,uuid,uuid,uuid)',
      'execute'
    )
    or not has_function_privilege(
      'service_role',
      'public.claim_student_help_v3(uuid,bigint,uuid,uuid,uuid)',
      'execute'
    )
    or not has_function_privilege(
      'service_role',
      'public.resolve_student_help_v3(uuid,bigint,uuid,uuid,uuid)',
      'execute'
    )
    or function_row.provolatile <> 's'
    or function_row.prosecdef
    or not (
      'search_path=""' = any(
        coalesce(function_row.proconfig, array[]::text[])
      )
    )
  then
    raise exception 'E2 staff snapshot execute privileges are unsafe';
  end if;
end;
$$;

set local role service_role;
do $$
declare
  snapshot jsonb;
  queue_id uuid;
begin
  select queue.id
  into queue_id
  from public.help_queue_sessions as queue
  where queue.organization_id = 'b0000000-0000-4000-8000-000000000001'
    and queue.class_id = 'c0000000-0000-4000-8000-000000000001'
    and queue.status in ('open', 'closing')
  order by queue.id
  limit 1;
  snapshot := public.read_help_queue_staff_snapshot_v1(
    'b0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000001',
    queue_id
  );
  if snapshot #>> '{queue,id}' is distinct from queue_id::text
    or jsonb_array_length(snapshot -> 'order_rows') <> 2
    or jsonb_array_length(snapshot -> 'request_rows') <> 2
  then
    raise exception 'Service role cannot read the E2 staff snapshot';
  end if;
end;
$$;
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000006","aal":"aal1","role":"authenticated"}',
  true
);
do $$
begin
  if exists (
    select 1 from public.help_queue_signals where staff_only
  ) then
    raise exception 'Student can observe the E2 staff-only invalidation signal';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000004","aal":"aal2","role":"authenticated"}',
  true
);
do $$
begin
  if (select count(*) from public.help_queue_signals where staff_only) <> 1 then
    raise exception 'Authorized AAL2 staff cannot observe the E2 invalidation signal';
  end if;
  if not public.is_active_help_queue_staff_participant_v1(
    (
      select queue_session_id
      from public.help_queue_signals
      where staff_only
      limit 1
    )
  ) then
    raise exception 'Active queue participant was not recognized at the RLS boundary';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-00000000000a","aal":"aal2","role":"authenticated"}',
  true
);
do $$
begin
  if exists (
    select 1 from public.help_queue_signals where staff_only
  ) then
    raise exception 'Authorized non-participant can observe staff-only invalidation';
  end if;
  if not exists (
    select 1 from public.help_queue_signals where not staff_only
  ) then
    raise exception 'Authorized non-participant cannot discover queue lifecycle';
  end if;
end;
$$;

rollback;
