\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  (
    '11111111-1111-1111-1111-111111111111',
    'owner@example.test',
    '{"display_name":"Owner"}'::jsonb
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'teacher@example.test',
    '{"display_name":"Teacher A"}'::jsonb
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'student-a@example.test',
    '{"display_name":"Student A"}'::jsonb
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    'student-b@example.test',
    '{"display_name":"Student B"}'::jsonb
  );

insert into public.organizations (id, name, created_by) values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'School A',
    '11111111-1111-1111-1111-111111111111'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'School B',
    '11111111-1111-1111-1111-111111111111'
  );

insert into public.memberships (
  organization_id,
  user_id,
  role,
  created_by
) values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    'owner',
    '11111111-1111-1111-1111-111111111111'
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    'teacher',
    '11111111-1111-1111-1111-111111111111'
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '33333333-3333-3333-3333-333333333333',
    'student',
    '11111111-1111-1111-1111-111111111111'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '44444444-4444-4444-4444-444444444444',
    'student',
    '11111111-1111-1111-1111-111111111111'
  );

insert into public.classes (id, organization_id, name, created_by) values
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Class A',
    '22222222-2222-2222-2222-222222222222'
  ),
  (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'Class B',
    '11111111-1111-1111-1111-111111111111'
  );

insert into public.class_memberships (
  class_id,
  organization_id,
  user_id,
  role,
  created_by
) values
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    'teacher',
    '11111111-1111-1111-1111-111111111111'
  ),
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '33333333-3333-3333-3333-333333333333',
    'student',
    '22222222-2222-2222-2222-222222222222'
  ),
  (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '44444444-4444-4444-4444-444444444444',
    'student',
    '11111111-1111-1111-1111-111111111111'
  );

insert into public.task_definitions (
  id,
  organization_id,
  class_id,
  title,
  publication_status,
  created_by,
  published_at
) values
  (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'Task A',
    'published',
    '22222222-2222-2222-2222-222222222222',
    now()
  ),
  (
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'Task B',
    'published',
    '11111111-1111-1111-1111-111111111111',
    now()
  );

insert into public.task_assignments (
  id,
  organization_id,
  class_id,
  task_definition_id,
  student_id,
  assigned_by
) values (
  '10000000-0000-0000-0000-000000000001',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  '33333333-3333-3333-3333-333333333333',
  '22222222-2222-2222-2222-222222222222'
);

insert into public.student_task_state (
  assignment_id,
  organization_id,
  student_id
) values (
  '10000000-0000-0000-0000-000000000001',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '33333333-3333-3333-3333-333333333333'
);

insert into public.help_requests (
  organization_id,
  class_id,
  student_id,
  task_assignment_id
) values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  '33333333-3333-3333-3333-333333333333',
  '10000000-0000-0000-0000-000000000001'
);

insert into public.student_experience_settings (
  organization_id,
  student_id,
  support_level,
  progress_enabled,
  updated_by
) values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '33333333-3333-3333-3333-333333333333',
    2,
    false,
    '22222222-2222-2222-2222-222222222222'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '44444444-4444-4444-4444-444444444444',
    3,
    true,
    '11111111-1111-1111-1111-111111111111'
  );

do $$
begin
  if (
    select count(*)
    from pg_class
    where relnamespace = 'public'::regnamespace
      and relkind = 'r'
      and relrowsecurity
  ) <> 12 then
    raise exception 'Expected RLS on all twelve prototype tables';
  end if;

  if has_table_privilege('anon', 'public.profiles', 'SELECT') then
    raise exception 'Anonymous role must not have table access';
  end if;

  if has_table_privilege('authenticated', 'public.profiles', 'UPDATE') then
    raise exception 'Authenticated clients must not mutate profiles directly';
  end if;

  if has_table_privilege(
    'authenticated',
    'public.student_login_codes',
    'SELECT'
  ) then
    raise exception 'Authenticated clients must not read student login codes';
  end if;

  if has_function_privilege(
    'anon',
    'public.is_organization_member(uuid)',
    'EXECUTE'
  ) then
    raise exception 'Anonymous role must not execute authorization helpers';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.handle_new_auth_user()',
    'EXECUTE'
  ) then
    raise exception 'Authenticated role must not execute trigger functions';
  end if;
end;
$$;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '33333333-3333-3333-3333-333333333333',
  true
);

do $$
declare
  visible_profiles text[];
  visible_tasks text[];
begin
  select array_agg(display_name order by display_name)
  into visible_profiles
  from public.profiles;

  if visible_profiles is distinct from array['Student A']::text[] then
    raise exception 'Student profile isolation failed: %', visible_profiles;
  end if;

  select array_agg(title order by title)
  into visible_tasks
  from public.task_definitions;

  if visible_tasks is distinct from array['Task A']::text[] then
    raise exception 'Student task isolation failed: %', visible_tasks;
  end if;

  if (select count(*) from public.help_requests) <> 1 then
    raise exception 'Student should only see their own help request';
  end if;

  if (select count(*) from public.student_experience_settings) <> 1 then
    raise exception 'Student should only see their own experience settings';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '22222222-2222-2222-2222-222222222222',
  true
);

do $$
declare
  visible_profiles text[];
  visible_tasks text[];
begin
  select array_agg(display_name order by display_name)
  into visible_profiles
  from public.profiles;

  if visible_profiles is distinct from
    array['Student A', 'Teacher A']::text[] then
    raise exception 'Teacher class isolation failed: %', visible_profiles;
  end if;

  select array_agg(title order by title)
  into visible_tasks
  from public.task_definitions;

  if visible_tasks is distinct from array['Task A']::text[] then
    raise exception 'Teacher task isolation failed: %', visible_tasks;
  end if;

  if (select count(*) from public.help_requests) <> 1 then
    raise exception 'Teacher should only see help requests in their class';
  end if;

  if (select count(*) from public.student_experience_settings) <> 1 then
    raise exception 'Teacher should only see settings for students in their class';
  end if;
end;
$$;

reset role;

set local role service_role;

do $$
declare
  created_class_id uuid;
  published_task_id uuid;
  published_plan_ids uuid[];
  published_assignment_id uuid;
  resulting_status public.student_task_status;
  initial_help_id uuid;
  queue_request public.help_requests;
  experience_settings public.student_experience_settings;
begin
  created_class_id := public.create_class_for_teacher(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    'Class created by RPC',
    '2026/2027'
  );

  if not exists (
    select 1
    from public.class_memberships
    where class_id = created_class_id
      and user_id = '22222222-2222-2222-2222-222222222222'
      and role = 'teacher'
  ) then
    raise exception 'Class RPC did not assign its teacher';
  end if;

  published_task_id := public.publish_task_to_class(
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '22222222-2222-2222-2222-222222222222',
    'Task created by RPC'
  );

  select id
  into published_assignment_id
  from public.task_assignments
  where task_definition_id = published_task_id
    and student_id = '33333333-3333-3333-3333-333333333333';

  if published_assignment_id is null then
    raise exception 'Publish RPC did not assign the task to the class student';
  end if;

  published_plan_ids := public.publish_plan_to_class(
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '22222222-2222-2222-2222-222222222222',
    '[
      {"title":"Imported task one","subject":"Norsk","support_level":2},
      {"title":"Imported task two","estimated_minutes":15,"support_level":3}
    ]'::jsonb
  );

  if cardinality(published_plan_ids) <> 2 then
    raise exception 'Plan import RPC did not publish every task';
  end if;

  if (
    select count(*)
    from public.task_assignments
    where task_definition_id = any(published_plan_ids)
      and student_id = '33333333-3333-3333-3333-333333333333'
  ) <> 2 then
    raise exception 'Plan import RPC did not assign every imported task';
  end if;

  select status
  into resulting_status
  from public.update_student_task_status(
    published_assignment_id,
    '33333333-3333-3333-3333-333333333333',
    'completed'
  );

  if resulting_status <> 'completed' then
    raise exception 'Student status RPC did not persist completion';
  end if;

  experience_settings := public.update_student_experience(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '33333333-3333-3333-3333-333333333333',
    '22222222-2222-2222-2222-222222222222',
    1::smallint,
    true
  );

  if experience_settings.support_level <> 1
    or not experience_settings.progress_enabled
  then
    raise exception 'Student experience RPC did not persist preferences';
  end if;

  select id
  into initial_help_id
  from public.help_requests
  where student_id = '33333333-3333-3333-3333-333333333333'
    and status = 'waiting';

  queue_request := public.request_student_help(
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '33333333-3333-3333-3333-333333333333',
    '10000000-0000-0000-0000-000000000001'
  );

  if queue_request.id <> initial_help_id then
    raise exception 'Repeated help request was not idempotent';
  end if;

  queue_request := public.claim_student_help(
    initial_help_id,
    '22222222-2222-2222-2222-222222222222'
  );
  if queue_request.status <> 'claimed' then
    raise exception 'Teacher could not claim the help request';
  end if;

  queue_request := public.resolve_student_help(
    initial_help_id,
    '22222222-2222-2222-2222-222222222222'
  );
  if queue_request.status <> 'resolved' then
    raise exception 'Teacher could not resolve the help request';
  end if;

  queue_request := public.request_student_help(
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '33333333-3333-3333-3333-333333333333',
    null
  );
  queue_request := public.cancel_student_help(
    queue_request.id,
    '33333333-3333-3333-3333-333333333333'
  );
  if queue_request.status <> 'cancelled' then
    raise exception 'Student could not cancel their help request';
  end if;
end;
$$;

reset role;
rollback;
