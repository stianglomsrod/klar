begin;

do $$
begin
  if exists (
    select 1
    from public.level_reward_entitlements
    where status = 'selected'
  ) then
    raise exception 'Selected reward entitlements require an explicit reward migration';
  end if;
end;
$$;

alter table public.student_experience_settings
  add column flower_rewards_allowed boolean not null default false,
  add column flower_rewards_visible boolean not null default true;

create type public.reward_claim_type as enum (
  'flower_petal_v1'
);

create type public.flower_reward_color as enum (
  'red',
  'turquoise',
  'green',
  'pink',
  'purple',
  'orange',
  'yellow',
  'blue'
);

create table public.reward_claims (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  student_id uuid not null,
  entitlement_id uuid not null,
  claimed_by uuid not null references auth.users (id) on delete restrict,
  request_id uuid not null,
  request_fingerprint text not null,
  reward_type public.reward_claim_type not null,
  flower_color public.flower_reward_color not null,
  collection_sequence bigint not null,
  claimed_at timestamptz not null default transaction_timestamp(),
  unique (entitlement_id),
  unique (student_id, request_id),
  unique (organization_id, student_id, collection_sequence),
  unique (id, organization_id, student_id),
  foreign key (entitlement_id, organization_id, student_id)
    references public.level_reward_entitlements (
      id,
      organization_id,
      student_id
    ) on delete restrict,
  foreign key (organization_id, student_id)
    references public.memberships (organization_id, user_id) on delete restrict,
  constraint reward_claims_actor_is_student check (claimed_by = student_id),
  constraint reward_claims_request_fingerprint
    check (request_fingerprint ~ '^[0-9a-f]{32}$'),
  constraint reward_claims_collection_sequence check (collection_sequence >= 1),
  constraint reward_claims_flower_payload check (
    reward_type = 'flower_petal_v1'
  )
);

create index reward_claims_student_sequence_idx
  on public.reward_claims (student_id, collection_sequence);

create trigger reward_claims_immutable
before update or delete on public.reward_claims
for each row execute function public.prevent_progress_history_mutation();

create function public.prevent_selected_reward_reversal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'selected' and (
    new.status is distinct from old.status
    or new.selected_at is distinct from old.selected_at
    or new.id is distinct from old.id
    or new.organization_id is distinct from old.organization_id
    or new.student_id is distinct from old.student_id
    or new.level is distinct from old.level
    or new.milestone_id is distinct from old.milestone_id
  ) then
    raise exception 'Selected rewards are permanent';
  end if;
  return new;
end;
$$;

create trigger level_reward_entitlements_selected_permanent
before update on public.level_reward_entitlements
for each row execute function public.prevent_selected_reward_reversal();

create function public.validate_reward_claim_consistency()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  claim public.reward_claims;
  entitlement public.level_reward_entitlements;
begin
  if tg_table_name = 'reward_claims' then
    select target.*
    into entitlement
    from public.level_reward_entitlements as target
    where target.id = new.entitlement_id
      and target.organization_id = new.organization_id
      and target.student_id = new.student_id;

    if entitlement.id is null
      or entitlement.status <> 'selected'
      or entitlement.selected_at is distinct from new.claimed_at
    then
      raise exception 'Reward claim and entitlement selection are inconsistent';
    end if;
    return null;
  end if;

  if new.status = 'selected' then
    select selected_claim.*
    into claim
    from public.reward_claims as selected_claim
    where selected_claim.entitlement_id = new.id
      and selected_claim.organization_id = new.organization_id
      and selected_claim.student_id = new.student_id;

    if claim.id is null or claim.claimed_at is distinct from new.selected_at then
      raise exception 'Selected entitlement requires exactly one reward claim';
    end if;
  elsif exists (
    select 1
    from public.reward_claims as selected_claim
    where selected_claim.entitlement_id = new.id
  ) then
    raise exception 'Claimed entitlement must remain selected';
  end if;
  return null;
end;
$$;

create constraint trigger reward_claims_consistent_with_entitlement
after insert on public.reward_claims
deferrable initially deferred
for each row execute function public.validate_reward_claim_consistency();

create constraint trigger reward_entitlement_consistent_with_claim
after update on public.level_reward_entitlements
deferrable initially deferred
for each row execute function public.validate_reward_claim_consistency();

create function public.update_student_experience_v2(
  p_organization_id uuid,
  p_student_id uuid,
  p_actor_id uuid,
  p_support_level smallint,
  p_progress_enabled boolean,
  p_flower_rewards_visible boolean
)
returns public.student_experience_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.student_experience_settings;
begin
  if p_support_level not between 1 and 3 then
    raise exception 'Support level must be between 1 and 3';
  end if;
  if p_progress_enabled is null or p_flower_rewards_visible is null then
    raise exception 'Student visibility preferences must be explicit';
  end if;
  if p_actor_id <> p_student_id then
    raise exception 'Students can only update their own visibility preferences';
  end if;
  if not exists (
    select 1
    from public.memberships as membership
    join public.class_memberships as class_membership
      on class_membership.organization_id = membership.organization_id
     and class_membership.user_id = membership.user_id
     and class_membership.role = 'student'
    where membership.organization_id = p_organization_id
      and membership.user_id = p_student_id
      and membership.role = 'student'
  ) then
    raise exception 'Student membership is required';
  end if;

  insert into public.student_experience_settings (
    organization_id,
    student_id,
    support_level,
    progress_enabled,
    flower_rewards_visible,
    updated_by
  ) values (
    p_organization_id,
    p_student_id,
    p_support_level,
    p_progress_enabled,
    p_flower_rewards_visible,
    p_actor_id
  )
  on conflict (organization_id, student_id) do update
  set support_level = excluded.support_level,
      progress_enabled = excluded.progress_enabled,
      flower_rewards_visible = excluded.flower_rewards_visible,
      updated_by = excluded.updated_by
  returning * into result;

  insert into public.audit_events (
    organization_id,
    actor_id,
    event_name,
    entity_type,
    entity_id,
    metadata
  ) values (
    p_organization_id,
    p_actor_id,
    'student.experience.updated',
    'profile',
    p_student_id,
    jsonb_build_object(
      'support_level', p_support_level,
      'progress_enabled', p_progress_enabled,
      'flower_rewards_visible', p_flower_rewards_visible,
      'flower_rewards_allowed_preserved', result.flower_rewards_allowed,
      'source', 'student'
    )
  );

  return result;
end;
$$;

create function public.update_student_experience_for_staff_v2(
  p_organization_id uuid,
  p_class_id uuid,
  p_student_id uuid,
  p_actor_id uuid,
  p_staff_assignment_id uuid,
  p_support_level smallint,
  p_flower_rewards_allowed boolean
)
returns public.student_experience_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.student_experience_settings;
  authorized_organization_id uuid;
begin
  if p_support_level not between 1 and 3 then
    raise exception 'Support level must be between 1 and 3';
  end if;
  if p_flower_rewards_allowed is null then
    raise exception 'Flower reward frame must be explicit';
  end if;

  authorized_organization_id := public.lock_staff_assignment_authorization(
    p_staff_assignment_id,
    p_actor_id,
    p_class_id,
    'student_support.update'
  );
  if authorized_organization_id is distinct from p_organization_id then
    raise exception 'Staff assignment does not authorize student support updates';
  end if;

  perform student_membership.user_id
  from public.memberships as membership
  join public.class_memberships as student_membership
    on student_membership.organization_id = membership.organization_id
   and student_membership.user_id = membership.user_id
   and student_membership.class_id = p_class_id
   and student_membership.role = 'student'
  where membership.organization_id = p_organization_id
    and membership.user_id = p_student_id
    and membership.role = 'student'
  for share of membership, student_membership;

  if not found then
    raise exception 'Target user is not a student in the assigned class';
  end if;

  insert into public.student_experience_settings (
    organization_id,
    student_id,
    support_level,
    flower_rewards_allowed,
    updated_by
  ) values (
    p_organization_id,
    p_student_id,
    p_support_level,
    p_flower_rewards_allowed,
    p_actor_id
  )
  on conflict (organization_id, student_id) do update
  set support_level = excluded.support_level,
      flower_rewards_allowed = excluded.flower_rewards_allowed,
      updated_by = excluded.updated_by
  returning * into result;

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
    p_organization_id,
    p_actor_id,
    'student.experience.updated',
    'profile',
    p_student_id,
    jsonb_build_object(
      'class_id', p_class_id,
      'support_level', p_support_level,
      'progress_enabled_preserved', result.progress_enabled,
      'flower_rewards_allowed', p_flower_rewards_allowed,
      'source', 'staff'
    ),
    p_staff_assignment_id,
    'student_support.update'
  );

  return result;
end;
$$;

create function public.claim_student_flower_reward_v1(
  p_organization_id uuid,
  p_entitlement_id uuid,
  p_student_id uuid,
  p_actor_id uuid,
  p_request_id uuid,
  p_flower_color public.flower_reward_color
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  fingerprint text;
  existing_claim public.reward_claims;
  target public.level_reward_entitlements;
  progress public.student_progress;
  entitlement_class_id uuid;
  operation_at timestamptz;
  next_sequence bigint;
begin
  if p_organization_id is null
    or p_entitlement_id is null
    or p_student_id is null
    or p_actor_id is null
    or p_request_id is null
    or p_flower_color is null
  then
    raise exception 'Reward claim identifiers and color are required';
  end if;
  if p_actor_id <> p_student_id then
    raise exception 'Students can only claim their own reward';
  end if;

  fingerprint := md5(jsonb_build_object(
    'organization_id', p_organization_id,
    'entitlement_id', p_entitlement_id,
    'student_id', p_student_id,
    'actor_id', p_actor_id,
    'reward_type', 'flower_petal_v1',
    'flower_color', p_flower_color
  )::text);

  perform pg_advisory_xact_lock(hashtextextended(
    p_actor_id::text || ':' || p_request_id::text,
    0
  ));

  select attempt.class_id
  into entitlement_class_id
  from public.level_reward_entitlements as entitlement
  join public.level_milestones as milestone
    on milestone.id = entitlement.milestone_id
   and milestone.organization_id = entitlement.organization_id
   and milestone.student_id = entitlement.student_id
   and milestone.level = entitlement.level
  join public.task_completion_attempts as attempt
    on attempt.id = milestone.first_completion_attempt_id
   and attempt.organization_id = milestone.organization_id
   and attempt.student_id = milestone.student_id
  where entitlement.id = p_entitlement_id
    and entitlement.organization_id = p_organization_id
    and entitlement.student_id = p_student_id;

  if entitlement_class_id is null then
    raise exception 'Reward entitlement is unavailable';
  end if;

  perform class_membership.user_id
  from public.memberships as membership
  join public.class_memberships as class_membership
    on class_membership.organization_id = membership.organization_id
   and class_membership.user_id = membership.user_id
   and class_membership.role = 'student'
  where membership.organization_id = p_organization_id
    and membership.user_id = p_student_id
    and membership.role = 'student'
  for share of membership, class_membership;

  if not found then
    raise exception 'Student membership is unavailable';
  end if;

  perform settings.student_id
  from public.student_experience_settings as settings
  where settings.organization_id = p_organization_id
    and settings.student_id = p_student_id
    and settings.flower_rewards_allowed
  for share;

  if not found then
    raise exception 'Flower rewards are not available';
  end if;

  select claim.*
  into existing_claim
  from public.reward_claims as claim
  where claim.student_id = p_actor_id
    and claim.request_id = p_request_id;

  if found then
    if existing_claim.request_fingerprint <> fingerprint then
      raise exception 'Request ID was already used with another reward choice';
    end if;

    select entitlement.*
    into target
    from public.level_reward_entitlements as entitlement
    where entitlement.id = existing_claim.entitlement_id;

    return jsonb_build_object(
      'changed', true,
      'claim_id', existing_claim.id,
      'entitlement_id', existing_claim.entitlement_id,
      'request_id', existing_claim.request_id,
      'level', target.level,
      'reward_type', existing_claim.reward_type,
      'flower_color', existing_claim.flower_color,
      'collection_sequence', existing_claim.collection_sequence,
      'flower_number', 1 + ((existing_claim.collection_sequence - 1) / 5),
      'petal_number', 1 + mod(existing_claim.collection_sequence - 1, 5),
      'claimed_at', existing_claim.claimed_at
    );
  end if;

  select student_progress.*
  into progress
  from public.student_progress as student_progress
  where student_progress.organization_id = p_organization_id
    and student_progress.student_id = p_student_id
  for update;

  if progress.student_id is null then
    raise exception 'Student progress is unavailable';
  end if;

  select entitlement.*
  into target
  from public.level_reward_entitlements as entitlement
  where entitlement.id = p_entitlement_id
    and entitlement.organization_id = p_organization_id
    and entitlement.student_id = p_student_id
  for update;

  if target.id is null
    or target.status <> 'available'
    or target.level > progress.current_level
  then
    raise exception 'Reward entitlement is unavailable';
  end if;

  if exists (
    select 1
    from public.level_reward_entitlements as earlier
    where earlier.organization_id = p_organization_id
      and earlier.student_id = p_student_id
      and earlier.status = 'available'
      and earlier.level < target.level
  ) then
    raise exception 'An earlier reward must be selected first';
  end if;

  select coalesce(max(claim.collection_sequence), 0) + 1
  into next_sequence
  from public.reward_claims as claim
  where claim.organization_id = p_organization_id
    and claim.student_id = p_student_id;

  operation_at := clock_timestamp();

  insert into public.reward_claims (
    organization_id,
    student_id,
    entitlement_id,
    claimed_by,
    request_id,
    request_fingerprint,
    reward_type,
    flower_color,
    collection_sequence,
    claimed_at
  ) values (
    p_organization_id,
    p_student_id,
    p_entitlement_id,
    p_actor_id,
    p_request_id,
    fingerprint,
    'flower_petal_v1',
    p_flower_color,
    next_sequence,
    operation_at
  )
  returning * into existing_claim;

  update public.level_reward_entitlements as entitlement
  set
    status = 'selected',
    selected_at = operation_at,
    updated_at = operation_at
  where entitlement.id = target.id;

  insert into public.audit_events (
    organization_id,
    actor_id,
    event_name,
    entity_type,
    entity_id,
    metadata,
    occurred_at
  ) values (
    p_organization_id,
    p_actor_id,
    'reward.claimed',
    'reward_claim',
    existing_claim.id,
    jsonb_build_object(
      'entitlement_id', target.id,
      'level', target.level,
      'reward_type', existing_claim.reward_type,
      'flower_color', existing_claim.flower_color,
      'collection_sequence', next_sequence,
      'request_id', p_request_id
    ),
    operation_at
  );

  return jsonb_build_object(
    'changed', true,
    'claim_id', existing_claim.id,
    'entitlement_id', existing_claim.entitlement_id,
    'request_id', existing_claim.request_id,
    'level', target.level,
    'reward_type', existing_claim.reward_type,
    'flower_color', existing_claim.flower_color,
    'collection_sequence', existing_claim.collection_sequence,
    'flower_number', 1 + ((existing_claim.collection_sequence - 1) / 5),
    'petal_number', 1 + mod(existing_claim.collection_sequence - 1, 5),
    'claimed_at', existing_claim.claimed_at
  );
end;
$$;

create function public.get_my_flower_rewards_v1(
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
  rewards_allowed boolean := false;
  rewards_visible boolean := true;
  progress_enabled boolean := false;
begin
  if caller_id is null then
    raise exception 'Student session is required';
  end if;

  if p_organization_id is null or not exists (
    select 1
    from public.memberships as membership
    join public.class_memberships as class_membership
      on class_membership.organization_id = membership.organization_id
     and class_membership.user_id = membership.user_id
     and class_membership.role = 'student'
    where membership.organization_id = p_organization_id
      and membership.user_id = caller_id
      and membership.role = 'student'
  ) then
    raise exception 'Student membership is required';
  end if;

  select
    settings.flower_rewards_allowed,
    settings.flower_rewards_visible,
    settings.progress_enabled
  into rewards_allowed, rewards_visible, progress_enabled
  from public.student_experience_settings as settings
  where settings.organization_id = p_organization_id
    and settings.student_id = caller_id;

  rewards_allowed := coalesce(rewards_allowed, false);
  rewards_visible := coalesce(rewards_visible, true);
  progress_enabled := coalesce(progress_enabled, false);

  return jsonb_build_object(
    'rewards_allowed', rewards_allowed,
    'rewards_visible', rewards_visible,
    'progress_enabled', progress_enabled,
    'available_entitlements', case
      when not rewards_allowed or not rewards_visible then '[]'::jsonb
      else coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'entitlement_id', entitlement.id,
            'level', entitlement.level,
            'available_at', entitlement.available_at
          ) order by entitlement.level, entitlement.id
        )
        from public.level_reward_entitlements as entitlement
        join public.level_milestones as milestone
          on milestone.id = entitlement.milestone_id
         and milestone.organization_id = entitlement.organization_id
         and milestone.student_id = entitlement.student_id
         and milestone.level = entitlement.level
        join public.task_completion_attempts as attempt
          on attempt.id = milestone.first_completion_attempt_id
         and attempt.organization_id = milestone.organization_id
         and attempt.student_id = milestone.student_id
        where entitlement.organization_id = p_organization_id
          and entitlement.student_id = caller_id
          and entitlement.status = 'available'
      ), '[]'::jsonb)
    end,
    'claims', case
      when not rewards_allowed or not rewards_visible then '[]'::jsonb
      else coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'claim_id', claim.id,
            'entitlement_id', claim.entitlement_id,
            'level', entitlement.level,
            'reward_type', claim.reward_type,
            'flower_color', claim.flower_color,
            'collection_sequence', claim.collection_sequence,
            'flower_number', 1 + ((claim.collection_sequence - 1) / 5),
            'petal_number', 1 + mod(claim.collection_sequence - 1, 5),
            'claimed_at', claim.claimed_at
          ) order by claim.collection_sequence
        )
        from public.reward_claims as claim
        join public.level_reward_entitlements as entitlement
          on entitlement.id = claim.entitlement_id
         and entitlement.organization_id = claim.organization_id
         and entitlement.student_id = claim.student_id
        join public.level_milestones as milestone
          on milestone.id = entitlement.milestone_id
         and milestone.organization_id = entitlement.organization_id
         and milestone.student_id = entitlement.student_id
         and milestone.level = entitlement.level
        join public.task_completion_attempts as attempt
          on attempt.id = milestone.first_completion_attempt_id
         and attempt.organization_id = milestone.organization_id
         and attempt.student_id = milestone.student_id
        where claim.organization_id = p_organization_id
          and claim.student_id = caller_id
      ), '[]'::jsonb)
    end
  );
end;
$$;

alter table public.reward_claims enable row level security;

create policy reward_claims_select_authorized
on public.reward_claims
for select
to authenticated
using (
  public.can_read_student_progress_identity(organization_id, student_id)
);

revoke all on table public.reward_claims
from public, anon, authenticated, service_role;

grant select on table public.reward_claims
to service_role;

revoke all on function public.prevent_selected_reward_reversal()
from public, anon, authenticated, service_role;
revoke all on function public.validate_reward_claim_consistency()
from public, anon, authenticated, service_role;
revoke all on function public.update_student_experience_v2(
  uuid,
  uuid,
  uuid,
  smallint,
  boolean,
  boolean
) from public, anon, authenticated, service_role;
revoke all on function public.update_student_experience_for_staff_v2(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  smallint,
  boolean
) from public, anon, authenticated, service_role;
revoke all on function public.claim_student_flower_reward_v1(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  public.flower_reward_color
) from public, anon, authenticated, service_role;
revoke all on function public.get_my_flower_rewards_v1(uuid)
from public, anon, authenticated, service_role;

grant execute on function public.update_student_experience_for_staff_v2(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  smallint,
  boolean
) to service_role;
grant execute on function public.update_student_experience_v2(
  uuid,
  uuid,
  uuid,
  smallint,
  boolean,
  boolean
) to service_role;
grant execute on function public.claim_student_flower_reward_v1(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  public.flower_reward_color
) to service_role;
grant execute on function public.get_my_flower_rewards_v1(uuid)
to authenticated;

commit;
