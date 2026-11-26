import { initializeSupabase } from '@/lib/supabase'
import { devDataset } from './devData'
import type { FieldKey, FieldValue, MatItem, MatLog, Pkg, Team } from './types'

export interface MatRemark { itemId: string; team: Team; weekStart: string; body: string; updatedBy?: string | null }
/** `log` and `people` (user id to display name) come from the activity migration (D-58); an older server sends neither. */
export interface MatPackage { week: string; now: string; items: MatItem[]; remarks: MatRemark[]; log: MatLog[]; people: Record<string, string> }
/** What a save returns: the activity row it wrote and the writer's name, when the server keeps a log. */
export interface MatSaved { log?: MatLog; byName?: string | null }

type ItemRow = Omit<MatItem, 'package' | 'updatedAt' | 'changedWeek' | 'weekEdits' | 'updatedBy'>
  & { updated_at: string; changed_week: string | null; week_edits?: MatItem['weekEdits']; updated_by?: string | null }
type RemarkRow = { item_id: string; team: Team; week_start: string; body: string; updated_by?: string | null }
type LogRow = { id: number; item_id: string; at: string; by: string | null; by_name?: string | null; kind: MatLog['kind']; detail: Record<string, unknown> }
const toLog = (r: LogRow): MatLog => ({ id: r.id, itemId: r.item_id, at: r.at, by: r.by, kind: r.kind, detail: r.detail ?? {} })
const toSaved = (data: { log?: LogRow } | null | undefined): MatSaved => data?.log ? { log: toLog(data.log), byName: data.log.by_name ?? null } : {}

/** In the dev datasets nothing is saved; this stands in for the server's log row so the activity views show something. */
let devLogId = 0
const devSaved = (itemId: string, kind: MatLog['kind'], detail: Record<string, unknown>): MatSaved =>
  ({ log: { id: 1e9 + ++devLogId, itemId, at: new Date().toISOString(), by: 'dev-you', kind, detail }, byName: 'You' })

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const client = await initializeSupabase()
  if (!client) throw new Error('Sign in to continue.')
  const { data, error } = await client.rpc(name, args)
  if (error) throw new Error(error.message)
  return data as T
}

// False rather than an error for a signed-out visitor, so the page can simply not show itself.
export async function fetchAccess(): Promise<boolean> {
  if (devDataset()) return true
  const client = await initializeSupabase()
  if (!client) return false
  const { data, error } = await client.auth.getSession()
  if (error) throw new Error(error.message)
  if (!data.session) return false
  return (await rpc<boolean>('kw_mat_access', {})) === true
}

export async function fetchPackage(pkg: Pkg, itemsSince: string | null, remarksSince: string | null): Promise<MatPackage> {
  // The literal DEV check lets the production build drop the fixtures chunk entirely.
  const dataset = import.meta.env.DEV ? devDataset() : null
  if (import.meta.env.DEV && dataset) return (await import('./fixtures')).fixturePackage(dataset, pkg)
  const data = await rpc<{ week: string; now: string; items: ItemRow[]; remarks: RemarkRow[]; log?: LogRow[]; people?: Record<string, string> }>('kw_mat_load', {
    p_package: pkg, p_items_since: itemsSince, p_remarks_since: remarksSince,
  })
  return {
    week: data.week,
    now: data.now,
    items: data.items.map(({ updated_at, changed_week, week_edits, updated_by, ...row }) => ({
      ...row, package: pkg, changedWeek: changed_week, weekEdits: week_edits ?? null, updatedAt: updated_at, updatedBy: updated_by ?? null,
    })),
    remarks: data.remarks.map((r) => ({ itemId: r.item_id, team: r.team, weekStart: r.week_start, body: r.body, updatedBy: r.updated_by ?? null })),
    log: (data.log ?? []).map(toLog),
    people: data.people ?? {},
  }
}

// A null value removes the override, so the field falls back to its imported source.
export async function saveCell(id: string, cell: FieldKey, value: FieldValue): Promise<MatSaved> {
  if (devDataset()) return devSaved(id, 'fields', { [cell]: value })
  return toSaved(await rpc<{ log?: LogRow }>('kw_mat_set_cell', { p_id: id, p_cell: cell, p_value: value }))
}

// Updates multiple fields in `edits` atomically in one RPC; null removes that key's override.
export async function saveFields(id: string, patch: Partial<Record<FieldKey, FieldValue>>): Promise<MatSaved> {
  if (devDataset()) return devSaved(id, 'fields', patch)
  return toSaved(await rpc<{ log?: LogRow }>('kw_mat_set_fields', { p_id: id, p_patch: patch }))
}

// The server files the remark under its own current week, which is returned.
export async function saveRemark(id: string, team: Team, body: string): Promise<{ week: string } & MatSaved> {
  if (import.meta.env.DEV && devDataset()) return { week: (await import('./fixtures')).fixturePackage('empty', 'bp03').week, ...devSaved(id, 'remark', { team, body: body.slice(0, 160) }) }
  const data = await rpc<{ week: string; updated_at: string; log?: LogRow }>('kw_mat_set_remark', { p_id: id, p_team: team, p_body: body })
  return { week: data.week, ...toSaved(data) }
}
