-- Forward-only. Quarantine the objects the app no longer uses (D-37).
--
-- The project still carried an earlier app's tables, security-definer RPCs, a 15-minute cron job
-- and five Edge Functions, plus workspace tables this app stopped writing (events, labels,
-- reminders, reports, OAuth states). None of it is read by the current client. Moving the tables
-- and functions into kw_legacy (no grants, not exposed through the Data API) removes them from the
-- API surface while keeping every row, so the step can be undone with ALTER ... SET SCHEMA public.
-- The Edge Function sources were saved to .private/legacy-edge-functions-2026-11-15/ before deletion.

create schema if not exists kw_legacy;
revoke all on schema kw_legacy from public, anon, authenticated;

-- Stop streaming changes for tables no client subscribes to.
do $$ declare t text; begin
  foreach t in array array['kw_events','kw_nbc_reports'] loop
    if exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime drop table public.%I', t);
    end if;
  end loop;
end $$;

do $$ declare t text; begin
  foreach t in array array[
    -- earlier app
    'pages','calendars','events','databases','sync_changes','page_doc_updates','page_doc_snapshots',
    'page_versions','encrypted_doc_updates','tags','user_settings','push_subscriptions','tombstones',
    'connected_accounts','calendar_oauth_requests','reminder_deliveries','sync_receipts','attachments',
    'permanent_deletions','purged_files',
    -- workspace tables the client no longer reads or writes
    'kw_events','kw_labels','kw_task_labels','kw_reminders','kw_nbc_reports','kw_oauth_states'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke all on table public.%I from public, anon, authenticated', t);
      execute format('alter table public.%I set schema kw_legacy', t);
    end if;
  end loop;
end $$;

do $$ declare f regprocedure; begin
  for f in
    select p.oid::regprocedure from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname in (
      'apply_calendar_changes','compact_page_document','connected_account_list','delete_my_cloud_data',
      'export_cloud_data','export_owner_data','health_check','merge_clock_fields','notify_workspace',
      'pull_changes','purge_entities','purge_workspace_page','push_changes','push_retained_changes',
      'register_attachment','server_storage_usage','storage_usage','kw_nbc_discard_update'
    )
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('alter function %s set schema kw_legacy', f);
  end loop;
end $$;

-- The legacy maintenance job posted a vault secret to a URL that has answered 404 since the old
-- functions were removed. Its command is kept here in case it is ever needed again:
--   select net.http_post(url:=(select decrypted_secret from vault.decrypted_secrets where name='velora_maintenance_url' limit 1),
--     headers:=jsonb_build_object('Content-Type','application/json','x-maintenance-secret',
--       (select decrypted_secret from vault.decrypted_secrets where name='velora_maintenance_secret' limit 1)),
--     body:='{"action":"scheduled"}'::jsonb)
do $$ begin
  if exists (select 1 from cron.job where jobname='velora-maintenance') then perform cron.unschedule('velora-maintenance'); end if;
end $$;

-- Legacy access paths: the earlier app's broadcast topic and its (empty) attachments bucket.
drop policy if exists owner_broadcast on realtime.messages;
drop policy if exists attachments_read on storage.objects;
drop policy if exists attachments_delete on storage.objects;
