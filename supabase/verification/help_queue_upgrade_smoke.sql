\set ON_ERROR_STOP on

begin;

do $$
#variable_conflict use_variable
declare
  organization_id uuid := '82000000-0000-4000-8000-000000000001';
  class_id uuid := '83000000-0000-4000-8000-000000000002';
  actor_id uuid := '81000000-0000-4000-8000-000000000003';
  student_id uuid := '81000000-0000-4000-8000-000000000004';
  legacy_request_id uuid := '86000000-0000-4000-8000-000000000001';
  staff_assignment_id uuid;
  week_start date;
  publish_result jsonb;
  revision_session_id uuid;
  queue_result jsonb;
  request_result jsonb;
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'help_queue_signals'
  ) or exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename in ('help_requests', 'help_queue_sessions')
  ) then
    raise exception 'Upgrade left the wrong E1 Realtime publication';
  end if;

  if not exists (
    select 1
    from public.help_requests as request
    where request.id = legacy_request_id
      and request.status = 'expired'
      and request.queue_session_id is null
  ) or not exists (
    select 1
    from public.audit_events as event
    where event.event_name = 'help.expired'
      and event.entity_id = legacy_request_id
      and event.actor_id is null
      and event.metadata ->> 'reason' = 'session_queue_migration'
  ) then
    raise exception 'E1 did not terminalize and audit the active legacy request';
  end if;

  if to_regclass('public.help_requests_one_active_per_student') is not null then
    raise exception 'The obsolete organization-wide active request index remains';
  end if;

  select assignment.id
  into staff_assignment_id
  from public.staff_assignments as assignment
  join public.staff_assignment_class_scopes as scope
    on scope.assignment_id = assignment.id
  join public.staff_assignment_capabilities as capability
    on capability.assignment_id = assignment.id
   and capability.capability = 'help_queue.manage'
  where assignment.organization_id = organization_id
    and assignment.user_id = actor_id
    and scope.class_id = class_id
    and assignment.revoked_at is null
    and assignment.starts_at <= transaction_timestamp()
    and (assignment.ends_at is null or transaction_timestamp() < assignment.ends_at)
  limit 1;
  if staff_assignment_id is null then
    raise exception 'Upgrade fixture lacks a current help queue assignment';
  end if;

  week_start := (transaction_timestamp() at time zone 'Europe/Oslo')::date
    - (extract(isodow from transaction_timestamp() at time zone 'Europe/Oslo')::integer - 1);
  publish_result := public.publish_initial_weekly_plan(
    class_id,
    actor_id,
    staff_assignment_id,
    week_start,
    'Europe/Oslo',
    0,
    'e2100000-0000-4000-8000-000000000001',
    repeat('f', 64),
    jsonb_build_object(
      'schema_version', 'weekly_plan_v1',
      'sessions', jsonb_build_array(jsonb_build_object(
        'logical_key', 'e2200000-0000-4000-8000-000000000001',
        'title', 'Oppgradert hjelpekøøkt',
        'subject', 'Norsk',
        'starts_at', transaction_timestamp() - interval '5 minutes',
        'ends_at', transaction_timestamp() + interval '1 hour',
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
    'e2300000-0000-4000-8000-000000000001'
  );
  request_result := public.request_student_help_v2(
    (queue_result ->> 'queue_session_id')::uuid,
    student_id,
    'e2400000-0000-4000-8000-000000000001',
    null
  );

  if request_result ->> 'status' <> 'waiting'
    or request_result ->> 'request_id' = legacy_request_id::text
    or (
      select count(*)
      from public.help_requests as request
      where request.student_id = student_id
        and request.status in ('waiting', 'claimed')
        and request.queue_session_id = (queue_result ->> 'queue_session_id')::uuid
    ) <> 1
  then
    raise exception 'Student could not use E1 after the representative upgrade';
  end if;
end;
$$;

rollback;
