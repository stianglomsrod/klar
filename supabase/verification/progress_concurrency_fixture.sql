\set ON_ERROR_STOP on

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
  'c0000000-0000-4000-8000-000000000001',
  title,
  'published',
  'a0000000-0000-4000-8000-000000000001',
  transaction_timestamp(),
  10
from (values
  ('f1000000-0000-4000-8000-000000000001'::uuid, 'Samtidig fullføring'),
  ('f1000000-0000-4000-8000-000000000002'::uuid, 'Parallell oppgave A'),
  ('f1000000-0000-4000-8000-000000000003'::uuid, 'Parallell oppgave B'),
  ('f1000000-0000-4000-8000-000000000004'::uuid, 'Angre mot retur'),
  ('f1000000-0000-4000-8000-000000000005'::uuid, 'Lik request samtidig'),
  ('f1000000-0000-4000-8000-000000000006'::uuid, 'Atomisk rollback')
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
  'c0000000-0000-4000-8000-000000000001',
  definition_id,
  'a0000000-0000-4000-8000-000000000006',
  'a0000000-0000-4000-8000-000000000004'
from (values
  ('f2000000-0000-4000-8000-000000000001'::uuid, 'f1000000-0000-4000-8000-000000000001'::uuid),
  ('f2000000-0000-4000-8000-000000000002'::uuid, 'f1000000-0000-4000-8000-000000000002'::uuid),
  ('f2000000-0000-4000-8000-000000000003'::uuid, 'f1000000-0000-4000-8000-000000000003'::uuid),
  ('f2000000-0000-4000-8000-000000000004'::uuid, 'f1000000-0000-4000-8000-000000000004'::uuid),
  ('f2000000-0000-4000-8000-000000000005'::uuid, 'f1000000-0000-4000-8000-000000000005'::uuid),
  ('f2000000-0000-4000-8000-000000000006'::uuid, 'f1000000-0000-4000-8000-000000000006'::uuid)
) as assignments(assignment_id, definition_id);

insert into public.student_task_state (assignment_id, organization_id, student_id)
select
  assignment.id,
  assignment.organization_id,
  assignment.student_id
from public.task_assignments as assignment
where assignment.id in (
  'f2000000-0000-4000-8000-000000000001',
  'f2000000-0000-4000-8000-000000000002',
  'f2000000-0000-4000-8000-000000000003',
  'f2000000-0000-4000-8000-000000000004',
  'f2000000-0000-4000-8000-000000000005',
  'f2000000-0000-4000-8000-000000000006'
);
