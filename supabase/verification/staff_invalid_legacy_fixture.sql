\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('91000000-0000-4000-8000-000000000001', 'owner@invalid.test', '{"display_name":"Eier"}'),
  ('91000000-0000-4000-8000-000000000002', 'contradiction@invalid.test', '{"display_name":"Motsigelse"}');

insert into public.organizations (id, name, created_by)
values ('92000000-0000-4000-8000-000000000001', 'Ugyldig legacyorg', '91000000-0000-4000-8000-000000000001');

insert into public.memberships (organization_id, user_id, role, created_by) values
  ('92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'owner', '91000000-0000-4000-8000-000000000001'),
  ('92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000002', 'teacher', '91000000-0000-4000-8000-000000000001');

insert into public.classes (id, organization_id, name, created_by)
values ('93000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', 'Motsigende klasse', '91000000-0000-4000-8000-000000000001');

insert into public.class_memberships (class_id, organization_id, user_id, role, created_by)
values ('93000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000002', 'teacher', '91000000-0000-4000-8000-000000000001');

update public.memberships
set role = 'student'
where organization_id = '92000000-0000-4000-8000-000000000001'
  and user_id = '91000000-0000-4000-8000-000000000002';
