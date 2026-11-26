import { beforeEach, expect, test, vi } from 'vitest'
import { checkAppVersion, enforceLatestVersion, forceReloadLatest } from './versionGate'

const jsonResponse = (body: unknown, ok = true) =>
  ({ ok, json: async () => body }) as unknown as Response

beforeEach(() => {
  sessionStorage.clear()
})

test('allows loading when the server version matches the running bundle', async () => {
  const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ version: 'v2' }))
  const reload = vi.fn()
  const clearCaches = vi.fn().mockResolvedValue(undefined)

  const result = await checkAppVersion('v2', fetchImpl)
  expect(result).toEqual({ status: 'current', version: 'v2' })
  expect(fetchImpl).toHaveBeenCalledWith(
    expect.stringMatching(/^\/version\.json\?_t=\d+$/),
    expect.objectContaining({ cache: 'no-store' }),
  )

  const outcome = await enforceLatestVersion({ currentVersion: 'v2', fetchImpl, reload, clearCaches })
  expect(outcome).toBe('ok')
  expect(reload).not.toHaveBeenCalled()
  expect(clearCaches).not.toHaveBeenCalled()
})

test('clears caches and reloads when a newer version is deployed, and blocks if reloads still stay outdated', async () => {
  const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ version: 'v2' }))
  const reload = vi.fn()
  const clearCaches = vi.fn().mockResolvedValue(undefined)
  const now = () => 1_000_000

  // First two mismatches clear caches and reload into the latest build.
  expect(await enforceLatestVersion({ currentVersion: 'v1', fetchImpl, reload, clearCaches, now })).toBe('reloading')
  expect(await enforceLatestVersion({ currentVersion: 'v1', fetchImpl, reload, clearCaches, now })).toBe('reloading')
  expect(clearCaches).toHaveBeenCalledTimes(2)
  expect(reload).toHaveBeenCalledTimes(2)

  // If the client still receives an older bundle (e.g. stubborn proxy), refuse to mount and stop looping.
  expect(await enforceLatestVersion({ currentVersion: 'v1', fetchImpl, reload, clearCaches, now })).toBe('blocked-outdated')
  expect(reload).toHaveBeenCalledTimes(2)

  // Manual retry resets the guard, clears caches, and reloads.
  await forceReloadLatest(reload)
  expect(reload).toHaveBeenCalledTimes(3)
})

test('blocks loading when /version.json cannot be verified', async () => {
  const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'))
  const reload = vi.fn()
  const clearCaches = vi.fn().mockResolvedValue(undefined)

  expect(await enforceLatestVersion({ currentVersion: 'v1', fetchImpl, reload, clearCaches })).toBe('blocked-unreachable')
  expect(reload).not.toHaveBeenCalled()

  const badStatus = vi.fn().mockResolvedValue(jsonResponse({}, false))
  expect(await enforceLatestVersion({ currentVersion: 'v1', fetchImpl: badStatus, reload, clearCaches })).toBe('blocked-unreachable')
})
