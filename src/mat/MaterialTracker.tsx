import './mat.css'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { RefreshCw, Search } from 'lucide-react'
import { NotFound } from '@/components/NotFound'
import { weekLabel } from '@/nbc/submissions'
import { usePhone } from '@/shell/usePhone'
import { fetchAccess } from './api'
import { MatTable, codeOf, formatCol } from './MatTable'
import type { OnCell, OnRemark } from './MatCells'
import { useMat } from './store'
import type { MatState, SaveStatus } from './store'
import type { MatItem, Pkg, Sheet } from './types'

type Tab = Sheet | 'summary'
type Mark = NonNullable<MatItem['data']['mark']>

const PACKAGES: { id: Pkg; label: string }[] = [{ id: 'bp03', label: 'BP03' }, { id: 'bp04', label: 'BP04' }]
const notesTab = (pkg: Pkg): { id: Tab; label: string } => (pkg === 'bp03' ? { id: 'changelog', label: 'Change Log' } : { id: 'review', label: 'Review' })
const tabsOf = (pkg: Pkg): { id: Tab; label: string }[] => [
  { id: 'id', label: 'ID Material' }, { id: 'mep', label: 'MEP Material' }, { id: 'summary', label: 'Summary' }, notesTab(pkg),
]
/** The workbook legend (W1:W3): green, beige and yellow rows. */
export const MARKS: Record<Mark, string> = { done: 'Completed', tracking: 'On tracking', omit: 'Omitted' }
const SAVE_TEXT: Record<SaveStatus, string> = { idle: '', saving: 'Saving…', saved: 'Saved', error: 'Could not save' }

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
  if (phone) return <div className="page"><p>Open the material list on a tablet or computer.</p></div>
  return <MaterialList/>
}

function MaterialList() {
  const [params, setParams] = useSearchParams()
  const pkg: Pkg = params.get('p') === 'bp04' ? 'bp04' : 'bp03'
  const tabs = tabsOf(pkg)
  const tab = tabs.find((t) => t.id === params.get('s'))?.id ?? 'id'
  const { state, loading, error, saveStatus, refresh, setCell, setRemark } = useMat(pkg)
  // The notes tab has a different name in each package; switching package keeps you on it.
  const go = (nextPkg: Pkg, nextTab: Tab) =>
    setParams({ p: nextPkg, s: nextTab === 'changelog' || nextTab === 'review' ? notesTab(nextPkg).id : nextTab })

  let body
  if (!state) {
    body = error
      ? <div className="mat-empty" role="alert">Could not load the material list. {error} <button type="button" className="mat-link" onClick={() => void refresh()}>Try again</button></div>
      : <div className="skeleton mat-skeleton" aria-hidden="true"/>
  } else if (tab === 'summary' || tab === 'review' || tab === 'changelog') {
    body = <p className="mat-empty">{tabs.find((t) => t.id === tab)!.label} is not ready yet.</p>
  } else {
    body = <SheetView key={`${pkg}:${tab}`} sheet={tab} state={state} caption={`${pkg.toUpperCase()} ${tabs.find((t) => t.id === tab)!.label}`} onCell={setCell} onRemark={setRemark}/>
  }

  return <div className="mat-page">
    <header className="mat-header">
      <h1>Material list</h1>
      <p className="mat-meta">
        {state && <span>Week {weekLabel(state.week)}</span>}
        <span role="status" className="mat-save" data-status={saveStatus}>{SAVE_TEXT[saveStatus]}</span>
      </p>
      <button type="button" className="mat-button" onClick={() => void refresh()} disabled={loading}>
        <RefreshCw size={14} aria-hidden="true"/>{loading ? 'Refreshing…' : 'Refresh'}
      </button>
    </header>
    <nav className="mat-tabs" aria-label="Material list sheets">
      <div className="mat-seg" role="group" aria-label="Package">
        {PACKAGES.map((p) => <button key={p.id} type="button" aria-pressed={p.id === pkg} onClick={() => go(p.id, tab)}>{p.label}</button>)}
      </div>
      <div className="mat-seg" role="group" aria-label="Sheet">
        {tabs.map((t) => <button key={t.id} type="button" aria-pressed={t.id === tab} onClick={() => go(pkg, t.id)}>{t.label}</button>)}
      </div>
    </nav>
    {state && error && <p className="mat-error" role="alert">Could not refresh. {error}</p>}
    {body}
  </div>
}

const text = (item: MatItem, key: 'pic' | 'msStatus') => formatCol(item.data.cols[key]).trim()
const distinct = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b))

interface SheetViewProps { sheet: Sheet; state: MatState; caption: string; onCell: OnCell; onRemark: OnRemark }

/** One material sheet: search, filters and the mark legend above its table. */
function SheetView({ sheet, state, caption, onCell, onRemark }: SheetViewProps) {
  const items = state.items
  const rows = useMemo(() => items.filter((item) => item.sheet === sheet), [items, sheet])
  const [query, setQuery] = useState(''), [pic, setPic] = useState(''), [status, setStatus] = useState(''), [mark, setMark] = useState('')
  const q = useDeferredValue(query).trim().toLowerCase()
  const options = useMemo(() => {
    const materials = rows.filter((row) => row.kind === 'item')
    const marks = (Object.keys(MARKS) as Mark[]).filter((m) => materials.some((row) => row.data.mark === m))
    return {
      pics: distinct(materials.map((row) => text(row, 'pic'))),
      statuses: distinct(materials.map((row) => text(row, 'msStatus'))),
      marks, unmarked: materials.some((row) => !row.data.mark),
    }
  }, [rows])
  const active = !!(q || pic || status || mark)
  const match = useMemo(() => !active ? null : (row: MatItem) =>
    (!q || `${codeOf(row)} ${formatCol(row.data.cols.description)}`.toLowerCase().includes(q))
    && (!pic || text(row, 'pic') === pic) && (!status || text(row, 'msStatus') === status)
    && (!mark || (row.data.mark ?? 'none') === mark), [active, q, pic, status, mark])
  const count = match ? rows.filter((row) => row.kind === 'item' && match(row)).length : null
  const clear = () => { setQuery(''); setPic(''); setStatus(''); setMark('') }

  return <>
    <div className="mat-toolbar">
      <label className="mat-search"><Search size={15} aria-hidden="true"/>
        <input type="search" aria-label="Search materials" placeholder="Search code or description" value={query} onChange={(e) => setQuery(e.target.value)}/>
      </label>
      <select className="mat-select" aria-label="Person In Charge" value={pic} onChange={(e) => setPic(e.target.value)}>
        <option value="">All people</option>{options.pics.map((v) => <option key={v}>{v}</option>)}
      </select>
      <select className="mat-select" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">All statuses</option>{options.statuses.map((v) => <option key={v}>{v}</option>)}
      </select>
      <select className="mat-select" aria-label="Mark" value={mark} onChange={(e) => setMark(e.target.value)}>
        <option value="">All marks</option>
        {options.marks.map((m) => <option key={m} value={m}>{MARKS[m]}</option>)}
        {options.unmarked && <option value="none">No mark</option>}
      </select>
      {active && <button type="button" className="mat-link" onClick={clear}>Clear filters</button>}
      <ul className="mat-legend" aria-label="Row marks">
        {(Object.keys(MARKS) as Mark[]).map((m) => <li key={m}><span className="mat-swatch" data-mark={m} aria-hidden="true"/>{MARKS[m]}</li>)}
      </ul>
    </div>
    {count === 0
      ? <div className="mat-empty">No materials match these filters. <button type="button" className="mat-link" onClick={clear}>Clear filters</button></div>
      : <MatTable items={rows} state={state} match={match} caption={caption} onCell={onCell} onRemark={onRemark}/>}
  </>
}
