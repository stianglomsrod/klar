begin;

alter table public.help_queue_command_receipts
  drop constraint help_queue_command_receipts_command,
  add constraint help_queue_command_receipts_command check (
    command in (
      'open_queue',
      'close_queue',
      'join_queue',
      'leave_queue',
      'request_help',
      'cancel_help',
      'claim_help',
      'resolve_help',
      'reorder_help',
      'release_help',
      'transfer_help'
    )
  );

create table public.help_queue_staff_participants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  class_id uuid not null,
  queue_session_id uuid not null,
  user_id uuid not null references auth.users (id) on delete restrict,
  staff_assignment_id uuid not null,
  joined_at timestamptz not null default transaction_timestamp(),
  left_at timestamptz,
  leave_reason text,
  participation_version bigint not null default 1,
  updated_at timestamptz not null default transaction_timestamp(),
  unique (queue_session_id, user_id),
  foreign key (queue_session_id, organization_id, class_id)
    references public.help_queue_sessions (id, organization_id, class_id)
    on delete restrict,
  foreign key (staff_assignment_id, organization_id)
    references public.staff_assignments (id, organization_id)
    on delete restrict,
  foreign key (staff_assignment_id, organization_id, user_id)
    references public.staff_assignments (id, organization_id, user_id)
    on delete restrict,
  constraint help_queue_staff_participants_version
    check (participation_version >= 1),
  constraint help_queue_staff_participants_lifecycle check (
    (left_at is null and leave_reason is null)
    or (
      left_at is not null
      and left_at >= joined_at
      and leave_reason in (
        'voluntary',
        'queue_closed',
        'assignment_inactive'
      )
    )
  ),
  constraint help_queue_staff_participants_updated_at
    check (updated_at >= joined_at)
);

create index help_queue_staff_participants_active_idx
  on public.help_queue_staff_participants (
    queue_session_id,
    staff_assignment_id,
    user_id
  )
  where left_at is null;

alter table public.help_queue_staff_participants enable row level security;
alter table public.help_queue_staff_participants force row level security;
revoke all on table public.help_queue_staff_participants
from public, anon, authenticated, service_role;
grant select on table public.help_queue_staff_participants to service_role;

create function public.is_active_help_queue_staff_participant_v1(
  p_queue_session_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.help_queue_staff_participants as participant
      where participant.queue_session_id = p_queue_session_id
        and participant.user_id = auth.uid()
        and participant.left_at is null
    );
$$;

revoke all on function public.is_active_help_queue_staff_participant_v1(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.is_active_help_queue_staff_participant_v1(uuid)
to authenticated;

drop policy help_queue_signals_select_authorized
on public.help_queue_signals;
create policy help_queue_signals_select_authorized
on public.help_queue_signals
for select
to authenticated
using (
  (
    not staff_only
    and student_id = auth.uid()
    and exists (
      select 1
      from public.class_memberships as class_membership
      join public.memberships as organization_membership
        on organization_membership.organization_id =
          class_membership.organization_id
       and organization_membership.user_id = class_membership.user_id
       and organization_membership.role = 'student'
      where class_membership.organization_id =
          help_queue_signals.organization_id
        and class_membership.class_id = help_queue_signals.class_id
        and class_membership.user_id = auth.uid()
        and class_membership.role = 'student'
    )
  )
  or (
    public.has_active_staff_capability(
      help_queue_signals.class_id,
      'help_queue.manage'
    )
    and (
      not staff_only
      or (
        queue_session_id is not null
        and public.is_active_help_queue_staff_participant_v1(
          queue_session_id
        )
      )
    )
  )
);

insert into public.help_queue_staff_participants (
  organization_id,
  class_id,
  queue_session_id,
  user_id,
  staff_assignment_id,
  joined_at
)
select distinct on (queue.id)
  queue.organization_id,
  queue.class_id,
  queue.id,
  event.actor_id,
  current_assignment.id,
  greatest(queue.opened_at, event.occurred_at)
from public.help_queue_sessions as queue
join public.audit_events as event
  on event.organization_id = queue.organization_id
 and event.entity_id = queue.id
 and event.event_name = 'help_queue.opened'
 and event.actor_id is not null
 and event.authorizing_staff_assignment_id is not null
join public.staff_assignments as opening_assignment
  on opening_assignment.id = event.authorizing_staff_assignment_id
 and opening_assignment.organization_id = queue.organization_id
 and opening_assignment.user_id = event.actor_id
cross join lateral (
  select assignment.id
  from public.staff_assignments as assignment
  join public.memberships as membership
    on membership.organization_id = assignment.organization_id
   and membership.user_id = assignment.user_id
   and membership.role in ('owner', 'teacher')
  join public.staff_assignment_class_scopes as scope
    on scope.assignment_id = assignment.id
   and scope.organization_id = assignment.organization_id
   and scope.class_id = queue.class_id
  join public.staff_assignment_capabilities as capability
    on capability.assignment_id = assignment.id
   and capability.profile_version = assignment.profile_version
   and capability.capability = 'help_queue.manage'
  where assignment.organization_id = queue.organization_id
    and assignment.user_id = event.actor_id
    and assignment.revoked_at is null
    and assignment.starts_at <= transaction_timestamp()
    and (
      assignment.ends_at is null
      or transaction_timestamp() < assignment.ends_at
    )
  order by assignment.starts_at desc, assignment.id
  limit 1
) as current_assignment
where queue.status in ('open', 'closing')
order by queue.id, event.occurred_at, event.id
on conflict (queue_session_id, user_id) do nothing;

insert into public.help_queue_staff_participants (
  organization_id,
  class_id,
  queue_session_id,
  user_id,
  staff_assignment_id,
  joined_at
)
select
  queue.organization_id,
  queue.class_id,
  queue.id,
  request.claimed_by,
  current_assignment.id,
  greatest(
    queue.opened_at,
    coalesce(request.claimed_at, request.requested_at)
  )
from public.help_queue_sessions as queue
join public.help_requests as request
  on request.queue_session_id = queue.id
 and request.organization_id = queue.organization_id
 and request.class_id = queue.class_id
 and request.status = 'claimed'
 and request.claimed_by is not null
cross join lateral (
  select assignment.id
  from public.staff_assignments as assignment
  join public.memberships as membership
    on membership.organization_id = assignment.organization_id
   and membership.user_id = assignment.user_id
   and membership.role in ('owner', 'teacher')
  join public.staff_assignment_class_scopes as scope
    on scope.assignment_id = assignment.id
   and scope.organization_id = assignment.organization_id
   and scope.class_id = queue.class_id
  join public.staff_assignment_capabilities as capability
    on capability.assignment_id = assignment.id
   and capability.profile_version = assignment.profile_version
   and capability.capability = 'help_queue.manage'
  where assignment.organization_id = queue.organization_id
    and assignment.user_id = request.claimed_by
    and assignment.revoked_at is null
    and assignment.starts_at <= transaction_timestamp()
    and (
      assignment.ends_at is null
      or transaction_timestamp() < assignment.ends_at
    )
  order by assignment.starts_at desc, assignment.id
  limit 1
) as current_assignment
where queue.status in ('open', 'closing')
on conflict (queue_session_id, user_id) do nothing;

create function public.help_queue_participation_result(
  p_queue public.help_queue_sessions,
  p_actor_id uuid,
  p_changed boolean
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.help_queue_result(p_queue, p_changed)
    || jsonb_build_object(
      'participating', exists (
        select 1
        from public.help_queue_staff_participants as participant
        where participant.queue_session_id = p_queue.id
          and participant.user_id = p_actor_id
          and participant.left_at is null
      ),
      'participant_count', (
        select count(*)::integer
        from public.help_queue_staff_participants as participant
        where participant.queue_session_id = p_queue.id
          and participant.left_at is null
      )
    );
$$;

create function public.assert_active_help_queue_participant(
  p_queue_session_id uuid,
  p_actor_id uuid,
  p_staff_assignment_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  participant_id uuid;
begin
  select participant.id
  into participant_id
  from public.help_queue_staff_participants as participant
  where participant.queue_session_id = p_queue_session_id
    and participant.user_id = p_actor_id
    and participant.left_at is null
  for share;
  if participant_id is null then
    raise exception 'Staff member is not an active help queue participant';
  end if;
end;
$$;

create function public.retire_help_queue_staff_participants_v1(
  p_class_id uuid default null
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  queue_row public.help_queue_sessions;
  participant_row public.help_queue_staff_participants;
  changed_count integer := 0;
  participant_changed boolean;
begin
  for queue_row in
    select queue.*
    from public.help_queue_sessions as queue
    where (p_class_id is null or queue.class_id = p_class_id)
      and (
        queue.status in ('open', 'closing')
        or exists (
          select 1
          from public.help_queue_staff_participants as participant
          where participant.queue_session_id = queue.id
            and participant.left_at is null
        )
      )
    order by queue.class_id, queue.id
  loop
    participant_changed := false;
    perform pg_advisory_xact_lock(
      hashtextextended(
        'klar.help-queue-class:' || queue_row.class_id::text,
        0
      )
    );
    select queue.*
    into queue_row
    from public.help_queue_sessions as queue
    where queue.id = queue_row.id
    for update;

    for participant_row in
      select participant.*
      from public.help_queue_staff_participants as participant
      where participant.queue_session_id = queue_row.id
        and participant.left_at is null
        and (
          queue_row.status = 'closed'
          or not exists (
            select 1
            from public.staff_assignments as assignment
            join public.memberships as membership
              on membership.organization_id = assignment.organization_id
             and membership.user_id = assignment.user_id
             and membership.role in ('owner', 'teacher')
            join public.staff_assignment_class_scopes as scope
              on scope.assignment_id = assignment.id
             and scope.organization_id = assignment.organization_id
             and scope.class_id = queue_row.class_id
            join public.staff_assignment_capabilities as capability
              on capability.assignment_id = assignment.id
             and capability.profile_version = assignment.profile_version
             and capability.capability = 'help_queue.manage'
            where assignment.organization_id = participant.organization_id
              and assignment.user_id = participant.user_id
              and assignment.revoked_at is null
              and assignment.starts_at <= transaction_timestamp()
              and (
                assignment.ends_at is null
                or transaction_timestamp() < assignment.ends_at
              )
          )
        )
      order by participant.id
      for update
    loop
      update public.help_queue_staff_participants
      set left_at = greatest(joined_at, clock_timestamp()),
          leave_reason = case
            when queue_row.status = 'closed' then 'queue_closed'
            else 'assignment_inactive'
          end,
          participation_version = participation_version + 1,
          updated_at = greatest(updated_at, clock_timestamp())
      where id = participant_row.id;

      insert into public.audit_events (
        organization_id,
        actor_id,
        event_name,
        entity_type,
        entity_id,
        metadata
      ) values (
        participant_row.organization_id,
        null,
        'help_queue.staff_left',
        'help_queue_staff_participant',
        participant_row.id,
        jsonb_build_object(
          'class_id', participant_row.class_id,
          'queue_session_id', participant_row.queue_session_id,
          'staff_assignment_id', participant_row.staff_assignment_id,
          'reason', case
            when queue_row.status = 'closed' then 'queue_closed'
            else 'assignment_inactive'
          end
        )
      );
      changed_count := changed_count + 1;
      participant_changed := true;
    end loop;

    if participant_changed and queue_row.status <> 'closed' then
      perform public.touch_help_queue_staff_activity(queue_row.id);
      select queue.* into queue_row
      from public.help_queue_sessions as queue
      where queue.id = queue_row.id;
    end if;

    if queue_row.status = 'open'
      and not exists (
        select 1
        from public.help_queue_staff_participants as participant
        where participant.queue_session_id = queue_row.id
          and participant.left_at is null
      )
    then
      update public.help_queue_sessions
      set status = 'closing',
          lock_version = lock_version + 1,
          activity_version = activity_version + 1,
          closing_started_at = greatest(opened_at, clock_timestamp()),
          updated_at = greatest(updated_at, clock_timestamp())
      where id = queue_row.id
      returning * into queue_row;
      perform public.touch_help_queue_signal(queue_row.id, null);

      insert into public.audit_events (
        organization_id,
        actor_id,
        event_name,
        entity_type,
        entity_id,
        metadata
      ) values (
        queue_row.organization_id,
        null,
        'help_queue.closing_started',
        'help_queue_session',
        queue_row.id,
        jsonb_build_object(
          'class_id', queue_row.class_id,
          'revision_session_id', queue_row.revision_session_id,
          'reason', 'no_active_staff',
          'lock_version', queue_row.lock_version
        )
      );
      changed_count := changed_count + 1;
    end if;
  end loop;

  return changed_count;
end;
$$;

alter function public.reconcile_help_queue_sessions(uuid)
rename to reconcile_help_queue_sessions_without_staff_participation;

revoke all on function public.reconcile_help_queue_sessions_without_staff_participation(
  uuid
) from public, anon, authenticated, service_role;

create function public.reconcile_help_queue_sessions(
  p_class_id uuid default null
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  changed_count integer := 0;
begin
  changed_count :=
    public.reconcile_help_queue_sessions_without_staff_participation(p_class_id);
  changed_count := changed_count
    + public.retire_help_queue_staff_participants_v1(p_class_id);
  changed_count := changed_count
    + public.reconcile_help_queue_sessions_without_staff_participation(p_class_id);
  return changed_count;
end;
$$;

create function public.reconcile_help_queue_staff_participants_v1(
  p_class_id uuid default null
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return public.reconcile_help_queue_sessions(p_class_id);
end;
$$;

alter function public.reconcile_expired_staff_assignments(uuid)
rename to reconcile_expired_staff_assignments_without_help_participation;

create function public.reconcile_expired_staff_assignments(
  p_organization_id uuid default null
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  affected_rows integer;
  target_class_id uuid;
begin
  affected_rows :=
    public.reconcile_expired_staff_assignments_without_help_participation(
      p_organization_id
    );

  for target_class_id in
    select distinct participant.class_id
    from public.help_queue_staff_participants as participant
    where participant.left_at is null
      and (
        p_organization_id is null
        or participant.organization_id = p_organization_id
      )
      and exists (
        select 1
        from public.staff_assignments as assignment
        join public.staff_assignment_class_scopes as scope
          on scope.assignment_id = assignment.id
         and scope.organization_id = assignment.organization_id
         and scope.class_id = participant.class_id
        where assignment.organization_id = participant.organization_id
          and assignment.user_id = participant.user_id
          and assignment.revoked_at is null
          and assignment.ends_at is not null
          and assignment.ends_at <= transaction_timestamp()
          and assignment.expiry_audited_at is not null
      )
    order by participant.class_id
  loop
    perform public.reconcile_help_queue_staff_participants_v1(target_class_id);
  end loop;
  return affected_rows;
end;
$$;

create or replace function public.reconcile_help_after_staff_revocation()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_class_id uuid;
begin
  if old.revoked_at is null and new.revoked_at is not null then
    for target_class_id in
      select scope.class_id
      from public.staff_assignment_class_scopes as scope
      where scope.assignment_id = new.id
        and scope.organization_id = new.organization_id
      order by scope.class_id
    loop
      perform public.reconcile_help_queue_staff_participants_v1(target_class_id);
    end loop;
  end if;
  return new;
end;
$$;

alter function public.terminalize_student_help_scope(
  uuid, uuid, uuid, text
) rename to terminalize_student_help_scope_without_participation;

create function public.terminalize_student_help_scope(
  p_organization_id uuid,
  p_class_id uuid,
  p_student_id uuid,
  p_reason text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.terminalize_student_help_scope_without_participation(
    p_organization_id,
    p_class_id,
    p_student_id,
    p_reason
  );
  perform public.retire_help_queue_staff_participants_v1(p_class_id);
end;
$$;

alter function public.cancel_student_help_v2(uuid, uuid, uuid)
rename to cancel_student_help_v2_without_participation;

create function public.cancel_student_help_v2(
  p_request_id uuid,
  p_student_id uuid,
  p_command_request_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  command_result jsonb;
  target_class_id uuid;
begin
  command_result := public.cancel_student_help_v2_without_participation(
    p_request_id,
    p_student_id,
    p_command_request_id
  );
  select request.class_id
  into target_class_id
  from public.help_requests as request
  where request.id = p_request_id
    and request.student_id = p_student_id;
  if target_class_id is not null then
    perform public.retire_help_queue_staff_participants_v1(target_class_id);
  end if;
  return command_result;
end;
$$;

alter function public.open_help_queue_session(
  uuid, uuid, uuid, uuid, uuid
) rename to open_help_queue_session_without_participation;

create function public.open_help_queue_session(
  p_class_id uuid,
  p_revision_session_id uuid,
  p_actor_id uuid,
  p_staff_assignment_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  authorized_organization_id uuid;
  fingerprint text;
  prior_result jsonb;
  command_result jsonb;
  queue_row public.help_queue_sessions;
  participant_id uuid;
  participant_changed boolean := false;
  queue_changed boolean := false;
begin
  authorized_organization_id := public.lock_staff_assignment_authorization(
    p_staff_assignment_id,
    p_actor_id,
    p_class_id,
    'help_queue.manage'
  );
  if authorized_organization_id is null then
    raise exception 'Staff assignment does not authorize help queue management';
  end if;
  fingerprint := md5(jsonb_build_object(
    'class_id', p_class_id,
    'revision_session_id', p_revision_session_id,
    'staff_assignment_id', p_staff_assignment_id
  )::text);
  prior_result := public.read_help_queue_command_receipt(
    p_actor_id,
    p_request_id,
    'open_queue',
    fingerprint
  );
  if prior_result is not null then
    return prior_result;
  end if;

  command_result := public.open_help_queue_session_without_participation(
    p_class_id,
    p_revision_session_id,
    p_actor_id,
    p_staff_assignment_id,
    p_request_id
  );
  queue_changed := coalesce((command_result ->> 'changed')::boolean, false);
  select queue.*
  into queue_row
  from public.help_queue_sessions as queue
  where queue.id = (command_result ->> 'queue_session_id')::uuid
  for update;

  insert into public.help_queue_staff_participants (
    organization_id,
    class_id,
    queue_session_id,
    user_id,
    staff_assignment_id
  ) values (
    queue_row.organization_id,
    queue_row.class_id,
    queue_row.id,
    p_actor_id,
    p_staff_assignment_id
  )
  on conflict (queue_session_id, user_id) do update
  set staff_assignment_id = excluded.staff_assignment_id,
      joined_at = greatest(
        public.help_queue_staff_participants.joined_at,
        transaction_timestamp()
      ),
      left_at = null,
      leave_reason = null,
      participation_version =
        public.help_queue_staff_participants.participation_version + 1,
      updated_at = greatest(
        public.help_queue_staff_participants.updated_at,
        clock_timestamp()
      )
  where public.help_queue_staff_participants.left_at is not null
  returning id into participant_id;
  participant_changed := participant_id is not null;

  if participant_changed then
    insert into public.audit_events (
      organization_id,
      actor_id,
      event_name,
      entity_type,
      entity_id,
      metadata,
      authorizing_staff_assignment_id,
      authorizing_capability
    ) values (
      queue_row.organization_id,
      p_actor_id,
      'help_queue.staff_joined',
      'help_queue_staff_participant',
      participant_id,
      jsonb_build_object(
        'class_id', queue_row.class_id,
        'queue_session_id', queue_row.id,
        'staff_assignment_id', p_staff_assignment_id,
        'reason', case
          when queue_changed then 'opened_queue'
          else 'joined_existing_queue'
        end
      ),
      p_staff_assignment_id,
      'help_queue.manage'
    );
    perform public.touch_help_queue_staff_activity(queue_row.id);
  end if;
  select queue.* into queue_row
  from public.help_queue_sessions as queue
  where queue.id = queue_row.id;
  command_result := public.help_queue_participation_result(
    queue_row,
    p_actor_id,
    queue_changed or participant_changed
  );
  update public.help_queue_command_receipts
  set result = command_result
  where actor_id = p_actor_id
    and request_id = p_request_id
    and command = 'open_queue'
    and request_fingerprint = fingerprint;
  return command_result;
end;
$$;

create function public.join_help_queue_staff_v1(
  p_queue_session_id uuid,
  p_actor_id uuid,
  p_staff_assignment_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  queue_row public.help_queue_sessions;
  authorized_organization_id uuid;
  fingerprint text;
  prior_result jsonb;
  command_result jsonb;
  result jsonb;
  participant_id uuid;
  changed boolean := false;
begin
  perform public.lock_help_queue_command(p_actor_id, p_request_id);
  select queue.*
  into queue_row
  from public.help_queue_sessions as queue
  where queue.id = p_queue_session_id;
  if queue_row.id is null then
    raise exception 'Help queue was not found';
  end if;
  authorized_organization_id := public.lock_staff_assignment_authorization(
    p_staff_assignment_id,
    p_actor_id,
    queue_row.class_id,
    'help_queue.manage'
  );
  if authorized_organization_id is distinct from queue_row.organization_id then
    raise exception 'Staff assignment does not authorize help queue management';
  end if;
  fingerprint := md5(jsonb_build_object(
    'queue_session_id', p_queue_session_id,
    'staff_assignment_id', p_staff_assignment_id
  )::text);
  prior_result := public.read_help_queue_command_receipt(
    p_actor_id,
    p_request_id,
    'join_queue',
    fingerprint
  );
  if prior_result is not null then
    return prior_result;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('klar.help-queue-class:' || queue_row.class_id::text, 0)
  );
  perform public.reconcile_help_queue_staff_participants_v1(queue_row.class_id);
  select queue.*
  into queue_row
  from public.help_queue_sessions as queue
  where queue.id = p_queue_session_id
  for update;
  if queue_row.status <> 'open'
    and not (
      queue_row.status = 'closing'
      and not exists (
        select 1
        from public.help_queue_staff_participants as participant
        where participant.queue_session_id = queue_row.id
          and participant.left_at is null
      )
      and exists (
        select 1
        from public.help_requests as request
        where request.queue_session_id = queue_row.id
          and request.status in ('waiting', 'claimed')
      )
    )
  then
    raise exception 'Help queue does not accept staff participants';
  end if;

  insert into public.help_queue_staff_participants (
    organization_id,
    class_id,
    queue_session_id,
    user_id,
    staff_assignment_id
  ) values (
    queue_row.organization_id,
    queue_row.class_id,
    queue_row.id,
    p_actor_id,
    p_staff_assignment_id
  )
  on conflict (queue_session_id, user_id) do update
  set staff_assignment_id = excluded.staff_assignment_id,
      joined_at = greatest(
        public.help_queue_staff_participants.joined_at,
        transaction_timestamp()
      ),
      left_at = null,
      leave_reason = null,
      participation_version =
        public.help_queue_staff_participants.participation_version + 1,
      updated_at = greatest(
        public.help_queue_staff_participants.updated_at,
        clock_timestamp()
      )
  where public.help_queue_staff_participants.left_at is not null
  returning id into participant_id;
  changed := participant_id is not null;
  if changed then
    insert into public.audit_events (
      organization_id,
      actor_id,
      event_name,
      entity_type,
      entity_id,
      metadata,
      authorizing_staff_assignment_id,
      authorizing_capability
    ) values (
      queue_row.organization_id,
      p_actor_id,
      'help_queue.staff_joined',
      'help_queue_staff_participant',
      participant_id,
      jsonb_build_object(
        'class_id', queue_row.class_id,
        'queue_session_id', queue_row.id,
        'staff_assignment_id', p_staff_assignment_id,
        'reason', 'joined_existing_queue'
      ),
      p_staff_assignment_id,
      'help_queue.manage'
    );
    perform public.touch_help_queue_staff_activity(queue_row.id);
    select queue.* into queue_row
    from public.help_queue_sessions as queue
    where queue.id = p_queue_session_id;
  end if;
  result := public.help_queue_participation_result(
    queue_row,
    p_actor_id,
    changed
  );
  perform public.store_help_queue_command_receipt(
    queue_row.organization_id,
    p_actor_id,
    p_request_id,
    'join_queue',
    fingerprint,
    queue_row.id,
    result
  );
  return result;
end;
$$;

create function public.leave_help_queue_staff_v1(
  p_queue_session_id uuid,
  p_expected_participation_version bigint,
  p_actor_id uuid,
  p_staff_assignment_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  queue_row public.help_queue_sessions;
  participant_row public.help_queue_staff_participants;
  authorized_organization_id uuid;
  fingerprint text;
  prior_result jsonb;
  result jsonb;
  participant_count integer;
begin
  if p_expected_participation_version is null
    or p_expected_participation_version < 1
  then
    raise exception 'Help queue participation version is invalid';
  end if;
  perform public.lock_help_queue_command(p_actor_id, p_request_id);
  select queue.*
  into queue_row
  from public.help_queue_sessions as queue
  where queue.id = p_queue_session_id;
  if queue_row.id is null then
    raise exception 'Help queue was not found';
  end if;
  authorized_organization_id := public.lock_staff_assignment_authorization(
    p_staff_assignment_id,
    p_actor_id,
    queue_row.class_id,
    'help_queue.manage'
  );
  if authorized_organization_id is distinct from queue_row.organization_id then
    raise exception 'Staff assignment does not authorize help queue management';
  end if;
  fingerprint := md5(jsonb_build_object(
    'queue_session_id', p_queue_session_id,
    'expected_participation_version', p_expected_participation_version,
    'staff_assignment_id', p_staff_assignment_id
  )::text);
  prior_result := public.read_help_queue_command_receipt(
    p_actor_id,
    p_request_id,
    'leave_queue',
    fingerprint
  );
  if prior_result is not null then
    return prior_result;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('klar.help-queue-class:' || queue_row.class_id::text, 0)
  );
  perform public.reconcile_help_queue_staff_participants_v1(queue_row.class_id);
  select queue.*
  into queue_row
  from public.help_queue_sessions as queue
  where queue.id = p_queue_session_id
  for update;
  if queue_row.status not in ('open', 'closing') then
    raise exception 'Only an active help queue can be left';
  end if;
  perform 1
  from public.help_queue_staff_participants as participant
  where participant.queue_session_id = queue_row.id
    and participant.left_at is null
  order by participant.id
  for update;
  select participant.*
  into participant_row
  from public.help_queue_staff_participants as participant
  where participant.queue_session_id = queue_row.id
    and participant.user_id = p_actor_id
    and participant.left_at is null;
  if participant_row.id is null then
    raise exception 'Staff member is not an active help queue participant';
  end if;
  if participant_row.participation_version
    <> p_expected_participation_version
  then
    raise exception 'Help queue participation version is stale';
  end if;
  select count(*)::integer
  into participant_count
  from public.help_queue_staff_participants as participant
  where participant.queue_session_id = queue_row.id
    and participant.left_at is null;
  if participant_count <= 1 then
    raise exception 'Last participant must close the help queue';
  end if;
  if exists (
    select 1
    from public.help_requests as request
    where request.queue_session_id = queue_row.id
      and request.status = 'claimed'
      and request.claimed_by = p_actor_id
  ) then
    raise exception 'Staff member must release, transfer or resolve owned help before leaving';
  end if;

  update public.help_queue_staff_participants
  set left_at = greatest(joined_at, clock_timestamp()),
      leave_reason = 'voluntary',
      participation_version = participation_version + 1,
      updated_at = greatest(updated_at, clock_timestamp())
  where id = participant_row.id;
  insert into public.audit_events (
    organization_id,
    actor_id,
    event_name,
    entity_type,
    entity_id,
    metadata,
    authorizing_staff_assignment_id,
    authorizing_capability
  ) values (
    participant_row.organization_id,
    p_actor_id,
    'help_queue.staff_left',
    'help_queue_staff_participant',
    participant_row.id,
    jsonb_build_object(
      'class_id', participant_row.class_id,
      'queue_session_id', participant_row.queue_session_id,
      'staff_assignment_id', participant_row.staff_assignment_id,
      'reason', 'voluntary'
    ),
    p_staff_assignment_id,
    'help_queue.manage'
  );
  perform public.touch_help_queue_staff_activity(queue_row.id);
  select queue.* into queue_row
  from public.help_queue_sessions as queue
  where queue.id = p_queue_session_id;
  result := public.help_queue_participation_result(
    queue_row,
    p_actor_id,
    true
  );
  perform public.store_help_queue_command_receipt(
    queue_row.organization_id,
    p_actor_id,
    p_request_id,
    'leave_queue',
    fingerprint,
    queue_row.id,
    result
  );
  return result;
end;
$$;

alter function public.begin_close_help_queue_session(
  uuid, integer, uuid, uuid, uuid
) rename to begin_close_help_queue_session_without_participation;

create function public.begin_close_help_queue_session(
  p_queue_session_id uuid,
  p_expected_version integer,
  p_actor_id uuid,
  p_staff_assignment_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  queue_row public.help_queue_sessions;
  authorized_organization_id uuid;
  fingerprint text;
  prior_result jsonb;
  command_result jsonb;
begin
  select queue.* into queue_row
  from public.help_queue_sessions as queue
  where queue.id = p_queue_session_id;
  if queue_row.id is null then
    raise exception 'Help queue was not found';
  end if;
  authorized_organization_id := public.lock_staff_assignment_authorization(
    p_staff_assignment_id,
    p_actor_id,
    queue_row.class_id,
    'help_queue.manage'
  );
  if authorized_organization_id is distinct from queue_row.organization_id then
    raise exception 'Staff assignment does not authorize help queue management';
  end if;
  fingerprint := md5(jsonb_build_object(
    'queue_session_id', p_queue_session_id,
    'expected_version', p_expected_version,
    'staff_assignment_id', p_staff_assignment_id
  )::text);
  prior_result := public.read_help_queue_command_receipt(
    p_actor_id,
    p_request_id,
    'close_queue',
    fingerprint
  );
  if prior_result is not null then
    return prior_result;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('klar.help-queue-class:' || queue_row.class_id::text, 0)
  );
  perform public.reconcile_help_queue_staff_participants_v1(queue_row.class_id);
  perform public.assert_active_help_queue_participant(
    p_queue_session_id,
    p_actor_id,
    p_staff_assignment_id
  );
  command_result := public.begin_close_help_queue_session_without_participation(
    p_queue_session_id,
    p_expected_version,
    p_actor_id,
    p_staff_assignment_id,
    p_request_id
  );
  perform public.retire_help_queue_staff_participants_v1(queue_row.class_id);
  return command_result;
end;
$$;

alter function public.claim_student_help_v3(
  uuid, bigint, uuid, uuid, uuid
) rename to claim_student_help_v3_without_participation;
alter function public.resolve_student_help_v3(
  uuid, bigint, uuid, uuid, uuid
) rename to resolve_student_help_v3_without_participation;
alter function public.reorder_student_help_v1(
  uuid, uuid, text, public.help_queue_priority_reason,
  bigint, uuid, uuid, uuid
) rename to reorder_student_help_v1_without_participation;
alter function public.release_student_help_v1(
  uuid, bigint, uuid, uuid, uuid
) rename to release_student_help_v1_without_participation;
alter function public.transfer_student_help_v1(
  uuid, bigint, uuid, uuid, uuid, uuid
) rename to transfer_student_help_v1_without_participation;

create function public.claim_student_help_v3(
  p_request_id uuid,
  p_expected_ownership_version bigint,
  p_actor_id uuid,
  p_staff_assignment_id uuid,
  p_command_request_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  request_row public.help_requests;
  authorized_organization_id uuid;
  fingerprint text;
  prior_result jsonb;
begin
  if p_expected_ownership_version is null or p_expected_ownership_version < 1 then
    raise exception 'Help request ownership version is invalid';
  end if;
  perform public.lock_help_queue_command(p_actor_id, p_command_request_id);
  fingerprint := md5(jsonb_build_object(
    'request_id', p_request_id,
    'expected_ownership_version', p_expected_ownership_version,
    'staff_assignment_id', p_staff_assignment_id
  )::text);
  select request.* into request_row
  from public.help_requests as request
  where request.id = p_request_id;
  if request_row.id is null or request_row.queue_session_id is null then
    raise exception 'Session help request was not found';
  end if;
  authorized_organization_id := public.lock_staff_assignment_authorization(
    p_staff_assignment_id,
    p_actor_id,
    request_row.class_id,
    'help_queue.manage'
  );
  if authorized_organization_id is distinct from request_row.organization_id then
    raise exception 'Staff assignment does not authorize help queue management';
  end if;
  prior_result := public.read_help_queue_command_receipt(
    p_actor_id,
    p_command_request_id,
    'claim_help',
    fingerprint
  );
  if prior_result is not null then return prior_result; end if;
  perform pg_advisory_xact_lock(
    hashtextextended('klar.help-queue-class:' || request_row.class_id::text, 0)
  );
  perform public.assert_active_help_queue_participant(
    request_row.queue_session_id,
    p_actor_id,
    p_staff_assignment_id
  );
  return public.claim_student_help_v3_without_participation(
    p_request_id,
    p_expected_ownership_version,
    p_actor_id,
    p_staff_assignment_id,
    p_command_request_id
  );
end;
$$;

create function public.resolve_student_help_v3(
  p_request_id uuid,
  p_expected_ownership_version bigint,
  p_actor_id uuid,
  p_staff_assignment_id uuid,
  p_command_request_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  request_row public.help_requests;
  authorized_organization_id uuid;
  fingerprint text;
  prior_result jsonb;
  command_result jsonb;
begin
  if p_expected_ownership_version is null or p_expected_ownership_version < 1 then
    raise exception 'Help request ownership version is invalid';
  end if;
  perform public.lock_help_queue_command(p_actor_id, p_command_request_id);
  fingerprint := md5(jsonb_build_object(
    'request_id', p_request_id,
    'expected_ownership_version', p_expected_ownership_version,
    'staff_assignment_id', p_staff_assignment_id
  )::text);
  select request.* into request_row
  from public.help_requests as request
  where request.id = p_request_id;
  if request_row.id is null or request_row.queue_session_id is null then
    raise exception 'Session help request was not found';
  end if;
  authorized_organization_id := public.lock_staff_assignment_authorization(
    p_staff_assignment_id,
    p_actor_id,
    request_row.class_id,
    'help_queue.manage'
  );
  if authorized_organization_id is distinct from request_row.organization_id then
    raise exception 'Staff assignment does not authorize help queue management';
  end if;
  prior_result := public.read_help_queue_command_receipt(
    p_actor_id,
    p_command_request_id,
    'resolve_help',
    fingerprint
  );
  if prior_result is not null then return prior_result; end if;
  perform pg_advisory_xact_lock(
    hashtextextended('klar.help-queue-class:' || request_row.class_id::text, 0)
  );
  perform public.assert_active_help_queue_participant(
    request_row.queue_session_id,
    p_actor_id,
    p_staff_assignment_id
  );
  command_result := public.resolve_student_help_v3_without_participation(
    p_request_id,
    p_expected_ownership_version,
    p_actor_id,
    p_staff_assignment_id,
    p_command_request_id
  );
  perform public.retire_help_queue_staff_participants_v1(
    request_row.class_id
  );
  return command_result;
end;
$$;

create function public.reorder_student_help_v1(
  p_queue_session_id uuid,
  p_request_id uuid,
  p_direction text,
  p_reason_code public.help_queue_priority_reason,
  p_expected_activity_version bigint,
  p_actor_id uuid,
  p_staff_assignment_id uuid,
  p_command_request_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  queue_row public.help_queue_sessions;
  request_row public.help_requests;
  authorized_organization_id uuid;
  fingerprint text;
  prior_result jsonb;
begin
  if p_direction is null or p_direction not in ('first', 'up', 'down') then
    raise exception 'Help queue direction is invalid';
  end if;
  if p_reason_code is null then
    raise exception 'Help queue priority reason is required';
  end if;
  if p_expected_activity_version is null or p_expected_activity_version < 0 then
    raise exception 'Help queue activity version is invalid';
  end if;
  perform public.lock_help_queue_command(p_actor_id, p_command_request_id);
  fingerprint := md5(jsonb_build_object(
    'queue_session_id', p_queue_session_id,
    'request_id', p_request_id,
    'direction', p_direction,
    'reason_code', p_reason_code,
    'expected_activity_version', p_expected_activity_version,
    'staff_assignment_id', p_staff_assignment_id
  )::text);
  select queue.* into queue_row
  from public.help_queue_sessions as queue
  where queue.id = p_queue_session_id;
  select request.* into request_row
  from public.help_requests as request
  where request.id = p_request_id
    and request.queue_session_id = p_queue_session_id;
  if queue_row.id is null or request_row.id is null then
    raise exception 'Session help request was not found';
  end if;
  authorized_organization_id := public.lock_staff_assignment_authorization(
    p_staff_assignment_id,
    p_actor_id,
    queue_row.class_id,
    'help_queue.manage'
  );
  if authorized_organization_id is distinct from queue_row.organization_id
    or request_row.organization_id is distinct from queue_row.organization_id
    or request_row.class_id is distinct from queue_row.class_id
  then
    raise exception 'Staff assignment does not authorize help queue management';
  end if;
  prior_result := public.read_help_queue_command_receipt(
    p_actor_id,
    p_command_request_id,
    'reorder_help',
    fingerprint
  );
  if prior_result is not null then return prior_result; end if;
  perform pg_advisory_xact_lock(
    hashtextextended('klar.help-queue-class:' || queue_row.class_id::text, 0)
  );
  perform public.assert_active_help_queue_participant(
    p_queue_session_id,
    p_actor_id,
    p_staff_assignment_id
  );
  return public.reorder_student_help_v1_without_participation(
    p_queue_session_id,
    p_request_id,
    p_direction,
    p_reason_code,
    p_expected_activity_version,
    p_actor_id,
    p_staff_assignment_id,
    p_command_request_id
  );
end;
$$;

create function public.release_student_help_v1(
  p_request_id uuid,
  p_expected_ownership_version bigint,
  p_actor_id uuid,
  p_staff_assignment_id uuid,
  p_command_request_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  request_row public.help_requests;
  authorized_organization_id uuid;
  fingerprint text;
  prior_result jsonb;
begin
  if p_expected_ownership_version is null or p_expected_ownership_version < 1 then
    raise exception 'Help request ownership version is invalid';
  end if;
  perform public.lock_help_queue_command(p_actor_id, p_command_request_id);
  fingerprint := md5(jsonb_build_object(
    'request_id', p_request_id,
    'expected_ownership_version', p_expected_ownership_version,
    'staff_assignment_id', p_staff_assignment_id
  )::text);
  select request.* into request_row
  from public.help_requests as request
  where request.id = p_request_id;
  if request_row.id is null or request_row.queue_session_id is null then
    raise exception 'Session help request was not found';
  end if;
  authorized_organization_id := public.lock_staff_assignment_authorization(
    p_staff_assignment_id,
    p_actor_id,
    request_row.class_id,
    'help_queue.manage'
  );
  if authorized_organization_id is distinct from request_row.organization_id then
    raise exception 'Staff assignment does not authorize help queue management';
  end if;
  prior_result := public.read_help_queue_command_receipt(
    p_actor_id,
    p_command_request_id,
    'release_help',
    fingerprint
  );
  if prior_result is not null then return prior_result; end if;
  perform pg_advisory_xact_lock(
    hashtextextended('klar.help-queue-class:' || request_row.class_id::text, 0)
  );
  perform public.assert_active_help_queue_participant(
    request_row.queue_session_id,
    p_actor_id,
    p_staff_assignment_id
  );
  return public.release_student_help_v1_without_participation(
    p_request_id,
    p_expected_ownership_version,
    p_actor_id,
    p_staff_assignment_id,
    p_command_request_id
  );
end;
$$;

create function public.transfer_student_help_v1(
  p_request_id uuid,
  p_expected_ownership_version bigint,
  p_actor_id uuid,
  p_staff_assignment_id uuid,
  p_target_staff_assignment_id uuid,
  p_command_request_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  request_row public.help_requests;
  authorized_organization_id uuid;
  target_user_id uuid;
  participant_count integer;
  fingerprint text;
  prior_result jsonb;
begin
  if p_expected_ownership_version is null or p_expected_ownership_version < 1 then
    raise exception 'Help request ownership version is invalid';
  end if;
  perform public.lock_help_queue_command(p_actor_id, p_command_request_id);
  fingerprint := md5(jsonb_build_object(
    'request_id', p_request_id,
    'expected_ownership_version', p_expected_ownership_version,
    'staff_assignment_id', p_staff_assignment_id,
    'target_staff_assignment_id', p_target_staff_assignment_id
  )::text);
  select request.* into request_row
  from public.help_requests as request
  where request.id = p_request_id;
  if request_row.id is null or request_row.queue_session_id is null then
    raise exception 'Session help request was not found';
  end if;
  authorized_organization_id := public.lock_staff_assignment_authorization(
    p_staff_assignment_id,
    p_actor_id,
    request_row.class_id,
    'help_queue.manage'
  );
  if authorized_organization_id is distinct from request_row.organization_id then
    raise exception 'Staff assignment does not authorize help queue management';
  end if;
  prior_result := public.read_help_queue_command_receipt(
    p_actor_id,
    p_command_request_id,
    'transfer_help',
    fingerprint
  );
  if prior_result is not null then return prior_result; end if;
  select assignment.user_id
  into target_user_id
  from public.staff_assignments as assignment
  where assignment.id = p_target_staff_assignment_id
    and assignment.organization_id = request_row.organization_id;
  perform pg_advisory_xact_lock(
    hashtextextended('klar.help-queue-class:' || request_row.class_id::text, 0)
  );
  perform 1
  from public.help_queue_staff_participants as participant
  where participant.queue_session_id = request_row.queue_session_id
    and participant.left_at is null
    and participant.user_id in (p_actor_id, target_user_id)
  order by participant.user_id
  for share;
  select count(*)::integer into participant_count
  from public.help_queue_staff_participants as participant
  where participant.queue_session_id = request_row.queue_session_id
    and participant.left_at is null
    and participant.user_id in (p_actor_id, target_user_id);
  if target_user_id is null
    or target_user_id = p_actor_id
    or participant_count <> 2
  then
    raise exception 'Help transfer target must be an active queue participant';
  end if;
  return public.transfer_student_help_v1_without_participation(
    p_request_id,
    p_expected_ownership_version,
    p_actor_id,
    p_staff_assignment_id,
    p_target_staff_assignment_id,
    p_command_request_id
  );
end;
$$;

create function public.read_help_queue_staff_snapshot_v2(
  p_organization_id uuid,
  p_class_id uuid,
  p_queue_session_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select public.read_help_queue_staff_snapshot_v1(
    p_organization_id,
    p_class_id,
    p_queue_session_id
  ) || jsonb_build_object(
    'participant_rows', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', participant.id,
            'user_id', participant.user_id,
            'staff_assignment_id', participant.staff_assignment_id,
            'participation_version', participant.participation_version
          )
          order by participant.user_id
        )
        from public.help_queue_staff_participants as participant
        where participant.organization_id = p_organization_id
          and participant.class_id = p_class_id
          and participant.queue_session_id = p_queue_session_id
          and participant.left_at is null
      ),
      '[]'::jsonb
    )
  );
$$;

revoke all on function public.help_queue_participation_result(
  public.help_queue_sessions, uuid, boolean
) from public, anon, authenticated, service_role;
revoke all on function public.assert_active_help_queue_participant(
  uuid, uuid, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.reconcile_help_queue_staff_participants_v1(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.reconcile_help_queue_sessions_without_staff_participation(
  uuid
) from public, anon, authenticated, service_role;
revoke all on function public.retire_help_queue_staff_participants_v1(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.reconcile_expired_staff_assignments_without_help_participation(
  uuid
) from public, anon, authenticated, service_role;
revoke all on function public.terminalize_student_help_scope_without_participation(
  uuid, uuid, uuid, text
) from public, anon, authenticated, service_role;
revoke all on function public.cancel_student_help_v2_without_participation(
  uuid, uuid, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.open_help_queue_session_without_participation(
  uuid, uuid, uuid, uuid, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.begin_close_help_queue_session_without_participation(
  uuid, integer, uuid, uuid, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.claim_student_help_v3_without_participation(
  uuid, bigint, uuid, uuid, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.resolve_student_help_v3_without_participation(
  uuid, bigint, uuid, uuid, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.reorder_student_help_v1_without_participation(
  uuid, uuid, text, public.help_queue_priority_reason,
  bigint, uuid, uuid, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.release_student_help_v1_without_participation(
  uuid, bigint, uuid, uuid, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.transfer_student_help_v1_without_participation(
  uuid, bigint, uuid, uuid, uuid, uuid
) from public, anon, authenticated, service_role;

revoke all on function public.open_help_queue_session(
  uuid, uuid, uuid, uuid, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.reconcile_help_queue_sessions(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.reconcile_expired_staff_assignments(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.terminalize_student_help_scope(
  uuid, uuid, uuid, text
) from public, anon, authenticated, service_role;
revoke all on function public.cancel_student_help_v2(
  uuid, uuid, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.begin_close_help_queue_session(
  uuid, integer, uuid, uuid, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.join_help_queue_staff_v1(
  uuid, uuid, uuid, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.leave_help_queue_staff_v1(
  uuid, bigint, uuid, uuid, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.claim_student_help_v3(
  uuid, bigint, uuid, uuid, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.resolve_student_help_v3(
  uuid, bigint, uuid, uuid, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.reorder_student_help_v1(
  uuid, uuid, text, public.help_queue_priority_reason,
  bigint, uuid, uuid, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.release_student_help_v1(
  uuid, bigint, uuid, uuid, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.transfer_student_help_v1(
  uuid, bigint, uuid, uuid, uuid, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.read_help_queue_staff_snapshot_v2(
  uuid, uuid, uuid
) from public, anon, authenticated, service_role;

grant execute on function public.reconcile_help_queue_staff_participants_v1(uuid)
to service_role;
grant execute on function public.reconcile_help_queue_sessions(uuid)
to service_role;
grant execute on function public.reconcile_expired_staff_assignments(uuid)
to service_role;
grant execute on function public.cancel_student_help_v2(
  uuid, uuid, uuid
) to service_role;
grant execute on function public.open_help_queue_session(
  uuid, uuid, uuid, uuid, uuid
) to service_role;
grant execute on function public.begin_close_help_queue_session(
  uuid, integer, uuid, uuid, uuid
) to service_role;
grant execute on function public.join_help_queue_staff_v1(
  uuid, uuid, uuid, uuid
) to service_role;
grant execute on function public.leave_help_queue_staff_v1(
  uuid, bigint, uuid, uuid, uuid
) to service_role;
grant execute on function public.claim_student_help_v3(
  uuid, bigint, uuid, uuid, uuid
) to service_role;
grant execute on function public.resolve_student_help_v3(
  uuid, bigint, uuid, uuid, uuid
) to service_role;
grant execute on function public.reorder_student_help_v1(
  uuid, uuid, text, public.help_queue_priority_reason,
  bigint, uuid, uuid, uuid
) to service_role;
grant execute on function public.release_student_help_v1(
  uuid, bigint, uuid, uuid, uuid
) to service_role;
grant execute on function public.transfer_student_help_v1(
  uuid, bigint, uuid, uuid, uuid, uuid
) to service_role;
grant execute on function public.read_help_queue_staff_snapshot_v2(
  uuid, uuid, uuid
) to service_role;

commit;
