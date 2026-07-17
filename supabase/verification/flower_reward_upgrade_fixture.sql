\set ON_ERROR_STOP on

select public.create_staff_assignment(
  '82000000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000001',
  '83000000-0000-4000-8000-000000000002',
  'substitute',
  transaction_timestamp() - interval '1 hour',
  transaction_timestamp() + interval '1 day',
  'b2d00000-0000-4000-8000-000000000001'
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
  (
    'b2a00000-0000-4000-8000-000000000001',
    '82000000-0000-4000-8000-000000000001',
    '83000000-0000-4000-8000-000000000002',
    'Historisk flernivåbelønning',
    'published',
    '81000000-0000-4000-8000-000000000001',
    transaction_timestamp(),
    2000
  ),
  (
    'b2a00000-0000-4000-8000-000000000002',
    '82000000-0000-4000-8000-000000000001',
    '83000000-0000-4000-8000-000000000002',
    'Historisk gjenvunnet nivå',
    'published',
    '81000000-0000-4000-8000-000000000001',
    transaction_timestamp(),
    1000
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
    'b2b00000-0000-4000-8000-000000000001',
    '82000000-0000-4000-8000-000000000001',
    '83000000-0000-4000-8000-000000000002',
    'b2a00000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000004',
    '81000000-0000-4000-8000-000000000001'
  ),
  (
    'b2b00000-0000-4000-8000-000000000002',
    '82000000-0000-4000-8000-000000000001',
    '83000000-0000-4000-8000-000000000002',
    'b2a00000-0000-4000-8000-000000000002',
    '81000000-0000-4000-8000-000000000004',
    '81000000-0000-4000-8000-000000000001'
  );

insert into public.student_task_state (assignment_id, organization_id, student_id)
values
  (
    'b2b00000-0000-4000-8000-000000000001',
    '82000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000004'
  ),
  (
    'b2b00000-0000-4000-8000-000000000002',
    '82000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000004'
  );

select public.complete_student_task_v2(
  '82000000-0000-4000-8000-000000000001',
  'b2b00000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000004',
  'b2c00000-0000-4000-8000-000000000001',
  1,
  1
);

select public.undo_student_task_completion_v2(
  '82000000-0000-4000-8000-000000000001',
  'b2b00000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000004',
  'b2c00000-0000-4000-8000-000000000002',
  2,
  1
);

select public.complete_student_task_v2(
  '82000000-0000-4000-8000-000000000001',
  'b2b00000-0000-4000-8000-000000000002',
  '81000000-0000-4000-8000-000000000004',
  'b2c00000-0000-4000-8000-000000000003',
  1,
  1
);

do $$
begin
  if (
    select array_agg(status::text order by level)
    from public.level_reward_entitlements
    where organization_id = '82000000-0000-4000-8000-000000000001'
      and student_id = '81000000-0000-4000-8000-000000000004'
  ) <> array['available', 'pending'] then
    raise exception 'Pre-B2 reward upgrade fixture has wrong entitlement states';
  end if;
end;
$$;

update public.level_reward_entitlements
set status = 'selected',
    selected_at = transaction_timestamp()
where organization_id = '82000000-0000-4000-8000-000000000001'
  and student_id = '81000000-0000-4000-8000-000000000004'
  and level = 2;
