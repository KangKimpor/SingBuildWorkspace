-- Forward-only. Realtime sends row ids instead of rows; frozen weeks keep only changed entries (D-37).
--
-- 1. Statement-level triggers broadcast {collection, rows:[{id, updated_at}]} once per statement
--    (or {collection, refresh:true} above 200 rows) on private topics:
--      kw-workspace:<user id>  pages, tasks, projects, profiles (deletes keep kw_private.workspace_deleted)
--      kw-nbc:<project id>     NBC activities, submissions, summaries and the shared project row
--    Clients fetch only ids they do not already hold, so a writer never downloads its own write and a
--    16,099-row migration costs one message instead of one full row per row per client.
--    The postgres_changes publication is dropped by 20261115080000 after the client ships.
-- 2. kw_private.nbc_compact_frozen_submissions() drops no-op entries (progress = previous, remark
--    unchanged) from confirmed submissions older than last week. Those weeks are outside the editable
--    window and are never re-chained, so the stored values stay identical. The Needs review state is
--    computed once and stored as needsReview, because the full coverage it was derived from is gone.

create or replace function kw_private.broadcast_changes() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  collection text := substr(tg_table_name, 4);
  event text := case when tg_op = 'DELETE' then 'DELETE' else 'UPSERT' end;
  r record;
begin
  -- One query per table kind: PL/pgSQL plans each statement on first use, so the NBC branch's
  -- project_id (a generated column) is never parsed for the workspace tables.
  if tg_argv[0] = 'nbc' then
    for r in
      select 'kw-nbc:' || c.project_id topic, count(*) n,
        jsonb_agg(jsonb_build_object('id', c.id, 'updated_at', c.updated_at) order by c.id) rows
      from changed c where c.project_id is not null group by 1
    loop
      perform realtime.send(case when r.n > 200 then jsonb_build_object('collection', collection, 'refresh', true)
        else jsonb_build_object('collection', collection, 'rows', r.rows) end, event, r.topic, true);
    end loop;
  elsif tg_argv[0] = 'projects' then
    for r in
      select x.topic, count(*) n, jsonb_agg(jsonb_build_object('id', x.id, 'updated_at', x.updated_at) order by x.id) rows
      from (
        select 'kw-workspace:' || c.user_id::text topic, c.id, c.updated_at from changed c
        union all
        select 'kw-nbc:' || c.id, c.id, c.updated_at from changed c where c.data->>'nbcBp03' = 'true'
      ) x group by 1
    loop
      perform realtime.send(case when r.n > 200 then jsonb_build_object('collection', collection, 'refresh', true)
        else jsonb_build_object('collection', collection, 'rows', r.rows) end, event, r.topic, true);
    end loop;
  else
    for r in
      select 'kw-workspace:' || c.user_id::text topic, count(*) n,
        jsonb_agg(jsonb_build_object('id', c.id::text, 'updated_at', c.updated_at) order by c.id) rows
      from changed c group by 1
    loop
      perform realtime.send(case when r.n > 200 then jsonb_build_object('collection', collection, 'refresh', true)
        else jsonb_build_object('collection', collection, 'rows', r.rows) end, event, r.topic, true);
    end loop;
  end if;
  return null;
end $$;
revoke all on function kw_private.broadcast_changes() from public, anon, authenticated;

do $$ declare t text; kind text; op text; begin
  foreach t in array array['kw_pages','kw_tasks','kw_profiles','kw_projects','kw_nbc_activities','kw_nbc_submissions','kw_nbc_summaries'] loop
    kind := case when t like 'kw_nbc_%' then 'nbc' when t = 'kw_projects' then 'projects' else 'workspace' end;
    foreach op in array case when kind = 'nbc' then array['insert','update','delete'] else array['insert','update'] end loop
      execute format('drop trigger if exists kw_broadcast_%s on public.%I', op, t);
      execute format(
        'create trigger kw_broadcast_%s after %s on public.%I referencing %s table as changed for each statement execute function kw_private.broadcast_changes(%L)',
        op, op, t, case when op = 'delete' then 'old' else 'new' end, kind);
    end loop;
  end loop;
end $$;

-- Staff receive the company project topics; kw-workspace:<uid> keeps its owner-only policy.
drop policy if exists kw_nbc_receive on realtime.messages;
create policy kw_nbc_receive on realtime.messages for select to authenticated using (
  (select realtime.topic()) like 'kw-nbc:%' and (select kw_private.kw_staff())
);

create or replace function kw_private.nbc_compact_frozen_submissions() returns integer
language plpgsql security definer set search_path='' as $$
declare
  current_week date := (date_trunc('week', (clock_timestamp() at time zone 'Asia/Phnom_Penh') + interval '1 day')::date - 1);
  stamp timestamptz := clock_timestamp();
  n integer;
begin
  with target as (
    select s.user_id, s.id, s.project_id, s.data
    from public.kw_nbc_submissions s
    where s.data->>'status' = 'confirmed'
      and s.week_start < (current_week - 7)::text
      and coalesce((s.data->>'compacted')::boolean, false) = false
  ), recorded as (
    select t.id, e->>'activityId' activity_id
    from target t
    cross join lateral jsonb_array_elements(coalesce(t.data->'entries', '[]')) e
    join public.kw_nbc_activities a on a.user_id = t.user_id and a.project_id = t.project_id and a.id = e->>'activityId'
  ), assigned as (
    select t.id, a.id activity_id
    from target t
    join public.kw_nbc_activities a on a.user_id = t.user_id and a.project_id = t.project_id
      and a.data->>'editable' = 'true' and a.data->>'handler' = t.data->>'handler'
  ), review as (
    select t.id,
      exists (select 1 from assigned x where x.id = t.id and not exists (select 1 from recorded r where r.id = t.id and r.activity_id = x.activity_id))
      or exists (select 1 from recorded r where r.id = t.id and not exists (select 1 from assigned x where x.id = t.id and x.activity_id = r.activity_id)) needs_review
    from target t
  ), compacted as (
    select t.user_id, t.id, rv.needs_review,
      coalesce((
        select jsonb_agg(x.e order by x.ord)
        from jsonb_array_elements(coalesce(t.data->'entries', '[]')) with ordinality x(e, ord)
        where jsonb_typeof(x.e->'progress') is distinct from 'number'
           or jsonb_typeof(x.e->'previous') is distinct from 'number'
           or abs((x.e->>'progress')::numeric - (x.e->>'previous')::numeric) > 1e-12
           or coalesce(x.e->>'remark', '') <> coalesce(x.e->>'previousRemark', '')
      ), '[]'::jsonb) entries
    from target t join review rv on rv.id = t.id
  )
  update public.kw_nbc_submissions s
  set data = (s.data - 'appliedEntries') || jsonb_build_object(
        'entries', c.entries, 'compacted', true, 'needsReview', c.needs_review, 'updatedAt', stamp),
      updated_at = stamp
  from compacted c
  where s.user_id = c.user_id and s.id = c.id;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function kw_private.nbc_compact_frozen_submissions() from public, anon, authenticated;
