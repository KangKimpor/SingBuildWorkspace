-- Sync BP02 non-leaf labels and project progress with the finalized Weekly 64 workbook
-- (2. & 5. BP-02 Weekly 64 - 15 Nov - 21 Nov 2026.xlsx, after P.sum!G18 was restored to ='F23 (ID)'!C39).
--
-- Leaves, weights, room structure, and progress values already match Weekly 64 bit-for-bit
-- (15,274 editable leaves, overall 86.413064%). This migration updates:
--   1. The 3 task labels that differed from the report (Floor 13 MEP Cable Tray / DB, Floor 17 ID Built-in Furniture).
--   2. The 99 MEP subsystem titles (9 subsystems x 11 floors) to match the report's Title Case.
--   3. kw_projects.data->'progress' for nbc-bp02 from the live editable leaves (matching P.sum!E7 and the 2026-11-15 summary).
--
-- Forward-only and idempotent; touches at most 102 activity rows (under the 200-row broadcast threshold) and 0 editable leaves.

do $migration$
declare
  dry constant boolean := false;
  stamp timestamptz := clock_timestamp();
  owner uuid;
  ov float8;
  weight_off float8;
  updated_names int;
  report jsonb;
begin
  select user_id into owner from public.kw_nbc_activities where project_id = 'nbc-bp02' and parent_id is null limit 1;
  if owner is null then return; end if;

  alter table public.kw_nbc_activities disable trigger nbc_activity_guard;

  -- 1. Align the 3 task names and 99 MEP subsystem titles with Weekly 64.
  with task_renames(id, new_name) as (
    values
      ('nbc-bp02:1.8.1.11.3.1.3.1', 'Cable Tray Installation'),
      ('nbc-bp02:1.8.1.11.3.1.3.2', 'DB Installation'),
      ('nbc-bp02:1.8.1.7.1.8.1',    'Bedhead, Wardrobe,Mini Bar,  Vanity Counter & TV Wall and Frame')
  ), subsystem_renames(old_name, new_name) as (
    values
      ('Lighting system',                         'Lighting System'),
      ('Socket system',                           'Socket System'),
      ('Distribution board & Cable tray system',  'Distribution Board & Cable Tray System'),
      ('Telephone and Data system',               'Telephone and Data System'),
      ('Guest room management system (GRMS)',     'Guest Room Management System (GRMS)'),
      ('Cold & hot water supply system',          'Cold & Hot Water Supply System'),
      ('Sanitary system',                         'Sanitary System'),
      ('Sanitary equipment',                      'Sanitary Equipment'),
      ('Fire fighting system',                    'Fire Fighting System')
  ), targets as (
    select a.id, r.new_name
    from public.kw_nbc_activities a
    join task_renames r on r.id = a.id
    where a.user_id = owner and a.project_id = 'nbc-bp02'
      and coalesce(a.data->>'editable', 'false') <> 'true'
      and a.data->>'name' is distinct from r.new_name
    union all
    select a.id, s.new_name
    from public.kw_nbc_activities a
    join subsystem_renames s on s.old_name = a.data->>'name'
    where a.user_id = owner and a.project_id = 'nbc-bp02'
      and coalesce(a.data->>'editable', 'false') <> 'true'
      and a.data->>'name' is distinct from s.new_name
  )
  update public.kw_nbc_activities a
  set data = a.data || jsonb_build_object('name', t.new_name, 'updatedAt', stamp),
      updated_at = stamp
  from targets t
  where a.user_id = owner and a.id = t.id;

  get diagnostics updated_names = row_count;

  -- 2. Refresh kw_projects progress for nbc-bp02 from live editable leaves.
  select sum((data->>'globalWeight')::float8 * (data->>'progress')::float8),
         abs(sum((data->>'globalWeight')::float8) - 1)
  into ov, weight_off
  from public.kw_nbc_activities
  where user_id = owner and project_id = 'nbc-bp02' and data->>'editable' = 'true';

  if weight_off > 1e-9 then
    raise exception 'BP02 leaf weights total % off 100%%', weight_off;
  end if;

  update public.kw_projects
  set data = jsonb_set(data, '{progress}', to_jsonb(ov)),
      updated_at = stamp
  where id = 'nbc-bp02'
    and abs(coalesce((data->>'progress')::float8, -1) - ov) > 1e-12;

  if dry then
    select jsonb_build_object('updated_names', updated_names, 'overall', ov, 'weight_off', weight_off) into report;
    raise exception 'DRYRUN %', report;
  end if;

  set constraints all immediate;
  alter table public.kw_nbc_activities enable trigger nbc_activity_guard;
end
$migration$;
