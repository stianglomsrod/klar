begin;

create function public.publish_plan_to_class(
  p_class_id uuid,
  p_actor_id uuid,
  p_tasks jsonb
)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  task_item jsonb;
  published_ids uuid[] := '{}';
  published_id uuid;
begin
  if jsonb_typeof(p_tasks) <> 'array' then
    raise exception 'Imported tasks must be a JSON array';
  end if;

  if jsonb_array_length(p_tasks) < 1 or jsonb_array_length(p_tasks) > 50 then
    raise exception 'Imported plan must contain between 1 and 50 tasks';
  end if;

  for task_item in
    select value from jsonb_array_elements(p_tasks)
  loop
    published_id := public.publish_task_to_class(
      p_class_id,
      p_actor_id,
      task_item ->> 'title',
      task_item ->> 'description',
      task_item ->> 'subject',
      case
        when jsonb_typeof(task_item -> 'estimated_minutes') = 'number'
          then (task_item ->> 'estimated_minutes')::smallint
        else null
      end,
      case
        when jsonb_typeof(task_item -> 'support_level') = 'number'
          then (task_item ->> 'support_level')::smallint
        else 2::smallint
      end
    );
    published_ids := array_append(published_ids, published_id);
  end loop;

  return published_ids;
end;
$$;

revoke all on function public.publish_plan_to_class(uuid, uuid, jsonb)
from public, anon, authenticated;
grant execute on function public.publish_plan_to_class(uuid, uuid, jsonb)
to service_role;

commit;
