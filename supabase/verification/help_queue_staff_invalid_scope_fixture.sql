\set ON_ERROR_STOP on

insert into public.help_queue_signals (
  id,
  organization_id,
  class_id,
  queue_session_id,
  student_id,
  signal_version
)
select
  'e2850000-0000-4000-8000-000000000001',
  '82000000-0000-4000-8000-000000000002',
  '83000000-0000-4000-8000-000000000004',
  queue.id,
  '81000000-0000-4000-8000-000000000006',
  1
from public.help_queue_sessions as queue
where queue.class_id = '83000000-0000-4000-8000-000000000002'
  and queue.status = 'open'
order by queue.opened_at desc, queue.id
limit 1;

do $$
begin
  if not exists (
    select 1
    from public.help_queue_signals as signal
    join public.help_queue_sessions as queue
      on queue.id = signal.queue_session_id
    where signal.id = 'e2850000-0000-4000-8000-000000000001'
      and signal.organization_id is distinct from queue.organization_id
      and signal.class_id is distinct from queue.class_id
  ) then
    raise exception 'Invalid E2 scope fixture was not established';
  end if;
end;
$$;
