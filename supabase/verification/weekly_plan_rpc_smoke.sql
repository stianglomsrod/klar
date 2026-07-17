\set ON_ERROR_STOP on

do $$
declare
  staff_assignment_id uuid;
  revoked_assignment_id uuid;
  candidate jsonb := '{
    "schema_version":"weekly_plan_v1",
    "sessions":[
      {
        "logical_key":"c1000000-0000-4000-8000-000000000001",
        "title":"Norskøkt",
        "subject":"Norsk",
        "starts_at":"2099-07-16T08:00:00.000Z",
        "ends_at":"2099-07-16T09:00:00.000Z",
        "tasks":[
          {
            "logical_key":"c2000000-0000-4000-8000-000000000001",
            "title":"Les side 12",
            "description":"Arbeid i leseboka.",
            "subject":"Norsk",
            "estimated_minutes":20,
            "support_level":2
          }
        ]
      },
      {
        "logical_key":"c1000000-0000-4000-8000-000000000002",
        "title":"Matematikkøkt",
        "subject":"Matematikk",
        "starts_at":"2099-07-16T09:15:00.000Z",
        "ends_at":"2099-07-16T10:00:00.000Z",
        "tasks":[
          {
            "logical_key":"c2000000-0000-4000-8000-000000000002",
            "title":"Regn oppgave 3",
            "description":null,
            "subject":"Matematikk",
            "estimated_minutes":null,
            "support_level":2
          }
        ]
      },
      {
        "logical_key":"c1000000-0000-4000-8000-000000000003",
        "title":"Fredagsøkt",
        "subject":"Naturfag",
        "starts_at":"2099-07-17T08:00:00.000Z",
        "ends_at":"2099-07-17T09:00:00.000Z",
        "tasks":[
          {
            "logical_key":"c2000000-0000-4000-8000-000000000003",
            "title":"Framtidsoppgave",
            "description":"Skal ikke være synlig dagen før.",
            "subject":"Naturfag",
            "estimated_minutes":15,
            "support_level":2
          }
        ]
      },
      {
        "logical_key":"c1000000-0000-4000-8000-000000000004",
        "title":"Oppsummering uten oppgave",
        "subject":null,
        "starts_at":"2099-07-18T08:00:00.000Z",
        "ends_at":"2099-07-18T08:30:00.000Z",
        "tasks":[]
      }
    ]
  }'::jsonb;
  first_result jsonb;
  retry_result jsonb;
  semantic_retry jsonb;
  projection jsonb;
  denial_message text;
  linked_task_id uuid;
  graph_before jsonb;
  graph_after jsonb;
begin
  select assignment.id
  into staff_assignment_id
  from public.staff_assignments as assignment
  join public.staff_assignment_class_scopes as scope
    on scope.assignment_id = assignment.id
  where assignment.user_id = 'a0000000-0000-4000-8000-000000000004'
    and scope.class_id = 'c0000000-0000-4000-8000-000000000001'
    and assignment.revoked_at is null;

  select assignment.id
  into revoked_assignment_id
  from public.staff_assignments as assignment
  where assignment.user_id = 'a0000000-0000-4000-8000-000000000008'
    and assignment.revoked_at is not null;

  select jsonb_build_object(
    'weekly_plans', (select count(*) from public.weekly_plans),
    'plan_revisions', (select count(*) from public.plan_revisions),
    'teaching_sessions', (select count(*) from public.teaching_sessions),
    'plan_tasks', (select count(*) from public.plan_tasks),
    'plan_revision_sessions', (select count(*) from public.plan_revision_sessions),
    'plan_revision_tasks', (select count(*) from public.plan_revision_tasks),
    'task_definitions', (select count(*) from public.task_definitions),
    'task_assignments', (select count(*) from public.task_assignments),
    'student_task_state', (select count(*) from public.student_task_state),
    'publish_receipts', (select count(*) from public.weekly_plan_publish_receipts),
    'audit_events', (select count(*) from public.audit_events)
  ) into graph_before;

  denial_message := null;
  begin
    perform public.publish_initial_weekly_plan(
      'c0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000002',
      staff_assignment_id,
      '2099-07-13',
      'Europe/Oslo',
      0,
      'c3000000-0000-4000-8000-000000000010',
      repeat('a', 64),
      candidate
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from
    'Staff assignment does not authorize weekly plan publishing'
  then
    raise exception 'A stolen staff assignment was not rejected: %', denial_message;
  end if;

  denial_message := null;
  begin
    perform public.publish_initial_weekly_plan(
      'c0000000-0000-4000-8000-000000000002',
      'a0000000-0000-4000-8000-000000000004',
      staff_assignment_id,
      '2099-07-13',
      'Europe/Oslo',
      0,
      'c3000000-0000-4000-8000-000000000011',
      repeat('a', 64),
      candidate
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from
    'Staff assignment does not authorize weekly plan publishing'
  then
    raise exception 'An out-of-scope class was not rejected: %', denial_message;
  end if;

  denial_message := null;
  begin
    perform public.publish_initial_weekly_plan(
      'c0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000008',
      revoked_assignment_id,
      '2099-07-13',
      'Europe/Oslo',
      0,
      'c3000000-0000-4000-8000-000000000012',
      repeat('a', 64),
      candidate
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from
    'Staff assignment does not authorize weekly plan publishing'
  then
    raise exception 'A revoked staff assignment was not rejected: %', denial_message;
  end if;

  select jsonb_build_object(
    'weekly_plans', (select count(*) from public.weekly_plans),
    'plan_revisions', (select count(*) from public.plan_revisions),
    'teaching_sessions', (select count(*) from public.teaching_sessions),
    'plan_tasks', (select count(*) from public.plan_tasks),
    'plan_revision_sessions', (select count(*) from public.plan_revision_sessions),
    'plan_revision_tasks', (select count(*) from public.plan_revision_tasks),
    'task_definitions', (select count(*) from public.task_definitions),
    'task_assignments', (select count(*) from public.task_assignments),
    'student_task_state', (select count(*) from public.student_task_state),
    'publish_receipts', (select count(*) from public.weekly_plan_publish_receipts),
    'audit_events', (select count(*) from public.audit_events)
  ) into graph_after;
  if graph_after is distinct from graph_before then
    raise exception 'Rejected weekly plan authorization left a partial graph. Before %, after %',
      graph_before,
      graph_after;
  end if;

  first_result := public.publish_initial_weekly_plan(
    'c0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000004',
    staff_assignment_id,
    '2099-07-13',
    'Europe/Oslo',
    0,
    'c3000000-0000-4000-8000-000000000001',
    repeat('a', 64),
    candidate
  );
  if first_result ->> 'already_published' <> 'false'
    or (first_result ->> 'session_count')::integer <> 4
    or (first_result ->> 'task_count')::integer <> 3
  then
    raise exception 'Initial weekly plan result is wrong: %', first_result;
  end if;

  retry_result := public.publish_initial_weekly_plan(
    'c0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000004',
    staff_assignment_id,
    '2099-07-13',
    'Europe/Oslo',
    0,
    'c3000000-0000-4000-8000-000000000001',
    repeat('a', 64),
    candidate
  );
  if retry_result <> first_result then
    raise exception 'Weekly plan request retry returned a different result';
  end if;

  semantic_retry := public.publish_initial_weekly_plan(
    'c0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000004',
    staff_assignment_id,
    '2099-07-13',
    'Europe/Oslo',
    0,
    'c3000000-0000-4000-8000-000000000002',
    repeat('a', 64),
    candidate
  );
  if semantic_retry ->> 'already_published' <> 'true'
    or semantic_retry ->> 'revision_id' <> first_result ->> 'revision_id'
  then
    raise exception 'Semantic retry duplicated the weekly plan: %', semantic_retry;
  end if;

  if (select count(*) from public.weekly_plans) <> 1
    or (select count(*) from public.plan_revisions) <> 1
    or (select count(*) from public.plan_revision_sessions) <> 4
    or (select count(*) from public.plan_revision_tasks) <> 3
    or (select count(*) from public.task_assignments where plan_task_id is not null) <> 3
    or (select count(*) from public.student_task_state where assignment_id in (
      select id from public.task_assignments where plan_task_id is not null
    )) <> 3
    or (select count(*) from public.weekly_plan_publish_receipts) <> 2
    or (select count(*) from public.audit_events where event_name = 'weekly_plan.published') <> 1
  then
    raise exception 'Initial weekly plan did not create one atomic graph: plans %, revisions %, sessions %, tasks %, assignments %, states %, receipts %, audits %',
      (select count(*) from public.weekly_plans),
      (select count(*) from public.plan_revisions),
      (select count(*) from public.plan_revision_sessions),
      (select count(*) from public.plan_revision_tasks),
      (select count(*) from public.task_assignments where plan_task_id is not null),
      (select count(*) from public.student_task_state where assignment_id in (
        select id from public.task_assignments where plan_task_id is not null
      )),
      (select count(*) from public.weekly_plan_publish_receipts),
      (select count(*) from public.audit_events where event_name = 'weekly_plan.published');
  end if;

  if exists (
    select 1
    from public.plan_revision_tasks as revision_task
    join public.plan_revision_sessions as revision_session
      on revision_session.id = revision_task.revision_session_id
    join public.weekly_plans as plan
      on plan.id = revision_task.weekly_plan_id
    where revision_task.visible_from is distinct from (
      (revision_session.starts_at at time zone plan.timezone_name)::date::timestamp
      at time zone plan.timezone_name
    )
  ) or exists (
    select 1
    from public.task_assignments as assignment
    join public.plan_revision_tasks as revision_task
      on revision_task.id = assignment.source_plan_revision_task_id
    where assignment.visible_from is distinct from revision_task.visible_from
  ) then
    raise exception 'A plan task became visible before local midnight on its session day';
  end if;

  denial_message := null;
  begin
    perform public.publish_initial_weekly_plan(
      'c0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000004',
      staff_assignment_id,
      '2099-07-13',
      'Europe/Oslo',
      0,
      'c3000000-0000-4000-8000-000000000001',
      repeat('b', 64),
      jsonb_set(candidate, '{sessions,0,title}', '"Endret"')
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message not like 'Weekly plan request id was already used%' then
    raise exception 'Conflicting request retry was not rejected: %', denial_message;
  end if;

  projection := public.get_student_day_projection_at(
    'b0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000006',
    '2099-07-16T08:00:00Z'
  );
  if jsonb_array_length(projection -> 'sessions') <> 2
    or projection #>> '{sessions,0,relation}' <> 'current'
    or projection #>> '{sessions,0,title}' <> 'Norskøkt'
    or projection #>> '{sessions,1,relation}' <> 'next'
  then
    raise exception 'Exact session start projection is wrong: %', projection;
  end if;

  projection := public.get_student_day_projection_at(
    'b0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000006',
    '2099-07-16T08:30:00Z'
  );
  if jsonb_array_length(projection -> 'sessions') <> 2
    or projection #>> '{sessions,0,relation}' <> 'current'
    or projection #>> '{sessions,1,relation}' <> 'next'
    or projection #>> '{sessions,0,tasks,0,title}' <> 'Les side 12'
  then
    raise exception 'Current/next day projection is wrong: %', projection;
  end if;

  projection := public.get_student_day_projection_at(
    'b0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000006',
    '2099-07-16T09:00:00Z'
  );
  if jsonb_array_length(projection -> 'sessions') <> 2
    or projection #>> '{sessions,0,relation}' <> 'previous'
    or projection #>> '{sessions,1,relation}' <> 'next'
  then
    raise exception 'Exact session end projection is wrong: %', projection;
  end if;

  projection := public.get_student_day_projection_at(
    'b0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000006',
    '2099-07-16T09:30:00Z'
  );
  if jsonb_array_length(projection -> 'sessions') <> 2
    or projection #>> '{sessions,0,relation}' <> 'previous'
    or projection #>> '{sessions,1,relation}' <> 'current'
  then
    raise exception 'Previous/current day projection is wrong: %', projection;
  end if;

  projection := public.get_student_day_projection_at(
    'b0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000006',
    '2099-07-16T11:00:00Z'
  );
  if jsonb_array_length(projection -> 'sessions') <> 1
    or projection #>> '{sessions,0,relation}' <> 'previous'
    or projection #>> '{sessions,0,title}' <> 'Matematikkøkt'
  then
    raise exception 'After-last-session projection is wrong: %', projection;
  end if;

  projection := public.get_student_day_projection_at(
    'b0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000006',
    '2099-07-18T08:15:00Z'
  );
  if jsonb_array_length(projection -> 'sessions') <> 1
    or projection #>> '{sessions,0,relation}' <> 'current'
    or projection #>> '{sessions,0,title}' <> 'Oppsummering uten oppgave'
    or jsonb_array_length(projection #> '{sessions,0,tasks}') <> 0
  then
    raise exception 'Taskless session projection is wrong: %', projection;
  end if;

  select revision_task.task_definition_id
  into linked_task_id
  from public.plan_revision_tasks as revision_task
  order by revision_task.position
  limit 1;
  denial_message := null;
  begin
    update public.task_definitions
    set title = 'Skal ikke kunne endres'
    where id = linked_task_id;
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from
    'A task version linked to a published plan is immutable'
  then
    raise exception 'Linked task version was not immutable: %', denial_message;
  end if;

  if has_table_privilege('authenticated', 'public.weekly_plans', 'SELECT')
    or has_table_privilege('authenticated', 'public.plan_revisions', 'SELECT')
    or has_table_privilege('service_role', 'public.weekly_plans', 'INSERT')
    or has_function_privilege(
      'authenticated',
      'public.publish_initial_weekly_plan(uuid,uuid,uuid,date,text,integer,uuid,text,jsonb)',
      'EXECUTE'
    )
    or has_function_privilege(
      'authenticated',
      'public.get_student_day_projection_at(uuid,uuid,timestamptz)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'authenticated',
      'public.get_my_student_day_v1(uuid)',
      'EXECUTE'
    )
  then
    raise exception 'Weekly plan privilege boundary is incomplete: auth plan select %, auth revision select %, service insert %, auth publish %, auth internal %, auth wrapper %',
      has_table_privilege('authenticated', 'public.weekly_plans', 'SELECT'),
      has_table_privilege('authenticated', 'public.plan_revisions', 'SELECT'),
      has_table_privilege('service_role', 'public.weekly_plans', 'INSERT'),
      has_function_privilege('authenticated', 'public.publish_initial_weekly_plan(uuid,uuid,uuid,date,text,integer,uuid,text,jsonb)', 'EXECUTE'),
      has_function_privilege('authenticated', 'public.get_student_day_projection_at(uuid,uuid,timestamptz)', 'EXECUTE'),
      has_function_privilege('authenticated', 'public.get_my_student_day_v1(uuid)', 'EXECUTE');
  end if;
end;
$$;

create function public.c1_force_weekly_plan_audit_failure()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.event_name = 'weekly_plan.published'
    and new.metadata ->> 'week_start_date' = '2099-08-10'
  then
    raise exception 'Forced weekly plan audit failure';
  end if;
  return new;
end;
$$;

create trigger c1_force_weekly_plan_audit_failure
before insert on public.audit_events
for each row execute function public.c1_force_weekly_plan_audit_failure();

do $$
declare
  staff_assignment_id uuid;
  denial_message text;
  graph_before jsonb;
  graph_after jsonb;
  rollback_candidate jsonb := '{
    "schema_version":"weekly_plan_v1",
    "sessions":[{
      "logical_key":"f1000000-0000-4000-8000-000000000001",
      "title":"Atomisk kontrolløkt",
      "subject":"Norsk",
      "starts_at":"2099-08-11T08:00:00.000Z",
      "ends_at":"2099-08-11T09:00:00.000Z",
      "tasks":[{
        "logical_key":"f2000000-0000-4000-8000-000000000001",
        "title":"Atomisk kontrolloppgave",
        "description":"Skal forsvinne når auditinnsettingen feiler.",
        "subject":"Norsk",
        "estimated_minutes":10,
        "support_level":2
      }]
    }]
  }'::jsonb;
begin
  select assignment.id
  into staff_assignment_id
  from public.staff_assignments as assignment
  join public.staff_assignment_class_scopes as scope
    on scope.assignment_id = assignment.id
  where assignment.user_id = 'a0000000-0000-4000-8000-000000000004'
    and scope.class_id = 'c0000000-0000-4000-8000-000000000001'
    and assignment.revoked_at is null;

  select jsonb_build_object(
    'weekly_plans', (select count(*) from public.weekly_plans),
    'plan_revisions', (select count(*) from public.plan_revisions),
    'teaching_sessions', (select count(*) from public.teaching_sessions),
    'plan_tasks', (select count(*) from public.plan_tasks),
    'plan_revision_sessions', (select count(*) from public.plan_revision_sessions),
    'plan_revision_tasks', (select count(*) from public.plan_revision_tasks),
    'task_definitions', (select count(*) from public.task_definitions),
    'task_assignments', (select count(*) from public.task_assignments),
    'student_task_state', (select count(*) from public.student_task_state),
    'publish_receipts', (select count(*) from public.weekly_plan_publish_receipts),
    'audit_events', (select count(*) from public.audit_events)
  ) into graph_before;

  denial_message := null;
  begin
    perform public.publish_initial_weekly_plan(
      'c0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000004',
      staff_assignment_id,
      '2099-08-10',
      'Europe/Oslo',
      0,
      'f3000000-0000-4000-8000-000000000001',
      repeat('f', 64),
      rollback_candidate
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from 'Forced weekly plan audit failure' then
    raise exception 'Late weekly plan audit failure was not reached: %', denial_message;
  end if;

  select jsonb_build_object(
    'weekly_plans', (select count(*) from public.weekly_plans),
    'plan_revisions', (select count(*) from public.plan_revisions),
    'teaching_sessions', (select count(*) from public.teaching_sessions),
    'plan_tasks', (select count(*) from public.plan_tasks),
    'plan_revision_sessions', (select count(*) from public.plan_revision_sessions),
    'plan_revision_tasks', (select count(*) from public.plan_revision_tasks),
    'task_definitions', (select count(*) from public.task_definitions),
    'task_assignments', (select count(*) from public.task_assignments),
    'student_task_state', (select count(*) from public.student_task_state),
    'publish_receipts', (select count(*) from public.weekly_plan_publish_receipts),
    'audit_events', (select count(*) from public.audit_events)
  ) into graph_after;

  if graph_after is distinct from graph_before then
    raise exception 'Late weekly plan audit failure left a partial graph. Before %, after %',
      graph_before,
      graph_after;
  end if;
end;
$$;

drop trigger c1_force_weekly_plan_audit_failure on public.audit_events;
drop function public.c1_force_weekly_plan_audit_failure();

do $$
declare
  staff_assignment_id uuid;
  retry_result jsonb;
  rollback_candidate jsonb := '{
    "schema_version":"weekly_plan_v1",
    "sessions":[{
      "logical_key":"f1000000-0000-4000-8000-000000000001",
      "title":"Atomisk kontrolløkt",
      "subject":"Norsk",
      "starts_at":"2099-08-11T08:00:00.000Z",
      "ends_at":"2099-08-11T09:00:00.000Z",
      "tasks":[{
        "logical_key":"f2000000-0000-4000-8000-000000000001",
        "title":"Atomisk kontrolloppgave",
        "description":"Skal forsvinne når auditinnsettingen feiler.",
        "subject":"Norsk",
        "estimated_minutes":10,
        "support_level":2
      }]
    }]
  }'::jsonb;
begin
  select assignment.id
  into staff_assignment_id
  from public.staff_assignments as assignment
  join public.staff_assignment_class_scopes as scope
    on scope.assignment_id = assignment.id
  where assignment.user_id = 'a0000000-0000-4000-8000-000000000004'
    and scope.class_id = 'c0000000-0000-4000-8000-000000000001'
    and assignment.revoked_at is null;

  retry_result := public.publish_initial_weekly_plan(
    'c0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000004',
    staff_assignment_id,
    '2099-08-10',
    'Europe/Oslo',
    0,
    'f3000000-0000-4000-8000-000000000001',
    repeat('f', 64),
    rollback_candidate
  );

  if retry_result ->> 'already_published' <> 'false'
    or (select count(*) from public.weekly_plans where week_start_date = '2099-08-10') <> 1
    or (select count(*) from public.plan_revision_sessions as session join public.weekly_plans as plan on plan.id = session.weekly_plan_id where plan.week_start_date = '2099-08-10') <> 1
    or (select count(*) from public.plan_revision_tasks as task join public.weekly_plans as plan on plan.id = task.weekly_plan_id where plan.week_start_date = '2099-08-10') <> 1
    or (select count(*) from public.weekly_plan_publish_receipts where request_id = 'f3000000-0000-4000-8000-000000000001') <> 1
    or (select count(*) from public.audit_events where event_name = 'weekly_plan.published' and metadata ->> 'week_start_date' = '2099-08-10') <> 1
  then
    raise exception 'Retry after atomic audit rollback did not publish exactly one graph: %', retry_result;
  end if;
end;
$$;

begin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000006","aal":"aal1","role":"authenticated"}',
  true
);

do $$
declare
  projection jsonb;
  denial_message text;
begin
  projection := public.get_my_student_day_v1(
    'b0000000-0000-4000-8000-000000000001'
  );
  if projection ->> 'timezone' <> 'Europe/Oslo' then
    raise exception 'Caller-bound student projection failed';
  end if;

  denial_message := null;
  begin
    perform public.get_my_student_day_v1(
      'b0000000-0000-4000-8000-000000000002'
    );
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from 'Student membership is required' then
    raise exception 'Student projection crossed organization boundary: %', denial_message;
  end if;

  if exists (
    select 1
    from public.task_definitions
    where title = 'Framtidsoppgave'
  ) or exists (
    select 1
    from public.task_assignments
    where plan_task_id is not null
  ) then
    raise exception 'Student read a future-day plan task before its local day';
  end if;

  denial_message := null;
  begin
    perform count(*) from public.weekly_plans;
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is null then
    raise exception 'Student read weekly plan tables directly';
  end if;
end;
$$;
rollback;
