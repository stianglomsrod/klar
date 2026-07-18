\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data)
values
  (
    '81000000-0000-4000-8000-000000000007',
    'student-c@upgrade.test',
    '{"display_name":"Elev oppgradering C"}'::jsonb
  ),
  (
    '81000000-0000-4000-8000-000000000008',
    'student-d@upgrade.test',
    '{"display_name":"Elev oppgradering D"}'::jsonb
  );

insert into public.memberships (organization_id, user_id, role, created_by)
values
  (
    '82000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000007',
    'student',
    '81000000-0000-4000-8000-000000000001'
  ),
  (
    '82000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000008',
    'student',
    '81000000-0000-4000-8000-000000000001'
  );

insert into public.class_memberships (
  class_id,
  organization_id,
  user_id,
  role,
  created_by
)
values
  (
    '83000000-0000-4000-8000-000000000002',
    '82000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000007',
    'student',
    '81000000-0000-4000-8000-000000000003'
  ),
  (
    '83000000-0000-4000-8000-000000000002',
    '82000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000008',
    'student',
    '81000000-0000-4000-8000-000000000003'
  );

do $$
#variable_conflict use_variable
declare
  organization_id uuid := '82000000-0000-4000-8000-000000000001';
  class_id uuid := '83000000-0000-4000-8000-000000000002';
  actor_id uuid := '81000000-0000-4000-8000-000000000003';
  first_student_id uuid := '81000000-0000-4000-8000-000000000004';
  second_student_id uuid := '81000000-0000-4000-8000-000000000007';
  historical_student_id uuid := '81000000-0000-4000-8000-000000000008';
  staff_assignment_id uuid;
  second_staff_assignment_id uuid;
  week_start date;
  session_starts_at timestamptz;
  session_ends_at timestamptz;
  base_time timestamptz := transaction_timestamp();
  publish_result jsonb;
  revision_session_id uuid;
  queue_result jsonb;
  first_request jsonb;
  second_request jsonb;
  historical_request jsonb;
begin
  select assignment.id
  into staff_assignment_id
  from public.staff_assignments as assignment
  join public.staff_assignment_class_scopes as scope
    on scope.assignment_id = assignment.id
   and scope.organization_id = assignment.organization_id
  join public.staff_assignment_capabilities as capability
    on capability.assignment_id = assignment.id
   and capability.profile_version = assignment.profile_version
   and capability.capability = 'help_queue.manage'
  where assignment.organization_id = organization_id
    and assignment.user_id = actor_id
    and scope.class_id = class_id
    and assignment.revoked_at is null
    and assignment.starts_at <= transaction_timestamp()
    and (assignment.ends_at is null or transaction_timestamp() < assignment.ends_at)
  order by assignment.starts_at desc, assignment.id
  limit 1;
  if staff_assignment_id is null then
    raise exception 'E2 upgrade fixture lacks a current help queue assignment';
  end if;
  second_staff_assignment_id := public.create_staff_assignment(
    organization_id,
    '81000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000001',
    class_id,
    'contact_teacher',
    transaction_timestamp() - interval '2 hours',
    transaction_timestamp() + interval '1 day',
    'e2800000-0000-4000-8000-000000000002'
  );

  week_start := (transaction_timestamp() at time zone 'Europe/Oslo')::date
    - (extract(isodow from transaction_timestamp() at time zone 'Europe/Oslo')::integer - 1);
  session_starts_at := (
    (transaction_timestamp() at time zone 'Europe/Oslo')::date::timestamp
      at time zone 'Europe/Oslo'
  );
  session_ends_at := (
    ((transaction_timestamp() at time zone 'Europe/Oslo')::date + 1)::timestamp
      at time zone 'Europe/Oslo'
  ) - interval '1 second';
  publish_result := public.publish_initial_weekly_plan(
    class_id,
    actor_id,
    staff_assignment_id,
    week_start,
    'Europe/Oslo',
    0,
    'e2800000-0000-4000-8000-000000000001',
    repeat('8', 64),
    jsonb_build_object(
      'schema_version', 'weekly_plan_v1',
      'sessions', jsonb_build_array(jsonb_build_object(
        'logical_key', 'e2810000-0000-4000-8000-000000000001',
        'title', 'E1-kø for E2-oppgradering',
        'subject', 'Norsk',
        'starts_at', session_starts_at,
        'ends_at', session_ends_at,
        'tasks', '[]'::jsonb
      ))
    )
  );

  select session.id
  into revision_session_id
  from public.plan_revision_sessions as session
  where session.revision_id = (publish_result ->> 'revision_id')::uuid;

  queue_result := public.open_help_queue_session(
    class_id,
    revision_session_id,
    actor_id,
    staff_assignment_id,
    'e2820000-0000-4000-8000-000000000001'
  );
  first_request := public.request_student_help_v2(
    (queue_result ->> 'queue_session_id')::uuid,
    first_student_id,
    'e2830000-0000-4000-8000-000000000001',
    null
  );
  second_request := public.request_student_help_v2(
    (queue_result ->> 'queue_session_id')::uuid,
    second_student_id,
    'e2830000-0000-4000-8000-000000000002',
    null
  );
  historical_request := public.request_student_help_v2(
    (queue_result ->> 'queue_session_id')::uuid,
    historical_student_id,
    'e2830000-0000-4000-8000-000000000003',
    null
  );

  perform public.claim_student_help_v2(
    (second_request ->> 'request_id')::uuid,
    '81000000-0000-4000-8000-000000000001',
    second_staff_assignment_id,
    'e2840000-0000-4000-8000-000000000001'
  );
  perform public.cancel_student_help_v2(
    (historical_request ->> 'request_id')::uuid,
    historical_student_id,
    'e2840000-0000-4000-8000-000000000002'
  );

  update public.help_requests
  set requested_at = case id
    when (first_request ->> 'request_id')::uuid then base_time - interval '3 minutes'
    when (second_request ->> 'request_id')::uuid then base_time - interval '2 minutes'
    else base_time - interval '1 minute'
  end
  where id in (
    (first_request ->> 'request_id')::uuid,
    (second_request ->> 'request_id')::uuid,
    (historical_request ->> 'request_id')::uuid
  );
  update public.help_requests
  set claimed_at = requested_at + interval '30 seconds'
  where id = (second_request ->> 'request_id')::uuid;
end;
$$;
