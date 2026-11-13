import { Check, PanelLeft, Search, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import {Glass} from '@/components/glass/Glass'
import { useSyncStatus, useWorkspace } from '@/data'
import { modKey, useShell } from './store'
import type { Breakpoint } from './store'
import { useWorkspaceUI } from './workspace'
import { Link } from 'react-router-dom'

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

export function TopBar({ crumb, bp }: { crumb: Crumb; bp: Breakpoint }) {
  const online = useOnline()
  // Project Progress keeps its top bar to the breadcrumb and save status; search stays on the keyboard shortcut.
  const progressScreen = crumb.parent === 'Projects Progress'
  const sync = useSyncStatus()
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
        <span
          className="pill"
          role="status"
          data-tone={!online || sync.kind === 'offline' ? 'warn' : sync.kind === 'saving' ? 'busy' : sync.kind === 'error' ? 'error' : 'success'}
          title={sync.kind === 'error' ? sync.reason : undefined}
          aria-label={sync.kind === 'error' ? `Save failed: ${sync.reason}` : undefined}
          data-testid="sync-pill"
        >
          {!online || sync.kind === 'offline' ? <WifiOff size={12} aria-hidden="true"/> : sync.kind === 'saved' ? <Check className="sync-check" size={12} aria-hidden="true"/> : <span className="dot" aria-hidden="true" />}
          <span key={!online?'offline':sync.kind}>{!online || sync.kind === 'offline' ? 'Offline' : sync.kind === 'saved'
            ? useWorkspace.getState().scope === 'guest'
              ? 'Demo · local'
              : 'Saved to cloud'
            : sync.kind === 'saving'
              ? 'Saving'
              : 'Error'}</span>
          {sync.kind === 'error' && online && <button className="text-link small" onClick={()=>void import('@/data/sync').then(({ syncWorkspace }) => syncWorkspace(false))}>Retry</button>}
        </span>
        {/* Pages put their own top-right actions here (Project Progress: Export XLSX). */}
        <div id="topbar-page-actions" className="topbar-page-actions"/>
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
