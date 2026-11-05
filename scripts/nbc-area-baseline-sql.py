"""Local-only: turns the private BP03 / BP04 area extract into staged-upload SQL and a guarded baseline-replacement transaction.

Usage: python scripts/nbc-area-baseline-sql.py nbc-bp03|nbc-bp04 [PRIVATE_DIRECTORY]
Reads initial.json and template.xlsx (written by scripts/nbc-bp03-rooms-extract.py); writes sql/stage-NN.sql and sql/apply.sql.
Never connects to a database. Run the stage files first, then apply.sql, with psql.

apply.sql, in one transaction: checks the owner and the project, checks the staged rows against the counts and the workbook's
overall figure, copies the project's current activities, submissions, summaries and template into kw_private.nbc_<id>_bk_*
tables (stamped with the time), replaces them with the staged dataset and one confirmed update per handler for the week of
2026-10-26, and rewrites the project's progress. Any failed check raises and rolls everything back.
"""
import base64
import hashlib
import json
from pathlib import Path
import sys

OWNER = '186f3ec0-587e-44a7-970f-29a92e70fe73'
WEEK = '2026-10-26'      # the workbook's reporting week (25-31 October 2026)
CURRENT_WEEK = '2026-11-02'  # the week the app is in now; its summary starts from the imported figure
HANDLERS = ['Sitha', 'Lychhinh', 'Chhorvaon', 'Srun', 'Kheng', 'Vuth', 'Tola']

project = sys.argv[1] if len(sys.argv) > 1 else ''
if project not in ('nbc-bp03', 'nbc-bp04'):
    raise SystemExit('Usage: python scripts/nbc-area-baseline-sql.py nbc-bp03|nbc-bp04 [PRIVATE_DIRECTORY]')
short = project.replace('-', '_')  # nbc_bp03
root = Path(sys.argv[2] if len(sys.argv) > 2 else f'.private/{project}-rooms')
dataset = json.loads((root / 'initial.json').read_text(encoding='utf-8'))
acts, rec = dataset['activities'], dataset['reconciliation']
template = (root / 'template.xlsx').read_bytes()
(root / 'sql').mkdir(exist_ok=True)
stage = f'kw_private.{short}_stage'
number = project[-2:]
name = f'NBC-BP{number}-Progress Tracking by BOQ.xlsx'

leaves = [a for a in acts if a['editable']]
overall = sum(a['globalWeight'] * a['progress'] for a in leaves)
assert abs(overall - rec['workbookOverall']) < 1e-9, (overall, rec['workbookOverall'])
assert {a['handler'] for a in leaves} == set(HANDLERS), {a['handler'] for a in leaves}
assert all('projectId' not in a for a in acts), 'projectId is added by apply.sql'
assert len(leaves) == rec['leaves'] and len(acts) == rec['nodes']


def quote(text, tag='j'):
    assert f'${tag}$' not in text
    return f'${tag}$' + text + f'${tag}$'


head = ('create schema if not exists kw_private;\n'
        f'create table if not exists {stage}(kind text not null, seq int not null, body text not null, primary key(kind,seq));\n'
        f'alter table {stage} enable row level security;\n')
chunks = []
for i in range(0, len(acts), 700):
    chunks.append(('acts', i // 700, json.dumps(acts[i:i + 700], ensure_ascii=False, separators=(',', ':'))))
b64 = base64.b64encode(template).decode()
for i in range(0, len(b64), 600000):
    chunks.append(('tpl', i // 600000, b64[i:i + 600000]))
files, current = [], head + f'delete from {stage};\n'
for kind, seq, body in chunks:
    statement = f"insert into {stage} values('{kind}',{seq},{quote(body)});\n"
    if len(current) + len(statement) > 1_200_000:
        files.append(current)
        current = ''
    current += statement
files.append(current)
for old in (root / 'sql').glob('stage-*.sql'):
    old.unlink()
for i, text in enumerate(files):
    (root / 'sql' / f'stage-{i:02d}.sql').write_text(text, encoding='utf-8')

nodes = len(acts)
sha = hashlib.sha256(template).hexdigest()
handler_list = ','.join(f"'{h}'" for h in HANDLERS)
apply_sql = f"""begin;
select set_config('request.jwt.claim.sub','{OWNER}',true);
do $apply$
declare owner uuid:='{OWNER}'; at timestamptz:=clock_timestamp(); stamp text:=to_char(at at time zone 'utc','YYYYMMDD_HH24MISS');
  payload jsonb; tpl text; overall numeric; contributions jsonb; h text; entries jsonb; total int; leaves int;
begin
  if not exists(select 1 from auth.users where id=owner) then raise exception 'Owner missing'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner::text||'nbc-bp03',0));
  if not exists(select 1 from public.kw_projects where user_id=owner and id='{project}' and data->>'nbcBp03'='true') then raise exception '{project} project missing'; end if;
  select jsonb_agg(e order by s.seq, ord) into payload from {stage} s, jsonb_array_elements(s.body::jsonb) with ordinality t(e,ord) where s.kind='acts';
  select string_agg(body,'' order by seq) into tpl from {stage} where kind='tpl';
  if payload is null or jsonb_array_length(payload)<>{nodes} then raise exception 'Staged activity count mismatch'; end if;
  if encode(sha256(decode(tpl,'base64')),'hex')<>'{sha}' then raise exception 'Staged template mismatch'; end if;
  execute format('create table kw_private.%I as select * from public.kw_nbc_activities where project_id=%L','{short}_bk_activities_'||stamp,'{project}');
  execute format('create table kw_private.%I as select * from public.kw_nbc_submissions where project_id=%L','{short}_bk_submissions_'||stamp,'{project}');
  execute format('create table kw_private.%I as select * from public.kw_nbc_summaries where project_id=%L','{short}_bk_summaries_'||stamp,'{project}');
  execute format('create table kw_private.%I as select * from public.kw_nbc_templates where project_id=%L','{short}_bk_templates_'||stamp,'{project}');
  delete from public.kw_nbc_submissions where user_id=owner and project_id='{project}';
  delete from public.kw_nbc_summaries where user_id=owner and project_id='{project}';
  delete from public.kw_nbc_templates where project_id='{project}';
  delete from public.kw_nbc_activities where user_id=owner and project_id='{project}';
  insert into public.kw_nbc_activities(user_id,id,data,created_at,updated_at)
    select owner,a->>'id',a||jsonb_build_object('projectId','{project}'),at,at from jsonb_array_elements(payload) a;
  select count(*),count(*) filter (where (data->>'editable')::boolean) into total,leaves from public.kw_nbc_activities where user_id=owner and project_id='{project}';
  if total<>{nodes} or leaves<>{len(leaves)} then raise exception 'Unexpected activity counts'; end if;
  if exists(select 1 from public.kw_nbc_activities a where a.user_id=owner and a.project_id='{project}' and
    ((a.data->>'editable')::boolean is distinct from not exists(select 1 from public.kw_nbc_activities c where c.user_id=owner and c.parent_id=a.id))) then raise exception 'Invalid WBS editable rule'; end if;
  if exists(select 1 from public.kw_nbc_activities a where a.user_id=owner and a.project_id='{project}' and (a.data->>'editable')::boolean and (a.data->>'room') is null) then raise exception 'Leaf without an area'; end if;
  select sum((data->>'globalWeight')::numeric*(data->>'progress')::numeric) into overall from public.kw_nbc_activities where user_id=owner and project_id='{project}' and (data->>'editable')::boolean;
  if abs(overall-{rec['workbookOverall']!r})>1e-9 then raise exception 'Overall mismatch %',overall; end if;
  insert into public.kw_nbc_templates(project_id,name,base64) values('{project}','{name}',tpl);
  contributions='{{}}'::jsonb;
  foreach h in array array[{handler_list}] loop
    select coalesce(jsonb_agg(jsonb_build_object('activityId',id,'previous',coalesce((data->>'sourcePrevious')::numeric,(data->>'progress')::numeric),'progress',(data->>'progress')::numeric,'remark','','previousRemark','','baseRevision',to_jsonb(at)) order by id),'[]'::jsonb)
      into entries from public.kw_nbc_activities where user_id=owner and project_id='{project}' and (data->>'editable')::boolean and data->>'handler'=h;
    if jsonb_array_length(entries)=0 then raise exception 'Handler % has no activities',h; end if;
    insert into public.kw_nbc_submissions(user_id,id,data,updated_at) values(owner,'{project}:{WEEK}:'||h,jsonb_build_object(
      'id','{project}:{WEEK}:'||h,'projectId','{project}','weekStart','{WEEK}','handler',h,'status','confirmed','entries',entries,
      'late',false,'note','Imported from the 25-31 October 2026 workbook.','updatedAt',to_jsonb(at),'confirmedAt',to_jsonb(at),'confirmedBy',owner,'undoUntil',to_jsonb(at+interval '10 seconds')),at);
    contributions=contributions||jsonb_build_object(h,(select sum((data->>'globalWeight')::numeric*(data->>'progress')::numeric) from public.kw_nbc_activities where user_id=owner and project_id='{project}' and (data->>'editable')::boolean and data->>'handler'=h));
  end loop;
  insert into public.kw_nbc_summaries(user_id,id,data,updated_at) values
    (owner,'{project}:{WEEK}',jsonb_build_object('id','{project}:{WEEK}','projectId','{project}','weekStart','{WEEK}','overall',overall,'previous',overall,'contributions',contributions,'updatedAt',to_jsonb(at)),at),
    (owner,'{project}:{CURRENT_WEEK}',jsonb_build_object('id','{project}:{CURRENT_WEEK}','projectId','{project}','weekStart','{CURRENT_WEEK}','overall',overall,'previous',overall,'contributions',contributions,'updatedAt',to_jsonb(at)),at);
  update public.kw_projects set data=data||jsonb_build_object('progress',overall),updated_at=clock_timestamp() where user_id=owner and id='{project}';
end $apply$;
commit;
"""
(root / 'sql' / 'apply.sql').write_text(apply_sql, encoding='utf-8')
print(len(files), 'stage files', [len(f) for f in files], 'nodes', nodes, 'leaves', len(leaves), 'overall', overall)
