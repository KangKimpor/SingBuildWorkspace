-- Material list tracker (BP03 and BP04), served at the hidden /admin page.
--
-- Two dedicated tables that only the accounts in kw_private.mat_admins may read.
-- Nobody writes the tables directly: every change goes through the checked RPCs
-- below, which merge one cell or one remark at a time. Callers who are not on the
-- list get 'Not found', so the RPCs do not reveal that the tracker exists.
-- Adding a person later is one insert into kw_private.mat_admins.

-- Access list
create table kw_private.mat_admins (email text primary key check (email = lower(email)));
insert into kw_private.mat_admins (email) values
  ('kimpor.kang@singbuild.com'),
  ('soklim.sim@singbuild.com');
alter table kw_private.mat_admins enable row level security;
revoke all on table kw_private.mat_admins from public, anon, authenticated;

create function public.kw_mat_access() returns boolean
  language sql stable security definer set search_path='' as $$
  select exists (select 1 from kw_private.mat_admins where email = lower(auth.jwt()->>'email'))
$$;
revoke all on function public.kw_mat_access() from public, anon;
grant execute on function public.kw_mat_access() to authenticated;

-- Weeks run Sunday to Saturday in Phnom Penh. The server decides the week.
create function kw_private.mat_week() returns date
  language sql set search_path='' as $$
  select (date_trunc('week',(clock_timestamp() at time zone 'Asia/Phnom_Penh')+interval '1 day')::date-1)
$$;
revoke all on function kw_private.mat_week() from public, anon;
grant execute on function kw_private.mat_week() to authenticated;

-- Data. `data` holds the imported source cells; `edits` holds what people typed,
-- keyed by cell, so a corrected workbook can be re-imported without losing edits.
create table public.kw_mat_items (
  id text primary key,
  package text not null check (package in ('bp03','bp04')),
  sheet text not null check (sheet in ('id','mep','review','changelog')),
  pos int not null,
  kind text not null check (kind in ('section','item','note')),
  data jsonb not null,
  edits jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index kw_mat_items_package_updated_idx on public.kw_mat_items (package, updated_at);

create table public.kw_mat_remarks (
  item_id text references public.kw_mat_items on delete cascade,
  team text check (team in ('pm','purchase')),
  week_start date,
  body text not null check (length(body) <= 2000),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (item_id, team, week_start)
);
create index kw_mat_remarks_week_updated_idx on public.kw_mat_remarks (week_start, updated_at);

alter table public.kw_mat_items enable row level security;
alter table public.kw_mat_remarks enable row level security;
create policy mat_read on public.kw_mat_items for select to authenticated using ((select public.kw_mat_access()));
create policy mat_read on public.kw_mat_remarks for select to authenticated using ((select public.kw_mat_access()));
revoke insert, update, delete, truncate, references, trigger on table public.kw_mat_items, public.kw_mat_remarks from authenticated, anon;
revoke select on table public.kw_mat_items, public.kw_mat_remarks from anon;
grant select on table public.kw_mat_items, public.kw_mat_remarks to authenticated;

-- One package: items changed since p_items_since (all when null) and the remarks
-- of this week and last week changed since p_remarks_since (all when null).
-- `now` is the value to send back as the next *_since.
create function public.kw_mat_load(p_package text, p_items_since timestamptz default null, p_remarks_since timestamptz default null)
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
    where i.package = p_package and (p_items_since is null or i.updated_at > p_items_since);
  select coalesce(jsonb_agg(jsonb_build_object(
      'item_id', r.item_id, 'team', r.team, 'week_start', r.week_start, 'body', r.body
    )), '[]'::jsonb)
    into v_remarks
    from public.kw_mat_remarks r
    join public.kw_mat_items i on i.id = r.item_id
    where i.package = p_package
      and r.week_start in (v_week, v_week - 7)
      and (p_remarks_since is null or r.updated_at > p_remarks_since);
  return jsonb_build_object('week', v_week, 'now', now(), 'items', v_items, 'remarks', v_remarks);
end $$;
revoke all on function public.kw_mat_load(text, timestamptz, timestamptz) from public, anon;
grant execute on function public.kw_mat_load(text, timestamptz, timestamptz) to authenticated;

-- Set or remove (JSON or SQL null) one key in `edits`. Merging a single key means
-- two people editing different cells of the same row do not overwrite each other.
create function public.kw_mat_set_cell(p_id text, p_cell text, p_value jsonb)
  returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_at timestamptz;
begin
  if not public.kw_mat_access() then raise exception 'Not found' using errcode='42501'; end if;
  if p_cell is null or p_cell not in ('total','po','shd','onsite','remaining','notYetPo','placed','production','waiting','shipping','arrived') then
    raise exception 'Invalid cell' using errcode='22023';
  end if;
  if p_value is not null and jsonb_typeof(p_value) <> 'null' and jsonb_typeof(p_value) <> 'number'
    and not (jsonb_typeof(p_value) = 'string' and length(p_value #>> '{}') between 1 and 60) then
    raise exception 'Invalid value' using errcode='22023';
  end if;
  update public.kw_mat_items
    set edits = case when p_value is null or jsonb_typeof(p_value) = 'null' then edits - p_cell
                     else edits || jsonb_build_object(p_cell, p_value) end,
        updated_at = now(),
        updated_by = auth.uid()
    where id = p_id and kind = 'item'
    returning updated_at into v_at;
  if not found then raise exception 'Item not found' using errcode='P0002'; end if;
  return jsonb_build_object('updated_at', v_at);
end $$;
revoke all on function public.kw_mat_set_cell(text, text, jsonb) from public, anon;
grant execute on function public.kw_mat_set_cell(text, text, jsonb) to authenticated;

-- Upsert this week's remark for one team. An empty body is stored as '' (not
-- deleted) so delta loads see the change.
create function public.kw_mat_set_remark(p_id text, p_team text, p_body text)
  returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_week date;
  v_body text := coalesce(btrim(p_body), '');
  v_at timestamptz;
begin
  if not public.kw_mat_access() then raise exception 'Not found' using errcode='42501'; end if;
  if p_team is null or p_team not in ('pm','purchase') then raise exception 'Invalid team' using errcode='22023'; end if;
  if length(v_body) > 2000 then raise exception 'Remark is too long' using errcode='22023'; end if;
  if not exists (select 1 from public.kw_mat_items where id = p_id) then raise exception 'Item not found' using errcode='P0002'; end if;
  v_week := kw_private.mat_week();
  insert into public.kw_mat_remarks as r (item_id, team, week_start, body, updated_at, updated_by)
    values (p_id, p_team, v_week, v_body, now(), auth.uid())
    on conflict (item_id, team, week_start)
    do update set body = excluded.body, updated_at = excluded.updated_at, updated_by = excluded.updated_by
    returning r.updated_at into v_at;
  return jsonb_build_object('week', v_week, 'updated_at', v_at);
end $$;
revoke all on function public.kw_mat_set_remark(text, text, text) from public, anon;
grant execute on function public.kw_mat_set_remark(text, text, text) to authenticated;
