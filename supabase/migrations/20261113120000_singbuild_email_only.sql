-- Only @singbuild.com accounts may be created (Google sign-in or any other provider).
-- Auth calls this before inserting a user. Enable it in the dashboard:
-- Authentication → Hooks → "Before User Created" → Postgres → public.kw_before_user_created.
create or replace function public.kw_before_user_created(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  email text := lower(coalesce(event->'user'->>'email', ''));
begin
  if email like '%@singbuild.com' then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Sign in with your @singbuild.com email. Other accounts are not allowed.'
  ));
end;
$$;

revoke execute on function public.kw_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.kw_before_user_created(jsonb) to supabase_auth_admin;
