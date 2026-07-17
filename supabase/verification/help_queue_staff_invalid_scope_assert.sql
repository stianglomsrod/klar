\set ON_ERROR_STOP on

do $$
begin
  if to_regtype('public.help_queue_priority_reason') is not null
    or to_regclass('public.help_queue_request_order') is not null
    or exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'help_queue_signals'
        and column_name = 'staff_only'
    )
    or exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'help_requests'
        and column_name in ('ownership_changed_at', 'ownership_version')
    )
    or exists (
      select 1
      from pg_constraint
      where conrelid = 'public.help_queue_signals'::regclass
        and conname = 'help_queue_signals_queue_scope_fkey'
    )
    or to_regclass('public.help_queue_signals_one_staff_signal') is not null
    or not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.help_queue_signals'::regclass
        and conname = 'help_queue_signals_queue_session_id_fkey'
    )
    or exists (
      select 1
      from pg_trigger
      where tgrelid = 'public.help_requests'::regclass
        and not tgisinternal
        and tgname in (
          'help_requests_bump_ownership_version_before_change',
          'help_requests_normalize_ownership_before_change',
          'help_requests_sync_order_after_change'
        )
    )
    or to_regprocedure('public.bump_help_request_ownership_version()') is not null
    or to_regprocedure('public.reorder_student_help_v1(uuid,uuid,text,public.help_queue_priority_reason,bigint,uuid,uuid,uuid)') is not null
    or to_regprocedure('public.release_student_help_v1(uuid,bigint,uuid,uuid,uuid)') is not null
    or to_regprocedure('public.transfer_student_help_v1(uuid,bigint,uuid,uuid,uuid,uuid)') is not null
    or to_regprocedure('public.claim_student_help_v3(uuid,bigint,uuid,uuid,uuid)') is not null
    or to_regprocedure('public.resolve_student_help_v3(uuid,bigint,uuid,uuid,uuid)') is not null
    or to_regprocedure('public.read_help_queue_staff_snapshot_v1(uuid,uuid,uuid)') is not null
    or not has_function_privilege(
      'service_role',
      'public.claim_student_help_v2(uuid,uuid,uuid,uuid)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'service_role',
      'public.resolve_student_help_v2(uuid,uuid,uuid,uuid)',
      'EXECUTE'
    )
    or exists (
      select 1
      from pg_constraint
      where conrelid = 'public.help_queue_command_receipts'::regclass
        and conname = 'help_queue_command_receipts_command'
        and (
          pg_get_constraintdef(oid) ilike '%reorder_help%'
          or pg_get_constraintdef(oid) ilike '%release_help%'
          or pg_get_constraintdef(oid) ilike '%transfer_help%'
        )
    )
  then
    raise exception 'Failed E2 migration left partial schema state';
  end if;

  if not exists (
    select 1
    from public.help_queue_signals as signal
    join public.help_queue_sessions as queue
      on queue.id = signal.queue_session_id
    where signal.id = 'e2850000-0000-4000-8000-000000000001'
      and signal.organization_id is distinct from queue.organization_id
      and signal.class_id is distinct from queue.class_id
  ) then
    raise exception 'Failed E2 migration did not preserve its preflight source row';
  end if;
end;
$$;
