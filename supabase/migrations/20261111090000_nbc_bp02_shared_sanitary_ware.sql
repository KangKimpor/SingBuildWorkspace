-- BP02 "Installation Water Closet, Lavatory and Shower": every room cell is shared 50/50 by two handlers.
-- Each room leaf keeps its id, history and submissions as the first half (Chhorvaon) at half the weight; a second leaf
-- (id and wbs suffixed ".2", `coOf` = the first half) is added for Tola at the other half. The second half starts at the
-- first half's progress and baseline, so the room, the group, the floor and the project overall do not move.
-- The app and the Excel export read the two halves back as one cell (their average). Forward-only and idempotent.
--
-- Verify before and after (counts and sums only, per the pooler egress rules):
--   select count(*), sum((data->>'globalWeight')::numeric), sum((data->>'globalWeight')::numeric*(data->>'progress')::numeric)
--   from kw_nbc_activities where project_id = 'nbc-bp02' and (data->>'editable') = 'true';   -- weight and weighted progress identical

alter table public.kw_nbc_activities disable trigger nbc_activity_guard;

with shared as (
  select c.user_id, c.id
  from public.kw_nbc_activities g
  join public.kw_nbc_activities c on c.user_id = g.user_id and c.parent_id = g.id
  where g.project_id = 'nbc-bp02' and g.data->>'name' ilike 'Installation Water Closet, Lavatory and Shower'
    and c.data->>'editable' = 'true' and c.data->>'coOf' is null
    and not exists (select 1 from public.kw_nbc_activities x where x.user_id = c.user_id and x.id = c.id || '.2')
), halved as (
  update public.kw_nbc_activities a
  set data = jsonb_set(jsonb_set(a.data, '{relativeWeight}', to_jsonb((a.data->>'relativeWeight')::numeric / 2)),
                       '{globalWeight}', to_jsonb((a.data->>'globalWeight')::numeric / 2)),
      updated_at = clock_timestamp()
  from shared s
  where a.user_id = s.user_id and a.id = s.id
  returning a.user_id, a.id, a.wbs, a.data
)
-- project_id, parent_id and wbs are generated from data.
insert into public.kw_nbc_activities (id, user_id, data, updated_at)
select h.id || '.2', h.user_id,
       (h.data - 'baselineResetAt') || jsonb_build_object(
         'id', h.id || '.2', 'wbs', h.wbs || '.2', 'coOf', h.id, 'handler', 'Tola', 'remark', '', 'history', '[]'::jsonb,
         'sourceWeekly', 0, 'updatedAt', clock_timestamp()),
       clock_timestamp()
from halved h;

-- Flush the deferred parent foreign keys, otherwise ALTER TABLE refuses with pending trigger events.
set constraints all immediate;
alter table public.kw_nbc_activities enable trigger nbc_activity_guard;
