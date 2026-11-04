-- Handler updates are due Friday 11:59 PM in Phnom Penh. The week still runs Monday to Sunday.
-- Saturday 00:00 is the exclusive boundary; exactly midnight is late.
-- Existing confirmed rows keep the late flag they were stamped with.
create or replace function kw_private.nbc_deadline(week date) returns timestamptz language sql immutable set search_path='' as $$
  select (week + 5)::timestamp at time zone 'Asia/Phnom_Penh'
$$;
