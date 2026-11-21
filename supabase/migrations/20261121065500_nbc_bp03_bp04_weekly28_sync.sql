-- Sync BP03 and BP04 non-leaf labels and project progress with the Weekly 28 workbooks
-- (3. & 5. BP-03 Weekly 28 - 15 Nov - 21 Nov 2026.xlsx and 3. & 6. BP-04 - Weekly 28 - 15 Nov - 21 Nov 2026.xlsx).
--
-- Leaves, weights, room structure, and progress values already match Weekly 28 bit-for-bit
-- (BP03: 431 editable leaves, overall 52.032632%; BP04: 243 editable leaves, overall 51.466490%).
-- This migration updates:
--   1. nbc-bp04:1.4.4 task name from 'Final Ceiling Decoration by Waterproof Paint' to 'Final Ceiling Decoration'
--      (matching Weekly 28; nbc-bp04:2.4.3 intentionally stays 'Sanitary Equipment' without the workbook's stray U+200B).
--   2. nbc-bp03:1.4 naTasks entry 'Final Ceiling Decoration by Waterproof Paint' to 'Final Ceiling Decoration'
--      (matching Weekly 28 in clean Title Case; other BP03 clean Title Case labels are intentionally kept over workbook typos).
--   3. kw_projects.data->'progress' for nbc-bp03 and nbc-bp04 from the live editable leaves (matching P.sum!E7 and the 2026-11-15 summaries).
--
-- Forward-only and idempotent; touches at most 2 activity rows and 0 editable leaves.

do $migration$
declare
  dry constant boolean := false;
  stamp timestamptz := clock_timestamp();
  owner uuid;
  ov3 float8;
  w3_off float8;
  ov4 float8;
  w4_off float8;
  updated_bp04_names int := 0;
  updated_bp03_na int := 0;
  updated_projects int := 0;
  report jsonb;
begin
  select user_id into owner
  from public.kw_nbc_activities
  where project_id in ('nbc-bp03', 'nbc-bp04') and parent_id is null
  limit 1;
  if owner is null then return; end if;

  alter table public.kw_nbc_activities disable trigger nbc_activity_guard;

  -- 1. Align nbc-bp04:1.4.4 task label with BP-04 Weekly 28.
  update public.kw_nbc_activities a
  set data = a.data || jsonb_build_object('name', 'Final Ceiling Decoration', 'updatedAt', stamp),
      updated_at = stamp
  where a.user_id = owner
    and a.project_id = 'nbc-bp04'
    and a.id = 'nbc-bp04:1.4.4'
    and coalesce(a.data->>'editable', 'false') <> 'true'
    and a.data->>'name' is distinct from 'Final Ceiling Decoration';
  get diagnostics updated_bp04_names = row_count;

  -- 2. Align nbc-bp03:1.4 naTasks label with BP-03 Weekly 28 (clean Title Case).
  update public.kw_nbc_activities a
  set data = a.data || jsonb_build_object(
        'naTasks', (
          select jsonb_agg(
            case
              when elem->>'name' = 'Final Ceiling Decoration by Waterproof Paint'
              then elem || jsonb_build_object('name', 'Final Ceiling Decoration')
              else elem
            end
            order by ord
          )
          from jsonb_array_elements(a.data->'naTasks') with ordinality as t(elem, ord)
        ),
        'updatedAt', stamp
      ),
      updated_at = stamp
  where a.user_id = owner
    and a.project_id = 'nbc-bp03'
    and a.id = 'nbc-bp03:1.4'
    and coalesce(a.data->>'editable', 'false') <> 'true'
    and exists (
      select 1
      from jsonb_array_elements(coalesce(a.data->'naTasks', '[]'::jsonb)) as e
      where e->>'name' = 'Final Ceiling Decoration by Waterproof Paint'
    );
  get diagnostics updated_bp03_na = row_count;

  -- 3. Refresh kw_projects.data->'progress' for nbc-bp03 and nbc-bp04 from live editable leaves.
  select sum((data->>'globalWeight')::float8 * (data->>'progress')::float8),
         abs(sum((data->>'globalWeight')::float8) - 1)
  into ov3, w3_off
  from public.kw_nbc_activities
  where user_id = owner and project_id = 'nbc-bp03' and data->>'editable' = 'true';

  if ov3 is not null then
    if w3_off > 1e-9 then
      raise exception 'BP03 leaf weights total % off 100%%', w3_off;
    end if;
    update public.kw_projects
    set data = jsonb_set(data, '{progress}', to_jsonb(ov3)),
        updated_at = stamp
    where id = 'nbc-bp03'
      and abs(coalesce((data->>'progress')::float8, -1) - ov3) > 1e-12;
    if found then updated_projects := updated_projects + 1; end if;
  end if;

  select sum((data->>'globalWeight')::float8 * (data->>'progress')::float8),
         abs(sum((data->>'globalWeight')::float8) - 1)
  into ov4, w4_off
  from public.kw_nbc_activities
  where user_id = owner and project_id = 'nbc-bp04' and data->>'editable' = 'true';

  if ov4 is not null then
    if w4_off > 1e-9 then
      raise exception 'BP04 leaf weights total % off 100%%', w4_off;
    end if;
    update public.kw_projects
    set data = jsonb_set(data, '{progress}', to_jsonb(ov4)),
        updated_at = stamp
    where id = 'nbc-bp04'
      and abs(coalesce((data->>'progress')::float8, -1) - ov4) > 1e-12;
    if found then updated_projects := updated_projects + 1; end if;
  end if;

  if dry then
    select jsonb_build_object(
      'updated_bp04_names', updated_bp04_names,
      'updated_bp03_na', updated_bp03_na,
      'updated_projects', updated_projects,
      'bp03_overall', ov3,
      'bp03_weight_off', w3_off,
      'bp04_overall', ov4,
      'bp04_weight_off', w4_off
    ) into report;
    raise exception 'DRYRUN %', report;
  end if;

  set constraints all immediate;
  alter table public.kw_nbc_activities enable trigger nbc_activity_guard;
end
$migration$;
