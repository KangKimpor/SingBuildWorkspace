-- Material tracker: mark the exact cells changed this week, and drop the mark when a change is undone.
--
-- kw_mat_items.week_edits keeps `edits` as they stood when the item was first edited in the
-- reporting week named by changed_week. The client compares each field's value now with its
-- value from week_edits, so a cell typed back to its old value is no longer marked, and only
-- the cells that differ are outlined instead of the whole row.
--
-- In-app editing began in the week of 15 November 2026, so rows already changed this week
-- start from an empty baseline: every edit they hold was made this week.

alter table public.kw_mat_items
  add column if not exists week_edits jsonb;

update public.kw_mat_items
  set week_edits = '{}'::jsonb
  where changed_week = kw_private.mat_week() and week_edits is null;

create or replace function kw_private.mat_load(p_package text, p_items_since timestamptz, p_remarks_since timestamptz)
  returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_week date;
  v_items jsonb;
  v_remarks jsonb;
begin
  if not public.kw_mat_access() then raise exception 'Not found' using errcode='42501'; end if;
  v_week := kw_private.mat_week();
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', i.id, 'sheet', i.sheet, 'pos', i.pos, 'kind', i.kind,
      'data', i.data, 'edits', i.edits, 'changed_week', i.changed_week, 'week_edits', i.week_edits,
      'updated_at', i.updated_at
    ) order by i.sheet, i.pos), '[]'::jsonb)
    into v_items
    from public.kw_mat_items i
    where i.package = p_package
      and not i.hidden
      and (p_items_since is null or i.updated_at > p_items_since);
  select coalesce(jsonb_agg(jsonb_build_object(
      'item_id', r.item_id, 'team', r.team, 'week_start', r.week_start, 'body', r.body
    )), '[]'::jsonb)
    into v_remarks
    from public.kw_mat_remarks r
    join public.kw_mat_items i on i.id = r.item_id
    where i.package = p_package
      and not i.hidden
      and r.week_start in (v_week, v_week - 7, v_week - 14)
      and (p_remarks_since is null or r.updated_at > p_remarks_since);
  return jsonb_build_object('week', v_week, 'now', now(), 'items', v_items, 'remarks', v_remarks);
end $$;

-- Each setter below snapshots `edits` into week_edits on the first edit of a new week. SET
-- expressions read the row as it was before the update, so the snapshot is the old edits.
create or replace function kw_private.mat_set_remark(p_id text, p_team text, p_body text)
  returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_week date;
  v_body text := coalesce(btrim(p_body), '');
  v_at timestamptz;
begin
  if not public.kw_mat_access() then raise exception 'Not found' using errcode='42501'; end if;
  if p_team is null or p_team not in ('pm','purchase') then raise exception 'Invalid team' using errcode='22023'; end if;
  if length(v_body) > 2000 then raise exception 'Remark is too long' using errcode='22023'; end if;
  if not exists (select 1 from public.kw_mat_items where id = p_id and kind = 'item' and not hidden) then
    raise exception 'Item not found' using errcode='P0002';
  end if;
  v_week := kw_private.mat_week();
  insert into public.kw_mat_remarks as r (item_id, team, week_start, body, updated_at, updated_by)
    values (p_id, p_team, v_week, v_body, now(), auth.uid())
    on conflict (item_id, team, week_start)
    do update set body = excluded.body, updated_at = excluded.updated_at, updated_by = excluded.updated_by
    returning r.updated_at into v_at;
  update public.kw_mat_items
    set week_edits = case when changed_week is distinct from v_week then edits else week_edits end,
        changed_week = v_week, updated_at = now(), updated_by = auth.uid()
    where id = p_id;
  return jsonb_build_object('week', v_week, 'updated_at', v_at);
end $$;

create or replace function kw_private.mat_set_cell(p_id text, p_cell text, p_value jsonb)
  returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_week date := kw_private.mat_week();
  v_at timestamptz;
begin
  if not public.kw_mat_access() then raise exception 'Not found' using errcode='42501'; end if;
  if not kw_private.mat_valid_field(p_cell, p_value) then
    raise exception 'Invalid cell or value' using errcode='22023';
  end if;
  update public.kw_mat_items
    set edits = case when p_value is null or jsonb_typeof(p_value) = 'null' then edits - p_cell
                     else edits || jsonb_build_object(p_cell, p_value) end,
        week_edits = case when changed_week is distinct from v_week then edits else week_edits end,
        changed_week = v_week,
        updated_at = now(),
        updated_by = auth.uid()
    where id = p_id and kind = 'item' and not hidden
    returning updated_at into v_at;
  if not found then raise exception 'Item not found' using errcode='P0002'; end if;
  return jsonb_build_object('updated_at', v_at);
end $$;

create or replace function kw_private.mat_set_fields(p_id text, p_patch jsonb)
  returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_week date := kw_private.mat_week();
  v_key text;
  v_val jsonb;
  v_del text[] := array[]::text[];
  v_set jsonb := '{}'::jsonb;
  v_at timestamptz;
begin
  if not public.kw_mat_access() then raise exception 'Not found' using errcode='42501'; end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'Invalid patch' using errcode='22023';
  end if;
  for v_key, v_val in select key, value from jsonb_each(p_patch) loop
    if not kw_private.mat_valid_field(v_key, v_val) then
      raise exception 'Invalid field or value' using errcode='22023';
    end if;
    if v_val is null or jsonb_typeof(v_val) = 'null' then
      v_del := array_append(v_del, v_key);
    else
      v_set := v_set || jsonb_build_object(v_key, v_val);
    end if;
  end loop;
  update public.kw_mat_items
    set edits = (edits - v_del) || v_set,
        week_edits = case when changed_week is distinct from v_week then edits else week_edits end,
        changed_week = v_week,
        updated_at = now(),
        updated_by = auth.uid()
    where id = p_id and kind = 'item' and not hidden
    returning updated_at into v_at;
  if not found then raise exception 'Item not found' using errcode='P0002'; end if;
  return jsonb_build_object('updated_at', v_at);
end $$;
