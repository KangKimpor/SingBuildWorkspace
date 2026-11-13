import './mobile.css'
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, SlidersHorizontal, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { GlassSelect } from '@/components/glass/GlassSelect'
import { BottomSheet } from '@/shell/Overlays'
import { usePhoneHeaderPatch } from '@/shell/phoneHeader'
import { percent } from '../format'
import type { calculate } from '../progress'
import { activityTags } from '../tags'
import { projectHandlers } from '../types'
import type { NbcActivity } from '../types'
import { ActivitySheet } from './ActivitySheet'
import { drillRows, drillSearch, drillTrail } from './drill'
import type { DrillRow } from './drill'

type Calculation = ReturnType<typeof calculate>

const points = (n: number) => `${n > 0 ? '+' : '−'}${Number((Math.abs(n) * 100).toFixed(2))}`

export default function PhoneProgress({ projectId, activities, rollups }: { projectId: string; activities: NbcActivity[]; rollups: { live: Calculation; before?: Calculation } }) {
  const { live, before } = rollups
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [dismissedWbs, setDismissedWbs] = useState('')
  const trailRef = useRef<HTMLElement>(null)

  usePhoneHeaderPatch({ search: { value: query, onChange: setQuery, placeholder: 'Search activities' } })

  const handler = params.get('handler') ?? ''
  const changed = params.get('changed') === '1'
  const area = params.get('area') ?? ''
  const location = params.get('location') ?? ''
  const trade = params.get('trade') ?? ''
  const atParam = params.get('at') ?? ''
  const wbsParam = params.get('wbs') ?? ''

  const tags = useMemo(() => activityTags(activities), [activities])
  const coByFirst = useMemo(() => {
    const map = new Map<string, NbcActivity[]>()
    for (const a of activities) {
      if (!a.coOf || !live.byId.has(a.coOf)) continue
      const list = map.get(a.coOf)
      if (list) list.push(a)
      else map.set(a.coOf, [a])
    }
    return map
  }, [activities, live.byId])

  const leaf = useCallback((a: NbcActivity) => {
    if (handler && (a.handler || 'Unassigned') !== handler) return false
    const t = tags.get(a.id)
    if (area && t?.area !== area) return false
    if (location && t?.location !== location) return false
    if (trade && t?.trade !== trade) return false
    if (changed) {
      const p = live.progress.get(a.id) ?? a.progress
      const b = before ? (before.progress.get(a.id) ?? p) : p
      if (Math.abs(p - b) <= 1e-12) return false
    }
    return true
  }, [handler, area, location, trade, changed, tags, live, before])

  const hasFilter = !!(handler || area || location || trade || changed)
  const activeLeaf = hasFilter ? leaf : undefined

  const wbsTarget = useMemo(() => {
    if (!wbsParam) return undefined
    const exact = activities.find((a) => a.wbs === wbsParam)
    if (!exact) return undefined
    if (exact.coOf && live.byId.has(exact.coOf)) return live.byId.get(exact.coOf)
    return exact
  }, [activities, wbsParam, live.byId])

  const candidateAt = useMemo(() => {
    if (atParam) {
      const node = live.byId.get(atParam)
      if (!node) return null
      return node.editable ? node.parentId : node.id
    }
    if (wbsTarget) return wbsTarget.editable ? wbsTarget.parentId : wbsTarget.id
    return null
  }, [atParam, wbsTarget, live.byId])

  const topRows = useMemo(() => drillRows(null, { live, before, leaf: activeLeaf }), [live, before, activeLeaf])
  const candidateRows = useMemo(() => candidateAt ? drillRows(candidateAt, { live, before, leaf: activeLeaf }) : topRows, [candidateAt, topRows, live, before, activeLeaf])
  // Unknown or filtered-out ?at= / ?wbs= falls back to the top level rather than showing a blank screen.
  const effectiveAt = candidateAt && candidateRows.length === 0 && topRows.length > 0 ? null : candidateAt
  const levelRows = effectiveAt === candidateAt ? candidateRows : topRows

  const deferredQuery = useDeferredValue(query)
  const searching = deferredQuery.trim().length > 0
  const searchResult = useMemo(() => {
    if (!searching) return { rows: [] as DrillRow[], capped: false }
    const raw = drillSearch(deferredQuery, { live, before, leaf: activeLeaf }, 201)
    return { rows: raw.length > 200 ? raw.slice(0, 200) : raw, capped: raw.length > 200 }
  }, [searching, deferredQuery, live, before, activeLeaf])

  const rows = searching ? searchResult.rows : levelRows
  const trail = useMemo(() => drillTrail(live.byId, effectiveAt), [live.byId, effectiveAt])
  useEffect(() => {
    const el = trailRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [effectiveAt])

  const handlerOptions = useMemo(
    () => [...new Set([...projectHandlers(projectId), ...activities.filter((a) => a.editable).map((a) => a.handler || 'Unassigned')])],
    [projectId, activities],
  )

  const leafHandler = (a: NbcActivity) => {
    const list = [a, ...(coByFirst.get(a.id) ?? [])].map((h) => h.handler || 'Unassigned')
    return [...new Set(list)].join(', ')
  }
  const leafRemark = (a: NbcActivity) => {
    const list = [a, ...(coByFirst.get(a.id) ?? [])].map((h) => h.remark.trim()).filter(Boolean)
    return [...new Set(list)].join(' · ')
  }
  const parentPath = (parentId: string | null) => drillTrail(live.byId, parentId).map((n) => n.name).join(' › ')

  const selectedRow = useMemo(() => {
    if (pickedId) {
      const node = live.byId.get(pickedId)
      if (!node || !node.editable) return null
      const parentRows = drillRows(node.parentId, { live, before, leaf: activeLeaf })
      return parentRows.find((r) => r.activity.id === node.id) ?? null
    }
    if (wbsTarget?.editable && dismissedWbs !== wbsParam) {
      const parentRows = drillRows(wbsTarget.parentId, { live, before, leaf: activeLeaf })
      return parentRows.find((r) => r.activity.id === wbsTarget.id) ?? null
    }
    return null
  }, [pickedId, wbsTarget, dismissedWbs, wbsParam, live, before, activeLeaf])

  function navigateAt(id: string | null) {
    const next = new URLSearchParams(params)
    next.delete('wbs')
    if (id) next.set('at', id)
    else next.delete('at')
    setParams(next)
  }

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  function clearFilters() {
    const next = new URLSearchParams(params)
    for (const k of ['handler', 'changed', 'area', 'location', 'trade']) next.delete(k)
    setParams(next, { replace: true })
  }

  function closeSheet() {
    setPickedId(null)
    if (wbsParam) {
      setDismissedWbs(wbsParam)
      const next = new URLSearchParams(params)
      next.delete('wbs')
      if (!next.has('at') && effectiveAt) next.set('at', effectiveAt)
      setParams(next, { replace: true })
    }
  }

  const badgeCount = (handler ? 1 : 0) + (changed ? 1 : 0) + (area ? 1 : 0) + (location ? 1 : 0) + (trade ? 1 : 0)
  const tagChips = (['area', 'location', 'trade'] as const).flatMap((k) => params.get(k) ? [{ key: k, label: params.get(k)! }] : [])

  return (
    <section className="ph-progress" aria-label="Project progress">
      <div className="ph-progress-bar">
        {!searching ? (
          <nav ref={trailRef} className="ph-trail" aria-label="Path">
            {effectiveAt ? (
              <button type="button" className="ph-trail-btn" onClick={() => navigateAt(null)}>All</button>
            ) : (
              <span className="ph-trail-cur" aria-current="page">All</span>
            )}
            {trail.map((item, i) => {
              const last = i === trail.length - 1
              return (
                <span key={item.id} className="ph-trail-seg">
                  <span className="ph-trail-sep" aria-hidden="true">›</span>
                  {last ? (
                    <span className="ph-trail-cur" aria-current="page">{item.name}</span>
                  ) : (
                    <button type="button" className="ph-trail-btn" onClick={() => navigateAt(item.id)}>{item.name}</button>
                  )}
                </span>
              )
            })}
          </nav>
        ) : (
          <span className="ph-search-label">
            {rows.length} {rows.length === 1 ? 'match' : 'matches'}
          </span>
        )}
        <button
          type="button"
          className="nbc-chip ph-filter-btn"
          aria-expanded={filterOpen}
          onClick={() => setFilterOpen(true)}
        >
          <SlidersHorizontal size={16} strokeWidth={1.75} aria-hidden="true" />
          <span>Filter</span>
          {badgeCount > 0 && <span className="nbc-filters-count">{badgeCount}</span>}
        </button>
      </div>

      {tagChips.length > 0 && (
        <div className="ph-chips">
          {tagChips.map((c) => (
            <button key={c.key} type="button" className="nbc-chip" aria-label={`Remove ${c.label} filter`} onClick={() => setFilter(c.key, '')}>
              <span>{c.label}</span>
              <X size={14} strokeWidth={1.75} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="ph-empty-box">
          <p className="ph-empty">No activities match these filters.</p>
          {hasFilter && (
            <button type="button" className="btn-secondary" onClick={clearFilters}>Clear filters</button>
          )}
        </div>
      ) : (
        <ul className="ph-list" aria-label="Activities">
          {rows.map((r) => {
            const diff = r.progress - r.previous
            const sub = searching
              ? parentPath(r.activity.parentId) || r.activity.wbs
              : r.group
                ? `${r.activity.wbs} · ${r.leafCount} ${r.leafCount === 1 ? 'activity' : 'activities'}`
                : `${r.activity.wbs} · ${leafHandler(r.activity)}`
            return (
              <li key={r.activity.id} className="ph-row">
                <button
                  type="button"
                  className="ph-row-btn"
                  onClick={() => r.group ? navigateAt(r.activity.id) : setPickedId(r.activity.id)}
                >
                  <span className="ph-row-main">
                    <span className="ph-row-name">{r.activity.name}</span>
                    <span className="ph-row-sub">{sub}</span>
                  </span>
                  <span className="ph-row-end">
                    <span className="ph-row-pct">
                      {percent(r.progress)}
                      {r.group && <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />}
                    </span>
                    {Math.abs(diff) > 1e-12 && (
                      <span className="nbc-delta" data-dir={diff > 0 ? 'up' : 'down'}>{points(diff)}</span>
                    )}
                  </span>
                  <span
                    className="ph-bar"
                    style={{ '--pct': `${Math.min(100, Math.max(0, r.progress * 100))}%` } as React.CSSProperties}
                    aria-hidden="true"
                  />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {searching && searchResult.capped && (
        <p className="ph-cap-note">200+ matches, keep typing</p>
      )}

      <BottomSheet open={filterOpen} onOpenChange={setFilterOpen} title="Filter activities">
        <div className="ph-filter-sheet">
          <div className="ph-filter-field">
            <label htmlFor="ph-handler-filter" className="ph-filter-label">Assigned handler</label>
            <GlassSelect
              id="ph-handler-filter"
              aria-label="Assigned handler"
              value={handler}
              onChange={(e) => setFilter('handler', e.target.value)}
            >
              <option value="">All handlers</option>
              {handlerOptions.map((h) => <option key={h} value={h}>{h}</option>)}
            </GlassSelect>
          </div>
          <div className="ph-filter-switch-row">
            <span id="ph-changed-label">Changed this week</span>
            <button
              type="button"
              role="switch"
              aria-checked={changed}
              aria-labelledby="ph-changed-label"
              className="ph-switch"
              onClick={() => setFilter('changed', changed ? '' : '1')}
            >
              <span className="ph-switch-thumb" />
            </button>
          </div>
          {badgeCount > 0 && (
            <button type="button" className="btn-secondary ph-filter-clear" onClick={() => { clearFilters(); setFilterOpen(false) }}>
              Clear all filters
            </button>
          )}
        </div>
      </BottomSheet>

      <ActivitySheet
        row={selectedRow}
        path={selectedRow ? parentPath(selectedRow.activity.parentId) : ''}
        handler={selectedRow ? leafHandler(selectedRow.activity) : ''}
        remark={selectedRow ? leafRemark(selectedRow.activity) : ''}
        onClose={closeSheet}
      />
    </section>
  )
}
