import { expect, test, vi } from 'vitest'

// Regression tests for D-48:
// 1. A pagehide/visibilitychange flush while startup is reading the IndexedDB snapshot must not wipe db.rows.
// 2. A manifest pull whose batched row fetch fails (or is flushed mid-flight) must not advance watermarks
//    before rows are applied to the store.
// 3. Explicit full sync (`syncWorkspace(true, true)`) reconciles missing rows even when watermarks are current.
const local = vi.hoisted(() => {
  type RowRecord = { scope: string; collection: string; id: string; row: unknown }
  const rows = new Map<string, RowRecord>(), meta = new Map<string, { scope: string; watermarks?: Record<string, string>; lastFullPull?: string }>()
  let releaseRead: (() => void) | undefined
  let delayRead = false
  let fullDeletes = 0
  const key = (r: { scope: string; collection: string; id: string }) => `${r.scope}|${r.collection}|${r.id}`
  const db = {
    snapshots: { get: async () => undefined, put: async () => {}, delete: async () => {} },
    meta: {
      get: async (scope: string) => {
        if (delayRead) await new Promise<void>((resolve) => { releaseRead = resolve })
        return structuredClone(meta.get(scope))
      },
      put: async (value: { scope: string; watermarks?: Record<string, string>; lastFullPull?: string }) => {
        meta.set(value.scope, structuredClone(value))
      },
    },
    rows: {
      where: () => ({
        equals: (scope: string) => ({
          toArray: async () => [...rows.values()].filter((r) => r.scope === scope).map((r) => structuredClone(r)),
          delete: async () => {
            fullDeletes++
            for (const [k, r] of rows) if (r.scope === scope) rows.delete(k)
          },
        }),
      }),
      bulkPut: async (items: RowRecord[]) => { for (const r of items) rows.set(key(r), structuredClone(r)) },
      bulkDelete: async (keys: [string, string, string][]) => {
        for (const [s, c, id] of keys) rows.delete(key({ scope: s, collection: c, id }))
      },
    },
    transaction: async (...args: unknown[]) => (args[args.length - 1] as () => Promise<void>)(),
    outbox: { where: () => ({ equals: () => ({ toArray: async () => [] }) }), delete: async () => {} },
    versions: { get: async () => null, put: async () => {}, delete: async () => {} },
  }
  return {
    rows,
    meta,
    db,
    get fullDeletes() { return fullDeletes },
    setDelayRead(value: boolean) { delayRead = value },
    releaseRead() { releaseRead?.(); releaseRead = undefined },
  }
})

const cloud = vi.hoisted(() => {
  type Row = { id: string; data: Record<string, unknown>; updated_at: string }
  const user = 'account-recovery'
  const session = { user: { id: user, email: `${user}@singbuild.com` }, access_token: 'token' }
  const records = new Map<string, Map<string, Row>>()
  let failNextBatchFetch = false
  let onBatchFetch: (() => void) | undefined

  const tableRows = (table: string) => {
    let map = records.get(table)
    if (!map) { map = new Map(); records.set(table, map) }
    return map
  }
  const builder = (table: string) => {
    let selectFields = '', gtStamp = '', inIds: Set<string> | null = null, projectFilter = ''
    const visible = () => [...tableRows(table).values()]
      .filter((r) => !projectFilter || r.data.projectId === projectFilter)
      .filter((r) => !gtStamp || r.updated_at > gtStamp)
      .filter((r) => !inIds || inIds.has(r.id))
      .sort((a, b) => a.updated_at.localeCompare(b.updated_at) || a.id.localeCompare(b.id))
    const query = {
      select(fields: string) { selectFields = fields; return query },
      eq(col: string, val: string) { if (col === 'project_id') projectFilter = val; return query },
      gt(col: string, val: string) { if (col === 'updated_at') gtStamp = val; return query },
      gte(col: string, val: string) { if (col === 'updated_at') gtStamp = val; return query },
      in(col: string, vals: string[]) {
        if (col === 'id') inIds = new Set(vals)
        return query
      },
      order() { return query },
      async range(start: number, end: number) {
        const list = visible().slice(start, end + 1).map((r) => selectFields === 'id,updated_at' ? { id: r.id, updated_at: r.updated_at } : structuredClone(r))
        return { error: null, data: list }
      },
      // oxlint-disable-next-line unicorn/no-thenable -- Supabase query builders are awaitable.
      then: async (resolve: (value: unknown) => unknown) => {
        if (inIds) {
          onBatchFetch?.()
          if (failNextBatchFetch) {
            failNextBatchFetch = false
            return resolve({ error: new Error('network dropped mid-batch'), data: null })
          }
        }
        const list = visible().map((r) => selectFields === 'id,updated_at' ? { id: r.id, updated_at: r.updated_at } : structuredClone(r))
        return resolve({ error: null, data: list })
      },
      maybeSingle: async () => ({ error: null, data: visible()[0] ?? null }),
    }
    return query
  }
  const client = {
    auth: { onAuthStateChange: vi.fn(), getSession: vi.fn(async () => ({ data: { session }, error: null })) },
    realtime: { setAuth: vi.fn(async () => {}) },
    channel: vi.fn(() => { const ch = { on: () => ch, subscribe: (fn: (s: string) => void) => { queueMicrotask(() => fn('SUBSCRIBED')); return ch } }; return ch }),
    removeChannel: vi.fn(async () => {}),
    from: vi.fn((table: string) => builder(table)),
    rpc: vi.fn(),
  }
  return {
    user,
    client,
    put(table: string, id: string, data: Record<string, unknown>, updated_at: string) {
      tableRows(table).set(id, { id, data: { ...data, id }, updated_at })
    },
    setFailNextBatchFetch(v: boolean) { failNextBatchFetch = v },
    setOnBatchFetch(fn: (() => void) | undefined) { onBatchFetch = fn },
  }
})

vi.mock('@/lib/supabase', () => ({ supabase: cloud.client, hasStoredSession: () => true, initializeSupabase: async () => cloud.client }))
vi.mock('@/data/persistence', async () => ({
  ...await vi.importActual<typeof import('@/data/persistence')>('@/data/persistence'),
  db: local.db,
}))

const settle = () => new Promise((resolve) => setTimeout(resolve, 25))

test('pagehide during startup snapshot read does not wipe IndexedDB, and failed batch fetches do not advance watermarks', async () => {
  const t1 = '2026-11-21T07:05:00.000000+00:00'
  const t2 = '2026-11-21T07:10:00.000000+00:00'
  const project = { id: 'nbc-bp03', name: 'NBC BP03', nbcBp03: true, workspace: 'team', color: 'blue', progress: 0.5, description: '', target: '', status: 'Active' }
  const bp02Leaf = { id: 'nbc-bp02:1', projectId: 'nbc-bp02', wbs: '1', parentId: null, order: 1, name: 'BP02', editable: true, relativeWeight: 1, globalWeight: 1, progress: 0.86, history: [], updatedAt: t1 }
  const bp03Root = { id: 'nbc-bp03:1', projectId: 'nbc-bp03', wbs: '1', parentId: null, order: 1, name: 'BP03 Root', editable: false, relativeWeight: 1, globalWeight: 1, progress: 0.52, history: [], updatedAt: t1 }
  const bp03Leaf = { id: 'nbc-bp03:1.1', projectId: 'nbc-bp03', wbs: '1.1', parentId: 'nbc-bp03:1', order: 2, name: 'BP03 Leaf', editable: true, relativeWeight: 1, globalWeight: 1, progress: 0.52, history: [], updatedAt: t2 }

  cloud.put('kw_projects', project.id, project, t1)
  cloud.put('kw_nbc_activities', bp02Leaf.id, bp02Leaf, t1)
  cloud.put('kw_nbc_activities', bp03Root.id, bp03Root, t1)
  cloud.put('kw_nbc_activities', bp03Leaf.id, bp03Leaf, t2)

  // Seed a local snapshot that already holds bp02Leaf and bp03Root at t1, with watermark t1.
  local.rows.set(`${cloud.user}|projects|${project.id}`, { scope: cloud.user, collection: 'projects', id: project.id, row: { ...project, updatedAt: t1 } })
  local.rows.set(`${cloud.user}|nbc_activities|${bp02Leaf.id}`, { scope: cloud.user, collection: 'nbc_activities', id: bp02Leaf.id, row: bp02Leaf })
  local.rows.set(`${cloud.user}|nbc_activities|${bp03Root.id}`, { scope: cloud.user, collection: 'nbc_activities', id: bp03Root.id, row: bp03Root })
  local.meta.set(cloud.user, {
    scope: cloud.user,
    watermarks: { pages: t1, projects: t1, tasks: t1, nbc_activities: t1, nbc_submissions: t1, nbc_summaries: t1, profiles: t1 },
    lastFullPull: new Date().toISOString(),
  })

  // 1. Delay readSnapshot and fire pagehide mid-restore; IndexedDB rows must remain untouched.
  local.setDelayRead(true)
  cloud.setFailNextBatchFetch(true)
  cloud.setOnBatchFetch(() => {
    // Also fire pagehide mid-batch fetch before the batch fails: watermark must stay at t1.
    dispatchEvent(new Event('pagehide'))
  })

  const { initializeData, syncWorkspace } = await import('@/data/sync')
  const { useWorkspace } = await import('@/data')

  const init = initializeData()
  await settle()
  dispatchEvent(new Event('pagehide'))
  await settle()
  expect(local.fullDeletes).toBe(0)
  expect(local.rows.has(`${cloud.user}|nbc_activities|${bp03Root.id}`)).toBe(true)

  local.setDelayRead(false)
  local.releaseRead()
  await init
  await settle()

  // 2. The delta pull's batch fetch for bp03Leaf failed; watermark must NOT have advanced to t2.
  expect(local.meta.get(cloud.user)?.watermarks?.nbc_activities).toBe(t1)
  expect(useWorkspace.getState().nbc_activities?.map((a) => a.id).sort()).toEqual(['nbc-bp02:1', 'nbc-bp03:1'])

  // 3. The next sync retries cleanly and downloads bp03Leaf, then advances the watermark to t2.
  cloud.setOnBatchFetch(undefined)
  await syncWorkspace(true)
  await settle()
  expect(useWorkspace.getState().nbc_activities?.map((a) => a.id).sort()).toEqual(['nbc-bp02:1', 'nbc-bp03:1', 'nbc-bp03:1.1'])
  expect(local.meta.get(cloud.user)?.watermarks?.nbc_activities).toBe(t2)

  // 4. Even if a row is missing locally while the watermark is already at t2, syncWorkspace(true, true) reconciles it.
  useWorkspace.setState({ nbc_activities: [bp02Leaf as never] })
  await syncWorkspace(true, true)
  await settle()
  expect(useWorkspace.getState().nbc_activities?.map((a) => a.id).sort()).toEqual(['nbc-bp02:1', 'nbc-bp03:1', 'nbc-bp03:1.1'])
})
