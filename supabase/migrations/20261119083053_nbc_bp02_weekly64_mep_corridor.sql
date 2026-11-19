-- BP02 follows the Weekly 64 report (2. & 5. BP-02 Weekly 64 - 15 Nov - 21 Nov 2026.xlsx). Progress values are not changed.
--
-- Weekly 64 changes one formula: on every '<n>F(MEP)' sheet a task's floor figure is AVERAGE(E:last room) * D, where it used to run to the
-- corridor column too (AVERAGE(E12:AA12) became AVERAGE(E12:Z12)). The corridor (CRD) cell stays on the sheet and keeps its percentage, but it
-- no longer counts toward the floor's MEP progress or the project's overall.
--
-- So in the database every MEP task that has a CRD leaf (220 tasks, 20 on each floor) gets:
--   * the CRD leaf: relativeWeight 0 and globalWeight 0 (the cell stays editable and keeps its progress and history);
--   * the other leaves of the task: relativeWeight 1 (unchanged) and globalWeight scaled by cells / (cells - 1), so the task keeps its weight
--     (a shared Water Closet cell keeps its two halves). Parents carry the sum of their leaves, so no parent row changes.
-- The extractor (scripts/nbc-bp02-report-extract.py) gives the same weights and reproduces P.sum!E7 and the 11 floor figures to 1e-9.
--
-- Summaries of the two editable weeks are recomputed with the new weights, as the confirm function does.
-- Forward-only and idempotent (only tasks whose CRD leaf still weighs something are touched); a database without BP02 rows is left alone.

do $migration$
declare
  dry constant boolean := false;
  stamp timestamptz := clock_timestamp();
  owner uuid;
  bad text; report jsonb;
  w date; ov float8; prev float8; contrib jsonb;
begin
  select user_id into owner from public.kw_nbc_activities where project_id = 'nbc-bp02' and parent_id is null limit 1;
  if owner is null then return; end if;

  alter table public.kw_nbc_activities disable trigger nbc_activity_guard;

  -- 1. MEP leaves by task: how many room cells the task has and how many of them are not the corridor.
  create temp table bp02_mep on commit drop as
  select id, parent_id task_id, data->>'room' room, (data->>'globalWeight')::float8 gw, (data->>'relativeWeight')::float8 rel
  from public.kw_nbc_activities
  where user_id = owner and project_id = 'nbc-bp02' and data->>'editable' = 'true' and data->>'area' = 'MEP WORKS';

  create temp table bp02_task on commit drop as
  select task_id, count(distinct room) cells, count(distinct room) filter (where room <> 'CRD') rooms
  from bp02_mep group by task_id
  having bool_or(room = 'CRD' and rel <> 0);

  select string_agg(task_id, ' ') into bad from bp02_task where rooms = 0;
  if bad is not null then raise exception 'BP02 MEP tasks with only a corridor cell: %', left(bad, 500); end if;

  create temp table bp02_new on commit drop as
  select m.id, case when m.room = 'CRD' then 0::float8 else m.gw * t.cells / t.rooms end gw, case when m.room = 'CRD' then 0::float8 else m.rel end rel
  from bp02_mep m join bp02_task t on t.task_id = m.task_id;

  update public.kw_nbc_activities a
  set data = a.data || jsonb_build_object('globalWeight', x.gw, 'relativeWeight', x.rel, 'updatedAt', stamp), updated_at = stamp
  from bp02_new x
  where a.user_id = owner and a.id = x.id;

  -- 2. Summaries of the two editable weeks.
  for w in select (data->>'weekStart')::date from public.kw_nbc_summaries where project_id = 'nbc-bp02'
             and (data->>'weekStart')::date >= (select max((data->>'weekStart')::date) - 7 from public.kw_nbc_summaries where project_id = 'nbc-bp02') loop
    with sbx as materialized (
      select week_start, id, data->>'confirmedAt' confirmed_at, kw_private.nbc_applied(data) applied
      from public.kw_nbc_submissions where project_id = 'nbc-bp02' and week_start >= w::text
    ), newer as (
      select distinct on (x.elem->>'activityId') x.elem->>'activityId' aid, x.elem->'previous' prev
      from sbx sb, lateral jsonb_array_elements(sb.applied) x(elem) where sb.week_start > w::text
      order by x.elem->>'activityId', sb.week_start, sb.confirmed_at, sb.id
    ), this_week as (
      select distinct on (x.elem->>'activityId') x.elem->>'activityId' aid, x.elem->'previous' prev
      from sbx sb, lateral jsonb_array_elements(sb.applied) x(elem) where sb.week_start = w::text
      order by x.elem->>'activityId', sb.confirmed_at, sb.id
    ), vals as (
      select (a.data->>'globalWeight')::float8 gw,
        case when n.aid is not null then (n.prev #>> '{}')::float8 else (a.data->>'progress')::float8 end v,
        case when t.aid is not null then (t.prev #>> '{}')::float8 when n.aid is not null then (n.prev #>> '{}')::float8 else (a.data->>'progress')::float8 end vb,
        a.data->>'handler' owner_key
      from public.kw_nbc_activities a left join newer n on n.aid = a.id left join this_week t on t.aid = a.id
      where a.user_id = owner and a.project_id = 'nbc-bp02' and a.data->>'editable' = 'true'
    )
    select (select sum(gw * v) from vals), (select sum(gw * vb) from vals),
           (select jsonb_object_agg(owner_key, c) from (select owner_key, sum(gw * v) c from vals group by owner_key) cc)
    into ov, prev, contrib;
    update public.kw_nbc_summaries
    set data = data || jsonb_build_object('overall', ov, 'previous', prev, 'contributions', contrib, 'updatedAt', stamp), updated_at = stamp
    where project_id = 'nbc-bp02' and data->>'weekStart' = w::text;
  end loop;

  select sum((data->>'globalWeight')::float8 * (data->>'progress')::float8) into ov
  from public.kw_nbc_activities where user_id = owner and project_id = 'nbc-bp02' and data->>'editable' = 'true';
  update public.kw_projects set data = jsonb_set(data, '{progress}', to_jsonb(ov)), updated_at = stamp where id = 'nbc-bp02';

  -- 3. Checks: weights still total 100 % and no row lost its parent.
  select abs(sum((data->>'globalWeight')::float8) - 1) into prev
  from public.kw_nbc_activities where user_id = owner and project_id = 'nbc-bp02' and data->>'editable' = 'true';
  if prev > 1e-9 then raise exception 'BP02 leaf weights total % off 100%%', prev; end if;

  if dry then
    select jsonb_build_object('tasks', (select count(*) from bp02_task), 'leaves', (select count(*) from bp02_new), 'overall', ov, 'weightOff', prev,
      'floors', (select jsonb_object_agg(fl, round(v::numeric, 6)) from (
          select fl, sum(sw * sp) v from (
            select regexp_replace(r.data->>'name', '\D', '', 'g') fl, case when a.data->>'area' like 'GUESTROOM%' then 0.5 when a.data->>'area' like 'CORRIDOR%' then 0.05 else 0.45 end sw, a.data->>'area' ar,
                   sum((a.data->>'globalWeight')::float8 * (a.data->>'progress')::float8) / sum((a.data->>'globalWeight')::float8) sp
            from public.kw_nbc_activities a join public.kw_nbc_activities r on r.user_id = owner and r.parent_id is null and r.project_id = 'nbc-bp02' and a.id like r.id || '.%'
            where a.user_id = owner and a.project_id = 'nbc-bp02' and a.data->>'editable' = 'true' group by 1, 2, 3) x group by fl) y),
      'summaries', (select jsonb_agg(jsonb_build_object('w', data->>'weekStart', 'o', data->'overall', 'p', data->'previous')) from public.kw_nbc_summaries where project_id = 'nbc-bp02'),
      'rows_updated', (select count(*) from public.kw_nbc_activities where user_id = owner and project_id = 'nbc-bp02' and updated_at = stamp))
    into report;
    raise exception 'DRYRUN %', report;
  end if;

  -- Flush the deferred parent foreign keys, otherwise ALTER TABLE refuses with pending trigger events.
  set constraints all immediate;
  alter table public.kw_nbc_activities enable trigger nbc_activity_guard;
end
$migration$;
