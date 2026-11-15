import { expect, test, vi } from 'vitest'

// D-37: a signed-in snapshot is one IndexedDB record per row. A change writes only the rows whose
// objects changed, a removed row is deleted, and the older whole-workspace record is converted once.
const local = vi.hoisted(() => {
  type RowRecord = { scope: string; collection: string; id: string; row: unknown }
  const rows = new Map<string, RowRecord>(), meta = new Map<string, unknown>()
  const snapshots = new Map<string, unknown>()
  const calls = { puts: [] as string[][], deletes: [] as string[][], fullDeletes: 0 }
  const key = (r: { scope: string; collection: string; id: string }) => `${r.scope}|${r.collection}|${r.id}`
  const db = {
    snapshots: { get: async (scope: string) => structuredClone(snapshots.get(scope)), put: async () => {}, delete: async (scope: string) => { snapshots.delete(scope) } },
    meta: { get: async (scope: string) => structuredClone(meta.get(scope)), put: async (value: { scope: string }) => { meta.set(value.scope, structuredClone(value)) } },
    rows: {
      where: () => ({ equals: (scope: string) => ({
        toArray: async () => [...rows.values()].filter((r) => r.scope === scope).map((r) => structuredClone(r)),
        delete: async () => { calls.fullDeletes++; for (const [k, r] of rows) if (r.scope === scope) rows.delete(k) },
      }) }),
      bulkPut: async (items: RowRecord[]) => { calls.puts.push(items.map((r) => `${r.collection}:${r.id}`)); for (const r of items) rows.set(key(r), structuredClone(r)) },
      bulkDelete: async (keys: [string, string, string][]) => { calls.deletes.push(keys.map(([, c, id]) => `${c}:${id}`)); for (const [s, c, id] of keys) rows.delete(key({ scope: s, collection: c, id })) },
    },
    transaction: async (...args: unknown[]) => (args[args.length - 1] as () => Promise<void>)(),
    outbox: { where: () => ({ equals: () => ({ toArray: async () => [] }) }), delete: async () => {} },
    versions: { get: async () => null, put: async () => {}, delete: async () => {} },
  }
  return { rows, meta, snapshots, calls, db }
})

const cloud = vi.hoisted(() => {
  const user = 'account-rows'
  const stamp = '2026-11-14T00:00:00.000000+00:00'
  const server = [
    { id: 'page-1', data: { id: 'page-1', title: 'One', blocks: [], parentId: null, icon: 'note', isFavorite: false, deletedAt: null }, updated_at: stamp },
    { id: 'page-2', data: { id: 'page-2', title: 'Two', blocks: [], parentId: null, icon: 'note', isFavorite: false, deletedAt: null }, updated_at: stamp },
  ]
  const session = { user: { id: user, email: `${user}@singbuild.com` }, access_token: 'token' }
  const builder = (table: string) => {
    let manifest = false
    const query = {
      select(fields: string) { manifest = fields === 'id,updated_at'; return query },
      eq() { return query }, in() { return query }, gt() { return query }, gte() { return query }, order() { return query },
      async range(start: number) {
        if (table !== 'kw_pages' || start > 0) return { error: null, data: [] }
        return { error: null, data: server.map((r) => manifest ? { id: r.id, updated_at: r.updated_at } : structuredClone(r)) }
      },
      // oxlint-disable-next-line unicorn/no-thenable -- Supabase query builders are awaitable.
      then: async (resolve: (value: unknown) => unknown) => resolve({ error: null, data: table === 'kw_pages' ? structuredClone(server) : [] }),
      maybeSingle: async () => ({ error: null, data: null }),
    }
    return query
  }
  const client = {
    auth: { onAuthStateChange: vi.fn(), getSession: vi.fn(async () => ({ data: { session }, error: null })) },
    realtime: { setAuth: vi.fn(async () => {}) },
    channel: vi.fn(() => { const channel = { on: () => channel, subscribe: (fn: (s: string) => void) => { queueMicrotask(() => fn('SUBSCRIBED')); return channel } }; return channel }),
    removeChannel: vi.fn(async () => {}),
    from: vi.fn((table: string) => builder(table)),
    rpc: vi.fn(),
  }
  return { user, stamp, server, client }
})

vi.mock('@/lib/supabase', () => ({ supabase: cloud.client, hasStoredSession: () => true, initializeSupabase: async () => cloud.client }))
vi.mock('@/data/persistence', async () => ({
  ...await vi.importActual<typeof import('@/data/persistence')>('@/data/persistence'),
  db: local.db,
}))

const settle = () => new Promise((resolve) => setTimeout(resolve, 20))

test('signed-in snapshots convert once, then write only changed rows and delete removed ones', async () => {
  const page = (id: string, title: string) => ({ id, title, blocks: [], parentId: null, icon: 'note', isFavorite: false, deletedAt: null, updatedAt: cloud.stamp })
  local.snapshots.set(cloud.user, {
    scope: cloud.user,
    content: { pages: [page('page-1', 'One'), page('page-2', 'Two')], projects: [], tasks: [], scratchpad: '', taskViews: [], nbc_activities: [], nbc_submissions: [], nbc_summaries: [] },
    watermarks: { pages: cloud.stamp, projects: cloud.stamp, tasks: cloud.stamp, profiles: cloud.stamp },
    lastFullPull: new Date().toISOString(),
  })
  const { initializeData, applyRemotePatch } = await import('@/data/sync')
  const { useWorkspace } = await import('@/data')
  await initializeData()
  await settle()
  dispatchEvent(new Event('pagehide'))
  await settle()
  // The legacy record became one row per page plus a meta record, and was removed.
  expect(local.snapshots.has(cloud.user)).toBe(false)
  expect([...local.rows.values()].map((r) => r.id).sort()).toEqual(['page-1', 'page-2'])
  expect(local.meta.get(cloud.user)).toMatchObject({ scope: cloud.user, watermarks: { pages: cloud.stamp } })

  local.calls.puts.length = 0; local.calls.deletes.length = 0; local.calls.fullDeletes = 0
  const [first, second] = useWorkspace.getState().pages
  applyRemotePatch({ pages: [{ ...first!, title: 'One, edited' }, second!] })
  dispatchEvent(new Event('pagehide'))
  await settle()
  expect(local.calls.puts.flat()).toEqual([`pages:${first!.id}`])
  expect(local.calls.fullDeletes).toBe(0)

  applyRemotePatch({ pages: [useWorkspace.getState().pages[0]!] })
  dispatchEvent(new Event('pagehide'))
  await settle()
  expect(local.calls.deletes.flat()).toEqual([`pages:${second!.id}`])
  expect([...local.rows.values()].map((r) => (r.row as { title: string }).title)).toEqual(['One, edited'])
})
