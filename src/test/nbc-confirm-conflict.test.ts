import { beforeEach, expect, test, vi } from 'vitest'

const cloud = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: cloud.rpc }, hasStoredSession: () => true, initializeSupabase: async () => ({ rpc: cloud.rpc }) }))
// The operation itself is under test; the surrounding sync traffic is covered by cloud-sync.test.ts.
vi.mock('@/data/sync', async () => ({
  ...await vi.importActual<typeof import('@/data/sync')>('@/data/sync'),
  syncWorkspace: vi.fn(async () => {}), refreshCollections: vi.fn(async () => {}), pendingCollectionIds: () => new Set<string>(),
}))

const { fixtureActivities, fixtureProject } = await import('@/nbc/test-fixture')
const { useWorkspace } = await import('@/data')
const { confirmUpdate, draftEntries } = await import('@/nbc/submission-actions')
const { submissionId, weekStart } = await import('@/nbc/submissions')

const week = weekStart()
const id = submissionId(fixtureProject.id, week, 'Tola')
const serverDraft = (updatedAt: string) => ({ id, projectId: fixtureProject.id, weekStart: week, handler: 'Tola' as const, status: 'draft' as const, confirmedAt: null, confirmedBy: null, late: false, note: '', updatedAt, entries: draftEntries(week, 'Tola') })

beforeEach(() => {
  cloud.rpc.mockReset()
  useWorkspace.setState({ scope: 'account-a', projects: [fixtureProject], nbc_activities: fixtureActivities(), nbc_summaries: [] })
  useWorkspace.setState({ nbc_submissions: [serverDraft('2026-11-01T00:00:00+00:00')] })
})

test('a re-chained draft version confirms on the row the server reported instead of dead-ending', async () => {
  // Another handler's confirmation re-chained this draft and bumped updated_at; nothing this
  // handler wrote changed, and NBC rows are not live-subscribed, so the local copy is stale.
  const rechained = { ...serverDraft('2026-11-01T05:00:00.123456+00:00'), entries: draftEntries(week, 'Tola').map((e) => ({ ...e, previous: .3 })) }
  cloud.rpc.mockResolvedValueOnce({ error: null, data: { conflict: true, row: { id, data: rechained, updated_at: '2026-11-01T05:00:00.123456+00:00' } } })
  cloud.rpc.mockResolvedValueOnce({ error: null, data: { conflict: false, row: { id, data: { ...rechained, status: 'confirmed' }, updated_at: '2026-11-01T05:00:01+00:00' } } })
  await expect(confirmUpdate(week, 'Tola')).resolves.toBeTruthy()
  expect(cloud.rpc).toHaveBeenCalledTimes(2)
  expect(cloud.rpc.mock.calls[1]![1]).toMatchObject({ operation: 'confirm', expected: '2026-11-01T05:00:00.123456+00:00' })
})

test('a conflict that really holds another edit still asks for a review', async () => {
  const other = { ...serverDraft('2026-11-01T05:00:00+00:00'), entries: draftEntries(week, 'Tola').map((e) => ({ ...e, progress: .9 })) }
  cloud.rpc.mockResolvedValueOnce({ error: null, data: { conflict: true, row: { id, data: other, updated_at: '2026-11-01T05:00:00+00:00' } } })
  await expect(confirmUpdate(week, 'Tola')).rejects.toThrow('changed in another session')
  expect(cloud.rpc).toHaveBeenCalledTimes(1)
})
