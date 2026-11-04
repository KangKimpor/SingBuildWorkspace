import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useInstall } from './install'
import { announceUpdate, UPDATE_NOTICE_DELAY } from './update'

const visibility = (state: DocumentVisibilityState) =>
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state })

beforeEach(() => {
  useInstall.setState({ update: null })
  vi.useFakeTimers()
  visibility('visible')
})

afterEach(() => {
  vi.useRealTimers()
  visibility('visible')
})

test('the notice shows first, then the waiting update activates', async () => {
  const activate = vi.fn().mockResolvedValue(undefined)
  announceUpdate(activate)
  expect(useInstall.getState().update?.status).toBe('pending')
  expect(activate).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(UPDATE_NOTICE_DELAY)
  expect(useInstall.getState().update?.status).toBe('installing')
  expect(activate).toHaveBeenCalledTimes(1)
})

test('hidden tabs activate without waiting on the notice', async () => {
  visibility('hidden')
  const activate = vi.fn().mockResolvedValue(undefined)
  announceUpdate(activate)
  await vi.advanceTimersByTimeAsync(0)
  expect(useInstall.getState().update?.status).toBe('installing')
  expect(activate).toHaveBeenCalledTimes(1)
})

test('repeated discoveries do not schedule duplicate activations', async () => {
  const activate = vi.fn().mockResolvedValue(undefined)
  announceUpdate(activate)
  announceUpdate(activate)
  await vi.advanceTimersByTimeAsync(UPDATE_NOTICE_DELAY)
  expect(activate).toHaveBeenCalledTimes(1)
})

test('a failed activation can be retried from the notice', async () => {
  const activate = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined)
  announceUpdate(activate)
  await vi.advanceTimersByTimeAsync(UPDATE_NOTICE_DELAY)
  expect(useInstall.getState().update?.status).toBe('failed')
  await useInstall.getState().update?.apply()
  expect(activate).toHaveBeenCalledTimes(2)
  expect(useInstall.getState().update?.status).toBe('installing')
})
