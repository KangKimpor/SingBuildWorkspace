import { PanelLeft, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import {Glass} from '@/components/glass/Glass'
import { useSyncStatus, useWorkspace } from '@/data'
import { modKey, useShell } from './store'
import type { Breakpoint } from './store'
import { useWorkspaceUI } from './workspace'
import { Link } from 'react-router-dom'
import { SyncGlyph } from './SyncGlyph'
import type { SyncVisualState } from './SyncGlyph'

const ic = { size: 18, strokeWidth: 1.75 } as const

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    addEventListener('online', on)
    addEventListener('offline', off)
    return () => {
      removeEventListener('online', on)
      removeEventListener('offline', off)
    }
  }, [])
  return online
}

function useScrolled(threshold: number) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > threshold)
    on()
    addEventListener('scroll', on, { passive: true })
    return () => removeEventListener('scroll', on)
  }, [threshold])
  return scrolled
}

export interface Crumb {
  label: string
  parent?: string
}

/** Save state shared by the desktop pill and the phone sync button. */
export function useSyncView() {
  const online = useOnline()
  const sync = useSyncStatus()
  const guest = useWorkspace((s) => s.scope === 'guest')
  const offline = !online || sync.kind === 'offline'
  const state: SyncVisualState = offline
    ? 'offline'
    : sync.kind === 'saving'
      ? 'saving'
      : sync.kind === 'error'
        ? 'error'
        : guest
          ? 'local'
          : 'saved'
  const tone = offline ? 'warn' : sync.kind === 'saving' ? 'busy' : sync.kind === 'error' ? 'error' : 'success'
  const pending = sync.kind === 'offline' ? sync.pending : 0
  const text = offline
    ? pending > 0 ? `Offline · ${pending} pending` : 'Offline'
    : sync.kind === 'saved'
      ? guest ? 'Demo · local' : 'Saved to cloud'
      : sync.kind === 'saving' ? 'Saving…' : 'Sync failed'
  const icon = <SyncGlyph state={state} size={17} />
  const retry = sync.kind === 'error' ? () => void import('@/data/sync').then(({ syncWorkspace }) => syncWorkspace(false)) : undefined
  return { online, sync, offline, state, tone, text, icon, retry }
}

export function TopBar({ crumb, bp }: { crumb: Crumb; bp: Breakpoint }) {
  // Project Progress keeps its top bar to the breadcrumb and save status; search stays on the keyboard shortcut.
  const progressScreen = crumb.parent === 'Projects Progress'
  const { sync, tone, retry } = useSyncView()
  const syncFailed = sync.kind === 'error'
  const compact = bp === 'compact'
  const scrolled = useScrolled(48)
  const { sidebarOpen, setSidebarOpen, setDrawerOpen } = useShell()
  const persistent = bp === 'expanded' || bp === 'large'

  const toggleSidebar = () =>
    persistent ? setSidebarOpen(!sidebarOpen) : setDrawerOpen(true)

  return (
    <Glass
      as="header"
      material="thin"
      className="topbar"
      data-collapsed={compact ? scrolled : true}
    >
      {
        <button
          type="button"
          className="ibtn sidebar-toggle"
          aria-label={
            persistent ? (sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar') : 'Open sidebar'
          }
          aria-pressed={persistent ? sidebarOpen : undefined}
          title={`Sidebar (${modKey()} \\)`}
          onClick={toggleSidebar}
        >
          <PanelLeft {...ic} />
        </button>
      }

      <nav
        className={`crumbs ${compact ? 'collapsed-title' : ''}`}
        aria-label="Breadcrumb"
      >
        <Link className="parent brand-crumb" to="/">
          SingBuild
        </Link>
        <span className="sep brand-crumb" aria-hidden="true">
          /
        </span>
        {crumb.parent ? (
          <>
            <span className="parent">{crumb.parent}</span>
            <span className="sep" aria-hidden="true">
              /
            </span>
          </>
        ) : null}
        <span className="current" aria-current="page" title={crumb.label}>
          {crumb.label}
        </span>
      </nav>

      <div className="actions">
        {syncFailed && (
          <span
            className="sync-pill"
            role="status"
            data-tone={tone}
            data-state="error"
            title={sync.reason}
            aria-label={`Sync failed: ${sync.reason}`}
            data-testid="sync-pill"
          >
            <span className="sync-pill-icon" aria-hidden="true">
              <SyncGlyph state="error" size={17} />
            </span>
            <button type="button" className="sync-retry" onClick={retry}>
              Retry
            </button>
          </span>
        )}
        {!progressScreen && (
          <button
            type="button"
            className="ibtn"
            aria-label="Open command palette"
            onClick={() => useWorkspaceUI.getState().setCommandOpen(true)}
          >
            <Search {...ic} />
          </button>
        )}
      </div>
    </Glass>
  )
}
