\set ON_ERROR_STOP on

do $$
#variable_conflict use_variable
declare
  organization_id uuid := '82000000-0000-4000-8000-000000000001';
  class_id uuid := '83000000-0000-4000-8000-000000000002';
  first_student_id uuid := '81000000-0000-4000-8000-000000000004';
  second_student_id uuid := '81000000-0000-4000-8000-000000000007';
  historical_student_id uuid := '81000000-0000-4000-8000-000000000008';
  queue_id uuid;
  staff_snapshot jsonb;
begin
  select queue.id
  into queue_id
  from public.help_queue_sessions as queue
  where queue.class_id = class_id
    and queue.status = 'open'
  order by queue.opened_at desc, queue.id
  limit 1;
  if queue_id is null then
    raise exception 'E2 upgrade smoke cannot find the E1 queue';
  end if;

  if (
    select array_agg(order_row.position order by order_row.position)
    from public.help_queue_request_order as order_row
    where order_row.queue_session_id = queue_id
      and order_row.active
  ) is distinct from array[1, 2]
  then
    raise exception 'E2 did not backfill a compact active order';
  end if;

  staff_snapshot := public.read_help_queue_staff_snapshot_v1(
    organization_id,
    class_id,
    queue_id
  );
  if staff_snapshot #>> '{queue,id}' is distinct from queue_id::text
    or jsonb_array_length(staff_snapshot -> 'order_rows') <> 2
    or jsonb_array_length(staff_snapshot -> 'request_rows') <> 2
  then
    raise exception 'E2 snapshot did not expose the upgraded active order atomically';
  end if;

  if not exists (
    select 1
    from public.help_requests as request
    join public.help_queue_request_order as order_row
      on order_row.request_id = request.id
     and order_row.queue_session_id = request.queue_session_id
    where request.queue_session_id = queue_id
      and request.student_id = first_student_id
      and request.status = 'waiting'
      and request.ownership_version = 1
      and request.ownership_changed_at is null
      and request.claimed_by is null
      and request.claimed_at is null
      and order_row.position = 1
      and order_row.active
      and order_row.last_changed_by is null
      and order_row.last_changed_at is null
      and order_row.last_reason_code is null
  ) then
    raise exception 'E2 waiting-row backfill is incomplete';
  end if;

  if not exists (
    select 1
    from public.help_requests as request
    join public.help_queue_request_order as order_row
      on order_row.request_id = request.id
     and order_row.queue_session_id = request.queue_session_id
    where request.queue_session_id = queue_id
      and request.student_id = second_student_id
      and request.status = 'claimed'
      and request.ownership_version = 1
      and request.claimed_by = '81000000-0000-4000-8000-000000000003'
      and request.ownership_changed_at = request.claimed_at
      and request.claimed_at = request.requested_at + interval '30 seconds'
      and order_row.position = 2
      and order_row.active
  ) then
    raise exception 'E2 claimed-row ownership backfill is incomplete';
  end if;

  if exists (
    select 1
    from public.help_requests as request
    join public.help_queue_request_order as order_row
      on order_row.request_id = request.id
    where request.queue_session_id = queue_id
      and request.student_id = historical_student_id
      and order_row.active
  ) or not exists (
    select 1
    from public.help_requests as request
    where request.queue_session_id = queue_id
      and request.student_id = historical_student_id
      and request.status = 'cancelled'
      and request.ownership_version = 1
  ) then
    raise exception 'E2 incorrectly activated a terminal E1 request';
  end if;

  if exists (
    select 1
    from public.help_queue_signals as signal
    where signal.queue_session_id = queue_id
      and signal.staff_only
  ) or (
    select count(*)
    from public.help_queue_signals as signal
    where signal.queue_session_id = queue_id
      and not signal.staff_only
  ) <> 3
  then
    raise exception 'E2 changed the visibility of existing student signals';
  end if;
end;
$$;
