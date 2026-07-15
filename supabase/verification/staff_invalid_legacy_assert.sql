\set ON_ERROR_STOP on

do $$
begin
  if to_regclass('public.staff_assignments') is not null
    or to_regtype('public.staff_job_label') is not null
  then
    raise exception 'Failed A1 migration left staff schema behind';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'audit_events'
      and column_name = 'authorizing_staff_assignment_id'
  ) then
    raise exception 'Failed A1 migration left audit columns behind';
  end if;
  if not exists (
    select 1 from public.memberships
    where organization_id = '92000000-0000-4000-8000-000000000001'
      and user_id = '91000000-0000-4000-8000-000000000002'
      and role = 'student'
  ) or not exists (
    select 1 from public.class_memberships
    where class_id = '93000000-0000-4000-8000-000000000001'
      and user_id = '91000000-0000-4000-8000-000000000002'
      and role = 'teacher'
  ) then
    raise exception 'Legacy fixture did not survive atomic rollback';
  end if;
  if to_regprocedure('public.publish_task_to_class(uuid,uuid,text,text,text,smallint,smallint,timestamptz,timestamptz)') is null then
    raise exception 'Legacy RPC disappeared despite migration rollback';
  end if;
end;
$$;
