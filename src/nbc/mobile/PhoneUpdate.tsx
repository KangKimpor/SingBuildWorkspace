import './mobile.css'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { CheckCircle2, ChevronDown, CircleAlert, CloudUpload, LoaderCircle } from 'lucide-react'
import { useWorkspace } from '@/data'
import { usePhoneHeaderPatch } from '@/shell/phoneHeader'
import { confirmationTime, percent } from '../format'
import { handlerComplete } from '../handlers'
import { floorPickerLabel, floorTabName, isRoomProject, roomFloors } from '../rooms'
import { canUpdate, submissionId, weekLabel, weekStart } from '../submissions'
import { projectHandlers } from '../types'
import type { Handler, NbcActivity, NbcSubmission } from '../types'
import { ConfirmSheet } from '../update/ConfirmSheet'
import { deadlineNote, useNow } from '../update/deadline'
import { HandlerGate } from '../update/HandlerGate'
import { useUpdateDraft } from '../update/useUpdateDraft'
import { MoreMenu } from '../ui/MoreMenu'
import { updateCounts, updateItems } from './updateList'
import type { UpdateFilter } from './updateList'

const FILTERS: [UpdateFilter, string][] = [['need', 'Needs update'], ['chg', 'Changed'], ['all', 'All']]
const STATUS_TEXT = {
  saving: 'Saving…',
  error: 'Sync failed · kept offline',
  local: 'Saved offline · will sync',
  saved: 'Saved',
} as const
const points = (n: number) => `${n > 0 ? '+' : '−'}${Number((Math.abs(n) * 100).toFixed(2))}`

function DeleteUpdate({ onDelete, busy }: { onDelete: () => void; busy: boolean }) {
  const [armed, setArmed] = useState(false)
  if (!armed) return <button type="button" className="danger-text" onClick={() => setArmed(true)}>Delete update</button>
  return (
    <div className="nbc-delete">
      <strong>Delete this update?</strong>
      <p className="small muted">Your activities go back to last week’s values. Newer confirmed updates stay applied.</p>
      <div className="inline">
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => setArmed(false)}>Cancel</button>
        <button type="button" className="btn-accent" disabled={busy} onClick={onDelete}>Delete</button>
      </div>
    </div>
  )
}

interface ScreenProps {
  projectId: string
  week: string
  handler: Handler
  activities: NbcActivity[]
  submission?: NbcSubmission
  pastDeadline: boolean
  deadline: ReturnType<typeof deadlineNote>
  onChangeHandler: () => void
}

function PhoneUpdateScreen({ projectId, week, handler, activities, submission, pastDeadline, deadline, onChangeHandler }: ScreenProps) {
  const draft = useUpdateDraft({ projectId, week, handler, activities, submission })
  const { confirmed, busy } = draft
  const StatusIcon = draft.status === 'saving' ? LoaderCircle : draft.status === 'error' ? CircleAlert : draft.status === 'local' ? CloudUpload : CheckCircle2

  const [filter, setFilter] = useState<UpdateFilter>(confirmed ? 'chg' : 'need')
  const [query, setQuery] = useState('')
  const [floorId, setFloorId] = useState('')
  const [focusedId, setFocusedId] = useState('')
  const [sheet, setSheet] = useState(false)
  const [tried, setTried] = useState(false)
  const [remarkOpen, setRemarkOpen] = useState<ReadonlySet<string>>(new Set())
  const [jump, setJump] = useState<{ id: string; kind: 'value' | 'remark' } | null>(null)

  usePhoneHeaderPatch({ title: `${handler} · Update`, search: { value: query, onChange: setQuery, placeholder: 'Search activities' } })

  const deferredQuery = useDeferredValue(query)
  const deferredFloorId = useDeferredValue(floorId)
  const roomMode = useMemo(() => isRoomProject(activities), [activities])
  const floors = useMemo(
    () => roomMode ? roomFloors(activities).filter((f) => f.rows.some((r) => r.task && r.leaves.some((l) => canUpdate(l, handler)))) : [],
    [activities, handler, roomMode],
  )
  const pickFloor = (id: string) =>
    floors.find((f) => f.root.id === id) ??
    floors.find((f) => f.rows.some((r) => r.task && r.leaves.some((l) => canUpdate(l, handler) && l.progress < 1))) ??
    floors[0]
  const floor = pickFloor(deferredFloorId)
  const pressedFloor = pickFloor(floorId)

  const byId = useMemo(() => new Map(activities.map((a) => [a.id, a])), [activities])
  const shownById = useMemo(() => new Map(draft.shown.map((e) => [e.activityId, e])), [draft.shown])
  const changedIds = useMemo(() => new Set(draft.changed.map((e) => e.activityId)), [draft.changed])
  const problems = draft.invalid

  const items = useMemo(
    () => updateItems({
      activities,
      handler,
      shown: draft.shown,
      changed: changedIds,
      problems,
      touched: draft.touched,
      filter,
      query: deferredQuery,
      floorId: roomMode ? floor?.root.id : undefined,
      focusedId,
    }),
    [activities, handler, draft.shown, changedIds, problems, draft.touched, filter, deferredQuery, roomMode, floor?.root.id, focusedId],
  )

  const counts = useMemo(() => updateCounts(draft.shown, draft.changed.length), [draft.shown, draft.changed.length])
  const activityItems = useMemo(() => items.filter((it): it is Extract<typeof it, { kind: 'activity' }> => it.kind === 'activity'), [items])

  const values = useRef(new Map<string, HTMLInputElement>())
  const remarks = useRef(new Map<string, HTMLInputElement>())
  const beforeFocus = useRef('')
  const listRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const [scrollMargin, setScrollMargin] = useState(0)

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    setScrollMargin(el.getBoundingClientRect().top + window.scrollY)
  }, [items.length, roomMode, pressedFloor?.root.id])

  // oxlint-disable-next-line react/incompatible-library -- React Compiler is not enabled; this virtualizer is not memoized.
  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: (i) => (items[i]?.kind === 'heading' ? 36 : 112),
    overscan: 8,
    scrollMargin,
    initialRect: { width: 390, height: 844 },
  })

  function keepAboveBar(el: HTMLElement) {
    requestAnimationFrame(() => {
      const bar = barRef.current
      if (!bar) return
      const br = bar.getBoundingClientRect()
      const er = el.getBoundingClientRect()
      const margin = 12
      if (er.bottom > br.top - margin) {
        window.scrollBy({ top: er.bottom - (br.top - margin), behavior: 'instant' as ScrollBehavior })
      }
    })
  }

  useEffect(() => {
    if (!jump) return
    const index = items.findIndex((it) => it.kind === 'activity' && it.id === jump.id)
    if (index >= 0) virtualizer.scrollToIndex(index, { align: 'center' })
    let frame = 0
    let cancelled = false
    const focus = () => {
      if (cancelled) return
      const el = (jump.kind === 'remark' ? remarks : values).current.get(jump.id)
      if (el) {
        el.focus()
        el.scrollIntoView?.({ block: 'center' })
        keepAboveBar(el)
        setJump(null)
        return
      }
      if (++frame < 120) requestAnimationFrame(focus)
      else setJump(null)
    }
    focus()
    return () => { cancelled = true }
  }, [jump, items, virtualizer])

  function toggleRemark(id: string) {
    const opening = !remarkOpen.has(id)
    setRemarkOpen((old) => {
      const next = new Set(old)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    if (opening) setJump({ id, kind: 'remark' })
  }

  function advance(id: string) {
    const i = activityItems.findIndex((it) => it.id === id)
    const next = activityItems[i + 1]?.id
    if (next) setJump({ id: next, kind: 'value' })
    else values.current.get(id)?.blur()
  }

  function focusFirstProblem() {
    const first = draft.rows.find((e) => problems.has(e.activityId))?.activityId
    if (!first) return
    if (roomMode) {
      let node = byId.get(first)
      while (node?.parentId) node = byId.get(node.parentId)
      if (node) setFloorId(node.id)
    }
    setJump({ id: first, kind: 'value' })
  }

  function start() {
    setTried(true)
    if (problems.size) focusFirstProblem()
    else setSheet(true)
  }

  const sheetItems = draft.changed.map((e) => {
    const l = byId.get(e.activityId)
    return {
      id: e.activityId,
      wbs: l?.wbs ?? e.activityId,
      name: l?.room && l.parentId ? `${byId.get(l.parentId)?.name ?? ''} — ${l.name}` : l?.name ?? '',
      previous: e.previous,
      progress: e.progress,
      remark: e.remark,
    }
  })

  const emptyText = filter === 'chg'
    ? confirmed ? 'No changes in this update.' : 'No changes yet. Type a new percentage on Needs update or All.'
    : filter === 'need'
      ? 'Nothing needs an update — everything assigned to you is complete.'
      : 'No activities match.'

  return (
    <section className="ph-update" aria-label="Weekly progress update">
      <div className="ph-update-top">
        <div className="ph-update-meta">
          <button
            type="button"
            className="ph-handler-btn"
            aria-label={`Change handler, currently ${handler}`}
            onClick={onChangeHandler}
          >
            <span>{handler}</span>
            <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
          {submission?.status === 'confirmed' ? (
            <span className="nbc-deadline" data-tone={submission.late ? 'late' : 'ok'}>
              {submission.late ? 'Late' : 'On time'}
            </span>
          ) : (
            <span className="nbc-deadline" data-tone={deadline.tone} title={deadline.text}>
              {deadline.text}
            </span>
          )}
        </div>

        <div className="nbc-seg ph-update-seg" role="group" aria-label="Show activities">
          {FILTERS.map(([key, label]) => (
            <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>
              {label} <span className="nbc-count">{counts[key]}</span>
            </button>
          ))}
        </div>

        {roomMode && pressedFloor && floors.length > 1 && (
          <div className="ph-floor-chips" role="group" aria-label={floorPickerLabel(floors)}>
            {floors.map((f) => (
              <button
                key={f.root.id}
                type="button"
                className="nbc-chip"
                aria-pressed={f.root.id === pressedFloor.root.id}
                aria-label={f.root.name}
                onClick={() => setFloorId(f.root.id)}
              >
                {floorTabName(f.root)}
              </button>
            ))}
          </div>
        )}
      </div>

      {draft.error && !sheet && <p className="form-error" role="alert">{draft.error}</p>}

      {items.length === 0 ? (
        <div className="ph-empty-box">
          <p className="ph-empty">{emptyText}</p>
          {filter !== 'all' && (
            <button type="button" className="btn-secondary" onClick={() => setFilter('all')}>Show all activities</button>
          )}
        </div>
      ) : (
        <div
          ref={listRef}
          className="ph-update-list"
          style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
        >
          {virtualizer.getVirtualItems().map((vItem) => {
            const item = items[vItem.index]!
            const style: React.CSSProperties = {
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${vItem.start - virtualizer.options.scrollMargin}px)`,
            }

            if (item.kind === 'heading') {
              return (
                <div
                  key={item.id}
                  data-index={vItem.index}
                  ref={virtualizer.measureElement}
                  style={style}
                  className="ph-update-heading"
                >
                  {item.path}
                </div>
              )
            }

            const a = item.activity
            const e = shownById.get(a.id)
            const previousValue = e?.previous ?? a.progress
            const currentValue = e?.progress ?? a.progress
            const diff = currentValue - previousValue
            const changed = changedIds.has(a.id)
            const invalid = problems.has(a.id)
            const remarkValue = draft.remark(a.id)
            const hasRemark = remarkOpen.has(a.id) || remarkValue.trim().length > 0

            return (
              <div
                key={item.id}
                data-index={vItem.index}
                ref={virtualizer.measureElement}
                style={style}
                className="ph-update-slot"
              >
                <article
                  className="ph-ucard"
                  data-activity-id={a.id}
                  data-changed={changed ? 'true' : undefined}
                  data-problem={invalid ? 'true' : undefined}
                >
                  <div className="ph-ucard-main">
                    <span className="ph-ucard-name">{item.label}</span>
                    <span className="ph-ucard-sub">
                      {a.wbs} · was {percent(previousValue)}
                      {Math.abs(diff) > 1e-12 && (
                        <>
                          {' '}
                          <span className="nbc-delta" data-dir={diff > 0 ? 'up' : 'down'}>{points(diff)}</span>
                        </>
                      )}
                    </span>
                  </div>

                  <div className="ph-ucard-ctrl">
                    {confirmed ? (
                      <span className="ph-ucard-locked">{percent(currentValue)}</span>
                    ) : (
                      <label className="ph-ucard-input-wrap">
                        <input
                          ref={(el) => {
                            if (el) values.current.set(a.id, el)
                            else values.current.delete(a.id)
                          }}
                          className="ph-ucard-input"
                          disabled={busy}
                          aria-label={`This week % for ${a.wbs}`}
                          aria-invalid={invalid || undefined}
                          inputMode="decimal"
                          value={draft.text(a.id)}
                          onFocus={(event) => {
                            beforeFocus.current = event.target.value
                            setFocusedId(a.id)
                            keepAboveBar(event.currentTarget)
                          }}
                          onBlur={() => setFocusedId((old) => (old === a.id ? '' : old))}
                          onChange={(event) => draft.setText(a.id, event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Escape') draft.setText(a.id, beforeFocus.current)
                            if (event.key === 'Enter') advance(a.id)
                          }}
                        />
                        <span className="ph-ucard-unit" aria-hidden="true">%</span>
                      </label>
                    )}
                  </div>

                  {!confirmed && tried && invalid && (
                    <p className="ph-ucard-error" role="status">Enter 0 to 100</p>
                  )}

                  {confirmed ? (
                    remarkValue.trim() && <p className="ph-ucard-remark-text">{remarkValue}</p>
                  ) : (
                    <div className="ph-ucard-remark-row">
                      {!remarkOpen.has(a.id) ? (
                        <button
                          type="button"
                          className="ph-remark-btn"
                          data-filled={hasRemark || undefined}
                          aria-expanded={false}
                          aria-label={`${remarkValue.trim() ? 'Edit' : 'Add'} remark for ${a.wbs}`}
                          onClick={() => toggleRemark(a.id)}
                        >
                          {remarkValue.trim() ? remarkValue : '+ Remark'}
                        </button>
                      ) : (
                        <input
                          ref={(el) => {
                            if (el) remarks.current.set(a.id, el)
                            else remarks.current.delete(a.id)
                          }}
                          className="ph-remark-input"
                          disabled={busy}
                          aria-label={`Remark for ${a.wbs}`}
                          placeholder="Add remark…"
                          maxLength={4000}
                          value={remarkValue}
                          onFocus={(event) => keepAboveBar(event.currentTarget)}
                          onChange={(event) => draft.setRemark(a.id, event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Escape' || event.key === 'Enter') toggleRemark(a.id)
                          }}
                        />
                      )}
                    </div>
                  )}
                </article>
              </div>
            )
          })}
        </div>
      )}

      {confirmed && submission?.note && <p className="nbc-note small">{submission.note}</p>}

      <div ref={barRef} className="ph-update-bar" role="group" aria-label="Update actions">
        {confirmed ? (
          <>
            <span role="status" className="nbc-status" data-status="saved">
              <CheckCircle2 size={18} strokeWidth={1.75} aria-hidden="true" />
              <span>Confirmed {confirmationTime(submission!.confirmedAt!)} · {draft.changed.length} changed</span>
            </span>
            <div className="ph-update-bar-actions">
              <MoreMenu label="Update actions">
                <DeleteUpdate busy={busy} onDelete={() => void draft.remove()} />
              </MoreMenu>
              <button type="button" className="btn-accent" disabled={busy} onClick={() => void draft.edit()}>
                Edit
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="ph-update-bar-info">
              <span role="status" className="nbc-status" data-status={draft.status}>
                <StatusIcon size={16} strokeWidth={1.75} aria-hidden="true" />
                <span>{STATUS_TEXT[draft.status]}</span>
              </span>
              <span className="ph-update-metrics">
                {draft.changed.length} changed · {draft.contribution > 0 ? '+' : ''}{(draft.contribution * 100).toFixed(2)}% overall
              </span>
              {tried && problems.size > 0 && (
                <button type="button" className="ph-jump-btn" onClick={focusFirstProblem}>
                  {problems.size} to fix · Jump
                </button>
              )}
            </div>
            <button type="button" className="btn-accent ph-confirm-btn" disabled={busy} aria-haspopup="dialog" onClick={start}>
              {draft.changed.length ? 'Confirm update' : 'Confirm, no changes'}
            </button>
          </>
        )}
      </div>

      {sheet && !confirmed && (
        <ConfirmSheet
          handler={handler}
          weekText={weekLabel(week)}
          late={pastDeadline}
          items={sheetItems}
          lowered={draft.lowered.length}
          contribution={draft.contribution}
          note={draft.note}
          onNote={draft.setNote}
          error={draft.error}
          busy={busy}
          onCancel={() => setSheet(false)}
          onConfirm={() => void draft.confirm()}
        />
      )}
    </section>
  )
}

export default function PhoneUpdate({ projectId, activities, submissions }: { projectId: string; activities: NbcActivity[]; submissions: NbcSubmission[] }) {
  const scope = useWorkspace((s) => s.scope)
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const validHandlers = useMemo(() => projectHandlers(projectId), [projectId])
  const handler = validHandlers.find((h) => h === params.get('handler')) ?? null

  function choose(value: Handler | null) {
    const next = new URLSearchParams(params)
    if (value) next.set('handler', value)
    else next.delete('handler')
    setParams(next, { replace: true })
  }

  const week = weekStart()

  if (!handler) {
    return (
      <section className="ph-update-gate" aria-label="Choose your handler">
        <HandlerGate projectId={projectId} week={week} activities={activities} submissions={submissions} onChoose={choose} />
      </section>
    )
  }

  if (handlerComplete(activities, handler)) {
    return (
      <section className="ph-update-gate" aria-label="Update complete">
        <div className="nbc-gate" data-complete="true">
          <h2>{handler} is complete</h2>
          <p className="muted">
            Every activity assigned to {handler} is at 100%, so this update is locked. If more work is needed, an activity must first be reassigned or corrected.
          </p>
          <button type="button" className="btn-secondary nbc-gate-go" onClick={() => choose(null)}>
            Choose another handler
          </button>
        </div>
      </section>
    )
  }

  const selected = submissions.find((s) => s.id === submissionId(projectId, week, handler))
  const deadline = deadlineNote(week, now)

  return (
    <PhoneUpdateScreen
      key={`${scope}:${week}:${handler}:${selected?.status === 'confirmed' ? 'confirmed' : 'editing'}:${activities[0]?.baselineResetAt ?? ''}`}
      projectId={projectId}
      week={week}
      handler={handler}
      activities={activities}
      submission={selected}
      pastDeadline={deadline.late}
      deadline={deadline}
      onChangeHandler={() => choose(null)}
    />
  )
}
