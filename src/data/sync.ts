import { create } from 'zustand'
import { normalizeActivity } from '@/nbc/normalize'
import type { RealtimeChannel, Session } from '@supabase/supabase-js'
import { supabase, initializeSupabase, hasStoredSession } from '@/lib/supabase'
import { useWorkspaceUI } from '@/shell/workspace'
import { contentFields, contentOf, emptyContent, useWorkspace } from './index'
import { collections, db, purgedRows } from './persistence'
import type { Collection, Content, Pending } from './persistence'
import type { WorkspacePage } from './types'
import { syncWorkspaceFiles } from './files'
import { changedFields, rebaseWrite } from './sync-merge'
import { allowedEmail, DOMAIN_ERROR } from '@/lib/emailDomain'

export const useAccount = create<{
  session: Session | null; ready: boolean; error: string; recovering: boolean
}>(() => ({ session: null, ready: false, error: '', recovering: false }))
type Data = Record<string, unknown>
type CloudCollection = Collection | 'profiles'
type Write = Pending & { original: Data }
type Row = { id: string; data: Data; updated_at: string }
const pending = new Map<string, Write>()
const versions = new Map<string, string>()
const EPOCH = '1970-01-01T00:00:00+00:00'
const FULL_RECONCILE_MS = 14 * 24 * 60 * 60 * 1000
// Rows deleted on the server never reach a device that only pulls newer rows. A snapshot whose last full read is older than this
// reads everything once more: the BP02 Weekly 63 migration (12 Nov 2026) deleted 134 activities.
const RECONCILE_AFTER = Date.parse('2026-11-12T05:30:00Z')
const SNAPSHOT_DELAY_MS = 1200
/**
 * Collections large enough that a full reconcile should read only a small
 * `id,updated_at` manifest and then fetch the rows that actually changed.
 */
const MANIFEST_COLLECTIONS = new Set<CloudCollection>([
  'pages',
  'tasks',
  'nbc_activities',
  'nbc_submissions',
])
const MANIFEST_BATCH_SIZE = 150
let applying = false, generation = 0, initialized = false, hydrated = false
let activeRun: Promise<void> | undefined
let realtime: RealtimeChannel | undefined
let retryTimer: ReturnType<typeof setTimeout> | undefined
let snapshotTimer: ReturnType<typeof setTimeout> | undefined
let retry = 0, refreshRequested = false, refreshFull = false, live = false, wasLive = false
// Incremental pulls resume from the newest row already seen in each collection. A
// snapshot with no watermarks predates delta sync and gets one full reconcile.
let watermarks = new Map<CloudCollection, string>()
function advanceWatermark(collection: CloudCollection, stamp: string | undefined) {
  if (!stamp) return
  const current = watermarks.get(collection)
  const next = laterStamp(current, stamp)
  if (next) watermarks.set(collection, next)
}
let lastFullPull = 0
let cloudInitialization: Promise<void> | undefined
/**
 * Set while an account switch reads its IndexedDB snapshot. A sync started in that window (a
 * TOKEN_REFRESHED emitted during getSession after an idle hour, for example) would see no
 * watermarks and an empty store and pull every row cold, so it waits for the restore instead.
 */
let restoring: Promise<void> | undefined
const tabId = (() => {
  if (typeof navigator !== 'undefined' && navigator.locks) return crypto.randomUUID()
  try {
    const id = sessionStorage.getItem('kw-sync-tab') || crypto.randomUUID()
    sessionStorage.setItem('kw-sync-tab', id)
    return id
  } catch { return crypto.randomUUID() }
})()
const keyFor = (scope: string, collection: CloudCollection, id: string) => `${scope}:${collection}:${id}`
const recoveryKey = (scope: string) => `kw-cloud-pending:${scope}:${tabId}`
/** Journals can still hold writes to a retired collection; they are dropped, never uploaded. */
const retired = (write: Pending) => write.collection !== 'profiles' && !(collections as string[]).includes(write.collection)
// A native lock distinguishes an active tab's recovery journal from an abandoned one.
if (typeof navigator !== 'undefined' && navigator.locks) void navigator.locks.request(`kw-sync-tab:${tabId}`, () => new Promise<void>((release) => addEventListener('pagehide', () => release(), { once: true }))).catch(() => {})
// Closing or backgrounding the tab must not wait for the debounce, and
// localStorage is the reliable synchronous path while IndexedDB flushes in the
// background. A lost snapshot turns the next visit into a multi-megabyte pull.
addEventListener('pagehide', () => {
  saveRecovery()
  const scope = useWorkspace.getState().scope
  if (scope !== 'guest') flushSnapshot(scope)
})
addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    saveRecovery()
    const scope = useWorkspace.getState().scope
    if (scope !== 'guest') flushSnapshot(scope)
  }
})

function profile(content: Content): Data {
  return { scratchpad: content.scratchpad, taskViews: content.taskViews ?? [] }
}
function normalize(content: Content): Content {
  return { ...contentFields(content), taskViews: content.taskViews ?? [], projects: content.projects.map((p) => ({ ...p, workspace: p.workspace === 'team' ? 'team' : 'personal' })) }
}
export function changedAppliedActivityIds(
  appliedEntries: { activityId?: string; progress?: number; previous?: number; remark?: string; previousRemark?: string }[] | undefined,
): Set<string> {
  const ids = new Set<string>()
  for (const e of appliedEntries ?? []) {
    if (!e.activityId) continue
    const progressChanged = typeof e.progress === 'number' && typeof e.previous === 'number' && Math.abs(e.progress - e.previous) > 1e-12
    const remarkChanged = (e.remark ?? '').trim() !== (e.previousRemark ?? '').trim()
    if (progressChanged || remarkChanged) ids.add(e.activityId)
  }
  return ids
}

function compactSubmissionPayload(payload: Data): Data {
  const rawEntries = (payload as { entries?: unknown[] })?.entries
  const rest = { ...payload }
  // The server preserves old.data->'appliedEntries' via coalesce(old.data, '{}'); never re-upload it on draft saves.
  delete rest.appliedEntries
  if (!Array.isArray(rawEntries) || rawEntries.length <= 1) return rest
  const appliedIds = changedAppliedActivityIds(
    (payload as { appliedEntries?: { activityId?: string; progress?: number; previous?: number; remark?: string; previousRemark?: string }[] })?.appliedEntries,
  )
  const changedEntriesOnly = (rawEntries as { activityId?: string; progress: number; previous: number; remark?: string }[]).filter(
    (e) => Math.abs(e.progress - e.previous) > 1e-12 || (e.remark && e.remark.trim().length > 0) || (e.activityId && appliedIds.has(e.activityId)),
  )
  return { ...rest, entries: changedEntriesOnly }
}
/**
 * Write only the pending-write journal. The full workspace lives in IndexedDB;
 * serialising it into localStorage on every keystroke was the editor's worst stall.
 */
function saveRecovery(): boolean {
  const scope = useWorkspace.getState().scope
  if (scope === 'guest') return true
  const key = recoveryKey(scope)
  try {
    if (!pending.size) {
      localStorage.removeItem(key)
    } else {
      try {
        localStorage.setItem(key, JSON.stringify([...pending.values()]))
      } catch {
        // Pending write queue might be large; try storing without large redundant entry lists.
        const compact = [...pending.values()].map((p) => p.collection === 'nbc_submissions' ? { ...p, data: compactSubmissionPayload(p.data) } : p)
        localStorage.setItem(key, JSON.stringify(compact))
      }
    }
    if (useWorkspace.getState().storageError) useWorkspace.setState({ storageError: false })
    return true
  } catch {
    if (typeof indexedDB === 'undefined') {
      useWorkspace.setState({ storageError: true })
      return false
    }
    return true
  }
}
function snapshotPayload(scope: string) {
  return {
    scope,
    // IndexedDB structured-clones the value itself when it is written, and store rows are never
    // mutated in place, so a second full clone of the workspace only doubled the main-thread stall.
    content: contentOf(useWorkspace.getState()),
    watermarks: Object.fromEntries(watermarks) as Record<string, string>,
    lastFullPull: lastFullPull ? new Date(lastFullPull).toISOString() : undefined,
  }
}
async function writeSnapshot(scope: string) {
  if (scope !== useWorkspace.getState().scope) return
  // Cache failure must never prevent a server write or its acknowledgement.
  await db.snapshots.put(snapshotPayload(scope)).catch(() => {})
}
function flushSnapshot(scope: string) {
  clearTimeout(snapshotTimer)
  snapshotTimer = undefined
  if (scope !== useWorkspace.getState().scope || scope === 'guest') return
  const payload = snapshotPayload(scope)
  void db.snapshots.put(payload).catch(() => {})
}
/** Coalesce full-workspace clones so typing does not clone an 8 MB BOQ per key. */
function cacheSnapshot(scope: string) {
  if (scope !== useWorkspace.getState().scope || scope === 'guest') return
  saveRecovery()
  clearTimeout(snapshotTimer)
  snapshotTimer = setTimeout(() => { snapshotTimer = undefined; whenIdle(() => void writeSnapshot(scope)) }, SNAPSHOT_DELAY_MS)
}
/** Run the large snapshot write between interactions instead of in the middle of typing or scrolling. */
function whenIdle(callback: () => void) {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(callback, { timeout: 2000 })
  else callback()
}
function queueRow(scope: string, collection: CloudCollection, id: string, before: Data, after: Data) {
  const key = keyFor(scope, collection, id), previous = pending.get(key)
  pending.set(key, { key, scope, collection, id, data: after, original: previous?.original ?? before, base: previous ? previous.base : versions.get(key) ?? (typeof before.updatedAt === 'string' ? before.updatedAt : null), version: crypto.randomUUID() })
}
function queueChanges(next: Content, previous: Content) {
  const scope = useWorkspace.getState().scope
  for (const collection of collections) {
    if (next[collection] === previous[collection]) continue
    const old = new Map((previous[collection] ?? []).map((row) => [row.id, row]))
    for (const row of next[collection] ?? []) {
      const before = old.get(row.id)
      // Store updates replace only the rows they change, so an identical object is unchanged.
      // Skipping it avoids serialising every row of a 17k-activity BOQ twice per edit.
      if (row !== before && JSON.stringify(row) !== JSON.stringify(before)) queueRow(scope, collection, row.id, (before ?? {}) as unknown as Data, row as unknown as Data)
    }
    if (collection === 'pages' || collection === 'tasks') {
      for (const row of purgedRows(collection, previous, next)) {
        const key = keyFor(scope, collection, row.id), queued = pending.get(key)
        pending.set(key, { key, scope, collection, id: row.id, data: { id: row.id }, original: row as unknown as Data, version: crypto.randomUUID(), base: queued ? queued.base : versions.get(key) ?? null, remove: true })
      }
    }
  }

  if (JSON.stringify(profile(next)) !== JSON.stringify(profile(previous))) queueRow(scope, 'profiles', scope, profile(previous), { id: scope, ...profile(next) })
  cacheSnapshot(scope)
  void syncWorkspace(false)
}
export function pendingCollectionIds(collection: Collection) {
  const scope = useWorkspace.getState().scope
  return new Set([...pending.values()].filter((p) => p.scope === scope && p.collection === collection).map((p) => p.id))
}
export function acknowledgeSavedRow(scope: string, collection: CloudCollection, id: string, row: Row) {
  if (scope !== useWorkspace.getState().scope) return
  const key = keyFor(scope, collection, id)
  versions.set(key, row.updated_at)
  advanceWatermark(collection, row.updated_at)
  pending.delete(key)
  void db.outbox.delete(key).catch(() => {})
  applyRow(collection, row, id)
  cacheSnapshot(scope)
}
export async function reassignNbcActivities(projectId: string, ids: string[], handler: string, expected: Record<string, string>) {
  const scope = useWorkspace.getState().scope
  if (scope === 'guest' || !supabase || !useAccount.getState().session) throw new Error('Sign in before reassigning activities.')
  const { data, error } = await supabase.rpc('kw_nbc_reassign_activities', {
    p_project_id: projectId,
    p_activity_ids: ids,
    p_handler: handler,
    p_expected: expected,
  })
  if (error) throw error
  const result = data as { conflict?: boolean; rows?: (Partial<Row> & { id: string; updated_at: string; editor?: string })[] } | null
  if (result?.conflict) throw new Error('Activities changed in another session. Reload and try again.')
  if (!result?.rows || result.rows.length !== ids.length) throw new Error('The server did not confirm every assignment.')
  const saved = new Map(result.rows.map((row) => [row.id, row]))
  for (const row of result.rows) {
    const key = keyFor(scope, 'nbc_activities', row.id)
    versions.set(key, row.updated_at)
    advanceWatermark('nbc_activities', row.updated_at)
    pending.delete(key)
    void db.outbox.delete(key).catch(() => {})
  }
  applyRemotePatch({ nbc_activities: (useWorkspace.getState().nbc_activities ?? []).map((activity) => {
    const row = saved.get(activity.id)
    if (!row) return activity
    if (row.data) return rowEntity('nbc_activities', row as Row)
    const entry = {
      id: crypto.randomUUID(),
      at: row.updated_at,
      recordedAt: row.updated_at,
      editor: row.editor ?? scope,
      previous: activity.progress,
      progress: activity.progress,
      remark: activity.remark,
      handler,
    }
    return {
      ...activity,
      handler,
      updatedAt: row.updated_at,
      history: [...(activity.history ?? []), entry],
    }
  }) as unknown as Content['nbc_activities'] })
  cacheSnapshot(scope)
}
export async function initializeData() {
  if (initialized) return
  initialized = true
  try { void navigator.storage?.persist?.().catch(() => {}) } catch { /* ignore */ }
  useWorkspace.subscribe((state, previous) => {
    if (!applying && state.scope !== 'guest' && state.scope === previous.scope && (
      collections.some((c) => state[c] !== previous[c]) || state.scratchpad !== previous.scratchpad || state.taskViews !== previous.taskViews
    )) queueChanges(contentOf(state), contentOf(previous))
  })
  addEventListener('online', () => { void syncWorkspace() })
  addEventListener('offline', () => { if (useWorkspace.getState().scope !== 'guest') useWorkspace.setState({ sync: { kind: 'offline', pending: pending.size } }) })
  if (hasStoredSession() || /^\/settings\/(account|accounts)/.test(location.pathname)) {
    // A local workspace too large for localStorage (BP02) lives only in IndexedDB; a real account switch clears it again.
    try { const guest = await db.snapshots.get('guest'); if (guest && !localStorage.getItem('kw-workspace-v1') && useWorkspace.getState().scope === 'guest') applyRemotePatch(normalize(guest.content)) } catch { /* In-memory only. */ }
    await initializeCloud()
  } else {
    try {
      const guest = await db.snapshots.get('guest')
      if (guest && !localStorage.getItem('kw-workspace-v1')) applyRemotePatch(normalize(guest.content))
    } catch { /* The demo can work in memory when browser storage is unavailable. */ }
    useAccount.setState({ ready: true })
  }
}
export function initializeCloud() {
  if (cloudInitialization) return cloudInitialization
  useAccount.setState({ ready: false, error: '' })
  cloudInitialization = (async () => {
    const client = await initializeSupabase()
    if (!client) { useAccount.setState({ ready: true }); return }
    client.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return
      if (event === 'PASSWORD_RECOVERY') useAccount.setState({ recovering: true })
      if (event === 'TOKEN_REFRESHED' && session && session.user.id === useWorkspace.getState().scope) {
        useAccount.setState({ session })
        void supabase?.realtime.setAuth(session.access_token)
        return
      }
      setTimeout(() => void switchAccount(session), 0)
    })
    const { data, error } = await client.auth.getSession()
    if (error) useAccount.setState({ error: error.message })
    await switchAccount(data.session)
    useAccount.setState({ ready: true })
  })().catch((error) => {
    cloudInitialization = undefined
    useAccount.setState({ ready: true, error: error instanceof Error ? error.message : 'Could not connect to your account.' })
  })
  return cloudInitialization
}
async function switchAccount(session: Session | null) {
  // Accounts outside @singbuild.com are signed straight back out; the server refuses to create them too.
  if (session && !allowedEmail(session.user.email)) {
    void supabase?.auth.signOut()
    useAccount.setState({ error: DOMAIN_ERROR })
    session = null
  }
  const scope = session?.user.id ?? 'guest'
  const previousScope = useWorkspace.getState().scope
  useAccount.setState({ session })
  if (scope === previousScope) {
    if (session) { await supabase?.realtime.setAuth(session.access_token); void syncWorkspace() }
    return
  }
  saveRecovery()
  if (previousScope !== 'guest') flushSnapshot(previousScope)
  const current = ++generation
  clearTimeout(retryTimer)
  if (realtime) { void supabase?.removeChannel(realtime); realtime = undefined }
  pending.clear(); versions.clear(); hydrated = false; live = false; wasLive = false; retry = 0
  watermarks = new Map(); lastFullPull = 0
  activeRun = undefined; refreshRequested = false; refreshFull = false
  useWorkspaceUI.setState({ commandOpen: false, toast: null })
  // Clear the previous account synchronously, before any asynchronous initialization.
  applyRemotePatch({ ...structuredClone(emptyContent) })
  useWorkspace.setState({ scope, sync: scope === 'guest' ? { kind: 'saved' } : { kind: 'saving' }, storageError: false })
  let restored!: () => void
  const restore = new Promise<void>((resolve) => { restored = resolve })
  restoring = restore
  try {
    if (scope === 'guest') {
      const raw = localStorage.getItem('kw-workspace-v1')
      if (raw) applyRemotePatch(normalize(JSON.parse(raw)))
      // A project too large for localStorage (BP02) is kept only in the IndexedDB snapshot.
      else { const snapshot = await db.snapshots.get('guest'); if (current !== generation) return; if (snapshot) applyRemotePatch(normalize(snapshot.content)) }
    } else {
      const snapshot = await db.snapshots.get(scope).catch(() => undefined)
      if (current !== generation) return
      if (snapshot) {
        watermarks = new Map(Object.entries(snapshot.watermarks ?? {}) as [CloudCollection, string][])
        lastFullPull = snapshot.lastFullPull ? Date.parse(snapshot.lastFullPull) || Date.now() : (watermarks.size > 0 ? Date.now() : 0)
        // A snapshot with watermarks can resume incrementally instead of pulling 8 MB of BOQ again.
        hydrated = watermarks.size > 0 && (Date.parse(snapshot.lastFullPull ?? '') || 0) >= RECONCILE_AFTER
        const normalized = normalize(snapshot.content)
        for (const col of collections) {
          for (const item of (normalized[col] ?? []) as { id?: string; updatedAt?: string }[]) {
            if (item?.id && item.updatedAt) versions.set(keyFor(scope, col, item.id), item.updatedAt)
          }
        }
        const profileWatermark = watermarks.get('profiles')
        if (profileWatermark && profileWatermark !== EPOCH) {
          versions.set(keyFor(scope, 'profiles', scope), profileWatermark)
        }
        applyRemotePatch(normalized)
      }
      // The full-workspace localStorage cache is obsolete; IndexedDB holds the snapshot.
      try { for (const key of Object.keys(localStorage)) if (key.startsWith('kw-cloud-cache:')) localStorage.removeItem(key) } catch { /* ignore */ }
      const writes: Write[] = JSON.parse(localStorage.getItem(recoveryKey(scope)) || '[]')
      for (const write of writes) if (write.scope === scope && !retired(write)) { pending.set(write.key, write); applyRow(write.collection, write.remove ? null : { id: write.id, data: write.data, updated_at: String(write.data.updatedAt || '') }, write.id) }
    }
  } catch { /* An invalid cache cannot replace cloud content. */ } finally {
    if (restoring === restore) restoring = undefined
    restored()
  }
  if (current !== generation) return
  if (!session || !supabase) return
  await supabase.realtime.setAuth(session.access_token)
  if (current !== generation) return
  realtime = supabase.channel(`kw-workspace:${scope}`, { config: { private: true } })
  for (const collection of [...collections.filter((c) => !c.startsWith('nbc_')), 'profiles'] as CloudCollection[]) for (const event of ['INSERT', 'UPDATE'] as const) realtime.on('postgres_changes', { event, schema: 'public', table: `kw_${collection}`, ...(collection === 'projects' ? {} : {filter: `user_id=eq.${scope}`}) }, (payload) => {
    if (current !== generation) return
    // Applying the row directly avoids re-reading a collection (and a large BOQ) per keystroke elsewhere.
    const row = (payload as { new?: { id?: string; data?: Data; updated_at?: string } } | undefined)?.new
    if (!row?.data || !row.updated_at) { void syncWorkspace(); return }
    applyRealtimeRow(collection, row)
  })
  // Broadcast deletes carry the collection and id; only pages and tasks are hard-deleted in this app.
  realtime.on('broadcast', { event: 'DELETE' }, (message) => {
    if (current !== generation) return
    const payload = (message as { payload?: { collection?: string; id?: string } } | undefined)?.payload
    if (payload?.id && (payload.collection === 'pages' || payload.collection === 'tasks')) {
      applyDeletedRow(payload.collection, payload.id)
      return
    }
    void refreshCollections(['pages', 'tasks'], { full: true })
  })
  realtime.on('system', {}, (message) => {
    if (current === generation && message.extension === 'postgres_changes' && message.status === 'error') { live = false; refreshRequested = true; useWorkspace.setState({ sync: { kind: 'error', reason: 'Live updates unavailable. Check the workspace Realtime publication and permissions.' } }) }
  })
  realtime.subscribe((status) => {
    if (current !== generation) return
    const reconnect = wasLive
    live = status === 'SUBSCRIBED'
    if (live) {
      wasLive = true
      // A reconnected channel missed broadcasts, so reconcile hard deletes before resuming deltas.
      if (reconnect) {
        void refreshCollections(['pages', 'tasks'], { full: true })
        void syncWorkspace()
      } else if (!activeRun && useWorkspace.getState().sync.kind !== 'saving') {
        useWorkspace.setState({ sync: pending.size ? { kind: 'saving' } : { kind: 'saved' } })
      }
    } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
      refreshRequested = true
      useWorkspace.setState({ sync: { kind: 'error', reason: 'Live updates disconnected. Reconnecting; pending changes are retained.' } })
    }
  })
  // Recovery work does not gate online writes.
  void recoverAbandoned(scope, current)
  void recoverLegacy(scope, current)
  await syncWorkspace()
}
async function recoverAbandoned(scope: string, current: number) {
  if (!navigator.locks) return
  const prefix = `kw-cloud-pending:${scope}:`
  try {
    const keys = Object.keys(localStorage).filter((key) => key.startsWith(prefix) && key !== recoveryKey(scope))
    for (const key of keys) await navigator.locks.request(`kw-sync-tab:${key.slice(prefix.length)}`, { ifAvailable: true }, (lock) => {
      if (!lock || current !== generation) return
      const writes: Write[] = JSON.parse(localStorage.getItem(key) || '[]')
      for (const write of writes) {
        if (write.scope !== scope || retired(write)) continue
        const existing = pending.get(write.key)
        if (existing && JSON.stringify(existing.data) !== JSON.stringify(write.data)) recoverConflict(write)
        else {
          pending.set(write.key, write)
          applyRow(write.collection, write.remove ? null : { id: write.id, data: write.data, updated_at: String(write.data.updatedAt || '') }, write.id)
        }
      }
      if (saveRecovery()) localStorage.removeItem(key)
    })
    if (current === generation && pending.size) void syncWorkspace()
  } catch { /* Keep unreadable recovery journals for manual backup. */ }
}
async function recoverLegacy(scope: string, current: number) {
  try {
    const old = await db.outbox.where('scope').equals(scope).toArray().catch(() => [] as Pending[])
    const legacy = localStorage.getItem(`kw-recovery:${scope}`)
    const snapshot = legacy ? await db.snapshots.get(scope).catch(() => undefined) : null
    if (current !== generation) return
    for (const item of old) if (retired(item)) void db.outbox.delete(item.key).catch(() => {}); else if (!pending.has(item.key)) pending.set(item.key, { ...item, original: {} })
    if (legacy) {
      const recovered = normalize(JSON.parse(legacy))
      queueChanges(recovered, snapshot?.content ?? emptyContent)
      if (saveRecovery()) localStorage.removeItem(`kw-recovery:${scope}`)
    }
    if (old.length) { saveRecovery(); void syncWorkspace() }
  } catch { /* IndexedDB is optional for the cloud path. */ }
}
function laterStamp(a: string | undefined, b: string | undefined): string | undefined {
  if (!a) return b
  if (!b) return a
  const at = Date.parse(a), bt = Date.parse(b)
  if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return at > bt ? a : b
  return a > b ? a : b
}
function rowEntity(collection: CloudCollection, row: Row): Data {
  return { ...(collection === 'nbc_activities' ? normalizeActivity(row.data) : row.data), ...(collection === 'projects' ? { workspace: row.data.workspace === 'team' ? 'team' : 'personal' } : {}), id: row.id, updatedAt: row.updated_at }
}
/**
 * Apply one Realtime row without re-reading its collection. A pending local write
 * owns the row until its acknowledgement, and an event older than the version we
 * already rendered is ignored.
 */
export function applyRealtimeRow(collection: CloudCollection, incoming: { id?: string; data?: Data; updated_at?: string }): boolean {
  const scope = useWorkspace.getState().scope
  if (scope === 'guest' || !incoming.data || !incoming.updated_at) return false
  const id = collection === 'profiles' ? scope : String(incoming.id ?? incoming.data.id ?? '')
  if (!id) return false
  const key = keyFor(scope, collection, id)
  if (pending.has(key)) return false
  const seen = versions.get(key)
  if (seen && laterStamp(incoming.updated_at, seen) !== incoming.updated_at) return false
  versions.set(key, incoming.updated_at)
  advanceWatermark(collection, incoming.updated_at)
  applyRow(collection, { id, data: incoming.data, updated_at: incoming.updated_at }, id)
  cacheSnapshot(scope)
  return true
}
/** Remove a row whose server delete has no table id in the broadcast payload. */
export function applyDeletedRow(collection: CloudCollection, id: string) {
  const scope = useWorkspace.getState().scope
  if (scope === 'guest') return
  const key = keyFor(scope, collection, id)
  pending.delete(key)
  versions.delete(key)
  applyRow(collection, null, id)
  cacheSnapshot(scope)
}
function applyRow(collection: CloudCollection, row: Row | null, id: string) {
  if (collection === 'profiles') {
    const data = row?.data ?? {}
    applyRemotePatch({ scratchpad: String(data.scratchpad || ''), taskViews: (data.taskViews ?? []) as Content['taskViews'] })
  } else {
    const list = (useWorkspace.getState()[collection] ?? []).filter((r) => r.id !== id)
    if (row) list.push(rowEntity(collection, row) as unknown as (typeof list)[number])
    applyRemotePatch({ [collection]: list })
  }
}
async function pullCloud(
  scope: string,
  current: number,
  only: CloudCollection[] = [...collections, 'profiles'],
  full = false,
  projectId?: string,
) {
  for (const collection of only) {
    // Older deployments and ordinary projects do not need the NBC tables.
    if (collection.startsWith('nbc_') && !useWorkspace.getState().projects.some((p) => p.nbcBp03)) continue
    const watermarkKey = (projectId && collection.startsWith('nbc_') ? `${collection}:${projectId}` : collection) as CloudCollection
    const watermark = watermarks.get(watermarkKey) ?? watermarks.get(collection)
    // A collection without a watermark has never been read in full.
    const reconcile = full || !watermark
    if (collection === 'profiles') {
      const rows: Row[] = []
      for (let offset = 0; ; offset += 1000) {
        let query = supabase!.from('kw_profiles').select('id,data,updated_at')
        if (!reconcile) query = query.gt('updated_at', watermark!)
        const result = await query.order('updated_at', { ascending: true }).order('id', { ascending: true }).range(offset, offset + 999)
        if (result.error) throw result.error
        if (current !== generation) return
        rows.push(...result.data)
        if (result.data.length < 1000) break
      }
      let newest = watermark
      for (const row of rows) newest = laterStamp(newest, row.updated_at)
      if (reconcile) watermarks.set(collection, newest ?? EPOCH)
      else if (newest) watermarks.set(collection, newest)
      const key = keyFor(scope, collection, scope)
      if (!pending.has(key) && (rows.length || reconcile)) {
        const row = rows[0] ?? null
        if (row) versions.set(key, row.updated_at)
        applyRow(collection, row, scope)
      }
      continue
    }
    const state = useWorkspace.getState()
    const merged = new Map<string, Data>(((state[collection] ?? []) as unknown as Data[]).map((row) => [String(row.id), row]))
    const useManifest = merged.size > 0 && MANIFEST_COLLECTIONS.has(collection)

    if (useManifest) {
      const manifest: { id: string; updated_at: string }[] = []
      for (let offset = 0; ; offset += 1000) {
        let query = supabase!.from(`kw_${collection}`).select('id,updated_at')
        if (collection !== 'projects' && !collection.startsWith('nbc_')) query = query.eq('user_id', scope)
        if (projectId && collection.startsWith('nbc_')) query = query.eq('project_id', projectId)
        if (!reconcile) query = query.gt('updated_at', watermark!)
        const result = await query.order('updated_at', { ascending: true }).order('id', { ascending: true }).range(offset, offset + 999)
        if (result.error) throw result.error
        if (current !== generation) return
        manifest.push(...result.data)
        if (result.data.length < 1000) break
      }
      if (reconcile) {
        const present = new Set(manifest.map((r) => r.id))
        for (const [id, row] of Array.from(merged.entries())) {
          if (projectId && collection.startsWith('nbc_') && row.projectId !== projectId) continue
          if (!present.has(id) && !pending.has(keyFor(scope, collection, id))) {
            merged.delete(id)
            versions.delete(keyFor(scope, collection, id))
          }
        }
      }
      const toFetch: string[] = []
      let newest = watermark
      for (const item of manifest) {
        newest = laterStamp(newest, item.updated_at)
        const local = merged.get(item.id)
        if (!local || local.updatedAt !== item.updated_at) {
          toFetch.push(item.id)
        }
      }
      if (reconcile) {
        watermarks.set(watermarkKey, newest ?? EPOCH)
        if (!projectId) watermarks.set(collection, newest ?? EPOCH)
      } else if (newest) {
        watermarks.set(watermarkKey, newest)
        if (!projectId) watermarks.set(collection, newest)
      }
      if (toFetch.length > 0) {
        for (let i = 0; i < toFetch.length; i += MANIFEST_BATCH_SIZE) {
          const batch = toFetch.slice(i, i + MANIFEST_BATCH_SIZE)
          let query = supabase!.from(`kw_${collection}`).select('id,data,updated_at')
          if (collection !== 'projects' && !collection.startsWith('nbc_')) query = query.eq('user_id', scope)
          if (projectId && collection.startsWith('nbc_')) query = query.eq('project_id', projectId)
          if (typeof (query as unknown as { in?: (k: string, v: string[]) => unknown }).in === 'function') {
            const result = await (query as unknown as { in: (k: string, v: string[]) => Promise<{ error: Error | null; data: Row[] }> }).in('id', batch)
            if (result.error) throw result.error
            if (current !== generation) return
            for (const row of result.data) {
              const key = keyFor(scope, collection, row.id)
              const queued = pending.get(key)
              if (!queued) {
                versions.set(key, row.updated_at)
                merged.set(row.id, rowEntity(collection, row))
              } else if (collection === 'nbc_submissions' && !queued.base) {
                versions.set(key, row.updated_at)
                pending.set(key, { ...queued, base: row.updated_at, original: row.data })
              }
            }
          } else {
            for (const id of batch) {
              const res = await supabase!.from(`kw_${collection}`).select('id,data,updated_at').eq('id', id).maybeSingle()
              if (current !== generation) return
              if (res.data) {
                const row = res.data as Row
                const key = keyFor(scope, collection, row.id)
                if (!pending.has(key)) {
                  versions.set(key, row.updated_at)
                  merged.set(row.id, rowEntity(collection, row))
                }
              }
            }
          }
        }
      }
    } else {
      const rows: Row[] = []
      for (let offset = 0; ; offset += 1000) {
        let query = supabase!.from(`kw_${collection}`).select('id,data,updated_at')
        // RLS returns the caller's private projects plus the one shared NBC project.
        if (collection !== 'projects' && !collection.startsWith('nbc_')) query = query.eq('user_id', scope)
        if (projectId && collection.startsWith('nbc_')) query = query.eq('project_id', projectId)
        if (!reconcile) query = query.gt('updated_at', watermark!)
        const result = await query.order('updated_at', { ascending: true }).order('id', { ascending: true }).range(offset, offset + 999)
        if (result.error) throw result.error
        if (current !== generation) return
        rows.push(...result.data)
        if (result.data.length < 1000) break
      }
      let newest = watermark
      for (const row of rows) newest = laterStamp(newest, row.updated_at)
      if (reconcile) {
        watermarks.set(watermarkKey, newest ?? EPOCH)
        if (!projectId) watermarks.set(collection, newest ?? EPOCH)
      } else if (newest) {
        watermarks.set(watermarkKey, newest)
        if (!projectId) watermarks.set(collection, newest)
      }
      const present = new Set(rows.map((row) => row.id))
      for (const row of rows) {
        const key = keyFor(scope, collection, row.id)
        const queued = pending.get(key)
        if (!queued) {
          versions.set(key, row.updated_at)
          merged.set(row.id, rowEntity(collection, row))
        } else if (collection === 'nbc_submissions' && !queued.base) {
          versions.set(key, row.updated_at)
          pending.set(key, { ...queued, base: row.updated_at, original: row.data })
        }
      }
      // Only a full read can reveal rows deleted while this client was away.
      if (reconcile) {
        for (const [id, row] of Array.from(merged.entries())) {
          if (projectId && collection.startsWith('nbc_') && row.projectId !== projectId) continue
          if (!present.has(id) && !pending.has(keyFor(scope, collection, id))) merged.delete(id)
        }
      }
    }
    for (const write of pending.values()) if (write.collection === collection) {
      if (write.remove) merged.delete(write.id)
      else merged.set(write.id, write.data)
    }
    applyRemotePatch({ [collection]: [...merged.values()] } as Partial<Content>)
  }
  if (only.length >= collections.length + 1) {
    hydrated = true
    if (full || !lastFullPull) lastFullPull = Date.now()
  }
  await writeSnapshot(scope)
}

/**
 * Re-read only the named collections after a server-side operation.
 *
 * A confirmation writes one submission, its activities and two summaries. Pulling
 * the whole workspace for that costs a request per collection (plus a second page
 * for a large BOQ), which is what made Confirm/Edit/Delete feel slow. Passing
 * `full` also reconciles rows deleted elsewhere; ordinary refreshes only read rows
 * newer than the persisted watermark.
 */
export async function refreshCollections(
  names: Collection[],
  options: { full?: boolean; projectId?: string } = {},
): Promise<void> {
  if (!supabase || !useAccount.getState().session || useWorkspace.getState().scope === 'guest') return
  if (!hydrated) { await syncWorkspace(); return }
  if (!navigator.onLine) return
  if (activeRun) await activeRun
  const current = generation, scope = useWorkspace.getState().scope
  if (current !== generation || scope !== useWorkspace.getState().scope) return
  activeRun = (async () => {
    try { await pullCloud(scope, current, names as CloudCollection[], !!options.full, options.projectId) }
    catch { refreshRequested = true }
    finally { if (current === generation) activeRun = undefined }
  })()
  return activeRun
}

/**
 * Wait until `blocked()` is false, pushing the queue as many times as it takes.
 *
 * One `syncWorkspace(false)` is not enough before a server operation: when an autosave run is
 * already in flight it returns that run, which finishes before the draft just queued is sent, or
 * it fails once on a flaky connection and leaves the write for the backoff timer. Retrying here
 * (bounded) makes Confirm seamless instead of surfacing a transient "draft is kept" error.
 */
export async function flushPending(blocked: () => boolean, timeoutMs = 20000): Promise<boolean> {
  if (!blocked()) return true
  const deadline = Date.now() + timeoutMs
  for (let attempt = 0; ; attempt++) {
    await syncWorkspace(false)
    if (!blocked()) return true
    // A follow-up run is started in a microtask when writes remain; join it too.
    await Promise.resolve()
    if (activeRun) await activeRun
    if (!blocked()) return true
    if (!navigator.onLine || Date.now() >= deadline) return false
    await new Promise((resolve) => setTimeout(resolve, Math.min(150 * (attempt + 1), 1000)))
  }
}
function recoverConflict(write: Write) {
  const state = useWorkspace.getState()
  const title = `Recovered edit · ${write.data.title || write.data.name || write.collection}`
  const id = state.addPage(title)
  state.updatePage(id, write.collection === 'pages' ? { ...write.data, id, title, parentId: null, deletedAt: null } as Partial<WorkspacePage> : {
    blocks: [{ id: crypto.randomUUID(), kind: 'paragraph', text: JSON.stringify(write.data, null, 2) }],
  })
  useWorkspaceUI.getState().notify('A concurrent edit was kept in the cloud. Your draft is preserved in a Recovered edit page; find it in Search.')
}
/** No routine workspace polling: fetch on subscribe/reconnect, change events, and explicit retry. */
export function syncWorkspace(refresh = true): Promise<void> {
  if (!supabase || !useAccount.getState().session || useWorkspace.getState().scope === 'guest') return Promise.resolve()
  if (restoring) return restoring.then(() => syncWorkspace(refresh))
  refreshRequested ||= refresh
  if (activeRun) return activeRun
  if (!navigator.onLine) { useWorkspace.setState({ sync: { kind: 'offline', pending: pending.size } }); return Promise.resolve() }
  clearTimeout(retryTimer)
  const current = generation, scope = useWorkspace.getState().scope
  const valid = () => current === generation && scope === useAccount.getState().session?.user.id
  activeRun = (async () => {
    useWorkspace.setState({ sync: { kind: 'saving' } })
    try {
      const reconcileDue = lastFullPull > 0 && Date.now() - lastFullPull > FULL_RECONCILE_MS
      // A missing snapshot or an overdue reconcile reads everything once; otherwise only newer rows travel.
      if (!hydrated || refreshFull || reconcileDue) { refreshRequested = false; refreshFull = false; await pullCloud(scope, current, undefined, true) }
      else if (refreshRequested && !pending.size) { refreshRequested = false; await pullCloud(scope, current) }
      if (!valid()) return
      let conflicts = 0
      for (;;) {
        const write = pending.values().next().value
        if (!write) break
        if (write.remove) {
          if (!['pages', 'tasks'].includes(write.collection)) throw new Error('Only trashed pages and tasks can be permanently deleted.')
          let remote: Row | null = null
          if (write.base) {
            const removed = await supabase!.from(`kw_${write.collection}`).delete().eq('user_id', scope).eq('id', write.id).eq('updated_at', write.base).select('id')
            if (!valid()) return
            if (removed.error) throw removed.error
            if (!removed.data.length) {
              const result = await supabase!.from(`kw_${write.collection}`).select('id,data,updated_at').eq('user_id', scope).eq('id', write.id).maybeSingle()
              if (!valid()) return
              if (result.error) throw result.error
              remote = result.data as Row | null
            }
          } else {
            const result = await supabase!.from(`kw_${write.collection}`).select('id,data,updated_at').eq('user_id', scope).eq('id', write.id).maybeSingle()
            if (!valid()) return
            if (result.error) throw result.error
            remote = result.data as Row | null
          }
          pending.delete(write.key)
          if (remote) versions.set(write.key, remote.updated_at)
          else versions.delete(write.key)
          if (remote) useWorkspaceUI.getState().notify('An item changed in another session and was kept. Review it before deleting again.')
          applyRow(write.collection, remote, write.id)
          void db.outbox.delete(write.key).catch(() => {})
          cacheSnapshot(scope)
          continue
        }
        if (!valid()) return
        const rawPayload = await syncWorkspaceFiles(write.data, scope)
        if (!valid()) return
        const fullEntries = write.collection === 'nbc_submissions' ? (rawPayload as { entries?: unknown[] })?.entries : undefined
        const payload = write.collection === 'nbc_submissions' ? compactSubmissionPayload(rawPayload as unknown as Data) : (rawPayload as unknown as Data)
        let { data, error } = await supabase!.rpc('kw_workspace_write', { collection: write.collection, record_id: write.id, payload, expected: write.base })
        if (!valid()) return
        if (error && write.collection === 'nbc_submissions' && ['P0001', '23505', '23514', '57014'].includes(error.code)) {
          if (Array.isArray(fullEntries) && (error.message.includes('Invalid draft') || error.code === '57014')) {
            const compactPayload = compactSubmissionPayload({ ...rawPayload, entries: fullEntries })
            const retryResult = await supabase!.rpc('kw_workspace_write', {
              collection: write.collection,
              record_id: write.id,
              payload: compactPayload,
              expected: write.base,
            })
            if (!valid()) return
            if (!retryResult.error && retryResult.data) {
              data = retryResult.data
              error = null
            }
          }
          if (error) {
            // Preserve rejected autosaves for recovery without retrying an invalid draft forever.
            const saved = await supabase!.from('kw_nbc_submissions').select('id,data,updated_at').eq('id', write.id).maybeSingle()
            if (!valid()) return
            if (saved.error) throw saved.error
            const remoteSaved = saved.data as Row | null
            if (remoteSaved?.data?.status !== 'confirmed') recoverConflict(pending.get(write.key)!)
            pending.delete(write.key)
            applyRow(write.collection, remoteSaved, write.id)
            refreshRequested = true
            if (remoteSaved?.data?.status !== 'confirmed') useWorkspaceUI.getState().notify(`Draft could not be saved: ${error.message}. Your edits were preserved in Search.`)
            cacheSnapshot(scope)
            continue
          }
        }
        if (error) throw error
        const latest = pending.get(write.key)!
        const row = data.row as Row | null
        if (data.conflict) {
          if (++conflicts > 8) throw new Error('This item is changing in another session. Your edits are retained; retry shortly.')
          if (latest.remove) {
            pending.delete(write.key)
            if (row) versions.set(write.key, row.updated_at)
            applyRow(write.collection, row, write.id)
            useWorkspaceUI.getState().notify('An item changed in another session and was kept. Review it before deleting again.')
            cacheSnapshot(scope)
            continue
          }
          if (write.collection === 'nbc_submissions') {
            if (!row) {
              // No server draft exists yet (e.g. local draft had a client timestamp); insert with expected = null.
              versions.delete(write.key)
              pending.set(write.key, { ...latest, original: {}, base: null })
              continue
            }
            if (row.data?.status === 'confirmed') {
              versions.set(write.key, row.updated_at)
              pending.delete(write.key)
              applyRow(write.collection, row, write.id)
              cacheSnapshot(scope)
              continue
            }
            versions.set(write.key, row.updated_at)
            pending.set(write.key, { ...latest, data: { ...row.data, ...latest.data, updatedAt: row.updated_at }, original: row.data, base: row.updated_at })
            continue
          }
          const rebased = rebaseWrite(write.original, latest.data, row?.data ?? null)
          if (rebased.conflicts) {
            recoverConflict(latest)
            pending.delete(write.key)
            applyRow(write.collection, row, write.id)
          } else {
            pending.set(write.key, { ...latest, data: rebased.data, original: row!.data, base: row!.updated_at })
          }
        } else {
          if (!row?.updated_at) throw new Error('The server did not confirm this write.')
          const baseData: Data = row.data ? { ...write.data, ...row.data } : { ...write.data }
          const appliedRow: Row = write.collection === 'nbc_submissions' && Array.isArray(fullEntries)
            ? { id: row.id ?? write.id, updated_at: row.updated_at, data: { ...baseData, entries: fullEntries, updatedAt: row.updated_at } }
            : { id: row.id ?? write.id, updated_at: row.updated_at, data: { ...baseData, updatedAt: row.updated_at } }
          versions.set(write.key, row.updated_at)
          advanceWatermark(write.collection, row.updated_at)
          if (latest.version === write.version) {
            pending.delete(write.key)
            applyRow(write.collection, appliedRow, write.id)
          } else {
            // Preserve keystrokes entered while the server request was in flight.
            pending.set(write.key, { ...latest, data: { ...appliedRow.data, ...changedFields(write.data, latest.data) }, original: appliedRow.data, base: row.updated_at })
          }
        }
        // Remove only legacy entries that have now received a server decision.
        void db.outbox.delete(write.key).catch(() => {})
        cacheSnapshot(scope)
      }
      if (refreshRequested || refreshFull) {
        const full = refreshFull
        refreshRequested = false; refreshFull = false
        await pullCloud(scope, current, undefined, full)
      }
      if (!valid()) return
      retry = 0
      useWorkspace.setState({ sync: pending.size ? { kind: 'saving' } : live ? { kind: 'saved' } : { kind: 'error', reason: 'Cloud loaded; live updates are connecting. Check Realtime configuration if this persists.' } })
      cacheSnapshot(scope)
    } catch (error) {
      if (!valid()) return
      useWorkspace.setState({ sync: { kind: 'error', reason: error instanceof Error ? error.message : 'Server write failed. Pending edits are retained; retry to save.' } })
      retry++
      clearTimeout(retryTimer)
      retryTimer = setTimeout(() => void syncWorkspace(), Math.min(60000, 1000 * 2 ** Math.min(retry, 6)))
    } finally {
      if (valid()) {
        activeRun = undefined
        if (!retry && (refreshRequested || refreshFull || pending.size)) queueMicrotask(() => void syncWorkspace(false))
      }
    }
  })()
  return activeRun
}
export function applyRemotePatch(patch: Partial<Content>) {
  applying = true
  try { useWorkspace.setState(patch) } finally { applying = false }
}
