-- Material tracker (D-80): activity is kept for two weeks, and each material's notes stay until newer ones replace them.
--
-- 1. Activity older than 14 days is deleted. Each new log row prunes its own package (the index on (package, at) makes
--    this a short range delete), so no scheduled job is needed; this migration also clears what is already past it.
--    mat_load returns the last 14 days instead of 21.
-- 2. Notes: mat_load used to return remarks of the last three calendar weeks only, so a material with no note this week
--    or last showed nothing. It now returns, per material and team, the three latest weeks that have a note (any age), plus
--    this week's row even when empty (so clearing a note reaches other clients).
--
-- Forward-only and idempotent. Function signatures are unchanged.

create or replace function kw_private.mat_log_write(p_id text, p_kind text, p_detail jsonb, p_before jsonb)
  returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_row kw_private.mat_log;
begin
  insert into kw_private.mat_log (item_id, package, actor, kind, detail, before)
    select p_id, i.package, auth.uid(), p_kind, coalesce(p_detail, '{}'::jsonb), p_before
    from public.kw_mat_items i where i.id = p_id
    returning * into v_row;
  -- Two-week retention (D-80).
  delete from kw_private.mat_log where package = v_row.package and at < now() - interval '14 days';
  return jsonb_build_object(
    'id', v_row.id, 'item_id', v_row.item_id, 'at', v_row.at, 'by', v_row.actor,
    'by_name', kw_private.mat_person_name(v_row.actor), 'kind', v_row.kind, 'detail', v_row.detail, 'before', v_row.before
  );
end $$;
revoke all on function kw_private.mat_log_write(text, text, jsonb, jsonb) from public, anon, authenticated;

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
  -- This week's rows, and the three latest weeks with a note for each material and team (D-80).
  select coalesce(jsonb_agg(jsonb_build_object(
      'item_id', r.item_id, 'team', r.team, 'week_start', r.week_start, 'body', r.body,
      'updated_at', r.updated_at, 'updated_by', r.updated_by
    )), '[]'::jsonb)
    into v_remarks
    from (
      select r.item_id, r.team, r.week_start, r.body, r.updated_at, r.updated_by
        from public.kw_mat_remarks r
        join public.kw_mat_items i on i.id = r.item_id
        where i.package = p_package and not i.hidden and r.week_start = v_week
      union
      select x.item_id, x.team, x.week_start, x.body, x.updated_at, x.updated_by
        from (
          select r.*, row_number() over (partition by r.item_id, r.team order by r.week_start desc) as n
            from public.kw_mat_remarks r
            join public.kw_mat_items i on i.id = r.item_id
            where i.package = p_package and not i.hidden and r.body <> ''
        ) x
        where x.n <= 3
    ) r
    where p_remarks_since is null or r.updated_at > p_remarks_since;
  -- The last two weeks of activity (D-80), newest first, capped so a busy package stays small.
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', l.id, 'item_id', l.item_id, 'at', l.at, 'by', l.actor, 'kind', l.kind, 'detail', l.detail, 'before', l.before
    ) order by l.at desc), '[]'::jsonb)
    into v_log
    from (
      select l.* from kw_private.mat_log l
      join public.kw_mat_items i on i.id = l.item_id and not i.hidden
      where l.package = p_package
        and l.at > now() - interval '14 days'
        and (p_items_since is null or l.at > p_items_since)
      order by l.at desc
      limit 400
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

delete from kw_private.mat_log where at < now() - interval '14 days';
