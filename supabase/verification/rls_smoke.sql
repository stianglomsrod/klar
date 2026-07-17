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

select public.create_staff_assignment(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'contact_teacher',
  transaction_timestamp() - interval '1 day',
  transaction_timestamp() + interval '1 day',
  '12345678-1234-4234-8234-123456789001'
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
declare
  table_without_rls text;
begin
  select class.relname
  into table_without_rls
  from pg_class as class
  where class.relnamespace = 'public'::regnamespace
    and class.relkind = 'r'
    and not class.relrowsecurity
  order by class.relname
  limit 1;

  if table_without_rls is not null then
    raise exception 'Public table lacks RLS: %', table_without_rls;
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
  'request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","aal":"aal1","role":"authenticated"}',
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

  if has_table_privilege('authenticated', 'public.help_requests', 'SELECT') then
    raise exception 'Student browser role must not read internal help request state';
  end if;

  if (select count(*) from public.student_experience_settings) <> 1 then
    raise exception 'Student should only see their own experience settings';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","aal":"aal2","role":"authenticated"}',
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

  if has_table_privilege('authenticated', 'public.help_requests', 'SELECT') then
    raise exception 'Staff browser role must use the authorized server projection for help requests';
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
  progress_result jsonb;
  experience_settings public.student_experience_settings;
  staff_assignment_id uuid;
  owner_assignment_id uuid;
begin
  select assignment.id
  into staff_assignment_id
  from public.staff_assignments as assignment
  join public.staff_assignment_class_scopes as scope
    on scope.assignment_id = assignment.id
  where assignment.user_id = '22222222-2222-2222-2222-222222222222'
    and scope.class_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
    and assignment.revoked_at is null;

  created_class_id := public.create_class_for_teacher(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    'Class created by RPC',
    '2026/2027'
  );

  if not exists (
    select 1
    from public.class_memberships
    where class_id = created_class_id
      and user_id = '11111111-1111-1111-1111-111111111111'
      and role = 'teacher'
  ) then
    raise exception 'Class RPC did not assign its teacher';
  end if;

  select assignment.id
  into owner_assignment_id
  from public.staff_assignments as assignment
  join public.staff_assignment_class_scopes as scope
    on scope.assignment_id = assignment.id
  where assignment.organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    and assignment.user_id = '11111111-1111-1111-1111-111111111111'
    and assignment.job_label = 'operational_owner'
    and assignment.source = 'class_creation'
    and assignment.starts_at = transaction_timestamp()
    and assignment.ends_at is null
    and assignment.revoked_at is null
    and scope.organization_id = assignment.organization_id
    and scope.class_id = created_class_id;

  if owner_assignment_id is null
    or (
      select count(*)
      from public.staff_assignment_capabilities
      where assignment_id = owner_assignment_id
    ) <> 8
    or not exists (
      select 1
      from public.audit_events
      where event_name = 'class.created'
        and actor_id = '11111111-1111-1111-1111-111111111111'
        and entity_id = created_class_id
        and metadata ->> 'operational_owner_assignment_id' = owner_assignment_id::text
    )
    or not exists (
      select 1
      from public.audit_events
      where event_name = 'staff_assignment.created'
        and actor_id = '11111111-1111-1111-1111-111111111111'
        and entity_id = owner_assignment_id
        and metadata ->> 'class_id' = created_class_id::text
        and metadata ->> 'job_label' = 'operational_owner'
        and metadata ->> 'source' = 'class_creation'
    )
  then
    raise exception 'Class RPC did not atomically create its operational owner authorization';
  end if;

  published_task_id := public.publish_task_to_class(
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '22222222-2222-2222-2222-222222222222',
    staff_assignment_id,
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
    staff_assignment_id,
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

  progress_result := public.complete_student_task(
    published_assignment_id,
    '33333333-3333-3333-3333-333333333333',
    '77777777-7777-4777-8777-777777777701'
  );

  if progress_result ->> 'status' <> 'completed'
    or progress_result ->> 'changed' <> 'true'
    or (progress_result ->> 'xp_delta')::integer <> 10
    or (progress_result ->> 'xp_balance')::bigint <> 10
  then
    raise exception 'Student completion RPC did not atomically persist XP: %', progress_result;
  end if;

  experience_settings := public.update_student_experience_for_staff(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '33333333-3333-3333-3333-333333333333',
    '22222222-2222-2222-2222-222222222222',
    staff_assignment_id,
    1::smallint,
    true
  );

  if experience_settings.support_level <> 1
    or not experience_settings.progress_enabled
  then
    raise exception 'Student experience RPC did not persist preferences';
  end if;

end;
$$;

reset role;

create function pg_temp.fail_class_creation_audit()
returns trigger
language plpgsql
as $$
begin
  raise exception 'forced class audit failure';
end;
$$;

create trigger a1_force_class_audit_failure
before insert on public.audit_events
for each row
when (
  new.event_name = 'class.created'
  and new.metadata ->> 'academic_year' = 'ROLLBACK'
)
execute function pg_temp.fail_class_creation_audit();

do $$
declare
  class_count_before integer;
  assignment_count_before integer;
  scope_count_before integer;
  capability_count_before integer;
  audit_count_before integer;
  forced_failure boolean := false;
begin
  select count(*) into class_count_before from public.classes;
  select count(*) into assignment_count_before from public.staff_assignments;
  select count(*) into scope_count_before from public.staff_assignment_class_scopes;
  select count(*) into capability_count_before from public.staff_assignment_capabilities;
  select count(*) into audit_count_before from public.audit_events;

  begin
    perform public.create_class_for_teacher(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '11111111-1111-1111-1111-111111111111',
      'Rollback class',
      'ROLLBACK'
    );
  exception when others then
    forced_failure := sqlerrm = 'forced class audit failure';
  end;

  if not forced_failure
    or (select count(*) from public.classes) <> class_count_before
    or (select count(*) from public.staff_assignments) <> assignment_count_before
    or (select count(*) from public.staff_assignment_class_scopes) <> scope_count_before
    or (select count(*) from public.staff_assignment_capabilities) <> capability_count_before
    or (select count(*) from public.audit_events) <> audit_count_before
    or exists (select 1 from public.classes where name = 'Rollback class')
  then
    raise exception 'Class control-plane RPC did not roll back atomically after audit failure';
  end if;
end;
$$;

drop trigger a1_force_class_audit_failure on public.audit_events;
rollback;
