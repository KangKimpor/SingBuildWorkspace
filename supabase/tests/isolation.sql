begin;
insert into auth.users(id) values('f0000000-0000-4000-8000-000000000001'),('f0000000-0000-4000-8000-000000000002');
-- Use the live company project when one exists; create it on a fresh database.
do $$
declare existing_id text;
begin
  select id into existing_id from public.kw_projects where data->>'nbcBp03'='true' order by id limit 1;
  if existing_id is null then
    insert into public.kw_projects(id,user_id,data) values(
      'rls-nbc',
      'f0000000-0000-4000-8000-000000000001',
      '{"id":"rls-nbc","nbcBp03":"true","workspace":"team"}'
    );
    existing_id = 'rls-nbc';
  end if;
  perform set_config('rls.nbc_id', existing_id, true);
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f0000000-0000-4000-8000-000000000001","role":"authenticated","email":"rls-one@singbuild.com"}',true);
do $$begin
 if (public.kw_workspace_write('pages','rls-check','{"id":"rls-check","title":"Isolation test"}',null)->>'conflict')::boolean then raise exception 'Initial write rejected'; end if;
 if not (public.kw_workspace_write('pages','rls-check','{"id":"rls-check","title":"Stale write"}',null)->>'conflict')::boolean then raise exception 'Stale write accepted'; end if;
end$$;
do $$ declare created jsonb; version timestamptz; begin
 created = public.kw_workspace_write('projects','workspace-default','{"id":"workspace-default","name":"Personal by default"}',null);
 if (select data->>'workspace' from public.kw_projects where id='workspace-default') is distinct from 'personal' then raise exception 'Workspace default missing'; end if;
 version = (created->'row'->>'updated_at')::timestamptz;
 created = public.kw_workspace_write('projects','workspace-default','{"id":"workspace-default","name":"Moved","workspace":"team"}',version);
 if (select data->>'workspace' from public.kw_projects where id='workspace-default') is distinct from 'team' then raise exception 'Workspace assignment failed'; end if;
 version = (created->'row'->>'updated_at')::timestamptz;
 delete from public.kw_projects where id='workspace-default';
 created = public.kw_workspace_write('projects','workspace-default','{"id":"workspace-default","name":"Stale edit"}',version);
 if not (created->>'conflict')::boolean or created->'row' <> 'null'::jsonb then raise exception 'Deleted record recreated'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"f0000000-0000-4000-8000-000000000002","role":"authenticated","email":"rls-two@singbuild.com"}',true);
select count(*) as other_user_visible_rows from public.kw_pages where id='rls-check';
do $$ declare nbc_id text := current_setting('rls.nbc_id'); begin
 if exists(select 1 from public.kw_pages where id='rls-check') then raise exception 'Cross-user data visible'; end if;
 if not exists(select 1 from public.kw_projects where id=nbc_id) then raise exception 'Shared NBC project not visible'; end if;
 begin
 insert into public.kw_pages(id,user_id,data) values('illegal','f0000000-0000-4000-8000-000000000001','{}');
 raise exception 'RLS failed: cross-user write succeeded';
 exception when insufficient_privilege then null;
 end;
 begin
 update public.kw_projects set data = data || '{"name":"hijack"}'::jsonb where id=nbc_id;
 if found then raise exception 'Cross-user project update succeeded'; end if;
 exception when insufficient_privilege then null;
 end;
 begin
 delete from public.kw_projects where id=nbc_id;
 if found then raise exception 'Cross-user project delete succeeded'; end if;
 exception when insufficient_privilege then null;
 end;
 if to_regclass('public.kw_oauth_states') is not null then raise exception 'Legacy OAuth state table is still exposed'; end if;
end$$;
-- Accounts outside @singbuild.com (created before the sign-up hook, D-37) see no company data.
select set_config('request.jwt.claims','{"sub":"f0000000-0000-4000-8000-000000000002","role":"authenticated","email":"outsider@gmail.com"}',true);
do $$ declare nbc_id text := current_setting('rls.nbc_id'); begin
 if public.kw_nbc_owner() is not null then raise exception 'Non-staff account resolved the NBC owner'; end if;
 if exists(select 1 from public.kw_projects where id=nbc_id) then raise exception 'Shared NBC project visible to a non-staff account'; end if;
 if exists(select 1 from public.kw_nbc_activities) or exists(select 1 from public.kw_nbc_submissions) or exists(select 1 from public.kw_nbc_templates) then
   raise exception 'NBC data visible to a non-staff account';
 end if;
end$$;
select 'owner isolation, stale-write rejection, shared NBC read, cross-user write denial, legacy-table removal, non-staff NBC denial passed' as result;
rollback;
