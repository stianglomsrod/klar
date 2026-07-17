\set ON_ERROR_STOP on

do $$
begin
  if to_regclass('public.reward_claims') is not null
    or exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'student_experience_settings'
        and column_name in ('flower_rewards_allowed', 'flower_rewards_visible')
    )
  then
    raise exception 'Failed B2 preflight left a partial schema';
  end if;
end;
$$;

update public.level_reward_entitlements
set status = 'available',
    selected_at = null
where organization_id = '82000000-0000-4000-8000-000000000001'
  and student_id = '81000000-0000-4000-8000-000000000004'
  and level = 2;
