import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { fetchPackage, saveCell, saveFields, saveRemark } from './api'
import { cache, remarkKey, useMat } from './store'
import type { MatState } from './store'
import type { MatItem } from './types'

vi.mock('./api', () => ({ fetchAccess: vi.fn(), fetchPackage: vi.fn(), saveCell: vi.fn(), saveFields: vi.fn(), saveRemark: vi.fn() }))

// Sunday 15 November 2026, 10:00 in Phnom Penh: the reporting week starts 2026-11-15.
const WEEK = '2026-11-15'
const NOW = '2026-11-15T03:00:00.000Z'
const item = (id: string, pos: number, edits: MatItem['edits'] = {}): MatItem => ({
  id, package: 'bp03', sheet: 'id', pos, kind: 'item',
  data: { cols: { description: `Sample panel ${id}` }, cells: { total: { v: 10 } } },
  edits, updatedAt: '2026-11-14T00:00:00.000Z',
})
const response = (over: Partial<Awaited<ReturnType<typeof fetchPackage>>> = {}) => ({ week: WEEK, now: NOW, items: [], remarks: [], ...over })
const deferred = <T,>() => {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

let stored: Map<string, MatState>
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(NOW))
  stored = new Map()
  vi.spyOn(cache, 'read').mockImplementation(async (pkg) => structuredClone(stored.get(pkg) ?? null))
  vi.spyOn(cache, 'write').mockImplementation(async (pkg, state) => { stored.set(pkg, structuredClone(state)) })
  vi.mocked(fetchPackage).mockResolvedValue(response({ items: [item('a', 1), item('b', 2)] }))
  vi.mocked(saveCell).mockResolvedValue()
  vi.mocked(saveFields).mockResolvedValue()
  vi.mocked(saveRemark).mockResolvedValue({ week: WEEK })
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.mocked(fetchPackage).mockReset(); vi.mocked(saveCell).mockReset(); vi.mocked(saveFields).mockReset(); vi.mocked(saveRemark).mockReset() })

async function mount() {
  const hook = renderHook(() => useMat('bp03'))
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  return hook
}
const edits = (state: MatState | null, id: string) => state?.items.find((i) => i.id === id)?.edits

test('the first load fetches everything and caches the result', async () => {
  const { result } = await mount()
  expect(fetchPackage).toHaveBeenCalledExactlyOnceWith('bp03', null, null)
  expect(result.current.state).toEqual({ week: WEEK, items: [item('a', 1), item('b', 2)], remarks: {}, syncedAt: NOW })
  expect(result.current.error).toBeNull()
  await waitFor(() => expect(stored.get('bp03')?.syncedAt).toBe(NOW))
})

test('a second mount sends the cached syncedAt less 10 seconds and merges the changed item', async () => {
  const first = await mount()
  await waitFor(() => expect(stored.has('bp03')).toBe(true))
  first.unmount()
  vi.mocked(fetchPackage).mockClear()
  const later = '2026-11-15T04:00:00.000Z'
  vi.mocked(fetchPackage).mockResolvedValue(response({ now: later, items: [item('b', 2, { po: 4 })] }))

  const { result } = await mount()
  expect(fetchPackage).toHaveBeenCalledExactlyOnceWith('bp03', '2026-11-15T02:59:50.000Z', '2026-11-15T02:59:50.000Z')
  expect(result.current.state?.items.map((i) => [i.id, i.edits])).toEqual([['a', {}], ['b', { po: 4 }]])
  expect(result.current.state?.syncedAt).toBe(later)
})

test('merged items keep sheet and position order and a repeated row is harmless', async () => {
  const first = await mount()
  await waitFor(() => expect(stored.has('bp03')).toBe(true))
  first.unmount()
  vi.mocked(fetchPackage).mockResolvedValue(response({ items: [item('c', 0), item('a', 1)] }))
  const { result } = await mount()
  expect(result.current.state?.items.map((i) => i.id)).toEqual(['c', 'a', 'b'])
})

test('the hook still loads when reading the cache throws', async () => {
  vi.mocked(cache.read).mockImplementation(() => { throw new Error('IndexedDB is unavailable') })
  const { result } = await mount()
  expect(fetchPackage).toHaveBeenCalledExactlyOnceWith('bp03', null, null)
  expect(result.current.state?.items).toHaveLength(2)
})

test('a failed load reports the error', async () => {
  vi.mocked(fetchPackage).mockRejectedValue(new Error('Not found'))
  const { result } = await mount()
  expect(result.current.error).toBe('Not found')
  expect(result.current.state).toBeNull()
})

test('setCell shows the value and this week\'s change mark before the save resolves', async () => {
  const { result } = await mount()
  const save = deferred<void>()
  vi.mocked(saveCell).mockReturnValue(save.promise)
  let done!: Promise<void>
  act(() => { done = result.current.setCell('a', 'po', 7) })
  expect(edits(result.current.state, 'a')).toEqual({ po: 7 })
  expect(result.current.state?.items.find((i) => i.id === 'a')?.changedWeek).toBe(WEEK)
  expect(result.current.saveStatus).toBe('saving')
  expect(saveCell).toHaveBeenCalledWith('a', 'po', 7)
  await act(async () => { save.resolve(); await done })
  expect(result.current.saveStatus).toBe('saved')
  expect(edits(result.current.state, 'a')).toEqual({ po: 7 })
})

test('setCell with null removes the override', async () => {
  vi.mocked(fetchPackage).mockResolvedValue(response({ items: [item('a', 1, { po: 3, shd: 1 })] }))
  const { result } = await mount()
  await act(() => result.current.setCell('a', 'po', null))
  expect(edits(result.current.state, 'a')).toEqual({ shd: 1 })
  expect(saveCell).toHaveBeenCalledWith('a', 'po', null)
})

test('a rejected saveCell restores the old value and rejects', async () => {
  vi.mocked(fetchPackage).mockResolvedValue(response({ items: [item('a', 1, { po: 3, shd: 1 })] }))
  const { result } = await mount()
  vi.mocked(saveCell).mockRejectedValue(new Error('Invalid value'))
  await act(async () => { await expect(result.current.setCell('a', 'po', 9)).rejects.toThrow('Invalid value') })
  expect(edits(result.current.state, 'a')).toEqual({ po: 3, shd: 1 })
  expect(result.current.saveStatus).toBe('error')
})

test('an older failed save does not clobber a newer edit to the same cell', async () => {
  const { result } = await mount()
  const older = deferred<void>()
  vi.mocked(saveCell).mockReturnValueOnce(older.promise).mockResolvedValueOnce()
  let first!: Promise<void>
  act(() => { first = result.current.setCell('a', 'po', 1) })
  await act(() => result.current.setCell('a', 'po', 2))
  await act(async () => { older.reject(new Error('Network down')); await expect(first).rejects.toThrow('Network down') })
  expect(edits(result.current.state, 'a')).toEqual({ po: 2 })
})

test('an edit made while a refresh is in flight survives the refresh', async () => {
  const { result } = await mount()
  const load = deferred<Awaited<ReturnType<typeof fetchPackage>>>()
  vi.mocked(fetchPackage).mockReturnValue(load.promise)
  let refreshing!: Promise<void>
  act(() => { refreshing = result.current.refresh() })
  await act(() => result.current.setCell('a', 'po', 5))
  await act(async () => { load.resolve(response({ items: [item('a', 1)] })); await refreshing })
  expect(edits(result.current.state, 'a')).toEqual({ po: 5 })
})

test('setRemark stores this week\'s remark at once', async () => {
  const { result } = await mount()
  await act(() => result.current.setRemark('a', 'pm', 'Supplier confirmed sample'))
  expect(result.current.state?.remarks).toEqual({ [remarkKey('a', 'pm', WEEK)]: 'Supplier confirmed sample' })
  expect(saveRemark).toHaveBeenCalledWith('a', 'pm', 'Supplier confirmed sample')
  expect(fetchPackage).toHaveBeenCalledTimes(1)
})

test('a failed saveRemark restores the previous remark and rejects', async () => {
  vi.mocked(fetchPackage).mockResolvedValue(response({ items: [item('a', 1)], remarks: [{ itemId: 'a', team: 'purchase', weekStart: WEEK, body: 'Waiting for quote' }] }))
  const { result } = await mount()
  vi.mocked(saveRemark).mockRejectedValue(new Error('Remark is too long'))
  await act(async () => { await expect(result.current.setRemark('a', 'purchase', 'x'.repeat(10))).rejects.toThrow('Remark is too long') })
  expect(result.current.state?.remarks).toEqual({ [remarkKey('a', 'purchase', WEEK)]: 'Waiting for quote' })
  expect(result.current.saveStatus).toBe('error')
})

test('saveRemark returning another week refreshes with remarksSince null', async () => {
  vi.mocked(fetchPackage).mockResolvedValueOnce(response({ week: '2026-11-08', items: [item('a', 1)] }))
  const { result } = await mount()
  const next = '2026-11-15T03:00:05.000Z'
  vi.mocked(fetchPackage).mockResolvedValueOnce(response({ now: next, remarks: [{ itemId: 'a', team: 'pm', weekStart: WEEK, body: 'Delivered' }] }))
  await act(() => result.current.setRemark('a', 'pm', 'Delivered'))
  await waitFor(() => expect(result.current.state?.week).toBe(WEEK))
  expect(fetchPackage).toHaveBeenCalledTimes(2)
  expect(fetchPackage).toHaveBeenLastCalledWith('bp03', '2026-11-15T02:59:50.000Z', null)
  expect(result.current.state?.remarks).toEqual({ [remarkKey('a', 'pm', WEEK)]: 'Delivered' })
})

test('a week change drops remarks older than two weeks', async () => {
  stored.set('bp03', {
    week: '2026-11-08', syncedAt: '2026-11-13T00:00:00.000Z', items: [item('a', 1)],
    remarks: {
      [remarkKey('a', 'pm', '2026-10-25')]: 'Older',
      [remarkKey('a', 'pm', '2026-11-01')]: 'Two weeks ago',
      [remarkKey('a', 'pm', '2026-11-08')]: 'Last week',
      [remarkKey('a', 'purchase', '2026-11-08')]: '',
    },
  })
  const { result } = await mount()
  expect(fetchPackage).toHaveBeenCalledExactlyOnceWith('bp03', '2026-11-12T23:59:50.000Z', null)
  expect(result.current.state?.week).toBe(WEEK)
  expect(result.current.state?.remarks).toEqual({
    [remarkKey('a', 'pm', '2026-11-01')]: 'Two weeks ago',
    [remarkKey('a', 'pm', '2026-11-08')]: 'Last week',
    [remarkKey('a', 'purchase', '2026-11-08')]: '',
  })
})

test('the page refreshes when it becomes visible after more than five minutes hidden', async () => {
  let visibility: DocumentVisibilityState = 'visible'
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
  const flip = (to: DocumentVisibilityState) => { visibility = to; document.dispatchEvent(new Event('visibilitychange')) }
  await mount()
  flip('hidden'); vi.setSystemTime(Date.parse(NOW) + 4 * 60000); flip('visible')
  expect(fetchPackage).toHaveBeenCalledTimes(1)
  flip('hidden'); vi.setSystemTime(Date.parse(NOW) + 10 * 60000); act(() => flip('visible'))
  await waitFor(() => expect(fetchPackage).toHaveBeenCalledTimes(2))
})

test('setCell accepts editable column keys including empty string overrides', async () => {
  const { result } = await mount()
  await act(() => result.current.setCell('a', 'msStatus', 'Approved'))
  expect(edits(result.current.state, 'a')).toEqual({ msStatus: 'Approved' })
  await act(() => result.current.setCell('a', 'msPlan', ''))
  expect(edits(result.current.state, 'a')).toEqual({ msStatus: 'Approved', msPlan: '' })
  expect(saveCell).toHaveBeenLastCalledWith('a', 'msPlan', '')
})

test('setFields applies optimistic updates, clears null keys, and rolls back on error', async () => {
  vi.mocked(fetchPackage).mockResolvedValue(response({ items: [item('a', 1, { brand: 'Old', po: 4 })] }))
  const { result } = await mount()
  await act(() => result.current.setFields('a', { code: 'XX-99', brand: null, image: ['storage:a/image/1.webp'] }))
  expect(edits(result.current.state, 'a')).toEqual({ po: 4, code: 'XX-99', image: ['storage:a/image/1.webp'] })
  expect(saveFields).toHaveBeenCalledWith('a', { code: 'XX-99', brand: null, image: ['storage:a/image/1.webp'] })

  vi.mocked(saveFields).mockRejectedValueOnce(new Error('Save failed'))
  await act(async () => {
    await expect(result.current.setFields('a', { code: 'BAD', pic: 'Dara' })).rejects.toThrow('Save failed')
  })
  expect(edits(result.current.state, 'a')).toEqual({ po: 4, code: 'XX-99', image: ['storage:a/image/1.webp'] })
  expect(result.current.saveStatus).toBe('error')
})
