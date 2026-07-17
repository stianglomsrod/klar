begin;

create function public.get_my_student_task_catalog_v1(
  p_organization_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  reference_at timestamptz := transaction_timestamp();
begin
  if caller_id is null then
    raise exception 'Student session is required';
  end if;

  if p_organization_id is null or not exists (
    select 1
    from public.memberships as membership
    where membership.organization_id = p_organization_id
      and membership.user_id = caller_id
      and membership.role = 'student'
  ) then
    raise exception 'Student membership is required';
  end if;

  return jsonb_build_object(
    'reference_at', reference_at,
    'tasks', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'assignment_id', assignment.id,
          'title', definition.title,
          'description', definition.description,
          'subject', definition.subject,
          'estimated_minutes', definition.estimated_minutes,
          'support_level', definition.support_level,
          'points_value', assignment.points_value_snapshot,
          'status', state.status,
          'state_version', state.state_version,
          'schedule_version', assignment.schedule_version,
          'reopen_message', case
            when state.status <> 'reopened' then null
            else coalesce(
              nullif(btrim(reopen_transition.student_message), ''),
              case reopen_transition.reason_code
                when 'continue_working' then 'Jobb litt videre med oppgaven.'
                when 'completed_by_mistake' then 'Oppgaven ble markert ferdig ved en feil.'
                when 'needs_review' then 'Se på oppgaven én gang til.'
                else 'Oppgaven er åpnet igjen. Du kan jobbe videre.'
              end
            )
          end,
          'visible_from', assignment.visible_from,
          'due_at', assignment.due_at
        )
        order by
          case state.status
            when 'reopened' then 0
            when 'assigned' then 1
            else 2
          end,
          lower(coalesce(nullif(btrim(definition.subject), ''), 'Andre oppgaver')),
          assignment.visible_from,
          definition.position,
          assignment.id
      )
      from public.task_assignments as assignment
      join public.memberships as membership
        on membership.organization_id = assignment.organization_id
       and membership.user_id = assignment.student_id
       and membership.role = 'student'
      join public.class_memberships as class_membership
        on class_membership.organization_id = assignment.organization_id
       and class_membership.class_id = assignment.class_id
       and class_membership.user_id = assignment.student_id
       and class_membership.role = 'student'
      join public.task_definitions as definition
        on definition.id = assignment.task_definition_id
       and definition.organization_id = assignment.organization_id
       and definition.class_id = assignment.class_id
       and definition.publication_status = 'published'
      join public.student_task_state as state
        on state.assignment_id = assignment.id
       and state.organization_id = assignment.organization_id
       and state.student_id = assignment.student_id
      left join public.task_state_transitions as reopen_transition
        on reopen_transition.id = state.last_transition_id
       and reopen_transition.organization_id = assignment.organization_id
       and reopen_transition.assignment_id = assignment.id
       and reopen_transition.student_id = assignment.student_id
      where assignment.organization_id = p_organization_id
        and assignment.student_id = caller_id
        and assignment.visible_from <= reference_at
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_my_student_task_catalog_v1(uuid)
from public, anon, authenticated, service_role;

grant execute on function public.get_my_student_task_catalog_v1(uuid)
to authenticated;

commit;
