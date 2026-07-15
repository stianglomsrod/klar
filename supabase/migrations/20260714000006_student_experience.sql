begin;

create table public.student_experience_settings (
  organization_id uuid not null,
  student_id uuid not null,
  support_level smallint not null default 2,
  progress_enabled boolean not null default false,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, student_id),
  foreign key (organization_id, student_id)
    references public.memberships (organization_id, user_id) on delete cascade,
  constraint student_experience_support_level
    check (support_level between 1 and 3)
);

create function public.validate_student_experience_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.memberships as membership
    where membership.organization_id = new.organization_id
      and membership.user_id = new.student_id
      and membership.role = 'student'
  ) then
    raise exception 'Experience settings can only belong to a student';
  end if;
  return new;
end;
$$;

create trigger student_experience_validate_student
before insert or update on public.student_experience_settings
for each row execute function public.validate_student_experience_settings();

create trigger student_experience_set_updated_at
before update on public.student_experience_settings
for each row execute function public.set_updated_at();

alter table public.student_experience_settings enable row level security;

create policy student_experience_select_authorized
on public.student_experience_settings
for select
to authenticated
using (
  student_id = auth.uid()
  or public.has_organization_role(
    organization_id,
    array['owner']::public.organization_role[]
  )
  or exists (
    select 1
    from public.class_memberships as viewer
    join public.class_memberships as target
      on target.class_id = viewer.class_id
      and target.organization_id = viewer.organization_id
    where viewer.organization_id = student_experience_settings.organization_id
      and viewer.user_id = auth.uid()
      and viewer.role = 'teacher'
      and target.user_id = student_experience_settings.student_id
      and target.role = 'student'
  )
);

revoke all on table public.student_experience_settings from anon, authenticated;
grant select on table public.student_experience_settings to authenticated;
grant all on table public.student_experience_settings to service_role;

create function public.update_student_experience(
  p_organization_id uuid,
  p_student_id uuid,
  p_actor_id uuid,
  p_support_level smallint,
  p_progress_enabled boolean
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
  if p_progress_enabled is null then
    raise exception 'Progress preference must be explicit';
  end if;

  if not exists (
    select 1
    from public.memberships as student_membership
    where student_membership.organization_id = p_organization_id
      and student_membership.user_id = p_student_id
      and student_membership.role = 'student'
  ) then
    raise exception 'Target user is not a student in the organization';
  end if;

  if p_actor_id <> p_student_id
    and not exists (
      select 1
      from public.memberships as owner_membership
      where owner_membership.organization_id = p_organization_id
        and owner_membership.user_id = p_actor_id
        and owner_membership.role = 'owner'
    )
    and not exists (
      select 1
      from public.class_memberships as teacher_membership
      join public.class_memberships as student_membership
        on student_membership.class_id = teacher_membership.class_id
        and student_membership.organization_id = teacher_membership.organization_id
      where teacher_membership.organization_id = p_organization_id
        and teacher_membership.user_id = p_actor_id
        and teacher_membership.role = 'teacher'
        and student_membership.user_id = p_student_id
        and student_membership.role = 'student'
    )
  then
    raise exception 'Actor cannot update the student experience';
  end if;

  insert into public.student_experience_settings (
    organization_id,
    student_id,
    support_level,
    progress_enabled,
    updated_by
  ) values (
    p_organization_id,
    p_student_id,
    p_support_level,
    p_progress_enabled,
    p_actor_id
  )
  on conflict (organization_id, student_id) do update
  set support_level = excluded.support_level,
      progress_enabled = excluded.progress_enabled,
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
      'progress_enabled', p_progress_enabled
    )
  );

  return result;
end;
$$;

revoke all on function public.validate_student_experience_settings()
from public, anon, authenticated;
revoke all on function public.update_student_experience(
  uuid,
  uuid,
  uuid,
  smallint,
  boolean
) from public, anon, authenticated;
grant execute on function public.update_student_experience(
  uuid,
  uuid,
  uuid,
  smallint,
  boolean
) to service_role;

commit;
