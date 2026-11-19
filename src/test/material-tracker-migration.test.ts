import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261115021338_material_tracker.sql'), 'utf8')
const editSql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261119043547_material_tracker_editing.sql'), 'utf8')

test('creates both tracker tables with row level security', () => {
  expect(sql).toContain('create table public.kw_mat_items')
  expect(sql).toContain('create table public.kw_mat_remarks')
  expect(sql).toContain('alter table public.kw_mat_items enable row level security')
  expect(sql).toContain('alter table public.kw_mat_remarks enable row level security')
})

test('seeds exactly the two allowed accounts', () => {
  expect(sql).toContain("'kimpor.kang@singbuild.com'")
  expect(sql).toContain("'soklim.sim@singbuild.com'")
})

test('uses the Sunday week key in Phnom Penh time', () => {
  expect(sql).toContain("(date_trunc('week',(clock_timestamp() at time zone 'Asia/Phnom_Penh')+interval '1 day')::date-1)")
})

test.each(['access', 'load', 'set_cell', 'set_remark'])('kw_mat_%s is an invoker wrapper over a private definer body', (name) => {
  expect(sql).toMatch(new RegExp(`create function kw_private\\.mat_${name}\\([^)]*\\)[^$]*?security definer[^$]*?set search_path=''`))
  expect(sql).toMatch(new RegExp(`create function public\\.kw_mat_${name}\\([^)]*\\)[^$]*?security invoker[^$]*?set search_path=''[^$]*\\$\\$\\s*select kw_private\\.mat_${name}\\(`))
  expect(sql).not.toMatch(new RegExp(`create function public\\.kw_mat_${name}\\([^)]*\\)[^$]*?security definer`))
})

test('only the definer bodies can read the week key', () => {
  expect(sql).toContain('revoke all on function kw_private.mat_week() from public, anon, authenticated')
  expect(sql).not.toMatch(/grant [^;]*kw_private\.mat_week/)
})

test('remarks can be written only on item rows', () => {
  const body = sql.match(/create function kw_private\.mat_set_remark\([\s\S]*?end \$\$;/)?.[0] ?? ''
  expect(body).toMatch(/from public\.kw_mat_items where id = p_id and kind = 'item'\)[\s\S]*?'Item not found'/)
})

test('revokes direct writes on both tables', () => {
  expect(sql).toMatch(/revoke insert[^;]*public\.kw_mat_items/)
  expect(sql).toMatch(/revoke insert[^;]*public\.kw_mat_remarks/)
})

test('stays apart from the workspace sync and runs no background work', () => {
  expect(sql).not.toContain('kw_workspace_write')
  expect(sql).not.toMatch(/realtime/i)
  expect(sql).not.toMatch(/cron/i)
})

test('editing migration hides COMMONLY MATERIALS USES without deleting rows and excludes hidden rows in mat_load', () => {
  expect(editSql).toContain('add column if not exists hidden boolean not null default false')
  expect(editSql).toContain("'COMMONLY MATERIALS USES'")
  expect(editSql).toContain('and not i.hidden')
  expect(editSql).toContain('and not hidden')
  expect(editSql).not.toMatch(/\bdelete\s+from\b/i)
})

test('editing migration adds kw_private.mat_valid_field, updates mat_set_cell, and exposes kw_mat_set_fields via invoker wrapper', () => {
  expect(editSql).toMatch(/create function kw_private\.mat_valid_field\(p_key text, p_value jsonb\) returns boolean/)
  expect(editSql).toContain('revoke all on function kw_private.mat_valid_field(text, jsonb) from public, anon, authenticated')
  expect(editSql).toMatch(/create or replace function kw_private\.mat_set_cell\([^)]*\)[^$]*?security definer set search_path=''/)
  expect(editSql).toMatch(/create function kw_private\.mat_set_fields\(p_id text, p_patch jsonb\)[^$]*?security definer set search_path=''/)
  expect(editSql).toMatch(/create function public\.kw_mat_set_fields\(p_id text, p_patch jsonb\)[^$]*?security invoker set search_path=''[^$]*?\$\$\s*select kw_private\.mat_set_fields\(p_id, p_patch\)/)
  expect(editSql).toContain('revoke all on function public.kw_mat_set_fields(text, jsonb) from public, anon')
  expect(editSql).toContain('grant execute on function public.kw_mat_set_fields(text, jsonb) to authenticated')
})

test('editing migration creates private kw-mat-images bucket gated by kw_mat_access()', () => {
  expect(editSql).toContain("values ('kw-mat-images', 'kw-mat-images', false, 5242880")
  for (const op of ['select', 'insert', 'update', 'delete']) {
    expect(editSql).toMatch(new RegExp(`create policy kw_mat_images_${op} on storage\\.objects[\\s\\S]*?bucket_id = 'kw-mat-images' and \\(select public\\.kw_mat_access\\(\\)\\)`))
  }
})
