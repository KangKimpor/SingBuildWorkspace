import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { failedChunkUrl, healStaleChunk, installChunkRecovery, isChunkLoadError, resetChunkHeal } from './chunkRecovery'

const FIREFOX = new TypeError('error loading dynamically imported module: https://singbuildworkspace.vercel.app/assets/hooks-CikKq20Y.js')
const CHROME = new TypeError('Failed to fetch dynamically imported module: https://example.test/assets/MaterialTracker-Ab12.js')
const SAFARI = new TypeError('Importing a module script failed.')

let cleanups: (() => void)[] = []

beforeEach(() => sessionStorage.clear())

afterEach(() => {
  while (cleanups.length) cleanups.pop()!()
  vi.useRealTimers()
})

test('recognises a chunk that failed to load in each browser, and names its file', () => {
  for (const e of [FIREFOX, CHROME, SAFARI]) expect(isChunkLoadError(e)).toBe(true)
  expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false)
  expect(failedChunkUrl(FIREFOX)).toBe('https://singbuildworkspace.vercel.app/assets/hooks-CikKq20Y.js')
  expect(failedChunkUrl(CHROME)).toBe('https://example.test/assets/MaterialTracker-Ab12.js')
  expect(failedChunkUrl(SAFARI)).toBeNull()
})

test('refetches the failed chunk past the cache, clears caches and reloads, once per 30 seconds', async () => {
  let t = 1_000_000
  const fetchImpl = vi.fn().mockResolvedValue(new Response(''))
  const clearCaches = vi.fn().mockResolvedValue(undefined)
  const reload = vi.fn()
  const opts = { fetchImpl, clearCaches, reload, now: () => t }

  expect(await healStaleChunk(FIREFOX, opts)).toBe(true)
  // `cache: 'reload'` replaces the bad cached copy (the HTML page stored under the chunk's name).
  expect(fetchImpl).toHaveBeenCalledWith('https://singbuildworkspace.vercel.app/assets/hooks-CikKq20Y.js', { cache: 'reload' })
  expect(clearCaches).toHaveBeenCalledTimes(1)
  expect(reload).toHaveBeenCalledTimes(1)

  // Still failing right after the reload: give up rather than loop.
  t += 5_000
  expect(await healStaleChunk(FIREFOX, opts)).toBe(false)
  expect(reload).toHaveBeenCalledTimes(1)

  // Later, or after the person presses Reload, it tries again.
  t += 30_000
  expect(await healStaleChunk(FIREFOX, opts)).toBe(true)
  resetChunkHeal()
  expect(await healStaleChunk(CHROME, opts)).toBe(true)
  expect(reload).toHaveBeenCalledTimes(3)
})

test('a refetch that fails still clears caches and reloads', async () => {
  const reload = vi.fn()
  await healStaleChunk(CHROME, { fetchImpl: vi.fn().mockRejectedValue(new Error('offline')), clearCaches: vi.fn().mockResolvedValue(undefined), reload })
  expect(reload).toHaveBeenCalledTimes(1)
})

test('cancels pending recovery on pagehide so aborted navigation does not reload or wipe caches', async () => {
  vi.useFakeTimers()
  const fetchImpl = vi.fn().mockResolvedValue(new Response(''))
  const clearCaches = vi.fn().mockResolvedValue(undefined)
  const reload = vi.fn()
  const onGiveUp = vi.fn()

  cleanups.push(installChunkRecovery(onGiveUp, { delayMs: 400, fetchImpl, clearCaches, reload }))

  const preloadEvent = Object.assign(new Event('vite:preloadError', { cancelable: true }), { payload: FIREFOX })
  window.dispatchEvent(preloadEvent)
  expect(preloadEvent.defaultPrevented).toBe(true)

  window.dispatchEvent(new Event('pagehide'))
  await vi.advanceTimersByTimeAsync(500)

  expect(fetchImpl).not.toHaveBeenCalled()
  expect(clearCaches).not.toHaveBeenCalled()
  expect(reload).not.toHaveBeenCalled()
  expect(onGiveUp).not.toHaveBeenCalled()
  expect(sessionStorage.getItem('kw-chunk-heal')).toBeNull()
})

test('heals an active-page chunk failure after the settle delay and gives up on repeat failure', async () => {
  vi.useFakeTimers()
  let t = 1_000_000
  const fetchImpl = vi.fn().mockResolvedValue(new Response(''))
  const clearCaches = vi.fn().mockResolvedValue(undefined)
  const reload = vi.fn()
  const onGiveUp = vi.fn()
  const opts = { delayMs: 400, fetchImpl, clearCaches, reload, now: () => t }

  const stopFirst = installChunkRecovery(onGiveUp, opts)
  cleanups.push(stopFirst)

  window.dispatchEvent(Object.assign(new Event('vite:preloadError', { cancelable: true }), { payload: FIREFOX }))
  await vi.advanceTimersByTimeAsync(399)
  expect(reload).not.toHaveBeenCalled()

  await vi.advanceTimersByTimeAsync(1)
  expect(fetchImpl).toHaveBeenCalledWith('https://singbuildworkspace.vercel.app/assets/hooks-CikKq20Y.js', { cache: 'reload' })
  expect(clearCaches).toHaveBeenCalledTimes(1)
  expect(reload).toHaveBeenCalledTimes(1)
  expect(onGiveUp).not.toHaveBeenCalled()
  stopFirst()

  t += 5_000
  cleanups.push(installChunkRecovery(onGiveUp, opts))
  const rejectionEvent = Object.assign(new Event('unhandledrejection', { cancelable: true }), { reason: SAFARI })
  window.dispatchEvent(rejectionEvent)
  expect(rejectionEvent.defaultPrevented).toBe(true)

  await vi.advanceTimersByTimeAsync(400)
  expect(reload).toHaveBeenCalledTimes(1)
  expect(onGiveUp).toHaveBeenCalledTimes(1)
})

test('re-enables chunk recovery when a page returns via pageshow after pagehide', async () => {
  vi.useFakeTimers()
  const fetchImpl = vi.fn().mockResolvedValue(new Response(''))
  const clearCaches = vi.fn().mockResolvedValue(undefined)
  const reload = vi.fn()
  const onGiveUp = vi.fn()

  cleanups.push(installChunkRecovery(onGiveUp, { delayMs: 400, fetchImpl, clearCaches, reload }))

  window.dispatchEvent(Object.assign(new Event('unhandledrejection', { cancelable: true }), { reason: SAFARI }))
  window.dispatchEvent(new Event('pagehide'))
  await vi.advanceTimersByTimeAsync(400)
  expect(reload).not.toHaveBeenCalled()

  window.dispatchEvent(new Event('pageshow'))
  window.dispatchEvent(Object.assign(new Event('vite:preloadError', { cancelable: true }), { payload: CHROME }))
  await vi.advanceTimersByTimeAsync(400)

  expect(fetchImpl).toHaveBeenCalledWith('https://example.test/assets/MaterialTracker-Ab12.js', { cache: 'reload' })
  expect(clearCaches).toHaveBeenCalledTimes(1)
  expect(reload).toHaveBeenCalledTimes(1)
  expect(onGiveUp).not.toHaveBeenCalled()
})
