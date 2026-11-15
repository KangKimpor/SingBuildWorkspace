import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261115090000_material_tracker.sql'), 'utf8')

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

test.each(['kw_mat_access', 'kw_mat_load', 'kw_mat_set_cell', 'kw_mat_set_remark'])('%s is security definer with an empty search_path', (name) => {
  expect(sql).toMatch(new RegExp(`function public\\.${name}\\([^)]*\\)[^$]*?security definer[^$]*?set search_path=''`))
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
