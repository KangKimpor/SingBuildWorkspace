import { ChevronLeft, Search, Settings, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Glass } from '@/components/glass/Glass'
import { GlassPopover } from '@/components/glass/GlassPopover'
import { usePhoneHeaderState } from './phoneHeader'
import type { PhoneHeader } from './phoneHeader'
import { SyncGlyph } from './SyncGlyph'
import { useSyncView } from './TopBar'
import type { Crumb } from './TopBar'

const ic = { size: 22, strokeWidth: 1.75, 'aria-hidden': true } as const

function SyncButton() {
  const { sync, state, tone, text, retry } = useSyncView()
  return (
    <GlassPopover
      label="Save status"
      trigger={
        <button type="button" className="ibtn psync" data-tone={tone} data-state={state} data-testid="sync-pill">
          <SyncGlyph state={state} size={22} />
          <span className="sr-only">{text}</span>
        </button>
      }
    >
      <div className="psync-body" role="status">
        <p className="psync-text">{text}</p>
        {sync.kind === 'error' && <p className="psync-reason">{sync.reason}</p>}
        {retry && <button type="button" className="btn-secondary" onClick={retry}>Retry</button>}
      </div>
    </GlassPopover>
  )
}

const inSettings = /^\/settings(\/|$)/

/**
 * Phone top bar: back arrow, one-line title, the screen's actions, search, save state and Settings.
 * 48 px plus the safe area. Screens set it with usePhoneHeader; otherwise the route's crumb names it.
 */
export function PhoneTopBar({ crumb }: { crumb: Crumb }) {
  const registered = usePhoneHeaderState()
  const { pathname } = useLocation()
  const settings = inSettings.test(pathname)
  const fallbackTitle = settings ? 'Settings' : crumb.label
  const header: PhoneHeader = registered
    ? { ...registered, title: registered.title || fallbackTitle }
    : settings ? { title: 'Settings', back: '/projects-progress' } : { title: crumb.label }
  const [searchAt, setSearchAt] = useState<string | null>(null)
  const search = header.search
  // Search stays open while it holds a query, and closes when the screen changes.
  const searching = !!search && (searchAt === pathname || search.value !== '')

  return (
    <Glass as="header" material="thin" className="ptopbar" data-searching={searching || undefined}>
      {searching ? (
        <>
          <Search {...ic} className="ptopbar-search-icon" />
          <input
            className="ptopbar-search"
            type="search"
            enterKeyHint="search"
            autoFocus
            value={search.value}
            placeholder={search.placeholder}
            aria-label={search.placeholder}
            onChange={(e) => search.onChange(e.target.value)}
          />
          <button
            type="button"
            className="ibtn"
            aria-label="Close search"
            onClick={() => { setSearchAt(null); search.onChange('') }}
          >
            <X {...ic} />
          </button>
        </>
      ) : (
        <>
          {header.back && (
            <Link className="ibtn ptopbar-back" to={header.back} aria-label="Back">
              <ChevronLeft size={26} strokeWidth={1.75} aria-hidden="true" />
            </Link>
          )}
          <span className="ptopbar-title">{header.title}</span>
          <div className="ptopbar-actions">
            {header.actions}
            {search && (
              <button type="button" className="ibtn" aria-label={search.placeholder} onClick={() => setSearchAt(pathname)}>
                <Search {...ic} />
              </button>
            )}
            <SyncButton />
            {!header.back && !settings && (
              <Link className="ibtn" to="/settings/account" aria-label="Settings">
                <Settings {...ic} />
              </Link>
            )}
          </div>
        </>
      )}
    </Glass>
  )
}
