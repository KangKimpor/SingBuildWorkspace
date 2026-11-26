-- Material tracker: load only the two material sheets (D-67).
--
-- The workbooks' note sheets (BP03 Change Log, BP04 Review) are kept in kw_mat_items since D-38 but have not been shown since
-- the tabs were dropped. They were still part of every full load: 216 and 192 rows, about 16% of a package's payload. mat_load
-- now returns the ID Material and MEP Material rows only; the note rows stay in the table. The client's IndexedDB cache
-- version moves to 6 with this change, so cached packages reload without them.
--
-- Forward-only and idempotent; only the item filter changes.

create or replace function kw_private.mat_load(p_package text, p_items_since timestamptz, p_remarks_since timestamptz)
  returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_week date;
  v_items jsonb;
  v_remarks jsonb;
  v_log jsonb;
  v_people jsonb;
begin
  if not public.kw_mat_access() then raise exception 'Not found' using errcode='42501'; end if;
  v_week := kw_private.mat_week();
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', i.id, 'sheet', i.sheet, 'pos', i.pos, 'kind', i.kind,
      'data', i.data, 'edits', i.edits, 'changed_week', i.changed_week, 'week_edits', i.week_edits,
      'updated_at', i.updated_at, 'updated_by', i.updated_by
    ) order by i.sheet, i.pos), '[]'::jsonb)
    into v_items
    from public.kw_mat_items i
    where i.package = p_package
      and i.sheet in ('id', 'mep')
      and not i.hidden
      and (p_items_since is null or i.updated_at > p_items_since);
  select coalesce(jsonb_agg(jsonb_build_object(
      'item_id', r.item_id, 'team', r.team, 'week_start', r.week_start, 'body', r.body,
      'updated_at', r.updated_at, 'updated_by', r.updated_by
    )), '[]'::jsonb)
    into v_remarks
    from public.kw_mat_remarks r
    join public.kw_mat_items i on i.id = r.item_id
    where i.package = p_package
      and not i.hidden
      and r.week_start in (v_week, v_week - 7, v_week - 14)
      and (p_remarks_since is null or r.updated_at > p_remarks_since);
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', l.id, 'item_id', l.item_id, 'at', l.at, 'by', l.actor, 'kind', l.kind, 'detail', l.detail, 'before', l.before
    ) order by l.at desc), '[]'::jsonb)
    into v_log
    from (
      select l.* from kw_private.mat_log l
      join public.kw_mat_items i on i.id = l.item_id and not i.hidden
      where l.package = p_package
        and l.at > now() - interval '21 days'
        and (p_items_since is null or l.at > p_items_since)
      order by l.at desc
      limit 300
    ) l;
  select coalesce(jsonb_object_agg(p.id::text, kw_private.mat_person_name(p.id)), '{}'::jsonb)
    into v_people
    from (
      select distinct (x->>'updated_by')::uuid as id from jsonb_array_elements(v_items) x where x->>'updated_by' is not null
      union
      select distinct (x->>'updated_by')::uuid from jsonb_array_elements(v_remarks) x where x->>'updated_by' is not null
      union
      select distinct (x->>'by')::uuid from jsonb_array_elements(v_log) x where x->>'by' is not null
    ) p
    where p.id is not null;
  return jsonb_build_object('week', v_week, 'now', now(), 'items', v_items, 'remarks', v_remarks, 'log', v_log, 'people', v_people);
end $$;
