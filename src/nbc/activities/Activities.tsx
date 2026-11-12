import './activities.css'
import { useEffect, useMemo, useState } from 'react'
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

function ActivityTable({ projectId, activities, baseline, controls }: { projectId: string; activities: NbcActivity[]; baseline: Map<string, number>; controls?: ReactNode }) {
  const [params, setParams] = useSearchParams(), [query, setQuery] = useState(''), [changed, setChanged] = useState(false)
  const roomMode = useMemo(() => isRoomProject(activities), [activities])
  const floors = useMemo(() => roomMode ? roomFloors(activities) : [], [activities, roomMode])
  const [floorId, setFloorId] = useState('')
  // Phones fold the handler filter behind a button; a filter already in the URL keeps it open.
  const [filtersOpen, setFiltersOpen] = useState(() => !!params.get('handler'))
  // A link to one activity (?wbs=…) opens the floor or panel that holds it, unless a floor was picked since.
  const wbsParam = params.get('wbs') ?? ''
  const wbsFloor = wbsParam ? floors.find((f) => f.rows.some((r) => r.leaves.some((l) => l.wbs === wbsParam))) : undefined
  const floor = floors.find((f) => f.root.id === floorId) ?? wbsFloor ?? floors[0]
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => params.toString() || isRoomProject(activities) ? new Set() : new Set(activities.filter((a) => !a.editable && a.parentId).map((a) => a.id)))
  const sync = useWorkspace((s) => s.sync), tasks = useWorkspace((s) => s.tasks), pending = pendingCollectionIds('nbc_activities')
  const handler = params.get('handler') ?? '', area = params.get('area') ?? '', location = params.get('location') ?? '', trade = params.get('trade') ?? '', wbs = params.get('wbs') ?? ''
  const byId = useMemo(() => new Map(activities.map((a) => [a.id, a])), [activities])
  const live = useMemo(() => calculate(activities), [activities]), before = useMemo(() => calculate(activities, baseline), [activities, baseline])
  useEffect(() => { if (params.toString()) setCollapsed(new Set()) }, [params])

  const q = query.trim().toLowerCase()
  // A search hit on a group brings its whole subtree.
  const textMatch = (a: NbcActivity) => { for (let n: NbcActivity | undefined = a; n; n = n.parentId ? byId.get(n.parentId) : undefined) if (`${n.wbs} ${n.name} ${n.description}`.toLowerCase().includes(q)) return true; return false }
  const leaf = (a: NbcActivity) => {
    const p = live.progress.get(a.id)!, b = before.progress.get(a.id)!
    return (!q || textMatch(a)) && (!handler || (a.handler || 'Unassigned') === handler) && (!area || a.area === area) && (!location || a.location === location) && (!trade || a.trade === trade)
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
      {floor && <div className="nbc-seg" role="group" aria-label={floorPickerLabel(floors)}>{floors.map((f) => <button key={f.root.id} aria-pressed={f.root.id === floor.root.id} aria-label={f.root.name} onClick={() => setFloorId(f.root.id)}>{floorTabName(f.root)}</button>)}</div>}
      <label className="search-field"><Search size={16}/><input aria-label="Search activities" placeholder="Search activity" value={query} onChange={(e) => { setQuery(e.target.value); setCollapsed(new Set()) }}/></label>
      <button className="nbc-chip nbc-filters-toggle" aria-expanded={filtersOpen} aria-controls="nbc-filter-selects" onClick={() => setFiltersOpen(!filtersOpen)}>Filters{selectFilters > 0 && <span className="nbc-filters-count">{selectFilters}</span>}</button>
      <div id="nbc-filter-selects" className="nbc-filter-selects" data-open={filtersOpen || undefined}>
      <GlassSelect aria-label="Assigned handler" value={handler} onChange={(e) => filter('handler', e.target.value)}><option value="">All handlers</option>{[...new Set([...projectHandlers(projectId), ...activities.filter((a) => a.editable).map((a) => a.handler || 'Unassigned')])].map((h) => <option key={h}>{h}</option>)}</GlassSelect>
      </div>
      <button className="nbc-chip" aria-pressed={changed} onClick={() => setChanged(!changed)}>Changed this week</button>
      {chips.map((c) => <button key={c.key} className="nbc-chip" aria-label={`Remove ${c.label} filter`} onClick={() => filter(c.key, '')}>{c.label}<X size={12}/></button>)}
      {active && <button className="text-link small" onClick={clear}>Clear all</button>}
      <span className="nbc-spacer"/>
      {controls}
      <button className="ibtn" title="Expand all" aria-label="Expand all" onClick={() => setCollapsed(new Set())}><ChevronsDown size={16}/></button>
      <button className="ibtn" title="Collapse all" aria-label="Collapse all" onClick={() => setCollapsed(new Set(activities.filter((a) => !a.editable).map((a) => a.id)))}><ChevronsUp size={16}/></button>
    </div>
    {sync.kind !== 'saved' && pending.size > 0 && <p className="small muted" role="status">{sync.kind === 'error' ? <>Save failed · <button className="text-link" onClick={() => void syncWorkspace(false)}>Retry</button></> : `Pending sync · ${pending.size}`}</p>}
    {roomMode && floor
      ? <RoomMatrix floor={floor} caption={`${floor.root.name} activities by room`} collapsed={collapsed} onToggle={toggle} progress={live.progress} previous={before.progress}
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

export default function Activities({ projectId, activities, baseline, view }: { projectId: string; activities: NbcActivity[]; baseline: Map<string, number>; view: 'activities' | 'issues' }) {
  const [expanded, setExpanded] = useState(false)
  if (view === 'issues') return <div className="nbc-activities-page"><Issues projectId={projectId} activities={activities} switcher={null}/></div>
  return <div className="nbc-activities-page" data-expanded={expanded}>
    <ActivityTable projectId={projectId} activities={activities} baseline={baseline} controls={
      <button className="nbc-chip nbc-expand-editor" aria-pressed={expanded} onClick={() => setExpanded(!expanded)}>
        {expanded ? <Minimize2 size={15} aria-hidden="true" /> : <Maximize2 size={15} aria-hidden="true" />}
        {expanded ? 'Collapse editor' : 'Expand editor'}
      </button>}/>
  </div>
}
