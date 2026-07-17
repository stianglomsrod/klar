begin;

create type public.help_queue_priority_reason as enum (
  'support_needed_now',
  'short_clarification',
  'staff_coordination'
);

do $$
begin
  if exists (
    select 1
    from public.help_queue_signals as signal
    left join public.help_queue_sessions as queue
      on queue.id = signal.queue_session_id
    where signal.queue_session_id is not null
      and (
        queue.id is null
        or queue.organization_id is distinct from signal.organization_id
        or queue.class_id is distinct from signal.class_id
      )
  ) then
    raise exception
      'Help queue signal scope is inconsistent with its queue session';
  end if;
end;
$$;

alter table public.help_queue_signals
  drop constraint help_queue_signals_queue_session_id_fkey,
  add constraint help_queue_signals_queue_scope_fkey
    foreign key (queue_session_id, organization_id, class_id)
    references public.help_queue_sessions (id, organization_id, class_id)
    on delete set null (queue_session_id);

alter table public.help_queue_signals
  add column staff_only boolean not null default false,
  add constraint help_queue_signals_staff_shape check (
    not staff_only or student_id is null
  );

create unique index help_queue_signals_one_staff_signal
  on public.help_queue_signals (queue_session_id)
  where queue_session_id is not null and staff_only;

alter table public.help_requests
  add column ownership_changed_at timestamptz,
  add column ownership_version bigint not null default 1,
  add constraint help_requests_ownership_version check (ownership_version >= 1),
  add constraint help_requests_e2_order_scope_unique
    unique (id, organization_id, class_id, queue_session_id);

update public.help_requests
set ownership_changed_at = claimed_at
where status = 'claimed'
  and ownership_changed_at is null;

alter table public.help_requests
  drop constraint help_requests_claimed_fields,
  add constraint help_requests_claimed_fields check (
    (
      status = 'claimed'
      and claimed_by is not null
      and claimed_at is not null
      and ownership_changed_at is not null
    )
    or (
      status = 'waiting'
      and claimed_by is null
      and claimed_at is null
      and ownership_changed_at is null
    )
    or status not in ('claimed', 'waiting')
  );

create function public.bump_help_request_ownership_version()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if new.ownership_version is distinct from old.ownership_version then
    raise exception 'Help request ownership version is managed by the database';
  end if;
  if new.status is distinct from old.status
    or new.claimed_by is distinct from old.claimed_by
  then
    new.ownership_version := old.ownership_version + 1;
  end if;
  return new;
end;
$$;

create trigger help_requests_bump_ownership_version_before_change
before update of status, claimed_by, ownership_version
on public.help_requests
for each row execute function public.bump_help_request_ownership_version();

create function public.normalize_help_request_ownership()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if new.status = 'waiting' then
    new.ownership_changed_at := null;
  end if;
  return new;
end;
$$;

create trigger help_requests_normalize_ownership_before_change
before insert or update of
  status,
  claimed_by,
  claimed_at,
  ownership_changed_at
on public.help_requests
for each row execute function public.normalize_help_request_ownership();

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
    must_validate_claim := (
      new.status in ('claimed', 'resolved')
      and (
        new.status is distinct from old.status
        or new.claimed_by is distinct from old.claimed_by
      )
    ) or (
      new.claimed_by is distinct from old.claimed_by
      and not is_claim_recovery
    );
  elsif new.status in ('claimed', 'resolved') then
    must_validate_claim := true;
  end if;

  if must_validate_claim
    and public.resolve_active_staff_assignment(
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

create table public.help_queue_request_order (
  request_id uuid primary key,
  organization_id uuid not null,
  class_id uuid not null,
  queue_session_id uuid not null,
  position integer,
  active boolean not null default true,
  last_changed_by uuid references auth.users (id) on delete set null,
  last_changed_at timestamptz,
  last_reason_code public.help_queue_priority_reason,
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  foreign key (request_id, organization_id, class_id, queue_session_id)
    references public.help_requests (
      id,
      organization_id,
      class_id,
      queue_session_id
    ) on delete cascade,
  foreign key (queue_session_id, organization_id, class_id)
    references public.help_queue_sessions (id, organization_id, class_id)
    on delete restrict,
  constraint help_queue_request_order_state check (
    (active and position is not null and position >= 1)
    or (not active and position is null)
  ),
  constraint help_queue_request_order_priority_metadata check (
    (
      last_changed_by is null
      and last_changed_at is null
      and last_reason_code is null
    )
    or (last_changed_at is not null and last_reason_code is not null)
  ),
  constraint help_queue_request_order_updated_at check (
    updated_at >= created_at
  ),
  constraint help_queue_request_order_position_unique
    unique (queue_session_id, position)
    deferrable initially deferred
);

insert into public.help_queue_request_order (
  request_id,
  organization_id,
  class_id,
  queue_session_id,
  position,
  active,
  created_at,
  updated_at
)
select
  request.id,
  request.organization_id,
  request.class_id,
  request.queue_session_id,
  row_number() over (
    partition by request.queue_session_id
    order by request.requested_at, request.id
  )::integer,
  true,
  request.requested_at,
  greatest(request.requested_at, request.updated_at)
from public.help_requests as request
where request.queue_session_id is not null
  and request.status in ('waiting', 'claimed');

create index help_queue_request_order_active_queue_idx
  on public.help_queue_request_order (queue_session_id, position, request_id)
  where active;

create function public.sync_help_queue_request_order()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  next_position integer;
  prior_position integer;
begin
  if new.queue_session_id is null then
    return new;
  end if;

  if new.status in ('waiting', 'claimed') then
    select coalesce(max(order_row.position), 0) + 1
    into next_position
    from public.help_queue_request_order as order_row
    where order_row.queue_session_id = new.queue_session_id
      and order_row.active;

    insert into public.help_queue_request_order (
      request_id,
      organization_id,
      class_id,
      queue_session_id,
      position,
      active,
      created_at,
      updated_at
    ) values (
      new.id,
      new.organization_id,
      new.class_id,
      new.queue_session_id,
      next_position,
      true,
      new.requested_at,
      greatest(new.requested_at, new.updated_at)
    )
    on conflict (request_id) do update
    set organization_id = excluded.organization_id,
        class_id = excluded.class_id,
        queue_session_id = excluded.queue_session_id,
        position = coalesce(
          public.help_queue_request_order.position,
          excluded.position
        ),
        active = true,
        updated_at = greatest(
          public.help_queue_request_order.updated_at,
          excluded.updated_at
        );
  else
    select order_row.position
    into prior_position
    from public.help_queue_request_order as order_row
    where order_row.request_id = new.id
      and order_row.active
    for update;

    update public.help_queue_request_order
    set active = false,
        position = null,
        updated_at = greatest(updated_at, new.updated_at)
    where request_id = new.id;

    if prior_position is not null then
      update public.help_queue_request_order
      set position = position - 1,
          updated_at = greatest(updated_at, new.updated_at)
      where queue_session_id = new.queue_session_id
        and active
        and position > prior_position;
    end if;
  end if;

  return new;
end;
$$;

create trigger help_requests_sync_order_after_change
after insert or update of
  status,
  organization_id,
  class_id,
  queue_session_id
on public.help_requests
for each row execute function public.sync_help_queue_request_order();

alter table public.help_queue_request_order enable row level security;
alter table public.help_queue_request_order force row level security;

alter table public.help_queue_command_receipts
  drop constraint help_queue_command_receipts_command,
  add constraint help_queue_command_receipts_command check (
    command in (
      'open_queue',
      'close_queue',
      'request_help',
      'cancel_help',
      'claim_help',
      'resolve_help',
      'reorder_help',
      'release_help',
      'transfer_help'
    )
  );

create function public.touch_help_queue_staff_signal(
  p_queue_session_id uuid
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
    raise exception 'Help queue was not found for staff signal update';
  end if;

  insert into public.help_queue_signals (
    organization_id,
    class_id,
    queue_session_id,
    student_id,
    staff_only
  ) values (
    queue_row.organization_id,
    queue_row.class_id,
    queue_row.id,
    null,
    true
  )
  on conflict (queue_session_id)
    where queue_session_id is not null and staff_only
  do update
  set signal_version = help_queue_signals.signal_version + 1,
      updated_at = greatest(
        help_queue_signals.updated_at,
        clock_timestamp()
      );
end;
$$;

create function public.touch_help_queue_staff_activity(
  p_queue_session_id uuid
)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  next_activity_version bigint;
begin
  update public.help_queue_sessions
  set activity_version = activity_version + 1,
      updated_at = greatest(updated_at, clock_timestamp())
  where id = p_queue_session_id
  returning activity_version into next_activity_version;

  if next_activity_version is null then
    raise exception 'Help queue was not found for staff activity update';
  end if;
  perform public.touch_help_queue_staff_signal(p_queue_session_id);
  return next_activity_version;
end;
$$;

create or replace function public.reconcile_help_queue_sessions(
  p_class_id uuid default null
)
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
        perform public.touch_help_queue_staff_activity(queue_row.id);
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

create function public.lock_help_queue_transfer_assignments(
  p_source_assignment_id uuid,
  p_target_assignment_id uuid,
  p_actor_id uuid,
  p_class_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  assignment_row record;
  source_organization_id uuid;
  source_user_id uuid;
  target_organization_id uuid;
  target_user_id uuid;
  locked_count integer := 0;
begin
  if p_source_assignment_id is null
    or p_target_assignment_id is null
    or p_source_assignment_id = p_target_assignment_id
  then
    raise exception 'Help transfer requires two different staff assignments';
  end if;

  for assignment_row in
    select
      assignment.id,
      assignment.organization_id,
      assignment.user_id
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
     and capability.capability = 'help_queue.manage'
    where assignment.id in (
        p_source_assignment_id,
        p_target_assignment_id
      )
      and scope.class_id = p_class_id
      and assignment.revoked_at is null
      and assignment.starts_at <= transaction_timestamp()
      and (
        assignment.ends_at is null
        or transaction_timestamp() < assignment.ends_at
      )
    order by assignment.id
    for share of assignment, membership
  loop
    locked_count := locked_count + 1;
    if assignment_row.id = p_source_assignment_id then
      source_organization_id := assignment_row.organization_id;
      source_user_id := assignment_row.user_id;
    elsif assignment_row.id = p_target_assignment_id then
      target_organization_id := assignment_row.organization_id;
      target_user_id := assignment_row.user_id;
    end if;
  end loop;

  if locked_count <> 2
    or source_user_id is distinct from p_actor_id
    or source_organization_id is distinct from target_organization_id
    or target_user_id is null
    or target_user_id = p_actor_id
  then
    raise exception 'Staff assignments do not authorize this help transfer';
  end if;

  return jsonb_build_object(
    'organization_id', source_organization_id,
    'target_user_id', target_user_id
  );
end;
$$;

create or replace function public.help_request_result(
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
    'ownership_version', p_request.ownership_version,
    'changed', p_changed
  );
$$;

create function public.help_queue_staff_command_result(
  p_request public.help_requests,
  p_position integer,
  p_activity_version bigint,
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
    'claimed_by', p_request.claimed_by,
    'ownership_version', p_request.ownership_version,
    'position', p_position,
    'activity_version', p_activity_version,
    'changed', p_changed
  );
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
  result jsonb;
  current_position integer;
  target_position integer;
  total_positions integer;
  next_activity_version bigint;
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

  select queue.*
  into queue_row
  from public.help_queue_sessions as queue
  where queue.id = p_queue_session_id;
  select request.*
  into request_row
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
  select request.*
  into request_row
  from public.help_requests as request
  where request.id = p_request_id
    and request.queue_session_id = p_queue_session_id
  for update;

  if queue_row.status not in ('open', 'closing') then
    raise exception 'Help queue is closed';
  end if;
  if queue_row.activity_version <> p_expected_activity_version then
    raise exception 'Help queue activity version is stale';
  end if;
  if request_row.status not in ('waiting', 'claimed') then
    raise exception 'Help request is no longer active';
  end if;

  perform 1
  from public.help_queue_request_order as order_row
  join public.help_requests as active_request
    on active_request.id = order_row.request_id
   and active_request.queue_session_id = order_row.queue_session_id
  where order_row.queue_session_id = p_queue_session_id
    and order_row.active
    and active_request.status in ('waiting', 'claimed')
  order by order_row.position, active_request.requested_at, active_request.id
  for update of order_row, active_request;

  select count(*)::integer
  into total_positions
  from public.help_queue_request_order as order_row
  join public.help_requests as active_request
    on active_request.id = order_row.request_id
   and active_request.queue_session_id = order_row.queue_session_id
  where order_row.queue_session_id = p_queue_session_id
    and order_row.active
    and active_request.status in ('waiting', 'claimed');

  select ranked.position
  into current_position
  from (
    select
      order_row.request_id,
      row_number() over (
        order by
          order_row.position,
          active_request.requested_at,
          active_request.id
      )::integer as position
    from public.help_queue_request_order as order_row
    join public.help_requests as active_request
      on active_request.id = order_row.request_id
     and active_request.queue_session_id = order_row.queue_session_id
    where order_row.queue_session_id = p_queue_session_id
      and order_row.active
      and active_request.status in ('waiting', 'claimed')
  ) as ranked
  where ranked.request_id = p_request_id;

  if current_position is null or total_positions < 1 then
    raise exception 'Help request lacks an active staff order';
  end if;

  target_position := case p_direction
    when 'first' then 1
    when 'up' then greatest(1, current_position - 1)
    when 'down' then least(total_positions, current_position + 1)
  end;

  if target_position = current_position then
    result := public.help_queue_staff_command_result(
      request_row,
      current_position,
      queue_row.activity_version,
      false
    );
    perform public.store_help_queue_command_receipt(
      request_row.organization_id,
      p_actor_id,
      p_command_request_id,
      'reorder_help',
      fingerprint,
      p_queue_session_id,
      result
    );
    return result;
  end if;

  with ranked as (
    select
      order_row.request_id,
      row_number() over (
        order by
          order_row.position,
          active_request.requested_at,
          active_request.id
      )::integer as old_position
    from public.help_queue_request_order as order_row
    join public.help_requests as active_request
      on active_request.id = order_row.request_id
     and active_request.queue_session_id = order_row.queue_session_id
    where order_row.queue_session_id = p_queue_session_id
      and order_row.active
      and active_request.status in ('waiting', 'claimed')
  ), moved as (
    select
      ranked.request_id,
      case
        when ranked.request_id = p_request_id then target_position
        when target_position < current_position
          and ranked.old_position >= target_position
          and ranked.old_position < current_position
        then ranked.old_position + 1
        when target_position > current_position
          and ranked.old_position > current_position
          and ranked.old_position <= target_position
        then ranked.old_position - 1
        else ranked.old_position
      end as new_position
    from ranked
  )
  update public.help_queue_request_order as order_row
  set position = moved.new_position,
      last_changed_by = case
        when order_row.request_id = p_request_id then p_actor_id
        else order_row.last_changed_by
      end,
      last_changed_at = case
        when order_row.request_id = p_request_id then transaction_timestamp()
        else order_row.last_changed_at
      end,
      last_reason_code = case
        when order_row.request_id = p_request_id then p_reason_code
        else order_row.last_reason_code
      end,
      updated_at = case
        when order_row.position is distinct from moved.new_position
        then greatest(order_row.updated_at, clock_timestamp())
        else order_row.updated_at
      end
  from moved
  where order_row.request_id = moved.request_id;

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
    'help.reordered',
    'help_request',
    request_row.id,
    jsonb_build_object(
      'class_id', request_row.class_id,
      'queue_session_id', request_row.queue_session_id,
      'before_position', current_position,
      'after_position', target_position,
      'reason_code', p_reason_code
    ),
    p_staff_assignment_id,
    'help_queue.manage'
  );

  next_activity_version := public.touch_help_queue_staff_activity(
    p_queue_session_id
  );
  result := public.help_queue_staff_command_result(
    request_row,
    target_position,
    next_activity_version,
    true
  );
  perform public.store_help_queue_command_receipt(
    request_row.organization_id,
    p_actor_id,
    p_command_request_id,
    'reorder_help',
    fingerprint,
    p_queue_session_id,
    result
  );
  return result;
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
  queue_row public.help_queue_sessions;
  authorized_organization_id uuid;
  fingerprint text;
  prior_result jsonb;
  result jsonb;
  current_position integer;
  next_activity_version bigint;
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
    'release_help',
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
  select order_row.position
  into current_position
  from public.help_queue_request_order as order_row
  where order_row.request_id = p_request_id
    and order_row.active
  for update;

  if queue_row.status not in ('open', 'closing') then
    raise exception 'Help queue is closed';
  end if;
  if request_row.ownership_version <> p_expected_ownership_version then
    raise exception 'Help request ownership version is stale';
  end if;
  if request_row.status <> 'claimed'
    or request_row.claimed_by is distinct from p_actor_id
  then
    raise exception 'Staff member must own the active help request before releasing it';
  end if;
  if current_position is null then
    raise exception 'Help request lacks an active staff order';
  end if;

  update public.help_requests
  set status = 'waiting',
      claimed_by = null,
      claimed_at = null,
      ownership_changed_at = null,
      updated_at = transaction_timestamp()
  where id = request_row.id
  returning * into request_row;

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
    'help.released',
    'help_request',
    request_row.id,
    jsonb_build_object(
      'class_id', request_row.class_id,
      'queue_session_id', request_row.queue_session_id,
      'position', current_position
    ),
    p_staff_assignment_id,
    'help_queue.manage'
  );

  next_activity_version := public.touch_help_queue_staff_activity(
    request_row.queue_session_id
  );
  result := public.help_queue_staff_command_result(
    request_row,
    current_position,
    next_activity_version,
    true
  );
  perform public.store_help_queue_command_receipt(
    request_row.organization_id,
    p_actor_id,
    p_command_request_id,
    'release_help',
    fingerprint,
    request_row.queue_session_id,
    result
  );
  return result;
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
  queue_row public.help_queue_sessions;
  transfer_scope jsonb;
  target_user_id uuid;
  fingerprint text;
  prior_result jsonb;
  result jsonb;
  current_position integer;
  next_activity_version bigint;
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

  select request.*
  into request_row
  from public.help_requests as request
  where request.id = p_request_id;
  if request_row.id is null or request_row.queue_session_id is null then
    raise exception 'Session help request was not found';
  end if;

  prior_result := public.read_help_queue_command_receipt(
    p_actor_id,
    p_command_request_id,
    'transfer_help',
    fingerprint
  );
  if prior_result is not null then
    if public.lock_staff_assignment_authorization(
      p_staff_assignment_id,
      p_actor_id,
      request_row.class_id,
      'help_queue.manage'
    ) is distinct from request_row.organization_id then
      raise exception 'Staff assignment does not authorize help queue management';
    end if;
    return prior_result;
  end if;

  transfer_scope := public.lock_help_queue_transfer_assignments(
    p_staff_assignment_id,
    p_target_staff_assignment_id,
    p_actor_id,
    request_row.class_id
  );
  if transfer_scope ->> 'organization_id' <> request_row.organization_id::text then
    raise exception 'Staff assignments do not authorize this help transfer';
  end if;
  target_user_id := (transfer_scope ->> 'target_user_id')::uuid;

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
  select order_row.position
  into current_position
  from public.help_queue_request_order as order_row
  where order_row.request_id = p_request_id
    and order_row.active
  for update;

  if queue_row.status not in ('open', 'closing') then
    raise exception 'Help queue is closed';
  end if;
  if request_row.ownership_version <> p_expected_ownership_version then
    raise exception 'Help request ownership version is stale';
  end if;
  if request_row.status <> 'claimed'
    or request_row.claimed_by is distinct from p_actor_id
  then
    raise exception 'Staff member must own the active help request before transferring it';
  end if;
  if current_position is null then
    raise exception 'Help request lacks an active staff order';
  end if;

  update public.help_requests
  set claimed_by = target_user_id,
      ownership_changed_at = transaction_timestamp(),
      updated_at = transaction_timestamp()
  where id = request_row.id
  returning * into request_row;

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
    'help.transferred',
    'help_request',
    request_row.id,
    jsonb_build_object(
      'class_id', request_row.class_id,
      'queue_session_id', request_row.queue_session_id,
      'position', current_position,
      'from_actor_id', p_actor_id,
      'to_actor_id', target_user_id,
      'target_staff_assignment_id', p_target_staff_assignment_id
    ),
    p_staff_assignment_id,
    'help_queue.manage'
  );

  next_activity_version := public.touch_help_queue_staff_activity(
    request_row.queue_session_id
  );
  result := public.help_queue_staff_command_result(
    request_row,
    current_position,
    next_activity_version,
    true
  );
  perform public.store_help_queue_command_receipt(
    request_row.organization_id,
    p_actor_id,
    p_command_request_id,
    'transfer_help',
    fingerprint,
    request_row.queue_session_id,
    result
  );
  return result;
end;
$$;

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
  queue_row public.help_queue_sessions;
  authorized_organization_id uuid;
  fingerprint text;
  prior_result jsonb;
  result jsonb;
  changed boolean := false;
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
  if request_row.ownership_version <> p_expected_ownership_version then
    raise exception 'Help request ownership version is stale';
  end if;

  if request_row.status = 'waiting' then
    update public.help_requests
    set status = 'claimed',
        claimed_by = p_actor_id,
        claimed_at = transaction_timestamp(),
        ownership_changed_at = transaction_timestamp(),
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
    perform public.touch_help_queue_staff_activity(
      request_row.queue_session_id
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
  queue_row public.help_queue_sessions;
  authorized_organization_id uuid;
  fingerprint text;
  prior_result jsonb;
  result jsonb;
  changed boolean := false;
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

  if queue_row.status not in ('open', 'closing') then
    raise exception 'Help queue is closed';
  end if;
  if request_row.ownership_version <> p_expected_ownership_version then
    raise exception 'Help request ownership version is stale';
  end if;
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

create function public.read_help_queue_staff_snapshot_v1(
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
  select jsonb_build_object(
    'queue', jsonb_build_object(
      'id', queue.id,
      'organization_id', queue.organization_id,
      'class_id', queue.class_id,
      'revision_session_id', queue.revision_session_id,
      'status', queue.status,
      'lock_version', queue.lock_version,
      'activity_version', queue.activity_version
    ),
    'order_rows', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'request_id', queue_order.request_id,
            'position', queue_order.position,
            'last_changed_by', queue_order.last_changed_by,
            'last_changed_at', queue_order.last_changed_at,
            'last_reason_code', queue_order.last_reason_code
          )
          order by queue_order.position, queue_order.request_id
        )
        from public.help_queue_request_order as queue_order
        where queue_order.organization_id = queue.organization_id
          and queue_order.class_id = queue.class_id
          and queue_order.queue_session_id = queue.id
          and queue_order.active
      ),
      '[]'::jsonb
    ),
    'request_rows', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', request.id,
            'student_id', request.student_id,
            'status', request.status,
            'requested_at', request.requested_at,
            'claimed_by', request.claimed_by,
            'task_assignment_id', request.task_assignment_id,
            'ownership_version', request.ownership_version
          )
          order by request.id
        )
        from public.help_requests as request
        where request.organization_id = queue.organization_id
          and request.class_id = queue.class_id
          and request.queue_session_id = queue.id
          and request.status in ('waiting', 'claimed')
      ),
      '[]'::jsonb
    )
  )
  from public.help_queue_sessions as queue
  where queue.id = p_queue_session_id
    and queue.organization_id = p_organization_id
    and queue.class_id = p_class_id;
$$;

revoke all on table public.help_queue_request_order
from public, anon, authenticated, service_role;
grant select on table public.help_queue_request_order to service_role;

revoke all on function public.read_help_queue_staff_snapshot_v1(
  uuid, uuid, uuid
) from public, anon, authenticated, service_role;

revoke all on function public.normalize_help_request_ownership()
from public, anon, authenticated, service_role;
revoke all on function public.validate_help_request_roles()
from public, anon, authenticated, service_role;
revoke all on function public.bump_help_request_ownership_version()
from public, anon, authenticated, service_role;
revoke all on function public.sync_help_queue_request_order()
from public, anon, authenticated, service_role;
revoke all on function public.touch_help_queue_staff_signal(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.touch_help_queue_staff_activity(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.lock_help_queue_transfer_assignments(
  uuid, uuid, uuid, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.help_queue_staff_command_result(
  public.help_requests, integer, bigint, boolean
) from public, anon, authenticated, service_role;
revoke all on function public.help_request_result(
  public.help_requests, boolean
) from public, anon, authenticated, service_role;

revoke all on function public.reorder_student_help_v1(
  uuid,
  uuid,
  text,
  public.help_queue_priority_reason,
  bigint,
  uuid,
  uuid,
  uuid
) from public, anon, authenticated, service_role;
revoke all on function public.release_student_help_v1(
  uuid, bigint, uuid, uuid, uuid
)
from public, anon, authenticated, service_role;
revoke all on function public.transfer_student_help_v1(
  uuid, bigint, uuid, uuid, uuid, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.claim_student_help_v2(uuid, uuid, uuid, uuid)
from public, anon, authenticated, service_role;
revoke all on function public.resolve_student_help_v2(uuid, uuid, uuid, uuid)
from public, anon, authenticated, service_role;
revoke all on function public.claim_student_help_v3(
  uuid, bigint, uuid, uuid, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.resolve_student_help_v3(
  uuid, bigint, uuid, uuid, uuid
) from public, anon, authenticated, service_role;

grant execute on function public.reorder_student_help_v1(
  uuid,
  uuid,
  text,
  public.help_queue_priority_reason,
  bigint,
  uuid,
  uuid,
  uuid
) to service_role;
grant execute on function public.release_student_help_v1(
  uuid, bigint, uuid, uuid, uuid
)
to service_role;
grant execute on function public.transfer_student_help_v1(
  uuid, bigint, uuid, uuid, uuid, uuid
) to service_role;
grant execute on function public.claim_student_help_v3(
  uuid, bigint, uuid, uuid, uuid
) to service_role;
grant execute on function public.resolve_student_help_v3(
  uuid, bigint, uuid, uuid, uuid
) to service_role;
grant execute on function public.read_help_queue_staff_snapshot_v1(
  uuid, uuid, uuid
) to service_role;

commit;
