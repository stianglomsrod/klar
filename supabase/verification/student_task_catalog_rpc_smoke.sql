\set ON_ERROR_STOP on

begin;

do $$
declare
  staff_assignment_id uuid;
begin
  select assignment.id
  into staff_assignment_id
  from public.staff_assignments as assignment
  join public.staff_assignment_class_scopes as scope
    on scope.assignment_id = assignment.id
   and scope.organization_id = assignment.organization_id
  where assignment.organization_id = 'b0000000-0000-4000-8000-000000000001'
    and assignment.user_id = 'a0000000-0000-4000-8000-000000000004'
    and scope.class_id = 'c0000000-0000-4000-8000-000000000001'
    and assignment.revoked_at is null
  order by assignment.starts_at desc, assignment.id
  limit 1;

  if staff_assignment_id is null then
    raise exception 'D3 smoke fixture is missing an active staff assignment';
  end if;

  perform public.complete_student_task_v2(
    'b0000000-0000-4000-8000-000000000001',
    'f2000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000006',
    'd3300000-0000-4000-8000-000000000001',
    1,
    1
  );
  perform public.complete_student_task_v2(
    'b0000000-0000-4000-8000-000000000001',
    'f2000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000006',
    'd3300000-0000-4000-8000-000000000002',
    1,
    1
  );
  perform public.reopen_student_task_for_staff(
    'f2000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000004',
    staff_assignment_id,
    'd3300000-0000-4000-8000-000000000003',
    'needs_review',
    'Se på oppgaven én gang til.'
  );

  insert into public.task_definitions (
    id,
    organization_id,
    class_id,
    title,
    subject,
    publication_status,
    created_by,
    published_at,
    points_value
  ) values
    (
      'd3100000-0000-4000-8000-000000000001',
      'b0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000001',
      'Framtidig katalogoppgave',
      'Naturfag',
      'published',
      'a0000000-0000-4000-8000-000000000004',
      transaction_timestamp(),
      10
    ),
    (
      'd3100000-0000-4000-8000-000000000002',
      'b0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000001',
      'Upublisert katalogoppgave',
      'Norsk',
      'draft',
      'a0000000-0000-4000-8000-000000000004',
      null,
      10
    );

  insert into public.task_assignments (
    id,
    organization_id,
    class_id,
    task_definition_id,
    student_id,
    assigned_by,
    visible_from
  ) values
    (
      'd3200000-0000-4000-8000-000000000001',
      'b0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000001',
      'd3100000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000006',
      'a0000000-0000-4000-8000-000000000004',
      transaction_timestamp() + interval '1 day'
    ),
    (
      'd3200000-0000-4000-8000-000000000002',
      'b0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000001',
      'd3100000-0000-4000-8000-000000000002',
      'a0000000-0000-4000-8000-000000000006',
      'a0000000-0000-4000-8000-000000000004',
      transaction_timestamp() - interval '1 day'
    ),
    (
      'd3200000-0000-4000-8000-000000000003',
      'b0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000001',
      'd3100000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000015',
      'a0000000-0000-4000-8000-000000000004',
      transaction_timestamp() - interval '1 day'
    );

  insert into public.student_task_state (
    assignment_id,
    organization_id,
    student_id
  ) values
    (
      'd3200000-0000-4000-8000-000000000001',
      'b0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000006'
    ),
    (
      'd3200000-0000-4000-8000-000000000002',
      'b0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000006'
    ),
    (
      'd3200000-0000-4000-8000-000000000003',
      'b0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000015'
    );
end;
$$;

do $$
begin
  if not has_function_privilege(
    'authenticated',
    'public.get_my_student_task_catalog_v1(uuid)',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.get_my_student_task_catalog_v1(uuid)',
    'EXECUTE'
  ) or has_function_privilege(
    'service_role',
    'public.get_my_student_task_catalog_v1(uuid)',
    'EXECUTE'
  ) then
    raise exception 'D3 catalog execute boundary is incomplete';
  end if;
end;
$$;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000006","aal":"aal1","role":"authenticated"}',
  true
);

do $$
declare
  catalog jsonb;
  completed_task jsonb;
  reopened_task jsonb;
  denial_message text;
begin
  catalog := public.get_my_student_task_catalog_v1(
    'b0000000-0000-4000-8000-000000000001'
  );

  select task
  into completed_task
  from jsonb_array_elements(catalog -> 'tasks') as task
  where task ->> 'assignment_id' = 'f2000000-0000-4000-8000-000000000001';

  select task
  into reopened_task
  from jsonb_array_elements(catalog -> 'tasks') as task
  where task ->> 'assignment_id' = 'f2000000-0000-4000-8000-000000000002';

  if catalog ->> 'reference_at' is null
    or jsonb_typeof(catalog -> 'tasks') <> 'array'
    or completed_task ->> 'status' <> 'completed'
    or (completed_task ->> 'state_version')::integer <> 2
    or reopened_task ->> 'status' <> 'reopened'
    or reopened_task ->> 'reopen_message' <> 'Se på oppgaven én gang til.'
    or not exists (
      select 1
      from jsonb_array_elements(catalog -> 'tasks') as task
      where task ->> 'title' = 'D2 current completion race'
    )
    or exists (
      select 1
      from jsonb_array_elements(catalog -> 'tasks') as task
      where task ->> 'title' = 'D2 target fixture task'
    )
    or exists (
      select 1
      from jsonb_array_elements(catalog -> 'tasks') as task
      where task ->> 'assignment_id' in (
        'd3200000-0000-4000-8000-000000000001',
        'd3200000-0000-4000-8000-000000000002',
        'd3200000-0000-4000-8000-000000000003'
      )
    )
    or exists (
      select 1
      from jsonb_array_elements(catalog -> 'tasks') as task
      where not (task ?& array[
        'assignment_id',
        'title',
        'description',
        'subject',
        'estimated_minutes',
        'support_level',
        'points_value',
        'status',
        'state_version',
        'schedule_version',
        'reopen_message',
        'visible_from',
        'due_at'
      ]::text[])
        or task - array[
        'assignment_id',
        'title',
        'description',
        'subject',
        'estimated_minutes',
        'support_level',
        'points_value',
        'status',
        'state_version',
        'schedule_version',
        'reopen_message',
        'visible_from',
        'due_at'
      ]::text[] <> '{}'::jsonb
    )
  then
    raise exception 'D3 student catalog projection is wrong: %', catalog;
  end if;

  denial_message := null;
  begin
    perform public.get_my_student_task_catalog_v1(
      'b0000000-0000-4000-8000-000000000099'
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from 'Student membership is required' then
    raise exception 'D3 wrong-organization access was not rejected: %', denial_message;
  end if;
end;
$$;

reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000004","aal":"aal2","role":"authenticated"}',
  true
);

do $$
declare
  denial_message text;
begin
  begin
    perform public.get_my_student_task_catalog_v1(
      'b0000000-0000-4000-8000-000000000001'
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from 'Student membership is required' then
    raise exception 'D3 staff access was not rejected: %', denial_message;
  end if;
end;
$$;

reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000015","aal":"aal1","role":"authenticated"}',
  true
);

do $$
declare
  catalog jsonb;
begin
  catalog := public.get_my_student_task_catalog_v1(
    'b0000000-0000-4000-8000-000000000001'
  );
  if not exists (
    select 1
    from jsonb_array_elements(catalog -> 'tasks') as task
    where task ->> 'assignment_id' = 'd3200000-0000-4000-8000-000000000003'
  ) or exists (
    select 1
    from jsonb_array_elements(catalog -> 'tasks') as task
    where task ->> 'assignment_id' = 'f2000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'D3 catalog did not bind the second student correctly: %', catalog;
  end if;
end;
$$;

reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"aal":"aal1","role":"authenticated"}',
  true
);

do $$
declare
  denial_message text;
begin
  begin
    perform public.get_my_student_task_catalog_v1(
      'b0000000-0000-4000-8000-000000000001'
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from 'Student session is required' then
    raise exception 'D3 missing session was not rejected: %', denial_message;
  end if;
end;
$$;

reset role;

delete from public.class_memberships
where class_id = 'c0000000-0000-4000-8000-000000000001'
  and organization_id = 'b0000000-0000-4000-8000-000000000001'
  and user_id = 'a0000000-0000-4000-8000-000000000006'
  and role = 'student';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000006","aal":"aal1","role":"authenticated"}',
  true
);

do $$
declare
  catalog jsonb;
begin
  catalog := public.get_my_student_task_catalog_v1(
    'b0000000-0000-4000-8000-000000000001'
  );
  if jsonb_array_length(catalog -> 'tasks') <> 0 then
    raise exception 'D3 membership removal leaked task history: %', catalog;
  end if;
end;
$$;

reset role;

do $$
begin
  if not exists (
    select 1 from public.task_assignments
    where id = 'f2000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'D3 membership removal deleted task history';
  end if;
end;
$$;

insert into public.class_memberships (
  class_id,
  organization_id,
  user_id,
  role,
  created_by
) values (
  'c0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000006',
  'student',
  'a0000000-0000-4000-8000-000000000001'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000006","aal":"aal1","role":"authenticated"}',
  true
);

do $$
declare
  catalog jsonb;
begin
  catalog := public.get_my_student_task_catalog_v1(
    'b0000000-0000-4000-8000-000000000001'
  );
  if not exists (
    select 1
    from jsonb_array_elements(catalog -> 'tasks') as task
    where task ->> 'assignment_id' = 'f2000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'D3 membership restoration did not restore the catalog';
  end if;
end;
$$;

reset role;
rollback;
