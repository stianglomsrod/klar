\set ON_ERROR_STOP on

do $$
declare
  actual_assignments text[];
  expected_assignments text[];
  owner_assignment_id uuid := overlay(overlay(md5(
    'a1-assignment:83000000-0000-4000-8000-000000000001:81000000-0000-4000-8000-000000000001'
  ) placing '5' from 13 for 1) placing '8' from 17 for 1)::uuid;
  teacher_assignment_id uuid := overlay(overlay(md5(
    'a1-assignment:83000000-0000-4000-8000-000000000002:81000000-0000-4000-8000-000000000003'
  ) placing '5' from 13 for 1) placing '8' from 17 for 1)::uuid;
  signature text;
begin
  select array_agg(
    assignment.user_id::text || '|' || scope.class_id::text || '|' || assignment.job_label::text
    order by assignment.user_id, scope.class_id
  ) into actual_assignments
  from public.staff_assignments as assignment
  join public.staff_assignment_class_scopes as scope
    on scope.assignment_id = assignment.id;

  expected_assignments := array[
    '81000000-0000-4000-8000-000000000001|83000000-0000-4000-8000-000000000001|operational_owner',
    '81000000-0000-4000-8000-000000000003|83000000-0000-4000-8000-000000000002|legacy_teacher'
  ];
  if actual_assignments is distinct from expected_assignments then
    raise exception 'Unexpected exact backfill set: %', actual_assignments;
  end if;

  if exists (
    select 1 from public.staff_assignments
    where user_id in (
      '81000000-0000-4000-8000-000000000002',
      '81000000-0000-4000-8000-000000000004',
      '81000000-0000-4000-8000-000000000006'
    )
  ) then
    raise exception 'Backfill created implicit owner/student assignment';
  end if;

  if not exists (
    select 1 from public.staff_assignments
    where id = owner_assignment_id
      and source = 'legacy_backfill'
      and starts_at = '2026-01-01T08:00:00Z'
      and ends_at is null
      and created_by is null
      and idempotency_key = overlay(overlay(md5(
        'a1-idempotency:83000000-0000-4000-8000-000000000001:81000000-0000-4000-8000-000000000001'
      ) placing '5' from 13 for 1) placing '8' from 17 for 1)::uuid
  ) then
    raise exception 'Owner backfill fields are not deterministic';
  end if;

  if not exists (
    select 1 from public.staff_assignments
    where id = teacher_assignment_id
      and source = 'legacy_backfill'
      and starts_at = '2026-02-01T08:00:00Z'
      and ends_at is null
      and created_by is null
  ) then
    raise exception 'Teacher backfill fields are not deterministic';
  end if;

  if (select count(*) from public.staff_assignment_class_scopes) <> 2
    or (select count(*) from public.staff_assignment_capabilities) <> 12
  then
    raise exception 'Backfill scope/profile cardinality failed';
  end if;
  if exists (
    select 1
    from public.staff_assignments
    where profile_sealed_at is null
  ) then
    raise exception 'Backfilled assignment profile remained unsealed';
  end if;
  if (
    select count(*)
    from pg_trigger
    where tgrelid in (
      'public.staff_assignments'::regclass,
      'public.staff_assignment_class_scopes'::regclass,
      'public.staff_assignment_capabilities'::regclass
    )
      and tgname = any(array[
        'staff_assignments_guard_profile_seal',
        'staff_assignment_scopes_guard_insert',
        'staff_assignment_capabilities_guard_insert',
        'zz_staff_assignment_scopes_try_seal',
        'zz_staff_assignment_capabilities_try_seal',
        'staff_assignment_requires_sealed_profile'
      ])
      and tgenabled = 'O'
  ) <> 6 then
    raise exception 'Assignment profile seal triggers were not restored after upgrade';
  end if;
  if exists (
    select 1 from public.staff_assignments
    where id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ) then
    raise exception 'Backfill produced a non-RFC UUID';
  end if;
  if (select count(*) from public.audit_events where event_name = 'staff_assignment.backfilled') <> 2 then
    raise exception 'Backfill audit cardinality failed';
  end if;
  if exists (
    select 1 from public.audit_events
    where event_name = 'staff_assignment.backfilled'
      and (actor_id is not null or metadata ->> 'class_id' is null)
  ) then
    raise exception 'Backfill audit shape failed';
  end if;

  if not exists (
    select 1 from public.task_definitions
    where id = '84000000-0000-4000-8000-000000000001'
      and title = 'Uendret legacyoppgave'
      and created_by = '81000000-0000-4000-8000-000000000003'
  ) then
    raise exception 'Legacy task changed during upgrade';
  end if;
  if not exists (
    select 1 from public.student_task_state
    where assignment_id = '85000000-0000-4000-8000-000000000001'
      and status = 'completed'
      and completed_at = '2026-02-04T08:00:00Z'
  ) then
    raise exception 'Legacy student state changed during upgrade';
  end if;
  if not exists (
    select 1 from public.help_requests
    where id = '86000000-0000-4000-8000-000000000001'
      and status = 'waiting'
      and task_assignment_id = '85000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Legacy queue changed during upgrade';
  end if;
  if not exists (
    select 1 from public.student_experience_settings
    where student_id = '81000000-0000-4000-8000-000000000004'
      and support_level = 3
      and progress_enabled
  ) then
    raise exception 'Legacy support setting changed during upgrade';
  end if;

  foreach signature in array array[
    'public.publish_task_to_class(uuid,uuid,text,text,text,smallint,smallint,timestamptz,timestamptz)',
    'public.publish_plan_to_class(uuid,uuid,jsonb)',
    'public.claim_student_help(uuid,uuid)',
    'public.resolve_student_help(uuid,uuid)'
  ] loop
    if to_regprocedure(signature) is not null then
      raise exception 'Legacy RPC still exists after upgrade: %', signature;
    end if;
  end loop;
  foreach signature in array array[
    'public.publish_task_to_class(uuid,uuid,uuid,text,text,text,smallint,smallint,timestamptz,timestamptz)',
    'public.publish_plan_to_class(uuid,uuid,uuid,jsonb)',
    'public.claim_student_help(uuid,uuid,uuid)',
    'public.resolve_student_help(uuid,uuid,uuid)'
  ] loop
    if to_regprocedure(signature) is null then
      raise exception 'Assignment-bound RPC is missing after upgrade: %', signature;
    end if;
  end loop;
end;
$$;
