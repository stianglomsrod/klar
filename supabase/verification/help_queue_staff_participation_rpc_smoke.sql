\set ON_ERROR_STOP on

begin;

do $$
#variable_conflict use_variable
declare
  organization_id uuid := 'b0000000-0000-4000-8000-000000000001';
  class_id uuid := 'c0000000-0000-4000-8000-000000000001';
  first_student_id uuid := 'a0000000-0000-4000-8000-000000000006';
  second_student_id uuid := 'a0000000-0000-4000-8000-000000000009';
  first_staff_id uuid := 'a0000000-0000-4000-8000-000000000003';
  second_staff_id uuid := 'a0000000-0000-4000-8000-000000000004';
  first_staff_assignment_id uuid;
  second_staff_assignment_id uuid;
  queue_row public.help_queue_sessions;
  first_participation_version bigint;
  second_participation_version bigint;
  request_result jsonb;
  second_request_result jsonb;
  open_retry jsonb;
  join_result jsonb;
  join_retry jsonb;
  join_new_request jsonb;
  reorder_result jsonb;
  reorder_retry jsonb;
  claim_result jsonb;
  claim_retry jsonb;
  release_result jsonb;
  release_retry jsonb;
  reclaim_result jsonb;
  reclaim_retry jsonb;
  transfer_result jsonb;
  transfer_retry jsonb;
  second_claim_result jsonb;
  second_resolve_result jsonb;
  second_resolve_retry jsonb;
  leave_result jsonb;
  leave_retry jsonb;
  close_result jsonb;
  closing_leave_result jsonb;
  resolve_result jsonb;
  snapshot jsonb;
  denial_message text;
begin
  select queue.*
  into queue_row
  from public.help_queue_sessions as queue
  where queue.organization_id = organization_id
    and queue.class_id = class_id
    and queue.status = 'open'
  order by queue.opened_at desc, queue.id
  limit 1;
  if queue_row.id is null then
    raise exception 'Participation smoke cannot find the open fixture queue';
  end if;

  select assignment.id
  into first_staff_assignment_id
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
    and assignment.user_id = first_staff_id
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
   and scope.class_id = class_id
  join public.staff_assignment_capabilities as capability
    on capability.assignment_id = assignment.id
   and capability.profile_version = assignment.profile_version
   and capability.capability = 'help_queue.manage'
  where assignment.organization_id = organization_id
    and assignment.user_id = second_staff_id
    and assignment.revoked_at is null
    and assignment.starts_at <= transaction_timestamp()
    and (assignment.ends_at is null or transaction_timestamp() < assignment.ends_at)
  order by assignment.starts_at desc, assignment.id
  limit 1;

  if first_staff_assignment_id is null or second_staff_assignment_id is null then
    raise exception 'Participation smoke lacks two authorized staff assignments';
  end if;

  open_retry := public.open_help_queue_session(
    class_id,
    queue_row.revision_session_id,
    second_staff_id,
    second_staff_assignment_id,
    'e1400000-0000-4000-8000-000000000001'
  );
  select queue.* into queue_row
  from public.help_queue_sessions as queue
  where queue.id = queue_row.id;
  if open_retry is distinct from (
      select receipt.result
      from public.help_queue_command_receipts as receipt
      where receipt.actor_id = second_staff_id
        and receipt.request_id = 'e1400000-0000-4000-8000-000000000001'
        and receipt.command = 'open_queue'
    )
    or open_retry ->> 'participating' <> 'true'
    or (open_retry ->> 'participant_count')::integer <> 1
    or (open_retry ->> 'activity_version')::bigint <> queue_row.activity_version
  then
    raise exception 'Open receipt did not preserve the final participation snapshot';
  end if;
  if (
    select count(*)
    from public.help_queue_staff_participants as participant
    where participant.queue_session_id = queue_row.id
      and participant.left_at is null
  ) <> 1 or not exists (
    select 1
    from public.help_queue_staff_participants as participant
    where participant.queue_session_id = queue_row.id
      and participant.user_id = second_staff_id
      and participant.staff_assignment_id = second_staff_assignment_id
      and participant.left_at is null
  ) then
    raise exception 'Opening staff member was not established as first participant';
  end if;

  request_result := public.request_student_help_v2(
    queue_row.id,
    first_student_id,
    'e3100000-0000-4000-8000-000000000001',
    null
  );

  select queue.* into queue_row
  from public.help_queue_sessions as queue
  where queue.id = queue_row.id;

  denial_message := null;
  begin
    perform public.claim_student_help_v3(
      (request_result ->> 'request_id')::uuid,
      (request_result ->> 'ownership_version')::bigint,
      first_staff_id,
      first_staff_assignment_id,
      'e3110000-0000-4000-8000-000000000001'
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from
    'Staff member is not an active help queue participant'
  then
    raise exception 'Non-participant could claim help: %', denial_message;
  end if;

  denial_message := null;
  begin
    perform public.reorder_student_help_v1(
      queue_row.id,
      (request_result ->> 'request_id')::uuid,
      'first',
      'staff_coordination',
      queue_row.activity_version,
      first_staff_id,
      first_staff_assignment_id,
      'e3110000-0000-4000-8000-000000000002'
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from
    'Staff member is not an active help queue participant'
  then
    raise exception 'Non-participant could reorder help: %', denial_message;
  end if;

  denial_message := null;
  begin
    perform public.begin_close_help_queue_session(
      queue_row.id,
      queue_row.lock_version,
      first_staff_id,
      first_staff_assignment_id,
      'e3110000-0000-4000-8000-000000000003'
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from
      'Staff member is not an active help queue participant'
    or exists (
      select 1
      from public.help_queue_command_receipts as receipt
      where receipt.actor_id = first_staff_id
        and receipt.request_id in (
          'e3110000-0000-4000-8000-000000000002',
          'e3110000-0000-4000-8000-000000000003'
        )
    )
  then
    raise exception 'Non-participant could close the queue or wrote evidence: %', denial_message;
  end if;

  join_result := public.join_help_queue_staff_v1(
    queue_row.id,
    first_staff_id,
    first_staff_assignment_id,
    'e3120000-0000-4000-8000-000000000001'
  );
  join_retry := public.join_help_queue_staff_v1(
    queue_row.id,
    first_staff_id,
    first_staff_assignment_id,
    'e3120000-0000-4000-8000-000000000001'
  );
  join_new_request := public.join_help_queue_staff_v1(
    queue_row.id,
    first_staff_id,
    first_staff_assignment_id,
    'e3120000-0000-4000-8000-000000000002'
  );
  if join_result is distinct from join_retry
    or join_result ->> 'changed' <> 'true'
    or join_result ->> 'participating' <> 'true'
    or (join_result ->> 'participant_count')::integer <> 2
    or join_new_request ->> 'changed' <> 'false'
    or join_new_request ->> 'participating' <> 'true'
    or (join_new_request ->> 'participant_count')::integer <> 2
    or (
      select count(*)
      from public.help_queue_command_receipts as receipt
      where receipt.actor_id = first_staff_id
        and receipt.command = 'join_queue'
        and receipt.request_id in (
          'e3120000-0000-4000-8000-000000000001',
          'e3120000-0000-4000-8000-000000000002'
        )
    ) <> 2
    or (
      select count(*)
      from public.audit_events as event
      join public.help_queue_staff_participants as participant
        on participant.id = event.entity_id
      where participant.queue_session_id = queue_row.id
        and participant.user_id = first_staff_id
        and event.event_name = 'help_queue.staff_joined'
    ) <> 1
  then
    raise exception 'Joining a shared queue was not state- and receipt-idempotent';
  end if;

  snapshot := public.read_help_queue_staff_snapshot_v2(
    organization_id,
    class_id,
    queue_row.id
  );
  if snapshot #>> '{queue,id}' is distinct from queue_row.id::text
    or jsonb_array_length(snapshot -> 'participant_rows') <> 2
    or (
      select array_agg(item ->> 'user_id' order by item ->> 'user_id')
      from jsonb_array_elements(snapshot -> 'participant_rows') as item
    ) is distinct from array[
      first_staff_id::text,
      second_staff_id::text
    ]
  then
    raise exception 'Shared staff snapshot is incomplete or not scope-bound';
  end if;

  select participant.participation_version
  into first_participation_version
  from public.help_queue_staff_participants as participant
  where participant.queue_session_id = queue_row.id
    and participant.user_id = first_staff_id
    and participant.left_at is null;
  select participant.participation_version
  into second_participation_version
  from public.help_queue_staff_participants as participant
  where participant.queue_session_id = queue_row.id
    and participant.user_id = second_staff_id
    and participant.left_at is null;

  select queue.* into queue_row
  from public.help_queue_sessions as queue
  where queue.id = queue_row.id;
  reorder_result := public.reorder_student_help_v1(
    queue_row.id,
    (request_result ->> 'request_id')::uuid,
    'first',
    'staff_coordination',
    queue_row.activity_version,
    first_staff_id,
    first_staff_assignment_id,
    'e3130000-0000-4000-8000-000000000001'
  );

  claim_result := public.claim_student_help_v3(
    (request_result ->> 'request_id')::uuid,
    (request_result ->> 'ownership_version')::bigint,
    first_staff_id,
    first_staff_assignment_id,
    'e3140000-0000-4000-8000-000000000001'
  );
  release_result := public.release_student_help_v1(
    (request_result ->> 'request_id')::uuid,
    (claim_result ->> 'ownership_version')::bigint,
    first_staff_id,
    first_staff_assignment_id,
    'e3141000-0000-4000-8000-000000000001'
  );
  reclaim_result := public.claim_student_help_v3(
    (request_result ->> 'request_id')::uuid,
    (release_result ->> 'ownership_version')::bigint,
    first_staff_id,
    first_staff_assignment_id,
    'e3142000-0000-4000-8000-000000000001'
  );
  denial_message := null;
  begin
    perform public.leave_help_queue_staff_v1(
      queue_row.id,
      first_participation_version,
      first_staff_id,
      first_staff_assignment_id,
      'e3150000-0000-4000-8000-000000000001'
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from
    'Staff member must release, transfer or resolve owned help before leaving'
    or exists (
      select 1 from public.help_queue_command_receipts
      where actor_id = first_staff_id
        and request_id = 'e3150000-0000-4000-8000-000000000001'
    )
  then
    raise exception 'Staff member left while owning active help: %', denial_message;
  end if;

  transfer_result := public.transfer_student_help_v1(
    (request_result ->> 'request_id')::uuid,
    (reclaim_result ->> 'ownership_version')::bigint,
    first_staff_id,
    first_staff_assignment_id,
    second_staff_assignment_id,
    'e3160000-0000-4000-8000-000000000001'
  );
  second_request_result := public.request_student_help_v2(
    queue_row.id,
    second_student_id,
    'e3161000-0000-4000-8000-000000000001',
    null
  );
  second_claim_result := public.claim_student_help_v3(
    (second_request_result ->> 'request_id')::uuid,
    (second_request_result ->> 'ownership_version')::bigint,
    first_staff_id,
    first_staff_assignment_id,
    'e3162000-0000-4000-8000-000000000001'
  );
  second_resolve_result := public.resolve_student_help_v3(
    (second_request_result ->> 'request_id')::uuid,
    (second_claim_result ->> 'ownership_version')::bigint,
    first_staff_id,
    first_staff_assignment_id,
    'e3163000-0000-4000-8000-000000000001'
  );
  denial_message := null;
  begin
    perform public.leave_help_queue_staff_v1(
      queue_row.id,
      first_participation_version + 1,
      first_staff_id,
      first_staff_assignment_id,
      'e3165000-0000-4000-8000-000000000001'
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from 'Help queue participation version is stale'
    or exists (
      select 1 from public.help_queue_command_receipts
      where actor_id = first_staff_id
        and request_id = 'e3165000-0000-4000-8000-000000000001'
    )
    or exists (
      select 1 from public.audit_events
      where actor_id = first_staff_id
        and event_name = 'help_queue.staff_left'
    )
    or not exists (
      select 1 from public.help_queue_staff_participants
      where queue_session_id = queue_row.id
        and user_id = first_staff_id
        and left_at is null
        and participation_version = first_participation_version
    )
  then
    raise exception 'Stale leave changed participation state or wrote evidence: %', denial_message;
  end if;
  leave_result := public.leave_help_queue_staff_v1(
    queue_row.id,
    first_participation_version,
    first_staff_id,
    first_staff_assignment_id,
    'e3170000-0000-4000-8000-000000000001'
  );
  leave_retry := public.leave_help_queue_staff_v1(
    queue_row.id,
    first_participation_version,
    first_staff_id,
    first_staff_assignment_id,
    'e3170000-0000-4000-8000-000000000001'
  );
  if leave_result is distinct from leave_retry
    or leave_result ->> 'changed' <> 'true'
    or leave_result ->> 'participating' <> 'false'
    or (leave_result ->> 'participant_count')::integer <> 1
    or (select status from public.help_queue_sessions where id = queue_row.id) <> 'open'
    or not exists (
      select 1 from public.help_requests
      where id = (request_result ->> 'request_id')::uuid
        and status = 'claimed'
        and claimed_by = second_staff_id
        and ownership_version = (transfer_result ->> 'ownership_version')::bigint
    )
  then
    raise exception 'Personal queue leave changed shared lifecycle or ownership';
  end if;

  denial_message := null;
  begin
    perform public.leave_help_queue_staff_v1(
      queue_row.id,
      first_participation_version + 1,
      first_staff_id,
      first_staff_assignment_id,
      'e3170000-0000-4000-8000-000000000001'
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from
      'Help queue request identifier was reused with another command'
    or (
      select count(*)
      from public.help_queue_command_receipts
      where actor_id = first_staff_id
        and request_id = 'e3170000-0000-4000-8000-000000000001'
    ) <> 1
    or (
      select count(*)
      from public.audit_events
      where actor_id = first_staff_id
        and event_name = 'help_queue.staff_left'
    ) <> 1
    or not exists (
      select 1 from public.help_queue_staff_participants
      where queue_session_id = queue_row.id
        and user_id = first_staff_id
        and left_at is not null
        and participation_version = first_participation_version + 1
    )
  then
    raise exception 'Changed leave fingerprint altered receipt, audit or state: %', denial_message;
  end if;

  reorder_retry := public.reorder_student_help_v1(
    queue_row.id,
    (request_result ->> 'request_id')::uuid,
    'first',
    'staff_coordination',
    (reorder_result ->> 'activity_version')::bigint,
    first_staff_id,
    first_staff_assignment_id,
    'e3130000-0000-4000-8000-000000000001'
  );
  claim_retry := public.claim_student_help_v3(
    (request_result ->> 'request_id')::uuid,
    (request_result ->> 'ownership_version')::bigint,
    first_staff_id,
    first_staff_assignment_id,
    'e3140000-0000-4000-8000-000000000001'
  );
  release_retry := public.release_student_help_v1(
    (request_result ->> 'request_id')::uuid,
    (claim_result ->> 'ownership_version')::bigint,
    first_staff_id,
    first_staff_assignment_id,
    'e3141000-0000-4000-8000-000000000001'
  );
  reclaim_retry := public.claim_student_help_v3(
    (request_result ->> 'request_id')::uuid,
    (release_result ->> 'ownership_version')::bigint,
    first_staff_id,
    first_staff_assignment_id,
    'e3142000-0000-4000-8000-000000000001'
  );
  transfer_retry := public.transfer_student_help_v1(
    (request_result ->> 'request_id')::uuid,
    (reclaim_result ->> 'ownership_version')::bigint,
    first_staff_id,
    first_staff_assignment_id,
    second_staff_assignment_id,
    'e3160000-0000-4000-8000-000000000001'
  );
  second_resolve_retry := public.resolve_student_help_v3(
    (second_request_result ->> 'request_id')::uuid,
    (second_claim_result ->> 'ownership_version')::bigint,
    first_staff_id,
    first_staff_assignment_id,
    'e3163000-0000-4000-8000-000000000001'
  );
  if reorder_retry is distinct from reorder_result
    or claim_retry is distinct from claim_result
    or release_retry is distinct from release_result
    or reclaim_retry is distinct from reclaim_result
    or transfer_retry is distinct from transfer_result
    or second_resolve_retry is distinct from second_resolve_result
  then
    raise exception 'A completed help command lost receipt idempotency after personal leave';
  end if;

  denial_message := null;
  begin
    perform public.transfer_student_help_v1(
      (request_result ->> 'request_id')::uuid,
      (transfer_result ->> 'ownership_version')::bigint,
      second_staff_id,
      second_staff_assignment_id,
      first_staff_assignment_id,
      'e3180000-0000-4000-8000-000000000001'
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from
    'Help transfer target must be an active queue participant'
  then
    raise exception 'Help was transferred to a former participant: %', denial_message;
  end if;

  denial_message := null;
  begin
    perform public.leave_help_queue_staff_v1(
      queue_row.id,
      second_participation_version,
      second_staff_id,
      second_staff_assignment_id,
      'e3190000-0000-4000-8000-000000000001'
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from 'Last participant must close the help queue'
  then
    raise exception 'Last staff participant could leave an open queue: %', denial_message;
  end if;

  join_result := public.join_help_queue_staff_v1(
    queue_row.id,
    first_staff_id,
    first_staff_assignment_id,
    'e3195000-0000-4000-8000-000000000001'
  );
  if join_result ->> 'participating' <> 'true'
    or (join_result ->> 'participant_count')::integer <> 2
  then
    raise exception 'Former participant could not rejoin before shared closing';
  end if;

  select queue.* into queue_row
  from public.help_queue_sessions as queue
  where queue.id = queue_row.id;
  close_result := public.begin_close_help_queue_session(
    queue_row.id,
    queue_row.lock_version,
    second_staff_id,
    second_staff_assignment_id,
    'e3200000-0000-4000-8000-000000000001'
  );
  if close_result ->> 'status' <> 'closing'
    or close_result ->> 'changed' <> 'true'
    or (
      select count(*)
      from public.help_queue_staff_participants
      where queue_session_id = queue_row.id and left_at is null
    ) <> 2
  then
    raise exception 'A participant did not start shared closing: %', close_result;
  end if;

  select participant.participation_version
  into first_participation_version
  from public.help_queue_staff_participants as participant
  where participant.queue_session_id = queue_row.id
    and participant.user_id = first_staff_id
    and participant.left_at is null;
  closing_leave_result := public.leave_help_queue_staff_v1(
    queue_row.id,
    first_participation_version,
    first_staff_id,
    first_staff_assignment_id,
    'e3200000-0000-4000-8000-000000000002'
  );
  if closing_leave_result ->> 'status' <> 'closing'
    or closing_leave_result ->> 'participating' <> 'false'
    or (closing_leave_result ->> 'participant_count')::integer <> 1
    or not exists (
      select 1 from public.help_queue_staff_participants
      where queue_session_id = queue_row.id
        and user_id = first_staff_id
        and left_at is not null
        and leave_reason = 'voluntary'
    )
    or not exists (
      select 1 from public.help_queue_staff_participants
      where queue_session_id = queue_row.id
        and user_id = second_staff_id
        and left_at is null
    )
  then
    raise exception 'Personal leave did not preserve a shared closing queue';
  end if;

  denial_message := null;
  begin
    perform public.request_student_help_v2(
      queue_row.id,
      second_student_id,
      'e3210000-0000-4000-8000-000000000001',
      null
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is null or denial_message not ilike '%not open%' then
    raise exception 'Closing queue accepted a new student: %', denial_message;
  end if;

  resolve_result := public.resolve_student_help_v3(
    (request_result ->> 'request_id')::uuid,
    (transfer_result ->> 'ownership_version')::bigint,
    second_staff_id,
    second_staff_assignment_id,
    'e3220000-0000-4000-8000-000000000001'
  );
  if resolve_result ->> 'status' <> 'resolved'
    or (select status from public.help_queue_sessions where id = queue_row.id) <> 'closed'
    or exists (
      select 1 from public.help_queue_staff_participants
      where queue_session_id = queue_row.id and left_at is null
    )
    or (
      select count(*)
      from public.help_queue_staff_participants
      where queue_session_id = queue_row.id
        and leave_reason = 'queue_closed'
    ) <> 1
    or not exists (
      select 1 from public.help_queue_staff_participants
      where queue_session_id = queue_row.id
        and user_id = second_staff_id
        and leave_reason = 'queue_closed'
    )
  then
    raise exception 'Explicit queue close did not atomically drain and retire participants';
  end if;
end;
$$;

do $$
declare
  relation_row record;
  snapshot_function record;
  participant_helper_function record;
  participant_reconcile_function record;
  participant_retire_function record;
  identity_fk_rejected boolean := false;
begin
  begin
    insert into public.help_queue_staff_participants (
      organization_id,
      class_id,
      queue_session_id,
      user_id,
      staff_assignment_id
    )
    select
      queue.organization_id,
      queue.class_id,
      queue.id,
      'a0000000-0000-4000-8000-000000000001',
      assignment.id
    from public.help_queue_sessions as queue
    cross join lateral (
      select current_assignment.id
      from public.staff_assignments as current_assignment
      where current_assignment.organization_id = queue.organization_id
        and current_assignment.user_id =
          'a0000000-0000-4000-8000-000000000003'
      order by current_assignment.starts_at desc, current_assignment.id
      limit 1
    ) as assignment
    where queue.organization_id =
      'b0000000-0000-4000-8000-000000000001'
      and queue.class_id = 'c0000000-0000-4000-8000-000000000001'
    limit 1;
  exception when foreign_key_violation then
    identity_fk_rejected := true;
  end;
  if not identity_fk_rejected then
    raise exception 'Participant identity accepted another user''s staff assignment';
  end if;

  select relation.relrowsecurity, relation.relforcerowsecurity
  into relation_row
  from pg_class as relation
  where relation.oid = 'public.help_queue_staff_participants'::regclass;
  select procedure.provolatile, procedure.prosecdef, procedure.proconfig
  into snapshot_function
  from pg_proc as procedure
  where procedure.oid =
    'public.read_help_queue_staff_snapshot_v2(uuid,uuid,uuid)'::regprocedure;
  select procedure.provolatile, procedure.prosecdef, procedure.proconfig
  into participant_helper_function
  from pg_proc as procedure
  where procedure.oid =
      'public.is_active_help_queue_staff_participant_v1(uuid)'::regprocedure;
  select procedure.provolatile, procedure.prosecdef, procedure.proconfig
  into participant_reconcile_function
  from pg_proc as procedure
  where procedure.oid =
    'public.reconcile_help_queue_staff_participants_v1(uuid)'::regprocedure;
  select procedure.provolatile, procedure.prosecdef, procedure.proconfig
  into participant_retire_function
  from pg_proc as procedure
  where procedure.oid =
    'public.retire_help_queue_staff_participants_v1(uuid)'::regprocedure;

  if not relation_row.relrowsecurity
    or not relation_row.relforcerowsecurity
    or has_table_privilege('anon', 'public.help_queue_staff_participants', 'select')
    or has_table_privilege('authenticated', 'public.help_queue_staff_participants', 'select')
    or not has_table_privilege('service_role', 'public.help_queue_staff_participants', 'select')
    or has_function_privilege(
      'authenticated',
      'public.join_help_queue_staff_v1(uuid,uuid,uuid,uuid)',
      'execute'
    )
    or has_function_privilege(
      'authenticated',
      'public.leave_help_queue_staff_v1(uuid,bigint,uuid,uuid,uuid)',
      'execute'
    )
    or not has_function_privilege(
      'service_role',
      'public.read_help_queue_staff_snapshot_v2(uuid,uuid,uuid)',
      'execute'
    )
    or not has_function_privilege(
      'service_role',
      'public.reconcile_help_queue_staff_participants_v1(uuid)',
      'execute'
    )
    or has_function_privilege(
      'service_role',
      'public.retire_help_queue_staff_participants_v1(uuid)',
      'execute'
    )
    or has_function_privilege(
      'service_role',
      'public.reconcile_help_queue_sessions_without_staff_participation(uuid)',
      'execute'
    )
    or has_function_privilege(
      'service_role',
      'public.reconcile_expired_staff_assignments_without_help_participation(uuid)',
      'execute'
    )
    or has_function_privilege(
      'service_role',
      'public.terminalize_student_help_scope_without_participation(uuid,uuid,uuid,text)',
      'execute'
    )
    or has_function_privilege(
      'service_role',
      'public.cancel_student_help_v2_without_participation(uuid,uuid,uuid)',
      'execute'
    )
    or not has_function_privilege(
      'authenticated',
      'public.is_active_help_queue_staff_participant_v1(uuid)',
      'execute'
    )
    or has_function_privilege(
      'anon',
      'public.is_active_help_queue_staff_participant_v1(uuid)',
      'execute'
    )
    or has_function_privilege(
      'service_role',
      'public.claim_student_help_v3_without_participation(uuid,bigint,uuid,uuid,uuid)',
      'execute'
    )
    or snapshot_function.provolatile <> 's'
    or snapshot_function.prosecdef
    or not ('search_path=""' = any(coalesce(snapshot_function.proconfig, array[]::text[])))
    or participant_helper_function.provolatile <> 's'
    or not participant_helper_function.prosecdef
    or not (
      'search_path=""' = any(
        coalesce(participant_helper_function.proconfig, array[]::text[])
      )
    )
    or participant_reconcile_function.provolatile <> 'v'
    or not participant_reconcile_function.prosecdef
    or not (
      'search_path=""' = any(
        coalesce(participant_reconcile_function.proconfig, array[]::text[])
      )
    )
    or participant_retire_function.provolatile <> 'v'
    or not participant_retire_function.prosecdef
    or not (
      'search_path=""' = any(
        coalesce(participant_retire_function.proconfig, array[]::text[])
      )
    )
  then
    raise exception 'Help queue participation catalog privileges are unsafe';
  end if;
end;
$$;

rollback;
