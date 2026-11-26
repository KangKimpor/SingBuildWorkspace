import { beforeEach, expect, test, vi } from 'vitest'
import { failedChunkUrl, healStaleChunk, isChunkLoadError, resetChunkHeal } from './chunkRecovery'

const FIREFOX = new TypeError('error loading dynamically imported module: https://singbuildworkspace.vercel.app/assets/hooks-CikKq20Y.js')
const CHROME = new TypeError('Failed to fetch dynamically imported module: https://example.test/assets/MaterialTracker-Ab12.js')
const SAFARI = new TypeError('Importing a module script failed.')

beforeEach(() => sessionStorage.clear())

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
