\set ON_ERROR_STOP on

do $$
declare
  entitlement_id uuid;
  result jsonb;
begin
  if (
    select array_agg(status::text order by level)
    from public.level_reward_entitlements
    where organization_id = '82000000-0000-4000-8000-000000000001'
      and student_id = '81000000-0000-4000-8000-000000000004'
  ) <> array['available', 'pending']
    or (
      select flower_rewards_allowed
      from public.student_experience_settings
      where organization_id = '82000000-0000-4000-8000-000000000001'
        and student_id = '81000000-0000-4000-8000-000000000004'
    )
    or not (
      select flower_rewards_visible
      from public.student_experience_settings
      where organization_id = '82000000-0000-4000-8000-000000000001'
        and student_id = '81000000-0000-4000-8000-000000000004'
    )
    or (select count(*) from public.reward_claims) <> 0
  then
    raise exception 'B2 upgrade changed historical entitlement or preference state';
  end if;

  update public.student_experience_settings
  set flower_rewards_allowed = true
  where organization_id = '82000000-0000-4000-8000-000000000001'
    and student_id = '81000000-0000-4000-8000-000000000004';

  select id into entitlement_id
  from public.level_reward_entitlements
  where organization_id = '82000000-0000-4000-8000-000000000001'
    and student_id = '81000000-0000-4000-8000-000000000004'
    and level = 2;

  result := public.claim_student_flower_reward_v1(
    '82000000-0000-4000-8000-000000000001',
    entitlement_id,
    '81000000-0000-4000-8000-000000000004',
    '81000000-0000-4000-8000-000000000004',
    'b2c00000-0000-4000-8000-000000000004',
    'yellow'
  );

  if result ->> 'flower_color' <> 'yellow'
    or (result ->> 'collection_sequence')::bigint <> 1
    or not exists (
      select 1
      from public.reward_claims as claim
      join public.level_reward_entitlements as entitlement
        on entitlement.id = claim.entitlement_id
      where claim.id = (result ->> 'claim_id')::uuid
        and entitlement.status = 'selected'
        and entitlement.selected_at = claim.claimed_at
    )
    or (select status from public.level_reward_entitlements where level = 3 and student_id = '81000000-0000-4000-8000-000000000004') <> 'pending'
  then
    raise exception 'B2 upgraded reward could not be claimed safely: %', result;
  end if;
end;
$$;
