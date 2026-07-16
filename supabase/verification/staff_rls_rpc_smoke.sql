\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, raw_user_meta_data)
select id, email, jsonb_build_object('display_name', display_name)
from (values
  ('10000000-0000-4000-8000-000000000001'::uuid, 'owner-a@staff.test', 'Eier A'),
  ('10000000-0000-4000-8000-000000000002'::uuid, 'contact@staff.test', 'Kontaktlærer'),
  ('10000000-0000-4000-8000-000000000003'::uuid, 'subject@staff.test', 'Faglærer'),
  ('10000000-0000-4000-8000-000000000004'::uuid, 'special@staff.test', 'Spesialpedagog'),
  ('10000000-0000-4000-8000-000000000005'::uuid, 'substitute@staff.test', 'Vikar'),
  ('10000000-0000-4000-8000-000000000006'::uuid, 'legacy@staff.test', 'Legacy lærer'),
  ('10000000-0000-4000-8000-000000000007'::uuid, 'student-a@staff.test', 'Elev A'),
  ('10000000-0000-4000-8000-000000000008'::uuid, 'owner-b@staff.test', 'Eier B'),
  ('10000000-0000-4000-8000-000000000009'::uuid, 'student-b@staff.test', 'Elev B')
) as fixture(id, email, display_name);

insert into public.organizations (id, name, created_by) values
  ('20000000-0000-4000-8000-000000000001', 'Organisasjon A', '10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002', 'Organisasjon B', '10000000-0000-4000-8000-000000000008');

insert into public.memberships (organization_id, user_id, role, created_by) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'owner', '10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'teacher', '10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'teacher', '10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', 'teacher', '10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'teacher', '10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000006', 'teacher', '10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000007', 'student', '10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000008', 'owner', '10000000-0000-4000-8000-000000000008'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000009', 'student', '10000000-0000-4000-8000-000000000008');

insert into public.classes (id, organization_id, name, created_by) values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Klasse A1', '10000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'Klasse A2', '10000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', 'Klasse B1', '10000000-0000-4000-8000-000000000008');

insert into public.class_memberships (class_id, organization_id, user_id, role, created_by) values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'teacher', '10000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000006', 'teacher', '10000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000007', 'student', '10000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000009', 'student', '10000000-0000-4000-8000-000000000008');

select public.create_staff_assignment(
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  target_user_id,
  '30000000-0000-4000-8000-000000000001',
  job_label,
  transaction_timestamp() - interval '1 day',
  transaction_timestamp() + interval '1 day',
  idempotency_key
)
from (values
  ('10000000-0000-4000-8000-000000000002'::uuid, 'contact_teacher'::public.staff_job_label, '60000000-0000-4000-8000-000000000002'::uuid),
  ('10000000-0000-4000-8000-000000000003'::uuid, 'subject_teacher'::public.staff_job_label, '60000000-0000-4000-8000-000000000003'::uuid),
  ('10000000-0000-4000-8000-000000000004'::uuid, 'special_educator'::public.staff_job_label, '60000000-0000-4000-8000-000000000004'::uuid),
  ('10000000-0000-4000-8000-000000000005'::uuid, 'substitute'::public.staff_job_label, '60000000-0000-4000-8000-000000000005'::uuid)
) as grants(target_user_id, job_label, idempotency_key);

insert into public.task_definitions (
  id, organization_id, class_id, title, publication_status, created_by, published_at
) values
  ('40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Oppgave A', 'published', '10000000-0000-4000-8000-000000000005', transaction_timestamp()),
  ('40000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', 'Oppgave A2', 'published', '10000000-0000-4000-8000-000000000001', transaction_timestamp()),
  ('40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', 'Oppgave B', 'published', '10000000-0000-4000-8000-000000000008', transaction_timestamp());

insert into public.task_assignments (
  id, organization_id, class_id, task_definition_id, student_id, assigned_by
) values (
  '50000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000007',
  '10000000-0000-4000-8000-000000000005'
);

insert into public.student_task_state (assignment_id, organization_id, student_id)
values ('50000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000007');

insert into public.help_requests (id, organization_id, class_id, student_id)
values ('70000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000007');

insert into public.student_experience_settings (
  organization_id, student_id, support_level, progress_enabled, updated_by
) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000007', 2, false, '10000000-0000-4000-8000-000000000005'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000009', 3, true, '10000000-0000-4000-8000-000000000008');

-- Seal fixture assignments before testing that no child scope or capability
-- can be appended after the atomic creation transaction has committed.
commit;
begin;

do $$
declare
  missing_rls text;
  capability_count integer;
  public_label_count integer;
  protected_table text;
  protected_function oid;
  negative_case record;
  denial_message text;
  denial_sqlstate text;
  assignments_before integer;
  audits_before integer;
  inclusive_assignment uuid;
  exact_end_assignment uuid;
  revoked_assignment uuid;
  future_assignment uuid;
  immutable_case record;
  signature text;
  assignment_rows_before integer;
  scope_rows_before integer;
  capability_rows_before integer;
begin
  select class.relname into missing_rls
  from pg_class as class
  where class.relnamespace = 'public'::regnamespace
    and class.relkind = 'r'
    and not class.relrowsecurity
  order by class.relname
  limit 1;
  if missing_rls is not null then
    raise exception 'Public table lacks RLS: %', missing_rls;
  end if;

  if has_table_privilege('anon', 'public.staff_assignments', 'SELECT') then
    raise exception 'Anon must not read staff assignments';
  end if;
  if has_table_privilege('authenticated', 'public.staff_assignments', 'INSERT,UPDATE,DELETE') then
    raise exception 'Authenticated must not mutate staff assignments';
  end if;
  if exists (
    select 1
    from unnest(array[
      'staff_assignments',
      'staff_assignment_class_scopes',
      'staff_assignment_capabilities'
    ]) as target(table_name)
    cross join unnest(array[
      'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
    ]) as privilege(privilege_name)
    where has_table_privilege(
      'service_role',
      format('public.%I', target.table_name),
      privilege.privilege_name
    )
  ) then
    raise exception 'Service role must mutate staff assignments only through audited RPCs';
  end if;
  if exists (
    select 1
    from unnest(array[
      'staff_assignments',
      'staff_assignment_class_scopes',
      'staff_assignment_capabilities'
    ]) as target(table_name)
    cross join unnest(array['authenticated', 'service_role']) as target_role(role_name)
    where not has_table_privilege(
      target_role.role_name,
      format('public.%I', target.table_name),
      'SELECT'
    )
  ) then
    raise exception 'Assignment table SELECT grants are incomplete';
  end if;
  if has_function_privilege(
    'authenticated',
    'public.create_staff_assignment(uuid,uuid,uuid,uuid,public.staff_job_label,timestamptz,timestamptz,uuid)',
    'EXECUTE'
  ) then
    raise exception 'Authenticated must not execute assignment control RPCs';
  end if;
  foreach protected_table in array array[
    'task_definitions',
    'task_assignments',
    'student_task_state',
    'help_requests',
    'student_experience_settings',
    'staff_assignments',
    'staff_assignment_class_scopes',
    'staff_assignment_capabilities'
  ] loop
    if exists (
      select 1
      from unnest(array['INSERT', 'UPDATE', 'DELETE']) as privilege(privilege_name)
      where has_table_privilege(
        'authenticated',
        format('public.%I', protected_table),
        privilege.privilege_name
      )
    ) then
      raise exception 'Authenticated has direct DML on protected table %', protected_table;
    end if;
  end loop;
  for protected_function in
    select procedure.oid
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = any(array[
        'staff_assignment_authorizes',
        'lock_staff_assignment_authorization',
        'lock_active_staff_assignment',
        'resolve_active_staff_assignment',
        'reconcile_expired_staff_assignments',
        'create_staff_assignment',
        'revoke_staff_assignment',
        'insert_published_task_to_class',
        'publish_task_to_class',
        'publish_plan_to_class',
        'claim_student_help',
        'resolve_student_help',
        'update_student_experience_for_staff'
      ])
  loop
    if has_function_privilege('authenticated', protected_function, 'EXECUTE') then
      raise exception 'Authenticated can execute service-only function %', protected_function::regprocedure;
    end if;
    if has_function_privilege('anon', protected_function, 'EXECUTE') then
      raise exception 'Anon can execute protected helper %', protected_function::regprocedure;
    end if;
  end loop;
  foreach signature in array array[
    'public.expected_staff_assignment_capabilities(text)',
    'public.guard_staff_assignment_seal_state()',
    'public.guard_staff_assignment_child_insert()',
    'public.try_seal_staff_assignment_profile()',
    'public.require_sealed_staff_assignment_profile()'
  ] loop
    if to_regprocedure(signature) is null then
      raise exception 'Assignment seal helper is missing: %', signature;
    end if;
    if has_function_privilege('anon', signature, 'EXECUTE')
      or has_function_privilege('authenticated', signature, 'EXECUTE')
      or has_function_privilege('service_role', signature, 'EXECUTE')
    then
      raise exception 'Assignment seal helper is externally executable: %', signature;
    end if;
  end loop;
  foreach signature in array array[
    'public.publish_task_to_class(uuid,uuid,text,text,text,smallint,smallint,timestamptz,timestamptz)',
    'public.publish_plan_to_class(uuid,uuid,jsonb)',
    'public.claim_student_help(uuid,uuid)',
    'public.resolve_student_help(uuid,uuid)'
  ] loop
    if to_regprocedure(signature) is not null then
      raise exception 'Legacy RPC still exists: %', signature;
    end if;
  end loop;
  foreach signature in array array[
    'public.publish_task_to_class(uuid,uuid,uuid,text,text,text,smallint,smallint,timestamptz,timestamptz)',
    'public.publish_plan_to_class(uuid,uuid,uuid,jsonb)',
    'public.claim_student_help(uuid,uuid,uuid)',
    'public.resolve_student_help(uuid,uuid,uuid)'
  ] loop
    if to_regprocedure(signature) is null then
      raise exception 'Assignment-bound RPC is missing: %', signature;
    end if;
  end loop;

  select count(*) into capability_count
  from public.staff_assignment_capabilities as capability
  join public.staff_assignments as assignment on assignment.id = capability.assignment_id
  where assignment.source = 'manual';
  if capability_count <> 24 then
    raise exception 'Four public labels must expand to exactly 24 capability rows: %', capability_count;
  end if;
  select count(distinct assignment.job_label) into public_label_count
  from public.staff_assignments as assignment
  where assignment.source = 'manual';
  if public_label_count <> 4 then
    raise exception 'Every public job label needs an explicit capability profile';
  end if;
  if exists (
    select 1
    from public.staff_assignments as assignment
    join public.staff_assignment_capabilities as capability
      on capability.assignment_id = assignment.id
    where assignment.source = 'manual'
    group by assignment.id
    having array_agg(capability.capability::text order by capability.capability::text)
      <> array[
        'class.workspace.read',
        'help_queue.manage',
        'plan.preview',
        'plan.publish',
        'student_support.update',
        'task.publish'
      ]::text[]
  ) then
    raise exception 'A public job label does not expand to the exact six-capability profile';
  end if;

  select count(*) into assignments_before from public.staff_assignments;
  select count(*) into audits_before from public.audit_events;
  for negative_case in
    select *
    from (values
      (
        'student target',
        '20000000-0000-4000-8000-000000000001'::uuid,
        '10000000-0000-4000-8000-000000000001'::uuid,
        '10000000-0000-4000-8000-000000000007'::uuid,
        '30000000-0000-4000-8000-000000000001'::uuid,
        'substitute'::public.staff_job_label,
        transaction_timestamp(),
        transaction_timestamp() + interval '1 hour',
        '60000000-0000-4000-8000-000000000100'::uuid,
        'Assignment target must be a current adult member in the organization'
      ),
      (
        'other organization target',
        '20000000-0000-4000-8000-000000000001'::uuid,
        '10000000-0000-4000-8000-000000000001'::uuid,
        '10000000-0000-4000-8000-000000000008'::uuid,
        '30000000-0000-4000-8000-000000000001'::uuid,
        'substitute'::public.staff_job_label,
        transaction_timestamp(),
        transaction_timestamp() + interval '1 hour',
        '60000000-0000-4000-8000-000000000101'::uuid,
        'Assignment target must be a current adult member in the organization'
      ),
      (
        'other organization class',
        '20000000-0000-4000-8000-000000000001'::uuid,
        '10000000-0000-4000-8000-000000000001'::uuid,
        '10000000-0000-4000-8000-000000000002'::uuid,
        '30000000-0000-4000-8000-000000000003'::uuid,
        'substitute'::public.staff_job_label,
        transaction_timestamp(),
        transaction_timestamp() + interval '1 hour',
        '60000000-0000-4000-8000-000000000102'::uuid,
        'Assignment class must belong to the organization'
      ),
      (
        'invalid interval',
        '20000000-0000-4000-8000-000000000001'::uuid,
        '10000000-0000-4000-8000-000000000001'::uuid,
        '10000000-0000-4000-8000-000000000002'::uuid,
        '30000000-0000-4000-8000-000000000001'::uuid,
        'substitute'::public.staff_job_label,
        transaction_timestamp(),
        transaction_timestamp(),
        '60000000-0000-4000-8000-000000000103'::uuid,
        'Manual assignment requires a valid start and end'
      ),
      (
        'missing end',
        '20000000-0000-4000-8000-000000000001'::uuid,
        '10000000-0000-4000-8000-000000000001'::uuid,
        '10000000-0000-4000-8000-000000000002'::uuid,
        '30000000-0000-4000-8000-000000000001'::uuid,
        'substitute'::public.staff_job_label,
        transaction_timestamp(),
        null::timestamptz,
        '60000000-0000-4000-8000-000000000104'::uuid,
        'Manual assignment requires a valid start and end'
      ),
      (
        'legacy label',
        '20000000-0000-4000-8000-000000000001'::uuid,
        '10000000-0000-4000-8000-000000000001'::uuid,
        '10000000-0000-4000-8000-000000000002'::uuid,
        '30000000-0000-4000-8000-000000000001'::uuid,
        'legacy_teacher'::public.staff_job_label,
        transaction_timestamp(),
        transaction_timestamp() + interval '1 hour',
        '60000000-0000-4000-8000-000000000105'::uuid,
        'Internal job labels cannot be assigned manually'
      ),
      (
        'operational owner label',
        '20000000-0000-4000-8000-000000000001'::uuid,
        '10000000-0000-4000-8000-000000000001'::uuid,
        '10000000-0000-4000-8000-000000000002'::uuid,
        '30000000-0000-4000-8000-000000000001'::uuid,
        'operational_owner'::public.staff_job_label,
        transaction_timestamp(),
        transaction_timestamp() + interval '1 hour',
        '60000000-0000-4000-8000-000000000106'::uuid,
        'Internal job labels cannot be assigned manually'
      ),
      (
        'non-owner actor',
        '20000000-0000-4000-8000-000000000001'::uuid,
        '10000000-0000-4000-8000-000000000002'::uuid,
        '10000000-0000-4000-8000-000000000003'::uuid,
        '30000000-0000-4000-8000-000000000001'::uuid,
        'substitute'::public.staff_job_label,
        transaction_timestamp(),
        transaction_timestamp() + interval '1 hour',
        '60000000-0000-4000-8000-000000000107'::uuid,
        'Only an organization owner can create staff assignments'
      ),
      (
        'other organization owner actor',
        '20000000-0000-4000-8000-000000000001'::uuid,
        '10000000-0000-4000-8000-000000000008'::uuid,
        '10000000-0000-4000-8000-000000000002'::uuid,
        '30000000-0000-4000-8000-000000000001'::uuid,
        'substitute'::public.staff_job_label,
        transaction_timestamp(),
        transaction_timestamp() + interval '1 hour',
        '60000000-0000-4000-8000-000000000108'::uuid,
        'Only an organization owner can create staff assignments'
      )
    ) as cases(
      case_name,
      organization_id,
      actor_id,
      target_id,
      class_id,
      job_label,
      starts_at,
      ends_at,
      idempotency_key,
      expected_message
    )
  loop
    denial_message := null;
    begin
      perform public.create_staff_assignment(
        negative_case.organization_id,
        negative_case.actor_id,
        negative_case.target_id,
        negative_case.class_id,
        negative_case.job_label,
        negative_case.starts_at,
        negative_case.ends_at,
        negative_case.idempotency_key
      );
    exception when others then
      get stacked diagnostics denial_message = message_text;
    end;
    if denial_message is null
      or position(negative_case.expected_message in denial_message) = 0
    then
      raise exception 'Negative create case % failed with: %',
        negative_case.case_name,
        denial_message;
    end if;
  end loop;
  if (select count(*) from public.staff_assignments) <> assignments_before
    or (select count(*) from public.audit_events) <> audits_before
  then
    raise exception 'A rejected assignment request left partial control-plane data';
  end if;

  inclusive_assignment := public.create_staff_assignment(
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000002',
    'contact_teacher',
    transaction_timestamp(),
    transaction_timestamp() + interval '1 hour',
    '60000000-0000-4000-8000-000000000010'
  );
  if public.resolve_active_staff_assignment(
    '10000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000002',
    'class.workspace.read'
  ) <> inclusive_assignment then
    raise exception 'Inclusive assignment start failed';
  end if;

  exact_end_assignment := public.create_staff_assignment(
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000003',
    '30000000-0000-4000-8000-000000000002',
    'subject_teacher',
    transaction_timestamp() - interval '1 hour',
    transaction_timestamp(),
    '60000000-0000-4000-8000-000000000011'
  );
  if public.staff_assignment_authorizes(
    exact_end_assignment,
    '10000000-0000-4000-8000-000000000003',
    '30000000-0000-4000-8000-000000000002',
    'class.workspace.read'
  ) then
    raise exception 'Exclusive assignment end failed';
  end if;

  revoked_assignment := public.create_staff_assignment(
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000004',
    '30000000-0000-4000-8000-000000000002',
    'special_educator',
    transaction_timestamp() - interval '1 hour',
    transaction_timestamp() + interval '1 hour',
    '60000000-0000-4000-8000-000000000012'
  );
  perform public.revoke_staff_assignment(
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    revoked_assignment
  );
  if public.staff_assignment_authorizes(
    revoked_assignment,
    '10000000-0000-4000-8000-000000000004',
    '30000000-0000-4000-8000-000000000002',
    'class.workspace.read'
  ) then
    raise exception 'Revoked assignment still authorizes';
  end if;

  future_assignment := public.create_staff_assignment(
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000002',
    'substitute',
    transaction_timestamp() + interval '1 hour',
    transaction_timestamp() + interval '2 hours',
    '60000000-0000-4000-8000-000000000013'
  );
  if public.staff_assignment_authorizes(
    future_assignment,
    '10000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000002',
    'class.workspace.read'
  ) then
    raise exception 'Future assignment authorized before its inclusive start';
  end if;

  perform public.revoke_staff_assignment(
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    future_assignment
  );
  select count(*) into assignment_rows_before
  from public.staff_assignments where id = future_assignment;
  select count(*) into scope_rows_before
  from public.staff_assignment_class_scopes where assignment_id = future_assignment;
  select count(*) into capability_rows_before
  from public.staff_assignment_capabilities where assignment_id = future_assignment;

  if exists (
    select 1
    from public.staff_assignments as assignment
    where assignment.profile_sealed_at is null
  ) then
    raise exception 'A completed assignment profile remained unsealed';
  end if;

  denial_message := null;
  denial_sqlstate := null;
  begin
    insert into public.staff_assignment_class_scopes (
      assignment_id,
      organization_id,
      class_id
    ) values (
      future_assignment,
      '20000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000002'
    );
  exception when others then
    get stacked diagnostics
      denial_message = message_text,
      denial_sqlstate = returned_sqlstate;
  end;
  if denial_sqlstate <> '23514'
    or denial_message <> 'Staff assignment scope and capabilities are immutable after creation'
  then
    raise exception 'Assignment scope insert was not guarded: % %',
      denial_sqlstate,
      denial_message;
  end if;

  denial_message := null;
  denial_sqlstate := null;
  begin
    insert into public.staff_assignments (
      id,
      organization_id,
      user_id,
      job_label,
      starts_at,
      ends_at,
      source,
      created_by,
      idempotency_key,
      request_fingerprint,
      profile_sealed_at
    ) values (
      '80000000-0000-4000-8000-000000000003',
      '20000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000005',
      'substitute',
      transaction_timestamp(),
      transaction_timestamp() + interval '1 hour',
      'manual',
      '10000000-0000-4000-8000-000000000001',
      '80000000-0000-4000-8000-000000000004',
      md5('presealed-staff-assignment'),
      transaction_timestamp()
    );
  exception when others then
    get stacked diagnostics
      denial_message = message_text,
      denial_sqlstate = returned_sqlstate;
  end;
  if denial_sqlstate <> '23514'
    or denial_message <> 'Staff assignment profile must be sealed by the database'
    or exists (
      select 1
      from public.staff_assignments
      where id = '80000000-0000-4000-8000-000000000003'
    )
  then
    raise exception 'Pre-sealed assignment insert was not rejected atomically: % %',
      denial_sqlstate,
      denial_message;
  end if;

  denial_message := null;
  denial_sqlstate := null;
  begin
    insert into public.staff_assignments (
      id,
      organization_id,
      user_id,
      job_label,
      starts_at,
      ends_at,
      source,
      created_by,
      idempotency_key,
      request_fingerprint
    ) values (
      '80000000-0000-4000-8000-000000000005',
      '20000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000005',
      'substitute',
      transaction_timestamp(),
      transaction_timestamp() + interval '1 hour',
      'manual',
      '10000000-0000-4000-8000-000000000001',
      '80000000-0000-4000-8000-000000000006',
      md5('forged-seal-staff-assignment')
    );
    perform set_config(
      'klar.staff_assignment_seal_id',
      '80000000-0000-4000-8000-000000000005',
      true
    );
    update public.staff_assignments
    set profile_sealed_at = transaction_timestamp()
    where id = '80000000-0000-4000-8000-000000000005';
  exception when others then
    get stacked diagnostics
      denial_message = message_text,
      denial_sqlstate = returned_sqlstate;
  end;
  if denial_sqlstate <> '23514'
    or denial_message <> 'Staff assignment profile seal is immutable'
    or exists (
      select 1
      from public.staff_assignments
      where id = '80000000-0000-4000-8000-000000000005'
    )
  then
    raise exception 'Forged incomplete profile seal was not rejected atomically: % %',
      denial_sqlstate,
      denial_message;
  end if;

  denial_message := null;
  denial_sqlstate := null;
  begin
    insert into public.staff_assignment_capabilities (
      assignment_id,
      capability
    ) values (
      future_assignment,
      'class.workspace.read'
    );
  exception when others then
    get stacked diagnostics
      denial_message = message_text,
      denial_sqlstate = returned_sqlstate;
  end;
  if denial_sqlstate <> '23514'
    or denial_message <> 'Staff assignment scope and capabilities are immutable after creation'
  then
    raise exception 'Assignment capability insert was not guarded: % %',
      denial_sqlstate,
      denial_message;
  end if;

  denial_message := null;
  denial_sqlstate := null;
  begin
    insert into public.staff_assignments (
      id,
      organization_id,
      user_id,
      job_label,
      starts_at,
      ends_at,
      source,
      created_by,
      idempotency_key,
      request_fingerprint
    ) values (
      '80000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000005',
      'substitute',
      transaction_timestamp(),
      transaction_timestamp() + interval '1 hour',
      'manual',
      '10000000-0000-4000-8000-000000000001',
      '80000000-0000-4000-8000-000000000002',
      md5('incomplete-staff-assignment')
    );
    execute 'set constraints staff_assignment_requires_sealed_profile immediate';
  exception when others then
    get stacked diagnostics
      denial_message = message_text,
      denial_sqlstate = returned_sqlstate;
  end;
  if denial_sqlstate <> '23514'
    or denial_message <> 'Staff assignment must have one scope and the exact capability profile'
    or exists (
      select 1
      from public.staff_assignments
      where id = '80000000-0000-4000-8000-000000000001'
    )
  then
    raise exception 'Incomplete assignment commit was not atomic: % %',
      denial_sqlstate,
      denial_message;
  end if;

  for immutable_case in
    select *
    from (values
      ('id', 'id = gen_random_uuid()'),
      ('organization_id', 'organization_id = ''20000000-0000-4000-8000-000000000002''::uuid'),
      ('user_id', 'user_id = ''10000000-0000-4000-8000-000000000005''::uuid'),
      ('job_label', 'job_label = ''subject_teacher''::public.staff_job_label'),
      ('profile_version', 'profile_version = profile_version || ''-tampered'''),
      ('starts_at', 'starts_at = starts_at - interval ''1 minute'''),
      ('ends_at', 'ends_at = ends_at + interval ''1 minute'''),
      ('source', 'source = ''legacy_backfill''::public.staff_assignment_source'),
      ('created_by', 'created_by = ''10000000-0000-4000-8000-000000000008''::uuid'),
      ('idempotency_key', 'idempotency_key = gen_random_uuid()'),
      ('request_fingerprint', 'request_fingerprint = request_fingerprint || ''-tampered'''),
      ('version', 'version = version + 1'),
      ('created_at', 'created_at = created_at - interval ''1 minute''')
    ) as mutation(field_name, assignment_sql)
  loop
    denial_message := null;
    begin
      execute format(
        'update public.staff_assignments set %s where id = $1',
        immutable_case.assignment_sql
      ) using future_assignment;
    exception when others then
      get stacked diagnostics denial_message = message_text;
    end;
    if denial_message <> 'Staff assignment identity, scope, profile and validity are immutable' then
      raise exception 'Immutable assignment field % was not guarded: %',
        immutable_case.field_name,
        denial_message;
    end if;
  end loop;

  denial_message := null;
  denial_sqlstate := null;
  begin
    update public.staff_assignments
    set profile_sealed_at = null
    where id = future_assignment;
  exception when others then
    get stacked diagnostics
      denial_message = message_text,
      denial_sqlstate = returned_sqlstate;
  end;
  if denial_sqlstate <> '23514'
    or denial_message <> 'Staff assignment profile seal is immutable'
  then
    raise exception 'Assignment profile seal mutation was not guarded: % %',
      denial_sqlstate,
      denial_message;
  end if;

  denial_message := null;
  begin
    update public.staff_assignment_class_scopes
    set class_id = '30000000-0000-4000-8000-000000000001'
    where assignment_id = future_assignment;
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message <> 'Staff assignment scope and capabilities are immutable' then
    raise exception 'Assignment scope update was not guarded: %', denial_message;
  end if;

  denial_message := null;
  begin
    delete from public.staff_assignment_class_scopes
    where assignment_id = future_assignment;
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message <> 'Staff assignment scope and capabilities are immutable' then
    raise exception 'Assignment scope delete was not guarded: %', denial_message;
  end if;

  denial_message := null;
  begin
    update public.staff_assignment_capabilities
    set capability = 'task.publish'
    where assignment_id = future_assignment
      and capability = 'class.workspace.read';
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message <> 'Staff assignment scope and capabilities are immutable' then
    raise exception 'Assignment capability update was not guarded: %', denial_message;
  end if;

  denial_message := null;
  begin
    delete from public.staff_assignment_capabilities
    where assignment_id = future_assignment;
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message <> 'Staff assignment scope and capabilities are immutable' then
    raise exception 'Assignment capability delete was not guarded: %', denial_message;
  end if;

  denial_message := null;
  begin
    delete from public.staff_assignments where id = future_assignment;
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message <> 'Staff assignment history cannot be deleted' then
    raise exception 'Assignment hard delete was not guarded: %', denial_message;
  end if;

  denial_message := null;
  begin
    delete from public.memberships
    where organization_id = '20000000-0000-4000-8000-000000000001'
      and user_id = '10000000-0000-4000-8000-000000000006';
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message <> 'Membership with staff assignment history cannot be deleted' then
    raise exception 'Historical assignment membership delete was not guarded: %', denial_message;
  end if;

  if (select count(*) from public.staff_assignments where id = future_assignment)
      <> assignment_rows_before
    or (select count(*) from public.staff_assignment_class_scopes where assignment_id = future_assignment)
      <> scope_rows_before
    or (select count(*) from public.staff_assignment_capabilities where assignment_id = future_assignment)
      <> capability_rows_before
    or not exists (
      select 1 from public.memberships
      where organization_id = '20000000-0000-4000-8000-000000000001'
        and user_id = '10000000-0000-4000-8000-000000000006'
    )
    or not exists (
      select 1 from public.audit_events
      where event_name = 'staff_assignment.revoked'
        and entity_id = future_assignment
    )
  then
    raise exception 'Rejected history mutations changed assignment state or audit';
  end if;
end;
$$;

-- Each read capability is independent. Fault-inject one missing capability at
-- a time, exercise policies as an authenticated AAL2 staff user, and restore
-- the profile before the next case.
reset role;
set local session_replication_role = replica;
delete from public.staff_assignment_capabilities as capability
using public.staff_assignments as assignment
where capability.assignment_id = assignment.id
  and assignment.user_id = '10000000-0000-4000-8000-000000000005'
  and assignment.source = 'manual'
  and capability.capability = 'help_queue.manage';
set local session_replication_role = origin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000005","aal":"aal2","role":"authenticated"}',
  true
);
do $$
begin
  if (select count(*) from public.task_definitions) <> 1
    or (select count(*) from public.student_experience_settings) <> 1
    or (select count(*) from public.help_requests) <> 0
  then
    raise exception 'Missing help capability did not isolate direct queue read';
  end if;
end;
$$;

reset role;
set local session_replication_role = replica;
insert into public.staff_assignment_capabilities (assignment_id, capability)
select assignment.id, 'help_queue.manage'
from public.staff_assignments as assignment
where assignment.user_id = '10000000-0000-4000-8000-000000000005'
  and assignment.source = 'manual';
set local session_replication_role = origin;

set local session_replication_role = replica;
delete from public.staff_assignment_capabilities as capability
using public.staff_assignments as assignment
where capability.assignment_id = assignment.id
  and assignment.user_id = '10000000-0000-4000-8000-000000000005'
  and assignment.source = 'manual'
  and capability.capability = 'student_support.update';
set local session_replication_role = origin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000005","aal":"aal2","role":"authenticated"}',
  true
);
do $$
begin
  if (select count(*) from public.task_definitions) <> 1
    or (select count(*) from public.help_requests) <> 1
    or (select count(*) from public.student_experience_settings) <> 0
  then
    raise exception 'Missing support capability did not isolate direct support read';
  end if;
end;
$$;

reset role;
set local session_replication_role = replica;
insert into public.staff_assignment_capabilities (assignment_id, capability)
select assignment.id, 'student_support.update'
from public.staff_assignments as assignment
where assignment.user_id = '10000000-0000-4000-8000-000000000005'
  and assignment.source = 'manual';
set local session_replication_role = origin;

set local session_replication_role = replica;
delete from public.staff_assignment_capabilities as capability
using public.staff_assignments as assignment
where capability.assignment_id = assignment.id
  and assignment.user_id = '10000000-0000-4000-8000-000000000005'
  and assignment.source = 'manual'
  and capability.capability = 'class.workspace.read';
set local session_replication_role = origin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000005","aal":"aal2","role":"authenticated"}',
  true
);
do $$
begin
  if (select count(*) from public.classes) <> 0
    or (select count(*) from public.task_definitions) <> 0
    or (select count(*) from public.class_memberships) <> 0
    or exists (
      select 1
      from public.profiles
      where id = '10000000-0000-4000-8000-000000000007'
    )
  then
    raise exception 'Missing workspace capability exposed direct class rows';
  end if;
end;
$$;

reset role;
set local session_replication_role = replica;
insert into public.staff_assignment_capabilities (assignment_id, capability)
select assignment.id, 'class.workspace.read'
from public.staff_assignments as assignment
where assignment.user_id = '10000000-0000-4000-8000-000000000005'
  and assignment.source = 'manual';
set local session_replication_role = origin;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000005","aal":"aal2","role":"authenticated"}',
  true
);
do $$
declare
  denied boolean := false;
begin
  if (select array_agg(title order by title) from public.task_definitions)
    is distinct from array['Oppgave A']::text[]
  then
    raise exception 'Active AAL2 staff scope failed';
  end if;
  if (select count(*) from public.help_requests) <> 1 then
    raise exception 'Active AAL2 queue scope failed';
  end if;
  if (select count(*) from public.audit_events) <> 0 then
    raise exception 'Operational staff could read owner-only audit events';
  end if;
  begin
    insert into public.staff_assignments (
      organization_id, user_id, job_label, starts_at, ends_at, source, idempotency_key, request_fingerprint
    ) values (
      '20000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000005',
      'substitute', transaction_timestamp(), transaction_timestamp() + interval '1 hour',
      'manual', gen_random_uuid(), 'forbidden-direct-write'
    );
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then
    raise exception 'Authenticated direct staff DML was not denied';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000002","aal":"aal2","role":"authenticated"}',
  true
);
do $$
begin
  if (select array_agg(title order by title) from public.task_definitions)
    is distinct from array['Oppgave A', 'Oppgave A2']::text[]
  then
    raise exception 'Inclusive assignment start did not authorize direct RLS';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000005","aal":"aal1","role":"authenticated"}',
  true
);
do $$
begin
  if (select count(*) from public.task_definitions) <> 0
    or (select count(*) from public.help_requests) <> 0
    or (select count(*) from public.student_experience_settings) <> 0
    or (select count(*) from public.class_memberships) <> 0
  then
    raise exception 'AAL1 staff received pedagogical rows';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","aal":"aal2","role":"authenticated"}',
  true
);
do $$
begin
  if (select count(*) from public.staff_assignments) < 4 then
    raise exception 'Owner AAL2 cannot inspect own control plane';
  end if;
  if (select count(*) from public.audit_events) = 0 then
    raise exception 'Owner AAL2 cannot inspect organization audit events';
  end if;
  if (select count(*) from public.task_definitions) <> 0
    or (select count(*) from public.help_requests) <> 0
    or (select count(*) from public.student_experience_settings) <> 0
  then
    raise exception 'Owner without assignment received pedagogical rows';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","aal":"aal1","role":"authenticated"}',
  true
);
do $$
begin
  if (select count(*) from public.staff_assignments) <> 0
    or (select count(*) from public.staff_assignment_class_scopes) <> 0
    or (select count(*) from public.staff_assignment_capabilities) <> 0
    or (select count(*) from public.classes) <> 0
    or (select count(*) from public.audit_events) <> 0
  then
    raise exception 'Owner AAL1 received control-plane or audit rows';
  end if;
  if (select count(*) from public.profiles) <> 1
    or (select count(*) from public.memberships) <> 1
  then
    raise exception 'Owner AAL1 self-service scope leaked or disappeared';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000006","aal":"aal2","role":"authenticated"}',
  true
);
do $$
begin
  if (select count(*) from public.task_definitions) <> 0
    or (select count(*) from public.class_memberships) <> 0
  then
    raise exception 'Legacy membership or future assignment bypassed active staff scope';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000003","aal":"aal2","role":"authenticated"}',
  true
);
do $$
begin
  if exists (
    select 1 from public.task_definitions where title = 'Oppgave A2'
  ) then
    raise exception 'Exact-end assignment authorized direct RLS';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000004","aal":"aal2","role":"authenticated"}',
  true
);
do $$
begin
  if exists (
    select 1 from public.task_definitions where title = 'Oppgave A2'
  ) then
    raise exception 'Revoked assignment authorized direct RLS';
  end if;
end;
$$;

reset role;
set local role service_role;
do $$
declare
  staff_assignment_id uuid;
  first_retry_id uuid;
  second_retry_id uuid;
  task_id uuid;
  plan_ids uuid[];
  help_request public.help_requests;
  revoked_help_id uuid;
  experience public.student_experience_settings;
  conflict_denied boolean := false;
  stale_denied boolean := false;
  stale_plan_denied boolean := false;
  stale_support_denied boolean := false;
  wrong_scope_denied boolean := false;
  wrong_plan_scope_denied boolean := false;
  plan_rollback_denied boolean := false;
  support_denials integer := 0;
  revoke_denials integer := 0;
  stale_help_denied boolean := false;
  demotion_denied boolean := false;
  task_count_before integer;
  audit_count_before integer;
begin
  select assignment.id into staff_assignment_id
  from public.staff_assignments as assignment
  where assignment.user_id = '10000000-0000-4000-8000-000000000005'
    and assignment.source = 'manual';
  if not exists (
    select 1
    from public.staff_assignments as assignment
    join public.staff_assignment_class_scopes as scope
      on scope.assignment_id = assignment.id
    join public.audit_events as audit
      on audit.entity_id = assignment.id
     and audit.event_name = 'staff_assignment.created'
    where assignment.id = staff_assignment_id
      and audit.organization_id = assignment.organization_id
      and audit.actor_id = '10000000-0000-4000-8000-000000000001'
      and audit.entity_type = 'staff_assignment'
      and audit.metadata ->> 'target_user_id' = assignment.user_id::text
      and audit.metadata ->> 'class_id' = scope.class_id::text
      and audit.metadata ->> 'job_label' = assignment.job_label::text
      and (audit.metadata ->> 'starts_at')::timestamptz = assignment.starts_at
      and (audit.metadata ->> 'ends_at')::timestamptz = assignment.ends_at
  ) then
    raise exception 'Assignment create audit lacks exact actor, scope, role, or interval';
  end if;

  first_retry_id := public.create_staff_assignment(
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000005',
    '30000000-0000-4000-8000-000000000002',
    'substitute',
    transaction_timestamp() - interval '1 hour',
    transaction_timestamp() + interval '1 hour',
    '60000000-0000-4000-8000-000000000020'
  );
  second_retry_id := public.create_staff_assignment(
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000005',
    '30000000-0000-4000-8000-000000000002',
    'substitute',
    transaction_timestamp() - interval '1 hour',
    transaction_timestamp() + interval '1 hour',
    '60000000-0000-4000-8000-000000000020'
  );
  if first_retry_id <> second_retry_id then
    raise exception 'Idempotent assignment retry returned different IDs';
  end if;
  if (
    select count(*)
    from public.audit_events
    where event_name = 'staff_assignment.created'
      and entity_id = first_retry_id
      and actor_id = '10000000-0000-4000-8000-000000000001'
  ) <> 1 then
    raise exception 'Idempotent assignment retry did not preserve one attributed create audit';
  end if;

  begin
    perform public.create_staff_assignment(
      '20000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000005',
      '30000000-0000-4000-8000-000000000002',
      'subject_teacher',
      transaction_timestamp() - interval '1 hour',
      transaction_timestamp() + interval '1 hour',
      '60000000-0000-4000-8000-000000000020'
    );
  exception when others then
    conflict_denied := true;
  end;
  if not conflict_denied then
    raise exception 'Conflicting idempotency retry was accepted';
  end if;

  task_id := public.publish_task_to_class(
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000005',
    staff_assignment_id,
    'Publisert med oppdrag'
  );
  if not exists (
    select 1 from public.audit_events
    where entity_id = task_id
      and organization_id = '20000000-0000-4000-8000-000000000001'
      and actor_id = '10000000-0000-4000-8000-000000000005'
      and event_name = 'task.published'
      and entity_type = 'task_definition'
      and metadata ->> 'class_id' = '30000000-0000-4000-8000-000000000001'
      and authorizing_staff_assignment_id = staff_assignment_id
      and authorizing_capability = 'task.publish'
  ) then
    raise exception 'Task audit lacks assignment and capability';
  end if;

  begin
    perform public.publish_task_to_class(
      '30000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000005',
      staff_assignment_id,
      'Feil klasse skal avvises'
    );
  exception when others then
    wrong_scope_denied := true;
  end;
  if not wrong_scope_denied then
    raise exception 'Task publishing escaped the assignment class scope';
  end if;

  select count(*) into task_count_before from public.task_definitions;
  select count(*) into audit_count_before from public.audit_events;
  begin
    perform public.publish_plan_to_class(
      '30000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000005',
      staff_assignment_id,
      '[{"title":"Plan i feil klasse skal avvises"}]'::jsonb
    );
  exception when others then
    wrong_plan_scope_denied := true;
  end;
  if not wrong_plan_scope_denied
    or (select count(*) from public.task_definitions) <> task_count_before
    or (select count(*) from public.audit_events) <> audit_count_before
  then
    raise exception 'Plan publishing escaped class scope or left partial rows';
  end if;

  plan_ids := public.publish_plan_to_class(
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000005',
    staff_assignment_id,
    '[{"title":"Planoppgave 1"},{"title":"Planoppgave 2","support_level":3}]'::jsonb
  );
  if cardinality(plan_ids) <> 2
    or not exists (
      select 1
      from public.audit_events
      where event_name = 'plan.published'
        and entity_id = '30000000-0000-4000-8000-000000000001'
        and actor_id = '10000000-0000-4000-8000-000000000005'
        and authorizing_staff_assignment_id = staff_assignment_id
        and authorizing_capability = 'plan.publish'
        and metadata -> 'task_ids' = to_jsonb(plan_ids)
    )
    or (
      select count(*)
      from public.audit_events
      where entity_id = any(plan_ids)
        and event_name = 'task.published'
        and authorizing_staff_assignment_id = staff_assignment_id
        and authorizing_capability = 'plan.publish'
    ) <> 2
  then
    raise exception 'Plan publishing or its audit attribution failed';
  end if;

  select count(*) into task_count_before from public.task_definitions;
  select count(*) into audit_count_before from public.audit_events;
  begin
    perform public.publish_plan_to_class(
      '30000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000005',
      staff_assignment_id,
      '[{"title":"Skal rulles tilbake"},{"description":"Mangler tittel"}]'::jsonb
    );
  exception when others then
    plan_rollback_denied := true;
  end;
  if not plan_rollback_denied
    or (select count(*) from public.task_definitions) <> task_count_before
    or (select count(*) from public.audit_events) <> audit_count_before
  then
    raise exception 'Failed plan publishing did not roll back tasks and audit atomically';
  end if;

  experience := public.update_student_experience_for_staff(
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000007',
    '10000000-0000-4000-8000-000000000005',
    staff_assignment_id,
    1::smallint,
    true
  );
  if experience.support_level <> 1 or not experience.progress_enabled then
    raise exception 'Staff support mutation failed';
  end if;
  if not exists (
    select 1
    from public.audit_events
    where event_name = 'student.experience.updated'
      and organization_id = '20000000-0000-4000-8000-000000000001'
      and actor_id = '10000000-0000-4000-8000-000000000005'
      and entity_id = '10000000-0000-4000-8000-000000000007'
      and metadata ->> 'class_id' = '30000000-0000-4000-8000-000000000001'
      and authorizing_staff_assignment_id = staff_assignment_id
      and authorizing_capability = 'student_support.update'
  ) then
    raise exception 'Student support audit lacks exact authorization context';
  end if;

  begin
    perform public.update_student_experience_for_staff(
      '20000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000009',
      '10000000-0000-4000-8000-000000000005',
      staff_assignment_id,
      1::smallint,
      true
    );
  exception when others then
    support_denials := support_denials + 1;
  end;
  begin
    perform public.update_student_experience_for_staff(
      '20000000-0000-4000-8000-000000000002',
      '30000000-0000-4000-8000-000000000003',
      '10000000-0000-4000-8000-000000000009',
      '10000000-0000-4000-8000-000000000005',
      staff_assignment_id,
      1::smallint,
      true
    );
  exception when others then
    support_denials := support_denials + 1;
  end;
  if support_denials <> 2 then
    raise exception 'Student support escaped class or organization scope';
  end if;

  help_request := public.claim_student_help(
    '70000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000005',
    staff_assignment_id
  );
  help_request := public.resolve_student_help(
    help_request.id,
    '10000000-0000-4000-8000-000000000005',
    staff_assignment_id
  );
  if help_request.status <> 'resolved'
    or not exists (
      select 1
      from public.audit_events
      where entity_id = help_request.id
        and event_name = 'help.claimed'
        and actor_id = '10000000-0000-4000-8000-000000000005'
        and authorizing_staff_assignment_id = staff_assignment_id
        and authorizing_capability = 'help_queue.manage'
    )
    or not exists (
      select 1
      from public.audit_events
      where entity_id = help_request.id
        and event_name = 'help.resolved'
        and actor_id = '10000000-0000-4000-8000-000000000005'
        and authorizing_staff_assignment_id = staff_assignment_id
        and authorizing_capability = 'help_queue.manage'
    )
  then
    raise exception 'Help claim/resolve or audit attribution failed';
  end if;

  help_request := public.request_student_help(
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000007',
    null
  );
  help_request := public.claim_student_help(
    help_request.id,
    '10000000-0000-4000-8000-000000000005',
    staff_assignment_id
  );
  revoked_help_id := help_request.id;

  begin
    update public.memberships
    set role = 'student'
    where organization_id = '20000000-0000-4000-8000-000000000001'
      and user_id = '10000000-0000-4000-8000-000000000005';
  exception when others then
    demotion_denied := true;
  end;
  if not demotion_denied then
    raise exception 'Active adult assignment did not block demotion';
  end if;

  begin
    perform public.revoke_staff_assignment(
      '20000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002',
      staff_assignment_id
    );
  exception when others then
    revoke_denials := revoke_denials + 1;
  end;
  begin
    perform public.revoke_staff_assignment(
      '20000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000008',
      staff_assignment_id
    );
  exception when others then
    revoke_denials := revoke_denials + 1;
  end;
  if revoke_denials <> 2
    or exists (
      select 1
      from public.staff_assignments
      where id = staff_assignment_id
        and revoked_at is not null
    )
    or exists (
      select 1
      from public.audit_events
      where event_name = 'staff_assignment.revoked'
        and entity_id = staff_assignment_id
    )
  then
    raise exception 'Unauthorized or cross-organization revoke changed assignment history';
  end if;

  perform public.revoke_staff_assignment(
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    staff_assignment_id
  );
  if not exists (
    select 1
    from public.staff_assignments as assignment
    join public.audit_events as audit
      on audit.entity_id = assignment.id
     and audit.event_name = 'staff_assignment.revoked'
    where assignment.id = staff_assignment_id
      and audit.organization_id = assignment.organization_id
      and audit.actor_id = '10000000-0000-4000-8000-000000000001'
      and audit.entity_type = 'staff_assignment'
      and audit.metadata ->> 'target_user_id' = assignment.user_id::text
      and (audit.metadata ->> 'revoked_at')::timestamptz = assignment.revoked_at
  ) then
    raise exception 'Assignment revoke audit lacks exact actor, target, or effective time';
  end if;
  begin
    perform public.publish_task_to_class(
      '30000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000005',
      staff_assignment_id,
      'Skal avvises'
    );
  exception when others then
    stale_denied := true;
  end;
  if not stale_denied then
    raise exception 'Revoked assignment authorized a stale mutation';
  end if;

  begin
    perform public.publish_plan_to_class(
      '30000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000005',
      staff_assignment_id,
      '[{"title":"Stale plan"}]'::jsonb
    );
  exception when others then
    stale_plan_denied := true;
  end;
  begin
    perform public.update_student_experience_for_staff(
      '20000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000007',
      '10000000-0000-4000-8000-000000000005',
      staff_assignment_id,
      2::smallint,
      false
    );
  exception when others then
    stale_support_denied := true;
  end;
  begin
    perform public.resolve_student_help(
      revoked_help_id,
      '10000000-0000-4000-8000-000000000005',
      staff_assignment_id
    );
  exception when others then
    stale_help_denied := true;
  end;
  if not stale_plan_denied or not stale_support_denied or not stale_help_denied then
    raise exception 'Revoked assignment remained usable in plan, support, or help RPC';
  end if;

  perform public.revoke_staff_assignment(
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    first_retry_id
  );
  update public.memberships
  set role = 'student'
  where organization_id = '20000000-0000-4000-8000-000000000001'
    and user_id = '10000000-0000-4000-8000-000000000005';
  if not exists (
    select 1
    from public.memberships
    where organization_id = '20000000-0000-4000-8000-000000000001'
      and user_id = '10000000-0000-4000-8000-000000000005'
      and role = 'student'
  ) then
    raise exception 'Adult demotion did not succeed after every active assignment was revoked';
  end if;
  if (
    select count(*)
    from public.staff_assignments
    where id in (staff_assignment_id, first_retry_id)
      and revoked_at is not null
  ) <> 2 then
    raise exception 'Historical assignments were deleted or remained authorizing after demotion';
  end if;
end;
$$;

reset role;
do $$
declare
  revoked_help_id uuid;
  denial_message text;
begin
  select request.id into revoked_help_id
  from public.help_requests as request
  where request.claimed_by = '10000000-0000-4000-8000-000000000005'
    and request.status = 'claimed';
  if revoked_help_id is null then
    raise exception 'Revoked-help trigger fixture was not left claimed';
  end if;

  begin
    update public.help_requests
    set status = 'resolved',
        resolved_at = transaction_timestamp()
    where id = revoked_help_id;
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from
    'Help request staff transitions require an active staff assignment'
  then
    raise exception 'Revoked claimant resolution was not rejected correctly: %', denial_message;
  end if;

  update public.help_requests
  set status = 'cancelled'
  where id = revoked_help_id;
  insert into public.help_requests (
    id,
    organization_id,
    class_id,
    student_id
  ) values (
    '70000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000007'
  );

  denial_message := null;
  begin
    update public.help_requests
    set status = 'resolved',
        resolved_at = transaction_timestamp(),
        claimed_by = null
    where id = '70000000-0000-4000-8000-000000000002';
  exception when others then
    get stacked diagnostics denial_message = message_text;
  end;
  if denial_message is distinct from
    'Help request staff transitions require an active staff assignment'
  then
    raise exception 'Null-claimant resolution was not rejected correctly: %', denial_message;
  end if;
end;
$$;

rollback;
