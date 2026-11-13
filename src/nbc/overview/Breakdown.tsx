import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { summarize } from '../progress'
import { percent } from '../format'
import type { NbcActivity } from '../types'
import type { TagField, Tags } from '../tags'

export type BreakdownField = TagField
const UNTAGGED = 'Not tagged'
const TITLES: Record<BreakdownField, string> = { area: 'Work area', location: 'Floor / location', trade: 'Trade' }
const link = (projectId: string | undefined, params: Record<string, string>) => `/projects-progress/${projectId}/activities?${new URLSearchParams(params)}`

/** Editable activities grouped by one attribute and rolled up, furthest behind first. */
export function breakdownRows(field: BreakdownField, activities: NbcActivity[], previous: Map<string, number>, tags: Map<string, Tags>) {
  const groups = new Map<string, NbcActivity[]>()
  for (const a of activities) if (a.editable) { const key = tags.get(a.id)?.[field] || UNTAGGED; const list = groups.get(key) ?? []; list.push(a); groups.set(key, list) }
  return [...groups].map(([name, list]) => ({ name, ...summarize(list, previous) })).sort((a, b) => a.progress - b.progress || a.name.localeCompare(b.name))
}

/** Progress grouped by one activity attribute, furthest behind first. Each row opens the filtered Progress tab. With `limit`, the rest wait behind "Show all". */
export function Breakdown({ field, activities, previous, tags, limit }: { field: BreakdownField; activities: NbcActivity[]; previous: Map<string, number>; tags: Map<string, Tags>; limit?: number }) {
  const rows = useMemo(() => breakdownRows(field, activities, previous, tags), [field, activities, previous, tags])
  const [all, setAll] = useState(false), cut = !all && limit !== undefined && rows.length > limit
  return <section className="nbc-breakdown" aria-label={TITLES[field]}>
    <h3>{TITLES[field]}</h3>
    <ul>{(cut ? rows.slice(0, limit) : rows).map((r) => <li key={r.name}><Link to={link(activities[0]?.projectId, r.name === UNTAGGED ? {} : { [field]: r.name })} data-empty={r.progress === 0}><span className="nbc-breakdown-label"><span className="nbc-breakdown-name">{r.name}</span><span className="nbc-progress-value">{percent(r.progress)}</span></span><progress max={1} value={r.progress} aria-label={`${r.name} progress`}/><span className="nbc-progress-note">{r.progress === 0 ? 'Not started' : r.progress === 1 ? 'Complete' : `${percent(Math.max(0, 1 - r.progress))} remaining`} · {r.completed.toLocaleString()} of {r.count.toLocaleString()} activities done</span></Link></li>)}</ul>
    {cut && <button type="button" className="btn-secondary nbc-show-all" onClick={() => setAll(true)}>Show all {rows.length}</button>}
    <p className="nbc-progress-legend">Each track represents 0–100% complete.</p>
  </section>
}

/** Floor by trade grid of percent complete, so a lagging trade on one floor stands out. */
export function Heatmap({ activities, tags }: { activities: NbcActivity[]; tags: Map<string, Tags> }) {
  const leaves = activities.filter((a) => a.editable && a.wbs !== 'GR&P')
  const floorOf = (a: NbcActivity) => tags.get(a.id)?.location || UNTAGGED, tradeOf = (a: NbcActivity) => tags.get(a.id)?.trade || UNTAGGED
  const floors = [...new Set(leaves.map(floorOf))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), trades = [...new Set(leaves.map(tradeOf))].sort()
  const cell = (floor: string, trade: string) => { const list = leaves.filter((a) => floorOf(a) === floor && tradeOf(a) === trade); return list.length ? summarize(list).progress : null }
  return <section className="nbc-heatmap" aria-label="Floor by trade heatmap">
    <div className="nbc-heat-grid" style={{ gridTemplateColumns: `minmax(5rem, auto) repeat(${trades.length}, minmax(4.5rem, 1fr))` }}>
      <span/>{trades.map((t) => <span key={t} className="nbc-heat-head">{t}</span>)}
      {floors.flatMap((f) => [<span key={f} className="nbc-heat-head nbc-heat-row">{f}</span>, ...trades.map((t) => {
        const value = cell(f, t)
        return value === null ? <span key={`${f}:${t}`} className="nbc-heat-cell" data-empty="true">–</span>
          : <Link key={`${f}:${t}`} className="nbc-heat-cell" style={{ ['--heat' as string]: `${Math.round(value * 100)}%` }} to={link(leaves[0]?.projectId, { location: f, trade: t })} aria-label={`${f}, ${t}: ${percent(value, 0)}`}>{percent(value, 0)}</Link>
      })])}
    </div>
    <p className="small muted">Percent complete. Darker means further along. Select a cell to open its activities.</p>
  </section>
}
