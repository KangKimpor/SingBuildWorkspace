import { clearClientCaches } from './versionGate'

/**
 * Recovers from a code chunk that will not load (D-72).
 *
 * A hashed file under /assets/ is cached for a year as immutable. If a browser ever asked for one before the
 * deployment that holds it was live, it got the SPA's index.html back (status 200, text/html) and kept that under
 * the chunk's name. From then on every dynamic import of that chunk fails ("disallowed MIME type"), the app stops
 * and the page stays blank, even after a hard reload. Firefox did exactly this on /admin on 26 November 2026.
 *
 * The fix: fetch the failed file again with `cache: 'reload'`, which goes to the network and replaces the bad
 * cache entry, drop service-worker caches, and reload once. If it still fails within a short window, the caller
 * shows a message with a Reload button instead of a blank page.
 */
const HEAL_KEY = 'kw-chunk-heal'
const HEAL_WINDOW_MS = 30_000
const NAVIGATE_SETTLE_MS = 400

/** Forgets the last heal, so the next failure (after the person presses Reload) refetches again. */
export function resetChunkHeal() {
  try { sessionStorage.removeItem(HEAL_KEY) } catch { /* storage blocked */ }
}

/** The script URL a failed dynamic import names, if any. */
export function failedChunkUrl(error: unknown): string | null {
  const text = error instanceof Error ? `${error.message} ${String(error.cause ?? '')}` : String(error ?? '')
  const match = /(https?:\/\/[^\s"'”)]+\.m?js)/.exec(text)
  return match ? match[1]! : null
}

/** Whether an error is a code chunk that failed to load, in the wording each browser uses. */
export function isChunkLoadError(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error ?? '')
  return /dynamically imported module|Importing a module script failed|Failed to fetch dynamically|error loading dynamically|Unable to preload CSS/i.test(text)
}

function recentHeal(now: number): boolean {
  try {
    const at = Number(sessionStorage.getItem(HEAL_KEY))
    return Number.isFinite(at) && at > 0 && now - at < HEAL_WINDOW_MS
  } catch {
    return false
  }
}
function markHeal(now: number) {
  try { sessionStorage.setItem(HEAL_KEY, String(now)) } catch { /* storage blocked: the window guard is best effort */ }
}

export interface HealOptions {
  fetchImpl?: typeof fetch
  clearCaches?: () => Promise<void>
  reload?: () => void
  now?: () => number
}

/**
 * Refetches the failed chunk past the cache and reloads. Returns false, without reloading, when a heal already ran in
 * the last 30 seconds: the problem is not a stale cache, and reloading again would loop.
 */
export async function healStaleChunk(error: unknown, options: HealOptions = {}): Promise<boolean> {
  const { fetchImpl = fetch, clearCaches = clearClientCaches, reload = () => location.reload(), now = () => Date.now() } = options
  const at = now()
  if (recentHeal(at)) return false
  markHeal(at)
  const url = failedChunkUrl(error)
  if (url) await fetchImpl(url, { cache: 'reload' }).catch(() => undefined)
  await clearCaches()
  reload()
  return true
}

export interface InstallOptions extends HealOptions {
  delayMs?: number
}

/**
 * Listens for chunks that fail to load: Vite's `vite:preloadError` and, for imports outside its preload helper, an
 * unhandled rejection that reads like one. `onGiveUp` runs when a heal already ran and the chunk still fails.
 *
 * Waits briefly before healing and cancels on `pagehide` so navigations that abort in-flight imports (e.g. WebKit)
 * do not wipe caches or reload the frame back to the old URL.
 */
export function installChunkRecovery(onGiveUp: () => void, options: InstallOptions = {}): () => void {
  const { delayMs = NAVIGATE_SETTLE_MS, reload = () => location.reload(), ...healOptions } = options
  // One failure often arrives twice (the preload event, then the rejected import): handle it once.
  let busy = false
  let leaving = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const onPageHide = () => {
    leaving = true
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
  }
  const onPageShow = (event: PageTransitionEvent) => {
    if (!leaving && !event.persisted) return
    leaving = false
    busy = false
  }
  const handle = (error: unknown) => {
    if (busy || leaving) return
    busy = true
    timer = setTimeout(() => {
      timer = undefined
      if (leaving) {
        busy = false
        return
      }
      void healStaleChunk(error, { ...healOptions, reload: () => { if (!leaving) reload() } }).then((reloading) => {
        if (!reloading && !leaving) onGiveUp()
      })
    }, delayMs)
  }
  const onPreloadError = (event: Event) => {
    event.preventDefault()
    handle((event as Event & { payload?: unknown }).payload)
  }
  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    if (!isChunkLoadError(event.reason)) return
    event.preventDefault()
    handle(event.reason)
  }
  addEventListener('pagehide', onPageHide)
  addEventListener('pageshow', onPageShow)
  addEventListener('vite:preloadError', onPreloadError)
  addEventListener('unhandledrejection', onUnhandledRejection)
  return () => {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
    removeEventListener('pagehide', onPageHide)
    removeEventListener('pageshow', onPageShow)
    removeEventListener('vite:preloadError', onPreloadError)
    removeEventListener('unhandledrejection', onUnhandledRejection)
  }
}
