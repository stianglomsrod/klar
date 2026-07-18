\set ON_ERROR_STOP on

begin;

do $$
#variable_conflict use_variable
declare
  organization_id uuid := 'b0000000-0000-4000-8000-000000000001';
  class_id uuid := 'c0000000-0000-4000-8000-000000000001';
  owner_id uuid := 'a0000000-0000-4000-8000-000000000001';
  student_id uuid := 'a0000000-0000-4000-8000-000000000006';
  rescue_staff_id uuid := 'a0000000-0000-4000-8000-000000000003';
  opening_staff_id uuid := 'a0000000-0000-4000-8000-000000000004';
  queue_row public.help_queue_sessions;
  assignment_row record;
  rescue_assignment_id uuid;
  revoked_count integer := 0;
  reconcile_count integer;
  signal_before bigint;
  request_result jsonb;
  rescue_join jsonb;
  rescue_join_retry jsonb;
  claim_result jsonb;
  resolve_result jsonb;
begin
  select queue.* into queue_row
  from public.help_queue_sessions as queue
  where queue.organization_id = organization_id
    and queue.class_id = class_id
    and queue.status = 'open';
  if queue_row.id is null then
    raise exception 'Resilience smoke cannot find the open fixture queue';
  end if;

  request_result := public.request_student_help_v2(
    queue_row.id,
    student_id,
    'e3300000-0000-4000-8000-000000000001',
    null
  );
  select signal.signal_version into signal_before
  from public.help_queue_signals as signal
  where signal.queue_session_id = queue_row.id
    and signal.staff_only;

  for assignment_row in
    select distinct assignment.id
    from public.staff_assignments as assignment
    join public.staff_assignment_class_scopes as scope
      on scope.assignment_id = assignment.id
     and scope.organization_id = assignment.organization_id
     and scope.class_id = class_id
    join public.staff_assignment_capabilities as capability
      on capability.assignment_id = assignment.id
     and capability.profile_version = assignment.profile_version
     and capability.capability = 'help_queue.manage'
    where assignment.organization_id = organization_id
      and assignment.user_id = opening_staff_id
      and assignment.revoked_at is null
      and assignment.starts_at <= transaction_timestamp()
      and (assignment.ends_at is null or transaction_timestamp() < assignment.ends_at)
    order by assignment.id
  loop
    perform public.revoke_staff_assignment(
      organization_id,
      owner_id,
      assignment_row.id
    );
    revoked_count := revoked_count + 1;
  end loop;
  if revoked_count = 0 then
    raise exception 'Resilience smoke could not revoke the opening staff assignment';
  end if;

  reconcile_count := public.reconcile_help_queue_staff_participants_v1(class_id);
  select queue.* into queue_row
  from public.help_queue_sessions as queue
  where queue.id = queue_row.id;
  if reconcile_count <> 0
    or queue_row.status <> 'closing'
    or exists (
      select 1
      from public.help_queue_staff_participants as participant
      where participant.queue_session_id = queue_row.id
        and participant.left_at is null
    )
    or not exists (
      select 1
      from public.help_queue_staff_participants as participant
      where participant.queue_session_id = queue_row.id
        and participant.user_id = opening_staff_id
        and participant.leave_reason = 'assignment_inactive'
        and participant.left_at is not null
    )
    or not exists (
      select 1
      from public.help_requests as request
      where request.id = (request_result ->> 'request_id')::uuid
        and request.status = 'waiting'
    )
    or not exists (
      select 1
      from public.help_queue_signals as signal
      where signal.queue_session_id = queue_row.id
        and signal.staff_only
        and signal.signal_version > signal_before
    )
  then
    raise exception 'Assignment revocation was not atomic and idempotent for queue participation';
  end if;

  select assignment.id into rescue_assignment_id
  from public.staff_assignments as assignment
  join public.staff_assignment_class_scopes as scope
    on scope.assignment_id = assignment.id
   and scope.organization_id = assignment.organization_id
   and scope.class_id = class_id
  join public.staff_assignment_capabilities as capability
    on capability.assignment_id = assignment.id
   and capability.profile_version = assignment.profile_version
   and capability.capability = 'help_queue.manage'
  where assignment.organization_id = organization_id
    and assignment.user_id = rescue_staff_id
    and assignment.revoked_at is null
    and assignment.starts_at <= transaction_timestamp()
    and (assignment.ends_at is null or transaction_timestamp() < assignment.ends_at)
  order by assignment.starts_at desc, assignment.id
  limit 1;
  if rescue_assignment_id is null then
    raise exception 'Resilience smoke lacks an authorized rescue staff assignment';
  end if;

  rescue_join := public.join_help_queue_staff_v1(
    queue_row.id,
    rescue_staff_id,
    rescue_assignment_id,
    'e3310000-0000-4000-8000-000000000001'
  );
  if rescue_join ->> 'status' <> 'closing'
    or rescue_join ->> 'participating' <> 'true'
    or (rescue_join ->> 'participant_count')::integer <> 1
  then
    raise exception 'Authorized staff could not rescue an orphaned closing queue';
  end if;
  claim_result := public.claim_student_help_v3(
    (request_result ->> 'request_id')::uuid,
    (request_result ->> 'ownership_version')::bigint,
    rescue_staff_id,
    rescue_assignment_id,
    'e3320000-0000-4000-8000-000000000001'
  );
  resolve_result := public.resolve_student_help_v3(
    (request_result ->> 'request_id')::uuid,
    (claim_result ->> 'ownership_version')::bigint,
    rescue_staff_id,
    rescue_assignment_id,
    'e3330000-0000-4000-8000-000000000001'
  );
  rescue_join_retry := public.join_help_queue_staff_v1(
    queue_row.id,
    rescue_staff_id,
    rescue_assignment_id,
    'e3310000-0000-4000-8000-000000000001'
  );
  if rescue_join_retry is distinct from rescue_join
    or resolve_result ->> 'status' <> 'resolved'
    or (select status from public.help_queue_sessions where id = queue_row.id) <> 'closed'
    or exists (
      select 1
      from public.help_queue_staff_participants as participant
      where participant.queue_session_id = queue_row.id
        and participant.left_at is null
    )
    or not exists (
      select 1
      from public.help_queue_staff_participants as participant
      where participant.queue_session_id = queue_row.id
        and participant.user_id = rescue_staff_id
        and participant.leave_reason = 'queue_closed'
    )
  then
    raise exception 'Rescued queue did not drain, close and preserve its join receipt';
  end if;
end;
$$;

rollback;

begin;

do $$
#variable_conflict use_variable
declare
  organization_id uuid := 'b0000000-0000-4000-8000-000000000001';
  class_id uuid := 'c0000000-0000-4000-8000-000000000001';
  student_id uuid := 'a0000000-0000-4000-8000-000000000006';
  rescue_staff_id uuid := 'a0000000-0000-4000-8000-000000000003';
  expiring_staff_id uuid := 'a0000000-0000-4000-8000-000000000004';
  queue_row public.help_queue_sessions;
  expiring_assignment_id uuid;
  rescue_assignment_id uuid;
  participant_id uuid;
  expired_count integer;
  reconcile_count integer;
  signal_before bigint;
  request_result jsonb;
  claim_result jsonb;
  rescue_join jsonb;
  rescue_claim jsonb;
  resolve_result jsonb;
begin
  select queue.* into queue_row
  from public.help_queue_sessions as queue
  where queue.organization_id = organization_id
    and queue.class_id = class_id
    and queue.status = 'open';
  select participant.id, participant.staff_assignment_id
  into participant_id, expiring_assignment_id
  from public.help_queue_staff_participants as participant
  where participant.queue_session_id = queue_row.id
    and participant.user_id = expiring_staff_id
    and participant.left_at is null;
  select assignment.id into rescue_assignment_id
  from public.staff_assignments as assignment
  join public.staff_assignment_class_scopes as scope
    on scope.assignment_id = assignment.id
   and scope.organization_id = assignment.organization_id
   and scope.class_id = class_id
  join public.staff_assignment_capabilities as capability
    on capability.assignment_id = assignment.id
   and capability.profile_version = assignment.profile_version
   and capability.capability = 'help_queue.manage'
  where assignment.organization_id = organization_id
    and assignment.user_id = rescue_staff_id
    and assignment.revoked_at is null
    and assignment.starts_at <= transaction_timestamp()
    and (assignment.ends_at is null or transaction_timestamp() < assignment.ends_at)
  order by assignment.starts_at desc, assignment.id
  limit 1;
  if queue_row.id is null
    or participant_id is null
    or expiring_assignment_id is null
    or rescue_assignment_id is null
  then
    raise exception 'Expiry resilience smoke lacks its queue or staff assignments';
  end if;

  request_result := public.request_student_help_v2(
    queue_row.id,
    student_id,
    'e3500000-0000-4000-8000-000000000001',
    null
  );
  claim_result := public.claim_student_help_v3(
    (request_result ->> 'request_id')::uuid,
    (request_result ->> 'ownership_version')::bigint,
    expiring_staff_id,
    expiring_assignment_id,
    'e3510000-0000-4000-8000-000000000001'
  );
  select signal.signal_version into signal_before
  from public.help_queue_signals as signal
  where signal.queue_session_id = queue_row.id
    and signal.staff_only;

  execute 'set local session_replication_role = replica';
  update public.staff_assignments as assignment
  set ends_at = transaction_timestamp()
  where assignment.organization_id = organization_id
    and assignment.user_id = expiring_staff_id
    and assignment.revoked_at is null
    and assignment.starts_at <= transaction_timestamp()
    and (assignment.ends_at is null or transaction_timestamp() < assignment.ends_at);
  get diagnostics expired_count = row_count;
  execute 'set local session_replication_role = origin';
  if expired_count = 0 then
    raise exception 'Expiry resilience smoke did not expire an active assignment';
  end if;

  reconcile_count := public.reconcile_expired_staff_assignments(organization_id);
  select queue.* into queue_row
  from public.help_queue_sessions as queue
  where queue.id = queue_row.id;
  if reconcile_count <> expired_count
    or queue_row.status <> 'closing'
    or exists (
      select 1 from public.help_queue_staff_participants
      where queue_session_id = queue_row.id and left_at is null
    )
    or not exists (
      select 1 from public.help_queue_staff_participants
      where id = participant_id
        and left_at is not null
        and leave_reason = 'assignment_inactive'
    )
    or not exists (
      select 1 from public.help_requests
      where id = (request_result ->> 'request_id')::uuid
        and status = 'waiting'
        and claimed_by is null
        and ownership_version = (claim_result ->> 'ownership_version')::bigint + 1
    )
    or (
      select count(*) from public.audit_events
      where entity_type = 'help_queue_staff_participant'
        and entity_id = participant_id
        and event_name = 'help_queue.staff_left'
        and metadata ->> 'reason' = 'assignment_inactive'
    ) <> 1
    or (
      select count(*) from public.audit_events
      where entity_id = (request_result ->> 'request_id')::uuid
        and event_name = 'help.requeued'
        and metadata ->> 'reason' = 'claimant_assignment_inactive'
    ) <> 1
    or not exists (
      select 1 from public.help_queue_signals
      where queue_session_id = queue_row.id
        and staff_only
        and signal_version > signal_before
    )
  then
    raise exception 'Assignment expiry did not atomically requeue work and close the orphaned queue';
  end if;

  reconcile_count := public.reconcile_help_queue_staff_participants_v1(class_id);
  if reconcile_count <> 0
    or (
      select count(*) from public.audit_events
      where entity_type = 'help_queue_staff_participant'
        and entity_id = participant_id
        and event_name = 'help_queue.staff_left'
        and metadata ->> 'reason' = 'assignment_inactive'
    ) <> 1
    or (
      select count(*) from public.audit_events
      where entity_id = (request_result ->> 'request_id')::uuid
        and event_name = 'help.requeued'
        and metadata ->> 'reason' = 'claimant_assignment_inactive'
    ) <> 1
  then
    raise exception 'Repeated expiry reconciliation duplicated state or audit';
  end if;

  rescue_join := public.join_help_queue_staff_v1(
    queue_row.id,
    rescue_staff_id,
    rescue_assignment_id,
    'e3520000-0000-4000-8000-000000000001'
  );
  rescue_claim := public.claim_student_help_v3(
    (request_result ->> 'request_id')::uuid,
    (claim_result ->> 'ownership_version')::bigint + 1,
    rescue_staff_id,
    rescue_assignment_id,
    'e3530000-0000-4000-8000-000000000001'
  );
  resolve_result := public.resolve_student_help_v3(
    (request_result ->> 'request_id')::uuid,
    (rescue_claim ->> 'ownership_version')::bigint,
    rescue_staff_id,
    rescue_assignment_id,
    'e3540000-0000-4000-8000-000000000001'
  );
  if rescue_join ->> 'status' <> 'closing'
    or rescue_join ->> 'participating' <> 'true'
    or resolve_result ->> 'status' <> 'resolved'
    or (select status from public.help_queue_sessions where id = queue_row.id) <> 'closed'
    or not exists (
      select 1 from public.help_queue_staff_participants
      where queue_session_id = queue_row.id
        and user_id = rescue_staff_id
        and left_at is not null
        and leave_reason = 'queue_closed'
    )
  then
    raise exception 'Expired orphan queue could not be rescued and drained';
  end if;
end;
$$;

rollback;

begin;

do $$
#variable_conflict use_variable
declare
  organization_id uuid := 'b0000000-0000-4000-8000-000000000001';
  class_id uuid := 'c0000000-0000-4000-8000-000000000001';
  owner_id uuid := 'a0000000-0000-4000-8000-000000000001';
  student_id uuid := 'a0000000-0000-4000-8000-000000000006';
  first_staff_id uuid := 'a0000000-0000-4000-8000-000000000003';
  second_staff_id uuid := 'a0000000-0000-4000-8000-000000000004';
  queue_row public.help_queue_sessions;
  first_assignment_id uuid;
  original_second_assignment_id uuid;
  overlapping_second_assignment_id uuid;
  second_participation_version bigint;
  request_result jsonb;
  claim_result jsonb;
  transfer_result jsonb;
  resolve_result jsonb;
  leave_result jsonb;
  join_original_request jsonb;
  join_new_request jsonb;
  denial_message text;
begin
  select queue.* into queue_row
  from public.help_queue_sessions as queue
  where queue.organization_id = organization_id
    and queue.class_id = class_id
    and queue.status = 'open';
  select participant.staff_assignment_id
  into original_second_assignment_id
  from public.help_queue_staff_participants as participant
  where participant.queue_session_id = queue_row.id
    and participant.user_id = second_staff_id
    and participant.left_at is null;
  select assignment.id into first_assignment_id
  from public.staff_assignments as assignment
  join public.staff_assignment_class_scopes as scope
    on scope.assignment_id = assignment.id
   and scope.class_id = class_id
  join public.staff_assignment_capabilities as capability
    on capability.assignment_id = assignment.id
   and capability.profile_version = assignment.profile_version
   and capability.capability = 'help_queue.manage'
  where assignment.organization_id = organization_id
    and assignment.user_id = first_staff_id
    and assignment.revoked_at is null
    and assignment.starts_at <= transaction_timestamp()
    and (assignment.ends_at is null or transaction_timestamp() < assignment.ends_at)
  order by assignment.starts_at desc, assignment.id
  limit 1;
  if queue_row.id is null
    or original_second_assignment_id is null
    or first_assignment_id is null
  then
    raise exception 'Overlap smoke lacks its queue or staff assignments';
  end if;

  overlapping_second_assignment_id := public.create_staff_assignment(
    organization_id,
    owner_id,
    second_staff_id,
    class_id,
    'substitute',
    transaction_timestamp() - interval '1 minute',
    transaction_timestamp() + interval '1 day',
    'e3400000-0000-4000-8000-000000000001'
  );
  if overlapping_second_assignment_id = original_second_assignment_id then
    raise exception 'Overlap smoke did not create a distinct assignment';
  end if;

  join_original_request := public.join_help_queue_staff_v1(
    queue_row.id,
    second_staff_id,
    original_second_assignment_id,
    'e3400000-0000-4000-8000-000000000002'
  );
  join_new_request := public.join_help_queue_staff_v1(
    queue_row.id,
    second_staff_id,
    overlapping_second_assignment_id,
    'e3400000-0000-4000-8000-000000000003'
  );
  denial_message := null;
  begin
    perform public.join_help_queue_staff_v1(
      queue_row.id,
      second_staff_id,
      overlapping_second_assignment_id,
      'e3400000-0000-4000-8000-000000000002'
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if join_original_request ->> 'changed' <> 'false'
    or join_new_request ->> 'changed' <> 'false'
    or denial_message is distinct from
      'Help queue request identifier was reused with another command'
    or (
      select count(*)
      from public.help_queue_command_receipts as receipt
      where receipt.actor_id = second_staff_id
        and receipt.command = 'join_queue'
        and receipt.request_id in (
          'e3400000-0000-4000-8000-000000000002',
          'e3400000-0000-4000-8000-000000000003'
        )
    ) <> 2
    or not exists (
      select 1
      from public.help_queue_staff_participants as participant
      where participant.queue_session_id = queue_row.id
        and participant.user_id = second_staff_id
        and participant.staff_assignment_id = original_second_assignment_id
        and participant.left_at is null
    )
  then
    raise exception 'Join idempotency changed participation or accepted another fingerprint: %',
      denial_message;
  end if;

  perform public.join_help_queue_staff_v1(
    queue_row.id,
    first_staff_id,
    first_assignment_id,
    'e3410000-0000-4000-8000-000000000001'
  );
  request_result := public.request_student_help_v2(
    queue_row.id,
    student_id,
    'e3420000-0000-4000-8000-000000000001',
    null
  );
  claim_result := public.claim_student_help_v3(
    (request_result ->> 'request_id')::uuid,
    (request_result ->> 'ownership_version')::bigint,
    first_staff_id,
    first_assignment_id,
    'e3430000-0000-4000-8000-000000000001'
  );
  transfer_result := public.transfer_student_help_v1(
    (request_result ->> 'request_id')::uuid,
    (claim_result ->> 'ownership_version')::bigint,
    first_staff_id,
    first_assignment_id,
    overlapping_second_assignment_id,
    'e3440000-0000-4000-8000-000000000001'
  );
  resolve_result := public.resolve_student_help_v3(
    (request_result ->> 'request_id')::uuid,
    (transfer_result ->> 'ownership_version')::bigint,
    second_staff_id,
    overlapping_second_assignment_id,
    'e3450000-0000-4000-8000-000000000001'
  );
  select participant.participation_version
  into second_participation_version
  from public.help_queue_staff_participants as participant
  where participant.queue_session_id = queue_row.id
    and participant.user_id = second_staff_id
    and participant.staff_assignment_id = original_second_assignment_id
    and participant.left_at is null;
  leave_result := public.leave_help_queue_staff_v1(
    queue_row.id,
    second_participation_version,
    second_staff_id,
    overlapping_second_assignment_id,
    'e3460000-0000-4000-8000-000000000001'
  );
  if resolve_result ->> 'status' <> 'resolved'
    or leave_result ->> 'participating' <> 'false'
    or (leave_result ->> 'participant_count')::integer <> 1
    or not exists (
      select 1
      from public.audit_events as event
      where event.event_name = 'help_queue.staff_left'
        and event.actor_id = second_staff_id
        and event.authorizing_staff_assignment_id = overlapping_second_assignment_id
        and event.metadata ->> 'staff_assignment_id' = original_second_assignment_id::text
    )
  then
    raise exception 'User participation did not survive an overlapping assignment switch';
  end if;
end;
$$;

rollback;
