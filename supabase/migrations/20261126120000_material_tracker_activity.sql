-- Material tracker: who changed what (D-58).
--
-- Rows and remarks already store `updated_by` (auth.uid()) on every write; nothing returned it.
-- This adds an append-only activity log, written by the three checked setters, and has mat_load
-- return the editor of each row and remark, the last three weeks of activity for the package, and
-- the display names of the people involved. Function signatures are unchanged.
--
-- Forward-only and idempotent. The log lives in kw_private (not exposed by PostgREST) and is read
-- only through mat_load, so it carries the same access check as everything else in the tracker.

create table if not exists kw_private.mat_log (
  id bigint generated always as identity primary key,
  item_id text not null references public.kw_mat_items (id) on delete cascade,
  package text not null,
  at timestamptz not null default now(),
  actor uuid,
  kind text not null check (kind in ('fields', 'remark')),
  detail jsonb not null default '{}'::jsonb
);
create index if not exists mat_log_package_at_idx on kw_private.mat_log (package, at desc);
create index if not exists mat_log_item_idx on kw_private.mat_log (item_id);
alter table kw_private.mat_log enable row level security;
revoke all on table kw_private.mat_log from public, anon, authenticated;

-- A person's display name: the Google profile name, else the part of the email before '@'.
create or replace function kw_private.mat_person_name(p_id uuid)
  returns text language sql stable security definer set search_path='' as $$
  select coalesce(
    nullif(btrim(u.raw_user_meta_data->>'full_name'), ''),
    nullif(btrim(u.raw_user_meta_data->>'name'), ''),
    split_part(u.email, '@', 1)
  )
  from auth.users u where u.id = p_id
$$;
revoke all on function kw_private.mat_person_name(uuid) from public, anon, authenticated;

-- One log row; returns it in the shape the client merges.
create or replace function kw_private.mat_log_write(p_id text, p_kind text, p_detail jsonb)
  returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_row kw_private.mat_log;
begin
  insert into kw_private.mat_log (item_id, package, actor, kind, detail)
    select p_id, i.package, auth.uid(), p_kind, coalesce(p_detail, '{}'::jsonb)
    from public.kw_mat_items i where i.id = p_id
    returning * into v_row;
  return jsonb_build_object(
    'id', v_row.id, 'item_id', v_row.item_id, 'at', v_row.at, 'by', v_row.actor,
    'by_name', kw_private.mat_person_name(v_row.actor), 'kind', v_row.kind, 'detail', v_row.detail
  );
end $$;
revoke all on function kw_private.mat_log_write(text, text, jsonb) from public, anon, authenticated;

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
  -- The last three weeks of activity, newest first, capped so a busy package stays small.
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', l.id, 'item_id', l.item_id, 'at', l.at, 'by', l.actor, 'kind', l.kind, 'detail', l.detail
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
  -- Names for everyone the response mentions.
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

-- The setters are those of 20261120170825_material_tracker_week_edits.sql, plus one log row each.
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
  return jsonb_build_object('week', v_week, 'updated_at', v_at,
    'log', kw_private.mat_log_write(p_id, 'remark', jsonb_build_object('team', p_team, 'body', left(v_body, 160))));
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
  return jsonb_build_object('updated_at', v_at,
    'log', kw_private.mat_log_write(p_id, 'fields', jsonb_build_object(p_cell, coalesce(p_value, 'null'::jsonb))));
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
  return jsonb_build_object('updated_at', v_at, 'log', kw_private.mat_log_write(p_id, 'fields', p_patch));
end $$;
