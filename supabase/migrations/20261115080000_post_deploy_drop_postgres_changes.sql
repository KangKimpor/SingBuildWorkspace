-- Forward-only. APPLY ONLY AFTER the D-37 client is live (D-37).
--
-- Clients before D-37 subscribe to postgres_changes and compute the Needs review state from full
-- submission coverage. The D-37 client listens to the id broadcasts from 20261115073911 and honours
-- the stored needsReview flag, so once it ships:
-- 1. Stop streaming full rows: no client subscribes to postgres_changes any more. This also stops the
--    Realtime WAL polling query, the largest consumer of database time on this project.
-- 2. Compact frozen weeks now and every Sunday at 00:30 Asia/Phnom_Penh (Saturday 17:30 UTC).

do $$ declare t text; begin
  foreach t in array array['kw_pages','kw_projects','kw_tasks','kw_profiles','kw_nbc_activities','kw_nbc_submissions','kw_nbc_summaries'] loop
    if exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime drop table public.%I', t);
    end if;
  end loop;
end $$;

select kw_private.nbc_compact_frozen_submissions();

do $$ begin
  if exists (select 1 from cron.job where jobname='kw-nbc-compact-frozen-submissions') then
    perform cron.unschedule('kw-nbc-compact-frozen-submissions');
  end if;
end $$;
select cron.schedule('kw-nbc-compact-frozen-submissions', '30 17 * * 6', 'select kw_private.nbc_compact_frozen_submissions()');
