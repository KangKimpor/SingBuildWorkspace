-- BP02 follows the Weekly 63 report (2. & 5. BP-02 Weekly 63 - 08 Nov - 14 Nov 2026.xlsx). Progress values are not changed.
--
-- Structure (from the report, compared with Weekly 62, which the database matched cell for cell):
--   * Corridor Door Installation drops "Install Glass Sliding Door" and "Install Double Door Leave Glass" (11 floors).
--   * Floor 13 room SK1-1318 is N/A everywhere (room weight 0), so its leaves go.
--   * Floor 21: the ID sheet merges PS-2119 and CST3-2120 into PS-ST3-2119 and the MEP sheet drops CST3-2120.
--     The PS-2119 leaves are renamed PS-ST3-2119; the CST3-2120 leaves go.
--   * Renamed: "Final Ceiling Decoration by Waterproof Paint" -> "Final Ceiling Decoration";
--     corridor "Install Carpet & Rug Including all Underlay and Accessories" -> "Install Wall to Wall Carpet".
--   * Submission entries of removed leaves are dropped (as for GR&P); the two editable weeks' summaries are recomputed.
--
-- Weights (the report's new formulas, P.sum!E7):
--   overall = 50% Guestroom + 5% Corridor + 45% MEP. Guestroom and MEP weigh each floor by its room count ('F<n> (ID)'!D6),
--   the corridor weighs floors equally. A floor's own figure (P.sum!G7:Q7) is 50/5/45 of its three sections.
--   Guestroom: groups by D, rooms equally within a group, tasks by E renormalised over the tasks a room has (N/A drops out).
--   Corridor: groups by D, tasks by E. MEP: systems and subsystems equally, tasks by D, rooms equally over the cells that
--   hold a number (a shared Water Closet cell is two halves).
--   globalWeight carries the project-wide weighting (calculate().overall); relativeWeight the floor-level one, so floor,
--   section and group rows equal the report's figures. The spec holds, per floor, n (rooms), A/B as [D, [E...]] per group
--   and C as [[D...] per subsystem] per system, in report order.
--
-- Forward-only and idempotent; a database without BP02 rows is left alone.
-- Production (12 November 2026): this body ran as a temporary function (dry run first, then for real, then dropped), after
-- copying BP02 to kw_private.nbc_bp02_bk_20261112_wk63_{activities,submissions,summaries,projects}. 134 rows removed
-- (112 leaves, 22 corridor tasks), 16,550 rows reweighted, 15 submissions cleaned; no progress value changed.
-- Overall with the team's percentages: 84.9037% under the Weekly 62 formulas, 85.2759% under Weekly 63.

do $migration$
declare
  spec constant jsonb := '{"23":{"n":13,"A":[[0.05,[1.0]],[0.1,[1.0]],[0.2,[0.6,0.4]],[0.2,[0.3,0.2,0.4,0.1]],[0.15,[0.3,0.3,0.2,0.2]],[0.15,[0.4,0.5,0.1]],[0.025,[0.25,0.25,0.25,0.25]],[0.05,[1.0]],[0.025,[1.0]],[0.025,[1.0]],[0.025,[1.0]]],"B":[[0.05,[1.0]],[0.15,[1.0]],[0.2,[0.5,0.5]],[0.2,[0.25,0.25,0.25,0.25]],[0.25,[0.6,0.1,0.3]],[0.15,[0.45,0.45,0.1]]],"C":[[[0.4,0.4,0.1,0.05,0.05],[0.4,0.4,0.1,0.05,0.05],[0.45,0.45,0.05,0.05]],[[0.4,0.4,0.1,0.05,0.05],[0.4,0.4,0.1,0.05,0.05]],[[0.4,0.4,0.1,0.05,0.05]],[[0.9,0.05,0.05],[0.2,0.7,0.05,0.05],[0.9,0.05,0.05]],[[0.8,0.1,0.05,0.05]]]},"22":{"n":20,"A":[[0.05,[1.0]],[0.075,[1.0]],[0.2,[0.6,0.4]],[0.2,[0.3,0.25,0.35,0.1]],[0.175,[0.3,0.25,0.3,0.15]],[0.15,[0.45,0.45,0.1]],[0.025,[0.25,0.25,0.25,0.25]],[0.05,[1.0]],[0.025,[1.0]],[0.025,[1.0]],[0.025,[1.0]]],"B":[[0.05,[1.0]],[0.15,[1.0]],[0.2,[0.5,0.5]],[0.2,[0.25,0.25,0.25,0.25]],[0.25,[0.6,0.1,0.3]],[0.15,[0.45,0.45,0.1]]],"C":[[[0.4,0.4,0.1,0.05,0.05],[0.4,0.4,0.1,0.05,0.05],[0.45,0.45,0.05,0.05]],[[0.4,0.4,0.1,0.05,0.05],[0.4,0.4,0.1,0.05,0.05]],[[0.4,0.4,0.1,0.05,0.05]],[[0.9,0.05,0.05],[0.2,0.7,0.05,0.05],[0.9,0.05,0.05]],[[0.8,0.1,0.05,0.05]]]},"21":{"n":19,"A":[[0.05,[1.0]],[0.1,[1.0]],[0.2,[0.6,0.4]],[0.2,[0.3,0.2,0.4,0.1]],[0.15,[0.3,0.25,0.3,0.15]],[0.15,[0.45,0.45,0.1]],[0.025,[0.25,0.25,0.25,0.25]],[0.05,[1.0]],[0.025,[1.0]],[0.025,[1.0]],[0.025,[1.0]]],"B":[[0.05,[1.0]],[0.15,[1.0]],[0.2,[0.5,0.5]],[0.2,[0.25,0.25,0.25,0.25]],[0.25,[0.6,0.1,0.3]],[0.15,[0.45,0.45,0.1]]],"C":[[[0.4,0.4,0.1,0.05,0.05],[0.4,0.4,0.1,0.05,0.05],[0.45,0.45,0.05,0.05]],[[0.4,0.4,0.1,0.05,0.05],[0.4,0.4,0.1,0.05,0.05]],[[0.4,0.4,0.1,0.05,0.05]],[[0.9,0.05,0.05],[0.2,0.7,0.05,0.05],[0.9,0.05,0.05]],[[0.8,0.1,0.05,0.05]]]},"20":{"n":21,"A":[[0.05,[1.0]],[0.1,[1.0]],[0.2,[0.6,0.4]],[0.21,[0.3,0.2,0.4,0.1]],[0.16,[0.3,0.25,0.3,0.15]],[0.16,[0.45,0.45,0.1]],[0.025,[0.25,0.25,0.25,0.25]],[0.05,[1.0]],[0.015,[1.0]],[0.015,[1.0]],[0.015,[1.0]]],"B":[[0.05,[1.0]],[0.15,[1.0]],[0.2,[0.5,0.5]],[0.2,[0.25,0.25,0.25,0.25]],[0.25,[0.6,0.1,0.3]],[0.15,[0.45,0.45,0.1]]],"C":[[[0.4,0.4,0.1,0.05,0.05],[0.4,0.4,0.1,0.05,0.05],[0.45,0.45,0.05,0.05]],[[0.4,0.4,0.1,0.05,0.05],[0.4,0.4,0.1,0.05,0.05]],[[0.4,0.4,0.1,0.05,0.05]],[[0.9,0.05,0.05],[0.2,0.7,0.05,0.05],[0.9,0.05,0.05]],[[0.8,0.1,0.05,0.05]]]},"19":{"n":21,"A":[[0.025,[1.0]],[0.1,[1.0]],[0.2,[0.6,0.4]],[0.21,[0.325,0.25,0.35,0.075]],[0.15,[0.2,0.3,0.4,0.1]],[0.16,[0.45,0.45,0.1]],[0.05,[0.25,0.25,0.25,0.25]],[0.05,[1.0]],[0.025,[1.0]],[0.015,[1.0]],[0.015,[1.0]]],"B":[[0.05,[1.0]],[0.15,[1.0]],[0.2,[0.5,0.5]],[0.2,[0.25,0.25,0.25,0.25]],[0.25,[0.6,0.1,0.3]],[0.15,[0.45,0.45,0.1]]],"C":[[[0.4,0.4,0.1,0.05,0.05],[0.4,0.4,0.1,0.05,0.05],[0.45,0.45,0.05,0.05]],[[0.4,0.4,0.1,0.05,0.05],[0.4,0.4,0.1,0.05,0.05]],[[0.4,0.4,0.1,0.05,0.05]],[[0.9,0.05,0.05],[0.2,0.7,0.05,0.05],[0.9,0.05,0.05]],[[0.8,0.1,0.05,0.05]]]},"18":{"n":22,"A":[[0.05,[1.0]],[0.075,[1.0]],[0.2,[0.6,0.4]],[0.2,[0.35,0.2,0.35,0.1]],[0.175,[0.2,0.3,0.35,0.15]],[0.15,[0.45,0.45,0.1]],[0.025,[0.25,0.25,0.25,0.25]],[0.05,[1.0]],[0.025,[1.0]],[0.025,[1.0]],[0.025,[1.0]]],"B":[[0.05,[1.0]],[0.15,[1.0]],[0.2,[0.5,0.5]],[0.2,[0.25,0.25,0.25,0.25]],[0.25,[0.6,0.1,0.3]],[0.15,[0.45,0.45,0.1]]],"C":[[[0.4,0.4,0.1,0.05,0.05],[0.4,0.4,0.1,0.05,0.05],[0.45,0.45,0.05,0.05]],[[0.4,0.4,0.1,0.05,0.05],[0.4,0.4,0.1,0.05,0.05]],[[0.4,0.4,0.1,0.05,0.05]],[[0.9,0.05,0.05],[0.2,0.7,0.05,0.05],[0.9,0.05,0.05]],[[0.8,0.1,0.05,0.05]]]},"17":{"n":22,"A":[[0.05,[1.0]],[0.075,[1.0]],[0.2,[0.6,0.4]],[0.2,[0.3,0.2,0.4,0.1]],[0.175,[0.2,0.3,0.35,0.15]],[0.15,[0.45,0.45,0.1]],[0.025,[0.25,0.25,0.25,0.25]],[0.05,[1.0]],[0.025,[1.0]],[0.025,[1.0]],[0.025,[1.0]]],"B":[[0.05,[1.0]],[0.15,[1.0]],[0.2,[0.5,0.5]],[0.2,[0.25,0.25,0.25,0.25]],[0.25,[0.6,0.1,0.3]],[0.15,[0.45,0.45,0.1]]],"C":[[[0.4,0.4,0.1,0.05,0.05],[0.4,0.4,0.1,0.05,0.05],[0.45,0.45,0.05,0.05]],[[0.4,0.4,0.1,0.05,0.05],[0.4,0.4,0.1,0.05,0.05]],[[0.4,0.4,0.1,0.05,0.05]],[[0.9,0.05,0.05],[0.2,0.7,0.05,0.05],[0.9,0.05,0.05]],[[0.8,0.1,0.05,0.05]]]},"16":{"n":22,"A":[[0.025,[1.0]],[0.1,[1.0]],[0.2,[0.6,0.4]],[0.21,[0.3,0.3,0.3,0.1]],[0.16,[0.2,0.3,0.35,0.15]],[0.15,[0.45,0.45,0.1]],[0.05,[0.25,0.25,0.25,0.25]],[0.05,[1.0]],[0.025,[1.0]],[0.015,[1.0]],[0.015,[1.0]]],"B":[[0.05,[1.0]],[0.15,[1.0]],[0.2,[0.5,0.5]],[0.2,[0.25,0.25,0.25,0.25]],[0.25,[0.6,0.1,0.3]],[0.15,[0.45,0.45,0.1]]],"C":[[[0.4,0.4,0.1,0.05,0.05],[0.4,0.4,0.1,0.05,0.05],[0.45,0.45,0.05,0.05]],[[0.4,0.4,0.1,0.05,0.05],[0.4,0.4,0.1,0.05,0.05]],[[0.4,0.4,0.1,0.05,0.05]],[[0.9,0.05,0.05],[0.2,0.7,0.05,0.05],[0.9,0.05,0.05]],[[0.8,0.1,0.05,0.05]]]},"15":{"n":22,"A":[[0.025,[1.0]],[0.1,[1.0]],[0.2,[0.6,0.4]],[0.21,[0.3,0.3,0.3,0.1]],[0.16,[0.2,0.3,0.35,0.15]],[0.15,[0.45,0.45,0.1]],[0.05,[0.25,0.25,0.25,0.25]],[0.05,[1.0]],[0.025,[1.0]],[0.015,[1.0]],[0.015,[1.0]]],"B":[[0.05,[1.0]],[0.15,[1.0]],[0.2,[0.5,0.5]],[0.2,[0.25,0.25,0.25,0.25]],[0.25,[0.6,0.1,0.3]],[0.15,[0.45,0.45,0.1]]],"C":[[[0.4,0.4,0.1,0.05,0.05],[0.4,0.4,0.1,0.05,0.05],[0.45,0.45,0.05,0.05]],[[0.4,0.4,0.1,0.05,0.05],[0.4,0.4,0.1,0.05,0.05]],[[0.4,0.4,0.1,0.05,0.05]],[[0.9,0.05,0.05],[0.2,0.7,0.05,0.05],[0.9,0.05,0.05]],[[0.8,0.1,0.05,0.05]]]},"14":{"n":22,"A":[[0.05,[1.0]],[0.07,[1.0]],[0.2,[0.6,0.4]],[0.2,[0.3,0.3,0.3,0.1]],[0.2,[0.2,0.3,0.35,0.15]],[0.15,[0.45,0.45,0.1]],[0.02,[0.25,0.25,0.25,0.25]],[0.05,[1.0]],[0.02,[1.0]],[0.02,[1.0]],[0.02,[1.0]]],"B":[[0.05,[1.0]],[0.15,[1.0]],[0.2,[0.5,0.5]],[0.2,[0.25,0.25,0.25,0.25]],[0.25,[0.6,0.1,0.3]],[0.15,[0.45,0.45,0.1]]],"C":[[[0.4,0.4,0.1,0.05,0.05],[0.4,0.4,0.1,0.05,0.05],[0.45,0.45,0.05,0.05]],[[0.4,0.4,0.1,0.05,0.05],[0.4,0.4,0.1,0.05,0.05]],[[0.4,0.4,0.1,0.05,0.05]],[[0.9,0.05,0.05],[0.2,0.7,0.05,0.05],[0.9,0.05,0.05]],[[0.8,0.1,0.05,0.05]]]},"13":{"n":21,"A":[[0.05,[1.0]],[0.075,[1.0]],[0.2,[0.6,0.4]],[0.2,[0.3,0.3,0.3,0.1]],[0.195,[0.2,0.3,0.35,0.15]],[0.15,[0.45,0.45,0.1]],[0.025,[0.25,0.25,0.25,0.25]],[0.05,[1.0]],[0.015,[1.0]],[0.025,[1.0]],[0.015,[1.0]]],"B":[[0.05,[1.0]],[0.15,[1.0]],[0.2,[0.5,0.5]],[0.2,[0.25,0.25,0.25,0.25]],[0.25,[0.6,0.1,0.3]],[0.15,[0.45,0.45,0.1]]],"C":[[[0.4,0.4,0.1,0.05,0.05],[0.4,0.4,0.1,0.05,0.05],[0.45,0.45,0.05,0.05]],[[0.4,0.4,0.1,0.05,0.05],[0.4,0.4,0.1,0.05,0.05]],[[0.225,0.225,0.45,0.05,0.05]],[[0.9,0.05,0.05],[0.2,0.7,0.05,0.05],[0.9,0.05,0.05]],[[0.8,0.1,0.05,0.05]]]}}';
  dry constant boolean := false;
  stamp timestamptz := clock_timestamp();
  owner uuid;
  n_total float8; n_floors int;
  removed int; bad text; report jsonb;
  w date; ov float8; prev float8; contrib jsonb;
begin
  select user_id into owner from public.kw_nbc_activities where project_id = 'nbc-bp02' and parent_id is null limit 1;
  if owner is null then return; end if;
  select sum((value->>'n')::float8), count(*) into n_total, n_floors from jsonb_each(spec);

  alter table public.kw_nbc_activities disable trigger nbc_activity_guard;

  -- 1. Rows the report no longer has.
  create temp table bp02_gone on commit drop as
  with roots as (
    select id, regexp_replace(data->>'name', '\D', '', 'g') fl from public.kw_nbc_activities
    where user_id = owner and project_id = 'nbc-bp02' and parent_id is null
  ), door_tasks as (
    select t.id from public.kw_nbc_activities s
    join roots r on s.parent_id = r.id and s.data->>'item' = 'B'
    join public.kw_nbc_activities g on g.parent_id = s.id and g.data->>'item' = 'VI'
    join public.kw_nbc_activities t on t.parent_id = g.id and t.data->>'name' in ('Install Glass Sliding Door', 'Install Double Door Leave Glass')
    where s.user_id = owner
  )
  select id from door_tasks
  union select l.id from public.kw_nbc_activities l join door_tasks d on l.parent_id = d.id
  union select l.id from public.kw_nbc_activities l join roots r on l.id like r.id || '.%'
    where l.user_id = owner and l.project_id = 'nbc-bp02' and l.data->>'editable' = 'true'
      and ((r.fl = '13' and l.data->>'room' = 'SK1-1318') or (r.fl = '21' and l.data->>'room' = 'CST3-2120'));
  delete from public.kw_nbc_activities a using bp02_gone g where a.user_id = owner and a.id = g.id;
  get diagnostics removed = row_count;

  -- 2. Every remaining node with its floor, section and positions (1-based, in workbook order).
  create temp table bp02_node on commit drop as
  with recursive s as (
    select id, parent_id, data, row_number() over (partition by parent_id order by (data->>'order')::numeric, id)::int idx
    from public.kw_nbc_activities where user_id = owner and project_id = 'nbc-bp02'
  ), t as (
    select id, parent_id, data, 0 depth, regexp_replace(data->>'name', '\D', '', 'g') fl, null::text sec,
           null::int gi, null::int si, null::int ti, array[id] path
    from s where parent_id is null
    union all
    select s.id, s.parent_id, s.data, t.depth + 1, t.fl,
           case when t.depth = 0 then s.data->>'item' else t.sec end,
           case when t.depth = 1 then s.idx else t.gi end,
           case when t.depth = 2 and t.sec = 'C' then s.idx else t.si end,
           case when (t.depth = 2 and t.sec <> 'C') or (t.depth = 3 and t.sec = 'C') then s.idx else t.ti end,
           t.path || s.id
    from s join t on s.parent_id = t.id
  )
  select *, data->>'editable' = 'true' leaf from t;

  -- The report and the database must line up: every floor, group, subsystem and task position.
  select string_agg(distinct fl, ',') into bad from bp02_node where depth = 0 and not spec ? fl;
  if bad is not null then raise exception 'BP02 floors not in the Weekly 63 spec: %', bad; end if;
  select string_agg(format('%s/%s/%s/%s', fl, sec, gi, coalesce(si, 0)), ' ') into bad from (
    select fl, sec, gi, si, max(ti) tasks,
           case when sec = 'C' then jsonb_array_length(spec->fl->'C'->(gi - 1)->(si - 1)) else jsonb_array_length(spec->fl->sec->(gi - 1)->1) end want
    from bp02_node where leaf group by fl, sec, gi, si) x where want is distinct from tasks;
  if bad is not null then raise exception 'BP02 task rows do not match Weekly 63: %', bad; end if;
  select string_agg(format('%s/%s/%s', fl, sec, gi), ' ') into bad from (
    select fl, sec, gi, max(si) subs, jsonb_array_length(spec->fl->'C'->(gi - 1)) want from bp02_node where leaf and sec = 'C' group by fl, sec, gi) x where want <> subs;
  if bad is not null then raise exception 'BP02 MEP subsystems do not match Weekly 63: %', bad; end if;
  select string_agg(format('%s/%s', fl, sec), ' ') into bad from (
    select fl, sec, max(gi) groups, jsonb_array_length(spec->fl->sec) want from bp02_node where leaf group by fl, sec) x where want <> groups;
  if bad is not null then raise exception 'BP02 groups do not match Weekly 63: %', bad; end if;

  -- 3. Leaf weights.
  create temp table bp02_leaf on commit drop as
  with l as (
    select id, parent_id task_id, path, fl, sec, gi, si, ti, data->>'room' room, (spec->fl->>'n')::float8 n from bp02_node where leaf
  ), guest as (
    select l.*, (spec->fl->'A'->(gi - 1)->>0)::float8 d, (spec->fl->'A'->(gi - 1)->1->>(ti - 1))::float8 e from l where sec = 'A'
  ), guest2 as (
    select g.*, sum(e) over (partition by fl, gi, room) s_room,
           (select count(distinct x.room) from guest x where x.fl = g.fl and x.gi = g.gi) rooms,
           (select sum(y.d) from (select distinct x.gi, x.d from guest x where x.fl = g.fl) y) d_sum
    from guest g
  ), corr as (
    select l.*, (spec->fl->'B'->(gi - 1)->>0)::float8 d, (spec->fl->'B'->(gi - 1)->1->>(ti - 1))::float8 e from l where sec = 'B'
  ), corr2 as (
    select c.*, sum(e) over (partition by fl, gi) e_sum,
           (select sum(y.d) from (select distinct x.gi, x.d from corr x where x.fl = c.fl) y) d_sum
    from corr c
  ), mep as (
    select l.*, (spec->fl->'C'->(gi - 1)->(si - 1)->>(ti - 1))::float8 d,
           jsonb_array_length(spec->fl->'C') systems, jsonb_array_length(spec->fl->'C'->(gi - 1)) subs,
           1.0::float8 / count(*) over (partition by task_id, room) share
    from l where sec = 'C'
  ), mep2 as (
    select m.*, (select count(distinct x.room) from mep x where x.task_id = m.task_id) cells from mep m
  )
  select id, task_id, path, fl, sec, gi, si, ti, e / (rooms * s_room) rel, 0.5 * n / n_total * d / d_sum * e / (rooms * s_room) gw,
         e task_w, d / d_sum group_w from guest2
  union all
  select id, task_id, path, fl, sec, gi, si, ti, 1, 0.05 / n_floors * d / d_sum * e / e_sum, e, d / d_sum from corr2
  union all
  select id, task_id, path, fl, sec, gi, si, ti, share, 0.45 * n / n_total / systems / subs * d / cells * share, d, 1 from mep2;

  select string_agg(id, ' ') into bad from bp02_leaf where gw is null or rel is null or gw <= 0;
  if bad is not null then raise exception 'BP02 leaves without a Weekly 63 weight: %', left(bad, 500); end if;

  -- 4. Parents carry the sum of their leaves' global weight and the report's own weight at their level as relative weight
  --    (sections 50/5/45, groups D, corridor tasks E, MEP subsystems and systems equal, MEP tasks D, guestroom tasks the sum
  --    of their room shares, floors their global weight).
  create temp table bp02_weight on commit drop as
  with sums as (
    select a.id, sum(l.gw) gw, sum(l.rel) rel_sum, max(l.task_w) task_w, max(l.group_w) group_w
    from bp02_leaf l, unnest(l.path) a(id) group by a.id
  )
  select n.id,
         case when n.leaf then l.rel
              when n.depth = 0 then s.gw
              when n.depth = 1 then case n.sec when 'A' then 0.5 when 'B' then 0.05 else 0.45 end
              when n.depth = 2 then case when n.sec = 'C' then 1 else s.group_w end
              when n.sec = 'C' and n.depth = 3 then 1
              when n.sec = 'A' then s.rel_sum
              else s.task_w end rel,
         coalesce(l.gw, s.gw) gw
  from bp02_node n left join bp02_leaf l on l.id = n.id left join sums s on s.id = n.id;

  -- 5. New rows: weights, renamed tasks and rooms, room lists.
  create temp table bp02_new on commit drop as
  select n.id,
    case
      when n.depth = 0 and n.fl = '13' then jsonb_set(n.data, '{roomList}', coalesce((select jsonb_agg(r order by o) from jsonb_array_elements_text(n.data->'roomList') with ordinality x(r, o) where r <> 'SK1-1318'), '[]'))
      when n.depth = 0 and n.fl = '21' then jsonb_set(n.data, '{roomList}', coalesce((select jsonb_agg(case when r = 'PS-2119' then 'PS-ST3-2119' else r end order by o) from jsonb_array_elements_text(n.data->'roomList') with ordinality x(r, o) where r <> 'CST3-2120'), '[]'))
      when n.leaf and n.fl = '21' and n.data->>'room' = 'PS-2119' then n.data || jsonb_build_object('room', 'PS-ST3-2119', 'name', 'PS-ST3-2119')
      when not n.leaf and n.data->>'name' = 'Final Ceiling Decoration by Waterproof Paint' then n.data || jsonb_build_object('name', 'Final Ceiling Decoration', 'trade', 'Final Ceiling Decoration')
      when not n.leaf and n.sec = 'B' and n.data->>'name' = 'Install Carpet & Rug Including all Underlay and Accessories' then n.data || jsonb_build_object('name', 'Install Wall to Wall Carpet', 'trade', 'Install Wall to Wall Carpet')
      else n.data end
    || jsonb_build_object('relativeWeight', w.rel::float8, 'globalWeight', w.gw::float8) data
  from bp02_node n join bp02_weight w on w.id = n.id;

  select string_agg(id, ' ') into bad from bp02_new where (data->>'relativeWeight') is null or (data->>'globalWeight') is null;
  if bad is not null then raise exception 'BP02 rows without weights: %', left(bad, 500); end if;

  update public.kw_nbc_activities a
  set data = x.data || jsonb_build_object('updatedAt', stamp), updated_at = stamp
  from bp02_new x
  where a.user_id = owner and a.id = x.id and (a.data - 'updatedAt') is distinct from (x.data - 'updatedAt');

  -- 6. Stored references to removed rows.
  update public.kw_nbc_submissions s
  set data = s.data
        || jsonb_build_object('entries', coalesce((select jsonb_agg(e order by o) from jsonb_array_elements(coalesce(s.data->'entries', '[]')) with ordinality x(e, o)
             where not exists (select 1 from bp02_gone g where g.id = e->>'activityId')), '[]'))
        || case when s.data ? 'appliedEntries' then jsonb_build_object('appliedEntries', coalesce((select jsonb_agg(e order by o) from jsonb_array_elements(s.data->'appliedEntries') with ordinality x(e, o)
             where not exists (select 1 from bp02_gone g where g.id = e->>'activityId')), '[]')) else '{}'::jsonb end,
      updated_at = stamp
  where s.project_id = 'nbc-bp02' and exists (
    select 1 from jsonb_array_elements(coalesce(s.data->'entries', '[]') || coalesce(s.data->'appliedEntries', '[]')) e join bp02_gone g on g.id = e->>'activityId');

  -- 7. Summaries of the two editable weeks, computed as the confirm function does (now with the new weights).
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

  -- 8. Checks: weights total 100%, the editable rule and the hierarchy hold.
  select string_agg(a.id, ' ') into bad from public.kw_nbc_activities a
  where a.user_id = owner and a.project_id = 'nbc-bp02' and (
       (a.data->>'editable' = 'true') = exists (select 1 from public.kw_nbc_activities c where c.user_id = owner and c.parent_id = a.id)
    or (a.parent_id is not null and not exists (select 1 from public.kw_nbc_activities p where p.user_id = owner and p.id = a.parent_id)));
  if bad is not null then raise exception 'BP02 hierarchy broken: %', left(bad, 500); end if;
  select abs(sum((data->>'globalWeight')::float8) - 1) into prev
  from public.kw_nbc_activities where user_id = owner and project_id = 'nbc-bp02' and data->>'editable' = 'true';
  if prev > 1e-9 then raise exception 'BP02 leaf weights total % off 100%%', prev; end if;

  if dry then
    select jsonb_build_object('removed', removed, 'overall', ov,
      'leaves', (select count(*) from bp02_leaf),
      'agg', (select jsonb_object_agg(fl || sec, jsonb_build_array(c, round(r::numeric, 9), round(g::numeric, 12), round(g2::numeric, 9), round(gk::numeric, 9))) from (
          select fl, sec, count(*) c, sum(rel) r, sum(gw) g, sum(gw * gw) * 1e6 g2,
                 sum(gw * case when sec = 'C' then gi * 10000 + si * 100 + ti else gi * 100 + ti end) gk from bp02_leaf group by fl, sec) x),
      'floors', (select jsonb_object_agg(fl, round(v::numeric, 6)) from (
          select fl, sum(sw * sp) v from (
            select l.fl, l.sec, case l.sec when 'A' then 0.5 when 'B' then 0.05 else 0.45 end sw,
                   sum(l.gw * (a.data->>'progress')::float8) / sum(l.gw) sp
            from bp02_leaf l join public.kw_nbc_activities a on a.user_id = owner and a.id = l.id group by 1, 2, 3) x group by fl) y),
      'summaries', (select jsonb_agg(jsonb_build_object('w', data->>'weekStart', 'o', data->'overall', 'p', data->'previous')) from public.kw_nbc_summaries where project_id = 'nbc-bp02'),
      'subs', (select count(*) from public.kw_nbc_submissions where project_id = 'nbc-bp02' and updated_at = stamp),
      'rows_updated', (select count(*) from public.kw_nbc_activities where user_id = owner and project_id = 'nbc-bp02' and updated_at = stamp))
    into report;
    raise exception 'DRYRUN %', report;
  end if;

  -- Flush the deferred parent foreign keys, otherwise ALTER TABLE refuses with pending trigger events.
  set constraints all immediate;
  alter table public.kw_nbc_activities enable trigger nbc_activity_guard;
end
$migration$;
