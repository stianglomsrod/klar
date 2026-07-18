\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data)
values (
  'a0000000-0000-4000-8000-00000000000a',
  'help-revocation-race@concurrency.test',
  '{"display_name":"Help revocation race"}'::jsonb
);

insert into public.memberships (organization_id, user_id, role, created_by)
values (
  'b0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-00000000000a',
  'teacher',
  'a0000000-0000-4000-8000-000000000001'
);

insert into auth.users (id, email, raw_user_meta_data)
values (
  'a0000000-0000-4000-8000-00000000000c',
  'help-expiry-race@concurrency.test',
  '{"display_name":"Help expiry race"}'::jsonb
);

insert into public.memberships (organization_id, user_id, role, created_by)
values (
  'b0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-00000000000c',
  'teacher',
  'a0000000-0000-4000-8000-000000000001'
);

select public.create_staff_assignment(
  'b0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-00000000000a',
  'c0000000-0000-4000-8000-000000000001',
  'substitute',
  transaction_timestamp() - interval '1 hour',
  transaction_timestamp() + interval '1 day',
  'e1000000-0000-4000-8000-00000000000a'
);

insert into auth.users (id, email, raw_user_meta_data)
values (
  'a0000000-0000-4000-8000-000000000009',
  'help-student-two@concurrency.test',
  '{"display_name":"Elev kø to"}'::jsonb
);

insert into public.memberships (organization_id, user_id, role, created_by)
values (
  'b0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000009',
  'student',
  'a0000000-0000-4000-8000-000000000001'
);

insert into public.class_memberships (
  class_id,
  organization_id,
  user_id,
  role,
  created_by
) values (
  'c0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000009',
  'student',
  'a0000000-0000-4000-8000-000000000001'
);

do $$
#variable_conflict use_variable
declare
  actor_id uuid := 'a0000000-0000-4000-8000-000000000004';
  class_id uuid := 'c0000000-0000-4000-8000-000000000001';
  staff_assignment_id uuid;
  week_start date;
  starts_at timestamptz := transaction_timestamp() - interval '10 minutes';
  ends_at timestamptz := transaction_timestamp() + interval '2 hours';
  candidate jsonb;
  publish_result jsonb;
  revision_session_id uuid;
  queue_result jsonb;
begin
  select assignment.id
  into staff_assignment_id
  from public.staff_assignments as assignment
  join public.memberships as membership
    on membership.organization_id = assignment.organization_id
   and membership.user_id = assignment.user_id
   and membership.role in ('owner', 'teacher')
  join public.staff_assignment_class_scopes as scope
    on scope.assignment_id = assignment.id
   and scope.organization_id = assignment.organization_id
  join public.staff_assignment_capabilities as capability
    on capability.assignment_id = assignment.id
   and capability.profile_version = assignment.profile_version
   and capability.capability = 'help_queue.manage'
  where assignment.user_id = actor_id
    and scope.class_id = class_id
    and assignment.revoked_at is null
    and assignment.starts_at <= transaction_timestamp()
    and (
      assignment.ends_at is null
      or transaction_timestamp() < assignment.ends_at
    )
  order by assignment.starts_at desc, assignment.id
  limit 1;
  if staff_assignment_id is null then
    raise exception 'Concurrency fixture lacks an authorized help queue manager';
  end if;

  week_start := (transaction_timestamp() at time zone 'Europe/Oslo')::date
    - (extract(isodow from transaction_timestamp() at time zone 'Europe/Oslo')::integer - 1);
  candidate := jsonb_build_object(
    'schema_version', 'weekly_plan_v1',
    'sessions', jsonb_build_array(jsonb_build_object(
      'logical_key', 'e1100000-0000-4000-8000-000000000001',
      'title', 'Aktuell hjelpekøøkt',
      'subject', 'Norsk',
      'starts_at', starts_at,
      'ends_at', ends_at,
      'tasks', jsonb_build_array(jsonb_build_object(
        'logical_key', 'e1200000-0000-4000-8000-000000000001',
        'title', 'Kontekstoppgave',
        'description', 'Syntetisk oppgave for hjelpekøtest.',
        'subject', 'Norsk',
        'estimated_minutes', 15,
        'support_level', 2
      ), jsonb_build_object(
        'logical_key', 'e1200000-0000-4000-8000-000000000002',
        'title', 'Andre kontekstoppgave',
        'description', 'Syntetisk alternativ for kontekstintegritet.',
        'subject', 'Norsk',
        'estimated_minutes', 10,
        'support_level', 2
      ))
    ))
  );

  publish_result := public.publish_initial_weekly_plan(
    class_id,
    actor_id,
    staff_assignment_id,
    week_start,
    'Europe/Oslo',
    0,
    'e1300000-0000-4000-8000-000000000001',
    repeat('e', 64),
    candidate
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
    'e1400000-0000-4000-8000-000000000001'
  );
  if queue_result ->> 'status' <> 'open'
    or queue_result ->> 'changed' <> 'true'
  then
    raise exception 'Help queue concurrency fixture was not opened: %', queue_result;
  end if;
end;
$$;
