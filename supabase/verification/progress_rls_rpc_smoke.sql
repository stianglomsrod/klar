\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, raw_user_meta_data)
select id, email, jsonb_build_object('display_name', display_name)
from (values
  ('91000000-0000-4000-8000-000000000001'::uuid, 'owner@progress.test', 'Eier progresjon'),
  ('91000000-0000-4000-8000-000000000002'::uuid, 'staff@progress.test', 'Ansatt progresjon'),
  ('91000000-0000-4000-8000-000000000003'::uuid, 'expired@progress.test', 'Utløpt ansatt'),
  ('91000000-0000-4000-8000-000000000004'::uuid, 'student-a@progress.test', 'Elev progresjon A'),
  ('91000000-0000-4000-8000-000000000005'::uuid, 'student-b@progress.test', 'Elev progresjon B'),
  ('91000000-0000-4000-8000-000000000006'::uuid, 'outsider@progress.test', 'Eier utenfor')
) as fixture(id, email, display_name);

insert into public.organizations (id, name, created_by) values
  ('92000000-0000-4000-8000-000000000001', 'Progresjonsorg A', '91000000-0000-4000-8000-000000000001'),
  ('92000000-0000-4000-8000-000000000002', 'Progresjonsorg B', '91000000-0000-4000-8000-000000000006');

insert into public.memberships (organization_id, user_id, role, created_by) values
  ('92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'owner', '91000000-0000-4000-8000-000000000001'),
  ('92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000002', 'teacher', '91000000-0000-4000-8000-000000000001'),
  ('92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000003', 'teacher', '91000000-0000-4000-8000-000000000001'),
  ('92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000004', 'student', '91000000-0000-4000-8000-000000000001'),
  ('92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000005', 'student', '91000000-0000-4000-8000-000000000001'),
  ('92000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000006', 'owner', '91000000-0000-4000-8000-000000000006');

insert into public.classes (id, organization_id, name, created_by) values
  ('93000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', 'Progresjonsklasse', '91000000-0000-4000-8000-000000000001'),
  ('93000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000001', 'Annen progresjonsklasse', '91000000-0000-4000-8000-000000000001'),
  ('93000000-0000-4000-8000-000000000003', '92000000-0000-4000-8000-000000000002', 'Utenfor progresjon', '91000000-0000-4000-8000-000000000006');

insert into public.class_memberships (
  class_id,
  organization_id,
  user_id,
  role,
  created_by
) values
  ('93000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000004', 'student', '91000000-0000-4000-8000-000000000001'),
  ('93000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000005', 'student', '91000000-0000-4000-8000-000000000001');

select public.create_staff_assignment(
  '92000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000001',
  target_user_id,
  class_id,
  'substitute',
  starts_at,
  ends_at,
  idempotency_key
)
from (values
  (
    '91000000-0000-4000-8000-000000000002'::uuid,
    '93000000-0000-4000-8000-000000000001'::uuid,
    transaction_timestamp() - interval '1 hour',
    transaction_timestamp() + interval '1 day',
    '96000000-0000-4000-8000-000000000001'::uuid
  ),
  (
    '91000000-0000-4000-8000-000000000002'::uuid,
    '93000000-0000-4000-8000-000000000002'::uuid,
    transaction_timestamp() - interval '1 hour',
    transaction_timestamp() + interval '1 day',
    '96000000-0000-4000-8000-000000000002'::uuid
  ),
  (
    '91000000-0000-4000-8000-000000000003'::uuid,
    '93000000-0000-4000-8000-000000000001'::uuid,
    transaction_timestamp() - interval '2 days',
    transaction_timestamp() - interval '1 day',
    '96000000-0000-4000-8000-000000000003'::uuid
  )
) as grant_fixture(target_user_id, class_id, starts_at, ends_at, idempotency_key);

insert into public.task_definitions (
  id,
  organization_id,
  class_id,
  title,
  publication_status,
  created_by,
  published_at,
  points_value
) values
  (
    '94000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000001',
    '93000000-0000-4000-8000-000000000001',
    'Snapshotoppgave',
    'published',
    '91000000-0000-4000-8000-000000000002',
    transaction_timestamp(),
    1000
  ),
  (
    '94000000-0000-4000-8000-000000000002',
    '92000000-0000-4000-8000-000000000001',
    '93000000-0000-4000-8000-000000000001',
    'Flernivåoppgave',
    'published',
    '91000000-0000-4000-8000-000000000002',
    transaction_timestamp(),
    3000
  );

insert into public.task_assignments (
  id,
  organization_id,
  class_id,
  task_definition_id,
  student_id,
  assigned_by
) values
  (
    '95000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000001',
    '93000000-0000-4000-8000-000000000001',
    '94000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000004',
    '91000000-0000-4000-8000-000000000002'
  ),
  (
    '95000000-0000-4000-8000-000000000002',
    '92000000-0000-4000-8000-000000000001',
    '93000000-0000-4000-8000-000000000001',
    '94000000-0000-4000-8000-000000000002',
    '91000000-0000-4000-8000-000000000005',
    '91000000-0000-4000-8000-000000000002'
  );

insert into public.student_task_state (assignment_id, organization_id, student_id) values
  ('95000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000004'),
  ('95000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000005');

update public.task_definitions
set points_value = 2000
where id = '94000000-0000-4000-8000-000000000001';

insert into public.task_assignments (
  id,
  organization_id,
  class_id,
  task_definition_id,
  student_id,
  assigned_by
) values (
  '95000000-0000-4000-8000-000000000003',
  '92000000-0000-4000-8000-000000000001',
  '93000000-0000-4000-8000-000000000001',
  '94000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000004',
  '91000000-0000-4000-8000-000000000002'
);

insert into public.student_task_state (assignment_id, organization_id, student_id)
values (
  '95000000-0000-4000-8000-000000000003',
  '92000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000004'
);

do $$
declare
  active_staff_assignment_id uuid;
  wrong_class_staff_assignment_id uuid;
  expired_staff_assignment_id uuid;
  first_result jsonb;
  repeated_result jsonb;
  no_op_result jsonb;
  undo_result jsonb;
  second_result jsonb;
  reopen_result jsonb;
  third_result jsonb;
  multi_result jsonb;
  iteration_result jsonb;
  entitlement_id uuid;
  entitlement_available_at timestamptz;
  denial_message text;
begin
  select assignment.id
  into active_staff_assignment_id
  from public.staff_assignments as assignment
  join public.staff_assignment_class_scopes as scope
    on scope.assignment_id = assignment.id
  where assignment.user_id = '91000000-0000-4000-8000-000000000002'
    and scope.class_id = '93000000-0000-4000-8000-000000000001';

  select assignment.id
  into wrong_class_staff_assignment_id
  from public.staff_assignments as assignment
  join public.staff_assignment_class_scopes as scope
    on scope.assignment_id = assignment.id
  where assignment.user_id = '91000000-0000-4000-8000-000000000002'
    and scope.class_id = '93000000-0000-4000-8000-000000000002';

  select assignment.id
  into expired_staff_assignment_id
  from public.staff_assignments as assignment
  where assignment.user_id = '91000000-0000-4000-8000-000000000003';

  if (
    select points_value_snapshot
    from public.task_assignments
    where id = '95000000-0000-4000-8000-000000000001'
  ) <> 1000 or (
    select points_value_snapshot
    from public.task_assignments
    where id = '95000000-0000-4000-8000-000000000003'
  ) <> 2000 then
    raise exception 'Task assignment XP snapshots did not preserve iteration values';
  end if;

  first_result := public.complete_student_task(
    '95000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000004',
    '97000000-0000-4000-8000-000000000001'
  );
  if first_result ->> 'status' <> 'completed'
    or first_result ->> 'changed' <> 'true'
    or (first_result ->> 'xp_delta')::integer <> 1000
    or (first_result ->> 'xp_balance')::bigint <> 1000
    or (first_result ->> 'current_level')::bigint <> 2
    or first_result -> 'new_milestone_levels' <> '[2]'::jsonb
  then
    raise exception 'Initial completion result is wrong: %', first_result;
  end if;

  repeated_result := public.complete_student_task(
    '95000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000004',
    '97000000-0000-4000-8000-000000000001'
  );
  if repeated_result <> first_result then
    raise exception 'Same request retry did not return the canonical result';
  end if;

  denial_message := null;
  begin
    perform public.undo_student_task_completion(
      '95000000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000004',
      '97000000-0000-4000-8000-000000000001'
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message not like 'Request ID was already used%' then
    raise exception 'Conflicting idempotency retry was not rejected: %', denial_message;
  end if;

  no_op_result := public.complete_student_task(
    '95000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000004',
    '97000000-0000-4000-8000-000000000002'
  );
  if no_op_result ->> 'changed' <> 'false'
    or (no_op_result ->> 'xp_delta')::integer <> 0
  then
    raise exception 'Repeated completion with a new request was not a no-op: %', no_op_result;
  end if;

  select entitlement.id, entitlement.available_at
  into entitlement_id, entitlement_available_at
  from public.level_reward_entitlements as entitlement
  where entitlement.student_id = '91000000-0000-4000-8000-000000000004'
    and entitlement.level = 2;

  undo_result := public.undo_student_task_completion(
    '95000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000004',
    '97000000-0000-4000-8000-000000000003'
  );
  if undo_result ->> 'status' <> 'assigned'
    or (undo_result ->> 'xp_balance')::bigint <> 0
    or (undo_result ->> 'highest_level')::bigint <> 2
    or undo_result -> 'pending_levels' <> '[2]'::jsonb
    or not exists (
      select 1
      from public.level_reward_entitlements
      where id = entitlement_id
        and status = 'pending'
        and available_at = entitlement_available_at
    )
  then
    raise exception 'Undo did not preserve milestone history correctly: %', undo_result;
  end if;

  second_result := public.complete_student_task(
    '95000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000004',
    '97000000-0000-4000-8000-000000000004'
  );
  if second_result ->> 'status' <> 'completed'
    or second_result -> 'new_milestone_levels' <> '[]'::jsonb
    or second_result -> 'reactivated_levels' <> '[2]'::jsonb
    or (select count(*) from public.level_milestones where student_id = '91000000-0000-4000-8000-000000000004') <> 1
    or (select count(*) from public.level_reward_entitlements where student_id = '91000000-0000-4000-8000-000000000004') <> 1
  then
    raise exception 'Regained level created duplicate reward history: %', second_result;
  end if;

  denial_message := null;
  begin
    perform public.reopen_student_task_for_staff(
      '95000000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000002',
      wrong_class_staff_assignment_id,
      '97000000-0000-4000-8000-000000000005',
      'continue_working',
      null
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is null then
    raise exception 'A staff assignment for another class reopened the task';
  end if;

  denial_message := null;
  begin
    perform public.reopen_student_task_for_staff(
      '95000000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000003',
      expired_staff_assignment_id,
      '97000000-0000-4000-8000-000000000006',
      'continue_working',
      null
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is null then
    raise exception 'An expired staff assignment reopened the task';
  end if;

  denial_message := null;
  begin
    perform public.reopen_student_task_for_staff(
      '95000000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000002',
      active_staff_assignment_id,
      '97000000-0000-4000-8000-000000000007',
      'other',
      null
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is null then
    raise exception 'The other reopen reason accepted no explanation';
  end if;

  reopen_result := public.reopen_student_task_for_staff(
    '95000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000002',
    active_staff_assignment_id,
    '97000000-0000-4000-8000-000000000008',
    'continue_working',
    'Prøv én gang til.'
  );
  if reopen_result ->> 'status' <> 'reopened'
    or (reopen_result ->> 'xp_balance')::bigint <> 0
    or not exists (
      select 1
      from public.audit_events
      where event_name = 'task.reopened'
        and entity_id = '95000000-0000-4000-8000-000000000001'
        and authorizing_staff_assignment_id = active_staff_assignment_id
        and authorizing_capability = 'task.return'
        and not (metadata ? 'student_message')
    )
    or not exists (
      select 1
      from public.task_state_transitions
      where assignment_id = '95000000-0000-4000-8000-000000000001'
        and command = 'reopen'
        and student_message = 'Prøv én gang til.'
    )
  then
    raise exception 'Authorized staff reopen did not preserve the safe history: %', reopen_result;
  end if;

  third_result := public.complete_student_task(
    '95000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000004',
    '97000000-0000-4000-8000-000000000009'
  );
  if third_result ->> 'status' <> 'completed'
    or (third_result ->> 'xp_balance')::bigint <> 1000
    or (select count(*) from public.task_completion_attempts where assignment_id = '95000000-0000-4000-8000-000000000001') <> 3
    or (select count(*) from public.student_xp_ledger where assignment_id = '95000000-0000-4000-8000-000000000001' and entry_kind = 'credit') <> 3
    or (select count(*) from public.student_xp_ledger where assignment_id = '95000000-0000-4000-8000-000000000001' and entry_kind = 'reversal') <> 2
  then
    raise exception 'Completion after staff reopen is inconsistent: %', third_result;
  end if;

  multi_result := public.complete_student_task(
    '95000000-0000-4000-8000-000000000002',
    '91000000-0000-4000-8000-000000000005',
    '97000000-0000-4000-8000-000000000010'
  );
  if (multi_result ->> 'current_level')::bigint <> 4
    or multi_result -> 'new_milestone_levels' <> '[2, 3, 4]'::jsonb
    or (select count(*) from public.level_milestones where student_id = '91000000-0000-4000-8000-000000000005') <> 3
    or (select count(*) from public.level_reward_entitlements where student_id = '91000000-0000-4000-8000-000000000005') <> 3
  then
    raise exception 'One completion did not cross every earned level: %', multi_result;
  end if;

  iteration_result := public.complete_student_task(
    '95000000-0000-4000-8000-000000000003',
    '91000000-0000-4000-8000-000000000004',
    '97000000-0000-4000-8000-000000000011'
  );
  if iteration_result ->> 'status' <> 'completed'
    or (iteration_result ->> 'xp_delta')::integer <> 2000
    or (iteration_result ->> 'xp_balance')::bigint <> 3000
    or (select count(*) from public.task_completion_attempts where assignment_id = '95000000-0000-4000-8000-000000000003') <> 1
    or (select count(*) from public.student_xp_ledger where assignment_id = '95000000-0000-4000-8000-000000000003' and entry_kind = 'credit') <> 1
  then
    raise exception 'A new assignment iteration did not earn its own snapshot XP: %', iteration_result;
  end if;

  denial_message := null;
  begin
    perform public.complete_student_task(
      '95000000-0000-4000-8000-000000000003',
      '91000000-0000-4000-8000-000000000005',
      '97000000-0000-4000-8000-000000000012'
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is null then
    raise exception 'A student completed another student task';
  end if;

  if exists (
    select progress.organization_id, progress.student_id
    from public.student_progress as progress
    left join lateral (
      select coalesce(sum(ledger.points_delta), 0)::bigint as expected_balance
      from public.student_xp_ledger as ledger
      where ledger.organization_id = progress.organization_id
        and ledger.student_id = progress.student_id
    ) as ledger_sum on true
    where progress.xp_balance <> ledger_sum.expected_balance
  ) then
    raise exception 'Cached progress does not reconcile with the ledger';
  end if;

  if to_regprocedure('public.update_student_task_status(uuid,uuid,public.student_task_status)') is not null
    or has_function_privilege('service_role', 'public.apply_task_progress_command(uuid,uuid,uuid,public.task_progress_command,uuid,public.task_reopen_reason,text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.complete_student_task(uuid,uuid,uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.complete_student_task(uuid,uuid,uuid)', 'EXECUTE')
    or has_table_privilege('service_role', 'public.student_task_state', 'UPDATE')
    or has_table_privilege('service_role', 'public.student_xp_ledger', 'INSERT')
    or not has_table_privilege('authenticated', 'public.student_xp_ledger', 'SELECT')
  then
    raise exception 'Progress privilege cutover is incomplete';
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
  ) <> 7 then
    raise exception 'Every progress table must have RLS enabled';
  end if;
end;
$$;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-4000-8000-000000000004","aal":"aal1","role":"authenticated"}',
  true
);

do $$
declare
  denial_message text;
begin
  if (select count(*) from public.student_progress) <> 1
    or (select count(*) from public.task_completion_attempts) <> 4
    or exists (
      select 1
      from public.student_progress
      where student_id <> '91000000-0000-4000-8000-000000000004'
    )
  then
    raise exception 'Student progress RLS exposed another student';
  end if;

  denial_message := null;
  begin
    update public.student_task_state
    set status = 'assigned'
    where assignment_id = '95000000-0000-4000-8000-000000000001';
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is null then
    raise exception 'Authenticated student wrote task state directly';
  end if;

  denial_message := null;
  begin
    perform count(*) from public.progress_command_receipts;
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is null then
    raise exception 'Authenticated student read internal command receipts';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-4000-8000-000000000002","aal":"aal2","role":"authenticated"}',
  true
);

do $$
begin
  if (select count(*) from public.task_completion_attempts) <> 5
    or (select count(*) from public.student_progress) <> 0
  then
    raise exception 'AAL2 staff resource RLS is not class-scoped';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-4000-8000-000000000002","aal":"aal1","role":"authenticated"}',
  true
);

do $$
begin
  if (select count(*) from public.task_completion_attempts) <> 0 then
    raise exception 'AAL1 staff could read progress history';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-4000-8000-000000000006","aal":"aal2","role":"authenticated"}',
  true
);

do $$
begin
  if (select count(*) from public.task_completion_attempts) <> 0
    or (select count(*) from public.student_task_state) <> 0
    or public.has_current_student_membership(
      '92000000-0000-4000-8000-000000000001',
      '93000000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000004'
    )
  then
    raise exception 'An owner without a staff assignment crossed the pedagogical boundary or used a membership oracle';
  end if;
end;
$$;

reset role;

delete from public.class_memberships
where organization_id = '92000000-0000-4000-8000-000000000001'
  and class_id = '93000000-0000-4000-8000-000000000001'
  and user_id = '91000000-0000-4000-8000-000000000004';

do $$
declare
  active_staff_assignment_id uuid;
  denial_message text;
begin
  select assignment.id
  into active_staff_assignment_id
  from public.staff_assignments as assignment
  join public.staff_assignment_class_scopes as scope
    on scope.assignment_id = assignment.id
  where assignment.user_id = '91000000-0000-4000-8000-000000000002'
    and scope.class_id = '93000000-0000-4000-8000-000000000001';

  if (select count(*) from public.task_assignments where student_id = '91000000-0000-4000-8000-000000000004') <> 2
    or (select count(*) from public.task_completion_attempts where student_id = '91000000-0000-4000-8000-000000000004') <> 4
    or (select count(*) from public.student_xp_ledger where student_id = '91000000-0000-4000-8000-000000000004') <> 6
  then
    raise exception 'Removing a class membership destroyed assignment history';
  end if;

  denial_message := null;
  begin
    perform public.undo_student_task_completion(
      '95000000-0000-4000-8000-000000000003',
      '91000000-0000-4000-8000-000000000004',
      '97000000-0000-4000-8000-000000000013'
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message not like 'Student membership is unavailable%' then
    raise exception 'A removed student could still mutate progress: %', denial_message;
  end if;

  denial_message := null;
  begin
    perform public.reopen_student_task_for_staff(
      '95000000-0000-4000-8000-000000000003',
      '91000000-0000-4000-8000-000000000002',
      active_staff_assignment_id,
      '97000000-0000-4000-8000-000000000014',
      'continue_working',
      null
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message not like 'Student membership is unavailable%' then
    raise exception 'Staff reopened a former student task: %', denial_message;
  end if;

  denial_message := null;
  begin
    insert into public.task_assignments (
      id,
      organization_id,
      class_id,
      task_definition_id,
      student_id,
      assigned_by
    ) values (
      '95000000-0000-4000-8000-000000000004',
      '92000000-0000-4000-8000-000000000001',
      '93000000-0000-4000-8000-000000000001',
      '94000000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000004',
      '91000000-0000-4000-8000-000000000002'
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message not like 'Task assignments require a current student membership%' then
    raise exception 'A removed student received a new task assignment: %', denial_message;
  end if;
end;
$$;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-4000-8000-000000000004","aal":"aal1","role":"authenticated"}',
  true
);

do $$
begin
  if (select count(*) from public.task_definitions) <> 0
    or (select count(*) from public.task_assignments) <> 0
    or (select count(*) from public.student_task_state) <> 0
    or (select count(*) from public.task_completion_attempts) <> 0
    or (select count(*) from public.student_xp_ledger) <> 0
    or (select count(*) from public.student_progress) <> 1
  then
    raise exception 'Removed class membership leaked task resources or hid own org progress';
  end if;
end;
$$;

reset role;

rollback;
