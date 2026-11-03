import { expect, test, vi, beforeEach } from 'vitest'

const cloud = vi.hoisted(() => {
  type Row = { id: string; data: Record<string, unknown>; updated_at: string }
  const records = new Map<string, Row>()
  const queries: { table: string; select: string; gte?: string; in?: string[] }[] = []
  let sequence = Date.parse('2026-01-01T00:00:00Z')
  const session = (id: string) => ({ user: { id }, access_token: `token-${id}` })
  const state = {
    scope: 'account-test',
    records,
    queries,
    session,
    row(collection: string, id: string, data: Record<string, unknown>, owner?: string): Row {
      const row = { id, data: { ...data, id }, updated_at: new Date(sequence += 1000).toISOString() }
      records.set(`${owner ?? state.scope}:${collection}:${id}`, row)
      return row
    },
  }
  const client = {
    auth: {
      onAuthStateChange: vi.fn(),
      getSession: vi.fn(async () => ({ data: { session: session(state.scope) }, error: null })),
    },
    realtime: { setAuth: vi.fn(async () => {}) },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn((fn) => { queueMicrotask(() => fn('SUBSCRIBED')) }),
    })),
    removeChannel: vi.fn(async () => {}),
    from: vi.fn((table: string) => {
      let selectFields = '', minimum = '', inIds: Set<string> | null = null
      const visible = () => [...records.entries()].filter(([key]) => {
        return key.includes(`:${table.slice(3)}:`)
      }).map(([, row]) => row).filter((r) => !inIds || inIds.has(r.id))

      const query = {
        select: (fields: string) => {
          selectFields = fields
          queries.push({ table, select: fields, get in() { return inIds ? [...inIds] : undefined }, get gte() { return minimum || undefined } })
          return query
        },
        eq: () => query,
        in: (key: string, values: string[]) => {
          if (key === 'id') inIds = new Set(values)
          return query
        },
        gte: (key: string, value: string) => {
          if (key === 'updated_at') minimum = value
          return query
        },
        order: () => query,
        range: async (start: number, end: number) => {
          const rows = visible().filter((r) => !minimum || r.updated_at >= minimum).map((r) => {
            if (selectFields === 'id,updated_at') return { id: r.id, updated_at: r.updated_at }
            return structuredClone(r)
          }).slice(start, end + 1)
          return { error: null, data: rows }
        },
        maybeSingle: async () => ({ error: null, data: visible()[0] ?? null }),
        // oxlint-disable-next-line unicorn/no-thenable
        then: async (resolve: (val: unknown) => unknown) => {
          const rows = visible().map((r) => selectFields === 'id,updated_at' ? { id: r.id, updated_at: r.updated_at } : structuredClone(r))
          return resolve({ error: null, data: rows })
        },
      }
      return query
    }),
    rpc: vi.fn(async () => ({ error: null, data: { conflict: false, row: null } })),
  }
  return { state, client }
})

vi.mock('@/lib/supabase', () => ({
  supabase: cloud.client,
  hasStoredSession: () => true,
  initializeSupabase: async () => cloud.client,
}))

let mockSnapshot: { scope: string; content: any; watermarks?: Record<string, string>; lastFullPull?: string } | null = null
vi.mock('@/data/persistence', async () => ({
  ...await vi.importActual<typeof import('@/data/persistence')>('@/data/persistence'),
  collections: ['pages', 'projects', 'tasks', 'events', 'nbc_activities', 'nbc_submissions', 'nbc_summaries'],
  db: {
    snapshots: {
      get: async () => mockSnapshot ? structuredClone(mockSnapshot) : null,
      put: async (_item: any) => {},
    },
    outbox: {
      where: () => ({ equals: () => ({ toArray: async () => [] }) }),
      delete: async () => {},
    },
    versions: { get: async () => null, put: async () => {}, delete: async () => {} },
  },
}))

beforeEach(() => {
  cloud.state.queries.length = 0
  cloud.state.records.clear()
})

test('manifest reconcile only queries id,updated_at for large collections and does not refetch unchanged rows', async () => {
  const page1 = cloud.state.row('pages', 'page-1', { title: 'Page 1', blocks: [] })
  const page2 = cloud.state.row('pages', 'page-2', { title: 'Page 2', blocks: [] })

  mockSnapshot = {
    scope: 'account-test',
    content: {
      pages: [{ id: 'page-1', title: 'Page 1', blocks: [], parentId: null, icon: 'note', isFavorite: false, deletedAt: null, updatedAt: page1.updated_at },
               { id: 'page-2', title: 'Page 2', blocks: [], parentId: null, icon: 'note', isFavorite: false, deletedAt: null, updatedAt: page2.updated_at }],
      projects: [{ id: 'nbc-bp03', name: 'BP03', nbcBp03: true, workspace: 'team', color: 'blue', progress: 0, description: '', target: '', status: 'Planned' }],
      tasks: [],
      events: [],
      nbc_activities: [],
      nbc_submissions: [],
      nbc_summaries: [],
      scratchpad: '',
      taskViews: [],
    },
    watermarks: { pages: page2.updated_at },
    lastFullPull: new Date().toISOString(),
  }

  const { initializeData } = await import('@/data/sync')
  await initializeData()

  const { refreshCollections } = await import('@/data/sync')
  cloud.state.queries.length = 0

  // Trigger a full reconcile of pages
  await refreshCollections(['pages'], { full: true })

  // It should have queried only id,updated_at manifest
  const pageQueries = cloud.state.queries.filter((q) => q.table === 'kw_pages')
  expect(pageQueries.some((q) => q.select === 'id,updated_at')).toBe(true)
  // No changed rows, so no id,data,updated_at query was made
  expect(pageQueries.some((q) => q.select === 'id,data,updated_at')).toBe(false)
})

test('manifest reconcile prunes deleted rows from workspace', async () => {
  const { useWorkspace } = await import('@/data')
  const { refreshCollections } = await import('@/data/sync')

  const page1 = cloud.state.row('pages', 'page-1', { title: 'Page 1', blocks: [] })
  const { applyRemotePatch } = await import('@/data/sync')
  applyRemotePatch({
    pages: [
      { id: 'page-1', title: 'Page 1', blocks: [], parentId: null, icon: 'note', isFavorite: false, deletedAt: null, updatedAt: page1.updated_at },
      { id: 'page-2', title: 'Page 2', blocks: [], parentId: null, icon: 'note', isFavorite: false, deletedAt: null, updatedAt: new Date().toISOString() },
    ],
  })

  // Cloud only has page-1 now; page-2 was deleted on server
  cloud.state.records.delete('account-test:pages:page-2')
  cloud.state.queries.length = 0

  await refreshCollections(['pages'], { full: true })

  // page-2 should be removed from local state
  const pages = useWorkspace.getState().pages
  expect(pages.find((p) => p.id === 'page-2')).toBeUndefined()
  expect(pages.find((p) => p.id === 'page-1')).toBeDefined()
})
