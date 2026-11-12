import { useEffect, useId, useRef, useState } from 'react'
import type { NbcWeekSummary } from './types'
import { delta, percent } from './format'
import { addDays, weekLabel } from './submissions'
import type { NbcPlan } from './plan'
import { daysBetween, NBC_PLAN, planDate, plannedProgress } from './plan'

const H = 264, LEFT = 8, RIGHT = 46, TOP = 34, BASE = 232, PLOT = BASE - TOP
const month = (date: string) => new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
type Pt = [number, number]

/** Smooth curve through the points that never overshoots between them (monotone cubic), so a rising plan never dips or exceeds 100%. */
function smooth(p: Pt[]) {
  const n = p.length
  if (n === 0) return ''
  if (n === 1) return `M${p[0]![0]},${p[0]![1]}`
  const dx: number[] = [], m: number[] = [], t: number[] = Array.from({ length: n }, () => 0)
  for (let i = 0; i < n - 1; i++) { dx[i] = p[i + 1]![0] - p[i]![0]; m[i] = dx[i] ? (p[i + 1]![1] - p[i]![1]) / dx[i]! : 0 }
  t[0] = m[0]!; t[n - 1] = m[n - 2]!
  for (let i = 1; i < n - 1; i++) {
    const a = m[i - 1]!, b = m[i]!
    t[i] = a * b <= 0 ? 0 : 3 * (dx[i - 1]! + dx[i]!) / ((2 * dx[i]! + dx[i - 1]!) / a + (dx[i]! + 2 * dx[i - 1]!) / b)
  }
  let d = `M${p[0]![0]},${p[0]![1]}`
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i]! / 3
    d += `C${p[i]![0] + h},${p[i]![1] + t[i]! * h} ${p[i + 1]![0] - h},${p[i + 1]![1] - t[i + 1]! * h} ${p[i + 1]![0]},${p[i + 1]![1]}`
  }
  return d
}

/** Cumulative progress by week against the contract plan. Actual points come only from confirmed app updates. */
export default function Trend({ summaries, today, plan = NBC_PLAN }: { summaries: NbcWeekSummary[]; today?: string; plan?: NbcPlan | null }) {
  const [table, setTable] = useState(false), sorted = [...summaries].sort((a, b) => a.weekStart.localeCompare(b.weekStart))
  const box = useRef<HTMLDivElement>(null), [width, setWidth] = useState(880), gradient = useId()
  // The chart is drawn at its real pixel width so text keeps its size on every screen.
  useEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const watch = new ResizeObserver(([entry]) => { if (entry) setWidth(Math.max(300, Math.round(entry.contentRect.width))) })
    watch.observe(el)
    return () => watch.disconnect()
  }, [table])
  const start = plan?.commencement ?? (sorted.length ? addDays(sorted[0]!.weekStart, -7) : today ?? '2026-01-01'), last = sorted.length ? addDays(sorted.at(-1)!.weekStart, 6) : start
  const end = addDays([plan?.completion ?? start, last, today ?? start].sort().at(-1)!, 14), span = Math.max(1, daysBetween(start, end))
  const plannedAt = (date: string) => plan ? percent(plannedProgress(date, plan.points)) : '—'
  const plotW = width - LEFT - RIGHT
  const x = (date: string) => LEFT + plotW * daysBetween(start, date) / span, y = (value: number) => BASE - Math.min(1, Math.max(0, value)) * PLOT
  const planned: Pt[] = (plan?.points ?? []).map(([d, v]) => [x(d), y(v)])
  const actual = sorted.map((s) => ({ s, cx: x(addDays(s.weekStart, 6)), cy: y(s.overall) }))
  const ticks: string[] = []
  for (let d = `${start.slice(0, 7)}-01`; d <= end; d = new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7), 1)).toISOString().slice(0, 10)) if (d > start) ticks.push(d)
  // Show a month label only where the previous one has left room.
  const shown = ticks.reduce<string[]>((kept, d) => kept.length && x(d) - x(kept.at(-1)!) < 44 ? kept : [...kept, d], [])
  const lastPoint = actual.at(-1)
  const callout = lastPoint ? percent(lastPoint.s.overall, 1) : ''
  const calloutW = callout.length * 7 + 18
  const deadlineX = plan ? x(plan.completion) : 0, deadlineLabel = plan ? `Deadline ${planDate(plan.completion)}` : ''
  const deadlineW = deadlineLabel.length * 6.4 + 16
  return <section className="nbc-panel nbc-trend">
    <div className="row-between"><div><h2>Progress curve</h2><p className="small muted">Planned against actual · actual counts confirmed reporting weeks</p></div>
      <div className="nbc-trend-tools"><span className="nbc-legend"><i data-line="actual"/>Actual{plan && <><i data-line="plan"/>Planned</>}</span><button className="text-link small" onClick={() => setTable(!table)}>{table ? 'View chart' : 'View as table'}</button></div></div>
    {table ? <div className="table-scroll"><table className="task-table"><thead><tr><th>Week</th><th>Planned</th><th>Actual</th><th>Change</th></tr></thead><tbody>{sorted.map((s) => <tr key={s.id}><td>{weekLabel(s.weekStart)}</td><td>{plannedAt(addDays(s.weekStart, 6))}</td><td>{percent(s.overall)}</td><td>{delta(s.overall - s.previous)}%</td></tr>)}</tbody></table></div> : <>
      <div ref={box} className="nbc-trend-plot">
      <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label={`${plan ? `Planned progress reaches 100% on ${planDate(plan.completion)}. ` : 'No planned curve is loaded for this project. '}${sorted.length ? sorted.map((s) => `${weekLabel(s.weekStart)}: ${percent(s.overall)}`).join('; ') : 'No confirmed reporting weeks'}`}>
        <defs><linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".22"/><stop offset="1" stopColor="var(--accent)" stopOpacity="0"/></linearGradient></defs>
        {[0, .25, .5, .75, 1].map((n) => <g key={n}><line x1={LEFT} x2={LEFT + plotW} y1={y(n)} y2={y(n)} stroke="currentColor" strokeOpacity={n === 0 ? .18 : .08}/><text x={width} y={y(n) + 4} textAnchor="end" className="nbc-trend-axis">{n * 100}%</text></g>)}
        {shown.map((d) => <text key={d} x={x(d)} y={H - 6} textAnchor="middle" className="nbc-trend-axis">{month(d)}</text>)}
        {plan && <g><line x1={deadlineX} x2={deadlineX} y1={TOP - 6} y2={BASE} stroke="var(--danger-text)" strokeOpacity=".35" strokeDasharray="2 4" strokeLinecap="round"/>
          <rect x={Math.min(deadlineX - deadlineW / 2, width - RIGHT - deadlineW + 24)} y={TOP - 28} width={deadlineW} height="20" rx="10" fill="var(--status-danger-bg)"/>
          <text x={Math.min(deadlineX, width - RIGHT - deadlineW / 2 + 24)} y={TOP - 14} textAnchor="middle" className="nbc-trend-chip" fill="var(--danger-text)">{deadlineLabel}</text></g>}
        {today && <g><line x1={x(today)} x2={x(today)} y1={TOP} y2={BASE} stroke="currentColor" strokeOpacity=".22"/><text x={x(today)} y={BASE + 16} textAnchor="middle" className="nbc-trend-axis" fontWeight="600">Today</text></g>}
        {plan && <path data-series="plan" data-points={planned.map(([px, py]) => `${px},${py}`).join(' ')} d={smooth(planned)} fill="none" stroke="currentColor" strokeOpacity=".38" strokeWidth="2" strokeDasharray="1 6" strokeLinecap="round" strokeLinejoin="round"/>}
        {actual.length > 1 && <>
          <path d={`${smooth(actual.map((p) => [p.cx, p.cy]))}L${actual.at(-1)!.cx},${BASE}L${actual[0]!.cx},${BASE}Z`} fill={`url(#${gradient})`}/>
          <path data-series="actual" data-points={actual.map((p) => `${p.cx},${p.cy}`).join(' ')} d={smooth(actual.map((p) => [p.cx, p.cy]))} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/></>}
        {lastPoint && <ellipse cx={lastPoint.cx} cy={lastPoint.cy} rx="11" ry="11" fill="var(--accent)" fillOpacity=".16"/>}
        {actual.map((p, i) => <circle key={p.s.id} cx={p.cx} cy={p.cy} r={i === actual.length - 1 ? 5.5 : 3.5} fill="var(--bg-canvas)" stroke="var(--accent)" strokeWidth={i === actual.length - 1 ? 3 : 2.5}><title>{weekLabel(p.s.weekStart)} · actual {percent(p.s.overall)} · planned {plannedAt(addDays(p.s.weekStart, 6))} · {delta(p.s.overall - p.s.previous)}%</title></circle>)}
        {lastPoint && <g><rect x={Math.min(lastPoint.cx - calloutW / 2, width - calloutW)} y={lastPoint.cy - 40} width={calloutW} height="24" rx="12" fill="var(--text-primary)"/><text x={Math.min(lastPoint.cx, width - calloutW / 2)} y={lastPoint.cy - 24} textAnchor="middle" className="nbc-trend-chip" fill="var(--bg-canvas)">{callout}</text></g>}
      </svg></div>
      {!plan && <p className="small muted">No planned curve or contract dates were supplied for this project, so only confirmed actual progress is shown.</p>}
      {sorted.length < 2 && <p className="small muted">The actual line appears after the second confirmed week.</p>}
    </>}
  </section>
}
