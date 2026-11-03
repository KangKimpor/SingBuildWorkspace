"""Local-only: turns the private BP02 extract into staged-upload SQL and a guarded baseline-replacement transaction.

Usage: python scripts/nbc-bp02-baseline-sql.py [PRIVATE_DIRECTORY]
Reads initial.json and template.xlsx; writes sql/stage-NN.sql and sql/apply.sql. Never connects to a database.
"""
import base64
import hashlib
import json
from pathlib import Path
import sys

OWNER = '186f3ec0-587e-44a7-970f-29a92e70fe73'
root = Path(sys.argv[1] if len(sys.argv) > 1 else '.private/nbc-bp02')
dataset = json.loads((root / 'initial.json').read_text(encoding='utf-8'))
acts, rec = dataset['activities'], dataset['reconciliation']
template = (root / 'template.xlsx').read_bytes()
(root / 'sql').mkdir(exist_ok=True)


def quote(text, tag='j'):
    assert f'${tag}$' not in text
    return f'${tag}$' + text + f'${tag}$'


head = ('create schema if not exists kw_private;\n'
        'create table if not exists kw_private.nbc_bp02_stage(kind text not null, seq int not null, body text not null, primary key(kind,seq));\n'
        'alter table kw_private.nbc_bp02_stage enable row level security;\n')
chunks = []
for i in range(0, len(acts), 700):
    chunks.append(('acts', i // 700, json.dumps(acts[i:i + 700], ensure_ascii=False, separators=(',', ':'))))
b64 = base64.b64encode(template).decode()
for i in range(0, len(b64), 600000):
    chunks.append(('tpl', i // 600000, b64[i:i + 600000]))
files, current = [], head + 'delete from kw_private.nbc_bp02_stage;\n'
for kind, seq, body in chunks:
    statement = f"insert into kw_private.nbc_bp02_stage values('{kind}',{seq},{quote(body)});\n"
    if len(current) + len(statement) > 1_200_000:
        files.append(current)
        current = ''
    current += statement
files.append(current)
for i, text in enumerate(files):
    (root / 'sql' / f'stage-{i:02d}.sql').write_text(text, encoding='utf-8')

nodes = len(acts)
leaves = sum(1 for a in acts if a['editable'])
overall = rec['overall']
sha = hashlib.sha256(template).hexdigest()
apply_sql = f"""begin;
select set_config('request.jwt.claim.sub','{OWNER}',true);
do $apply$
declare owner uuid:='{OWNER}'; at timestamptz:=clock_timestamp(); stamp text:=to_char(at at time zone 'utc','YYYYMMDD_HH24MISS');
  payload jsonb; tpl text; overall numeric; contributions jsonb; h text; entries jsonb; total int; leaves int;
begin
  if not exists(select 1 from auth.users where id=owner) then raise exception 'Owner missing'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner::text||'nbc-bp03',0));
  if not exists(select 1 from public.kw_projects where user_id=owner and id='nbc-bp02' and data->>'nbcBp03'='true') then raise exception 'BP02 project missing'; end if;
  select jsonb_agg(e order by s.seq, ord) into payload from kw_private.nbc_bp02_stage s, jsonb_array_elements(s.body::jsonb) with ordinality t(e,ord) where s.kind='acts';
  select string_agg(body,'' order by seq) into tpl from kw_private.nbc_bp02_stage where kind='tpl';
  if jsonb_array_length(payload)<>{nodes} then raise exception 'Staged activity count mismatch'; end if;
  if encode(sha256(decode(tpl,'base64')),'hex')<>'{sha}' then raise exception 'Staged template mismatch'; end if;
  execute format('create table kw_private.%I as select * from public.kw_nbc_activities where project_id=%L','nbc_bp02_bk_activities_'||stamp,'nbc-bp02');
  execute format('create table kw_private.%I as select * from public.kw_nbc_submissions where project_id=%L','nbc_bp02_bk_submissions_'||stamp,'nbc-bp02');
  execute format('create table kw_private.%I as select * from public.kw_nbc_summaries where project_id=%L','nbc_bp02_bk_summaries_'||stamp,'nbc-bp02');
  execute format('create table kw_private.%I as select * from public.kw_nbc_templates where project_id=%L','nbc_bp02_bk_templates_'||stamp,'nbc-bp02');
  delete from public.kw_nbc_submissions where user_id=owner and project_id='nbc-bp02';
  delete from public.kw_nbc_summaries where user_id=owner and project_id='nbc-bp02';
  delete from public.kw_nbc_templates where project_id='nbc-bp02';
  delete from public.kw_nbc_activities where user_id=owner and project_id='nbc-bp02';
  insert into public.kw_nbc_activities(user_id,id,data,created_at,updated_at)
    select owner,a->>'id',a||jsonb_build_object('projectId','nbc-bp02'),at,at from jsonb_array_elements(payload) a;
  select count(*),count(*) filter (where (data->>'editable')::boolean) into total,leaves from public.kw_nbc_activities where user_id=owner and project_id='nbc-bp02';
  if total<>{nodes} or leaves<>{leaves} then raise exception 'Unexpected activity counts'; end if;
  if exists(select 1 from public.kw_nbc_activities a where a.user_id=owner and a.project_id='nbc-bp02' and
    ((a.data->>'editable')::boolean is distinct from not exists(select 1 from public.kw_nbc_activities c where c.user_id=owner and c.parent_id=a.id))) then raise exception 'Invalid WBS editable rule'; end if;
  select sum((data->>'globalWeight')::numeric*(data->>'progress')::numeric) into overall from public.kw_nbc_activities where user_id=owner and project_id='nbc-bp02' and (data->>'editable')::boolean;
  if abs(overall-{overall!r})>1e-9 then raise exception 'Overall mismatch %',overall; end if;
  insert into public.kw_nbc_templates(project_id,name,base64) values('nbc-bp02','NBC-BP02-Progress Tracking by BOQ.xlsx',tpl);
  contributions='{{}}'::jsonb;
  foreach h in array array['Sitha','Lychhinh','Chhorvaon','Srun','Kheng','Tola'] loop
    select coalesce(jsonb_agg(jsonb_build_object('activityId',id,'previous',(data->>'sourcePrevious')::numeric,'progress',(data->>'progress')::numeric,'remark','','previousRemark','','baseRevision',to_jsonb(at)) order by id),'[]'::jsonb)
      into entries from public.kw_nbc_activities where user_id=owner and project_id='nbc-bp02' and (data->>'editable')::boolean and data->>'handler'=h;
    if jsonb_array_length(entries)=0 then raise exception 'Handler % has no activities',h; end if;
    insert into public.kw_nbc_submissions(user_id,id,data,updated_at) values(owner,'nbc-bp02:2026-10-26:'||h,jsonb_build_object(
      'id','nbc-bp02:2026-10-26:'||h,'projectId','nbc-bp02','weekStart','2026-10-26','handler',h,'status','confirmed','entries',entries,
      'late',false,'note','Imported from the 25-31 October 2026 workbook.','updatedAt',to_jsonb(at),'confirmedAt',to_jsonb(at),'confirmedBy',owner,'undoUntil',to_jsonb(at+interval '10 seconds')),at);
    contributions=contributions||jsonb_build_object(h,(select sum((data->>'globalWeight')::numeric*(data->>'progress')::numeric) from public.kw_nbc_activities where user_id=owner and project_id='nbc-bp02' and (data->>'editable')::boolean and data->>'handler'=h));
  end loop;
  insert into public.kw_nbc_summaries(user_id,id,data,updated_at) values
    (owner,'nbc-bp02:2026-10-26',jsonb_build_object('id','nbc-bp02:2026-10-26','projectId','nbc-bp02','weekStart','2026-10-26','overall',overall,'previous',overall,'contributions',contributions,'updatedAt',to_jsonb(at)),at),
    (owner,'nbc-bp02:2026-11-02',jsonb_build_object('id','nbc-bp02:2026-11-02','projectId','nbc-bp02','weekStart','2026-11-02','overall',overall,'previous',overall,'contributions',contributions,'updatedAt',to_jsonb(at)),at);
  update public.kw_projects set data=data||jsonb_build_object('progress',overall),updated_at=clock_timestamp() where user_id=owner and id='nbc-bp02';
end $apply$;
commit;
"""
(root / 'sql' / 'apply.sql').write_text(apply_sql, encoding='utf-8')
print(len(files), 'stage files', [len(f) for f in files], 'nodes', nodes, 'leaves', leaves)
