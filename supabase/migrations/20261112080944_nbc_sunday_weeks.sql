-- Reporting weeks now run Sunday to Saturday and are keyed by their Sunday (they were keyed by their Monday).
-- Updates are still due Friday 11:59 PM in Phnom Penh: Saturday 00:00 is the exclusive boundary, six days after the Sunday key.

create or replace function kw_private.nbc_deadline(week date) returns timestamptz language sql immutable set search_path='' as $$
  select (week + 6)::timestamp at time zone 'Asia/Phnom_Penh'
$$;

-- The confirm/save/undo writer only changes where "this week" starts and which dates are valid week keys.
-- Patch the installed definition instead of copying its ~15 KB body, and fail loudly if either piece is missing.
do $$
declare
  fn text := pg_get_functiondef('kw_private.nbc_submission_write(text,jsonb,timestamptz)'::regprocedure);
  patched text;
begin
  patched := replace(fn, 'date_trunc(''week'',clock_timestamp() at time zone ''Asia/Phnom_Penh'')::date',
                         '(date_trunc(''week'',(clock_timestamp() at time zone ''Asia/Phnom_Penh'')+interval ''1 day'')::date-1)');
  if patched = fn then raise exception 'current_week expression not found in nbc_submission_write'; end if;
  fn := patched;
  patched := replace(fn, 'extract(isodow from week)<>1', 'extract(dow from week)<>0');
  if patched = fn then raise exception 'isodow check not found in nbc_submission_write'; end if;
  execute patched;
end $$;

-- Existing weeks move from their Monday key to the Sunday before it, so each keeps the same Friday deadline.
-- Ids embed the week (project:week:handler and project:week).
update public.kw_nbc_submissions
   set id = replace(id, ':' || week_start || ':', ':' || (week_start::date - 1)::text || ':'),
       data = jsonb_set(jsonb_set(data, '{weekStart}', to_jsonb((week_start::date - 1)::text)), '{id}',
                        to_jsonb(replace(id, ':' || week_start || ':', ':' || (week_start::date - 1)::text || ':')))
 where extract(dow from week_start::date) = 1;

update public.kw_nbc_summaries
   set id = replace(id, (data->>'weekStart'), ((data->>'weekStart')::date - 1)::text),
       data = jsonb_set(jsonb_set(data, '{weekStart}', to_jsonb(((data->>'weekStart')::date - 1)::text)), '{id}',
                        to_jsonb(replace(id, (data->>'weekStart'), ((data->>'weekStart')::date - 1)::text)))
 where extract(dow from (data->>'weekStart')::date) = 1;
