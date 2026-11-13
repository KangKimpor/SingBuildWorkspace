import './activities.css'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronsDown, ChevronsUp, Maximize2, Minimize2, Search, X } from 'lucide-react'
import { GlassSelect } from '@/components/glass/GlassSelect'
import { useWorkspace } from '@/data'
import { pendingCollectionIds, syncWorkspace } from '@/data/sync'
import { WbsTable } from '../ui/WbsTable'
import { buildWbsRows } from '../wbs-table'
import { issuesEnabled } from '../features'
import { calculate } from '../progress'
import { RoomMatrix } from '../ui/RoomMatrix'
import { TableFooter } from '../ui/TableFooter'
import { floorPickerLabel, floorTabName, isRoomProject, roomFloors } from '../rooms'
import { percent } from '../format'
import { activityTags } from '../tags'
import { projectHandlers } from '../types'
import { activityHandlers } from '../handlers'
import type { NbcActivity } from '../types'
import { Issues } from './Issues'

/** Two-letter initials of the first handler in a label such as "Kheng, Sitha". */
function Avatar({ name }: { name: string }) {
  return <span className="nbc-av" aria-hidden="true" data-initials={name.split(',')[0]!.trim().slice(0, 2).toUpperCase()}/>
}

/** Handlers are shown in full; reassigning is not offered from this screen. */
function HandlerLabel({ a, activities }: { a: NbcActivity; activities: NbcActivity[] }) {
  const label = activityHandlers(a, activities)
  if (!a.editable) return <span className="nbc-group-handlers" title={label}>{label}</span>
  return <span className="nbc-handler" title={label}><Avatar name={label}/><span className="nbc-handler-text">{label}</span></span>
}

function RoomHandlerLabel({ label }: { label: string }) {
  return <span className="nbc-handler" title={label}><Avatar name={label}/><span className="nbc-handler-text">{label}</span></span>
}

type Calculation = ReturnType<typeof calculate>
interface Rollups { /** Live and start-of-week roll-ups, when the caller already has them (NbcProject does). */ live?: Calculation; before?: Calculation }

function ActivityTable({ projectId, activities, baseline, controls, rollups }: { projectId: string; activities: NbcActivity[]; baseline: Map<string, number>; controls?: ReactNode; rollups?: Rollups }) {
  const [params, setParams] = useSearchParams(), [query, setQuery] = useState(''), [changed, setChanged] = useState(false)
  const roomMode = useMemo(() => isRoomProject(activities), [activities])
  const floors = useMemo(() => roomMode ? roomFloors(activities) : [], [activities, roomMode])
  const [floorId, setFloorId] = useState('')
  // "/" jumps to search, the same shortcut as Update Progress.
  const search = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === '/' && !(e.target instanceof HTMLElement && e.target.closest('input,textarea,select,[contenteditable=true]'))) { e.preventDefault(); search.current?.focus() } }
    addEventListener('keydown', key); return () => removeEventListener('keydown', key)
  }, [])
  // Phones fold the handler filter behind a button; a filter already in the URL keeps it open.
  const [filtersOpen, setFiltersOpen] = useState(() => !!params.get('handler'))
  // A link to one activity (?wbs=…) opens the floor or panel that holds it, unless a floor was picked since.
  const wbsParam = params.get('wbs') ?? ''
  const wbsFloor = wbsParam ? floors.find((f) => f.rows.some((r) => r.leaves.some((l) => l.wbs === wbsParam))) : undefined
  // Floor, area and trade come from parent rows when a room cell leaves them blank (BP02), so Overview links match.
  const tags = useMemo(() => activityTags(activities), [activities])
  const locationParam = params.get('location') ?? ''
  const linkFloor = wbsFloor ?? (locationParam ? floors.find((f) => tags.get(f.root.id)?.location === locationParam) : undefined)
  // A floor holds up to ~2,000 cells; deferring the switch lets the pressed button paint first.
  const shownFloorId = useDeferredValue(floorId)
  const floor = floors.find((f) => f.root.id === shownFloorId) ?? linkFloor ?? floors[0]
  const pressedFloor = floors.find((f) => f.root.id === floorId) ?? linkFloor ?? floors[0]
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => params.toString() || isRoomProject(activities) ? new Set() : new Set(activities.filter((a) => !a.editable && a.parentId).map((a) => a.id)))
  const sync = useWorkspace((s) => s.sync), tasks = useWorkspace((s) => s.tasks), pending = pendingCollectionIds('nbc_activities')
  const handler = params.get('handler') ?? '', area = params.get('area') ?? '', location = params.get('location') ?? '', trade = params.get('trade') ?? '', wbs = params.get('wbs') ?? ''
  const byId = useMemo(() => new Map(activities.map((a) => [a.id, a])), [activities])
  const live = useMemo(() => rollups?.live ?? calculate(activities), [rollups?.live, activities]), before = useMemo(() => rollups?.before ?? calculate(activities, baseline), [rollups?.before, activities, baseline])
  useEffect(() => { if (params.toString()) setCollapsed(new Set()) }, [params])

  const deferredQuery = useDeferredValue(query), q = deferredQuery.trim().toLowerCase()
  // A search hit on a group brings its whole subtree.
  const textMatch = (a: NbcActivity) => { for (let n: NbcActivity | undefined = a; n; n = n.parentId ? byId.get(n.parentId) : undefined) if (`${n.wbs} ${n.name} ${n.description}`.toLowerCase().includes(q)) return true; return false }
  const leaf = (a: NbcActivity) => {
    const p = live.progress.get(a.id)!, b = before.progress.get(a.id)!
    return (!q || textMatch(a)) && (!handler || (a.handler || 'Unassigned') === handler) && (!area || tags.get(a.id)?.area === area) && (!location || tags.get(a.id)?.location === location) && (!trade || tags.get(a.id)?.trade === trade)
      && (!wbs || a.wbs === wbs || a.wbs.startsWith(`${wbs}.`)) && (!changed || Math.abs(p - b) > 1e-12)
  }
  const rows = roomMode ? [] : buildWbsRows(activities, { leaf, collapsed })
  const active = !!(q || handler || area || location || trade || wbs || changed)
  function filter(key: string, value: string) { setCollapsed(new Set()); const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next) }
  function clear() { setParams({}); setQuery(''); setChanged(false) }
  function toggle(id: string) { setCollapsed((old) => { const next = new Set(old); if (next.has(id)) next.delete(id); else next.add(id); return next }) }
  const selectFilters = handler ? 1 : 0
  const chips = (['area', 'location', 'trade', 'wbs'] as const).flatMap((key) => params.get(key) ? [{ key, label: params.get(key)! }] : [])

  return <section className="nbc-activities">
    <div className="nbc-filters">
      {floor && <div className="nbc-floor-row"><div className="nbc-seg" role="group" aria-label={floorPickerLabel(floors)}>{floors.map((f) => <button key={f.root.id} aria-pressed={f.root.id === pressedFloor!.root.id} aria-label={f.root.name} onClick={() => setFloorId(f.root.id)}>{floorTabName(f.root)}</button>)}</div></div>}
      <div className="nbc-filter-line">
      <label className="search-field"><Search size={16}/><input ref={search} aria-label="Search activities" placeholder="Search WBS or activity" value={query} onChange={(e) => { setQuery(e.target.value); setCollapsed(new Set()) }}/><kbd>/</kbd></label>
      <button className="nbc-chip nbc-filters-toggle" aria-expanded={filtersOpen} aria-controls="nbc-filter-selects" onClick={() => setFiltersOpen(!filtersOpen)}>Filters{selectFilters > 0 && <span className="nbc-filters-count">{selectFilters}</span>}</button>
      <div id="nbc-filter-selects" className="nbc-filter-selects" data-open={filtersOpen || undefined}>
      <GlassSelect aria-label="Assigned handler" value={handler} onChange={(e) => filter('handler', e.target.value)}><option value="">All handlers</option>{[...new Set([...projectHandlers(projectId), ...activities.filter((a) => a.editable).map((a) => a.handler || 'Unassigned')])].map((h) => <option key={h}>{h}</option>)}</GlassSelect>
      </div>
      <button className="nbc-chip" aria-pressed={changed} onClick={() => setChanged(!changed)}>Changed this week</button>
      {chips.map((c) => <button key={c.key} className="nbc-chip" aria-label={`Remove ${c.label} filter`} onClick={() => filter(c.key, '')}>{c.label}<X size={12}/></button>)}
      {active && <button className="text-link small" onClick={clear}>Clear all</button>}
      <div className="nbc-toolbar-actions">
        {controls}
        <button className="ibtn" title="Expand all" aria-label="Expand all" onClick={() => setCollapsed(new Set())}><ChevronsDown size={16}/></button>
        <button className="ibtn" title="Collapse all" aria-label="Collapse all" onClick={() => setCollapsed(new Set(activities.filter((a) => !a.editable).map((a) => a.id)))}><ChevronsUp size={16}/></button>
      </div>
      </div>
    </div>
    {sync.kind !== 'saved' && pending.size > 0 && <p className="small muted" role="status">{sync.kind === 'error' ? <>Save failed · <button className="text-link" onClick={() => void syncWorkspace(false)}>Retry</button></> : `Pending sync · ${pending.size}`}</p>}
    {roomMode && floor
      ? <RoomMatrix floor={floor} rowSignature={(row) => { let sig = ''; for (const [room, l] of row.cells) { const co = row.co.get(room), halves = co ? [l, co] : [l]; sig += `|${halves.some((h) => Math.abs((live.progress.get(h.id) ?? 0) - (before.progress.get(h.id) ?? 0)) > 1e-12) ? 'c' : ''}` } return sig }} caption={`${floor.root.name} activities by room`} collapsed={collapsed} onToggle={toggle} progress={live.progress} previous={before.progress}
          show={(row) => row.leaves.some(leaf)}
          cell={(l, _row, co) => percent(co ? (l.progress + co.progress) / 2 : l.progress, 0)}
          cellAttrs={(l, co) => {
            const halves = co ? [l, co] : [l], moved = halves.some((h) => Math.abs((live.progress.get(h.id) ?? 0) - (before.progress.get(h.id) ?? 0)) > 1e-12)
            return { 'data-changed': moved ? 'true' : undefined, 'data-done': halves.every((h) => h.progress === 1) ? 'true' : undefined }
          }}
          extra={[{ header: 'Handler', cell: (row) => {
            const label = [...new Set(row.leaves.map((l) => l.handler || 'Unassigned'))].join(', ')
            // A task shared 50/50 by two handlers keeps both of them, so it is not reassigned from here.
            return row.co.size ? <span title="Shared 50/50">{label} · 50/50</span> : <RoomHandlerLabel label={label}/>
          } }]}/>
      : rows.length === 0
      ? <div className="quiet-empty">No activities match these filters.<button className="text-link" onClick={clear}>Clear filters</button></div>
      : <WbsTable virtual rows={rows} caption="Activities by WBS" collapsed={collapsed} onToggle={toggle}
          previous={(a) => before.progress.get(a.id) ?? 0}
          current={(row) => percent(row.progress)}
          remark={({ activity: a }) => <span className="muted">{a.remark || '—'}</span>}
          rowAttrs={({ activity: a }) => ({ 'data-changed': a.editable && Math.abs((live.progress.get(a.id) ?? 0) - (before.progress.get(a.id) ?? 0)) > 1e-12 ? 'true' : undefined })}
          nameSuffix={({ activity: a }) => { const open = tasks.filter((t) => t.nbcActivityId === a.id && !t.deletedAt && t.status !== 'Done'); if (!open.length) return null; const label = `${open.length} issue${open.length > 1 ? 's' : ''}`; return issuesEnabled ? <Link className="nbc-pill" data-status="Issue" to={`/projects-progress/${projectId}/issues?wbs=${encodeURIComponent(a.wbs)}`} aria-label={`${open.length} open issues for ${a.wbs}`}>{label}</Link> : <span className="nbc-pill" data-status="Issue">{label}</span> }}
          extra={[{ header: 'Handler', cell: ({ activity: a }) => <><HandlerLabel a={a} activities={activities}/>{pending.has(a.id) && <span className="small muted"> · pending</span>}</> }]}/>}
    {(roomMode ? !!floor && floor.rows.some((r) => r.task && r.leaves.some(leaf)) : rows.length > 0) && <TableFooter triangle={roomMode} count={roomMode && floor ? floor.rows.filter((r) => r.task && r.leaves.some(leaf)).length : activities.filter((a) => a.editable && leaf(a)).length} legend={roomMode ? ['changed', 'na'] : ['changed']}/>}
  </section>
}

export default function Activities({ projectId, activities, baseline, view, rollups }: { projectId: string; activities: NbcActivity[]; baseline: Map<string, number>; view: 'activities' | 'issues'; rollups?: Rollups }) {
  const [expanded, setExpanded] = useState(false)
  if (view === 'issues') return <div className="nbc-activities-page"><Issues projectId={projectId} activities={activities} switcher={null}/></div>
  return <div className="nbc-activities-page" data-expanded={expanded}>
    <ActivityTable projectId={projectId} activities={activities} baseline={baseline} rollups={rollups} controls={
      <button className="nbc-chip nbc-expand-editor" aria-label={expanded ? 'Collapse editor' : 'Expand editor'} aria-pressed={expanded} onClick={() => setExpanded(!expanded)}>
        {expanded ? <Minimize2 size={15} aria-hidden="true" /> : <Maximize2 size={15} aria-hidden="true" />}
        <span className="nbc-expand-label">{expanded ? 'Collapse' : 'Expand'}</span>
      </button>}/>
  </div>
}
