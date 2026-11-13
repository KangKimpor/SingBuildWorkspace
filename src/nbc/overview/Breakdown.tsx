import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { summarize } from '../progress'
import { percent } from '../format'
import type { NbcActivity } from '../types'
import type { Tags } from '../tags'

/** Completion breakdown groupings: floor and work area. */
export type BreakdownField = 'location' | 'area'
const UNTAGGED = 'Not tagged'
const TITLES: Record<BreakdownField, string> = { area: 'Work area', location: 'Floor / location' }
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
