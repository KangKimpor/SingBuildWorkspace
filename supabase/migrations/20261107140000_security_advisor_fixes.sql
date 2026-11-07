-- Supabase Security Advisor · 2026-11-07
--
-- 1. The old app left 14 SECURITY DEFINER RPCs executable by anon and
--    authenticated. The current client never calls them (it uses only
--    kw_workspace_write, kw_nbc_submission_write and kw_nbc_reassign_activities).
--    Revoke EXECUTE from the client roles. service_role keeps its grant for
--    maintenance. The functions are guarded because a fresh database built only
--    from supabase/migrations does not create the legacy objects.
-- 2. kw_nbc_owner() and kw_nbc_reassign_activities() remain callable by
--    authenticated. Move the privileged bodies to kw_private and expose thin
--    SECURITY INVOKER wrappers, matching kw_nbc_submission_write(). Existing RLS
--    policies keep working because they reference the function by OID.
--
-- Leaked-password protection is an Auth setting, not SQL; see
-- docs/PERFORMANCE-ADVISOR.md.

do $$
declare fn text;
begin
  foreach fn in array array[
    'public.apply_calendar_changes(uuid,jsonb)',
    'public.compact_page_document(uuid,text,text,text[],bigint)',
    'public.connected_account_list()',
    'public.delete_my_cloud_data()',
    'public.export_cloud_data()',
    'public.export_owner_data(uuid)',
    'public.health_check()',
    'public.notify_workspace(uuid)',
    'public.pull_changes(text,integer)',
    'public.purge_entities(jsonb)',
    'public.push_changes(jsonb)',
    'public.register_attachment(uuid,jsonb,text)',
    'public.server_storage_usage()',
    'public.storage_usage()'
  ] loop
    if to_regprocedure(fn) is not null then
      execute format('revoke execute on function %s from public, anon, authenticated', fn);
    end if;
  end loop;
end $$;

-- kw_nbc_owner() is used by every shared-NBC policy. Keep the definer body in
-- the private schema and let authenticated call a stable invoker wrapper.
alter function public.kw_nbc_owner() set schema kw_private;
revoke all on function kw_private.kw_nbc_owner() from public, anon;
grant execute on function kw_private.kw_nbc_owner() to authenticated, service_role;
create function public.kw_nbc_owner() returns uuid
  language sql stable security invoker set search_path='' as $$
  select kw_private.kw_nbc_owner()
$$;
revoke all on function public.kw_nbc_owner() from public, anon;
grant execute on function public.kw_nbc_owner() to authenticated, service_role;

-- The reassignment RPC keeps its exact server-side checks and history writing.
alter function public.kw_nbc_reassign_activities(text,jsonb,text,jsonb) set schema kw_private;
revoke all on function kw_private.kw_nbc_reassign_activities(text,jsonb,text,jsonb) from public, anon;
grant execute on function kw_private.kw_nbc_reassign_activities(text,jsonb,text,jsonb) to authenticated, service_role;
create function public.kw_nbc_reassign_activities(p_project_id text, p_activity_ids jsonb, p_handler text, p_expected jsonb)
  returns jsonb language sql security invoker set search_path='' as $$
  select kw_private.kw_nbc_reassign_activities(p_project_id, p_activity_ids, p_handler, p_expected)
$$;
revoke all on function public.kw_nbc_reassign_activities(text,jsonb,text,jsonb) from public, anon;
grant execute on function public.kw_nbc_reassign_activities(text,jsonb,text,jsonb) to authenticated, service_role;
