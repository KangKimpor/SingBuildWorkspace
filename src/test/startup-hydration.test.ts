import { expect, test, vi } from 'vitest'

// A reload after the access token expired: supabase-js refreshes the token while getSession() is
// pending and emits TOKEN_REFRESHED before the workspace has switched to the account. That event
// must not start a sync before the IndexedDB snapshot is restored, or the sync runs as a cold
// full pull (every page body, the whole BOQ manifest, sometimes all of BP02) on each such reload.
const cloud = vi.hoisted(() => {
  const user = 'account-race'
  const session = { user: { id: user, email: `${user}@singbuild.com` }, access_token: 'token' }
  const queries: { table: string; select: string; incremental: boolean }[] = []
  let listener: ((event: string, session: unknown) => void) | undefined
  const builder = (table: string) => {
    let select = '', incremental = false
    const query = {
      select(fields: string) { select = fields; return query },
      eq() { return query },
      in() { return query },
      gt() { incremental = true; return query },
      gte() { incremental = true; return query },
      order() { return query },
      async range() { queries.push({ table, select, incremental }); return { error: null, data: [] } },
    }
    return query
  }
  const client = {
    auth: {
      onAuthStateChange: vi.fn((fn: typeof listener) => { listener = fn }),
      getSession: vi.fn(async () => {
        listener?.('TOKEN_REFRESHED', session)
        return { data: { session }, error: null }
      }),
    },
    realtime: { setAuth: vi.fn(async () => {}) },
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })),
    removeChannel: vi.fn(async () => {}),
    from: vi.fn((table: string) => builder(table)),
    rpc: vi.fn(),
  }
  return { user, queries, client }
})

vi.mock('@/lib/supabase', () => ({
  supabase: cloud.client,
  hasStoredSession: () => true,
  initializeSupabase: async () => cloud.client,
}))

const stamp = '2026-11-06T04:20:14.000000+00:00'
vi.mock('@/data/persistence', async () => ({
  ...await vi.importActual<typeof import('@/data/persistence')>('@/data/persistence'),
  db: {
    snapshots: {
      // Reading a large BOQ snapshot from IndexedDB takes a while.
      get: async (scope: string) => {
        await new Promise((resolve) => setTimeout(resolve, 30))
        if (scope !== cloud.user) return undefined
        return {
          scope,
          content: {
            pages: [{ id: 'page-1', title: 'Notes', blocks: [], parentId: null, icon: 'note', isFavorite: false, deletedAt: null, updatedAt: stamp }],
            projects: [], tasks: [], scratchpad: '', taskViews: [],
            nbc_activities: [], nbc_submissions: [], nbc_summaries: [],
          },
          watermarks: { pages: stamp, projects: stamp, tasks: stamp, profiles: stamp },
          lastFullPull: new Date().toISOString(),
        }
      },
      put: async () => {},
    },
    outbox: { where: () => ({ equals: () => ({ toArray: async () => [] }) }), delete: async () => {} },
    versions: { get: async () => null, put: async () => {}, delete: async () => {} },
  },
}))

test('a token refresh during startup waits for the cached snapshot instead of pulling everything', async () => {
  const { initializeData } = await import('@/data/sync')
  const { useWorkspace } = await import('@/data')
  await initializeData()
  // Let the deferred auth-event handler and any sync it started finish.
  await new Promise((resolve) => setTimeout(resolve, 80))
  const { syncWorkspace } = await import('@/data/sync')
  await syncWorkspace(false)

  expect(useWorkspace.getState().scope).toBe(cloud.user)
  expect(useWorkspace.getState().pages.map((p) => p.id)).toEqual(['page-1'])
  expect(cloud.queries.length).toBeGreaterThan(0)
  const cold = cloud.queries.filter((q) => !q.incremental)
  expect(cold).toEqual([])
})
