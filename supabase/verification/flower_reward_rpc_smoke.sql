\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, raw_user_meta_data)
select id, email, jsonb_build_object('display_name', display_name)
from (values
  ('b2100000-0000-4000-8000-000000000001'::uuid, 'owner@flower.test', 'Blomstereier'),
  ('b2100000-0000-4000-8000-000000000002'::uuid, 'staff@flower.test', 'Blomsteransatt'),
  ('b2100000-0000-4000-8000-000000000003'::uuid, 'student-a@flower.test', 'Blomsterelev A'),
  ('b2100000-0000-4000-8000-000000000004'::uuid, 'student-b@flower.test', 'Blomsterelev B'),
  ('b2100000-0000-4000-8000-000000000005'::uuid, 'outsider@flower.test', 'Blomsterutenfor')
) as fixture(id, email, display_name);

insert into public.organizations (id, name, created_by) values
  ('b2200000-0000-4000-8000-000000000001', 'Blomsterorganisasjon', 'b2100000-0000-4000-8000-000000000001'),
  ('b2200000-0000-4000-8000-000000000002', 'Annen blomsterorganisasjon', 'b2100000-0000-4000-8000-000000000005');

insert into public.memberships (organization_id, user_id, role, created_by) values
  ('b2200000-0000-4000-8000-000000000001', 'b2100000-0000-4000-8000-000000000001', 'owner', 'b2100000-0000-4000-8000-000000000001'),
  ('b2200000-0000-4000-8000-000000000001', 'b2100000-0000-4000-8000-000000000002', 'teacher', 'b2100000-0000-4000-8000-000000000001'),
  ('b2200000-0000-4000-8000-000000000001', 'b2100000-0000-4000-8000-000000000003', 'student', 'b2100000-0000-4000-8000-000000000001'),
  ('b2200000-0000-4000-8000-000000000001', 'b2100000-0000-4000-8000-000000000004', 'student', 'b2100000-0000-4000-8000-000000000001'),
  ('b2200000-0000-4000-8000-000000000002', 'b2100000-0000-4000-8000-000000000005', 'owner', 'b2100000-0000-4000-8000-000000000005');

insert into public.classes (id, organization_id, name, created_by) values
  ('b2300000-0000-4000-8000-000000000001', 'b2200000-0000-4000-8000-000000000001', 'Blomsterklasse', 'b2100000-0000-4000-8000-000000000001'),
  ('b2300000-0000-4000-8000-000000000002', 'b2200000-0000-4000-8000-000000000001', 'Annen blomsterklasse', 'b2100000-0000-4000-8000-000000000001');

insert into public.class_memberships (
  class_id,
  organization_id,
  user_id,
  role,
  created_by
) values
  ('b2300000-0000-4000-8000-000000000001', 'b2200000-0000-4000-8000-000000000001', 'b2100000-0000-4000-8000-000000000003', 'student', 'b2100000-0000-4000-8000-000000000001'),
  ('b2300000-0000-4000-8000-000000000001', 'b2200000-0000-4000-8000-000000000001', 'b2100000-0000-4000-8000-000000000004', 'student', 'b2100000-0000-4000-8000-000000000001');

select public.create_staff_assignment(
  'b2200000-0000-4000-8000-000000000001',
  'b2100000-0000-4000-8000-000000000001',
  'b2100000-0000-4000-8000-000000000002',
  'b2300000-0000-4000-8000-000000000001',
  'substitute',
  transaction_timestamp() - interval '1 hour',
  transaction_timestamp() + interval '1 day',
  'b2600000-0000-4000-8000-000000000001'
);

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
  ('b2400000-0000-4000-8000-000000000001', 'b2200000-0000-4000-8000-000000000001', 'b2300000-0000-4000-8000-000000000001', 'Første kronblad A', 'published', 'b2100000-0000-4000-8000-000000000002', transaction_timestamp(), 1000),
  ('b2400000-0000-4000-8000-000000000002', 'b2200000-0000-4000-8000-000000000001', 'b2300000-0000-4000-8000-000000000001', 'Andre kronblad A', 'published', 'b2100000-0000-4000-8000-000000000002', transaction_timestamp(), 1000),
  ('b2400000-0000-4000-8000-000000000003', 'b2200000-0000-4000-8000-000000000001', 'b2300000-0000-4000-8000-000000000001', 'Første kronblad B', 'published', 'b2100000-0000-4000-8000-000000000002', transaction_timestamp(), 1000);

insert into public.task_assignments (
  id,
  organization_id,
  class_id,
  task_definition_id,
  student_id,
  assigned_by
) values
  ('b2500000-0000-4000-8000-000000000001', 'b2200000-0000-4000-8000-000000000001', 'b2300000-0000-4000-8000-000000000001', 'b2400000-0000-4000-8000-000000000001', 'b2100000-0000-4000-8000-000000000003', 'b2100000-0000-4000-8000-000000000002'),
  ('b2500000-0000-4000-8000-000000000002', 'b2200000-0000-4000-8000-000000000001', 'b2300000-0000-4000-8000-000000000001', 'b2400000-0000-4000-8000-000000000002', 'b2100000-0000-4000-8000-000000000003', 'b2100000-0000-4000-8000-000000000002'),
  ('b2500000-0000-4000-8000-000000000003', 'b2200000-0000-4000-8000-000000000001', 'b2300000-0000-4000-8000-000000000001', 'b2400000-0000-4000-8000-000000000003', 'b2100000-0000-4000-8000-000000000004', 'b2100000-0000-4000-8000-000000000002');

insert into public.student_task_state (assignment_id, organization_id, student_id) values
  ('b2500000-0000-4000-8000-000000000001', 'b2200000-0000-4000-8000-000000000001', 'b2100000-0000-4000-8000-000000000003'),
  ('b2500000-0000-4000-8000-000000000002', 'b2200000-0000-4000-8000-000000000001', 'b2100000-0000-4000-8000-000000000003'),
  ('b2500000-0000-4000-8000-000000000003', 'b2200000-0000-4000-8000-000000000001', 'b2100000-0000-4000-8000-000000000004');

create function pg_temp.reject_reward_audit()
returns trigger
language plpgsql
as $$
begin
  if new.event_name = 'reward.claimed' then
    raise exception 'Injected reward audit failure';
  end if;
  return new;
end;
$$;

do $$
declare
  staff_assignment_id uuid;
  first_entitlement_id uuid;
  second_entitlement_id uuid;
  student_b_entitlement_id uuid;
  first_claim jsonb;
  retry_claim jsonb;
  denial_message text;
begin
  select assignment.id
  into staff_assignment_id
  from public.staff_assignments as assignment
  join public.staff_assignment_class_scopes as scope
    on scope.assignment_id = assignment.id
  where assignment.user_id = 'b2100000-0000-4000-8000-000000000002'
    and scope.class_id = 'b2300000-0000-4000-8000-000000000001';

  perform public.complete_student_task_v2(
    'b2200000-0000-4000-8000-000000000001',
    'b2500000-0000-4000-8000-000000000001',
    'b2100000-0000-4000-8000-000000000003',
    'b2700000-0000-4000-8000-000000000001',
    1,
    1
  );

  select id into first_entitlement_id
  from public.level_reward_entitlements
  where student_id = 'b2100000-0000-4000-8000-000000000003'
    and level = 2;

  denial_message := null;
  begin
    perform public.claim_student_flower_reward_v1(
      'b2200000-0000-4000-8000-000000000001',
      first_entitlement_id,
      'b2100000-0000-4000-8000-000000000003',
      'b2100000-0000-4000-8000-000000000003',
      'b2700000-0000-4000-8000-000000000002',
      'red'
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from 'Flower rewards are not available' then
    raise exception 'Closed staff frame did not block claim: %', denial_message;
  end if;

  perform public.update_student_experience_for_staff_v2(
    'b2200000-0000-4000-8000-000000000001',
    'b2300000-0000-4000-8000-000000000001',
    'b2100000-0000-4000-8000-000000000003',
    'b2100000-0000-4000-8000-000000000002',
    staff_assignment_id,
    2::smallint,
    true
  );

  if (
    select progress_enabled
    from public.student_experience_settings
    where organization_id = 'b2200000-0000-4000-8000-000000000001'
      and student_id = 'b2100000-0000-4000-8000-000000000003'
  ) then
    raise exception 'Staff flower-frame update changed the student progress preference';
  end if;

  perform public.update_student_experience_v2(
    'b2200000-0000-4000-8000-000000000001',
    'b2100000-0000-4000-8000-000000000003',
    'b2100000-0000-4000-8000-000000000003',
    2::smallint,
    true,
    false
  );
  if not (
    select flower_rewards_allowed
    from public.student_experience_settings
    where organization_id = 'b2200000-0000-4000-8000-000000000001'
      and student_id = 'b2100000-0000-4000-8000-000000000003'
  ) then
    raise exception 'Student preference update changed the staff flower frame';
  end if;

  perform public.update_student_experience_for_staff_v2(
    'b2200000-0000-4000-8000-000000000001',
    'b2300000-0000-4000-8000-000000000001',
    'b2100000-0000-4000-8000-000000000003',
    'b2100000-0000-4000-8000-000000000002',
    staff_assignment_id,
    3::smallint,
    true
  );
  if not (
    select progress_enabled and not flower_rewards_visible
    from public.student_experience_settings
    where organization_id = 'b2200000-0000-4000-8000-000000000001'
      and student_id = 'b2100000-0000-4000-8000-000000000003'
  ) then
    raise exception 'Later staff update overwrote a student visibility preference';
  end if;

  perform public.update_student_experience_v2(
    'b2200000-0000-4000-8000-000000000001',
    'b2100000-0000-4000-8000-000000000003',
    'b2100000-0000-4000-8000-000000000003',
    3::smallint,
    true,
    true
  );

  denial_message := null;
  begin
    perform public.update_student_experience_for_staff_v2(
      'b2200000-0000-4000-8000-000000000001',
      'b2300000-0000-4000-8000-000000000002',
      'b2100000-0000-4000-8000-000000000003',
      'b2100000-0000-4000-8000-000000000002',
      staff_assignment_id,
      2::smallint,
      true
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is null then
    raise exception 'Wrong-class staff frame update was accepted';
  end if;

  first_claim := public.claim_student_flower_reward_v1(
    'b2200000-0000-4000-8000-000000000001',
    first_entitlement_id,
    'b2100000-0000-4000-8000-000000000003',
    'b2100000-0000-4000-8000-000000000003',
    'b2700000-0000-4000-8000-000000000003',
    'turquoise'
  );
  retry_claim := public.claim_student_flower_reward_v1(
    'b2200000-0000-4000-8000-000000000001',
    first_entitlement_id,
    'b2100000-0000-4000-8000-000000000003',
    'b2100000-0000-4000-8000-000000000003',
    'b2700000-0000-4000-8000-000000000003',
    'turquoise'
  );

  if first_claim <> retry_claim
    or first_claim ->> 'reward_type' <> 'flower_petal_v1'
    or first_claim ->> 'flower_color' <> 'turquoise'
    or (first_claim ->> 'collection_sequence')::bigint <> 1
    or (first_claim ->> 'flower_number')::bigint <> 1
    or (first_claim ->> 'petal_number')::bigint <> 1
  then
    raise exception 'Canonical first flower claim is wrong: %, %', first_claim, retry_claim;
  end if;

  denial_message := null;
  begin
    perform public.claim_student_flower_reward_v1(
      'b2200000-0000-4000-8000-000000000001',
      first_entitlement_id,
      'b2100000-0000-4000-8000-000000000003',
      'b2100000-0000-4000-8000-000000000003',
      'b2700000-0000-4000-8000-000000000003',
      'blue'
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from 'Request ID was already used with another reward choice' then
    raise exception 'Request fingerprint conflict was not rejected: %', denial_message;
  end if;

  perform public.undo_student_task_completion_v2(
    'b2200000-0000-4000-8000-000000000001',
    'b2500000-0000-4000-8000-000000000001',
    'b2100000-0000-4000-8000-000000000003',
    'b2700000-0000-4000-8000-000000000004',
    2,
    1
  );

  if not exists (
    select 1
    from public.level_reward_entitlements as entitlement
    join public.reward_claims as claim on claim.entitlement_id = entitlement.id
    where entitlement.id = first_entitlement_id
      and entitlement.status = 'selected'
      and entitlement.selected_at = claim.claimed_at
      and claim.flower_color = 'turquoise'
  ) then
    raise exception 'Claimed flower did not survive XP reversal';
  end if;

  perform public.complete_student_task_v2(
    'b2200000-0000-4000-8000-000000000001',
    'b2500000-0000-4000-8000-000000000001',
    'b2100000-0000-4000-8000-000000000003',
    'b2700000-0000-4000-8000-000000000005',
    3,
    1
  );

  if (select count(*) from public.level_reward_entitlements where student_id = 'b2100000-0000-4000-8000-000000000003') <> 1
    or (select count(*) from public.reward_claims where student_id = 'b2100000-0000-4000-8000-000000000003') <> 1
  then
    raise exception 'Regained level duplicated reward history';
  end if;

  perform public.complete_student_task_v2(
    'b2200000-0000-4000-8000-000000000001',
    'b2500000-0000-4000-8000-000000000002',
    'b2100000-0000-4000-8000-000000000003',
    'b2700000-0000-4000-8000-000000000006',
    1,
    1
  );

  select id into second_entitlement_id
  from public.level_reward_entitlements
  where student_id = 'b2100000-0000-4000-8000-000000000003'
    and level = 3;

  execute 'create trigger flower_reward_audit_failure '
    || 'before insert on public.audit_events '
    || 'for each row execute function pg_temp.reject_reward_audit()';

  denial_message := null;
  begin
    perform public.claim_student_flower_reward_v1(
      'b2200000-0000-4000-8000-000000000001',
      second_entitlement_id,
      'b2100000-0000-4000-8000-000000000003',
      'b2100000-0000-4000-8000-000000000003',
      'b2700000-0000-4000-8000-000000000007',
      'purple'
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from 'Injected reward audit failure'
    or exists (select 1 from public.reward_claims where entitlement_id = second_entitlement_id)
    or (select status from public.level_reward_entitlements where id = second_entitlement_id) <> 'available'
  then
    raise exception 'Audit failure did not roll back the claim atomically: %', denial_message;
  end if;

  execute 'drop trigger flower_reward_audit_failure on public.audit_events';

  perform public.claim_student_flower_reward_v1(
    'b2200000-0000-4000-8000-000000000001',
    second_entitlement_id,
    'b2100000-0000-4000-8000-000000000003',
    'b2100000-0000-4000-8000-000000000003',
    'b2700000-0000-4000-8000-000000000007',
    'purple'
  );

  perform public.complete_student_task_v2(
    'b2200000-0000-4000-8000-000000000001',
    'b2500000-0000-4000-8000-000000000003',
    'b2100000-0000-4000-8000-000000000004',
    'b2700000-0000-4000-8000-000000000008',
    1,
    1
  );
  select id into student_b_entitlement_id
  from public.level_reward_entitlements
  where student_id = 'b2100000-0000-4000-8000-000000000004'
    and level = 2;
  perform public.undo_student_task_completion_v2(
    'b2200000-0000-4000-8000-000000000001',
    'b2500000-0000-4000-8000-000000000003',
    'b2100000-0000-4000-8000-000000000004',
    'b2700000-0000-4000-8000-000000000009',
    2,
    1
  );

  insert into public.student_experience_settings (
    organization_id,
    student_id,
    support_level,
    progress_enabled,
    flower_rewards_allowed,
    updated_by
  ) values (
    'b2200000-0000-4000-8000-000000000001',
    'b2100000-0000-4000-8000-000000000004',
    2,
    true,
    true,
    'b2100000-0000-4000-8000-000000000002'
  );

  denial_message := null;
  begin
    perform public.claim_student_flower_reward_v1(
      'b2200000-0000-4000-8000-000000000001',
      student_b_entitlement_id,
      'b2100000-0000-4000-8000-000000000004',
      'b2100000-0000-4000-8000-000000000004',
      'b2700000-0000-4000-8000-000000000010',
      'green'
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from 'Reward entitlement is unavailable' then
    raise exception 'Pending reward was claimable: %', denial_message;
  end if;

  perform public.complete_student_task_v2(
    'b2200000-0000-4000-8000-000000000001',
    'b2500000-0000-4000-8000-000000000003',
    'b2100000-0000-4000-8000-000000000004',
    'b2700000-0000-4000-8000-000000000011',
    3,
    1
  );
  insert into public.class_memberships (
    class_id,
    organization_id,
    user_id,
    role,
    created_by
  ) values (
    'b2300000-0000-4000-8000-000000000002',
    'b2200000-0000-4000-8000-000000000001',
    'b2100000-0000-4000-8000-000000000004',
    'student',
    'b2100000-0000-4000-8000-000000000001'
  );
  delete from public.class_memberships
  where class_id = 'b2300000-0000-4000-8000-000000000001'
    and user_id = 'b2100000-0000-4000-8000-000000000004';
  perform public.claim_student_flower_reward_v1(
    'b2200000-0000-4000-8000-000000000001',
    student_b_entitlement_id,
    'b2100000-0000-4000-8000-000000000004',
    'b2100000-0000-4000-8000-000000000004',
    'b2700000-0000-4000-8000-000000000012',
    'green'
  );

  denial_message := null;
  begin
    perform public.claim_student_flower_reward_v1(
      'b2200000-0000-4000-8000-000000000001',
      first_entitlement_id,
      'b2100000-0000-4000-8000-000000000004',
      'b2100000-0000-4000-8000-000000000004',
      'b2700000-0000-4000-8000-000000000013',
      'red'
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from 'Reward entitlement is unavailable' then
    raise exception 'Cross-student entitlement disclosed state: %', denial_message;
  end if;
end;
$$;

do $$
declare
  denial_message text;
  claim_id uuid;
begin
  if not has_function_privilege('authenticated', 'public.get_my_flower_rewards_v1(uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.get_my_flower_rewards_v1(uuid)', 'EXECUTE')
    or has_function_privilege('service_role', 'public.get_my_flower_rewards_v1(uuid)', 'EXECUTE')
    or not has_function_privilege(
      'service_role',
      'public.claim_student_flower_reward_v1(uuid,uuid,uuid,uuid,uuid,public.flower_reward_color)',
      'EXECUTE'
    )
    or has_function_privilege(
      'authenticated',
      'public.claim_student_flower_reward_v1(uuid,uuid,uuid,uuid,uuid,public.flower_reward_color)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'service_role',
      'public.update_student_experience_for_staff_v2(uuid,uuid,uuid,uuid,uuid,smallint,boolean)',
      'EXECUTE'
    )
    or has_function_privilege(
      'authenticated',
      'public.update_student_experience_for_staff_v2(uuid,uuid,uuid,uuid,uuid,smallint,boolean)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'service_role',
      'public.update_student_experience_v2(uuid,uuid,uuid,smallint,boolean,boolean)',
      'EXECUTE'
    )
    or has_function_privilege(
      'authenticated',
      'public.update_student_experience_v2(uuid,uuid,uuid,smallint,boolean,boolean)',
      'EXECUTE'
    )
    or has_table_privilege('authenticated', 'public.reward_claims', 'SELECT')
    or has_table_privilege('authenticated', 'public.reward_claims', 'INSERT')
    or has_table_privilege('service_role', 'public.reward_claims', 'INSERT')
  then
    raise exception 'Flower reward ACL boundary is incomplete';
  end if;

  select id into claim_id
  from public.reward_claims
  where student_id = 'b2100000-0000-4000-8000-000000000003'
  order by collection_sequence
  limit 1;

  denial_message := null;
  begin
    update public.reward_claims set flower_color = 'red' where id = claim_id;
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from 'Progress history is append-only' then
    raise exception 'Reward claim update was not blocked: %', denial_message;
  end if;

  denial_message := null;
  begin
    delete from public.reward_claims where id = claim_id;
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from 'Progress history is append-only' then
    raise exception 'Reward claim deletion was not blocked: %', denial_message;
  end if;

  if (select count(*) from public.audit_events where event_name = 'reward.claimed') <> 3
    or (select count(*) from public.reward_claims) <> 3
    or exists (
      select 1
      from public.reward_claims as claim
      join public.level_reward_entitlements as entitlement on entitlement.id = claim.entitlement_id
      where entitlement.status <> 'selected'
        or entitlement.selected_at is distinct from claim.claimed_at
    )
  then
    raise exception 'Reward claim history or audit count is inconsistent';
  end if;
end;
$$;

select public.update_student_experience_v2(
  'b2200000-0000-4000-8000-000000000001',
  'b2100000-0000-4000-8000-000000000003',
  'b2100000-0000-4000-8000-000000000003',
  3::smallint,
  true,
  false
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"b2100000-0000-4000-8000-000000000003","aal":"aal1","role":"authenticated"}',
  true
);

do $$
declare
  projection jsonb;
begin
  projection := public.get_my_flower_rewards_v1(
    'b2200000-0000-4000-8000-000000000001'
  );
  if projection ->> 'rewards_allowed' <> 'true'
    or projection ->> 'rewards_visible' <> 'false'
    or jsonb_array_length(projection -> 'claims') <> 0
    or jsonb_array_length(projection -> 'available_entitlements') <> 0
  then
    raise exception 'Hidden flower projection exposed reward data: %', projection;
  end if;
end;
$$;

reset role;

select public.update_student_experience_v2(
  'b2200000-0000-4000-8000-000000000001',
  'b2100000-0000-4000-8000-000000000003',
  'b2100000-0000-4000-8000-000000000003',
  3::smallint,
  true,
  true
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"b2100000-0000-4000-8000-000000000003","aal":"aal1","role":"authenticated"}',
  true
);

do $$
declare
  projection jsonb;
begin
  projection := public.get_my_flower_rewards_v1(
    'b2200000-0000-4000-8000-000000000001'
  );
  if projection ->> 'rewards_allowed' <> 'true'
    or projection ->> 'rewards_visible' <> 'true'
    or projection ->> 'progress_enabled' <> 'true'
    or jsonb_array_length(projection -> 'claims') <> 2
    or jsonb_array_length(projection -> 'available_entitlements') <> 0
    or exists (
      select 1 from jsonb_array_elements(projection -> 'claims') as claim
      where claim ->> 'flower_color' not in ('turquoise', 'purple')
    )
  then
    raise exception 'Own flower projection is wrong: %', projection;
  end if;
end;
$$;

reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"b2100000-0000-4000-8000-000000000002","aal":"aal2","role":"authenticated"}',
  true
);

do $$
declare
  denial_message text;
begin
  begin
    perform public.get_my_flower_rewards_v1(
      'b2200000-0000-4000-8000-000000000001'
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from 'Student membership is required' then
    raise exception 'Staff caller-bound read was not rejected: %', denial_message;
  end if;
end;
$$;

reset role;

insert into public.class_memberships (
  class_id,
  organization_id,
  user_id,
  role,
  created_by
) values (
  'b2300000-0000-4000-8000-000000000002',
  'b2200000-0000-4000-8000-000000000001',
  'b2100000-0000-4000-8000-000000000003',
  'student',
  'b2100000-0000-4000-8000-000000000001'
);
delete from public.class_memberships
where class_id = 'b2300000-0000-4000-8000-000000000001'
  and user_id = 'b2100000-0000-4000-8000-000000000003';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"b2100000-0000-4000-8000-000000000003","aal":"aal1","role":"authenticated"}',
  true
);

do $$
declare
  projection jsonb;
begin
  projection := public.get_my_flower_rewards_v1(
    'b2200000-0000-4000-8000-000000000001'
  );
  if jsonb_array_length(projection -> 'claims') <> 2 then
    raise exception 'Class transition hid durable reward history: %', projection;
  end if;
end;
$$;

reset role;

delete from public.class_memberships
where class_id = 'b2300000-0000-4000-8000-000000000002'
  and user_id = 'b2100000-0000-4000-8000-000000000003';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"b2100000-0000-4000-8000-000000000003","aal":"aal1","role":"authenticated"}',
  true
);

do $$
declare
  denial_message text;
begin
  begin
    perform public.get_my_flower_rewards_v1(
      'b2200000-0000-4000-8000-000000000001'
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from 'Student membership is required' then
    raise exception 'No active class membership still exposed reward history: %', denial_message;
  end if;
end;
$$;

reset role;

rollback;
