-- Forward-only. Confirm, Edit, Delete and Undo kept failing with 'This update changed in
-- another session': the writer compared the caller's expected version with updated_at, but
-- every confirmation re-chains all drafts in the two-week window and stamps a new updated_at
-- on rows the caller never touched. NBC rows are not live-subscribed, so the client cannot see
-- that bump and every attempt was rejected.
--
-- The compare-and-set only protects draft saves, where the caller sends entries and the writer
-- rebases them. The other operations act on the stored draft and send no content, so a version
-- bump from someone else's re-chain must not reject them. Every content guard below still runs.
create or replace function kw_private.nbc_submission_write(operation text,payload jsonb,expected timestamptz default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  owner_id uuid; actor uuid:=auth.uid(); pid text:=payload->>'projectId'; h text:=payload->>'handler';
  week date:=(payload->>'weekStart')::date; current_week date:=date_trunc('week',clock_timestamp() at time zone 'Asia/Phnom_Penh')::date;
  stamp timestamptz:=clock_timestamp(); rid text; old public.kw_nbc_submissions; proposal jsonb; entry jsonb; activity public.kw_nbc_activities;
  bases jsonb:='{}'; running jsonb; value jsonb; entries jsonb; s record; idx integer; w date; values_at_week jsonb; before_values jsonb;
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
  -- Compare-and-set protects draft saves only; see the note at the top of this migration.
  if operation='save' and ((old.id is not null and (expected is null or old.updated_at<>expected)) or (old.id is null and expected is not null)) then
    return jsonb_build_object('conflict',true,'row',case when old.id is null then null else to_jsonb(old) end);
  end if;
  if operation='save' then
    if old.data->>'status'='confirmed' then raise exception 'Reopen this confirmed update before editing'; end if;
    if jsonb_typeof(payload->'entries') is distinct from 'array' or jsonb_array_length(payload->'entries')>10000 or length(coalesce(payload->>'note',''))>4000 then raise exception 'Invalid draft'; end if;
    entries='[]';
    for entry in select * from jsonb_array_elements(payload->'entries') loop
      select * into activity from public.kw_nbc_activities where user_id=owner_id and id=entry->>'activityId' and project_id=pid;
      if activity.id is null or activity.data->>'editable'<>'true' or (activity.data->>'handler'<>h and activity.data->>'wbs'<>'GR&P') then raise exception 'Update only your activities or shared GR&P'; end if;
      if jsonb_typeof(entry->'progress') is distinct from 'number' or (entry->>'progress')::numeric not between 0 and 1 or jsonb_typeof(entry->'remark') is distinct from 'string' or length(entry->>'remark')>4000 then raise exception 'Invalid progress or remark'; end if;
      if exists(select 1 from jsonb_array_elements(entries) e where e->>'activityId'=entry->>'activityId') then raise exception 'Duplicate activity'; end if;
      entries=entries||jsonb_build_array(jsonb_build_object('activityId',activity.id,'progress',entry->'progress','remark',entry->>'remark',
        'previous',coalesce((select e->'previous' from jsonb_array_elements(kw_private.nbc_applied(old.data)) e where e->>'activityId'=activity.id),activity.data->'progress'),
        'baseRevision',coalesce(entry->>'baseRevision','')));
    end loop;
    proposal=coalesce(old.data,'{}')||jsonb_build_object('id',rid,'projectId',pid,'weekStart',week,'handler',h,'status','draft',
      'confirmedAt',old.data->'confirmedAt','confirmedBy',old.data->'confirmedBy','late',coalesce(old.data->'late','false'::jsonb),'entries',entries,'note',coalesce(payload->>'note',''),'updatedAt',stamp);
    insert into public.kw_nbc_submissions(user_id,id,data,updated_at) values(owner_id,rid,proposal,stamp)
      on conflict(user_id,id) do update set data=excluded.data,updated_at=excluded.updated_at returning to_jsonb(kw_nbc_submissions.*) into row_result;
    return jsonb_build_object('conflict',false,'row',row_result);
  end if;
  if old.id is null then raise exception 'Update not found'; end if;
  -- Capture the pre-operation base for every activity in the two-week editable chain.
  for s in select * from public.kw_nbc_submissions where user_id=owner_id and project_id=pid and week_start>=(current_week-7)::text
    order by week_start,data->>'confirmedAt',id loop
    for entry in select * from jsonb_array_elements(kw_private.nbc_applied(s.data)) loop
      if not bases ? (entry->>'activityId') then bases=jsonb_set(bases,array[entry->>'activityId'],jsonb_build_object('progress',entry->'previous','remark',coalesce(entry->>'previousRemark',''))); end if;
    end loop;
  end loop;
  proposal=old.data;
  if operation='confirm' then
    if proposal->>'status'<>'draft' then raise exception 'Already confirmed'; end if;
    -- Work assigned after this draft was saved joins as unchanged instead of dead-ending the confirmation.
    entries=coalesce(proposal->'entries','[]'::jsonb);
    for activity in select * from public.kw_nbc_activities a where a.user_id=owner_id and a.project_id=pid
        and a.data->>'editable'='true' and a.data->>'handler'=h and coalesce(a.data->>'wbs','')<>'GR&P'
        and not exists(select 1 from jsonb_array_elements(entries) e where e->>'activityId'=a.id) loop
      entries=entries||jsonb_build_array(jsonb_build_object('activityId',activity.id,'progress',activity.data->'progress',
        'remark',coalesce(activity.data->>'remark',''),'previous',activity.data->'progress','baseRevision',coalesce(activity.data->>'updatedAt','')));
    end loop;
    proposal=jsonb_set(proposal,'{entries}',entries);
    if exists(select 1 from public.kw_nbc_activities a where a.user_id=owner_id and a.project_id=pid and a.data->>'editable'='true' and a.data->>'handler'=h and a.data->>'wbs'<>'GR&P'
      and not exists(select 1 from jsonb_array_elements(proposal->'entries') e where e->>'activityId'=a.id)) then raise exception 'Assignments changed. Reload before confirming'; end if;
    for entry in select * from jsonb_array_elements(proposal->'entries') loop
      select * into activity from public.kw_nbc_activities where user_id=owner_id and id=entry->>'activityId' and project_id=pid;
      if activity.id is null or activity.data->>'editable'<>'true' or (activity.data->>'handler'<>h and activity.data->>'wbs'<>'GR&P') then raise exception 'Assignments changed. Reload before confirming'; end if;
      if activity.data->>'wbs'='GR&P' and coalesce(activity.data->>'updatedAt','')<>coalesce(entry->>'baseRevision','') then raise exception 'GR&P changed in another update. Reload it before confirming'; end if;
      if not bases ? activity.id then bases=jsonb_set(bases,array[activity.id],jsonb_build_object('progress',activity.data->'progress','remark',activity.data->>'remark')); end if;
    end loop;
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
  running=bases;
  -- Re-chain all affected submissions, including other handlers' shared GR&P entries.
  for s in select * from public.kw_nbc_submissions where user_id=owner_id and project_id=pid and week_start>=(current_week-7)::text order by week_start,data->>'confirmedAt',id loop
    if s.data->>'status'='draft' then
      entries=s.data->'entries'; idx=0;
      for entry in select * from jsonb_array_elements(entries) loop
        value=running->(entry->>'activityId');
        if value is not null then entries=jsonb_set(entries,array[idx::text],entry||jsonb_build_object('previous',value->'progress')); end if;
        idx=idx+1;
      end loop;
      if entries is distinct from s.data->'entries' then
        s.data=jsonb_set(s.data,'{entries}',entries)||jsonb_build_object('updatedAt',stamp);
        update public.kw_nbc_submissions set data=s.data,updated_at=stamp where user_id=owner_id and id=s.id;
      end if;
    end if;
    entries=kw_private.nbc_applied(s.data); idx=0;
    for entry in select * from jsonb_array_elements(entries) loop
      value=running->(entry->>'activityId');
      if value is not null then
        entries=jsonb_set(entries,array[idx::text],entry||jsonb_build_object('previous',value->'progress','previousRemark',value->>'remark'));
        running=jsonb_set(running,array[entry->>'activityId'],jsonb_build_object('progress',entry->'progress','remark',entry->>'remark'));
      end if;
      idx=idx+1;
    end loop;
    if entries is distinct from kw_private.nbc_applied(s.data) then
      update public.kw_nbc_submissions set data=jsonb_set(s.data,array[case when s.data->>'status'='confirmed' then 'entries' else 'appliedEntries' end],entries)||jsonb_build_object('updatedAt',stamp),updated_at=stamp where user_id=owner_id and id=s.id;
    end if;
  end loop;
  for activity in select * from public.kw_nbc_activities where user_id=owner_id and project_id=pid and data->>'editable'='true' loop
    value=running->activity.id;
    if value is not null and (activity.data->'progress',activity.data->>'remark') is distinct from(value->'progress',value->>'remark') then
      update public.kw_nbc_activities set data=data||value where user_id=owner_id and id=activity.id;
    end if;
  end loop;
  if operation='undo' then
    select jsonb_agg(e||jsonb_build_object('baseRevision',a.data->>'updatedAt')) into entries from jsonb_array_elements(proposal->'entries') e
      join public.kw_nbc_activities a on a.id=e->>'activityId' and a.user_id=owner_id;
    update public.kw_nbc_submissions set data=jsonb_set(data,'{entries}',coalesce(entries,'[]')) where user_id=owner_id and id=rid;
  end if;
  foreach w in array array[current_week-7,current_week] loop
    select jsonb_object_agg(id,data->'progress') into values_at_week from public.kw_nbc_activities where user_id=owner_id and project_id=pid and data->>'editable'='true';
    for s in select * from public.kw_nbc_submissions where user_id=owner_id and project_id=pid and week_start>w::text order by week_start desc,data->>'confirmedAt' desc,id desc loop
      for entry in select * from jsonb_array_elements(kw_private.nbc_applied(s.data)) loop values_at_week=jsonb_set(values_at_week,array[entry->>'activityId'],entry->'previous'); end loop;
    end loop;
    before_values=values_at_week;
    for s in select * from public.kw_nbc_submissions where user_id=owner_id and project_id=pid and week_start=w::text order by data->>'confirmedAt' desc,id desc loop
      for entry in select * from jsonb_array_elements(kw_private.nbc_applied(s.data)) loop before_values=jsonb_set(before_values,array[entry->>'activityId'],entry->'previous'); end loop;
    end loop;
    select coalesce(sum((data->>'globalWeight')::numeric*(values_at_week->>id)::numeric),0),coalesce(sum((data->>'globalWeight')::numeric*(before_values->>id)::numeric),0) into overall,previous
      from public.kw_nbc_activities where user_id=owner_id and project_id=pid and data->>'editable'='true';
    select jsonb_object_agg(handler,contribution) into contributions from (
      select case when data->>'wbs'='GR&P' then 'GR&P' else data->>'handler' end handler,sum((data->>'globalWeight')::numeric*(values_at_week->>id)::numeric) contribution
        from public.kw_nbc_activities where user_id=owner_id and project_id=pid and data->>'editable'='true' group by 1) c;
    proposal=jsonb_build_object('id',pid||':'||w,'projectId',pid,'weekStart',w,'overall',overall,'previous',previous,'contributions',contributions,'updatedAt',stamp);
    insert into public.kw_nbc_summaries(user_id,id,data,updated_at) values(owner_id,pid||':'||w,proposal,stamp)
      on conflict(user_id,id) do update set data=excluded.data,updated_at=excluded.updated_at;
  end loop;
  select to_jsonb(t) into row_result from public.kw_nbc_submissions t where user_id=owner_id and id=rid;
  return jsonb_build_object('conflict',false,'row',row_result);
end $$;
