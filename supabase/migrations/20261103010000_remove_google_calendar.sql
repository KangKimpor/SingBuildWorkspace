-- Forward-only. Removes the Google Calendar integration (client, Edge Function and Vercel proxy are already gone).
-- Provider-synced events are identified by providerEventId; local events are untouched.
-- Legacy public.calendars and public.calendar_oauth_requests stay: delete_my_cloud_data() and the export functions still name them.
delete from public.kw_events where data ? 'providerEventId';
drop function if exists public.kw_google_rate(uuid);
drop table if exists public.kw_calendars;
drop table if exists public.kw_calendar_tokens;
drop table if exists public.kw_calendar_accounts;
drop table if exists public.kw_google_limits;
