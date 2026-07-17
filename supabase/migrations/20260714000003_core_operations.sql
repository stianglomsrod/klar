begin;

create function public.create_class_for_teacher(
  p_organization_id uuid,
  p_actor_id uuid,
  p_name text,
  p_academic_year text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_class_id uuid;
begin
  if not exists (
    select 1
    from public.memberships as membership
    where membership.organization_id = p_organization_id
      and membership.user_id = p_actor_id
      and membership.role in ('owner', 'teacher')
  ) then
    raise exception 'Actor is not an owner or teacher in the organization';
  end if;

  insert into public.classes (
    organization_id,
    name,
    academic_year,
    created_by
  ) values (
    p_organization_id,
    trim(p_name),
    nullif(trim(p_academic_year), ''),
    p_actor_id
  )
  returning id into new_class_id;

  insert into public.class_memberships (
    class_id,
    organization_id,
    user_id,
    role,
    created_by
  ) values (
    new_class_id,
    p_organization_id,
    p_actor_id,
    'teacher',
    p_actor_id
  );

  insert into public.audit_events (
    organization_id,
    actor_id,
    event_name,
    entity_type,
    entity_id,
    metadata
  ) values (
    p_organization_id,
    p_actor_id,
    'class.created',
    'class',
    new_class_id,
    jsonb_build_object('academic_year', p_academic_year)
  );

  return new_class_id;
end;
$$;

create function public.publish_task_to_class(
  p_class_id uuid,
  p_actor_id uuid,
  p_title text,
  p_description text default null,
  p_subject text default null,
  p_estimated_minutes smallint default null,
  p_support_level smallint default 2,
  p_due_at timestamptz default null,
  p_visible_from timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_organization_id uuid;
  new_task_id uuid;
begin
  select class_membership.organization_id
  into target_organization_id
  from public.class_memberships as class_membership
  where class_membership.class_id = p_class_id
    and class_membership.user_id = p_actor_id
    and class_membership.role = 'teacher';

  if target_organization_id is null then
    raise exception 'Actor is not a teacher in the target class';
  end if;

  insert into public.task_definitions (
    organization_id,
    class_id,
    title,
    description,
    subject,
    estimated_minutes,
    support_level,
    publication_status,
    created_by,
    published_at
  ) values (
    target_organization_id,
    p_class_id,
    trim(p_title),
    nullif(trim(p_description), ''),
    nullif(trim(p_subject), ''),
    p_estimated_minutes,
    p_support_level,
    'published',
    p_actor_id,
    now()
  )
  returning id into new_task_id;

  insert into public.task_assignments (
    organization_id,
    class_id,
    task_definition_id,
    student_id,
    assigned_by,
    visible_from,
    due_at
  )
  select
    target_organization_id,
    p_class_id,
    new_task_id,
    class_membership.user_id,
    p_actor_id,
    p_visible_from,
    p_due_at
  from public.class_memberships as class_membership
  where class_membership.class_id = p_class_id
    and class_membership.organization_id = target_organization_id
    and class_membership.role = 'student';

  insert into public.student_task_state (
    assignment_id,
    organization_id,
    student_id
  )
  select
    assignment.id,
    assignment.organization_id,
    assignment.student_id
  from public.task_assignments as assignment
  where assignment.task_definition_id = new_task_id;

  insert into public.audit_events (
    organization_id,
    actor_id,
    event_name,
    entity_type,
    entity_id,
    metadata
  ) values (
    target_organization_id,
    p_actor_id,
    'task.published',
    'task_definition',
    new_task_id,
    jsonb_build_object('class_id', p_class_id)
  );

  return new_task_id;
end;
$$;

create function public.update_student_task_status(
  p_assignment_id uuid,
  p_student_id uuid,
  p_status public.student_task_status
)
returns public.student_task_state
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_assignment public.task_assignments;
  updated_state public.student_task_state;
begin
  select assignment.*
  into target_assignment
  from public.task_assignments as assignment
  where assignment.id = p_assignment_id
    and assignment.student_id = p_student_id
    and assignment.visible_from <= now();

  if target_assignment.id is null then
    raise exception 'Assignment does not belong to the student';
  end if;

  insert into public.student_task_state (
    assignment_id,
    organization_id,
    student_id,
    status,
    started_at,
    completed_at
  ) values (
    target_assignment.id,
    target_assignment.organization_id,
    p_student_id,
    p_status,
    case when p_status = 'not_started' then null else now() end,
    case when p_status = 'completed' then now() else null end
  )
  on conflict (assignment_id) do update
  set
    status = excluded.status,
    started_at = case
      when excluded.status = 'not_started' then null
      else coalesce(public.student_task_state.started_at, now())
    end,
    completed_at = case
      when excluded.status = 'completed' then now()
      else null
    end
  returning * into updated_state;

  insert into public.audit_events (
    organization_id,
    actor_id,
    event_name,
    entity_type,
    entity_id,
    metadata
  ) values (
    target_assignment.organization_id,
    p_student_id,
    'task.status_changed',
    'task_assignment',
    target_assignment.id,
    jsonb_build_object(
      'class_id', target_assignment.class_id,
      'status', p_status,
      'task_definition_id', target_assignment.task_definition_id
    )
  );

  return updated_state;
end;
$$;

revoke all on function public.create_class_for_teacher(
  uuid,
  uuid,
  text,
  text
) from public, anon, authenticated;
revoke all on function public.publish_task_to_class(
  uuid,
  uuid,
  text,
  text,
  text,
  smallint,
  smallint,
  timestamptz,
  timestamptz
) from public, anon, authenticated;
revoke all on function public.update_student_task_status(
  uuid,
  uuid,
  public.student_task_status
) from public, anon, authenticated;

grant execute on function public.create_class_for_teacher(
  uuid,
  uuid,
  text,
  text
) to service_role;
grant execute on function public.publish_task_to_class(
  uuid,
  uuid,
  text,
  text,
  text,
  smallint,
  smallint,
  timestamptz,
  timestamptz
) to service_role;
grant execute on function public.update_student_task_status(
  uuid,
  uuid,
  public.student_task_status
) to service_role;

commit;
