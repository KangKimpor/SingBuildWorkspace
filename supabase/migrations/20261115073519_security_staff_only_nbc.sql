-- Forward-only. NBC company data is readable only by @singbuild.com accounts (D-37).
--
-- Before this, every NBC policy keyed off kw_private.kw_nbc_owner(), which returned the company
-- owner for any signed-in caller. The @singbuild.com rule lived only in the sign-up hook and in a
-- client-side sign-out, so an account created before the hook (or a direct API call with its token)
-- could read every activity, submission, summary and report template.

-- The email claim comes from auth.users.email (never user_metadata), so it is safe for authorization.
create or replace function kw_private.kw_staff() returns boolean
language sql stable security invoker set search_path='' as $$
  select coalesce(lower(auth.jwt()->>'email') like '%@singbuild.com', false)
    and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false
$$;
revoke all on function kw_private.kw_staff() from public, anon;
grant execute on function kw_private.kw_staff() to authenticated;

-- Every NBC policy, RPC and trigger resolves the company owner through this function, so the staff
-- check here covers activities, submissions, summaries, reports and the submission/reassign RPCs.
create or replace function kw_private.kw_nbc_owner() returns uuid
language sql stable security definer set search_path='' as $$
  select distinct user_id from public.kw_projects
  where auth.uid() is not null and kw_private.kw_staff() and data->>'nbcBp03'='true'
$$;

-- Shared NBC projects are visible to staff only; personal projects stay owner-only.
drop policy if exists kw_projects_read on public.kw_projects;
create policy kw_projects_read on public.kw_projects for select to authenticated using (
  (select auth.uid()) = user_id
  or (data->>'nbcBp03' = 'true' and (select kw_private.kw_staff()))
);

drop policy if exists nbc_company_read on public.kw_nbc_templates;
create policy nbc_company_read on public.kw_nbc_templates for select to authenticated using (
  (select kw_private.kw_staff())
  and exists (select 1 from public.kw_projects p where p.id = kw_nbc_templates.project_id and p.data->>'nbcBp03' = 'true')
);

-- Direct activity writes (kw_workspace_write runs as the caller) only ever change data; id, user_id
-- and created_at are not the caller's to set. Generated columns follow data.
revoke update on public.kw_nbc_activities from authenticated;
grant update (data, updated_at) on public.kw_nbc_activities to authenticated;

-- events and nbc_reports are no longer written by the app (the client collections list has neither); stop accepting them.
create or replace function public.kw_workspace_write_before_submissions(
  collection text,
  record_id text,
  payload jsonb,
  expected timestamptz default null
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  existing jsonb;
  stamp timestamptz;
  owner_id uuid := auth.uid();
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if collection='profiles' and record_id<>auth.uid()::text then raise exception 'Invalid profile'; end if;
  if collection not in ('pages','projects','tasks','profiles','nbc_activities')
     or jsonb_typeof(payload)<>'object'
     or length(payload::text)>2000000
     or octet_length(record_id)>2048 then
    raise exception 'Invalid record';
  end if;
  if collection = 'nbc_activities' then
    owner_id := public.kw_nbc_owner();
    if owner_id is null then raise exception 'Company NBC project is not initialized'; end if;
    perform pg_advisory_xact_lock(hashtextextended(owner_id::text||'nbc-bp03',0));
  end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text||collection||record_id,0));
  execute format('select to_jsonb(t) from public.%I t where user_id=$1 and id::text=$2','kw_'||collection)
    into existing using owner_id,record_id;
  if existing is not null and (expected is null or (existing->>'updated_at')::timestamptz<>expected) then
    return jsonb_build_object('conflict',true,'row',existing);
  end if;
  if existing is null and expected is not null then
    return jsonb_build_object('conflict',true,'row',null);
  end if;
  if collection='projects' then
    payload = jsonb_set(payload, '{workspace}', to_jsonb(coalesce(payload->>'workspace','personal')));
  end if;
  if payload->>'id' is distinct from record_id then raise exception 'Record ID mismatch'; end if;
  if existing is null then
    execute format(
      'insert into public.%I(id,user_id,data) values(%s,$2,$3) returning updated_at',
      'kw_'||collection,
      case when collection='profiles' then '$1::uuid' else '$1' end
    ) into stamp using record_id,owner_id,payload;
  else
    execute format(
      'update public.%I set data=$3,updated_at=clock_timestamp() where user_id=$1 and id::text=$2 returning updated_at',
      'kw_'||collection
    ) into stamp using owner_id,record_id,payload;
  end if;
  return jsonb_build_object('conflict',false,'row',jsonb_build_object('id',record_id,'updated_at',stamp));
end $$;
revoke all on function public.kw_workspace_write_before_submissions(text,text,jsonb,timestamptz) from public,anon;
grant execute on function public.kw_workspace_write_before_submissions(text,text,jsonb,timestamptz) to authenticated;
