-- Supabase Performance Advisor · 2026-11-07
--
-- 1. kw_projects had two permissive SELECT policies (own_rows + nbc_company_read),
--    so every read evaluated both. Keep one SELECT policy and split the owner
--    write policy into per-action policies.
-- 2. Cover the manifest queries the client runs on every sync. The NBC BOQ is
--    ~17k rows; without updated_at in the index each sync seq-scans and sorts it.
-- 3. Remove the redundant kw_profiles.user_id FK. id is already checked equal to
--    user_id and its FK cascades from auth.users.
-- 4. Index the FKs on the legacy tables that the old export/delete RPCs still
--    name. They are historical, but the indexes are tiny and make account
--    deletion cheap.
--
-- The kw_private.nbc_*_bk_* tables are manual snapshots, not application tables.
-- They are intentionally not changed here; see docs/PERFORMANCE-ADVISOR.md.

drop policy if exists nbc_company_read on public.kw_projects;
drop policy if exists own_rows on public.kw_projects;
drop policy if exists kw_projects_read on public.kw_projects;
drop policy if exists kw_projects_insert on public.kw_projects;
drop policy if exists kw_projects_update on public.kw_projects;
drop policy if exists kw_projects_delete on public.kw_projects;

create policy kw_projects_read on public.kw_projects
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and ((select auth.uid()) = user_id or data->>'nbcBp03' = 'true')
  );

create policy kw_projects_insert on public.kw_projects
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy kw_projects_update on public.kw_projects
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy kw_projects_delete on public.kw_projects
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- kw_nbc_owner() runs inside every NBC RLS policy; keep it off a seq scan.
create index if not exists kw_projects_nbc_owner_idx
  on public.kw_projects(user_id)
  where data->>'nbcBp03' = 'true';

-- The client pulls id, updated_at ordered by updated_at for one project. The
-- existing (user_id, project_id) index cannot serve a project-only filter and
-- forces a full scan plus sort of the whole BOQ on every sync.
create index if not exists kw_nbc_activities_project_sync_idx
  on public.kw_nbc_activities(project_id, updated_at, id);

create index if not exists kw_nbc_submissions_project_sync_idx
  on public.kw_nbc_submissions(project_id, updated_at, id);

-- WBS parent lookups and the self-referencing parent FK's cascade.
create index if not exists kw_nbc_activities_parent_idx
  on public.kw_nbc_activities(user_id, parent_id)
  where parent_id is not null;

alter table public.kw_profiles drop constraint if exists kw_profiles_user_id_fkey;

-- Guarded because these legacy tables predate the tracked migrations and are not
-- created by them. A fresh database built only from supabase/migrations still applies.
do $$
begin
  if to_regclass('public.calendar_oauth_requests') is not null then
    create index if not exists calendar_oauth_requests_user_id_idx
      on public.calendar_oauth_requests(user_id);
  end if;
  if to_regclass('public.connected_accounts') is not null then
    create index if not exists connected_accounts_user_id_idx
      on public.connected_accounts(user_id);
  end if;
  if to_regclass('public.page_doc_updates') is not null then
    create index if not exists page_doc_updates_user_id_page_id_idx
      on public.page_doc_updates(user_id, page_id);
  end if;
  if to_regclass('public.page_versions') is not null then
    create index if not exists page_versions_user_id_page_id_idx
      on public.page_versions(user_id, page_id);
  end if;
  if to_regclass('public.push_subscriptions') is not null then
    create index if not exists push_subscriptions_user_id_idx
      on public.push_subscriptions(user_id);
  end if;
  if to_regclass('public.tags') is not null then
    create index if not exists tags_user_id_idx
      on public.tags(user_id);
  end if;
  if to_regclass('public.kw_oauth_states') is not null then
    create index if not exists kw_oauth_states_user_id_idx
      on public.kw_oauth_states(user_id);
  end if;
end $$;
