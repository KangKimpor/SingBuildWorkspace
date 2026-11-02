-- Forward-only. Rewrites the remaining O(N^2) per-entry PL/pgSQL loop in operation='save'
-- inside kw_private.nbc_submission_write as set-based SQL. Preserves all exact validation
-- rules, error messages, and return shapes.
create or replace function kw_private.nbc_submission_write(operation text,payload jsonb,expected timestamptz default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  owner_id uuid; actor uuid:=auth.uid(); pid text:=payload->>'projectId'; h text:=payload->>'handler';
  week date:=(payload->>'weekStart')::date; current_week date:=date_trunc('week',clock_timestamp() at time zone 'Asia/Phnom_Penh')::date;
  stamp timestamptz:=clock_timestamp(); rid text; old public.kw_nbc_submissions; proposal jsonb;
  entries jsonb; seen jsonb:='{}'; previous_map jsonb:='{}'; s record; w date;
  overall numeric; previous numeric; contributions jsonb; row_result jsonb;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  owner_id=public.kw_nbc_owner();
  if owner_id is null or not exists(select 1 from public.kw_projects where user_id=owner_id and id=pid and data->>'nbcBp03'='true') then raise exception 'Company NBC project required'; end if;
  if h is null or h not in ('Sitha','Lychhinh','Chhorvaon','Srun','Kheng','Tola') then raise exception 'Invalid handler'; end if;
  if week is null or extract(isodow from week)<>1 or week not in(current_week,current_week-7) then raise exception 'Only this week and last week can be changed'; end if;
  if operation not in('save','confirm','reopen','delete','undo') or operation is null then raise exception 'Invalid operation'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text||'nbc-bp03',0));
  rid=pid||':'||week||':'||h;
  select * into old from public.kw_nbc_submissions where user_id=owner_id and id=rid for update;
  if operation='save' and ((old.id is not null and (expected is null or old.updated_at<>expected)) or (old.id is null and expected is not null)) then
    return jsonb_build_object('conflict',true,'row',case when old.id is null then null else to_jsonb(old) end);
  end if;
  if operation='save' then
    if old.data->>'status'='confirmed' then raise exception 'Reopen this confirmed update before editing'; end if;
    if jsonb_typeof(payload->'entries') is distinct from 'array' or jsonb_array_length(payload->'entries')>10000 or length(coalesce(payload->>'note',''))>4000 then raise exception 'Invalid draft'; end if;
    if exists(
      select 1 from jsonb_array_elements(payload->'entries') e
      left join public.kw_nbc_activities a on a.user_id=owner_id and a.id=e->>'activityId' and a.project_id=pid
      where a.id is not null and a.data->>'baselineResetAt' is not null
        and (nullif(e->>'baseRevision','') is null or (e->>'baseRevision')::timestamptz < (a.data->>'baselineResetAt')::timestamptz)
    ) then raise exception 'BP03 baseline was reset. Reload before updating progress'; end if;
    if exists(
      select 1 from jsonb_array_elements(payload->'entries') e
      left join public.kw_nbc_activities a on a.user_id=owner_id and a.id=e->>'activityId' and a.project_id=pid
      where a.id is null or a.data->>'editable'<>'true' or (a.data->>'handler'<>h and a.data->>'wbs'<>'GR&P')
    ) then raise exception 'Update only your activities or shared GR&P'; end if;
    if exists(
      select 1 from jsonb_array_elements(payload->'entries') e
      where jsonb_typeof(e->'progress') is distinct from 'number'
         or (e->>'progress')::numeric not between 0 and 1
         or jsonb_typeof(e->'remark') is distinct from 'string'
         or length(e->>'remark')>4000
    ) then raise exception 'Invalid progress or remark'; end if;
    if (select count(*) <> count(distinct e->>'activityId') from jsonb_array_elements(payload->'entries') e) then
      raise exception 'Duplicate activity';
    end if;
    select coalesce(jsonb_object_agg(e->>'activityId',e->'previous'),'{}'::jsonb) into previous_map from jsonb_array_elements(kw_private.nbc_applied(old.data)) e;
    select coalesce(jsonb_agg(jsonb_build_object(
      'activityId',a.id,
      'progress',x.elem->'progress',
      'remark',x.elem->>'remark',
      'previous',coalesce(previous_map->a.id,a.data->'progress'),
      'baseRevision',coalesce(x.elem->>'baseRevision','')
    ) order by x.ord),'[]'::jsonb) into entries
    from jsonb_array_elements(payload->'entries') with ordinality x(elem,ord)
    join public.kw_nbc_activities a on a.user_id=owner_id and a.id=x.elem->>'activityId' and a.project_id=pid;
    proposal=coalesce(old.data,'{}')||jsonb_build_object('id',rid,'projectId',pid,'weekStart',week,'handler',h,'status','draft',
      'confirmedAt',old.data->'confirmedAt','confirmedBy',old.data->'confirmedBy','late',coalesce(old.data->'late','false'::jsonb),'entries',entries,'note',coalesce(payload->>'note',''),'updatedAt',stamp);
    insert into public.kw_nbc_submissions(user_id,id,data,updated_at) values(owner_id,rid,proposal,stamp)
      on conflict(user_id,id) do update set data=excluded.data,updated_at=excluded.updated_at returning to_jsonb(kw_nbc_submissions.*) into row_result;
    return jsonb_build_object('conflict',false,'row',row_result);
  end if;
  if old.id is null then raise exception 'Update not found'; end if;

  create temp table if not exists nbc_chain(activity_id text primary key,progress jsonb,remark text) on commit drop;
  truncate pg_temp.nbc_chain;
  insert into pg_temp.nbc_chain(activity_id,progress,remark)
    select distinct on (x.elem->>'activityId') x.elem->>'activityId',x.elem->'previous',coalesce(x.elem->>'previousRemark','')
      from public.kw_nbc_submissions sb, lateral jsonb_array_elements(kw_private.nbc_applied(sb.data)) with ordinality x(elem,ord)
      where sb.user_id=owner_id and sb.project_id=pid and sb.week_start>=(current_week-7)::text
      order by x.elem->>'activityId',sb.week_start,sb.data->>'confirmedAt',sb.id,x.ord;

  proposal=old.data;
  if operation='confirm' then
    if proposal->>'status'<>'draft' then raise exception 'Already confirmed'; end if;
    entries=coalesce(proposal->'entries','[]'::jsonb);
    select coalesce(jsonb_object_agg(e->>'activityId',true),'{}'::jsonb) into seen from jsonb_array_elements(entries) e;
    select entries||coalesce(jsonb_agg(jsonb_build_object('activityId',a.id,'progress',a.data->'progress',
      'remark',coalesce(a.data->>'remark',''),'previous',a.data->'progress','baseRevision',coalesce(a.data->>'updatedAt',''))),'[]'::jsonb)
      into entries
      from public.kw_nbc_activities a where a.user_id=owner_id and a.project_id=pid
      and a.data->>'editable'='true' and a.data->>'handler'=h and coalesce(a.data->>'wbs','')<>'GR&P'
      and not (seen ? a.id);
    proposal=jsonb_set(proposal,'{entries}',entries);
    select coalesce(jsonb_object_agg(e->>'activityId',true),'{}'::jsonb) into seen from jsonb_array_elements(proposal->'entries') e;
    if exists(select 1 from public.kw_nbc_activities a where a.user_id=owner_id and a.project_id=pid and a.data->>'editable'='true' and a.data->>'handler'=h and a.data->>'wbs'<>'GR&P'
      and not (seen ? a.id)) then raise exception 'Assignments changed. Reload before confirming'; end if;
    if exists(select 1 from jsonb_array_elements(proposal->'entries') x(elem)
      left join public.kw_nbc_activities a on a.user_id=owner_id and a.id=x.elem->>'activityId' and a.project_id=pid
      where a.id is null or a.data->>'editable'<>'true' or (a.data->>'handler'<>h and a.data->>'wbs'<>'GR&P')) then raise exception 'Assignments changed. Reload before confirming'; end if;
    if exists(select 1 from jsonb_array_elements(proposal->'entries') x(elem)
      join public.kw_nbc_activities a on a.user_id=owner_id and a.id=x.elem->>'activityId' and a.project_id=pid
      where a.data->>'wbs'='GR&P' and coalesce(a.data->>'updatedAt','')<>coalesce(x.elem->>'baseRevision','')) then raise exception 'GR&P changed in another update. Reload it before confirming'; end if;
    insert into pg_temp.nbc_chain(activity_id,progress,remark)
      select a.id,a.data->'progress',a.data->>'remark'
        from jsonb_array_elements(proposal->'entries') x(elem)
        join public.kw_nbc_activities a on a.user_id=owner_id and a.id=x.elem->>'activityId' and a.project_id=pid
      on conflict (activity_id) do nothing;
    proposal=(proposal-'appliedEntries')||jsonb_build_object('status','confirmed','confirmedAt',stamp,'confirmedBy',actor,'late',stamp>=kw_private.nbc_deadline(week),'undoUntil',stamp+interval '10 seconds');
  elsif operation='reopen' then
    if proposal->>'status'<>'confirmed' then raise exception 'Only confirmed updates can be edited'; end if;
    select coalesce(jsonb_agg(e||jsonb_build_object('baseRevision',a.data->>'updatedAt')),'[]'::jsonb) into entries
      from jsonb_array_elements(proposal->'entries') e join public.kw_nbc_activities a on a.id=e->>'activityId' and a.user_id=owner_id and a.project_id=pid
      where a.data->>'handler'=h or a.data->>'wbs'='GR&P';
    proposal=proposal||jsonb_build_object('status','draft','appliedEntries',proposal->'entries','entries',entries,'undoUntil',null);
  elsif operation='undo' then
    if proposal->>'status'<>'confirmed' or proposal->>'confirmedBy'<>actor::text or stamp>(proposal->>'undoUntil')::timestamptz or proposal->>'undoUntil' is null then raise exception 'The undo window has expired'; end if;
    proposal=(proposal-'appliedEntries')||jsonb_build_object('status','draft','confirmedAt',null,'confirmedBy',null,'undoUntil',null);
  end if;
  if operation='delete' then delete from public.kw_nbc_submissions where user_id=owner_id and id=rid;
  else update public.kw_nbc_submissions set data=proposal||jsonb_build_object('updatedAt',stamp),updated_at=stamp where user_id=owner_id and id=rid; end if;

  for s in select * from public.kw_nbc_submissions where user_id=owner_id and project_id=pid and week_start>=(current_week-7)::text order by week_start,data->>'confirmedAt',id loop
    if s.data->>'status'='draft' then
      select coalesce(jsonb_agg(case when c.activity_id is not null then x.elem||jsonb_build_object('previous',c.progress) else x.elem end order by x.ord),'[]'::jsonb) into entries
        from jsonb_array_elements(s.data->'entries') with ordinality x(elem,ord) left join pg_temp.nbc_chain c on c.activity_id=x.elem->>'activityId';
      if entries is distinct from s.data->'entries' then
        s.data=jsonb_set(s.data,'{entries}',entries)||jsonb_build_object('updatedAt',stamp);
        update public.kw_nbc_submissions set data=s.data,updated_at=stamp where user_id=owner_id and id=s.id;
      end if;
    end if;
    select coalesce(jsonb_agg(case when c.activity_id is not null then x.elem||jsonb_build_object('previous',c.progress,'previousRemark',c.remark) else x.elem end order by x.ord),'[]'::jsonb) into entries
      from jsonb_array_elements(kw_private.nbc_applied(s.data)) with ordinality x(elem,ord) left join pg_temp.nbc_chain c on c.activity_id=x.elem->>'activityId';
    update pg_temp.nbc_chain c set progress=x.elem->'progress',remark=x.elem->>'remark'
      from jsonb_array_elements(kw_private.nbc_applied(s.data)) x(elem) where c.activity_id=x.elem->>'activityId';
    if entries is distinct from kw_private.nbc_applied(s.data) then
      update public.kw_nbc_submissions set data=jsonb_set(s.data,array[case when s.data->>'status'='confirmed' then 'entries' else 'appliedEntries' end],entries)||jsonb_build_object('updatedAt',stamp),updated_at=stamp where user_id=owner_id and id=s.id;
    end if;
  end loop;
  update public.kw_nbc_activities a set data=a.data||jsonb_build_object('progress',c.progress,'remark',c.remark)
    from pg_temp.nbc_chain c
    where a.user_id=owner_id and a.project_id=pid and a.data->>'editable'='true' and a.id=c.activity_id
      and (a.data->'progress',a.data->>'remark') is distinct from (c.progress,c.remark);
  if operation='undo' then
    select jsonb_agg(e||jsonb_build_object('baseRevision',a.data->>'updatedAt')) into entries from jsonb_array_elements(proposal->'entries') e
      join public.kw_nbc_activities a on a.id=e->>'activityId' and a.user_id=owner_id;
    update public.kw_nbc_submissions set data=jsonb_set(data,'{entries}',coalesce(entries,'[]')) where user_id=owner_id and id=rid;
  end if;

  foreach w in array array[current_week-7,current_week] loop
    with newer as (
      select distinct on (x.elem->>'activityId') x.elem->>'activityId' aid,x.elem->'previous' prev
        from public.kw_nbc_submissions sb, lateral jsonb_array_elements(kw_private.nbc_applied(sb.data)) x(elem)
        where sb.user_id=owner_id and sb.project_id=pid and sb.week_start>w::text
        order by x.elem->>'activityId',sb.week_start,sb.data->>'confirmedAt',sb.id
    ), this_week as (
      select distinct on (x.elem->>'activityId') x.elem->>'activityId' aid,x.elem->'previous' prev
        from public.kw_nbc_submissions sb, lateral jsonb_array_elements(kw_private.nbc_applied(sb.data)) x(elem)
        where sb.user_id=owner_id and sb.project_id=pid and sb.week_start=w::text
        order by x.elem->>'activityId',sb.data->>'confirmedAt',sb.id
    ), vals as (
      select (a.data->>'globalWeight')::numeric gw,
        case when n.aid is not null then (n.prev #>> '{}')::numeric else (a.data->>'progress')::numeric end v,
        case when t.aid is not null then (t.prev #>> '{}')::numeric
             when n.aid is not null then (n.prev #>> '{}')::numeric else (a.data->>'progress')::numeric end vb,
        case when a.data->>'wbs'='GR&P' then 'GR&P' else a.data->>'handler' end owner_key
      from public.kw_nbc_activities a
      left join newer n on n.aid=a.id left join this_week t on t.aid=a.id
      where a.user_id=owner_id and a.project_id=pid and a.data->>'editable'='true'
    )
    select (select coalesce(sum(gw*v),0) from vals),(select coalesce(sum(gw*vb),0) from vals),
      (select jsonb_object_agg(owner_key,contribution) from (select owner_key,sum(gw*v) contribution from vals group by owner_key) cc)
      into overall,previous,contributions;
    proposal=jsonb_build_object('id',pid||':'||w,'projectId',pid,'weekStart',w,'overall',overall,'previous',previous,'contributions',contributions,'updatedAt',stamp);
    insert into public.kw_nbc_summaries(user_id,id,data,updated_at) values(owner_id,pid||':'||w,proposal,stamp)
      on conflict(user_id,id) do update set data=excluded.data,updated_at=excluded.updated_at;
  end loop;
  select to_jsonb(t) into row_result from public.kw_nbc_submissions t where user_id=owner_id and id=rid;
  return jsonb_build_object('conflict',false,'row',row_result);
end $$;

create function public.kw_nbc_reassign_activities(p_project_id text,p_activity_ids jsonb,p_handler text,p_expected jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=auth.uid(); owner_id uuid; stamp timestamptz:=clock_timestamp(); changed integer; result jsonb;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  owner_id:=public.kw_nbc_owner();
  if owner_id is null or not exists(select 1 from public.kw_projects where user_id=owner_id and id=p_project_id and data->>'nbcBp03'='true') then raise exception 'Company NBC project required'; end if;
  if p_handler is null or (p_handler not in ('Sitha','Lychhinh','Chhorvaon','Srun','Kheng','Tola') and p_handler<>'') then raise exception 'Invalid handler'; end if;
  if jsonb_typeof(p_activity_ids) is distinct from 'array' or jsonb_array_length(p_activity_ids) not between 1 and 5000 or jsonb_typeof(p_expected) is distinct from 'object' then raise exception 'Invalid activity batch'; end if;
  if (select count(*)<>count(distinct value) from jsonb_array_elements_text(p_activity_ids)) then raise exception 'Duplicate activity'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text||p_project_id||'reassign',0));
  if exists(
    select 1 from jsonb_array_elements_text(p_activity_ids) ids(id)
    left join public.kw_nbc_activities a on a.user_id=owner_id and a.project_id=p_project_id and a.id=ids.id
    where a.id is null or a.data->>'editable'<>'true' or (p_handler='' and a.data->>'wbs'<>'GR&P')
  ) then raise exception 'Choose editable activities and a valid handler.'; end if;
  if exists(
    select 1 from jsonb_array_elements_text(p_activity_ids) ids(id)
    join public.kw_nbc_activities a on a.user_id=owner_id and a.project_id=p_project_id and a.id=ids.id
    where (p_expected->>ids.id) is null or a.updated_at<>(p_expected->>ids.id)::timestamptz
  ) then return jsonb_build_object('conflict',true); end if;
  with requested as (
    select ids.id, a.data from jsonb_array_elements_text(p_activity_ids) ids(id)
    join public.kw_nbc_activities a on a.user_id=owner_id and a.project_id=p_project_id and a.id=ids.id
  ), updated as (
    update public.kw_nbc_activities a set
      data=requested.data||jsonb_build_object(
        'handler',p_handler,'updatedAt',stamp,
        'history',coalesce(requested.data->'history','[]'::jsonb)||jsonb_build_array(jsonb_build_object(
          'id',gen_random_uuid()::text,'at',stamp,'editor',actor::text,
          'previous',requested.data->'progress','progress',requested.data->'progress',
          'remark',coalesce(requested.data->>'remark',''),'handler',p_handler
        ))
      ),
      updated_at=stamp
    from requested
    where a.user_id=owner_id and a.project_id=p_project_id and a.id=requested.id
      and a.updated_at=(p_expected->>requested.id)::timestamptz
    returning to_jsonb(a.*) as row_data
  ) select count(*)::integer,coalesce(jsonb_agg(updated.row_data),'[]'::jsonb) into changed,result from updated;
  if changed<>jsonb_array_length(p_activity_ids) then raise exception 'Activities changed in another session. Reload and try again.'; end if;
  return jsonb_build_object('conflict',false,'rows',result);
end $$;

revoke all on function public.kw_nbc_reassign_activities(text,jsonb,text,jsonb) from public,anon;
grant execute on function public.kw_nbc_reassign_activities(text,jsonb,text,jsonb) to authenticated;
