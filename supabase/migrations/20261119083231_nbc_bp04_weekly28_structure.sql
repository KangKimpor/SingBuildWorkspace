-- BP04 follows the Weekly 28 report (3. & 6. BP-04 - Weekly 28 - 15 Nov - 21 Nov 2026.xlsx). Progress values of the three zones that remain
-- are not changed.
--
-- Structure (from the report, compared with Weekly 27, which the database matched):
--   * The ID-71 zone (L24 Male & Female Toilet) is gone from the ID sheet, the Overall sheet and the zone weights. Its 24 leaves go,
--     and "Install Marble" (Wall Finishes), which applied to ID-71 only, is left as an N/A row (section naTasks, as the report prints it).
--   * ID-70 (L24 Chinese Restaurant) now carries the 39.9 % the two L24 zones had (30 % + 9.9 %); ID-69 and ID-62 keep 24.2999 % / 35.7973 %.
--     The figures divide by the sum of the three weights, as the report's SUMPRODUCT(...)/SUM(...) does.
--   * Submission entries of removed leaves are dropped (as for GR&P and BP02), and the summaries of the two editable weeks are recomputed.
--
-- Weights (the report's formulas):
--   ID   section D, task E, zone weight on every leaf; a task that is N/A in a zone has no leaf there (ID!C9 = 0.4716...).
--   MEP  column C is now SUMPRODUCT(ISNUMBER, zone weights, cells) / SUMPRODUCT(ISNUMBER, zone weights) * task weight, so every MEP leaf
--        carries its zone weight as relativeWeight (it was 1, a plain average). Sub-systems and systems stay equal (MEP!C10 = 0.5495...).
--   globalWeight is the project-wide weighting (P.sum!E7): ID 0.7 * D * E / E(tasks numeric in the zone) * zone / sum(zone); MEP
--        0.3 * zone / sum(zone) / systems numeric in the zone / sub-systems of the system * D. MEP leaves keep the weights they had.
--   The spec holds globalWeight per leaf by position: ID|section|task|zone and MEP|system|sub-system|task|zone.
--   scripts/nbc-bp04-report-extract.py reproduces ID!C9, MEP!C10 and P.sum!E7 from the report to 1e-16 and derives it.
--
-- Forward-only and idempotent; a database without BP04 rows is left alone.

do $migration$
declare
  zones constant text[] := array['ID-69', 'ID-62', 'ID-70'];
  zw constant float8[] := array[0.242998620067025, 0.357972841167608, 0.399];
  spec constant jsonb := '{"ID|1|1|ID-69":0.008505194430094115,"ID|1|1|ID-62":0.012529407014673258,"ID|1|1|ID-70":0.013965398555232622,"ID|2|1|ID-69":0.001701038886018823,"ID|2|1|ID-62":0.0025058814029346515,"ID|2|1|ID-70":0.0027930797110465246,"ID|2|2|ID-69":0.005103116658056469,"ID|2|2|ID-62":0.0075176442088039554,"ID|2|2|ID-70":0.008379239133139572,"ID|2|3|ID-69":0.001701038886018823,"ID|2|3|ID-62":0.0025058814029346515,"ID|2|3|ID-70":0.0027930797110465246,"ID|3|1|ID-69":0.009720222205821843,"ID|3|1|ID-62":0.014319322302483723,"ID|3|1|ID-70":0.015960455491694423,"ID|3|2|ID-69":0.01701038886018823,"ID|3|2|ID-62":0.025058814029346517,"ID|3|2|ID-70":0.027930797110465245,"ID|3|3|ID-69":0.012150277757277306,"ID|3|3|ID-62":0.017899152878104656,"ID|3|3|ID-70":0.01995056936461803,"ID|3|5|ID-69":0.012150277757277306,"ID|3|5|ID-62":0.017899152878104656,"ID|3|5|ID-70":0.01995056936461803,"ID|4|1|ID-69":0.01020623331611294,"ID|4|1|ID-62":0.015035288417607913,"ID|4|1|ID-70":0.01675847826627915,"ID|4|2|ID-69":0.015309349974169408,"ID|4|2|ID-62":0.022552932626411865,"ID|4|2|ID-70":0.025137717399418724,"ID|4|3|ID-69":0.015309349974169408,"ID|4|3|ID-62":0.022552932626411865,"ID|4|3|ID-70":0.025137717399418724,"ID|4|4|ID-69":0.01020623331611294,"ID|4|4|ID-62":0.015035288417607913,"ID|4|4|ID-70":0.01675847826627915,"ID|5|1|ID-69":0.00893045415159882,"ID|5|1|ID-62":0.01315587736540692,"ID|5|1|ID-70":0.014663668482994253,"ID|5|2|ID-69":0.00510311665805647,"ID|5|2|ID-62":0.007517644208803956,"ID|5|2|ID-70":0.008379239133139574,"ID|5|3|ID-69":0.006378895822570586,"ID|5|3|ID-62":0.009397055261004945,"ID|5|3|ID-70":0.010474048916424467,"ID|5|4|ID-69":0.00510311665805647,"ID|5|4|ID-62":0.007517644208803956,"ID|5|4|ID-70":0.008379239133139574,"ID|6|1|ID-69":0.0010631493037617644,"ID|6|1|ID-62":0.0015661758768341573,"ID|6|1|ID-70":0.0017456748194040778,"ID|6|2|ID-69":0.0010631493037617644,"ID|6|2|ID-62":0.0015661758768341573,"ID|6|2|ID-70":0.0017456748194040778,"ID|6|3|ID-69":0.0010631493037617644,"ID|6|3|ID-62":0.0015661758768341573,"ID|6|3|ID-70":0.0017456748194040778,"ID|6|4|ID-69":0.0010631493037617644,"ID|6|4|ID-62":0.0015661758768341573,"ID|6|4|ID-70":0.0017456748194040778,"ID|7|1|ID-69":0.008505194430094115,"ID|7|1|ID-62":0.012529407014673258,"ID|7|1|ID-70":0.013965398555232622,"ID|8|1|ID-69":0.004252597215047058,"ID|8|1|ID-62":0.006264703507336629,"ID|8|1|ID-70":0.006982699277616311,"ID|9|1|ID-69":0.004252597215047058,"ID|9|1|ID-62":0.006264703507336629,"ID|9|1|ID-70":0.006982699277616311,"ID|10|1|ID-69":0.004252597215047058,"ID|10|1|ID-62":0.006264703507336629,"ID|10|1|ID-70":0.006982699277616311,"MEP|1|1|1|ID-69":0.0019440444411643696,"MEP|1|1|1|ID-62":0.0035798305756209316,"MEP|1|1|1|ID-70":0.0039901138729236075,"MEP|1|1|2|ID-69":0.0019440444411643696,"MEP|1|1|2|ID-62":0.0035798305756209316,"MEP|1|1|2|ID-70":0.0039901138729236075,"MEP|1|1|3|ID-69":0.0004860111102910924,"MEP|1|1|3|ID-62":0.0008949576439052329,"MEP|1|1|3|ID-70":0.0009975284682309019,"MEP|1|1|4|ID-69":0.0002430055551455462,"MEP|1|1|4|ID-62":0.00044747882195261644,"MEP|1|1|4|ID-70":0.0004987642341154509,"MEP|1|1|5|ID-69":0.0002430055551455462,"MEP|1|1|5|ID-62":0.00044747882195261644,"MEP|1|1|5|ID-70":0.0004987642341154509,"MEP|1|2|1|ID-69":0.0019440444411643696,"MEP|1|2|1|ID-62":0.0035798305756209316,"MEP|1|2|1|ID-70":0.0039901138729236075,"MEP|1|2|2|ID-69":0.0019440444411643696,"MEP|1|2|2|ID-62":0.0035798305756209316,"MEP|1|2|2|ID-70":0.0039901138729236075,"MEP|1|2|3|ID-69":0.0004860111102910924,"MEP|1|2|3|ID-62":0.0008949576439052329,"MEP|1|2|3|ID-70":0.0009975284682309019,"MEP|1|2|4|ID-69":0.0002430055551455462,"MEP|1|2|4|ID-62":0.00044747882195261644,"MEP|1|2|4|ID-70":0.0004987642341154509,"MEP|1|2|5|ID-69":0.0002430055551455462,"MEP|1|2|5|ID-62":0.00044747882195261644,"MEP|1|2|5|ID-70":0.0004987642341154509,"MEP|1|3|1|ID-69":0.002187049996309916,"MEP|1|3|1|ID-62":0.004027309397573548,"MEP|1|3|1|ID-70":0.004488878107039058,"MEP|1|3|2|ID-69":0.002187049996309916,"MEP|1|3|2|ID-62":0.004027309397573548,"MEP|1|3|2|ID-70":0.004488878107039058,"MEP|1|3|3|ID-69":0.0002430055551455462,"MEP|1|3|3|ID-62":0.00044747882195261644,"MEP|1|3|3|ID-70":0.0004987642341154509,"MEP|1|3|4|ID-69":0.0002430055551455462,"MEP|1|3|4|ID-62":0.00044747882195261644,"MEP|1|3|4|ID-70":0.0004987642341154509,"MEP|2|1|1|ID-69":0.0011664266646986218,"MEP|2|1|1|ID-62":0.0021478983453725588,"MEP|2|1|1|ID-70":0.002394068323754164,"MEP|2|1|2|ID-69":0.0011664266646986218,"MEP|2|1|2|ID-62":0.0021478983453725588,"MEP|2|1|2|ID-70":0.002394068323754164,"MEP|2|1|3|ID-69":0.00029160666617465545,"MEP|2|1|3|ID-62":0.0005369745863431397,"MEP|2|1|3|ID-70":0.000598517080938541,"MEP|2|1|4|ID-69":0.00014580333308732773,"MEP|2|1|4|ID-62":0.00026848729317156984,"MEP|2|1|4|ID-70":0.0002992585404692705,"MEP|2|1|5|ID-69":0.00014580333308732773,"MEP|2|1|5|ID-62":0.00026848729317156984,"MEP|2|1|5|ID-70":0.0002992585404692705,"MEP|2|2|1|ID-69":0.0011664266646986218,"MEP|2|2|2|ID-69":0.0011664266646986218,"MEP|2|2|3|ID-69":0.00029160666617465545,"MEP|2|2|4|ID-69":0.00014580333308732773,"MEP|2|2|5|ID-69":0.00014580333308732773,"MEP|2|3|1|ID-69":0.0011664266646986218,"MEP|2|3|2|ID-69":0.0011664266646986218,"MEP|2|3|3|ID-69":0.00029160666617465545,"MEP|2|3|4|ID-69":0.00014580333308732773,"MEP|2|3|5|ID-69":0.00014580333308732773,"MEP|2|4|1|ID-62":0.0021478983453725588,"MEP|2|4|1|ID-70":0.002394068323754164,"MEP|2|4|2|ID-62":0.0021478983453725588,"MEP|2|4|2|ID-70":0.002394068323754164,"MEP|2|4|3|ID-62":0.0005369745863431397,"MEP|2|4|3|ID-70":0.000598517080938541,"MEP|2|4|4|ID-62":0.00026848729317156984,"MEP|2|4|4|ID-70":0.0002992585404692705,"MEP|2|4|5|ID-62":0.00026848729317156984,"MEP|2|4|5|ID-70":0.0002992585404692705,"MEP|2|5|1|ID-69":0.0011664266646986218,"MEP|2|5|1|ID-62":0.0021478983453725588,"MEP|2|5|1|ID-70":0.002394068323754164,"MEP|2|5|2|ID-69":0.0011664266646986218,"MEP|2|5|2|ID-62":0.0021478983453725588,"MEP|2|5|2|ID-70":0.002394068323754164,"MEP|2|5|3|ID-69":0.00029160666617465545,"MEP|2|5|3|ID-62":0.0005369745863431397,"MEP|2|5|3|ID-70":0.000598517080938541,"MEP|2|5|4|ID-69":0.00014580333308732773,"MEP|2|5|4|ID-62":0.00026848729317156984,"MEP|2|5|4|ID-70":0.0002992585404692705,"MEP|2|5|5|ID-69":0.00014580333308732773,"MEP|2|5|5|ID-62":0.00026848729317156984,"MEP|2|5|5|ID-70":0.0002992585404692705,"MEP|2|6|1|ID-69":0.0011664266646986218,"MEP|2|6|1|ID-62":0.0021478983453725588,"MEP|2|6|1|ID-70":0.002394068323754164,"MEP|2|6|2|ID-69":0.0011664266646986218,"MEP|2|6|2|ID-62":0.0021478983453725588,"MEP|2|6|2|ID-70":0.002394068323754164,"MEP|2|6|3|ID-69":0.00029160666617465545,"MEP|2|6|3|ID-62":0.0005369745863431397,"MEP|2|6|3|ID-70":0.000598517080938541,"MEP|2|6|4|ID-69":0.00014580333308732773,"MEP|2|6|4|ID-62":0.00026848729317156984,"MEP|2|6|4|ID-70":0.0002992585404692705,"MEP|2|6|5|ID-69":0.00014580333308732773,"MEP|2|6|5|ID-62":0.00026848729317156984,"MEP|2|6|5|ID-70":0.0002992585404692705,"MEP|2|7|1|ID-62":0.0021478983453725588,"MEP|2|7|1|ID-70":0.002394068323754164,"MEP|2|7|2|ID-62":0.0021478983453725588,"MEP|2|7|2|ID-70":0.002394068323754164,"MEP|2|7|3|ID-62":0.0005369745863431397,"MEP|2|7|3|ID-70":0.000598517080938541,"MEP|2|7|4|ID-62":0.00026848729317156984,"MEP|2|7|4|ID-70":0.0002992585404692705,"MEP|2|7|5|ID-62":0.00026848729317156984,"MEP|2|7|5|ID-70":0.0002992585404692705,"MEP|3|1|1|ID-69":0.005832133323493109,"MEP|3|1|1|ID-62":0.010739491726862794,"MEP|3|1|1|ID-70":0.011970341618770822,"MEP|3|1|2|ID-69":0.005832133323493109,"MEP|3|1|2|ID-62":0.010739491726862794,"MEP|3|1|2|ID-70":0.011970341618770822,"MEP|3|1|3|ID-69":0.0014580333308732772,"MEP|3|1|3|ID-62":0.0026848729317156986,"MEP|3|1|3|ID-70":0.0029925854046927054,"MEP|3|1|4|ID-69":0.0007290166654366386,"MEP|3|1|4|ID-62":0.0013424364658578493,"MEP|3|1|4|ID-70":0.0014962927023463527,"MEP|3|1|5|ID-69":0.0007290166654366386,"MEP|3|1|5|ID-62":0.0013424364658578493,"MEP|3|1|5|ID-70":0.0014962927023463527,"MEP|4|1|1|ID-69":0.004374099992619832,"MEP|4|1|1|ID-62":0.008054618795147095,"MEP|4|1|1|ID-70":0.008977756214078116,"MEP|4|1|2|ID-69":0.0002430055551455462,"MEP|4|1|2|ID-62":0.00044747882195261644,"MEP|4|1|2|ID-70":0.0004987642341154509,"MEP|4|1|3|ID-69":0.0002430055551455462,"MEP|4|1|3|ID-62":0.00044747882195261644,"MEP|4|1|3|ID-70":0.0004987642341154509,"MEP|4|2|1|ID-69":0.0009720222205821848,"MEP|4|2|1|ID-62":0.0017899152878104658,"MEP|4|2|1|ID-70":0.0019950569364618038,"MEP|4|2|2|ID-69":0.003402077772037647,"MEP|4|2|2|ID-62":0.006264703507336629,"MEP|4|2|2|ID-70":0.006982699277616312,"MEP|4|2|3|ID-69":0.0002430055551455462,"MEP|4|2|3|ID-62":0.00044747882195261644,"MEP|4|2|3|ID-70":0.0004987642341154509,"MEP|4|2|4|ID-69":0.0002430055551455462,"MEP|4|2|4|ID-62":0.00044747882195261644,"MEP|4|2|4|ID-70":0.0004987642341154509,"MEP|4|3|1|ID-69":0.004374099992619832,"MEP|4|3|1|ID-62":0.008054618795147095,"MEP|4|3|1|ID-70":0.008977756214078116,"MEP|4|3|2|ID-69":0.0002430055551455462,"MEP|4|3|2|ID-62":0.00044747882195261644,"MEP|4|3|2|ID-70":0.0004987642341154509,"MEP|4|3|3|ID-69":0.0002430055551455462,"MEP|4|3|3|ID-62":0.00044747882195261644,"MEP|4|3|3|ID-70":0.0004987642341154509,"MEP|5|1|1|ID-69":0.0029160666617465544,"MEP|5|1|2|ID-69":0.0029160666617465544,"MEP|5|1|3|ID-69":0.0007290166654366386,"MEP|5|1|4|ID-69":0.0003645083327183193,"MEP|5|1|5|ID-69":0.0003645083327183193,"MEP|5|2|1|ID-69":0.005832133323493109,"MEP|5|2|2|ID-69":0.0007290166654366386,"MEP|5|2|3|ID-69":0.0003645083327183193,"MEP|5|2|4|ID-69":0.0003645083327183193}';
  dry constant boolean := false;
  stamp timestamptz := clock_timestamp();
  owner uuid;
  removed int; bad text; report jsonb;
  w date; ov float8; prev float8; contrib jsonb; expected int;
begin
  select user_id into owner from public.kw_nbc_activities where project_id = 'nbc-bp04' and parent_id is null limit 1;
  if owner is null then return; end if;

  alter table public.kw_nbc_activities disable trigger nbc_activity_guard;

  -- 1. Rows the report no longer has: the ID-71 leaves and the tasks left without a leaf.
  create temp table bp04_gone on commit drop as
  select l.id, l.parent_id from public.kw_nbc_activities l
  where l.user_id = owner and l.project_id = 'nbc-bp04' and l.data->>'area' = 'ID' and l.data->>'editable' = 'true' and l.data->>'room' = 'ID-71';

  -- Tasks that applied to ID-71 only stay on the sheet as N/A rows: remember their name, weight and position in the section.
  create temp table bp04_na on commit drop as
  with ordered as (
    select t.id, t.parent_id, t.data->>'name' name, (t.data->>'relativeWeight')::float8 weight,
           row_number() over (partition by t.parent_id order by (t.data->>'order')::numeric, t.id)::int - 1 as pos
    from public.kw_nbc_activities t join public.kw_nbc_activities s on s.id = t.parent_id and s.user_id = owner
    where t.user_id = owner and t.project_id = 'nbc-bp04' and s.parent_id = 'nbc-bp04:1'
  )
  select o.* from ordered o
  where exists (select 1 from public.kw_nbc_activities c where c.user_id = owner and c.parent_id = o.id and c.id in (select id from bp04_gone))
    and not exists (select 1 from public.kw_nbc_activities c where c.user_id = owner and c.parent_id = o.id and c.id not in (select id from bp04_gone));

  insert into bp04_gone select id, parent_id from bp04_na;
  delete from public.kw_nbc_activities a using bp04_gone g where a.user_id = owner and a.id = g.id;
  get diagnostics removed = row_count;

  -- 2. Leaf weights from the spec; every remaining leaf must have one, and every spec entry a leaf.
  create temp table bp04_leaf on commit drop as
  select l.id, l.data->>'area' area, l.data->>'room' room,
         (case when l.data->>'area' = 'ID' then 'ID|' else 'MEP|' end) || replace(substr(t.wbs, 3), '.', '|') || '|' || (l.data->>'room') as key,
         array_position(zones, l.data->>'room') zi
  from public.kw_nbc_activities l join public.kw_nbc_activities t on t.id = l.parent_id and t.user_id = owner
  where l.user_id = owner and l.project_id = 'nbc-bp04' and l.data->>'editable' = 'true';

  select string_agg(id || '=' || key, ' ') into bad from bp04_leaf where zi is null or not spec ? key;
  if bad is not null then raise exception 'BP04 leaves without a Weekly 28 weight: %', left(bad, 500); end if;
  select count(*) into expected from jsonb_object_keys(spec);
  if (select count(*) from bp04_leaf) <> expected then raise exception 'BP04 has % leaves, Weekly 28 has %', (select count(*) from bp04_leaf), expected; end if;

  -- The leaves of the zones that stay (ID-69, ID-62) and every MEP leaf keep the global weight the database had, to the digits it stores.
  select string_agg(l.id, ' ') into bad from bp04_leaf l join public.kw_nbc_activities a on a.user_id = owner and a.id = l.id
  where (l.area = 'MEP' or l.room <> 'ID-70') and abs((a.data->>'globalWeight')::float8 - (spec->>l.key)::float8) > 1e-9;
  if bad is not null then raise exception 'BP04 leaf weights differ from Weekly 28 outside ID-70: %', left(bad, 500); end if;

  create temp table bp04_weight on commit drop as
  with recursive up as (
    select l.id leaf, a.parent_id pid from bp04_leaf l join public.kw_nbc_activities a on a.user_id = owner and a.id = l.id
    union all
    select up.leaf, a.parent_id from up join public.kw_nbc_activities a on a.user_id = owner and a.id = up.pid where a.parent_id is not null
  ), sums as (
    select up.pid id, sum((spec->>l.key)::float8) gw from up join bp04_leaf l on l.id = up.leaf where up.pid is not null group by up.pid
  )
  select l.id, zw[l.zi] rel, (spec->>l.key)::float8 gw from bp04_leaf l
  union all select id, null::float8, gw from sums;

  -- 3. Rows: weights, the ID root's zones, the N/A task rows.
  update public.kw_nbc_activities a
  set data = (case
        when a.id = 'nbc-bp04:1' then a.data || jsonb_build_object('zone', to_jsonb(zw), 'roomList', to_jsonb(zones),
              'roomLabels', (select jsonb_agg(l order by o) from jsonb_array_elements_text(a.data->'roomLabels') with ordinality x(l, o) where o <= 3),
              'links', (select jsonb_object_agg(z, jsonb_build_array(z)) from unnest(zones) z))
        else a.data end)
      || jsonb_build_object('globalWeight', x.gw) || case when x.rel is not null then jsonb_build_object('relativeWeight', x.rel) else '{}'::jsonb end
      || jsonb_build_object('updatedAt', stamp),
      updated_at = stamp
  from bp04_weight x
  where a.user_id = owner and a.id = x.id;

  update public.kw_nbc_activities s
  set data = s.data || jsonb_build_object('updatedAt', stamp, 'naTasks', coalesce(s.data->'naTasks', '[]'::jsonb) || (
        select jsonb_agg(jsonb_build_object('name', n.name, 'weight', n.weight, 'at', n.pos) order by n.pos)
        from bp04_na n where n.parent_id = s.id and not coalesce(s.data->'naTasks', '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('name', n.name)))),
      updated_at = stamp
  where s.user_id = owner and s.id in (select parent_id from bp04_na) and exists (
    select 1 from bp04_na n where n.parent_id = s.id and not coalesce(s.data->'naTasks', '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('name', n.name)));

  -- 4. Stored references to removed rows.
  update public.kw_nbc_submissions s
  set data = s.data
        || jsonb_build_object('entries', coalesce((select jsonb_agg(e order by o) from jsonb_array_elements(coalesce(s.data->'entries', '[]')) with ordinality x(e, o)
             where not exists (select 1 from bp04_gone g where g.id = e->>'activityId')), '[]'))
        || case when s.data ? 'appliedEntries' then jsonb_build_object('appliedEntries', coalesce((select jsonb_agg(e order by o) from jsonb_array_elements(s.data->'appliedEntries') with ordinality x(e, o)
             where not exists (select 1 from bp04_gone g where g.id = e->>'activityId')), '[]')) else '{}'::jsonb end,
      updated_at = stamp
  where s.project_id = 'nbc-bp04' and exists (
    select 1 from jsonb_array_elements(coalesce(s.data->'entries', '[]') || coalesce(s.data->'appliedEntries', '[]')) e join bp04_gone g on g.id = e->>'activityId');

  -- 5. Summaries of the two editable weeks, computed as the confirm function does (now with the new weights).
  for w in select (data->>'weekStart')::date from public.kw_nbc_summaries where project_id = 'nbc-bp04'
             and (data->>'weekStart')::date >= (select max((data->>'weekStart')::date) - 7 from public.kw_nbc_summaries where project_id = 'nbc-bp04') loop
    with sbx as materialized (
      select week_start, id, data->>'confirmedAt' confirmed_at, kw_private.nbc_applied(data) applied
      from public.kw_nbc_submissions where project_id = 'nbc-bp04' and week_start >= w::text
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
      where a.user_id = owner and a.project_id = 'nbc-bp04' and a.data->>'editable' = 'true'
    )
    select (select sum(gw * v) from vals), (select sum(gw * vb) from vals),
           (select jsonb_object_agg(owner_key, c) from (select owner_key, sum(gw * v) c from vals group by owner_key) cc)
    into ov, prev, contrib;
    update public.kw_nbc_summaries
    set data = data || jsonb_build_object('overall', ov, 'previous', prev, 'contributions', contrib, 'updatedAt', stamp), updated_at = stamp
    where project_id = 'nbc-bp04' and data->>'weekStart' = w::text;
  end loop;

  select sum((data->>'globalWeight')::float8 * (data->>'progress')::float8) into ov
  from public.kw_nbc_activities where user_id = owner and project_id = 'nbc-bp04' and data->>'editable' = 'true';
  update public.kw_projects set data = jsonb_set(data, '{progress}', to_jsonb(ov)), updated_at = stamp where id = 'nbc-bp04';

  -- 6. Checks: weights total 100 %, the editable rule and the hierarchy hold.
  select string_agg(a.id, ' ') into bad from public.kw_nbc_activities a
  where a.user_id = owner and a.project_id = 'nbc-bp04' and (
       (a.data->>'editable' = 'true') = exists (select 1 from public.kw_nbc_activities c where c.user_id = owner and c.parent_id = a.id)
    or (a.parent_id is not null and not exists (select 1 from public.kw_nbc_activities p where p.user_id = owner and p.id = a.parent_id)));
  if bad is not null then raise exception 'BP04 hierarchy broken: %', left(bad, 500); end if;
  select abs(sum((data->>'globalWeight')::float8) - 1) into prev
  from public.kw_nbc_activities where user_id = owner and project_id = 'nbc-bp04' and data->>'editable' = 'true';
  if prev > 1e-9 then raise exception 'BP04 leaf weights total % off 100%%', prev; end if;

  if dry then
    select jsonb_build_object('removed', removed, 'overall', ov,
      'leaves', (select count(*) from bp04_leaf),
      'na', (select jsonb_agg(jsonb_build_object('name', name, 'at', pos, 'w', weight)) from bp04_na),
      'summaries', (select jsonb_agg(jsonb_build_object('w', data->>'weekStart', 'o', data->'overall', 'p', data->'previous')) from public.kw_nbc_summaries where project_id = 'nbc-bp04'),
      'subs', (select count(*) from public.kw_nbc_submissions where project_id = 'nbc-bp04' and updated_at = stamp),
      'rows_updated', (select count(*) from public.kw_nbc_activities where user_id = owner and project_id = 'nbc-bp04' and updated_at = stamp))
    into report;
    raise exception 'DRYRUN %', report;
  end if;

  -- Flush the deferred parent foreign keys, otherwise ALTER TABLE refuses with pending trigger events.
  set constraints all immediate;
  alter table public.kw_nbc_activities enable trigger nbc_activity_guard;
end
$migration$;
