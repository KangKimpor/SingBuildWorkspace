-- Removes BOQ item 1 (GENERAL REQUIREMENTS & PRELIMINARIES, wbs 'GR&P') from BP03 and BP04; BP02 never had it.
-- The remaining weights are rescaled by 1/(1-w) so each project's leaf weights still total 100%
-- (top-level relative weights are shares of the project, so they scale too; nested relative weights are untouched).
-- Forward-only. Production check before writing: no submission referenced GR&P and every summary's GR&P contribution was 0.

alter table public.kw_nbc_activities disable trigger nbc_activity_guard;

with removed as (
  select user_id, project_id, (data->>'globalWeight')::numeric w
  from public.kw_nbc_activities
  where wbs = 'GR&P' and project_id in ('nbc-bp03', 'nbc-bp04')
), rescaled as (
  update public.kw_nbc_activities a
  set data = jsonb_set(
        case when a.data->>'parentId' is null
          then jsonb_set(a.data, '{relativeWeight}', to_jsonb((a.data->>'relativeWeight')::numeric / (1 - r.w)))
          else a.data end,
        '{globalWeight}', to_jsonb((a.data->>'globalWeight')::numeric / (1 - r.w))),
      updated_at = clock_timestamp()
  from removed r
  where a.user_id = r.user_id and a.project_id = r.project_id and a.wbs <> 'GR&P'
  returning 1
)
delete from public.kw_nbc_activities a
using removed r
where a.user_id = r.user_id and a.project_id = r.project_id and a.wbs = 'GR&P';

-- Flush the deferred parent foreign keys, otherwise ALTER TABLE refuses with pending trigger events.
set constraints all immediate;
alter table public.kw_nbc_activities enable trigger nbc_activity_guard;

-- Defensive cleanup of stored references (none existed when this was written).
update public.kw_nbc_submissions s
set data = jsonb_set(
      jsonb_set(s.data, '{entries}', coalesce((select jsonb_agg(e) from jsonb_array_elements(coalesce(s.data->'entries', '[]')) e where e->>'activityId' not like '%GR&P'), '[]')),
      '{appliedEntries}', coalesce((select jsonb_agg(e) from jsonb_array_elements(coalesce(s.data->'appliedEntries', '[]')) e where e->>'activityId' not like '%GR&P'), '[]'))
where s.project_id in ('nbc-bp03', 'nbc-bp04') and s.data::text like '%GR&P%';

update public.kw_nbc_summaries
set data = jsonb_set(data, '{contributions}', (data->'contributions') - 'GR&P')
where project_id in ('nbc-bp03', 'nbc-bp04') and data->'contributions' ? 'GR&P';
