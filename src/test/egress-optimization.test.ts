import { expect, test, vi, beforeEach } from 'vitest'

const cloud = vi.hoisted(() => {
  type Row = { id: string; data: Record<string, unknown>; updated_at: string }
  const records = new Map<string, Row>()
  const queries: { table: string; select: string; gte?: string; gt?: string; in?: string[]; projectId?: string }[] = []
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
      let selectFields = '', minimum = '', strictMinimum = false, projectFilter = '', inIds: Set<string> | null = null
      const visible = () => [...records.entries()].filter(([key, row]) => {
        if (!key.includes(`:${table.slice(3)}:`)) return false
        if (projectFilter && row.data.projectId !== projectFilter) return false
        return true
      }).map(([, row]) => row).filter((r) => !inIds || inIds.has(r.id))

      const query = {
        select: (fields: string) => {
          selectFields = fields
          queries.push({
            table,
            select: fields,
            get in() { return inIds ? [...inIds] : undefined },
            get gte() { return !strictMinimum && minimum ? minimum : undefined },
            get gt() { return strictMinimum && minimum ? minimum : undefined },
            get projectId() { return projectFilter || undefined },
          })
          return query
        },
        eq: (key: string, value: string) => {
          if (key === 'project_id') projectFilter = value
          return query
        },
        in: (key: string, values: string[]) => {
          if (key === 'id') inIds = new Set(values)
          return query
        },
        gte: (key: string, value: string) => {
          if (key === 'updated_at') { minimum = value; strictMinimum = false }
          return query
        },
        gt: (key: string, value: string) => {
          if (key === 'updated_at') { minimum = value; strictMinimum = true }
          return query
        },
        order: () => query,
        range: async (start: number, end: number) => {
          const rows = visible().filter((r) => !minimum || (strictMinimum ? r.updated_at > minimum : r.updated_at >= minimum)).map((r) => {
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
    rpc: vi.fn(async (_name: string, args: { collection?: string; record_id?: string; payload?: Record<string, unknown> }) => ({
      error: null,
      data: {
        conflict: false,
        row: { id: args?.record_id ?? 'row-1', updated_at: new Date(sequence += 1000).toISOString() },
      },
    })),
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
      pages: [
        { id: 'page-1', title: 'Page 1', blocks: [], parentId: null, icon: 'note', isFavorite: false, deletedAt: null, updatedAt: page1.updated_at },
        { id: 'page-2', title: 'Page 2', blocks: [], parentId: null, icon: 'note', isFavorite: false, deletedAt: null, updatedAt: page2.updated_at },
      ],
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

  const { initializeData, refreshCollections } = await import('@/data/sync')
  await initializeData()
  cloud.state.queries.length = 0

  await refreshCollections(['pages'], { full: true })

  const pageQueries = cloud.state.queries.filter((q) => q.table === 'kw_pages')
  expect(pageQueries.some((q) => q.select === 'id,updated_at')).toBe(true)
  expect(pageQueries.some((q) => q.select === 'id,data,updated_at')).toBe(false)
})

test('manifest reconcile prunes deleted rows from workspace', async () => {
  const { useWorkspace } = await import('@/data')
  const { refreshCollections, applyRemotePatch } = await import('@/data/sync')

  const page1 = cloud.state.row('pages', 'page-1', { title: 'Page 1', blocks: [] })
  applyRemotePatch({
    pages: [
      { id: 'page-1', title: 'Page 1', blocks: [], parentId: null, icon: 'note', isFavorite: false, deletedAt: null, updatedAt: page1.updated_at },
      { id: 'page-2', title: 'Page 2', blocks: [], parentId: null, icon: 'note', isFavorite: false, deletedAt: null, updatedAt: new Date().toISOString() },
    ],
  })

  cloud.state.records.delete('account-test:pages:page-2')
  cloud.state.queries.length = 0

  await refreshCollections(['pages'], { full: true })

  const pages = useWorkspace.getState().pages
  expect(pages.find((p) => p.id === 'page-2')).toBeUndefined()
  expect(pages.find((p) => p.id === 'page-1')).toBeDefined()
})

test('delta refresh skips downloading row data when Realtime already applied the update', async () => {
  const { applyRealtimeRow, refreshCollections } = await import('@/data/sync')
  const updated = cloud.state.row('pages', 'page-1', { title: 'Live via Realtime', blocks: [] })

  expect(applyRealtimeRow('pages', updated)).toBe(true)
  cloud.state.queries.length = 0

  await refreshCollections(['pages'])
  const dataQueries = cloud.state.queries.filter((q) => q.table === 'kw_pages' && q.select === 'id,data,updated_at')
  expect(dataQueries).toHaveLength(0)
})

test('changedAppliedActivityIds only retains appliedEntries that actually changed', async () => {
  const { changedAppliedActivityIds } = await import('@/data/sync')
  const ids = changedAppliedActivityIds([
    { activityId: 'a-unchanged', previous: 0.25, progress: 0.25, remark: '', previousRemark: '' },
    { activityId: 'a-progress-changed', previous: 0.25, progress: 0.5, remark: '', previousRemark: '' },
    { activityId: 'a-remark-changed', previous: 0.25, progress: 0.25, remark: 'New note', previousRemark: '' },
  ])
  expect([...ids]).toEqual(['a-progress-changed', 'a-remark-changed'])
})

test('an edit writes only the rows it changed, even when other rows are rebuilt with identical content', async () => {
  const { useWorkspace } = await import('@/data')
  const { applyRemotePatch, flushPending, pendingCollectionIds } = await import('@/data/sync')
  const activity = (id: string) => ({ id, projectId: 'nbc-bp03', wbs: id, parentId: null, order: 0, name: id, editable: true, relativeWeight: 1, globalWeight: 1, progress: 0, history: [], updatedAt: '2026-01-01T00:00:00.000Z' })
  applyRemotePatch({ nbc_activities: [activity('a-1'), activity('a-2'), activity('a-3')] as never })
  cloud.client.rpc.mockClear()
  const state = useWorkspace.getState(), [same, edited, rebuilt] = state.nbc_activities!
  // a-1 keeps its object, a-2 changes and a-3 is a fresh copy with the same content.
  state.commitNbc({ nbc_activities: [same!, { ...edited!, progress: 0.5 }, { ...rebuilt! }], nbc_submissions: state.nbc_submissions, nbc_summaries: state.nbc_summaries })
  expect([...pendingCollectionIds('nbc_activities')]).toEqual(['a-2'])
  await flushPending(() => pendingCollectionIds('nbc_activities').size > 0)
  const writes = cloud.client.rpc.mock.calls
    .filter(([name]) => name === 'kw_workspace_write')
    .map(([, args]) => `${args.collection}:${args.record_id}`)
  expect(writes).toEqual(['nbc_activities:a-2'])
})
