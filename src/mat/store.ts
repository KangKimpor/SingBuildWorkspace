import { useCallback, useEffect, useRef, useState } from 'react'
import { addDays, reportingDate, weekStart } from '@/nbc/submissions'
import { fetchPackage, saveCell, saveFields, saveRemark } from './api'
import type { MatPackage } from './api'
import type { FieldKey, FieldValue, MatEdits, MatItem, Pkg, Team } from './types'

export const remarkKey = (itemId: string, team: Team, week: string) => `${itemId}:${team}:${week}`
export interface MatState { week: string; items: MatItem[]; remarks: Record<string, string>; syncedAt: string }
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const DB_NAME = 'kw-mat'
const DB_VERSION = 2
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
  try {
    const cached = await cache.read(pkg)
    return cached && typeof cached.syncedAt === 'string' && Array.isArray(cached.items) ? cached : null
  } catch {
    return null
  }
}
async function writeCache(pkg: Pkg, state: MatState) {
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
    const oldest = addDays(loaded.week, -7)
    remarks = Object.fromEntries(Object.entries(remarks).filter(([key]) => key.slice(key.lastIndexOf(':') + 1) >= oldest))
  }
  for (const r of loaded.remarks) remarks[remarkKey(r.itemId, r.team, r.weekStart)] = r.body
  return { week: loaded.week, items: mergeItems(base?.items ?? [], loaded.items), remarks, syncedAt: loaded.now }
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
      return { ...item, edits: edits as MatEdits }
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

  // Shows `apply` at once, then saves. On failure only this key goes back, and only while
  // no newer edit to the same key has replaced this one.
  const edit = useCallback(async <T,>(key: string, apply: (s: MatState) => MatState, restore: (s: MatState) => MatState, save: () => Promise<T>) => {
    const entry = { apply, ackedAt: null as number | null }
    pending.current.set(key, entry)
    commit(apply(loaded()))
    saves.current++
    setSaveStatus('saving')
    const finish = (failed: boolean) => {
      if (--saves.current === 0) setSaveStatus(failed ? 'error' : 'saved')
    }
    const stillMine = () => pending.current.get(key) === entry
    try {
      const result = await save()
      if (stillMine()) entry.ackedAt = fetches.current
      finish(false)
      return result
    } catch (e) {
      if (stillMine()) {
        pending.current.delete(key)
        commit(restore(loaded()))
      }
      finish(true)
      throw e
    } finally {
      if (live.current === pkg && current.current) void writeCache(pkg, current.current)
    }
  }, [pkg, commit, loaded])

  const setCell = useCallback(async (id: string, cell: FieldKey, value: FieldValue) => {
    const before = (loaded().items.find((i) => i.id === id)?.edits as Record<string, FieldValue | undefined> | undefined)?.[cell]
    await edit(`cell:${id}:${cell}`, (s) => withFields(s, id, { [cell]: value }), (s) => withFields(s, id, { [cell]: before }), () => saveCell(id, cell, value))
  }, [edit, loaded])

  const setFields = useCallback(async (id: string, patch: Partial<Record<FieldKey, FieldValue>>) => {
    const keys = Object.keys(patch) as FieldKey[]
    if (keys.length === 0) return
    const currentEdits = (loaded().items.find((i) => i.id === id)?.edits ?? {}) as Record<string, FieldValue | undefined>
    const before: Partial<Record<FieldKey, FieldValue | undefined>> = {}
    for (const k of keys) before[k] = currentEdits[k]
    await edit(`fields:${id}`, (s) => withFields(s, id, patch), (s) => withFields(s, id, before), () => saveFields(id, patch))
  }, [edit, loaded])

  const setRemark = useCallback(async (id: string, team: Team, body: string) => {
    const week = loaded().week
    const key = remarkKey(id, team, week)
    const before = loaded().remarks[key]
    const saved = await edit(`remark:${key}`, (s) => withRemark(s, key, body), (s) => withRemark(s, key, before), () => saveRemark(id, team, body))
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
