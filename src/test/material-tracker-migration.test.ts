import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261115021338_material_tracker.sql'), 'utf8')

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
