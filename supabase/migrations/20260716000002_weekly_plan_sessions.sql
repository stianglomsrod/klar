begin;

create table public.weekly_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  class_id uuid not null,
  week_start_date date not null,
  timezone_name text not null default 'Europe/Oslo',
  active_revision_id uuid,
  lock_version integer not null default 0,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  unique (id, organization_id, class_id),
  unique (organization_id, class_id, week_start_date),
  foreign key (class_id, organization_id)
    references public.classes (id, organization_id) on delete restrict,
  constraint weekly_plans_monday_start
    check (extract(isodow from week_start_date) = 1),
  constraint weekly_plans_timezone
    check (timezone_name = 'Europe/Oslo'),
  constraint weekly_plans_lock_version check (lock_version >= 0),
  constraint weekly_plans_active_version_pair check (
    (active_revision_id is null and lock_version = 0)
    or (active_revision_id is not null and lock_version > 0)
  )
);

create table public.plan_revisions (
  id uuid primary key default gen_random_uuid(),
  weekly_plan_id uuid not null,
  organization_id uuid not null,
  class_id uuid not null,
  revision_number integer not null,
  previous_revision_id uuid,
  snapshot_schema_version text not null default 'weekly_plan_v1',
  snapshot jsonb not null,
  semantic_hash text not null,
  published_by uuid not null references auth.users (id) on delete restrict,
  authorizing_staff_assignment_id uuid not null,
  published_at timestamptz not null default transaction_timestamp(),
  unique (id, weekly_plan_id, organization_id, class_id),
  unique (id, weekly_plan_id),
  unique (weekly_plan_id, revision_number),
  foreign key (weekly_plan_id, organization_id, class_id)
    references public.weekly_plans (id, organization_id, class_id)
    on delete restrict,
  foreign key (previous_revision_id, weekly_plan_id)
    references public.plan_revisions (id, weekly_plan_id)
    on delete restrict,
  foreign key (authorizing_staff_assignment_id, organization_id, published_by)
    references public.staff_assignments (id, organization_id, user_id)
    on delete restrict,
  constraint plan_revisions_number check (revision_number >= 1),
  constraint plan_revisions_previous check (
    (revision_number = 1 and previous_revision_id is null)
    or (revision_number > 1 and previous_revision_id is not null)
  ),
  constraint plan_revisions_schema
    check (snapshot_schema_version = 'weekly_plan_v1'),
  constraint plan_revisions_snapshot check (
    jsonb_typeof(snapshot) = 'object'
    and pg_column_size(snapshot) <= 262144
  ),
  constraint plan_revisions_semantic_hash
    check (semantic_hash ~ '^[0-9a-f]{64}$')
);

alter table public.weekly_plans
  add constraint weekly_plans_active_revision_fk
  foreign key (active_revision_id, id, organization_id, class_id)
  references public.plan_revisions (
    id,
    weekly_plan_id,
    organization_id,
    class_id
  ) on delete restrict;

create table public.teaching_sessions (
  id uuid primary key default gen_random_uuid(),
  weekly_plan_id uuid not null,
  organization_id uuid not null,
  class_id uuid not null,
  logical_key uuid not null,
  created_at timestamptz not null default transaction_timestamp(),
  unique (id, weekly_plan_id, organization_id, class_id),
  unique (weekly_plan_id, logical_key),
  foreign key (weekly_plan_id, organization_id, class_id)
    references public.weekly_plans (id, organization_id, class_id)
    on delete restrict
);

create table public.plan_tasks (
  id uuid primary key default gen_random_uuid(),
  weekly_plan_id uuid not null,
  organization_id uuid not null,
  class_id uuid not null,
  logical_key uuid not null,
  created_at timestamptz not null default transaction_timestamp(),
  unique (id, weekly_plan_id, organization_id, class_id),
  unique (weekly_plan_id, logical_key),
  foreign key (weekly_plan_id, organization_id, class_id)
    references public.weekly_plans (id, organization_id, class_id)
    on delete restrict
);

create table public.plan_revision_sessions (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null,
  weekly_plan_id uuid not null,
  organization_id uuid not null,
  class_id uuid not null,
  teaching_session_id uuid not null,
  title text not null,
  subject text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  position integer not null,
  created_at timestamptz not null default transaction_timestamp(),
  unique (id, revision_id, weekly_plan_id, organization_id, class_id),
  unique (revision_id, teaching_session_id),
  unique (revision_id, position),
  foreign key (revision_id, weekly_plan_id, organization_id, class_id)
    references public.plan_revisions (
      id,
      weekly_plan_id,
      organization_id,
      class_id
    ) on delete restrict,
  foreign key (teaching_session_id, weekly_plan_id, organization_id, class_id)
    references public.teaching_sessions (
      id,
      weekly_plan_id,
      organization_id,
      class_id
    ) on delete restrict,
  constraint plan_revision_sessions_title_length
    check (char_length(title) between 1 and 120),
  constraint plan_revision_sessions_subject_length
    check (subject is null or char_length(subject) between 1 and 80),
  constraint plan_revision_sessions_time check (ends_at > starts_at),
  constraint plan_revision_sessions_position check (position >= 0)
);

create table public.plan_revision_tasks (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null,
  weekly_plan_id uuid not null,
  organization_id uuid not null,
  class_id uuid not null,
  revision_session_id uuid not null,
  plan_task_id uuid not null,
  task_definition_id uuid not null,
  position integer not null,
  content_hash text not null,
  visible_from timestamptz not null,
  due_at timestamptz,
  created_at timestamptz not null default transaction_timestamp(),
  unique (
    id,
    plan_task_id,
    organization_id,
    class_id,
    task_definition_id
  ),
  unique (revision_id, plan_task_id),
  unique (revision_session_id, position),
  foreign key (revision_id, weekly_plan_id, organization_id, class_id)
    references public.plan_revisions (
      id,
      weekly_plan_id,
      organization_id,
      class_id
    ) on delete restrict,
  foreign key (
    revision_session_id,
    revision_id,
    weekly_plan_id,
    organization_id,
    class_id
  ) references public.plan_revision_sessions (
    id,
    revision_id,
    weekly_plan_id,
    organization_id,
    class_id
  ) on delete restrict,
  foreign key (plan_task_id, weekly_plan_id, organization_id, class_id)
    references public.plan_tasks (
      id,
      weekly_plan_id,
      organization_id,
      class_id
    ) on delete restrict,
  foreign key (task_definition_id, class_id, organization_id)
    references public.task_definitions (id, class_id, organization_id)
    on delete restrict,
  constraint plan_revision_tasks_position check (position >= 0),
  constraint plan_revision_tasks_content_hash
    check (content_hash ~ '^[0-9a-f]{32}$'),
  constraint plan_revision_tasks_due check (
    due_at is null or due_at >= visible_from
  )
);

alter table public.task_assignments
  add column plan_task_id uuid,
  add column source_plan_revision_task_id uuid,
  add constraint task_assignments_plan_link_pair check (
    (plan_task_id is null and source_plan_revision_task_id is null)
    or (plan_task_id is not null and source_plan_revision_task_id is not null)
  ),
  add constraint task_assignments_plan_revision_task_fk
    foreign key (
      source_plan_revision_task_id,
      plan_task_id,
      organization_id,
      class_id,
      task_definition_id
    ) references public.plan_revision_tasks (
      id,
      plan_task_id,
      organization_id,
      class_id,
      task_definition_id
    ) on delete restrict;

create unique index task_assignments_plan_task_student_unique
  on public.task_assignments (plan_task_id, student_id)
  where plan_task_id is not null;

create table public.weekly_plan_publish_receipts (
  organization_id uuid not null,
  class_id uuid not null,
  actor_id uuid not null references auth.users (id) on delete restrict,
  request_id uuid not null,
  weekly_plan_id uuid not null,
  revision_id uuid not null,
  request_fingerprint text not null,
  result jsonb not null,
  created_at timestamptz not null default transaction_timestamp(),
  primary key (actor_id, request_id),
  foreign key (weekly_plan_id, organization_id, class_id)
    references public.weekly_plans (id, organization_id, class_id)
    on delete restrict,
  foreign key (revision_id, weekly_plan_id, organization_id, class_id)
    references public.plan_revisions (
      id,
      weekly_plan_id,
      organization_id,
      class_id
    ) on delete restrict,
  constraint weekly_plan_publish_receipts_fingerprint
    check (request_fingerprint ~ '^[0-9a-f]{32}$'),
  constraint weekly_plan_publish_receipts_result check (
    jsonb_typeof(result) = 'object'
    and pg_column_size(result) <= 8192
  )
);

create index weekly_plans_class_week_idx
  on public.weekly_plans (class_id, week_start_date desc);
create index plan_revision_sessions_active_day_idx
  on public.plan_revision_sessions (revision_id, starts_at, ends_at);
create index plan_revision_tasks_session_position_idx
  on public.plan_revision_tasks (revision_session_id, position);

create function public.prevent_weekly_plan_history_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Published weekly plan history is immutable';
end;
$$;

create trigger plan_revisions_immutable
before update or delete on public.plan_revisions
for each row execute function public.prevent_weekly_plan_history_mutation();

create trigger teaching_sessions_immutable
before update or delete on public.teaching_sessions
for each row execute function public.prevent_weekly_plan_history_mutation();

create trigger plan_tasks_immutable
before update or delete on public.plan_tasks
for each row execute function public.prevent_weekly_plan_history_mutation();

create trigger plan_revision_sessions_immutable
before update or delete on public.plan_revision_sessions
for each row execute function public.prevent_weekly_plan_history_mutation();

create trigger plan_revision_tasks_immutable
before update or delete on public.plan_revision_tasks
for each row execute function public.prevent_weekly_plan_history_mutation();

create trigger weekly_plan_publish_receipts_immutable
before update or delete on public.weekly_plan_publish_receipts
for each row execute function public.prevent_weekly_plan_history_mutation();

create function public.protect_plan_linked_task_definition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.plan_revision_tasks as revision_task
    where revision_task.task_definition_id = old.id
  ) then
    raise exception 'A task version linked to a published plan is immutable';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger task_definitions_protect_plan_version
before update or delete on public.task_definitions
for each row execute function public.protect_plan_linked_task_definition();

create function public.protect_task_assignment_plan_link()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.plan_task_id is distinct from old.plan_task_id
    or new.source_plan_revision_task_id
      is distinct from old.source_plan_revision_task_id
  then
    raise exception 'Task assignment plan provenance is immutable';
  end if;
  return new;
end;
$$;

create trigger task_assignments_protect_plan_link
before update on public.task_assignments
for each row execute function public.protect_task_assignment_plan_link();

create function public.publish_initial_weekly_plan(
  p_class_id uuid,
  p_actor_id uuid,
  p_staff_assignment_id uuid,
  p_week_start_date date,
  p_timezone_name text,
  p_expected_lock_version integer,
  p_request_id uuid,
  p_semantic_hash text,
  p_candidate jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  target_organization_id uuid;
  plan_row public.weekly_plans;
  existing_receipt public.weekly_plan_publish_receipts;
  active_revision public.plan_revisions;
  revision_id uuid;
  revision_result jsonb;
  request_fingerprint text;
  session_item jsonb;
  task_item jsonb;
  session_ordinal bigint;
  task_ordinal bigint;
  session_identity_id uuid;
  revision_session_id uuid;
  plan_task_identity_id uuid;
  task_definition_id uuid;
  revision_task_id uuid;
  session_start timestamptz;
  session_end timestamptz;
  session_visible_from timestamptz;
  recipient_student_ids uuid[] := '{}'::uuid[];
  session_count integer;
  task_count integer := 0;
  global_task_position integer := 0;
  task_title text;
  task_description text;
  task_subject text;
  task_support_level smallint;
  task_estimated_minutes smallint;
begin
  if p_request_id is null then
    raise exception 'Weekly plan request id is required';
  end if;
  if p_semantic_hash is null or p_semantic_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Weekly plan semantic hash is invalid';
  end if;
  if p_week_start_date is null
    or extract(isodow from p_week_start_date) <> 1
  then
    raise exception 'Weekly plan must start on a Monday';
  end if;
  if p_timezone_name <> 'Europe/Oslo' then
    raise exception 'Unsupported weekly plan timezone';
  end if;
  if p_expected_lock_version <> 0 then
    raise exception 'Initial weekly plan publication expects lock version 0';
  end if;
  if jsonb_typeof(p_candidate) <> 'object'
    or p_candidate ->> 'schema_version' <> 'weekly_plan_v1'
    or jsonb_typeof(p_candidate -> 'sessions') <> 'array'
  then
    raise exception 'Weekly plan candidate must contain sessions';
  end if;

  session_count := jsonb_array_length(p_candidate -> 'sessions');
  if session_count < 1 or session_count > 30 then
    raise exception 'Weekly plan must contain between 1 and 30 sessions';
  end if;

  request_fingerprint := md5(
    p_class_id::text || '|' ||
    p_week_start_date::text || '|' ||
    p_timezone_name || '|' ||
    p_expected_lock_version::text || '|' ||
    p_semantic_hash || '|' ||
    p_candidate::text
  );

  perform pg_advisory_xact_lock(
    hashtextextended(p_actor_id::text || ':' || p_request_id::text, 0)
  );

  select receipt.*
  into existing_receipt
  from public.weekly_plan_publish_receipts as receipt
  where receipt.actor_id = p_actor_id
    and receipt.request_id = p_request_id;

  if existing_receipt.request_id is not null then
    if existing_receipt.class_id = p_class_id
      and existing_receipt.request_fingerprint = request_fingerprint
    then
      return existing_receipt.result;
    end if;
    raise exception 'Weekly plan request id was already used with another payload';
  end if;

  target_organization_id := public.lock_staff_assignment_authorization(
    p_staff_assignment_id,
    p_actor_id,
    p_class_id,
    'plan.publish'
  );
  if target_organization_id is null then
    raise exception 'Staff assignment does not authorize weekly plan publishing';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      target_organization_id::text || ':' || p_class_id::text || ':' ||
      p_week_start_date::text,
      0
    )
  );

  select plan.*
  into plan_row
  from public.weekly_plans as plan
  where plan.organization_id = target_organization_id
    and plan.class_id = p_class_id
    and plan.week_start_date = p_week_start_date
  for update;

  if plan_row.id is null then
    insert into public.weekly_plans (
      organization_id,
      class_id,
      week_start_date,
      timezone_name,
      created_by
    ) values (
      target_organization_id,
      p_class_id,
      p_week_start_date,
      p_timezone_name,
      p_actor_id
    ) returning * into plan_row;
  elsif plan_row.timezone_name <> p_timezone_name then
    raise exception 'Weekly plan timezone cannot be changed';
  end if;

  if plan_row.active_revision_id is not null then
    select revision.*
    into active_revision
    from public.plan_revisions as revision
    where revision.id = plan_row.active_revision_id;

    if active_revision.semantic_hash = p_semantic_hash
      and active_revision.snapshot = p_candidate
    then
      revision_result := jsonb_build_object(
        'request_id', p_request_id,
        'weekly_plan_id', plan_row.id,
        'revision_id', active_revision.id,
        'lock_version', plan_row.lock_version,
        'already_published', true,
        'session_count', jsonb_array_length(p_candidate -> 'sessions'),
        'task_count', (
          select count(*)
          from public.plan_revision_tasks as existing_task
          where existing_task.revision_id = active_revision.id
        )
      );

      insert into public.weekly_plan_publish_receipts (
        organization_id,
        class_id,
        actor_id,
        request_id,
        weekly_plan_id,
        revision_id,
        request_fingerprint,
        result
      ) values (
        target_organization_id,
        p_class_id,
        p_actor_id,
        p_request_id,
        plan_row.id,
        active_revision.id,
        request_fingerprint,
        revision_result
      );
      return revision_result;
    end if;

    raise exception 'A different weekly plan is already published for this class and week; revisions arrive in C2';
  end if;

  if plan_row.lock_version <> p_expected_lock_version then
    raise exception 'Weekly plan version is stale';
  end if;

  perform class_membership.user_id
  from public.class_memberships as class_membership
  where class_membership.class_id = p_class_id
    and class_membership.organization_id = target_organization_id
    and class_membership.role = 'student'
  for share;

  select coalesce(
    array_agg(class_membership.user_id order by class_membership.user_id),
    '{}'::uuid[]
  )
  into recipient_student_ids
  from public.class_memberships as class_membership
  where class_membership.class_id = p_class_id
    and class_membership.organization_id = target_organization_id
    and class_membership.role = 'student';

  insert into public.plan_revisions (
    weekly_plan_id,
    organization_id,
    class_id,
    revision_number,
    snapshot,
    semantic_hash,
    published_by,
    authorizing_staff_assignment_id
  ) values (
    plan_row.id,
    target_organization_id,
    p_class_id,
    1,
    p_candidate,
    p_semantic_hash,
    p_actor_id,
    p_staff_assignment_id
  ) returning id into revision_id;

  for session_item, session_ordinal in
    select value, ordinality
    from jsonb_array_elements(p_candidate -> 'sessions') with ordinality
  loop
    if (session_item ->> 'logical_key') is null
      or (session_item ->> 'logical_key') !~
        '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then
      raise exception 'Session logical key is invalid';
    end if;
    if length(trim(coalesce(session_item ->> 'title', ''))) not between 1 and 120 then
      raise exception 'Session title is invalid';
    end if;
    if length(trim(coalesce(session_item ->> 'subject', ''))) > 80 then
      raise exception 'Session subject is invalid';
    end if;
    if (session_item ->> 'starts_at') is null
      or (session_item ->> 'ends_at') is null
    then
      raise exception 'Session time is required';
    end if;

    begin
      session_start := (session_item ->> 'starts_at')::timestamptz;
      session_end := (session_item ->> 'ends_at')::timestamptz;
    exception when others then
      raise exception 'Session time is invalid';
    end;

    if session_end <= session_start then
      raise exception 'Session end must be after start';
    end if;
    session_visible_from := (
      (session_start at time zone p_timezone_name)::date::timestamp
      at time zone p_timezone_name
    );
    if (session_start at time zone p_timezone_name)::date < p_week_start_date
      or (session_start at time zone p_timezone_name)::date > p_week_start_date + 6
      or (session_end at time zone p_timezone_name)::date
        <> (session_start at time zone p_timezone_name)::date
    then
      raise exception 'Session must be contained in the selected local week and day';
    end if;
    if exists (
      select 1
      from public.plan_revision_sessions as existing_session
      where existing_session.revision_id = revision_id
        and existing_session.starts_at < session_end
        and session_start < existing_session.ends_at
    ) then
      raise exception 'Sessions cannot overlap';
    end if;
    if jsonb_typeof(session_item -> 'tasks') <> 'array'
      or jsonb_array_length(session_item -> 'tasks') > 20
    then
      raise exception 'Each session must contain between 0 and 20 tasks';
    end if;

    insert into public.teaching_sessions (
      weekly_plan_id,
      organization_id,
      class_id,
      logical_key
    ) values (
      plan_row.id,
      target_organization_id,
      p_class_id,
      (session_item ->> 'logical_key')::uuid
    ) returning id into session_identity_id;

    insert into public.plan_revision_sessions (
      revision_id,
      weekly_plan_id,
      organization_id,
      class_id,
      teaching_session_id,
      title,
      subject,
      starts_at,
      ends_at,
      position
    ) values (
      revision_id,
      plan_row.id,
      target_organization_id,
      p_class_id,
      session_identity_id,
      trim(session_item ->> 'title'),
      nullif(trim(session_item ->> 'subject'), ''),
      session_start,
      session_end,
      session_ordinal - 1
    ) returning id into revision_session_id;

    for task_item, task_ordinal in
      select value, ordinality
      from jsonb_array_elements(session_item -> 'tasks') with ordinality
    loop
      task_count := task_count + 1;
      if task_count > 100 then
        raise exception 'Weekly plan cannot contain more than 100 tasks';
      end if;
      if (task_item ->> 'logical_key') is null
        or (task_item ->> 'logical_key') !~
          '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then
        raise exception 'Task logical key is invalid';
      end if;

      task_title := regexp_replace(
        trim(coalesce(task_item ->> 'title', '')),
        '\s+',
        ' ',
        'g'
      );
      task_description := nullif(trim(task_item ->> 'description'), '');
      task_subject := nullif(
        trim(coalesce(task_item ->> 'subject', session_item ->> 'subject')),
        ''
      );
      task_support_level := coalesce(
        nullif(task_item ->> 'support_level', '')::smallint,
        2
      );
      task_estimated_minutes := nullif(
        task_item ->> 'estimated_minutes',
        ''
      )::smallint;

      if length(task_title) not between 1 and 160 then
        raise exception 'Task title is invalid';
      end if;
      if task_description is not null and length(task_description) > 4000 then
        raise exception 'Task description is invalid';
      end if;
      if task_subject is not null and length(task_subject) > 80 then
        raise exception 'Task subject is invalid';
      end if;
      if task_support_level not between 1 and 3 then
        raise exception 'Task support level is invalid';
      end if;
      if task_estimated_minutes is not null
        and task_estimated_minutes not between 1 and 480
      then
        raise exception 'Task estimate is invalid';
      end if;

      insert into public.plan_tasks (
        weekly_plan_id,
        organization_id,
        class_id,
        logical_key
      ) values (
        plan_row.id,
        target_organization_id,
        p_class_id,
        (task_item ->> 'logical_key')::uuid
      ) returning id into plan_task_identity_id;

      insert into public.task_definitions (
        organization_id,
        class_id,
        title,
        description,
        subject,
        estimated_minutes,
        support_level,
        position,
        publication_status,
        created_by,
        published_at
      ) values (
        target_organization_id,
        p_class_id,
        task_title,
        task_description,
        task_subject,
        task_estimated_minutes,
        task_support_level,
        global_task_position,
        'published',
        p_actor_id,
        transaction_timestamp()
      ) returning id into task_definition_id;

      insert into public.plan_revision_tasks (
        revision_id,
        weekly_plan_id,
        organization_id,
        class_id,
        revision_session_id,
        plan_task_id,
        task_definition_id,
        position,
        content_hash,
        visible_from,
        due_at
      ) values (
        revision_id,
        plan_row.id,
        target_organization_id,
        p_class_id,
        revision_session_id,
        plan_task_identity_id,
        task_definition_id,
        task_ordinal - 1,
        md5(jsonb_build_object(
          'title', task_title,
          'description', task_description,
          'subject', task_subject,
          'estimated_minutes', task_estimated_minutes,
          'support_level', task_support_level
        )::text),
        session_visible_from,
        session_end
      ) returning id into revision_task_id;

      insert into public.task_assignments (
        organization_id,
        class_id,
        task_definition_id,
        student_id,
        assigned_by,
        visible_from,
        due_at,
        plan_task_id,
        source_plan_revision_task_id
      )
      select
        target_organization_id,
        p_class_id,
        task_definition_id,
        recipient.student_id,
        p_actor_id,
        session_visible_from,
        session_end,
        plan_task_identity_id,
        revision_task_id
      from unnest(recipient_student_ids) as recipient(student_id);

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
      where assignment.source_plan_revision_task_id = revision_task_id;

      global_task_position := global_task_position + 1;
    end loop;
  end loop;

  update public.weekly_plans
  set active_revision_id = revision_id,
      lock_version = 1,
      updated_at = transaction_timestamp()
  where id = plan_row.id
    and lock_version = 0;
  if not found then
    raise exception 'Weekly plan version is stale';
  end if;

  revision_result := jsonb_build_object(
    'request_id', p_request_id,
    'weekly_plan_id', plan_row.id,
    'revision_id', revision_id,
    'lock_version', 1,
    'already_published', false,
    'session_count', session_count,
    'task_count', task_count
  );

  insert into public.weekly_plan_publish_receipts (
    organization_id,
    class_id,
    actor_id,
    request_id,
    weekly_plan_id,
    revision_id,
    request_fingerprint,
    result
  ) values (
    target_organization_id,
    p_class_id,
    p_actor_id,
    p_request_id,
    plan_row.id,
    revision_id,
    request_fingerprint,
    revision_result
  );

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
    target_organization_id,
    p_actor_id,
    'weekly_plan.published',
    'plan_revision',
    revision_id,
    jsonb_build_object(
      'class_id', p_class_id,
      'weekly_plan_id', plan_row.id,
      'week_start_date', p_week_start_date,
      'semantic_hash', p_semantic_hash,
      'session_count', session_count,
      'task_count', task_count,
      'lock_version', 1
    ),
    p_staff_assignment_id,
    'plan.publish'
  );

  return revision_result;
end;
$$;

create function public.get_student_day_projection_at(
  p_organization_id uuid,
  p_student_id uuid,
  p_reference_at timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with eligible_sessions as (
    select
      revision_session.id,
      revision_session.organization_id,
      revision_session.class_id,
      revision_session.title,
      revision_session.subject,
      revision_session.starts_at,
      revision_session.ends_at,
      revision_session.position,
      plan.timezone_name,
      case
        when revision_session.starts_at <= p_reference_at
          and p_reference_at < revision_session.ends_at then 'current'
        when revision_session.ends_at <= p_reference_at then 'previous'
        else 'next'
      end as temporal_relation
    from public.class_memberships as student_membership
    join public.weekly_plans as plan
      on plan.class_id = student_membership.class_id
     and plan.organization_id = student_membership.organization_id
     and plan.active_revision_id is not null
    join public.plan_revision_sessions as revision_session
      on revision_session.revision_id = plan.active_revision_id
     and revision_session.weekly_plan_id = plan.id
     and revision_session.organization_id = plan.organization_id
     and revision_session.class_id = plan.class_id
    where student_membership.user_id = p_student_id
      and student_membership.organization_id = p_organization_id
      and student_membership.role = 'student'
      and (revision_session.starts_at at time zone plan.timezone_name)::date
        = (p_reference_at at time zone plan.timezone_name)::date
  ),
  chosen_sessions as (
    (select session.*
     from eligible_sessions as session
     where session.temporal_relation = 'previous'
     order by session.ends_at desc, session.id
     limit 1)
    union all
    (select session.*
     from eligible_sessions as session
     where session.temporal_relation = 'current'
     order by session.starts_at, session.id
     limit 1)
    union all
    (select session.*
     from eligible_sessions as session
     where session.temporal_relation = 'next'
     order by session.starts_at, session.id
     limit 1)
  ),
  projection as (
    select
      chosen.id,
      chosen.organization_id,
      chosen.class_id,
      chosen.title,
      chosen.subject,
      chosen.starts_at,
      chosen.ends_at,
      chosen.position,
      chosen.timezone_name,
      chosen.temporal_relation,
      case chosen.temporal_relation
        when 'previous' then 0
        when 'current' then 1
        else 2
      end as relation_position,
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'assignment_id', assignment.id,
            'title', task_definition.title,
            'description', task_definition.description,
            'subject', task_definition.subject,
            'estimated_minutes', task_definition.estimated_minutes,
            'support_level', task_definition.support_level,
            'points_value', assignment.points_value_snapshot,
            'status', task_state.status,
            'reopen_message', case
              when task_state.status <> 'reopened' then null
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
            'due_at', assignment.due_at
          ) order by revision_task.position, revision_task.id
        )
        from public.plan_revision_tasks as revision_task
        join public.task_assignments as assignment
          on assignment.source_plan_revision_task_id = revision_task.id
         and assignment.plan_task_id = revision_task.plan_task_id
         and assignment.student_id = p_student_id
         and assignment.visible_from <= p_reference_at
        join public.task_definitions as task_definition
          on task_definition.id = assignment.task_definition_id
         and task_definition.publication_status = 'published'
        join public.student_task_state as task_state
          on task_state.assignment_id = assignment.id
         and task_state.student_id = p_student_id
        left join public.task_state_transitions as reopen_transition
          on reopen_transition.id = task_state.last_transition_id
         and reopen_transition.organization_id = assignment.organization_id
         and reopen_transition.student_id = p_student_id
         and reopen_transition.assignment_id = assignment.id
        where revision_task.revision_session_id = chosen.id
      ), '[]'::jsonb) as tasks
    from chosen_sessions as chosen
  )
  select jsonb_build_object(
    'reference_at', p_reference_at,
    'local_date', coalesce(
      (p_reference_at at time zone (select timezone_name from projection limit 1))::date,
      (p_reference_at at time zone 'Europe/Oslo')::date
    ),
    'timezone', coalesce(
      (select timezone_name from projection limit 1),
      'Europe/Oslo'
    ),
    'sessions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', item.id,
          'class_id', item.class_id,
          'title', item.title,
          'subject', item.subject,
          'starts_at', item.starts_at,
          'ends_at', item.ends_at,
          'relation', item.temporal_relation,
          'tasks', item.tasks
        ) order by item.relation_position, item.starts_at, item.id
      )
      from projection as item
    ), '[]'::jsonb)
  )
$$;

create function public.get_my_student_day_v1(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'Student session is required';
  end if;
  if p_organization_id is null or not exists (
    select 1
    from public.memberships as membership
    where membership.user_id = caller_id
      and membership.organization_id = p_organization_id
      and membership.role = 'student'
  ) then
    raise exception 'Student membership is required';
  end if;
  return public.get_student_day_projection_at(
    p_organization_id,
    caller_id,
    transaction_timestamp()
  );
end;
$$;

alter table public.weekly_plans enable row level security;
alter table public.weekly_plans force row level security;
alter table public.plan_revisions enable row level security;
alter table public.plan_revisions force row level security;
alter table public.teaching_sessions enable row level security;
alter table public.teaching_sessions force row level security;
alter table public.plan_tasks enable row level security;
alter table public.plan_tasks force row level security;
alter table public.plan_revision_sessions enable row level security;
alter table public.plan_revision_sessions force row level security;
alter table public.plan_revision_tasks enable row level security;
alter table public.plan_revision_tasks force row level security;
alter table public.weekly_plan_publish_receipts enable row level security;
alter table public.weekly_plan_publish_receipts force row level security;

revoke all on table public.weekly_plans
from public, anon, authenticated, service_role;
revoke all on table public.plan_revisions
from public, anon, authenticated, service_role;
revoke all on table public.teaching_sessions
from public, anon, authenticated, service_role;
revoke all on table public.plan_tasks
from public, anon, authenticated, service_role;
revoke all on table public.plan_revision_sessions
from public, anon, authenticated, service_role;
revoke all on table public.plan_revision_tasks
from public, anon, authenticated, service_role;
revoke all on table public.weekly_plan_publish_receipts
from public, anon, authenticated, service_role;

grant select on table public.weekly_plans to service_role;
grant select on table public.plan_revisions to service_role;
grant select on table public.teaching_sessions to service_role;
grant select on table public.plan_tasks to service_role;
grant select on table public.plan_revision_sessions to service_role;
grant select on table public.plan_revision_tasks to service_role;
grant select on table public.weekly_plan_publish_receipts to service_role;

revoke all on function public.prevent_weekly_plan_history_mutation()
from public, anon, authenticated, service_role;
revoke all on function public.protect_plan_linked_task_definition()
from public, anon, authenticated, service_role;
revoke all on function public.protect_task_assignment_plan_link()
from public, anon, authenticated, service_role;
revoke all on function public.publish_initial_weekly_plan(
  uuid, uuid, uuid, date, text, integer, uuid, text, jsonb
) from public, anon, authenticated;
revoke all on function public.get_student_day_projection_at(uuid, uuid, timestamptz)
from public, anon, authenticated;
revoke all on function public.get_my_student_day_v1(uuid)
from public, anon;

grant execute on function public.publish_initial_weekly_plan(
  uuid, uuid, uuid, date, text, integer, uuid, text, jsonb
) to service_role;
grant execute on function public.get_student_day_projection_at(uuid, uuid, timestamptz)
to service_role;
grant execute on function public.get_my_student_day_v1(uuid)
to authenticated;

commit;
