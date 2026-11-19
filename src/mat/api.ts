import { initializeSupabase } from '@/lib/supabase'
import type { FieldKey, FieldValue, MatItem, Pkg, Team } from './types'

export interface MatRemark { itemId: string; team: Team; weekStart: string; body: string }
export interface MatPackage { week: string; now: string; items: MatItem[]; remarks: MatRemark[] }

type ItemRow = Omit<MatItem, 'package' | 'updatedAt' | 'changedWeek'> & { updated_at: string; changed_week: string | null }
type RemarkRow = { item_id: string; team: Team; week_start: string; body: string }

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const client = await initializeSupabase()
  if (!client) throw new Error('Sign in to continue.')
  const { data, error } = await client.rpc(name, args)
  if (error) throw new Error(error.message)
  return data as T
}

// False rather than an error for a signed-out visitor, so the page can simply not show itself.
export async function fetchAccess(): Promise<boolean> {
  const client = await initializeSupabase()
  if (!client) return false
  const { data, error } = await client.auth.getSession()
  if (error) throw new Error(error.message)
  if (!data.session) return false
  return (await rpc<boolean>('kw_mat_access', {})) === true
}

export async function fetchPackage(pkg: Pkg, itemsSince: string | null, remarksSince: string | null): Promise<MatPackage> {
  const data = await rpc<{ week: string; now: string; items: ItemRow[]; remarks: RemarkRow[] }>('kw_mat_load', {
    p_package: pkg, p_items_since: itemsSince, p_remarks_since: remarksSince,
  })
  return {
    week: data.week,
    now: data.now,
    items: data.items.map(({ updated_at, changed_week, ...row }) => ({ ...row, package: pkg, changedWeek: changed_week, updatedAt: updated_at })),
    remarks: data.remarks.map((r) => ({ itemId: r.item_id, team: r.team, weekStart: r.week_start, body: r.body })),
  }
}

// A null value removes the override, so the field falls back to its imported source.
export async function saveCell(id: string, cell: FieldKey, value: FieldValue): Promise<void> {
  await rpc('kw_mat_set_cell', { p_id: id, p_cell: cell, p_value: value })
}

// Updates multiple fields in `edits` atomically in one RPC; null removes that key's override.
export async function saveFields(id: string, patch: Partial<Record<FieldKey, FieldValue>>): Promise<void> {
  await rpc('kw_mat_set_fields', { p_id: id, p_patch: patch })
}

// The server files the remark under its own current week, which is returned.
export async function saveRemark(id: string, team: Team, body: string): Promise<{ week: string }> {
  const data = await rpc<{ week: string; updated_at: string }>('kw_mat_set_remark', { p_id: id, p_team: team, p_body: body })
  return { week: data.week }
}
