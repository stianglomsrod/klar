\set ON_ERROR_STOP on

do $$
begin
  if exists (select 1 from public.weekly_plans)
    or exists (select 1 from public.plan_revisions)
    or exists (select 1 from public.teaching_sessions)
    or exists (select 1 from public.plan_tasks)
  then
    raise exception 'C1 upgrade invented weekly-plan history for legacy data';
  end if;

  if exists (
    select 1
    from public.task_assignments
    where plan_task_id is not null
       or source_plan_revision_task_id is not null
  ) then
    raise exception 'C1 upgrade backfilled unverifiable plan provenance';
  end if;

  if not exists (select 1 from public.task_assignments) then
    raise exception 'Upgrade fixture no longer proves legacy assignment preservation';
  end if;
end;
$$;
