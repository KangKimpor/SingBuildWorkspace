import './mat.css'
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronsDown, ChevronsUp, Maximize2, Minimize2, RefreshCw, Search } from 'lucide-react'
import { GlassSelect } from '@/components/glass/GlassSelect'
import { NotFound } from '@/components/NotFound'
import { Tile } from '@/components/WorkspaceUI'
import { weekLabel } from '@/nbc/submissions'
import { usePhone } from '@/shell/usePhone'
import { fetchAccess } from './api'
import { MatTable, codeOf, formatCol } from './MatTable'
import { MatSummary } from './MatSummary'
import type { OnCell, OnRemark } from './MatCells'
import { useMat } from './store'
import type { MatState, SaveStatus } from './store'
import type { MatItem, Pkg, Sheet } from './types'

type Tab = Extract<Sheet, 'id' | 'mep'> | 'summary'
type Mark = NonNullable<MatItem['data']['mark']>

const PACKAGES: { id: Pkg; label: string }[] = [{ id: 'bp03', label: 'BP03' }, { id: 'bp04', label: 'BP04' }]
/** The two material sheets and the summary they roll up to. The workbook's note sheets are not shown. */
const SHEETS: { id: Tab; label: string }[] = [
  { id: 'id', label: 'ID Material' }, { id: 'mep', label: 'MEP Material' }, { id: 'summary', label: 'Summary' },
]
/** The workbook legend (W1:W3): green, beige and yellow rows. */
export const MARKS: Record<Mark, string> = { done: 'Completed', tracking: 'On tracking', omit: 'Omitted' }
const SAVE_TEXT: Record<SaveStatus, string> = { idle: '', saving: 'Saving…', saved: 'Saved', error: 'Could not save' }
/** The app's pill carries the dot color; this page adds the error chip on top of it. */
const SAVE_TONE: Record<SaveStatus, string> = { idle: 'success', saving: 'busy', saved: 'success', error: 'error' }

function Skeleton() {
  return <div className="page"><div className="skeleton" style={{ height: 48 }}/><span className="sr-only" role="status">Opening the material list…</span></div>
}

/** /admin: the material list for the people on the access list. Everyone else sees the ordinary Not found page. */
export default function MaterialTracker() {
  const phone = usePhone()
  const [access, setAccess] = useState<boolean | null>(null)
  useEffect(() => {
    let live = true
    fetchAccess().then((ok) => { if (live) setAccess(ok) }, () => { if (live) setAccess(false) })
    return () => { live = false }
  }, [])
  if (access === null) return <Skeleton/>
  if (!access) return <NotFound/>
  if (phone) return <div className="page"><p className="quiet-empty">Open the material list on a tablet or computer.</p></div>
  return <MaterialList/>
}

function SaveState({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null
  return <span className="pill mat-save" data-tone={SAVE_TONE[status]} role="status">
    <span className="dot" aria-hidden="true"/>{SAVE_TEXT[status]}
  </span>
}

function MaterialList() {
  const [params, setParams] = useSearchParams()
  const pkg: Pkg = params.get('p') === 'bp04' ? 'bp04' : 'bp03'
  const tab = SHEETS.find((t) => t.id === params.get('s'))?.id ?? 'id'
  const [expanded, setExpanded] = useState(false)
  const { state, loading, error, saveStatus, refresh, setCell, setRemark } = useMat(pkg)
  const go = (nextPkg: Pkg, nextTab: Tab) => setParams({ p: nextPkg, s: nextTab })
  const isExpanded = expanded && tab !== 'summary'

  let body
  if (!state) {
    body = error
      ? <p className="mat-error" role="alert">Could not load the material list. {error}{' '}
        <button type="button" className="text-link" onClick={() => void refresh()}>Try again</button></p>
      : <div className="mat-loading" aria-hidden="true">
          <div className="skeleton mat-skeleton-bar"/>
          <div className="skeleton mat-skeleton"/>
        </div>
  } else if (tab === 'summary') {
    body = <MatSummary items={state.items}/>
  } else {
    body = <SheetView key={`${pkg}:${tab}`} sheet={tab} state={state} caption={`${pkg.toUpperCase()} ${SHEETS.find((t) => t.id === tab)!.label}`} expanded={isExpanded} onToggleExpand={() => setExpanded((e) => !e)} onCell={setCell} onRemark={setRemark}/>
  }

  return <div className="mat-page" data-expanded={isExpanded || undefined}>
    <header className="page-heading mat-heading">
      <div className="mat-heading-main">
        <Tile name="hard-hat" color="orange"/>
        <div>
          <h1 className="t-h1">Material list</h1>
          <p className="small muted mat-meta">
            <span>{pkg.toUpperCase()}</span>
            {state && <><span aria-hidden="true">·</span><span>Week {weekLabel(state.week)}</span></>}
            <SaveState status={saveStatus}/>
          </p>
        </div>
      </div>
      <div className="heading-actions">
        <button type="button" className="btn-secondary" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw size={14} aria-hidden="true" className={loading ? 'mat-spin' : undefined}/>{loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
    </header>
    <nav className="mat-tabs" aria-label="Material list">
      <div className="view-tabs" role="group" aria-label="Package">
        {PACKAGES.map((p) => <button key={p.id} type="button" className="view-tab" aria-current={p.id === pkg ? 'page' : undefined} onClick={() => go(p.id, tab)}>{p.label}</button>)}
      </div>
      <span className="mat-tabs-rule" aria-hidden="true"/>
      <div className="view-tabs" role="group" aria-label="Sheet">
        {SHEETS.map((t) => <button key={t.id} type="button" className="view-tab" aria-current={t.id === tab ? 'page' : undefined} onClick={() => go(pkg, t.id)}>{t.label}</button>)}
      </div>
    </nav>
    {state && error && <p className="mat-error" role="alert">Could not refresh. {error}</p>}
    {body}
  </div>
}

const text = (item: MatItem, key: 'pic' | 'msStatus') => formatCol(item.data.cols[key]).trim()
const distinct = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b))

interface SheetViewProps { sheet: Sheet; state: MatState; caption: string; expanded: boolean; onToggleExpand: () => void; onCell: OnCell; onRemark: OnRemark }

/** One material sheet: search, filters and expand controls above its table; item count and legend beneath it. */
function SheetView({ sheet, state, caption, expanded, onToggleExpand, onCell, onRemark }: SheetViewProps) {
  const items = state.items
  const rows = useMemo(() => items.filter((item) => item.sheet === sheet), [items, sheet])
  const [query, setQuery] = useState(''), [pic, setPic] = useState(''), [status, setStatus] = useState(''), [mark, setMark] = useState('')
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())
  const searchRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.target instanceof HTMLElement && e.target.closest('input,textarea,select,[contenteditable=true]')) return
      e.preventDefault()
      searchRef.current?.focus()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])
  const q = useDeferredValue(query).trim().toLowerCase()
  const options = useMemo(() => {
    const materials = rows.filter((row) => row.kind === 'item')
    const marks = (Object.keys(MARKS) as Mark[]).filter((m) => materials.some((row) => row.data.mark === m))
    return {
      pics: distinct(materials.map((row) => text(row, 'pic'))),
      statuses: distinct(materials.map((row) => text(row, 'msStatus'))),
      marks, unmarked: materials.some((row) => !row.data.mark),
      totalCount: materials.length,
    }
  }, [rows])
  const active = !!(q || pic || status || mark)
  const match = useMemo(() => !active ? null : (row: MatItem) =>
    (!q || `${codeOf(row)} ${formatCol(row.data.cols.description)}`.toLowerCase().includes(q))
    && (!pic || text(row, 'pic') === pic) && (!status || text(row, 'msStatus') === status)
    && (!mark || (row.data.mark ?? 'none') === mark), [active, q, pic, status, mark])
  const shownCount = useMemo(
    () => active ? rows.filter((row) => row.kind === 'item' && match?.(row)).length : options.totalCount,
    [active, rows, match, options.totalCount],
  )
  const toggleSection = useCallback((id: string) => setCollapsed((old) => {
    const next = new Set(old)
    if (!next.delete(id)) next.add(id)
    return next
  }), [])
  const expandAll = () => setCollapsed(new Set())
  const collapseAll = () => setCollapsed(new Set(rows.filter((r) => r.kind === 'section').map((r) => r.id)))
  const clear = () => { setQuery(''); setPic(''); setStatus(''); setMark('') }

  return <>
    <div className="mat-toolbar">
      <label className="search-field mat-search">
        <Search size={15} aria-hidden="true"/>
        <input ref={searchRef} type="search" aria-label="Search materials" placeholder="Search code or description" value={query} onChange={(e) => setQuery(e.target.value)}/>
        <kbd className="kbd" aria-hidden="true">/</kbd>
      </label>
      <GlassSelect aria-label="Person in charge" value={pic} onChange={(e) => setPic(e.target.value)}>
        <option value="">All people</option>{options.pics.map((v) => <option key={v}>{v}</option>)}
      </GlassSelect>
      <GlassSelect aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">All statuses</option>{options.statuses.map((v) => <option key={v}>{v}</option>)}
      </GlassSelect>
      <GlassSelect aria-label="Mark" value={mark} onChange={(e) => setMark(e.target.value)}>
        <option value="">All marks</option>
        {options.marks.map((m) => <option key={m} value={m}>{MARKS[m]}</option>)}
        {options.unmarked && <option value="none">No mark</option>}
      </GlassSelect>
      {active && shownCount > 0 && <button type="button" className="text-link small mat-clear" onClick={clear}>Clear filters</button>}
      <div className="mat-toolbar-actions">
        <button type="button" className="btn-secondary" onClick={onToggleExpand}>
          {expanded ? <Minimize2 size={14} aria-hidden="true"/> : <Maximize2 size={14} aria-hidden="true"/>}
          <span className="mat-expand-label">{expanded ? 'Collapse' : 'Expand'}</span>
        </button>
        <button type="button" className="ibtn" title="Expand all sections" aria-label="Expand all sections" onClick={expandAll}><ChevronsDown size={16} aria-hidden="true"/></button>
        <button type="button" className="ibtn" title="Collapse all sections" aria-label="Collapse all sections" onClick={collapseAll}><ChevronsUp size={16} aria-hidden="true"/></button>
      </div>
    </div>
    {active && shownCount === 0
      ? <div className="mat-scroll mat-empty-scroll">
          <p className="quiet-empty">No materials match these filters.{' '}
            <button type="button" className="text-link" onClick={clear}>Clear filters</button></p>
        </div>
      : <MatTable items={rows} state={state} match={match} caption={caption} collapsed={collapsed} onToggle={toggleSection} onCell={onCell} onRemark={onRemark}/>}
    <div className="mat-key-bar">
      <span role="status" aria-live="polite">
        {shownCount} {shownCount === 1 ? 'material' : 'materials'}
        {active && shownCount !== options.totalCount ? ` of ${options.totalCount}` : ''}
      </span>
      <ul className="mat-legend" aria-label="Legend">
        {(Object.keys(MARKS) as Mark[]).map((m) => <li key={m}><span className="mat-swatch" data-mark={m} aria-hidden="true"/>{MARKS[m]}</li>)}
        <li><span className="mat-swatch" data-mark="override" aria-hidden="true"/>Manual override</li>
      </ul>
    </div>
  </>
}
