\set ON_ERROR_STOP on

begin;

do $$
declare
  signature text;
  browser_role text;
begin
  if has_function_privilege(
    'service_role',
    'public.request_student_help(uuid,uuid,uuid)',
    'EXECUTE'
  ) or has_function_privilege(
    'service_role',
    'public.claim_student_help(uuid,uuid,uuid)',
    'EXECUTE'
  ) then
    raise exception 'Legacy help queue RPC remains executable by the runtime role';
  end if;
  if not has_function_privilege(
    'service_role',
    'public.request_student_help_v2(uuid,uuid,uuid,uuid)',
    'EXECUTE'
  ) or not has_function_privilege(
    'service_role',
    'public.open_help_queue_session(uuid,uuid,uuid,uuid,uuid)',
    'EXECUTE'
  ) then
    raise exception 'Service role lacks the session help queue RPCs';
  end if;
  if has_function_privilege(
    'authenticated',
    'public.request_student_help_v2(uuid,uuid,uuid,uuid)',
    'EXECUTE'
  ) then
    raise exception 'Authenticated browser can execute the help queue mutation directly';
  end if;

  foreach signature in array array[
    'public.reconcile_help_queue_sessions(uuid)',
    'public.open_help_queue_session(uuid,uuid,uuid,uuid,uuid)',
    'public.begin_close_help_queue_session(uuid,integer,uuid,uuid,uuid)',
    'public.request_student_help_v2(uuid,uuid,uuid,uuid)',
    'public.cancel_student_help_v2(uuid,uuid,uuid)',
    'public.claim_student_help_v3(uuid,bigint,uuid,uuid,uuid)',
    'public.resolve_student_help_v3(uuid,bigint,uuid,uuid,uuid)',
    'public.reorder_student_help_v1(uuid,uuid,text,public.help_queue_priority_reason,bigint,uuid,uuid,uuid)',
    'public.release_student_help_v1(uuid,bigint,uuid,uuid,uuid)',
    'public.transfer_student_help_v1(uuid,bigint,uuid,uuid,uuid,uuid)'
  ] loop
    if not has_function_privilege('service_role', signature, 'EXECUTE') then
      raise exception 'Service role lacks E1 RPC: %', signature;
    end if;
    foreach browser_role in array array['anon', 'authenticated'] loop
      if has_function_privilege(browser_role, signature, 'EXECUTE') then
        raise exception 'Browser role % can execute E1 RPC %', browser_role, signature;
      end if;
    end loop;
  end loop;

  if has_function_privilege(
    'service_role',
    'public.claim_student_help_v2(uuid,uuid,uuid,uuid)',
    'EXECUTE'
  ) or has_function_privilege(
    'service_role',
    'public.resolve_student_help_v2(uuid,uuid,uuid,uuid)',
    'EXECUTE'
  ) then
    raise exception 'Service role can bypass E2 ownership-version checks';
  end if;

  foreach signature in array array[
    'public.lock_help_queue_command(uuid,uuid)',
    'public.read_help_queue_command_receipt(uuid,uuid,text,text)',
    'public.store_help_queue_command_receipt(uuid,uuid,uuid,text,text,uuid,jsonb)',
    'public.help_queue_result(public.help_queue_sessions,boolean)',
    'public.help_request_result(public.help_requests,boolean)',
    'public.help_queue_staff_command_result(public.help_requests,integer,bigint,boolean)',
    'public.touch_help_queue_signal(uuid,uuid)',
    'public.touch_help_queue_session(uuid,uuid)',
    'public.touch_help_queue_staff_signal(uuid)',
    'public.touch_help_queue_staff_activity(uuid)',
    'public.ensure_help_queue_signal_for_membership()',
    'public.validate_help_request_roles()',
    'public.normalize_help_request_ownership()',
    'public.bump_help_request_ownership_version()',
    'public.sync_help_queue_request_order()',
    'public.lock_help_queue_transfer_assignments(uuid,uuid,uuid,uuid)',
    'public.terminalize_student_help_scope(uuid,uuid,uuid,text)',
    'public.terminalize_help_on_membership_change()',
    'public.terminalize_help_on_organization_role_change()',
    'public.reconcile_help_after_staff_revocation()'
  ] loop
    if has_function_privilege('service_role', signature, 'EXECUTE')
      or has_function_privilege('anon', signature, 'EXECUTE')
      or has_function_privilege('authenticated', signature, 'EXECUTE')
    then
      raise exception 'Internal E1 helper is runtime-executable: %', signature;
    end if;
  end loop;

  if has_table_privilege('authenticated', 'public.help_queue_sessions', 'SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated', 'public.help_requests', 'SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated', 'public.help_queue_command_receipts', 'SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated', 'public.help_queue_request_order', 'SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated', 'public.help_queue_signals', 'INSERT,UPDATE,DELETE')
    or has_table_privilege('service_role', 'public.help_queue_request_order', 'INSERT,UPDATE,DELETE')
    or has_table_privilege('service_role', 'public.help_queue_signals', 'INSERT,UPDATE,DELETE')
    or has_table_privilege('anon', 'public.help_queue_signals', 'SELECT')
  then
    raise exception 'Authenticated browser retained internal E1 table privileges';
  end if;
  if not has_table_privilege(
    'authenticated',
    'public.help_queue_signals',
    'SELECT'
  ) then
    raise exception 'Authenticated browser lacks the read-only E1 signal';
  end if;
  if not has_table_privilege(
    'service_role',
    'public.help_queue_request_order',
    'SELECT'
  ) then
    raise exception 'Service role lacks the staff-only queue order';
  end if;
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'help_queue_signals'
  ) or exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename in (
        'help_requests',
        'help_queue_sessions',
        'help_queue_request_order'
      )
  ) then
    raise exception 'Realtime publication exposes the wrong E1 tables';
  end if;
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.help_queue_signals'::regclass
      and contype = 'f'
      and confdeltype = 'c'
  ) then
    raise exception 'Published E1 signals can still be cascade-deleted';
  end if;
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'help_queue_signals'
      and column_name in ('queue_session_id', 'student_id')
      and is_nullable <> 'YES'
  ) or not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.help_queue_signals'::regclass
      and contype = 'p'
      and pg_get_constraintdef(oid) = 'PRIMARY KEY (id)'
  ) then
    raise exception 'Published E1 signals lack the required tombstone shape';
  end if;
end;
$$;

do $$
#variable_conflict use_variable
declare
  organization_id uuid := 'b0000000-0000-4000-8000-000000000001';
  class_id uuid := 'c0000000-0000-4000-8000-000000000001';
  actor_id uuid := 'a0000000-0000-4000-8000-000000000004';
  student_id uuid := 'a0000000-0000-4000-8000-000000000006';
  second_student_id uuid := 'a0000000-0000-4000-8000-000000000009';
  role_change_student_id uuid := 'a0000000-0000-4000-8000-000000000010';
  staff_assignment_id uuid;
  recovery_staff_assignment_id uuid;
  revoked_assignment_id uuid;
  queue_row public.help_queue_sessions;
  assignment_id uuid;
  second_assignment_id uuid;
  foreign_assignment_id uuid;
  request_result jsonb;
  retry_result jsonb;
  contextual_result jsonb;
  claim_result jsonb;
  resolve_result jsonb;
  close_result jsonb;
  cancel_result jsonb;
  recovery_request_result jsonb;
  role_change_request_result jsonb;
  role_change_signal_id uuid;
  original_requested_at timestamptz;
  denial_message text;
begin
  select queue.*
  into queue_row
  from public.help_queue_sessions as queue
  where queue.organization_id = organization_id
    and queue.class_id = class_id
    and queue.status = 'open';
  select assignment.id
  into staff_assignment_id
  from public.staff_assignments as assignment
  join public.staff_assignment_class_scopes as scope
    on scope.assignment_id = assignment.id
  where assignment.user_id = actor_id
    and scope.class_id = class_id
    and assignment.revoked_at is null
  order by assignment.starts_at desc, assignment.id
  limit 1;
  select assignment.id
  into revoked_assignment_id
  from public.staff_assignments as assignment
  where assignment.user_id = 'a0000000-0000-4000-8000-000000000008'
    and assignment.revoked_at is not null;
  select assignment.id
  into recovery_staff_assignment_id
  from public.staff_assignments as assignment
  join public.staff_assignment_class_scopes as scope
    on scope.assignment_id = assignment.id
  where assignment.user_id = 'a0000000-0000-4000-8000-000000000003'
    and scope.class_id = class_id
    and assignment.revoked_at is null
  limit 1;
  select task_assignment.id
  into assignment_id
  from public.task_assignments as task_assignment
  join public.plan_revision_tasks as revision_task
    on revision_task.id = task_assignment.source_plan_revision_task_id
  where revision_task.revision_session_id = queue_row.revision_session_id
    and task_assignment.student_id = student_id
  order by task_assignment.id
  limit 1;
  select task_assignment.id
  into second_assignment_id
  from public.task_assignments as task_assignment
  join public.plan_revision_tasks as revision_task
    on revision_task.id = task_assignment.source_plan_revision_task_id
  where revision_task.revision_session_id = queue_row.revision_session_id
    and task_assignment.student_id = student_id
    and task_assignment.id <> assignment_id
  order by task_assignment.id
  limit 1;
  select task_assignment.id
  into foreign_assignment_id
  from public.task_assignments as task_assignment
  join public.plan_revision_tasks as revision_task
    on revision_task.id = task_assignment.source_plan_revision_task_id
  where revision_task.revision_session_id = queue_row.revision_session_id
    and task_assignment.student_id = second_student_id
  order by task_assignment.id
  limit 1;

  retry_result := public.open_help_queue_session(
    class_id,
    queue_row.revision_session_id,
    actor_id,
    staff_assignment_id,
    'e1400000-0000-4000-8000-000000000001'
  );
  if retry_result ->> 'queue_session_id' <> queue_row.id::text
    or retry_result ->> 'changed' <> 'true'
    or (
      select count(*)
      from public.audit_events
      where event_name = 'help_queue.opened'
        and entity_id = queue_row.id
    ) <> 1
  then
    raise exception 'Open retry was not receipt-idempotent: %', retry_result;
  end if;

  denial_message := null;
  begin
    perform public.open_help_queue_session(
      class_id,
      queue_row.revision_session_id,
      'a0000000-0000-4000-8000-000000000008',
      revoked_assignment_id,
      'e1400000-0000-4000-8000-000000000002'
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from
    'Staff assignment does not authorize help queue management'
  then
    raise exception 'Revoked queue opener was not rejected: %', denial_message;
  end if;

  request_result := public.request_student_help_v2(
    queue_row.id,
    student_id,
    'e1500000-0000-4000-8000-000000000001',
    null
  );
  retry_result := public.request_student_help_v2(
    queue_row.id,
    student_id,
    'e1500000-0000-4000-8000-000000000001',
    null
  );
  if request_result is distinct from retry_result
    or request_result ->> 'changed' <> 'true'
    or (
      select count(*)
      from public.help_requests as active_request
      where active_request.queue_session_id = queue_row.id
        and active_request.student_id = student_id
        and status in ('waiting', 'claimed')
    ) <> 1
    or (
      select count(*)
      from public.audit_events
      where event_name = 'help.requested'
        and entity_id = (request_result ->> 'request_id')::uuid
    ) <> 1
  then
    raise exception 'Student help retry was not exactly idempotent';
  end if;
  original_requested_at := (request_result ->> 'requested_at')::timestamptz;

  contextual_result := public.request_student_help_v2(
    queue_row.id,
    student_id,
    'e1500000-0000-4000-8000-000000000002',
    assignment_id
  );
  if contextual_result ->> 'request_id' <> request_result ->> 'request_id'
    or (contextual_result ->> 'requested_at')::timestamptz <> original_requested_at
    or contextual_result ->> 'task_assignment_id' <> assignment_id::text
    or (
      select count(*)
      from public.audit_events
      where event_name = 'help.context_updated'
        and entity_id = (request_result ->> 'request_id')::uuid
    ) <> 1
  then
    raise exception 'Task context reset identity or FIFO time: %', contextual_result;
  end if;

  denial_message := null;
  begin
    perform public.request_student_help_v2(
      queue_row.id,
      student_id,
      'e1500000-0000-4000-8000-000000000007',
      second_assignment_id
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from
      'Help request is already linked to another task'
    or not exists (
      select 1 from public.help_requests
      where id = (request_result ->> 'request_id')::uuid
        and task_assignment_id = assignment_id
        and requested_at = original_requested_at
    )
  then
    raise exception 'Task context switched silently after attachment: %', denial_message;
  end if;

  denial_message := null;
  begin
    perform public.request_student_help_v2(
      queue_row.id,
      second_student_id,
      'e1500000-0000-4000-8000-000000000003',
      assignment_id
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from
    'Task assignment is not part of the student and queue session'
  then
    raise exception 'Foreign task context was not rejected: %', denial_message;
  end if;

  denial_message := null;
  begin
    perform public.request_student_help_v2(
      queue_row.id,
      student_id,
      'e1500000-0000-4000-8000-000000000008',
      foreign_assignment_id
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from
    'Task assignment is not part of the student and queue session'
  then
    raise exception 'Real foreign pupil assignment was not rejected: %', denial_message;
  end if;

  claim_result := public.claim_student_help_v3(
    (request_result ->> 'request_id')::uuid,
    (request_result ->> 'ownership_version')::bigint,
    actor_id,
    staff_assignment_id,
    'e1600000-0000-4000-8000-000000000001'
  );
  resolve_result := public.resolve_student_help_v3(
    (request_result ->> 'request_id')::uuid,
    (claim_result ->> 'ownership_version')::bigint,
    actor_id,
    staff_assignment_id,
    'e1600000-0000-4000-8000-000000000002'
  );
  if claim_result ->> 'status' <> 'claimed'
    or resolve_result ->> 'status' <> 'resolved'
    or not exists (
      select 1
      from public.audit_events
      where entity_id = (request_result ->> 'request_id')::uuid
        and event_name = 'help.claimed'
        and authorizing_staff_assignment_id = staff_assignment_id
        and authorizing_capability = 'help_queue.manage'
    )
    or not exists (
      select 1
      from public.audit_events
      where entity_id = (request_result ->> 'request_id')::uuid
        and event_name = 'help.resolved'
        and authorizing_staff_assignment_id = staff_assignment_id
        and authorizing_capability = 'help_queue.manage'
    )
  then
    raise exception 'Claim/resolve lifecycle or audit attribution failed';
  end if;

  recovery_request_result := public.request_student_help_v2(
    queue_row.id,
    second_student_id,
    'e1500000-0000-4000-8000-000000000006',
    null
  );
  perform public.claim_student_help_v3(
    (recovery_request_result ->> 'request_id')::uuid,
    (recovery_request_result ->> 'ownership_version')::bigint,
    'a0000000-0000-4000-8000-000000000003',
    recovery_staff_assignment_id,
    'e1600000-0000-4000-8000-000000000003'
  );
  perform public.revoke_staff_assignment(
    organization_id,
    'a0000000-0000-4000-8000-000000000001',
    recovery_staff_assignment_id
  );
  if not exists (
    select 1
    from public.help_requests
    where id = (recovery_request_result ->> 'request_id')::uuid
      and status = 'waiting'
      and claimed_by is null
      and claimed_at is null
  ) or (
    select count(*)
    from public.audit_events
    where entity_id = (recovery_request_result ->> 'request_id')::uuid
      and event_name = 'help.requeued'
      and metadata ->> 'reason' = 'claimant_assignment_inactive'
  ) <> 1 then
    raise exception 'Inactive claimant did not return atomically to the queue';
  end if;
  delete from public.class_memberships as membership
  where membership.class_id = class_id
    and membership.organization_id = organization_id
    and membership.user_id = second_student_id;
  if exists (
    select 1
    from public.class_memberships as membership
    where membership.class_id = class_id
      and membership.organization_id = organization_id
      and membership.user_id = second_student_id
  ) or not exists (
    select 1
    from public.help_requests as request
    where request.id = (recovery_request_result ->> 'request_id')::uuid
      and request.status = 'expired'
  ) or (
    select count(*)
    from public.audit_events as event
    where event.entity_id = (recovery_request_result ->> 'request_id')::uuid
      and event.event_name = 'help.expired'
      and event.metadata ->> 'reason' = 'class_membership_removed'
  ) <> 1 then
    raise exception 'Membership removal did not preserve and terminalize help history';
  end if;

  insert into auth.users (id, email, raw_user_meta_data)
  values (
    role_change_student_id,
    'help-role-change@verification.test',
    '{"display_name":"Role change student"}'::jsonb
  );
  insert into public.memberships (
    organization_id, user_id, role, created_by
  ) values (
    organization_id,
    role_change_student_id,
    'student',
    'a0000000-0000-4000-8000-000000000001'
  );
  insert into public.class_memberships (
    class_id, organization_id, user_id, role, created_by
  ) values (
    class_id,
    organization_id,
    role_change_student_id,
    'student',
    'a0000000-0000-4000-8000-000000000001'
  );
  role_change_request_result := public.request_student_help_v2(
    queue_row.id,
    role_change_student_id,
    'e1500000-0000-4000-8000-00000000000a',
    null
  );
  select signal.id
  into role_change_signal_id
  from public.help_queue_signals as signal
  where signal.queue_session_id = queue_row.id
    and signal.student_id = role_change_student_id;
  update public.memberships
  set role = 'teacher'
  where memberships.organization_id = organization_id
    and memberships.user_id = role_change_student_id;
  update public.class_memberships
  set role = 'teacher'
  where class_memberships.class_id = class_id
    and class_memberships.organization_id = organization_id
    and class_memberships.user_id = role_change_student_id;
  if not exists (
    select 1
    from public.help_requests as request
    where request.id = (role_change_request_result ->> 'request_id')::uuid
      and request.status = 'expired'
  ) or exists (
    select 1
    from public.help_queue_signals as signal
    where signal.queue_session_id = queue_row.id
      and signal.student_id = role_change_student_id
  ) or not exists (
    select 1
    from public.help_queue_signals as signal
    where signal.id = role_change_signal_id
      and signal.queue_session_id = queue_row.id
      and signal.student_id is null
  ) or (
    select count(*)
    from public.audit_events as event
    where event.entity_id = (role_change_request_result ->> 'request_id')::uuid
      and event.event_name = 'help.expired'
      and event.metadata ->> 'reason' = 'organization_role_changed'
  ) <> 1 then
    raise exception 'Student role change retained active help state or signal access';
  end if;

  request_result := public.request_student_help_v2(
    queue_row.id,
    student_id,
    'e1500000-0000-4000-8000-000000000004',
    null
  );
  select queue.* into queue_row
  from public.help_queue_sessions as queue
  where queue.id = queue_row.id;
  close_result := public.begin_close_help_queue_session(
    queue_row.id,
    queue_row.lock_version,
    actor_id,
    staff_assignment_id,
    'e1700000-0000-4000-8000-000000000001'
  );
  if close_result ->> 'status' <> 'closing' then
    raise exception 'Queue with an active request did not enter closing';
  end if;

  denial_message := null;
  begin
    perform public.request_student_help_v2(
      queue_row.id,
      student_id,
      'e1500000-0000-4000-8000-000000000005',
      null
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from 'Help queue is not open for new requests' then
    raise exception 'Closing queue accepted a new request: %', denial_message;
  end if;

  cancel_result := public.cancel_student_help_v2(
    (request_result ->> 'request_id')::uuid,
    student_id,
    'e1800000-0000-4000-8000-000000000001'
  );
  if cancel_result ->> 'status' <> 'cancelled'
    or not exists (
      select 1
      from public.help_queue_sessions
      where id = queue_row.id and status = 'closed'
    )
  then
    raise exception 'Closing queue did not drain to closed';
  end if;
end;
$$;

rollback;

begin;

do $$
#variable_conflict use_variable
declare
  class_id uuid := 'c0000000-0000-4000-8000-000000000001';
  actor_id uuid := 'a0000000-0000-4000-8000-000000000004';
  student_id uuid := 'a0000000-0000-4000-8000-000000000006';
  queue_row public.help_queue_sessions;
  staff_assignment_id uuid;
  task_assignment_id uuid;
  request_result jsonb;
  denial_message text;
  audit_count integer;
  receipt_count integer;
begin
  select queue.* into queue_row
  from public.help_queue_sessions as queue
  where queue.class_id = class_id and queue.status = 'open';
  select assignment.id into staff_assignment_id
  from public.staff_assignments as assignment
  join public.staff_assignment_class_scopes as scope
    on scope.assignment_id = assignment.id
  where assignment.user_id = actor_id
    and scope.class_id = class_id
    and assignment.revoked_at is null
  limit 1;
  select assignment.id into task_assignment_id
  from public.task_assignments as assignment
  join public.plan_revision_tasks as revision_task
    on revision_task.id = assignment.source_plan_revision_task_id
  where revision_task.revision_session_id = queue_row.revision_session_id
    and assignment.student_id = student_id
  limit 1;

  select count(*) into audit_count
  from public.audit_events
  where entity_id = queue_row.id;
  select count(*) into receipt_count
  from public.help_queue_command_receipts
  where queue_session_id = queue_row.id;
  denial_message := null;
  begin
    perform public.begin_close_help_queue_session(
      queue_row.id,
      queue_row.lock_version + 1,
      actor_id,
      staff_assignment_id,
      'e1a00000-0000-4000-8000-000000000001'
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from 'Help queue version is stale'
    or not exists (
      select 1 from public.help_queue_sessions
      where id = queue_row.id
        and status = queue_row.status
        and lock_version = queue_row.lock_version
        and activity_version = queue_row.activity_version
    )
    or (select count(*) from public.audit_events where entity_id = queue_row.id) <> audit_count
    or (select count(*) from public.help_queue_command_receipts where queue_session_id = queue_row.id) <> receipt_count
  then
    raise exception 'Stale close changed queue, audit or receipt state: %', denial_message;
  end if;

  request_result := public.request_student_help_v2(
    queue_row.id,
    student_id,
    'e1a00000-0000-4000-8000-000000000002',
    null
  );
  denial_message := null;
  begin
    perform public.request_student_help_v2(
      queue_row.id,
      student_id,
      'e1a00000-0000-4000-8000-000000000002',
      task_assignment_id
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from
      'Help queue request identifier was reused with another command'
    or (select count(*) from public.help_queue_command_receipts as receipt
        where receipt.actor_id = student_id
          and receipt.request_id = 'e1a00000-0000-4000-8000-000000000002') <> 1
    or not exists (
      select 1 from public.help_requests as request
      where request.id = (request_result ->> 'request_id')::uuid
        and request.task_assignment_id is null
    )
  then
    raise exception
      'Conflicting idempotency fingerprint changed the request (denial=%, receipts=%, task=%)',
      denial_message,
      (select count(*)
       from public.help_queue_command_receipts as receipt
       where receipt.actor_id = student_id
         and receipt.request_id = 'e1a00000-0000-4000-8000-000000000002'),
      (select request.task_assignment_id
       from public.help_requests as request
       where request.id = (request_result ->> 'request_id')::uuid);
  end if;
end;
$$;

rollback;

begin;

do $$
declare
  queue_row public.help_queue_sessions;
begin
  select queue.* into queue_row
  from public.help_queue_sessions as queue
  where queue.class_id = 'c0000000-0000-4000-8000-000000000001'
    and queue.status = 'open';
  perform set_config('session_replication_role', 'replica', true);
  update public.plan_revision_sessions
  set ends_at = transaction_timestamp() - interval '1 second'
  where id = queue_row.revision_session_id;
  perform set_config('session_replication_role', 'origin', true);
  perform public.reconcile_help_queue_sessions(queue_row.class_id);
  if not exists (
    select 1 from public.help_queue_sessions
    where id = queue_row.id and status = 'closed'
  ) or (select count(*) from public.audit_events
        where entity_id = queue_row.id
          and event_name = 'help_queue.closing_started'
          and actor_id is null) <> 1
    or (select count(*) from public.audit_events
        where entity_id = queue_row.id
          and event_name = 'help_queue.closed'
          and actor_id is null) <> 1
  then
    raise exception 'Natural empty session end did not close and audit the queue';
  end if;
end;
$$;

rollback;

begin;

do $$
declare
  queue_row public.help_queue_sessions;
  request_result jsonb;
  denial_message text;
begin
  select queue.* into queue_row
  from public.help_queue_sessions as queue
  where queue.class_id = 'c0000000-0000-4000-8000-000000000001'
    and queue.status = 'open';
  request_result := public.request_student_help_v2(
    queue_row.id,
    'a0000000-0000-4000-8000-000000000006',
    'e1b00000-0000-4000-8000-000000000001',
    null
  );
  perform set_config('session_replication_role', 'replica', true);
  update public.plan_revision_sessions
  set ends_at = transaction_timestamp() - interval '1 second'
  where id = queue_row.revision_session_id;
  perform set_config('session_replication_role', 'origin', true);
  perform public.reconcile_help_queue_sessions(queue_row.class_id);
  if not exists (
    select 1 from public.help_queue_sessions
    where id = queue_row.id and status = 'closing'
  ) or not exists (
    select 1 from public.help_requests
    where id = (request_result ->> 'request_id')::uuid
      and status = 'waiting'
  ) then
    raise exception 'Natural session end did not preserve the active pupil';
  end if;
  denial_message := null;
  begin
    perform public.request_student_help_v2(
      queue_row.id,
      'a0000000-0000-4000-8000-000000000009',
      'e1b00000-0000-4000-8000-000000000002',
      null
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from 'Help queue is not open for new requests' then
    raise exception 'Natural closing queue accepted a new request: %', denial_message;
  end if;
  perform public.cancel_student_help_v2(
    (request_result ->> 'request_id')::uuid,
    'a0000000-0000-4000-8000-000000000006',
    'e1b00000-0000-4000-8000-000000000003'
  );
  if not exists (
    select 1 from public.help_queue_sessions
    where id = queue_row.id and status = 'closed'
  ) then
    raise exception 'Natural closing queue did not close after its final pupil left';
  end if;
end;
$$;

rollback;

begin;

create function pg_temp.force_help_request_audit_failure()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.event_name = 'help.requested'
    and new.actor_id = 'a0000000-0000-4000-8000-000000000009'
  then
    raise exception 'forced E1 audit failure';
  end if;
  return new;
end;
$$;

create trigger force_help_request_audit_failure
before insert on public.audit_events
for each row execute function pg_temp.force_help_request_audit_failure();

do $$
declare
  queue_id uuid;
  denial_message text;
begin
  select id into queue_id
  from public.help_queue_sessions
  where class_id = 'c0000000-0000-4000-8000-000000000001'
    and status = 'open';

  begin
    perform public.request_student_help_v2(
      queue_id,
      'a0000000-0000-4000-8000-000000000009',
      'e1900000-0000-4000-8000-000000000001',
      null
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from 'forced E1 audit failure'
    or exists (
      select 1 from public.help_requests
      where queue_session_id = queue_id
        and student_id = 'a0000000-0000-4000-8000-000000000009'
    )
    or exists (
      select 1 from public.help_queue_command_receipts
      where actor_id = 'a0000000-0000-4000-8000-000000000009'
        and request_id = 'e1900000-0000-4000-8000-000000000001'
    )
  then
    raise exception 'Late audit failure did not roll back request and receipt';
  end if;
end;
$$;

drop trigger force_help_request_audit_failure on public.audit_events;
drop function pg_temp.force_help_request_audit_failure();

do $$
declare
  queue_id uuid;
  retry_result jsonb;
begin
  select id into queue_id
  from public.help_queue_sessions
  where class_id = 'c0000000-0000-4000-8000-000000000001'
    and status = 'open';
  retry_result := public.request_student_help_v2(
    queue_id,
    'a0000000-0000-4000-8000-000000000009',
    'e1900000-0000-4000-8000-000000000001',
    null
  );
  if retry_result ->> 'status' <> 'waiting' then
    raise exception 'Request did not succeed after rolled-back audit failure';
  end if;
end;
$$;

rollback;

begin;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000006","aal":"aal1","role":"authenticated"}',
  true
);
do $$
begin
  if (select count(*) from public.help_queue_signals) <> 1 then
    raise exception 'Student could not discover their class queue signal';
  end if;
  if has_table_privilege('authenticated', 'public.help_requests', 'SELECT')
    or has_table_privilege('authenticated', 'public.help_queue_command_receipts', 'SELECT')
  then
    raise exception 'Internal request or receipt state is browser-readable';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000007","aal":"aal1","role":"authenticated"}',
  true
);
do $$
begin
  if (select count(*) from public.help_queue_signals) <> 0 then
    raise exception 'Student outside the queue class saw its signal';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000004","aal":"aal1","role":"authenticated"}',
  true
);
do $$
begin
  if (select count(*) from public.help_queue_signals) <> 0 then
    raise exception 'AAL1 staff saw the queue signal through staff capability';
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
  if (select count(distinct queue_session_id) from public.help_queue_signals) <> 1
    or (select count(*) from public.help_queue_signals) <> 3
  then
    raise exception 'AAL2 help manager could not read the queue signal';
  end if;
end;
$$;

rollback;
