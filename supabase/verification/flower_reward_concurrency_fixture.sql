\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data)
values (
  'b2e00000-0000-4000-8000-000000000001',
  'reward-race-student@flower.test',
  '{"display_name":"Samtidig blomsterelev"}'::jsonb
);

insert into public.memberships (organization_id, user_id, role, created_by)
values (
  'b0000000-0000-4000-8000-000000000001',
  'b2e00000-0000-4000-8000-000000000001',
  'student',
  'a0000000-0000-4000-8000-000000000001'
);

insert into public.classes (id, organization_id, name, created_by)
values (
  'b2e10000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000001',
  'Isolert blomster-raceklasse',
  'a0000000-0000-4000-8000-000000000001'
);

select public.create_staff_assignment(
  'b0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000004',
  'b2e10000-0000-4000-8000-000000000001',
  'substitute',
  transaction_timestamp() - interval '1 hour',
  transaction_timestamp() + interval '1 day',
  'b2e20000-0000-4000-8000-000000000001'
);

insert into public.class_memberships (
  class_id,
  organization_id,
  user_id,
  role,
  created_by
) values (
  'b2e10000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000001',
  'b2e00000-0000-4000-8000-000000000001',
  'student',
  'a0000000-0000-4000-8000-000000000001'
);

insert into public.student_experience_settings (
  organization_id,
  student_id,
  support_level,
  progress_enabled,
  flower_rewards_allowed,
  updated_by
) values (
  'b0000000-0000-4000-8000-000000000001',
  'b2e00000-0000-4000-8000-000000000001',
  2,
  true,
  true,
  'a0000000-0000-4000-8000-000000000004'
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
)
select
  id,
  'b0000000-0000-4000-8000-000000000001',
  'b2e10000-0000-4000-8000-000000000001',
  title,
  'published',
  'a0000000-0000-4000-8000-000000000004',
  transaction_timestamp(),
  1000
from (values
  ('b2f00000-0000-4000-8000-000000000001'::uuid, 'Lik blomsterrequest samtidig'),
  ('b2f00000-0000-4000-8000-000000000002'::uuid, 'To blomsterfarger samtidig'),
  ('b2f00000-0000-4000-8000-000000000003'::uuid, 'Blomsterclaim mot angre')
) as definitions(id, title);

insert into public.task_assignments (
  id,
  organization_id,
  class_id,
  task_definition_id,
  student_id,
  assigned_by
)
select
  assignment_id,
  'b0000000-0000-4000-8000-000000000001',
  'b2e10000-0000-4000-8000-000000000001',
  definition_id,
  'b2e00000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000004'
from (values
  ('b2f10000-0000-4000-8000-000000000001'::uuid, 'b2f00000-0000-4000-8000-000000000001'::uuid),
  ('b2f10000-0000-4000-8000-000000000002'::uuid, 'b2f00000-0000-4000-8000-000000000002'::uuid),
  ('b2f10000-0000-4000-8000-000000000003'::uuid, 'b2f00000-0000-4000-8000-000000000003'::uuid)
) as assignments(assignment_id, definition_id);

insert into public.student_task_state (assignment_id, organization_id, student_id)
select
  assignment.id,
  assignment.organization_id,
  assignment.student_id
from public.task_assignments as assignment
where assignment.student_id = 'b2e00000-0000-4000-8000-000000000001';
