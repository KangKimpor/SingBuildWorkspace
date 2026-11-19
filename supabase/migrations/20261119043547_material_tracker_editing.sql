-- Extend material tracker editing: hide COMMONLY MATERIALS USES, widen edits validation,
-- add batch kw_mat_set_fields, and add private kw-mat-images bucket.

-- 1. Hide COMMONLY MATERIALS USES section and its covered rows for BP03 and BP04.
alter table public.kw_mat_items
  add column if not exists hidden boolean not null default false;

update public.kw_mat_items i
set hidden = true, updated_at = now()
from (
  select package, sheet, pos, (data->>'end')::int as end_pos
  from public.kw_mat_items
  where package in ('bp03', 'bp04')
    and sheet = 'id'
    and kind = 'section'
    and upper(btrim(coalesce(data->'cols'->>'code', ''))) = 'COMMONLY MATERIALS USES'
) s
where i.package = s.package
  and i.sheet = s.sheet
  and i.pos between s.pos and s.end_pos
  and not i.hidden;

-- 2. Exclude hidden rows from mat_load and mat_set_remark.
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
      'data', i.data, 'edits', i.edits, 'updated_at', i.updated_at
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
      and r.week_start in (v_week, v_week - 7)
      and (p_remarks_since is null or r.updated_at > p_remarks_since);
  return jsonb_build_object('week', v_week, 'now', now(), 'items', v_items, 'remarks', v_remarks);
end $$;

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
  return jsonb_build_object('week', v_week, 'updated_at', v_at);
end $$;

-- 3. Shared validation helper for every editable key in kw_mat_items.edits.
create function kw_private.mat_valid_field(p_key text, p_value jsonb) returns boolean
  language plpgsql immutable set search_path='' as $$
declare
  v_is_null boolean := p_value is null or jsonb_typeof(p_value) = 'null';
begin
  if p_key is null then return false; end if;
  if p_key in ('total','po','shd','onsite','remaining','notYetPo','placed','production','waiting','shipping','arrived') then
    return v_is_null
      or jsonb_typeof(p_value) = 'number'
      or (jsonb_typeof(p_value) = 'string' and length(p_value #>> '{}') between 1 and 60);
  elsif p_key in ('no','code','pic','bp02','location','brand','source','msPlan','msActual','msApproved','msStatus','ssPlan','ssActual','ssApproved','poPlan','poActual','arrPlan','arrActual','unit') then
    return v_is_null
      or (jsonb_typeof(p_value) = 'string' and length(p_value #>> '{}') between 0 and 200);
  elsif p_key in ('description','spec','procRemarks') then
    return v_is_null
      or (jsonb_typeof(p_value) = 'string' and length(p_value #>> '{}') between 0 and 2000);
  elsif p_key in ('image','sample') then
    return v_is_null
      or (
        jsonb_typeof(p_value) = 'array'
        and jsonb_array_length(p_value) <= 10
        and not exists (
          select 1
          from jsonb_array_elements(p_value) as el(e)
          where jsonb_typeof(el.e) <> 'string'
             or (el.e #>> '{}') like '%..%'
             or not (
               (el.e #>> '{}') ~ '^[a-f0-9]{1,64}\.(webp|png|jpg|jpeg)$'
               or (el.e #>> '{}') ~ '^storage:[a-zA-Z0-9._/-]{1,200}$'
             )
        )
      );
  else
    return false;
  end if;
end $$;
revoke all on function kw_private.mat_valid_field(text, jsonb) from public, anon, authenticated;

-- 4. Update single-cell setter and add multi-field setter.
create or replace function kw_private.mat_set_cell(p_id text, p_cell text, p_value jsonb)
  returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_at timestamptz;
begin
  if not public.kw_mat_access() then raise exception 'Not found' using errcode='42501'; end if;
  if not kw_private.mat_valid_field(p_cell, p_value) then
    raise exception 'Invalid cell or value' using errcode='22023';
  end if;
  update public.kw_mat_items
    set edits = case when p_value is null or jsonb_typeof(p_value) = 'null' then edits - p_cell
                     else edits || jsonb_build_object(p_cell, p_value) end,
        updated_at = now(),
        updated_by = auth.uid()
    where id = p_id and kind = 'item' and not hidden
    returning updated_at into v_at;
  if not found then raise exception 'Item not found' using errcode='P0002'; end if;
  return jsonb_build_object('updated_at', v_at);
end $$;

create function kw_private.mat_set_fields(p_id text, p_patch jsonb)
  returns jsonb language plpgsql security definer set search_path='' as $$
declare
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
        updated_at = now(),
        updated_by = auth.uid()
    where id = p_id and kind = 'item' and not hidden
    returning updated_at into v_at;
  if not found then raise exception 'Item not found' using errcode='P0002'; end if;
  return jsonb_build_object('updated_at', v_at);
end $$;
revoke all on function kw_private.mat_set_fields(text, jsonb) from public, anon;
grant execute on function kw_private.mat_set_fields(text, jsonb) to authenticated;

create function public.kw_mat_set_fields(p_id text, p_patch jsonb)
  returns jsonb language sql security invoker set search_path='' as $$
  select kw_private.mat_set_fields(p_id, p_patch)
$$;
revoke all on function public.kw_mat_set_fields(text, jsonb) from public, anon;
grant execute on function public.kw_mat_set_fields(text, jsonb) to authenticated;

-- 5. Private Storage bucket for uploaded material photos (access gated by mat_access()).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kw-mat-images', 'kw-mat-images', false, 5242880, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

create policy kw_mat_images_select on storage.objects
  for select to authenticated
  using (bucket_id = 'kw-mat-images' and (select public.kw_mat_access()));
create policy kw_mat_images_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'kw-mat-images' and (select public.kw_mat_access()));
create policy kw_mat_images_update on storage.objects
  for update to authenticated
  using (bucket_id = 'kw-mat-images' and (select public.kw_mat_access()))
  with check (bucket_id = 'kw-mat-images' and (select public.kw_mat_access()));
create policy kw_mat_images_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'kw-mat-images' and (select public.kw_mat_access()));
