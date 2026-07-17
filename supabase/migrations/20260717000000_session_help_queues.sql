begin;

create type public.help_queue_session_status as enum (
  'open',
  'closing',
  'closed'
);

alter table public.plan_revision_sessions
  add constraint plan_revision_sessions_help_queue_scope_unique
  unique (id, organization_id, class_id);

create table public.help_queue_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  class_id uuid not null,
  revision_session_id uuid not null,
  status public.help_queue_session_status not null default 'open',
  lock_version integer not null default 1,
  activity_version bigint not null default 0,
  opened_at timestamptz not null default transaction_timestamp(),
  closing_started_at timestamptz,
  closed_at timestamptz,
  updated_at timestamptz not null default transaction_timestamp(),
  unique (id, organization_id),
  unique (id, organization_id, class_id),
  unique (organization_id, class_id, revision_session_id),
  foreign key (class_id, organization_id)
    references public.classes (id, organization_id) on delete restrict,
  foreign key (revision_session_id, organization_id, class_id)
    references public.plan_revision_sessions (id, organization_id, class_id)
    on delete restrict,
  constraint help_queue_sessions_lock_version check (lock_version >= 1),
  constraint help_queue_sessions_activity_version check (activity_version >= 0),
  constraint help_queue_sessions_lifecycle check (
    (status = 'open' and closing_started_at is null and closed_at is null)
    or (
      status = 'closing'
      and closing_started_at is not null
      and closed_at is null
    )
    or (
      status = 'closed'
      and closing_started_at is not null
      and closed_at is not null
    )
  ),
  constraint help_queue_sessions_timestamps check (
    (closing_started_at is null or closing_started_at >= opened_at)
    and (closed_at is null or closed_at >= closing_started_at)
    and updated_at >= opened_at
  )
);

create unique index help_queue_sessions_one_live_per_class
  on public.help_queue_sessions (organization_id, class_id)
  where status in ('open', 'closing');
create index help_queue_sessions_realtime_idx
  on public.help_queue_sessions (class_id, activity_version, updated_at desc);

create table public.help_queue_command_receipts (
  organization_id uuid not null,
  actor_id uuid not null references auth.users (id) on delete restrict,
  request_id uuid not null,
  command text not null,
  request_fingerprint text not null,
  queue_session_id uuid not null,
  result jsonb not null,
  created_at timestamptz not null default transaction_timestamp(),
  primary key (actor_id, request_id),
  foreign key (queue_session_id, organization_id)
    references public.help_queue_sessions (id, organization_id)
    on delete restrict,
  constraint help_queue_command_receipts_command check (
    command in (
      'open_queue',
      'close_queue',
      'request_help',
      'cancel_help',
      'claim_help',
      'resolve_help'
    )
  ),
  constraint help_queue_command_receipts_fingerprint check (
    request_fingerprint ~ '^[0-9a-f]{32}$'
  ),
  constraint help_queue_command_receipts_result check (
    jsonb_typeof(result) = 'object'
    and pg_column_size(result) <= 16384
  )
);

create table public.help_queue_signals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  class_id uuid not null,
  queue_session_id uuid references public.help_queue_sessions (id) on delete set null,
  student_id uuid references auth.users (id) on delete set null,
  signal_version bigint not null default 1,
  updated_at timestamptz not null default transaction_timestamp(),
  unique (queue_session_id, student_id),
  constraint help_queue_signals_version check (signal_version >= 1)
);

create index help_queue_signals_class_student_idx
  on public.help_queue_signals (class_id, student_id, updated_at desc);

alter table public.help_requests
  add column queue_session_id uuid,
  add constraint help_requests_queue_scope_fk
    foreign key (queue_session_id, organization_id, class_id)
    references public.help_queue_sessions (id, organization_id, class_id)
    on delete restrict;

with terminalized_legacy_requests as (
  update public.help_requests
  set status = 'expired',
      updated_at = transaction_timestamp()
  where queue_session_id is null
    and status in ('waiting', 'claimed')
  returning organization_id, class_id, student_id, id
)
insert into public.audit_events (
  organization_id,
  actor_id,
  event_name,
  entity_type,
  entity_id,
  metadata
)
select
  request.organization_id,
  null,
  'help.expired',
  'help_request',
  request.id,
  jsonb_build_object(
    'class_id', request.class_id,
    'student_id', request.student_id,
    'reason', 'session_queue_migration'
  )
from terminalized_legacy_requests as request;

drop index public.help_requests_one_active_per_student;

alter table public.help_requests
  drop constraint help_requests_class_id_organization_id_student_id_fkey,
  add constraint help_requests_class_scope_fkey
    foreign key (class_id, organization_id)
    references public.classes (id, organization_id)
    on delete restrict,
  add constraint help_requests_student_fkey
    foreign key (student_id)
    references auth.users (id)
    on delete restrict;

create or replace function public.validate_help_request_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  must_validate_student boolean := tg_op = 'INSERT';
  must_validate_claim boolean := false;
  is_claim_recovery boolean := false;
begin
  if tg_op = 'UPDATE' then
    must_validate_student := new.status in ('waiting', 'claimed')
      or row(new.organization_id, new.class_id, new.student_id)
        is distinct from
        row(old.organization_id, old.class_id, old.student_id);
  end if;

  if must_validate_student then
    perform pg_advisory_xact_lock(
      hashtextextended('klar.help-queue-class:' || new.class_id::text, 0)
    );
  end if;

  if must_validate_student and not exists (
    select 1
    from public.class_memberships as student_membership
    join public.memberships as organization_membership
      on organization_membership.organization_id = student_membership.organization_id
     and organization_membership.user_id = student_membership.user_id
     and organization_membership.role = 'student'
    where student_membership.class_id = new.class_id
      and student_membership.organization_id = new.organization_id
      and student_membership.user_id = new.student_id
      and student_membership.role = 'student'
  ) then
    raise exception 'Help requester must be a student in the target class';
  end if;

  if tg_op = 'UPDATE' then
    is_claim_recovery := old.status = 'claimed'
      and new.status = 'waiting'
      and old.claimed_by is not null
      and new.claimed_by is null
      and new.claimed_at is null;
  end if;

  if new.status in ('claimed', 'resolved') then
    must_validate_claim := true;
  elsif tg_op = 'UPDATE'
    and new.claimed_by is distinct from old.claimed_by
    and not is_claim_recovery
  then
    must_validate_claim := true;
  end if;

  if must_validate_claim
    and public.lock_active_staff_assignment(
      new.claimed_by,
      new.class_id,
      'help_queue.manage'
    ) is null
  then
    raise exception 'Help request staff transitions require an active staff assignment';
  end if;

  return new;
end;
$$;

create index help_requests_session_queue_idx
on public.help_requests (queue_session_id, status, requested_at, id)
where queue_session_id is not null;
create unique index help_requests_one_active_per_queue_student
  on public.help_requests (queue_session_id, student_id)
  where queue_session_id is not null and status in ('waiting', 'claimed');

create function public.validate_help_queue_session_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'open'
      or new.lock_version <> 1
      or new.activity_version <> 0
      or new.closing_started_at is not null
      or new.closed_at is not null
    then
      raise exception 'Help queue must be created in its initial open state';
    end if;
    return new;
  end if;

  if row(new.organization_id, new.class_id, new.revision_session_id, new.opened_at)
    is distinct from
    row(old.organization_id, old.class_id, old.revision_session_id, old.opened_at)
  then
    raise exception 'Help queue identity is immutable';
  end if;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'open' and new.status = 'closing')
      or (old.status = 'closing' and new.status = 'closed')
    ) then
      raise exception 'Invalid help queue status transition';
    end if;
    if new.lock_version <> old.lock_version + 1 then
      raise exception 'Help queue status transition requires the next version';
    end if;
  elsif new.lock_version <> old.lock_version then
    raise exception 'Help queue version changes only with status';
  end if;

  if new.activity_version < old.activity_version then
    raise exception 'Help queue activity version cannot decrease';
  end if;
  if new.updated_at < old.updated_at then
    raise exception 'Help queue updated timestamp cannot decrease';
  end if;
  return new;
end;
$$;

create trigger help_queue_sessions_validate_transition
before insert or update on public.help_queue_sessions
for each row execute function public.validate_help_queue_session_transition();

create function public.lock_help_queue_command(
  p_actor_id uuid,
  p_request_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_actor_id is null or p_request_id is null then
    raise exception 'Help queue actor and request identifiers are required';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended(
      'klar.help-command:' || p_actor_id::text || ':' || p_request_id::text,
      0
    )
  );
end;
$$;

create function public.read_help_queue_command_receipt(
  p_actor_id uuid,
  p_request_id uuid,
  p_command text,
  p_request_fingerprint text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  receipt public.help_queue_command_receipts;
begin
  select item.*
  into receipt
  from public.help_queue_command_receipts as item
  where item.actor_id = p_actor_id
    and item.request_id = p_request_id;

  if receipt.request_id is null then
    return null;
  end if;
  if receipt.command is distinct from p_command
    or receipt.request_fingerprint is distinct from p_request_fingerprint
  then
    raise exception 'Help queue request identifier was reused with another command';
  end if;
  return receipt.result;
end;
$$;

create function public.store_help_queue_command_receipt(
  p_organization_id uuid,
  p_actor_id uuid,
  p_request_id uuid,
  p_command text,
  p_request_fingerprint text,
  p_queue_session_id uuid,
  p_result jsonb
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.help_queue_command_receipts (
    organization_id,
    actor_id,
    request_id,
    command,
    request_fingerprint,
    queue_session_id,
    result
  ) values (
    p_organization_id,
    p_actor_id,
    p_request_id,
    p_command,
    p_request_fingerprint,
    p_queue_session_id,
    p_result
  );
$$;

create function public.help_queue_result(
  p_queue public.help_queue_sessions,
  p_changed boolean
)
returns jsonb
language sql
immutable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'queue_session_id', p_queue.id,
    'class_id', p_queue.class_id,
    'revision_session_id', p_queue.revision_session_id,
    'status', p_queue.status::text,
    'lock_version', p_queue.lock_version,
    'activity_version', p_queue.activity_version,
    'changed', p_changed
  );
$$;

create function public.help_request_result(
  p_request public.help_requests,
  p_changed boolean
)
returns jsonb
language sql
immutable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'queue_session_id', p_request.queue_session_id,
    'request_id', p_request.id,
    'status', p_request.status::text,
    'task_assignment_id', p_request.task_assignment_id,
    'requested_at', p_request.requested_at,
    'changed', p_changed
  );
$$;

create function public.touch_help_queue_signal(
  p_queue_session_id uuid,
  p_student_id uuid default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  queue_row public.help_queue_sessions;
begin
  select queue.*
  into queue_row
  from public.help_queue_sessions as queue
  where queue.id = p_queue_session_id;
  if queue_row.id is null then
    raise exception 'Help queue was not found for signal update';
  end if;

  insert into public.help_queue_signals (
    organization_id,
    class_id,
    queue_session_id,
    student_id
  )
  select
    queue_row.organization_id,
    queue_row.class_id,
    queue_row.id,
    membership.user_id
  from public.class_memberships as membership
  join public.memberships as organization_membership
    on organization_membership.organization_id = membership.organization_id
   and organization_membership.user_id = membership.user_id
   and organization_membership.role = 'student'
  where membership.organization_id = queue_row.organization_id
    and membership.class_id = queue_row.class_id
    and membership.role = 'student'
    and (p_student_id is null or membership.user_id = p_student_id)
  on conflict (queue_session_id, student_id) do update
  set signal_version = help_queue_signals.signal_version + 1,
      updated_at = greatest(help_queue_signals.updated_at, clock_timestamp());
end;
$$;

create function public.ensure_help_queue_signal_for_membership()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  queue_id uuid;
begin
  if new.role <> 'student' then
    return new;
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended('klar.help-queue-class:' || new.class_id::text, 0)
  );
  if not exists (
    select 1
    from public.memberships as organization_membership
    where organization_membership.organization_id = new.organization_id
      and organization_membership.user_id = new.user_id
      and organization_membership.role = 'student'
  ) then
    return new;
  end if;
  for queue_id in
    select queue.id
    from public.help_queue_sessions as queue
    where queue.organization_id = new.organization_id
      and queue.class_id = new.class_id
      and queue.status in ('open', 'closing')
  loop
    perform public.touch_help_queue_signal(queue_id, new.user_id);
  end loop;
  return new;
end;
$$;

create trigger class_memberships_ensure_help_signal_after_change
after insert or update of role on public.class_memberships
for each row execute function public.ensure_help_queue_signal_for_membership();

create function public.touch_help_queue_session(
  p_queue_session_id uuid,
  p_student_id uuid default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.help_queue_sessions
  set activity_version = activity_version + 1,
      updated_at = greatest(updated_at, clock_timestamp())
  where id = p_queue_session_id;
  perform public.touch_help_queue_signal(p_queue_session_id, p_student_id);
end;
$$;

create function public.reconcile_help_queue_sessions(p_class_id uuid default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_class_id uuid;
  queue_row public.help_queue_sessions;
  request_row public.help_requests;
  recovered_request boolean;
  changed_count integer := 0;
begin
  for target_class_id in
    select distinct candidate.class_id
    from (
      select queue.class_id
      from public.help_queue_sessions as queue
      join public.plan_revision_sessions as revision_session
        on revision_session.id = queue.revision_session_id
       and revision_session.organization_id = queue.organization_id
       and revision_session.class_id = queue.class_id
      where queue.status = 'open'
        and revision_session.ends_at <= transaction_timestamp()
      union
      select queue.class_id
      from public.help_queue_sessions as queue
      where queue.status = 'closing'
        and not exists (
          select 1
          from public.help_requests as request
          where request.queue_session_id = queue.id
            and request.status in ('waiting', 'claimed')
        )
      union
      select queue.class_id
      from public.help_queue_sessions as queue
      join public.help_requests as request
        on request.queue_session_id = queue.id
       and request.status = 'claimed'
      where queue.status in ('open', 'closing')
        and not exists (
          select 1
          from public.staff_assignments as assignment
          join public.memberships as membership
            on membership.organization_id = assignment.organization_id
           and membership.user_id = assignment.user_id
           and membership.role in ('owner', 'teacher')
          join public.staff_assignment_class_scopes as scope
            on scope.assignment_id = assignment.id
           and scope.organization_id = assignment.organization_id
          join public.staff_assignment_capabilities as capability
            on capability.assignment_id = assignment.id
           and capability.profile_version = assignment.profile_version
          where assignment.organization_id = request.organization_id
            and assignment.user_id = request.claimed_by
            and scope.class_id = request.class_id
            and capability.capability = 'help_queue.manage'
            and assignment.revoked_at is null
            and assignment.starts_at <= transaction_timestamp()
            and (
              assignment.ends_at is null
              or transaction_timestamp() < assignment.ends_at
            )
        )
    ) as candidate
    where p_class_id is null or candidate.class_id = p_class_id
    order by candidate.class_id
  loop
    perform pg_advisory_xact_lock(
      hashtextextended('klar.help-queue-class:' || target_class_id::text, 0)
    );

    for queue_row in
      select queue.*
      from public.help_queue_sessions as queue
      where queue.class_id = target_class_id
        and queue.status in ('open', 'closing')
      order by queue.id
      for update
    loop
      recovered_request := false;
      for request_row in
        select request.*
        from public.help_requests as request
        where request.queue_session_id = queue_row.id
          and request.status = 'claimed'
          and not exists (
            select 1
            from public.staff_assignments as assignment
            join public.memberships as membership
              on membership.organization_id = assignment.organization_id
             and membership.user_id = assignment.user_id
             and membership.role in ('owner', 'teacher')
            join public.staff_assignment_class_scopes as scope
              on scope.assignment_id = assignment.id
             and scope.organization_id = assignment.organization_id
            join public.staff_assignment_capabilities as capability
              on capability.assignment_id = assignment.id
             and capability.profile_version = assignment.profile_version
            where assignment.organization_id = request.organization_id
              and assignment.user_id = request.claimed_by
              and scope.class_id = request.class_id
              and capability.capability = 'help_queue.manage'
              and assignment.revoked_at is null
              and assignment.starts_at <= transaction_timestamp()
              and (
                assignment.ends_at is null
                or transaction_timestamp() < assignment.ends_at
              )
          )
        order by request.requested_at, request.id
        for update
      loop
        update public.help_requests
        set status = 'waiting',
            claimed_by = null,
            claimed_at = null,
            updated_at = transaction_timestamp()
        where id = request_row.id;
        perform public.touch_help_queue_signal(
          request_row.queue_session_id,
          request_row.student_id
        );

        insert into public.audit_events (
          organization_id,
          actor_id,
          event_name,
          entity_type,
          entity_id,
          metadata
        ) values (
          request_row.organization_id,
          null,
          'help.requeued',
          'help_request',
          request_row.id,
          jsonb_build_object(
            'class_id', request_row.class_id,
            'queue_session_id', request_row.queue_session_id,
            'reason', 'claimant_assignment_inactive',
            'previous_claimed_by', request_row.claimed_by
          )
        );
        recovered_request := true;
        changed_count := changed_count + 1;
      end loop;

      if recovered_request then
        update public.help_queue_sessions
        set activity_version = activity_version + 1,
            updated_at = greatest(updated_at, clock_timestamp())
        where id = queue_row.id;
      end if;
    end loop;

    for queue_row in
      select queue.*
      from public.help_queue_sessions as queue
      join public.plan_revision_sessions as revision_session
        on revision_session.id = queue.revision_session_id
       and revision_session.organization_id = queue.organization_id
       and revision_session.class_id = queue.class_id
      where queue.class_id = target_class_id
        and queue.status = 'open'
        and revision_session.ends_at <= transaction_timestamp()
      order by queue.id
      for update of queue
    loop
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
          'reason', 'session_ended',
          'lock_version', queue_row.lock_version
        )
      );
      changed_count := changed_count + 1;
    end loop;

    for queue_row in
      select queue.*
      from public.help_queue_sessions as queue
      where queue.class_id = target_class_id
        and queue.status = 'closing'
        and not exists (
          select 1
          from public.help_requests as request
          where request.queue_session_id = queue.id
            and request.status in ('waiting', 'claimed')
        )
      order by queue.id
      for update of queue
    loop
      update public.help_queue_sessions
      set status = 'closed',
          lock_version = lock_version + 1,
          activity_version = activity_version + 1,
          closed_at = greatest(closing_started_at, clock_timestamp()),
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
        'help_queue.closed',
        'help_queue_session',
        queue_row.id,
        jsonb_build_object(
          'class_id', queue_row.class_id,
          'revision_session_id', queue_row.revision_session_id,
          'reason', 'drained',
          'lock_version', queue_row.lock_version
        )
      );
      changed_count := changed_count + 1;
    end loop;
  end loop;

  return changed_count;
end;
$$;

create function public.reconcile_help_after_staff_revocation()
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
      perform public.reconcile_help_queue_sessions(target_class_id);
    end loop;
  end if;
  return new;
end;
$$;

create trigger staff_assignments_reconcile_help_after_revocation
after update of revoked_at on public.staff_assignments
for each row execute function public.reconcile_help_after_staff_revocation();

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
declare
  request_row public.help_requests;
begin
  perform pg_advisory_xact_lock(
    hashtextextended('klar.help-queue-class:' || p_class_id::text, 0)
  );
  for request_row in
    select request.*
    from public.help_requests as request
    where request.organization_id = p_organization_id
      and request.class_id = p_class_id
      and request.student_id = p_student_id
      and request.status in ('waiting', 'claimed')
    order by request.queue_session_id, request.requested_at, request.id
    for update
  loop
    update public.help_requests
    set status = 'expired',
        resolved_at = clock_timestamp(),
        updated_at = greatest(updated_at, clock_timestamp())
    where id = request_row.id
    returning * into request_row;

    insert into public.audit_events (
      organization_id,
      actor_id,
      event_name,
      entity_type,
      entity_id,
      metadata
    ) values (
      request_row.organization_id,
      null,
      'help.expired',
      'help_request',
      request_row.id,
      jsonb_build_object(
        'class_id', request_row.class_id,
        'queue_session_id', request_row.queue_session_id,
        'reason', p_reason
      )
    );
    if request_row.queue_session_id is not null then
      perform public.touch_help_queue_session(
        request_row.queue_session_id,
        request_row.student_id
      );
    end if;
  end loop;

  perform public.reconcile_help_queue_sessions(p_class_id);
  update public.help_queue_signals as signal
  set student_id = null,
      signal_version = signal.signal_version + 1,
      updated_at = greatest(signal.updated_at, clock_timestamp())
  where signal.organization_id = p_organization_id
    and signal.class_id = p_class_id
    and signal.student_id = p_student_id;
end;
$$;

create function public.terminalize_help_on_membership_change()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.role = 'student' then
      perform public.terminalize_student_help_scope(
        old.organization_id,
        old.class_id,
        old.user_id,
        'class_membership_removed'
      );
    end if;
    return old;
  end if;

  if old.role = 'student' and new.role <> 'student' then
    perform public.terminalize_student_help_scope(
      old.organization_id,
      old.class_id,
      old.user_id,
      'class_membership_role_changed'
    );
  end if;
  return new;
end;
$$;

create trigger class_memberships_terminalize_help_before_change
before delete or update of role on public.class_memberships
for each row execute function public.terminalize_help_on_membership_change();

create function public.terminalize_help_on_organization_role_change()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_class_id uuid;
begin
  if old.role = 'student' and new.role <> 'student' then
    for target_class_id in
      select membership.class_id
      from public.class_memberships as membership
      where membership.organization_id = new.organization_id
        and membership.user_id = new.user_id
        and membership.role = 'student'
      order by membership.class_id
    loop
      perform public.terminalize_student_help_scope(
        new.organization_id,
        target_class_id,
        new.user_id,
        'organization_role_changed'
      );
    end loop;
  end if;
  return new;
end;
$$;

create trigger memberships_terminalize_help_after_role_change
after update of role on public.memberships
for each row execute function public.terminalize_help_on_organization_role_change();

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
  target_session public.plan_revision_sessions;
  queue_row public.help_queue_sessions;
  authorized_organization_id uuid;
  fingerprint text;
  prior_result jsonb;
  result jsonb;
begin
  perform public.lock_help_queue_command(p_actor_id, p_request_id);
  fingerprint := md5(jsonb_build_object(
    'class_id', p_class_id,
    'revision_session_id', p_revision_session_id,
    'staff_assignment_id', p_staff_assignment_id
  )::text);

  authorized_organization_id := public.lock_staff_assignment_authorization(
    p_staff_assignment_id,
    p_actor_id,
    p_class_id,
    'help_queue.manage'
  );
  if authorized_organization_id is null then
    raise exception 'Staff assignment does not authorize help queue management';
  end if;

  prior_result := public.read_help_queue_command_receipt(
    p_actor_id,
    p_request_id,
    'open_queue',
    fingerprint
  );
  if prior_result is not null then
    return prior_result;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('klar.help-queue-class:' || p_class_id::text, 0)
  );
  perform public.reconcile_help_queue_sessions(p_class_id);

  select revision_session.*
  into target_session
  from public.plan_revision_sessions as revision_session
  join public.weekly_plans as plan
    on plan.id = revision_session.weekly_plan_id
   and plan.organization_id = revision_session.organization_id
   and plan.class_id = revision_session.class_id
   and plan.active_revision_id = revision_session.revision_id
  where revision_session.id = p_revision_session_id
    and revision_session.class_id = p_class_id
    and revision_session.organization_id = authorized_organization_id
    and revision_session.starts_at <= transaction_timestamp()
    and transaction_timestamp() < revision_session.ends_at
  for share of revision_session, plan;
  if target_session.id is null then
    raise exception 'Only the current active plan session can open a help queue';
  end if;

  select queue.*
  into queue_row
  from public.help_queue_sessions as queue
  where queue.organization_id = authorized_organization_id
    and queue.class_id = p_class_id
    and queue.status in ('open', 'closing')
  for update;

  if queue_row.id is not null then
    if queue_row.revision_session_id is distinct from p_revision_session_id
      or queue_row.status <> 'open'
    then
      raise exception 'Another help queue must finish closing before a new queue opens';
    end if;
    result := public.help_queue_result(queue_row, false);
  else
    insert into public.help_queue_sessions (
      organization_id,
      class_id,
      revision_session_id
    ) values (
      authorized_organization_id,
      p_class_id,
      p_revision_session_id
    ) returning * into queue_row;
    perform public.touch_help_queue_signal(queue_row.id, null);

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
      authorized_organization_id,
      p_actor_id,
      'help_queue.opened',
      'help_queue_session',
      queue_row.id,
      jsonb_build_object(
        'class_id', p_class_id,
        'revision_session_id', p_revision_session_id,
        'lock_version', queue_row.lock_version
      ),
      p_staff_assignment_id,
      'help_queue.manage'
    );
    result := public.help_queue_result(queue_row, true);
  end if;

  perform public.store_help_queue_command_receipt(
    authorized_organization_id,
    p_actor_id,
    p_request_id,
    'open_queue',
    fingerprint,
    queue_row.id,
    result
  );
  return result;
end;
$$;

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
  result jsonb;
begin
  perform public.lock_help_queue_command(p_actor_id, p_request_id);
  fingerprint := md5(jsonb_build_object(
    'queue_session_id', p_queue_session_id,
    'expected_version', p_expected_version,
    'staff_assignment_id', p_staff_assignment_id
  )::text);

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
  perform public.reconcile_help_queue_sessions(queue_row.class_id);
  select queue.*
  into queue_row
  from public.help_queue_sessions as queue
  where queue.id = p_queue_session_id
  for update;

  if p_expected_version is null
    or queue_row.lock_version is distinct from p_expected_version
  then
    raise exception 'Help queue version is stale';
  end if;
  if queue_row.status <> 'open' then
    raise exception 'Only an open help queue can begin closing';
  end if;

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
    metadata,
    authorizing_staff_assignment_id,
    authorizing_capability
  ) values (
    queue_row.organization_id,
    p_actor_id,
    'help_queue.closing_started',
    'help_queue_session',
    queue_row.id,
    jsonb_build_object(
      'class_id', queue_row.class_id,
      'revision_session_id', queue_row.revision_session_id,
      'reason', 'staff_requested',
      'lock_version', queue_row.lock_version
    ),
    p_staff_assignment_id,
    'help_queue.manage'
  );

  perform public.reconcile_help_queue_sessions(queue_row.class_id);
  select queue.*
  into queue_row
  from public.help_queue_sessions as queue
  where queue.id = p_queue_session_id;
  result := public.help_queue_result(queue_row, true);
  perform public.store_help_queue_command_receipt(
    queue_row.organization_id,
    p_actor_id,
    p_request_id,
    'close_queue',
    fingerprint,
    queue_row.id,
    result
  );
  return result;
end;
$$;

create function public.request_student_help_v2(
  p_queue_session_id uuid,
  p_student_id uuid,
  p_request_id uuid,
  p_task_assignment_id uuid default null
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
  fingerprint text;
  prior_result jsonb;
  result jsonb;
  changed boolean := false;
begin
  perform public.lock_help_queue_command(p_student_id, p_request_id);
  fingerprint := md5(jsonb_build_object(
    'queue_session_id', p_queue_session_id,
    'task_assignment_id', p_task_assignment_id
  )::text);

  select queue.*
  into queue_row
  from public.help_queue_sessions as queue
  where queue.id = p_queue_session_id;
  if queue_row.id is null then
    raise exception 'Help queue was not found';
  end if;
  if not exists (
    select 1
    from public.class_memberships as class_membership
    join public.memberships as organization_membership
      on organization_membership.organization_id = class_membership.organization_id
     and organization_membership.user_id = class_membership.user_id
     and organization_membership.role = 'student'
    where class_membership.organization_id = queue_row.organization_id
      and class_membership.class_id = queue_row.class_id
      and class_membership.user_id = p_student_id
      and class_membership.role = 'student'
  ) then
    raise exception 'Student is not a member of the help queue class';
  end if;

  prior_result := public.read_help_queue_command_receipt(
    p_student_id,
    p_request_id,
    'request_help',
    fingerprint
  );
  if prior_result is not null then
    return prior_result;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('klar.help-queue-class:' || queue_row.class_id::text, 0)
  );
  perform pg_advisory_xact_lock(
    hashtextextended('klar.help-student:' || p_student_id::text, 0)
  );
  if not exists (
    select 1
    from public.class_memberships as class_membership
    join public.memberships as organization_membership
      on organization_membership.organization_id = class_membership.organization_id
     and organization_membership.user_id = class_membership.user_id
     and organization_membership.role = 'student'
    where class_membership.organization_id = queue_row.organization_id
      and class_membership.class_id = queue_row.class_id
      and class_membership.user_id = p_student_id
      and class_membership.role = 'student'
  ) then
    raise exception 'Student is not a member of the help queue class';
  end if;
  perform public.reconcile_help_queue_sessions(queue_row.class_id);
  select queue.*
  into queue_row
  from public.help_queue_sessions as queue
  where queue.id = p_queue_session_id
  for update;
  if queue_row.status <> 'open' then
    raise exception 'Help queue is not open for new requests';
  end if;

  if p_task_assignment_id is not null and not exists (
    select 1
    from public.task_assignments as assignment
    join public.plan_revision_tasks as revision_task
      on revision_task.id = assignment.source_plan_revision_task_id
     and revision_task.plan_task_id = assignment.plan_task_id
     and revision_task.organization_id = assignment.organization_id
     and revision_task.class_id = assignment.class_id
     and revision_task.task_definition_id = assignment.task_definition_id
    where assignment.id = p_task_assignment_id
      and assignment.organization_id = queue_row.organization_id
      and assignment.class_id = queue_row.class_id
      and assignment.student_id = p_student_id
      and revision_task.revision_session_id = queue_row.revision_session_id
      and assignment.visible_from <= transaction_timestamp()
  ) then
    raise exception 'Task assignment is not part of the student and queue session';
  end if;

  select request.*
  into request_row
  from public.help_requests as request
  where request.queue_session_id = queue_row.id
    and request.organization_id = queue_row.organization_id
    and request.student_id = p_student_id
    and request.status in ('waiting', 'claimed')
  order by request.requested_at, request.id
  limit 1
  for update;

  if request_row.id is null then
    insert into public.help_requests (
      organization_id,
      class_id,
      student_id,
      queue_session_id,
      task_assignment_id,
      expires_at
    ) values (
      queue_row.organization_id,
      queue_row.class_id,
      p_student_id,
      queue_row.id,
      p_task_assignment_id,
      'infinity'::timestamptz
    ) returning * into request_row;
    changed := true;

    insert into public.audit_events (
      organization_id,
      actor_id,
      event_name,
      entity_type,
      entity_id,
      metadata
    ) values (
      queue_row.organization_id,
      p_student_id,
      'help.requested',
      'help_request',
      request_row.id,
      jsonb_build_object(
        'class_id', queue_row.class_id,
        'queue_session_id', queue_row.id,
        'task_assignment_id', p_task_assignment_id
      )
    );
  elsif p_task_assignment_id is not null
    and request_row.task_assignment_id is null
  then
    update public.help_requests
    set task_assignment_id = p_task_assignment_id,
        updated_at = transaction_timestamp()
    where id = request_row.id
    returning * into request_row;
    changed := true;

    insert into public.audit_events (
      organization_id,
      actor_id,
      event_name,
      entity_type,
      entity_id,
      metadata
    ) values (
      queue_row.organization_id,
      p_student_id,
      'help.context_updated',
      'help_request',
      request_row.id,
      jsonb_build_object(
        'class_id', queue_row.class_id,
        'queue_session_id', queue_row.id,
        'task_assignment_id', p_task_assignment_id
      )
    );
  elsif p_task_assignment_id is not null
    and request_row.task_assignment_id is distinct from p_task_assignment_id
  then
    raise exception 'Help request is already linked to another task';
  end if;

  if changed then
    perform public.touch_help_queue_session(queue_row.id, p_student_id);
  end if;
  result := public.help_request_result(request_row, changed);
  perform public.store_help_queue_command_receipt(
    queue_row.organization_id,
    p_student_id,
    p_request_id,
    'request_help',
    fingerprint,
    queue_row.id,
    result
  );
  return result;
end;
$$;

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
  request_row public.help_requests;
  queue_row public.help_queue_sessions;
  fingerprint text;
  prior_result jsonb;
  result jsonb;
  changed boolean := false;
begin
  perform public.lock_help_queue_command(p_student_id, p_command_request_id);
  fingerprint := md5(jsonb_build_object('request_id', p_request_id)::text);

  select request.*
  into request_row
  from public.help_requests as request
  where request.id = p_request_id
    and request.student_id = p_student_id;
  if request_row.id is null or request_row.queue_session_id is null then
    raise exception 'Session help request does not belong to the student';
  end if;
  if not exists (
    select 1
    from public.class_memberships as membership
    where membership.organization_id = request_row.organization_id
      and membership.class_id = request_row.class_id
      and membership.user_id = p_student_id
      and membership.role = 'student'
  ) then
    raise exception 'Student is no longer a member of the help queue class';
  end if;

  prior_result := public.read_help_queue_command_receipt(
    p_student_id,
    p_command_request_id,
    'cancel_help',
    fingerprint
  );
  if prior_result is not null then
    return prior_result;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('klar.help-queue-class:' || request_row.class_id::text, 0)
  );
  perform public.reconcile_help_queue_sessions(request_row.class_id);
  select queue.*
  into queue_row
  from public.help_queue_sessions as queue
  where queue.id = request_row.queue_session_id
  for update;
  select request.*
  into request_row
  from public.help_requests as request
  where request.id = p_request_id
    and request.student_id = p_student_id
  for update;

  if request_row.status in ('waiting', 'claimed') then
    update public.help_requests
    set status = 'cancelled',
        resolved_at = transaction_timestamp(),
        updated_at = transaction_timestamp()
    where id = request_row.id
    returning * into request_row;
    changed := true;

    insert into public.audit_events (
      organization_id,
      actor_id,
      event_name,
      entity_type,
      entity_id,
      metadata
    ) values (
      request_row.organization_id,
      p_student_id,
      'help.cancelled',
      'help_request',
      request_row.id,
      jsonb_build_object(
        'class_id', request_row.class_id,
        'queue_session_id', request_row.queue_session_id
      )
    );
    perform public.touch_help_queue_session(
      request_row.queue_session_id,
      request_row.student_id
    );
    perform public.reconcile_help_queue_sessions(request_row.class_id);
  elsif request_row.status <> 'cancelled' then
    raise exception 'Help request is no longer active';
  end if;

  result := public.help_request_result(request_row, changed);
  perform public.store_help_queue_command_receipt(
    request_row.organization_id,
    p_student_id,
    p_command_request_id,
    'cancel_help',
    fingerprint,
    request_row.queue_session_id,
    result
  );
  return result;
end;
$$;

create function public.claim_student_help_v2(
  p_request_id uuid,
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
  queue_row public.help_queue_sessions;
  authorized_organization_id uuid;
  fingerprint text;
  prior_result jsonb;
  result jsonb;
  changed boolean := false;
begin
  perform public.lock_help_queue_command(p_actor_id, p_command_request_id);
  fingerprint := md5(jsonb_build_object(
    'request_id', p_request_id,
    'staff_assignment_id', p_staff_assignment_id
  )::text);

  select request.*
  into request_row
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
  if prior_result is not null then
    return prior_result;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('klar.help-queue-class:' || request_row.class_id::text, 0)
  );
  perform public.reconcile_help_queue_sessions(request_row.class_id);
  select queue.*
  into queue_row
  from public.help_queue_sessions as queue
  where queue.id = request_row.queue_session_id
  for update;
  select request.*
  into request_row
  from public.help_requests as request
  where request.id = p_request_id
  for update;
  if queue_row.status not in ('open', 'closing') then
    raise exception 'Help queue is closed';
  end if;

  if request_row.status = 'waiting' then
    update public.help_requests
    set status = 'claimed',
        claimed_by = p_actor_id,
        claimed_at = transaction_timestamp(),
        updated_at = transaction_timestamp()
    where id = request_row.id
    returning * into request_row;
    changed := true;

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
      request_row.organization_id,
      p_actor_id,
      'help.claimed',
      'help_request',
      request_row.id,
      jsonb_build_object(
        'class_id', request_row.class_id,
        'queue_session_id', request_row.queue_session_id
      ),
      p_staff_assignment_id,
      'help_queue.manage'
    );
    perform public.touch_help_queue_session(
      request_row.queue_session_id,
      request_row.student_id
    );
  elsif request_row.status <> 'claimed'
    or request_row.claimed_by is distinct from p_actor_id
  then
    raise exception 'Help request was already taken or is no longer waiting';
  end if;

  result := public.help_request_result(request_row, changed);
  perform public.store_help_queue_command_receipt(
    request_row.organization_id,
    p_actor_id,
    p_command_request_id,
    'claim_help',
    fingerprint,
    request_row.queue_session_id,
    result
  );
  return result;
end;
$$;

create function public.resolve_student_help_v2(
  p_request_id uuid,
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
  queue_row public.help_queue_sessions;
  authorized_organization_id uuid;
  fingerprint text;
  prior_result jsonb;
  result jsonb;
  changed boolean := false;
begin
  perform public.lock_help_queue_command(p_actor_id, p_command_request_id);
  fingerprint := md5(jsonb_build_object(
    'request_id', p_request_id,
    'staff_assignment_id', p_staff_assignment_id
  )::text);

  select request.*
  into request_row
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
  if prior_result is not null then
    return prior_result;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('klar.help-queue-class:' || request_row.class_id::text, 0)
  );
  perform public.reconcile_help_queue_sessions(request_row.class_id);
  select queue.*
  into queue_row
  from public.help_queue_sessions as queue
  where queue.id = request_row.queue_session_id
  for update;
  select request.*
  into request_row
  from public.help_requests as request
  where request.id = p_request_id
  for update;
  if request_row.status = 'claimed'
    and request_row.claimed_by = p_actor_id
  then
    update public.help_requests
    set status = 'resolved',
        resolved_at = transaction_timestamp(),
        updated_at = transaction_timestamp()
    where id = request_row.id
    returning * into request_row;
    changed := true;

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
      request_row.organization_id,
      p_actor_id,
      'help.resolved',
      'help_request',
      request_row.id,
      jsonb_build_object(
        'class_id', request_row.class_id,
        'queue_session_id', request_row.queue_session_id
      ),
      p_staff_assignment_id,
      'help_queue.manage'
    );
    perform public.touch_help_queue_session(
      request_row.queue_session_id,
      request_row.student_id
    );
    perform public.reconcile_help_queue_sessions(request_row.class_id);
  elsif request_row.status <> 'resolved'
    or request_row.claimed_by is distinct from p_actor_id
  then
    raise exception 'Staff member must own the active help request before resolving it';
  end if;

  result := public.help_request_result(request_row, changed);
  perform public.store_help_queue_command_receipt(
    request_row.organization_id,
    p_actor_id,
    p_command_request_id,
    'resolve_help',
    fingerprint,
    request_row.queue_session_id,
    result
  );
  return result;
end;
$$;

alter table public.help_queue_sessions enable row level security;
alter table public.help_queue_sessions force row level security;
alter table public.help_queue_command_receipts enable row level security;
alter table public.help_queue_command_receipts force row level security;
alter table public.help_queue_signals enable row level security;
alter table public.help_queue_signals force row level security;

create policy help_queue_signals_select_authorized
on public.help_queue_signals
for select
to authenticated
using (
  (
    student_id = auth.uid()
    and exists (
      select 1
      from public.class_memberships as class_membership
      join public.memberships as organization_membership
        on organization_membership.organization_id = class_membership.organization_id
       and organization_membership.user_id = class_membership.user_id
       and organization_membership.role = 'student'
      where class_membership.organization_id = help_queue_signals.organization_id
        and class_membership.class_id = help_queue_signals.class_id
        and class_membership.user_id = auth.uid()
        and class_membership.role = 'student'
    )
  )
  or public.has_active_staff_capability(
    help_queue_signals.class_id,
    'help_queue.manage'
  )
);

drop policy help_requests_select_authorized on public.help_requests;

revoke all on table public.help_queue_sessions
from public, anon, authenticated, service_role;
revoke all on table public.help_queue_command_receipts
from public, anon, authenticated, service_role;
revoke all on table public.help_queue_signals
from public, anon, authenticated, service_role;
revoke all on table public.help_requests
from public, anon, authenticated, service_role;

grant select on table public.help_queue_sessions to service_role;
grant select on table public.help_queue_signals to authenticated, service_role;
grant select on table public.help_requests to service_role;

revoke all on function public.validate_help_queue_session_transition()
from public, anon, authenticated, service_role;
revoke all on function public.lock_help_queue_command(uuid, uuid)
from public, anon, authenticated, service_role;
revoke all on function public.read_help_queue_command_receipt(uuid, uuid, text, text)
from public, anon, authenticated, service_role;
revoke all on function public.store_help_queue_command_receipt(
  uuid, uuid, uuid, text, text, uuid, jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.help_queue_result(
  public.help_queue_sessions, boolean
) from public, anon, authenticated, service_role;
revoke all on function public.help_request_result(
  public.help_requests, boolean
) from public, anon, authenticated, service_role;
revoke all on function public.touch_help_queue_signal(uuid, uuid)
from public, anon, authenticated, service_role;
revoke all on function public.ensure_help_queue_signal_for_membership()
from public, anon, authenticated, service_role;
revoke all on function public.touch_help_queue_session(uuid, uuid)
from public, anon, authenticated, service_role;
revoke all on function public.terminalize_student_help_scope(uuid, uuid, uuid, text)
from public, anon, authenticated, service_role;
revoke all on function public.terminalize_help_on_membership_change()
from public, anon, authenticated, service_role;
revoke all on function public.terminalize_help_on_organization_role_change()
from public, anon, authenticated, service_role;
revoke all on function public.reconcile_help_after_staff_revocation()
from public, anon, authenticated, service_role;

revoke all on function public.reconcile_help_queue_sessions(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.open_help_queue_session(uuid, uuid, uuid, uuid, uuid)
from public, anon, authenticated, service_role;
revoke all on function public.begin_close_help_queue_session(
  uuid, integer, uuid, uuid, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.request_student_help_v2(uuid, uuid, uuid, uuid)
from public, anon, authenticated, service_role;
revoke all on function public.cancel_student_help_v2(uuid, uuid, uuid)
from public, anon, authenticated, service_role;
revoke all on function public.claim_student_help_v2(uuid, uuid, uuid, uuid)
from public, anon, authenticated, service_role;
revoke all on function public.resolve_student_help_v2(uuid, uuid, uuid, uuid)
from public, anon, authenticated, service_role;

revoke execute on function public.expire_help_requests() from service_role;
revoke execute on function public.request_student_help(uuid, uuid, uuid)
from service_role;
revoke execute on function public.cancel_student_help(uuid, uuid)
from service_role;
revoke execute on function public.claim_student_help(uuid, uuid, uuid)
from service_role;
revoke execute on function public.resolve_student_help(uuid, uuid, uuid)
from service_role;

grant execute on function public.reconcile_help_queue_sessions(uuid)
to service_role;
grant execute on function public.open_help_queue_session(uuid, uuid, uuid, uuid, uuid)
to service_role;
grant execute on function public.begin_close_help_queue_session(
  uuid, integer, uuid, uuid, uuid
) to service_role;
grant execute on function public.request_student_help_v2(uuid, uuid, uuid, uuid)
to service_role;
grant execute on function public.cancel_student_help_v2(uuid, uuid, uuid)
to service_role;
grant execute on function public.claim_student_help_v2(uuid, uuid, uuid, uuid)
to service_role;
grant execute on function public.resolve_student_help_v2(uuid, uuid, uuid, uuid)
to service_role;

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    if exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'help_requests'
    ) then
      alter publication supabase_realtime drop table public.help_requests;
    end if;
    if exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'help_queue_sessions'
    ) then
      alter publication supabase_realtime drop table public.help_queue_sessions;
    end if;
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'help_queue_signals'
    ) then
      alter publication supabase_realtime add table public.help_queue_signals;
    end if;
  end if;
end;
$$;

commit;
