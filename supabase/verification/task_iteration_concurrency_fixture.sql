\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data)
values (
  'a0000000-0000-4000-8000-000000000015',
  'd2-second-student@concurrency.test',
  '{"display_name":"Andre D2-elev"}'::jsonb
);

insert into public.memberships (organization_id, user_id, role, created_by)
values (
  'b0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000015',
  'student',
  'a0000000-0000-4000-8000-000000000001'
);

insert into public.class_memberships (
  class_id,
  organization_id,
  user_id,
  role,
  created_by
)
values (
  'c0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000015',
  'student',
  'a0000000-0000-4000-8000-000000000001'
);

insert into public.task_assignments (
  organization_id,
  class_id,
  task_definition_id,
  student_id,
  assigned_by,
  visible_from,
  due_at,
  plan_task_id,
  source_plan_revision_task_id
)
select
  revision_task.organization_id,
  revision_task.class_id,
  revision_task.task_definition_id,
  'a0000000-0000-4000-8000-000000000015',
  'a0000000-0000-4000-8000-000000000004',
  revision_task.visible_from,
  revision_task.due_at,
  revision_task.plan_task_id,
  revision_task.id
from public.plan_revision_tasks as revision_task
join public.weekly_plans as plan
  on plan.id = revision_task.weekly_plan_id
where plan.organization_id = 'b0000000-0000-4000-8000-000000000001'
  and plan.class_id = 'c0000000-0000-4000-8000-000000000001'
  and plan.week_start_date = '2099-07-13'
order by revision_task.position, revision_task.id;

insert into public.student_task_state (assignment_id, organization_id, student_id)
select assignment.id, assignment.organization_id, assignment.student_id
from public.task_assignments as assignment
where assignment.student_id = 'a0000000-0000-4000-8000-000000000015'
  and assignment.plan_task_id is not null;

do $$
declare
  staff_assignment_id uuid;
  source_week date :=
    date_trunc('week', transaction_timestamp() at time zone 'Europe/Oslo')::date
      - 7;
  target_week date :=
    date_trunc('week', transaction_timestamp() at time zone 'Europe/Oslo')::date
      + 7;
  source_start timestamptz;
  target_start timestamptz;
  source_candidate jsonb;
  target_candidate jsonb;
begin
  select assignment.id
  into strict staff_assignment_id
  from public.staff_assignments as assignment
  join public.staff_assignment_class_scopes as scope
    on scope.assignment_id = assignment.id
   and scope.organization_id = assignment.organization_id
  where assignment.user_id = 'a0000000-0000-4000-8000-000000000004'
    and scope.class_id = 'c0000000-0000-4000-8000-000000000001'
    and assignment.revoked_at is null
  order by assignment.starts_at desc, assignment.id
  limit 1;

  source_start := (source_week + 1 + time '08:00') at time zone 'Europe/Oslo';
  target_start := (target_week + 1 + time '08:00') at time zone 'Europe/Oslo';
  source_candidate := jsonb_build_object(
    'schema_version', 'weekly_plan_v1',
    'sessions', jsonb_build_array(jsonb_build_object(
      'logical_key', 'd2c10000-0000-4000-8000-000000000001',
      'title', 'D2 fullføringskilde',
      'subject', 'Norsk',
      'starts_at', to_char(source_start at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'ends_at', to_char((source_start + interval '45 minutes') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'tasks', jsonb_build_array(jsonb_build_object(
        'logical_key', 'd2c20000-0000-4000-8000-000000000001',
        'title', 'D2 current completion race',
        'description', null,
        'subject', 'Norsk',
        'estimated_minutes', 10,
        'support_level', 2
      ))
    ))
  );
  target_candidate := jsonb_build_object(
    'schema_version', 'weekly_plan_v1',
    'sessions', jsonb_build_array(jsonb_build_object(
      'logical_key', 'd2c10000-0000-4000-8000-000000000002',
      'title', 'D2 framtidig måløkt',
      'subject', 'Norsk',
      'starts_at', to_char(target_start at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'ends_at', to_char((target_start + interval '45 minutes') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'tasks', jsonb_build_array(jsonb_build_object(
        'logical_key', 'd2c20000-0000-4000-8000-000000000002',
        'title', 'D2 target fixture task',
        'description', null,
        'subject', 'Norsk',
        'estimated_minutes', 10,
        'support_level', 2
      ))
    ))
  );

  perform public.publish_initial_weekly_plan(
    'c0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000004',
    staff_assignment_id,
    source_week,
    'Europe/Oslo',
    0,
    'd2c30000-0000-4000-8000-000000000001',
    repeat('1', 64),
    source_candidate
  );
  perform public.publish_initial_weekly_plan(
    'c0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000004',
    staff_assignment_id,
    target_week,
    'Europe/Oslo',
    0,
    'd2c30000-0000-4000-8000-000000000002',
    repeat('2', 64),
    target_candidate
  );
end;
$$;

do $$
begin
  if (
    select count(*)
    from public.task_assignments as assignment
    join public.student_task_state as state
      on state.assignment_id = assignment.id
    join public.plan_revision_tasks as revision_task
      on revision_task.id = assignment.source_plan_revision_task_id
    join public.weekly_plans as plan
      on plan.id = revision_task.weekly_plan_id
    where assignment.student_id = 'a0000000-0000-4000-8000-000000000015'
      and plan.week_start_date = '2099-07-13'
      and assignment.iteration_id is not null
      and assignment.scheduled_teaching_session_id is not null
      and assignment.scheduled_from_revision_session_id is not null
      and assignment.schedule_version = 1
      and state.status = 'assigned'
      and state.state_version = 1
  ) <> 3 then
    raise exception 'The isolated two-recipient D2 fixture is incomplete';
  end if;
end;
$$;
