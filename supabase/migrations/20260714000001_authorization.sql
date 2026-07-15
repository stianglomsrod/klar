begin;

create function public.is_organization_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships as membership
    where membership.organization_id = p_organization_id
      and membership.user_id = auth.uid()
  );
$$;

create function public.has_organization_role(
  p_organization_id uuid,
  p_roles public.organization_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships as membership
    where membership.organization_id = p_organization_id
      and membership.user_id = auth.uid()
      and membership.role = any(p_roles)
  );
$$;

create function public.has_class_role(
  p_class_id uuid,
  p_roles public.class_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.class_memberships as class_membership
    where class_membership.class_id = p_class_id
      and class_membership.user_id = auth.uid()
      and class_membership.role = any(p_roles)
  );
$$;

create function public.can_access_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.class_memberships as class_membership
    where class_membership.class_id = p_class_id
      and class_membership.user_id = auth.uid()
  ) or exists (
    select 1
    from public.classes as class
    join public.memberships as membership
      on membership.organization_id = class.organization_id
    where class.id = p_class_id
      and membership.user_id = auth.uid()
      and membership.role = 'owner'
  );
$$;

create function public.can_view_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_profile_id = auth.uid()
  or exists (
    select 1
    from public.class_memberships as viewer
    join public.class_memberships as target
      on target.class_id = viewer.class_id
      and target.organization_id = viewer.organization_id
    where viewer.user_id = auth.uid()
      and viewer.role = 'teacher'
      and target.user_id = p_profile_id
  )
  or exists (
    select 1
    from public.memberships as viewer
    join public.memberships as target
      on target.organization_id = viewer.organization_id
    where viewer.user_id = auth.uid()
      and viewer.role = 'owner'
      and target.user_id = p_profile_id
  );
$$;

create function public.can_view_membership(
  p_organization_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id = auth.uid()
  or public.has_organization_role(
    p_organization_id,
    array['owner']::public.organization_role[]
  )
  or exists (
    select 1
    from public.class_memberships as viewer
    join public.class_memberships as target
      on target.class_id = viewer.class_id
      and target.organization_id = viewer.organization_id
    where viewer.organization_id = p_organization_id
      and viewer.user_id = auth.uid()
      and viewer.role = 'teacher'
      and target.user_id = p_user_id
  );
$$;

create function public.can_view_task_definition(p_task_definition_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.task_definitions as task
    where task.id = p_task_definition_id
      and (
        public.has_class_role(
          task.class_id,
          array['teacher']::public.class_role[]
        )
        or public.has_organization_role(
          task.organization_id,
          array['owner']::public.organization_role[]
        )
        or exists (
          select 1
          from public.task_assignments as assignment
          where assignment.task_definition_id = task.id
            and assignment.student_id = auth.uid()
            and assignment.visible_from <= now()
            and task.publication_status = 'published'
        )
      )
  );
$$;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.classes enable row level security;
alter table public.class_memberships enable row level security;
alter table public.task_definitions enable row level security;
alter table public.task_assignments enable row level security;
alter table public.student_task_state enable row level security;
alter table public.help_requests enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_select_authorized
on public.profiles
for select
to authenticated
using (public.can_view_profile(id));

create policy organizations_select_members
on public.organizations
for select
to authenticated
using (public.is_organization_member(id));

create policy memberships_select_authorized
on public.memberships
for select
to authenticated
using (public.can_view_membership(organization_id, user_id));

create policy classes_select_authorized
on public.classes
for select
to authenticated
using (public.can_access_class(id));

create policy class_memberships_select_authorized
on public.class_memberships
for select
to authenticated
using (
  user_id = auth.uid()
  or public.has_class_role(class_id, array['teacher']::public.class_role[])
  or public.has_organization_role(
    organization_id,
    array['owner']::public.organization_role[]
  )
);

create policy task_definitions_select_authorized
on public.task_definitions
for select
to authenticated
using (public.can_view_task_definition(id));

create policy task_assignments_select_authorized
on public.task_assignments
for select
to authenticated
using (
  (student_id = auth.uid() and visible_from <= now())
  or public.has_class_role(class_id, array['teacher']::public.class_role[])
  or public.has_organization_role(
    organization_id,
    array['owner']::public.organization_role[]
  )
);

create policy student_task_state_select_authorized
on public.student_task_state
for select
to authenticated
using (
  student_id = auth.uid()
  or exists (
    select 1
    from public.task_assignments as assignment
    where assignment.id = student_task_state.assignment_id
      and (
        public.has_class_role(
          assignment.class_id,
          array['teacher']::public.class_role[]
        )
        or public.has_organization_role(
          assignment.organization_id,
          array['owner']::public.organization_role[]
        )
      )
  )
);

create policy help_requests_select_authorized
on public.help_requests
for select
to authenticated
using (
  student_id = auth.uid()
  or public.has_class_role(class_id, array['teacher']::public.class_role[])
  or public.has_organization_role(
    organization_id,
    array['owner']::public.organization_role[]
  )
);

create policy audit_events_select_teachers
on public.audit_events
for select
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['owner', 'teacher']::public.organization_role[]
  )
);

revoke all on schema public from anon;
grant usage on schema public to anon, authenticated, service_role;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant select on table
  public.profiles,
  public.organizations,
  public.memberships,
  public.classes,
  public.class_memberships,
  public.task_definitions,
  public.task_assignments,
  public.student_task_state,
  public.help_requests,
  public.audit_events
to authenticated;

grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

grant execute on function public.is_organization_member(uuid)
to authenticated;
grant execute on function public.has_organization_role(
  uuid,
  public.organization_role[]
) to authenticated;
grant execute on function public.has_class_role(uuid, public.class_role[])
to authenticated;
grant execute on function public.can_access_class(uuid)
to authenticated;
grant execute on function public.can_view_profile(uuid)
to authenticated;
grant execute on function public.can_view_membership(uuid, uuid)
to authenticated;
grant execute on function public.can_view_task_definition(uuid)
to authenticated;

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public
  grant all on tables to service_role;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to service_role;
alter default privileges for role postgres in schema public
  grant execute on functions to service_role;

commit;
