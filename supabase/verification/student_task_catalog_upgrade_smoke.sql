\set ON_ERROR_STOP on

begin;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000004","aal":"aal1","role":"authenticated"}',
  true
);

do $$
declare
  catalog jsonb;
  legacy_task jsonb;
begin
  catalog := public.get_my_student_task_catalog_v1(
    '82000000-0000-4000-8000-000000000001'
  );
  select task
  into legacy_task
  from jsonb_array_elements(catalog -> 'tasks') as task
  where task ->> 'assignment_id' = '85000000-0000-4000-8000-000000000001';

  if legacy_task ->> 'title' <> 'Uendret legacyoppgave'
    or legacy_task ->> 'status' <> 'completed'
  then
    raise exception 'D3 upgraded catalog lost the legacy assignment: %', catalog;
  end if;
end;
$$;

reset role;

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
    raise exception 'D3 upgraded catalog execute boundary is incomplete';
  end if;
end;
$$;

rollback;
