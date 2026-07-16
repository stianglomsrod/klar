-- A1 follow-up: support settings are not part of the general class workspace.
-- Staff may read them only while the dedicated support capability is active.

begin;

alter table public.staff_assignments
  add column profile_sealed_at timestamptz;

do $$
declare
  incomplete_assignment uuid;
begin
  select assignment.id
  into incomplete_assignment
  from public.staff_assignments as assignment
  where assignment.profile_version <> 'class_pedagogy_v1'
    or (select count(*) from public.staff_assignment_class_scopes as scope
        where scope.assignment_id = assignment.id) <> 1
    or (
      select count(*) <> 6
        or count(*) filter (
          where capability.profile_version = assignment.profile_version
            and capability.capability::text = any(array[
              'class.workspace.read',
              'task.publish',
              'plan.preview',
              'plan.publish',
              'help_queue.manage',
              'student_support.update'
            ]::text[])
        ) <> 6
      from public.staff_assignment_capabilities as capability
      where capability.assignment_id = assignment.id
    )
  order by assignment.id
  limit 1;

  if incomplete_assignment is not null then
    raise exception 'Existing staff assignment has an incomplete scope or capability profile: %',
      incomplete_assignment;
  end if;
end;
$$;

update public.staff_assignments
set profile_sealed_at = transaction_timestamp();

create function public.expected_staff_assignment_capabilities(
  p_profile_version text
)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case p_profile_version
    when 'class_pedagogy_v1' then array[
      'class.workspace.read',
      'task.publish',
      'plan.preview',
      'plan.publish',
      'help_queue.manage',
      'student_support.update'
    ]::text[]
    else null
  end
$$;

create function public.guard_staff_assignment_seal_state()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  expected_capabilities text[];
  scope_complete boolean;
  capability_complete boolean;
begin
  if tg_op = 'INSERT' then
    if new.profile_sealed_at is not null then
      raise exception using
        errcode = '23514',
        message = 'Staff assignment profile must be sealed by the database';
    end if;
    return new;
  end if;

  if new.profile_sealed_at is distinct from old.profile_sealed_at then
    if old.profile_sealed_at is null
      and new.profile_sealed_at = transaction_timestamp()
      and current_setting('klar.staff_assignment_seal_id', true) = old.id::text
    then
      expected_capabilities := public.expected_staff_assignment_capabilities(
        new.profile_version
      );

      select count(*) = 1
      into scope_complete
      from public.staff_assignment_class_scopes as scope
      where scope.assignment_id = old.id;

      select expected_capabilities is not null
        and count(*) = cardinality(expected_capabilities)
        and count(*) filter (
          where capability.profile_version = new.profile_version
            and capability.capability::text = any(expected_capabilities)
        ) = cardinality(expected_capabilities)
      into capability_complete
      from public.staff_assignment_capabilities as capability
      where capability.assignment_id = old.id;

      if scope_complete and capability_complete then
        return new;
      end if;
    end if;

    raise exception using
      errcode = '23514',
      message = 'Staff assignment profile seal is immutable';
  end if;

  return new;
end;
$$;

create trigger staff_assignments_guard_profile_seal
before insert or update on public.staff_assignments
for each row execute function public.guard_staff_assignment_seal_state();

create function public.guard_staff_assignment_child_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  assignment_sealed_at timestamptz;
begin
  select assignment.profile_sealed_at
  into assignment_sealed_at
  from public.staff_assignments as assignment
  where assignment.id = new.assignment_id
  for share;

  if not found or assignment_sealed_at is not null then
    raise exception using
      errcode = '23514',
      message = 'Staff assignment scope and capabilities are immutable after creation';
  end if;

  return new;
end;
$$;

create function public.try_seal_staff_assignment_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  assignment_profile text;
  assignment_sealed_at timestamptz;
  expected_capabilities text[];
  scope_complete boolean;
  capability_complete boolean;
begin
  select assignment.profile_version, assignment.profile_sealed_at
  into assignment_profile, assignment_sealed_at
  from public.staff_assignments as assignment
  where assignment.id = new.assignment_id
  for update;

  if not found or assignment_sealed_at is not null then
    return new;
  end if;

  expected_capabilities := public.expected_staff_assignment_capabilities(
    assignment_profile
  );

  if expected_capabilities is null then
    raise exception using
      errcode = '23514',
      message = format('Unknown staff capability profile: %s', assignment_profile);
  end if;

  select count(*) = 1
  into scope_complete
  from public.staff_assignment_class_scopes as scope
  where scope.assignment_id = new.assignment_id;

  select count(*) = cardinality(expected_capabilities)
    and count(*) filter (
      where capability.profile_version = assignment_profile
        and capability.capability::text = any(expected_capabilities)
    ) = cardinality(expected_capabilities)
  into capability_complete
  from public.staff_assignment_capabilities as capability
  where capability.assignment_id = new.assignment_id;

  if scope_complete and capability_complete then
    perform set_config(
      'klar.staff_assignment_seal_id',
      new.assignment_id::text,
      true
    );
    update public.staff_assignments
    set profile_sealed_at = transaction_timestamp()
    where id = new.assignment_id
      and profile_sealed_at is null;
    perform set_config('klar.staff_assignment_seal_id', '', true);
  end if;

  return new;
end;
$$;

create function public.require_sealed_staff_assignment_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.staff_assignments as assignment
    where assignment.id = new.id
      and assignment.profile_sealed_at is null
  ) then
    raise exception using
      errcode = '23514',
      message = 'Staff assignment must have one scope and the exact capability profile';
  end if;

  return null;
end;
$$;

create trigger staff_assignment_scopes_guard_insert
before insert on public.staff_assignment_class_scopes
for each row execute function public.guard_staff_assignment_child_insert();

create trigger staff_assignment_capabilities_guard_insert
before insert on public.staff_assignment_capabilities
for each row execute function public.guard_staff_assignment_child_insert();

create trigger zz_staff_assignment_scopes_try_seal
after insert on public.staff_assignment_class_scopes
for each row execute function public.try_seal_staff_assignment_profile();

create trigger zz_staff_assignment_capabilities_try_seal
after insert on public.staff_assignment_capabilities
for each row execute function public.try_seal_staff_assignment_profile();

create constraint trigger staff_assignment_requires_sealed_profile
after insert on public.staff_assignments
deferrable initially deferred
for each row execute function public.require_sealed_staff_assignment_profile();

revoke all on function public.guard_staff_assignment_seal_state()
from public, anon, authenticated, service_role;
revoke all on function public.expected_staff_assignment_capabilities(text)
from public, anon, authenticated, service_role;
revoke all on function public.guard_staff_assignment_child_insert()
from public, anon, authenticated, service_role;
revoke all on function public.try_seal_staff_assignment_profile()
from public, anon, authenticated, service_role;
revoke all on function public.require_sealed_staff_assignment_profile()
from public, anon, authenticated, service_role;

drop policy if exists student_experience_select_authorized
on public.student_experience_settings;

create policy student_experience_select_authorized
on public.student_experience_settings
for select
to authenticated
using (
  student_id = auth.uid()
  or exists (
    select 1
    from public.class_memberships as target
    where target.organization_id = student_experience_settings.organization_id
      and target.user_id = student_experience_settings.student_id
      and target.role = 'student'
      and public.has_active_staff_capability(
        target.class_id,
        'student_support.update'
      )
  )
);

commit;
