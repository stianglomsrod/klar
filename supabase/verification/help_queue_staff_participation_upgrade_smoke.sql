\set ON_ERROR_STOP on

do $$
declare
  queue_row public.help_queue_sessions;
  snapshot jsonb;
begin
  select queue.*
  into queue_row
  from public.help_queue_sessions as queue
  where queue.organization_id = '82000000-0000-4000-8000-000000000001'
    and queue.class_id = '83000000-0000-4000-8000-000000000002'
    and queue.status = 'open'
  order by queue.opened_at desc, queue.id
  limit 1;
  if queue_row.id is null then
    raise exception 'Participation upgrade smoke cannot find the legacy open queue';
  end if;

  snapshot := public.read_help_queue_staff_snapshot_v2(
    queue_row.organization_id,
    queue_row.class_id,
    queue_row.id
  );
  if jsonb_array_length(snapshot -> 'participant_rows') <> 1
    or not exists (
      select 1
      from public.help_queue_staff_participants as participant
      join public.staff_assignments as assignment
        on assignment.id = participant.staff_assignment_id
       and assignment.organization_id = participant.organization_id
       and assignment.user_id = participant.user_id
      where participant.queue_session_id = queue_row.id
        and participant.user_id = '81000000-0000-4000-8000-000000000001'
        and participant.left_at is null
    )
    or exists (
      select 1
      from public.help_queue_staff_participants as participant
      where participant.queue_session_id = queue_row.id
        and participant.user_id = '81000000-0000-4000-8000-000000000003'
        and participant.left_at is null
    )
  then
    raise exception 'Open legacy queue did not preserve only its currently authorized active claimant';
  end if;
end;
$$;
