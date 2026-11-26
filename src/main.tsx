import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { syncGlassToDocument } from './lib/glass'
import './styles/index.css'
import { hasStoredSession } from './lib/supabase'
import { useWorkspace } from './data'
import { afterFirstPaint } from './lib/paint'
import { useAccount } from './data/sync'
import { enforceLatestVersion, forceReloadLatest } from './lib/versionGate'
import { installChunkRecovery, resetChunkHeal } from './lib/chunkRecovery'
import type { VersionGateOutcome } from './lib/versionGate'
import { workspaceStart } from './shell/landing'
import { PHONE_QUERY } from './shell/usePhone'

syncGlassToDocument()
// Keep app gestures at a fixed scale; browser menu and OS magnification remain available.
document.addEventListener('wheel', (event) => {
  if (event.ctrlKey || event.metaKey) event.preventDefault()
}, { passive: false })
document.addEventListener('gesturestart', (event) => event.preventDefault(), { passive: false })
document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && ['+', '-', '=', '0'].includes(event.key)) event.preventDefault()
})

const rootEl = document.getElementById('root')!
const root = createRoot(rootEl)

/** Shown instead of a blank page when a part of the app still will not load after one automatic recovery (D-72). */
function ChunkErrorScreen() {
  return (
    <main className="page" role="alert" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: '24px', textAlign: 'center' }}>
      <div style={{ maxWidth: 420, display: 'grid', gap: 12, justifyItems: 'center' }}>
        <h1 className="t-h1" style={{ margin: 0 }}>Could not load this page</h1>
        <p className="muted" style={{ margin: 0 }}>Part of SingBuild Workspace did not load. Check your connection and reload.</p>
        <button type="button" className="btn-accent" onClick={() => { resetChunkHeal(); location.reload() }}>Reload</button>
      </div>
    </main>
  )
}
// A code chunk that fails to load (a stale cached copy after a deployment) refetches itself and reloads once,
// instead of leaving a blank page.
if (!import.meta.env.DEV) installChunkRecovery(() => root.render(<StrictMode><ChunkErrorScreen /></StrictMode>))

function VersionGateScreen({ outcome }: { outcome: Exclude<VersionGateOutcome, 'ok'> }) {
  const reloading = outcome === 'reloading'
  const outdated = outcome === 'blocked-outdated'
  return (
    <main
      className="page"
      role={reloading ? 'status' : 'alert'}
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: 420, display: 'grid', gap: 12, justifyItems: 'center' }}>
        <h1 className="t-h1" style={{ margin: 0 }}>
          {reloading ? 'Updating to the latest version…' : outdated ? 'Update required' : 'Latest version required'}
        </h1>
        <p className="muted" style={{ margin: 0 }}>
          {reloading
            ? 'Loading the newest release of SingBuild Workspace.'
            : outdated
              ? 'A newer version of SingBuild Workspace is available. This older version cannot be loaded.'
              : 'Could not verify that you are on the latest version. Check your connection and try again.'}
        </p>
        {!reloading && (
          <button
            type="button"
            className="btn-accent"
            onClick={() => void forceReloadLatest()}
          >
            {outdated ? 'Reload latest version' : 'Try again'}
          </button>
        )}
      </div>
    </main>
  )
}

const render = () => {
  if (location.pathname === '/' && useAccount.getState().session) {
    const { scope, projects } = useWorkspace.getState()
    history.replaceState(history.state, '', workspaceStart(scope, projects, matchMedia(PHONE_QUERY).matches))
  }
  root.render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
}

const FIRST_PAINT_WAIT_MS = 3000
const initialize = () =>
  import('./data/sync').then((module) => module.initializeData())

async function boot() {
  if (!import.meta.env.DEV) {
    // Every open or refresh must match the server's deployed version before mounting the app.
    const outcome = await enforceLatestVersion()
    if (outcome !== 'ok') {
      root.render(
        <StrictMode>
          <VersionGateScreen outcome={outcome} />
        </StrictMode>,
      )
      return
    }
    // Restoring from browser back-forward cache must also verify we are still on the latest version.
    window.addEventListener('pageshow', (event) => {
      if (!event.persisted) return
      void enforceLatestVersion().then((next) => {
        if (next !== 'ok') {
          root.render(
            <StrictMode>
              <VersionGateScreen outcome={next} />
            </StrictMode>,
          )
        }
      })
    })
  }

  if (
    hasStoredSession() ||
    /^\/settings\/(account|accounts)/.test(location.pathname)
  ) {
    // Signed-in users wait briefly so the right account paints first, but a slow or blocked
    // connection must never leave a blank page: initialization carries on after first paint.
    void Promise.race([initialize().catch(() => {}), new Promise((resolve) => setTimeout(resolve, FIRST_PAINT_WAIT_MS))]).then(render)
  } else {
    render()
    let guestInitialized = false
    const initializeGuest = () => {
      if (guestInitialized) return
      guestInitialized = true
      removeEventListener('click', initializeGuest, true)
      removeEventListener('keydown', initializeGuest, true)
      void initialize().catch(() => useWorkspace.setState({ storageError: true }))
    }
    addEventListener('click', initializeGuest, { once: true, capture: true })
    addEventListener('keydown', initializeGuest, { once: true, capture: true })
    const ready = async () => {
      if (guestInitialized) return
      const databases = typeof indexedDB !== 'undefined' && typeof indexedDB.databases === 'function'
        ? await indexedDB.databases().catch(() => null)
        : null
      if (!databases || databases.some((database) => database.name === 'kimpor-workspace')) {
        initializeGuest()
      }
    }
    afterFirstPaint(ready)
  }
}

void boot()
