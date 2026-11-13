import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { CheckCircle2, ChevronsDown, ChevronsUp, CircleAlert, CloudUpload, LoaderCircle, Search } from 'lucide-react'
import { MoreMenu } from '../ui/MoreMenu'
import { WbsTable } from '../ui/WbsTable'
import { RoomMatrix } from '../ui/RoomMatrix'
import { TableFooter } from '../ui/TableFooter'
import { floorPickerLabel, floorTabName, isRoomProject, roomFloors, visibleRoomRows } from '../rooms'
import { buildWbsRows } from '../wbs-table'
import { calculate } from '../progress'
import { canUpdate, weekLabel } from '../submissions'
import { confirmationTime, percent } from '../format'
import type { RoomRow } from '../rooms'
import type { Handler, NbcActivity, NbcSubmission } from '../types'
import { ConfirmSheet } from './ConfirmSheet'
import { useUpdateDraft } from './useUpdateDraft'

type Filter = 'need' | 'chg' | 'all'
const FILTERS: [Filter, string][] = [['need', 'Needs update'], ['chg', 'Changed'], ['all', 'All']]
const STATUS_TEXT = { saving: 'Saving draft…', error: 'Draft kept on this device · sync failed', local: 'Draft saved on this device · will sync', saved: 'Draft saved' } as const
const points = (n: number) => `${n > 0 ? '+' : '−'}${Number((Math.abs(n) * 100).toFixed(2))}`
const brief = (text: string) => text.length > 22 ? `${text.slice(0, 22)}…` : text

function DeleteUpdate({ onDelete, busy }: { onDelete: () => void; busy: boolean }) {
  const [armed, setArmed] = useState(false)
  if (!armed) return <button className="danger-text" onClick={() => setArmed(true)}>Delete update</button>
  return <div className="nbc-delete"><strong>Delete this update?</strong><p className="small muted">Your activities go back to last week’s values. Newer confirmed updates stay applied.</p><div className="inline"><button className="btn-secondary" disabled={busy} onClick={() => setArmed(false)}>Cancel</button><button className="btn-accent" disabled={busy} onClick={onDelete}>Delete</button></div></div>
}

interface Props { projectId: string; week: string; handler: Handler; activities: NbcActivity[]; submission?: NbcSubmission; pastDeadline: boolean; controls?: ReactNode }

export function UpdateEditor({ projectId, week, handler, activities, submission, pastDeadline, controls }: Props) {
  const draft = useUpdateDraft({ projectId, week, handler, activities, submission })
  const { confirmed, busy } = draft
  const StatusIcon = draft.status === 'saving' ? LoaderCircle : draft.status === 'error' ? CircleAlert : draft.status === 'local' ? CloudUpload : CheckCircle2
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set()), [filter, setFilter] = useState<Filter>(confirmed ? 'chg' : 'need')
  const [focusId, setFocusId] = useState(''), [sheet, setSheet] = useState(false), [tried, setTried] = useState(false)
  const [remarkOpen, setRemarkOpen] = useState<ReadonlySet<string>>(new Set()), [jump, setJump] = useState<{ id: string; kind: 'value' | 'remark' } | null>(null)
  const [query, setQuery] = useState(''), [floorId, setFloorId] = useState('')
  const roomMode = useMemo(() => isRoomProject(activities), [activities])
  // Floors that hold work for this handler; the matrix shows one floor at a time with a column per room.
  const floors = useMemo(() => roomMode ? roomFloors(activities).filter((f) => f.rows.some((r) => r.task && r.leaves.some((l) => canUpdate(l, handler)))) : [], [activities, handler, roomMode])
  const search = useRef<HTMLInputElement>(null)
  const values = useRef(new Map<string, HTMLInputElement>()), remarks = useRef(new Map<string, HTMLInputElement>()), beforeFocus = useRef('')
  const byId = useMemo(() => new Map(activities.map((a) => [a.id, a])), [activities]), shownById = useMemo(() => new Map(draft.shown.map((e) => [e.activityId, e])), [draft.shown])
  const changedIds = new Set(draft.changed.map((e) => e.activityId))
  const problems = new Set(draft.invalid)
  // Filtering and floor changes re-render a matrix of up to ~2,000 cells. Deferring them lets the
  // keystroke or the pressed floor button paint first; React renders the new matrix right after.
  const deferredQuery = useDeferredValue(query), shownFloorId = useDeferredValue(floorId)
  const q = deferredQuery.trim().toLowerCase()
  const textMatch = (a: NbcActivity) => { for (let n: NbcActivity | undefined = a; n; n = n.parentId ? byId.get(n.parentId) : undefined) if (`${n.wbs} ${n.name} ${n.description}`.toLowerCase().includes(q)) return true; return false }

  const visible = (a: NbcActivity) => {
    const e = shownById.get(a.id)
    if (!e) return false
    if (q && !textMatch(a)) return false
    if (filter === 'all') return true
    const flagged = problems.has(a.id) || focusId === a.id
    if (filter === 'chg') return changedIds.has(a.id) || flagged
    return !(e.previous === 1 && e.progress === 1) || flagged || draft.touched.has(a.id)
  }
  const forced = new Set<string>()
  for (const id of problems) { let parent = byId.get(id)?.parentId; while (parent) { forced.add(parent); parent = byId.get(parent)?.parentId } }
  const openGroups = new Set([...collapsed].filter((id) => !forced.has(id)))
  const progressOf = useMemo(() => new Map(draft.shown.map((e) => [e.activityId, e.progress])), [draft.shown])
  const rows = roomMode ? [] : buildWbsRows(activities, { leaf: (a) => canUpdate(a, handler) && visible(a), collapsed: openGroups, values: progressOf })
  // Previous-week values come from the saved entries, not the form, so typing never needs this full-BOQ pass.
  const previousEntries = confirmed ? submission!.entries : draft.rows
  const pickFloor = (id: string) => floors.find((f) => f.root.id === id) ?? floors.find((f) => f.rows.some((r) => r.task && r.leaves.some((l) => canUpdate(l, handler) && l.progress < 1))) ?? floors[0]
  const floor = pickFloor(shownFloorId), pressedFloor = pickFloor(floorId)
  // The matrix shows one floor, and a floor's values depend only on its own subtree, so BP02 rolls up
  // about 1,500 rows per keystroke instead of all 16,550.
  const scope = useMemo(() => roomMode && floor ? [floor.root, ...floor.rows.flatMap((r) => [r.activity, ...r.leaves])] : activities, [roomMode, floor, activities])
  const previous = useMemo(() => calculate(scope, new Map(previousEntries.map((e) => [e.activityId, e.previous]))).progress, [scope, previousEntries])
  const nowProgress = useMemo(() => roomMode ? calculate(scope, progressOf).progress : previous, [roomMode, scope, progressOf, previous])
  const showRow = (row: { leaves: readonly NbcActivity[] }) => row.leaves.some((l) => canUpdate(l, handler) && visible(l))
  /** The half of a cell shared by two handlers that this handler edits (the cell's only leaf otherwise). */
  const mine = (l: NbcActivity, co?: NbcActivity) => co && canUpdate(co, handler) && !canUpdate(l, handler) ? co : l
  const leaves = rows.filter((r) => !r.group)
  const roomRows = roomMode && floor ? visibleRoomRows(floor, showRow, openGroups) : []
  const rootOf = (id: string) => { let node = byId.get(id); while (node?.parentId) node = byId.get(node.parentId); return node?.id ?? '' }
  const counts: Record<Filter, number> = { need: draft.shown.filter((e) => e.previous < 1).length, chg: draft.changed.length, all: draft.shown.length }

  useEffect(() => {
    if (!jump) return
    let frame = 0, cancelled = false
    /** A virtual row mounts after the table scrolls to it, so retry for a few frames. */
    const focus = () => {
      if (cancelled) return
      const el = (jump.kind === 'remark' ? remarks : values).current.get(jump.id)
      if (el) { el.focus(); el.scrollIntoView?.({ block: 'center' }); setJump(null); return }
      // A floor change renders in the background (useDeferredValue), so allow up to about two seconds.
      if (++frame < 120) requestAnimationFrame(focus)
      else setJump(null)
    }
    focus()
    return () => { cancelled = true }
  }, [jump])

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === '/' && !(e.target instanceof HTMLElement && e.target.closest('input,textarea,[contenteditable=true]'))) { e.preventDefault(); search.current?.focus() } }
    addEventListener('keydown', key); return () => removeEventListener('keydown', key)
  }, [])

  function toggle(id: string) { setCollapsed((old) => { const next = new Set(old); if (next.has(id)) next.delete(id); else next.add(id); return next }) }
  function expandAll() { setCollapsed(new Set()) }
  function collapseAll() { setCollapsed(new Set(activities.filter((a) => !canUpdate(a, handler)).map((a) => a.id))) }
  function toggleRemark(id: string) { setRemarkOpen((old) => { const next = new Set(old); if (next.has(id)) next.delete(id); else next.add(id); return next }) }
  function advance(id: string) {
    const i = leaves.findIndex((r) => r.activity.id === id), next = leaves[i + 1]?.activity.id
    if (next) setJump({ id: next, kind: 'value' })
    else values.current.get(id)?.blur()
  }
  /** Enter in the matrix moves down to the same room on the next listed task. */
  function advanceRoom(id: string) {
    const room = byId.get(id)?.room, list = roomRows.filter((r) => r.task)
    const i = list.findIndex((r) => r.leaves.some((l) => l.id === id))
    const next = list.slice(i + 1).map((r) => r.leaves.find((l) => l.room === room && canUpdate(l, handler))).find(Boolean)
    if (next) setJump({ id: next.id, kind: 'value' })
    else values.current.get(id)?.blur()
  }
  function focusFirstProblem() {
    const id = draft.rows.find((e) => problems.has(e.activityId))?.activityId
    if (id) { if (roomMode) setFloorId(rootOf(id)); setJump({ id, kind: 'value' }) }
  }
  function start() { setTried(true); if (problems.size) focusFirstProblem(); else setSheet(true) }

  const sheetItems = draft.changed.map((e) => ({ id: e.activityId, wbs: byId.get(e.activityId)?.wbs ?? e.activityId, name: (() => { const l = byId.get(e.activityId); return l?.room && l.parentId ? `${byId.get(l.parentId)?.name ?? ''} — ${l.name}` : l?.name ?? '' })(), previous: e.previous, progress: e.progress, remark: e.remark }))
  const emptyText = filter === 'chg' ? confirmed ? 'No changes in this update.' : 'No changes yet. Type a new percentage on a row in Needs update or All.' : filter === 'need' ? 'Nothing needs an update — everything assigned to you is complete.' : 'No activities to update.'

  // Matrix rows that did not change keep the inputs of an earlier render, so their handlers go through
  // this ref to the current draft and keyboard navigation instead of the values they were created with.
  const live = useRef({ draft, advanceRoom })
  useLayoutEffect(() => { live.current = { draft, advanceRoom } })
  const roomSignature = (row: RoomRow) => {
    let sig = `${busy ? 1 : 0}${confirmed ? 1 : 0}`
    for (const room of row.cells.keys()) {
      const l = mine(row.cells.get(room)!, row.co.get(room))
      sig += `|${draft.text(l.id)}${changedIds.has(l.id) ? 'c' : ''}${problems.has(l.id) ? 'p' : ''}${(shownById.get(l.id)?.progress ?? l.progress) === 1 ? 'd' : ''}${draft.invalid.has(l.id) ? 'i' : ''}${confirmed ? shownById.get(l.id)?.progress ?? '' : ''}`
    }
    return sig
  }
  const roomCell = (a: NbcActivity) => {
    const e = shownById.get(a.id), diff = e ? e.progress - e.previous : 0
    if (confirmed) return <span title={Math.abs(diff) > 1e-12 ? `${points(diff)} pts` : undefined}>{Number(((e?.progress ?? a.progress) * 100).toFixed(1))}</span>
    return <input ref={(el) => { if (el) values.current.set(a.id, el); else values.current.delete(a.id) }} disabled={busy} title={a.room && a.parentId ? `${byId.get(a.parentId)?.name ?? ''} — ${a.name}` : a.name} aria-label={`This week % for ${a.wbs}`} aria-invalid={draft.invalid.has(a.id) || undefined} inputMode="decimal" value={draft.text(a.id)}
      onFocus={(event) => { beforeFocus.current = event.target.value; setFocusId(a.id); event.target.select() }} onBlur={() => setFocusId((old) => old === a.id ? '' : old)}
      onChange={(event) => live.current.draft.setText(a.id, event.target.value)}
      onKeyDown={(event) => { if (event.key === 'Escape') live.current.draft.setText(a.id, beforeFocus.current); if (event.key === 'Enter') live.current.advanceRoom(a.id) }}/>
  }

  return <>
    <div className="nbc-filters">
      {roomMode && pressedFloor && floors.length > 1 && <div className="nbc-floor-row"><div className="nbc-seg" role="group" aria-label={floorPickerLabel(floors)}>{floors.map((f) => <button key={f.root.id} aria-pressed={f.root.id === pressedFloor.root.id} aria-label={f.root.name} onClick={() => setFloorId(f.root.id)}>{floorTabName(f.root)}</button>)}</div></div>}
      <div className="nbc-filter-line">
      <label className="search-field"><Search size={16}/><input ref={search} aria-label="Search activities" placeholder="Search WBS or activity" value={query} onChange={(e) => { setQuery(e.target.value); setCollapsed(new Set()) }}/><kbd>/</kbd></label>
      <div className="nbc-seg" role="group" aria-label="Show activities">{FILTERS.map(([key, label]) => <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label} <span className="nbc-count">{counts[key]}</span></button>)}</div>
      <div className="nbc-toolbar-actions nbc-update-controls">
        {controls}
        <button className="ibtn" title="Expand all" aria-label="Expand all" onClick={expandAll}><ChevronsDown size={16}/></button>
        <button className="ibtn" title="Collapse all" aria-label="Collapse all" onClick={collapseAll}><ChevronsUp size={16}/></button>
      </div>
      </div>
    </div>
    {draft.error && !sheet && <p className="form-error" role="alert">{draft.error}</p>}
    {roomMode && floor && roomRows.length > 0
      ? <RoomMatrix floor={floor} rowSignature={roomSignature} caption={`${handler} activities by room · ${floor.root.name} · ${weekLabel(week)}`} collapsed={openGroups} onToggle={toggle} progress={nowProgress} previous={previous}
          show={showRow} cell={(l, _row, co) => roomCell(mine(l, co))}
          cellAttrs={(first, co) => { const l = mine(first, co); return { 'data-changed': changedIds.has(l.id) ? 'true' : undefined, 'data-problem': problems.has(l.id) ? 'true' : undefined, 'data-done': (shownById.get(l.id)?.progress ?? l.progress) === 1 ? 'true' : undefined } }}/>
      : rows.length === 0
      ? <div className="nbc-update-empty"><p>{emptyText}</p>{filter !== 'all' && <button className="btn-secondary" onClick={() => setFilter('all')}>Show all activities</button>}</div>
      : <WbsTable virtual={false} rows={rows} caption={`${handler} activities · ${weekLabel(week)}`} collapsed={openGroups} onToggle={toggle}
          previous={(a) => previous.get(a.id) ?? a.progress}
          rowAttrs={(row) => ({ 'data-activity-id': row.activity.id, 'data-changed': changedIds.has(row.activity.id) ? 'true' : undefined, 'data-problem': problems.has(row.activity.id) ? 'true' : undefined })}
          current={({ activity: a }) => {
            const e = shownById.get(a.id), diff = e ? e.progress - e.previous : 0
            const chip = Math.abs(diff) > 1e-12 ? <span className="nbc-delta" data-dir={diff > 0 ? 'up' : 'down'}>{points(diff)}</span> : null
            if (confirmed) return <span className="nbc-cell">{chip}{percent(e?.progress ?? a.progress)}</span>
            return <div className="nbc-cell">{chip}
              <input ref={(el) => { if (el) values.current.set(a.id, el); else values.current.delete(a.id) }} disabled={busy} aria-label={`This week % for ${a.wbs}`} aria-invalid={draft.invalid.has(a.id) || undefined} inputMode="decimal" value={draft.text(a.id)}
                onFocus={(event) => { beforeFocus.current = event.target.value; setFocusId(a.id) }} onBlur={() => setFocusId((old) => old === a.id ? '' : old)}
                onChange={(event) => draft.setText(a.id, event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Escape') draft.setText(a.id, beforeFocus.current); if (event.key === 'Enter') advance(a.id) }}/><span className="nbc-unit" aria-hidden="true">%</span>
              {tried && draft.invalid.has(a.id) && <span className="nbc-hint">Enter 0 to 100</span>}
            </div>
          }}
          remark={({ activity: a }) => {
            if (confirmed) return <span>{shownById.get(a.id)?.remark || '—'}</span>
            const value = draft.remark(a.id), open = remarkOpen.has(a.id)
            return <div className="nbc-remark-cell">
              {!open ? (
                <button className="nbc-remark-btn" data-filled={!!value.trim()} aria-expanded={open} aria-label={`${value.trim() ? 'Edit' : 'Add'} remark for ${a.wbs}`} onClick={() => toggleRemark(a.id)}>{value.trim() ? brief(value) : '+ Remark'}</button>
              ) : (
                <input ref={(el) => { if (el) remarks.current.set(a.id, el); else remarks.current.delete(a.id) }} className="nbc-remark" disabled={busy} aria-label={`Remark for ${a.wbs}`} placeholder="Add remark…" maxLength={4000} value={value} onChange={(event) => draft.setRemark(a.id, event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape' || event.key === 'Enter') toggleRemark(a.id) }}/>
              )}
            </div>
          }}/>}
    {(roomMode ? !!floor && roomRows.length > 0 : rows.length > 0) && <TableFooter triangle={roomMode} count={roomMode && floor ? floor.rows.filter((r) => r.task && showRow(r)).length : rows.filter((r) => !r.group).length} legend={roomMode ? ['changed', 'problem', 'na'] : ['changed', 'problem']}/>}
    {confirmed && submission?.note && <p className="nbc-note small">{submission.note}</p>}
    <div className="nbc-update-bar" role="group" aria-label="Update actions">{confirmed
      ? <><span role="status" className="nbc-status" data-status="saved"><CheckCircle2 size={18} aria-hidden="true" />Confirmed {confirmationTime(submission!.confirmedAt!)} · {draft.changed.length} changed</span>
          <span className="nbc-spacer"/><button className="btn-accent" disabled={busy} onClick={() => void draft.edit()}>Edit</button><MoreMenu label="Update actions"><DeleteUpdate busy={busy} onDelete={() => void draft.remove()}/></MoreMenu></>
      : <><span role="status" className="nbc-status" data-status={draft.status}><StatusIcon size={18} aria-hidden="true" />{STATUS_TEXT[draft.status]}</span>
          <div className="nbc-update-metrics"><span>{draft.changed.length} changed</span><span className="nbc-contribution" data-dir={draft.contribution < 0 ? 'down' : 'up'}>{draft.contribution > 0 ? '+' : ''}{(draft.contribution * 100).toFixed(2)}% <span>overall</span></span></div>
          {tried && problems.size > 0 && <span className="nbc-problems">{problems.size} to fix · <button className="text-link" onClick={focusFirstProblem}>Jump to first</button></span>}
          <span className="nbc-spacer"/>
          <button className="btn-accent" disabled={busy} aria-haspopup="dialog" onClick={start}><CheckCircle2 size={15} aria-hidden="true"/>{draft.changed.length ? 'Confirm update' : 'Confirm, no changes'}</button></>}</div>
    {sheet && !confirmed && <ConfirmSheet handler={handler} weekText={weekLabel(week)} late={pastDeadline} items={sheetItems} lowered={draft.lowered.length} contribution={draft.contribution}
      note={draft.note} onNote={draft.setNote} error={draft.error} busy={busy} onCancel={() => setSheet(false)} onConfirm={() => void draft.confirm()}/>}
  </>
}
