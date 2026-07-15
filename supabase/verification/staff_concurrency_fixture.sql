\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data)
select id, email, jsonb_build_object('display_name', display_name)
from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'owner@concurrency.test', 'Eier samtidighet'),
  ('a0000000-0000-4000-8000-000000000002'::uuid, 'retry@concurrency.test', 'Retry-ansatt'),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 'revoke@concurrency.test', 'Revoke-ansatt'),
  ('a0000000-0000-4000-8000-000000000004'::uuid, 'race@concurrency.test', 'Race-ansatt'),
  ('a0000000-0000-4000-8000-000000000005'::uuid, 'demote@concurrency.test', 'Demote-ansatt'),
  ('a0000000-0000-4000-8000-000000000006'::uuid, 'student@concurrency.test', 'Elev samtidighet')
) as fixture(id, email, display_name);

insert into public.organizations (id, name, created_by)
values ('b0000000-0000-4000-8000-000000000001', 'Samtidighetsorg', 'a0000000-0000-4000-8000-000000000001');

insert into public.memberships (organization_id, user_id, role, created_by)
select
  'b0000000-0000-4000-8000-000000000001',
  user_id,
  role,
  'a0000000-0000-4000-8000-000000000001'
from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'owner'::public.organization_role),
  ('a0000000-0000-4000-8000-000000000002'::uuid, 'teacher'::public.organization_role),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 'teacher'::public.organization_role),
  ('a0000000-0000-4000-8000-000000000004'::uuid, 'teacher'::public.organization_role),
  ('a0000000-0000-4000-8000-000000000005'::uuid, 'teacher'::public.organization_role),
  ('a0000000-0000-4000-8000-000000000006'::uuid, 'student'::public.organization_role)
) as members(user_id, role);

insert into public.classes (id, organization_id, name, created_by)
values (
  'c0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000001',
  'Samtidighetsklasse',
  'a0000000-0000-4000-8000-000000000001'
);

insert into public.class_memberships (class_id, organization_id, user_id, role, created_by)
values (
  'c0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000006',
  'student',
  'a0000000-0000-4000-8000-000000000001'
);

select public.create_staff_assignment(
  'b0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  target_user_id,
  'c0000000-0000-4000-8000-000000000001',
  'substitute',
  transaction_timestamp() - interval '1 hour',
  transaction_timestamp() + interval '1 day',
  idempotency_key
)
from (values
  ('a0000000-0000-4000-8000-000000000003'::uuid, 'd0000000-0000-4000-8000-000000000003'::uuid),
  ('a0000000-0000-4000-8000-000000000004'::uuid, 'd0000000-0000-4000-8000-000000000004'::uuid)
) as grants(target_user_id, idempotency_key);
