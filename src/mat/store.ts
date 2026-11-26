import { useCallback, useEffect, useRef, useState } from 'react'
import { addDays, reportingDate, weekStart } from '@/nbc/submissions'
import { fetchPackage, saveCell, saveFields, saveRemark } from './api'
import type { MatPackage, MatSaved } from './api'
import { devDataset } from './devData'
import type { FieldKey, FieldValue, MatEdits, MatItem, MatLog, Pkg, Team } from './types'

export const remarkKey = (itemId: string, team: Team, week: string) => `${itemId}:${team}:${week}`
export interface MatState {
  week: string
  items: MatItem[]
  remarks: Record<string, string>
  syncedAt: string
  /** Who last wrote each remark, by remark key (D-58). */
  remarkBy: Record<string, string>
  /** Recent activity, newest first (at most LOG_LIMIT entries). */
  log: MatLog[]
  /** Display names by user id. */
  people: Record<string, string>
}
const LOG_LIMIT = 300
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const DB_NAME = 'kw-mat'
// 4: items carry weekEdits. 5: state carries the activity log, names and remark authors (D-58).
// Older caches are dropped so every row reloads with them.
const DB_VERSION = 6
const STORE = 'packages'
// A write that starts just before a load can commit just after it. Asking again for this
// overlap catches it; merging by id and by remark key makes the repeated rows harmless.
const DELTA_OVERLAP_MS = 10_000
const HIDDEN_REFRESH_MS = 5 * 60_000

function request<T>(req: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  const open = indexedDB.open(DB_NAME, DB_VERSION)
  open.onupgradeneeded = (e) => {
    const db = open.result
    if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    else if (e.oldVersion < DB_VERSION) open.transaction?.objectStore(STORE).clear()
  }
  const db = await request(open)
  try {
    return await request(run(db.transaction(STORE, mode).objectStore(STORE)))
  } finally {
    db.close()
  }
}

// One MatState per package. Exported as an object so tests can replace it; without IndexedDB
// (or on any failure) the page behaves as if nothing was cached.
export const cache = {
  async read(pkg: Pkg): Promise<MatState | null> {
    try {
      return (await withStore('readonly', (s) => s.get(pkg) as IDBRequest<MatState | undefined>)) ?? null
    } catch {
      return null
    }
  },
  async write(pkg: Pkg, state: MatState): Promise<void> {
    try {
      await withStore('readwrite', (s) => s.put(state, pkg))
    } catch {
      // Saving to the server never depends on the cache.
    }
  },
}
async function readCache(pkg: Pkg) {
  if (devDataset()) return null
  try {
    const cached = await cache.read(pkg)
    return cached && typeof cached.syncedAt === 'string' && Array.isArray(cached.items) ? cached : null
  } catch {
    return null
  }
}
async function writeCache(pkg: Pkg, state: MatState) {
  if (devDataset()) return
  try {
    await cache.write(pkg, state)
  } catch {
    // As above.
  }
}

function overlapSince(syncedAt: string) {
  const at = Date.parse(syncedAt)
  return Number.isFinite(at) ? new Date(at - DELTA_OVERLAP_MS).toISOString() : null
}
function mergeItems(items: MatItem[], changed: MatItem[]) {
  const byId = new Map(items.map((i) => [i.id, i]))
  for (const i of changed) byId.set(i.id, i)
  return [...byId.values()].sort((a, b) => (a.sheet < b.sheet ? -1 : a.sheet > b.sheet ? 1 : a.pos - b.pos))
}
function applyLoad(base: MatState | null, loaded: MatPackage): MatState {
  let remarks = { ...base?.remarks }
  if (base && base.week !== loaded.week) {
    const oldest = addDays(loaded.week, -14)
    remarks = Object.fromEntries(Object.entries(remarks).filter(([key]) => key.slice(key.lastIndexOf(':') + 1) >= oldest))
  }
  let remarkBy = { ...base?.remarkBy }
  if (base && base.week !== loaded.week) remarkBy = Object.fromEntries(Object.entries(remarkBy).filter(([key]) => key in remarks))
  for (const r of loaded.remarks) {
    const key = remarkKey(r.itemId, r.team, r.weekStart)
    remarks[key] = r.body
    if (r.updatedBy) remarkBy[key] = r.updatedBy
  }
  return {
    week: loaded.week, items: mergeItems(base?.items ?? [], loaded.items), remarks, syncedAt: loaded.now,
    remarkBy, log: mergeLog(base?.log ?? [], loaded.log ?? []), people: { ...base?.people, ...loaded.people },
  }
}
function mergeLog(log: MatLog[], more: MatLog[]) {
  if (!more.length) return log
  const byId = new Map(log.map((l) => [l.id, l]))
  for (const l of more) byId.set(l.id, l)
  return [...byId.values()].sort((a, b) => b.at.localeCompare(a.at) || b.id - a.id).slice(0, LOG_LIMIT)
}
/** Folds what a save returned into the state: its activity row, the writer's name, and who now last edited the row or remark. */
function withSaved(state: MatState, saved: MatSaved | undefined, remark?: string): MatState {
  const log = saved?.log
  if (!log) return state
  const people = log.by && saved.byName ? { ...state.people, [log.by]: saved.byName } : state.people
  return {
    ...state,
    log: mergeLog(state.log, [log]),
    people,
    remarkBy: remark && log.by ? { ...state.remarkBy, [remark]: log.by } : state.remarkBy,
    items: state.items.map((item) => item.id === log.itemId ? { ...item, updatedBy: log.by, updatedAt: log.at } : item),
  }
}
function withFields(state: MatState, id: string, patch: Partial<Record<FieldKey, FieldValue | undefined>>): MatState {
  return {
    ...state,
    items: state.items.map((item) => {
      if (item.id !== id) return item
      const edits: Record<string, number | string | string[] | undefined> = { ...item.edits }
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === undefined) delete edits[key]
        else edits[key] = value
      }
      // As on the server: the first edit of a week keeps the edits it replaces as that week's baseline.
      const weekEdits = item.changedWeek === state.week ? item.weekEdits : item.edits
      return { ...item, edits: edits as MatEdits, changedWeek: state.week, weekEdits, updatedAt: new Date().toISOString() }
    }),
  }
}
function withRemark(state: MatState, key: string, body: string | undefined): MatState {
  const remarks = { ...state.remarks }
  if (body === undefined) delete remarks[key]
  else remarks[key] = body
  return { ...state, remarks }
}

export function useMat(pkg: Pkg) {
  const [state, setState] = useState<MatState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  // The latest state, read by async code without waiting for a render.
  const current = useRef<MatState | null>(null)
  const live = useRef(pkg)
  // Optimistic writes by cell or remark, applied again over every load so that a load which
  // started before a save committed cannot put the old value back on screen. An entry is
  // dropped once a load that started after its save was acknowledged (`ackedAt`) has landed.
  const pending = useRef(new Map<string, { apply: (s: MatState) => MatState; ackedAt: number | null }>())
  const fetches = useRef(0)
  const loads = useRef(0)
  const saves = useRef(0)

  const commit = useCallback((next: MatState) => {
    current.current = next
    setState(next)
  }, [])

  const refresh = useCallback(async () => {
    const stale = () => live.current !== pkg
    loads.current++
    setLoading(true)
    try {
      if (!current.current) {
        const cached = await readCache(pkg)
        if (stale()) return
        if (cached && !current.current) commit(cached)
      }
      const base = current.current
      const since = base ? overlapSince(base.syncedAt) : null
      const seq = ++fetches.current
      const loaded = await fetchPackage(pkg, since, base?.week === weekStart(reportingDate()) ? since : null)
      if (stale()) return
      let next = applyLoad(current.current, loaded)
      for (const [key, entry] of pending.current) {
        if (entry.ackedAt !== null && seq > entry.ackedAt) pending.current.delete(key)
        else next = entry.apply(next)
      }
      commit(next)
      setError(null)
      void writeCache(pkg, next)
    } catch (e) {
      if (!stale()) setError(e instanceof Error ? e.message : 'Could not load the material list.')
    } finally {
      if (--loads.current === 0) setLoading(false)
    }
  }, [pkg, commit])

  const loaded = useCallback(() => {
    if (!current.current) throw new Error('The material list has not loaded yet.')
    return current.current
  }, [])

  // Writes to one row reach the server in the order they were made: an Undo right after an edit
  // must not commit before it. Writes to different rows still run side by side.
  const queues = useRef(new Map<string, Promise<unknown>>())
  const inOrder = useCallback(<T,>(id: string, run: () => Promise<T>): Promise<T> => {
    const prev = queues.current.get(id)
    // Nothing in flight for this row: start now, so the request leaves in the same tick as the click.
    const next = prev ? prev.catch(() => undefined).then(run) : run()
    queues.current.set(id, next)
    void next.catch(() => undefined).finally(() => { if (queues.current.get(id) === next) queues.current.delete(id) })
    return next
  }, [])

  // Shows every part at once, then saves. Each part has its own pending key (one per field or
  // remark), so a newer edit to another field of the same row never hides this one from a reload.
  // On failure only the parts no newer edit has replaced go back, and the package reloads so the
  // screen settles on what the server holds.
  const edit = useCallback(async <T,>(id: string, parts: { key: string; apply: (s: MatState) => MatState; restore: (s: MatState) => MatState }[], save: () => Promise<T>) => {
    const entries = parts.map((part) => {
      const entry = { apply: part.apply, ackedAt: null as number | null }
      pending.current.set(part.key, entry)
      return { ...part, entry }
    })
    commit(parts.reduce((s, part) => part.apply(s), loaded()))
    saves.current++
    setSaveStatus('saving')
    const finish = (failed: boolean) => {
      if (--saves.current === 0) setSaveStatus(failed ? 'error' : 'saved')
    }
    const mine = (e: (typeof entries)[number]) => pending.current.get(e.key) === e.entry
    try {
      const result = await inOrder(id, save)
      for (const e of entries) if (mine(e)) e.entry.ackedAt = fetches.current
      finish(false)
      return result
    } catch (err) {
      let next = loaded(), restored = false
      for (const e of entries) if (mine(e)) { pending.current.delete(e.key); next = e.restore(next); restored = true }
      if (restored) commit(next)
      finish(true)
      void refresh()
      throw err
    } finally {
      if (live.current === pkg && current.current) void writeCache(pkg, current.current)
    }
  }, [pkg, commit, loaded, inOrder, refresh])

  const fieldPart = useCallback((id: string, key: FieldKey, value: FieldValue | undefined, before: FieldValue | undefined) => ({
    key: `cell:${id}:${key}`,
    apply: (s: MatState) => withFields(s, id, { [key]: value }),
    restore: (s: MatState) => withFields(s, id, { [key]: before }),
  }), [])
  const editsOf = useCallback((id: string) => (loaded().items.find((i) => i.id === id)?.edits ?? {}) as Record<string, FieldValue | undefined>, [loaded])

  const setCell = useCallback(async (id: string, cell: FieldKey, value: FieldValue) => {
    const saved = await edit(id, [fieldPart(id, cell, value, editsOf(id)[cell])], () => saveCell(id, cell, value))
    if (saved?.log) commit(withSaved(loaded(), saved))
  }, [edit, fieldPart, editsOf, commit, loaded])

  const setFields = useCallback(async (id: string, patch: Partial<Record<FieldKey, FieldValue>>) => {
    const keys = Object.keys(patch) as FieldKey[]
    if (keys.length === 0) return
    const edits = editsOf(id)
    const saved = await edit(id, keys.map((k) => fieldPart(id, k, patch[k], edits[k])), () => saveFields(id, patch))
    if (saved?.log) commit(withSaved(loaded(), saved))
  }, [edit, fieldPart, editsOf, commit, loaded])

  const setRemark = useCallback(async (id: string, team: Team, body: string) => {
    const week = loaded().week
    const key = remarkKey(id, team, week)
    const before = loaded().remarks[key]
    const saved = await edit(id, [{ key: `remark:${key}`, apply: (s) => withRemark(s, key, body), restore: (s) => withRemark(s, key, before) }], () => saveRemark(id, team, body))
    if (saved?.log) commit(withSaved(loaded(), saved, key))
    if (saved.week !== week) {
      // The server filed it under its new week: take the copy off the old week and reload.
      commit(withRemark(loaded(), key, before))
      await refresh()
    }
  }, [edit, loaded, commit, refresh])

  useEffect(() => {
    live.current = pkg
    current.current = null
    pending.current.clear()
    setState(null)
    void refresh()
  }, [pkg, refresh])

  useEffect(() => {
    let hiddenAt: number | null = null
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
        return
      }
      if (hiddenAt !== null && Date.now() - hiddenAt > HIDDEN_REFRESH_MS) void refresh()
      hiddenAt = null
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [refresh])

  return { state, loading, error, saveStatus, refresh, setCell, setFields, setRemark }
}
