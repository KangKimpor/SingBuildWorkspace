export type VersionCheckResult =
  | { status: 'current'; version: string }
  | { status: 'outdated'; current: string; latest: string }
  | { status: 'unreachable' }

export type VersionGateOutcome = 'ok' | 'reloading' | 'blocked-outdated' | 'blocked-unreachable'

const RELOAD_STORAGE_KEY = 'kw-version-reload'
const RELOAD_WINDOW_MS = 30_000
const MAX_AUTO_RELOADS = 2

interface ReloadGuard {
  target: string
  attempts: number
  at: number
}

function readGuard(): ReloadGuard | null {
  try {
    const raw = sessionStorage.getItem(RELOAD_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ReloadGuard>
    if (typeof parsed.target !== 'string' || typeof parsed.attempts !== 'number' || typeof parsed.at !== 'number') return null
    return { target: parsed.target, attempts: parsed.attempts, at: parsed.at }
  } catch {
    return null
  }
}

function writeGuard(guard: ReloadGuard | null) {
  try {
    if (!guard) sessionStorage.removeItem(RELOAD_STORAGE_KEY)
    else sessionStorage.setItem(RELOAD_STORAGE_KEY, JSON.stringify(guard))
  } catch {
    // Private browsing or blocked storage never stops the version gate.
  }
}

export async function fetchLatestVersion(fetchImpl: typeof fetch = fetch): Promise<string | null> {
  try {
    const response = await fetchImpl(`/version.json?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    })
    if (!response.ok) return null
    const data = (await response.json()) as { version?: unknown }
    return typeof data?.version === 'string' && data.version.trim() ? data.version.trim() : null
  } catch {
    return null
  }
}

export async function checkAppVersion(
  currentVersion: string = __APP_VERSION__,
  fetchImpl: typeof fetch = fetch,
): Promise<VersionCheckResult> {
  const latest = await fetchLatestVersion(fetchImpl)
  if (!latest) return { status: 'unreachable' }
  if (latest === currentVersion) return { status: 'current', version: latest }
  return { status: 'outdated', current: currentVersion, latest }
}

/** Drop any stale Service Worker registrations and Cache Storage entries before reloading into a newer deployment. */
export async function clearClientCaches(): Promise<void> {
  try {
    if ('serviceWorker' in navigator && typeof navigator.serviceWorker.getRegistrations === 'function') {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.unregister().catch(() => false)))
    }
  } catch {
    // Best-effort cleanup.
  }
  try {
    if (typeof caches !== 'undefined' && typeof caches.keys === 'function') {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key).catch(() => false)))
    }
  } catch {
    // Best-effort cleanup.
  }
}

export interface EnforceOptions {
  currentVersion?: string
  fetchImpl?: typeof fetch
  reload?: () => void
  clearCaches?: () => Promise<void>
  now?: () => number
}

/**
 * Verifies this bundle matches the server's deployed `/version.json` before the app mounts.
 * An outdated bundle clears client caches and reloads into the latest version (capped to avoid
 * infinite reload loops); an unreachable or still-outdated bundle blocks the app from loading.
 */
export async function enforceLatestVersion(options: EnforceOptions = {}): Promise<VersionGateOutcome> {
  const {
    currentVersion = __APP_VERSION__,
    fetchImpl = fetch,
    reload = () => location.reload(),
    clearCaches = clearClientCaches,
    now = () => Date.now(),
  } = options

  const result = await checkAppVersion(currentVersion, fetchImpl)
  if (result.status === 'current') {
    writeGuard(null)
    return 'ok'
  }
  if (result.status === 'unreachable') {
    return 'blocked-unreachable'
  }

  const ts = now()
  const prev = readGuard()
  const recentSameTarget = prev && prev.target === result.latest && ts - prev.at < RELOAD_WINDOW_MS
  const attempts = recentSameTarget ? prev.attempts : 0
  if (attempts >= MAX_AUTO_RELOADS) {
    return 'blocked-outdated'
  }

  writeGuard({ target: result.latest, attempts: attempts + 1, at: ts })
  await clearCaches()
  reload()
  return 'reloading'
}

export async function forceReloadLatest(reload: () => void = () => location.reload()): Promise<void> {
  writeGuard(null)
  await clearClientCaches()
  reload()
}
