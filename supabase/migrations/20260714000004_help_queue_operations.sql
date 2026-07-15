begin;

create function public.expire_help_requests()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_rows integer;
begin
  update public.help_requests
  set status = 'expired'
  where status in ('waiting', 'claimed')
    and expires_at <= now();

  get diagnostics affected_rows = row_count;
  return affected_rows;
end;
$$;

create function public.request_student_help(
  p_class_id uuid,
  p_student_id uuid,
  p_task_assignment_id uuid default null
)
returns public.help_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_organization_id uuid;
  active_request public.help_requests;
begin
  perform public.expire_help_requests();

  select class_membership.organization_id
  into target_organization_id
  from public.class_memberships as class_membership
  where class_membership.class_id = p_class_id
    and class_membership.user_id = p_student_id
    and class_membership.role = 'student';

  if target_organization_id is null then
    raise exception 'Student is not a member of the target class';
  end if;

  if p_task_assignment_id is not null and not exists (
    select 1
    from public.task_assignments as assignment
    where assignment.id = p_task_assignment_id
      and assignment.class_id = p_class_id
      and assignment.student_id = p_student_id
  ) then
    raise exception 'Task assignment does not belong to the student and class';
  end if;

  select request.*
  into active_request
  from public.help_requests as request
  where request.organization_id = target_organization_id
    and request.student_id = p_student_id
    and request.status in ('waiting', 'claimed')
  order by request.requested_at desc
  limit 1;

  if active_request.id is not null then
    return active_request;
  end if;

  begin
    insert into public.help_requests (
      organization_id,
      class_id,
      student_id,
      task_assignment_id
    ) values (
      target_organization_id,
      p_class_id,
      p_student_id,
      p_task_assignment_id
    )
    returning * into active_request;
  exception
    when unique_violation then
      select request.*
      into active_request
      from public.help_requests as request
      where request.organization_id = target_organization_id
        and request.student_id = p_student_id
        and request.status in ('waiting', 'claimed')
      order by request.requested_at desc
      limit 1;
  end;

  insert into public.audit_events (
    organization_id,
    actor_id,
    event_name,
    entity_type,
    entity_id,
    metadata
  ) values (
    target_organization_id,
    p_student_id,
    'help.requested',
    'help_request',
    active_request.id,
    jsonb_build_object(
      'class_id', p_class_id,
      'task_assignment_id', p_task_assignment_id
    )
  );

  return active_request;
end;
$$;

create function public.cancel_student_help(
  p_request_id uuid,
  p_student_id uuid
)
returns public.help_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  cancelled_request public.help_requests;
begin
  update public.help_requests
  set
    status = 'cancelled',
    resolved_at = now()
  where id = p_request_id
    and student_id = p_student_id
    and status in ('waiting', 'claimed')
  returning * into cancelled_request;

  if cancelled_request.id is null then
    raise exception 'Active help request does not belong to the student';
  end if;

  insert into public.audit_events (
    organization_id,
    actor_id,
    event_name,
    entity_type,
    entity_id,
    metadata
  ) values (
    cancelled_request.organization_id,
    p_student_id,
    'help.cancelled',
    'help_request',
    cancelled_request.id,
    jsonb_build_object('class_id', cancelled_request.class_id)
  );

  return cancelled_request;
end;
$$;

create function public.claim_student_help(
  p_request_id uuid,
  p_teacher_id uuid
)
returns public.help_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_request public.help_requests;
begin
  perform public.expire_help_requests();

  select request.*
  into target_request
  from public.help_requests as request
  where request.id = p_request_id;

  if target_request.id is null then
    raise exception 'Help request was not found';
  end if;

  if not exists (
    select 1
    from public.class_memberships as class_membership
    where class_membership.class_id = target_request.class_id
      and class_membership.user_id = p_teacher_id
      and class_membership.role = 'teacher'
  ) then
    raise exception 'Teacher is not assigned to the request class';
  end if;

  if target_request.status = 'claimed'
    and target_request.claimed_by = p_teacher_id then
    return target_request;
  end if;

  update public.help_requests
  set
    status = 'claimed',
    claimed_by = p_teacher_id,
    claimed_at = now()
  where id = p_request_id
    and status = 'waiting'
  returning * into target_request;

  if target_request.id is null then
    raise exception 'Help request is no longer waiting';
  end if;

  insert into public.audit_events (
    organization_id,
    actor_id,
    event_name,
    entity_type,
    entity_id,
    metadata
  ) values (
    target_request.organization_id,
    p_teacher_id,
    'help.claimed',
    'help_request',
    target_request.id,
    jsonb_build_object('class_id', target_request.class_id)
  );

  return target_request;
end;
$$;

create function public.resolve_student_help(
  p_request_id uuid,
  p_teacher_id uuid
)
returns public.help_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_request public.help_requests;
begin
  update public.help_requests
  set
    status = 'resolved',
    resolved_at = now()
  where id = p_request_id
    and claimed_by = p_teacher_id
    and status = 'claimed'
  returning * into resolved_request;

  if resolved_request.id is null then
    raise exception 'Teacher must claim the active request before resolving it';
  end if;

  insert into public.audit_events (
    organization_id,
    actor_id,
    event_name,
    entity_type,
    entity_id,
    metadata
  ) values (
    resolved_request.organization_id,
    p_teacher_id,
    'help.resolved',
    'help_request',
    resolved_request.id,
    jsonb_build_object('class_id', resolved_request.class_id)
  );

  return resolved_request;
end;
$$;

revoke all on function public.expire_help_requests()
from public, anon, authenticated;
revoke all on function public.request_student_help(uuid, uuid, uuid)
from public, anon, authenticated;
revoke all on function public.cancel_student_help(uuid, uuid)
from public, anon, authenticated;
revoke all on function public.claim_student_help(uuid, uuid)
from public, anon, authenticated;
revoke all on function public.resolve_student_help(uuid, uuid)
from public, anon, authenticated;

grant execute on function public.expire_help_requests() to service_role;
grant execute on function public.request_student_help(uuid, uuid, uuid)
to service_role;
grant execute on function public.cancel_student_help(uuid, uuid) to service_role;
grant execute on function public.claim_student_help(uuid, uuid) to service_role;
grant execute on function public.resolve_student_help(uuid, uuid) to service_role;

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    alter publication supabase_realtime add table public.help_requests;
  end if;
end;
$$;

commit;
