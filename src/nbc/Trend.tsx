import { useEffect, useId, useRef, useState } from 'react'
import type { NbcWeekSummary } from './types'
import { delta, percent } from './format'
import { addDays, weekLabel } from './submissions'
import type { NbcPlan } from './plan'
import { daysBetween, NBC_PLAN, planDate, plannedProgress } from './plan'

const H = 264, LEFT = 8, RIGHT = 46, TOP = 34, BASE = 236, PLOT = BASE - TOP, AXIS_Y = BASE + 18, TICK_GAP = 44
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

/** Week-on-week change as a quiet pill: green up, red down, gray when unchanged. Sign and tint carry the direction. */
function Change({ value }: { value: number }) {
  const sign = Math.abs(value) < 1e-10 ? 'flat' : value > 0 ? 'up' : 'down'
  return <span className="nbc-trend-change" data-sign={sign}>{delta(value).replace(/^[▲▼] /, '')}%</span>
}

/** Cumulative progress by week against the contract plan. Actual points come only from confirmed app updates. */
export default function Trend({ summaries, today, plan = NBC_PLAN }: { summaries: NbcWeekSummary[]; today?: string; plan?: NbcPlan | null }) {
  const [table, setTable] = useState(false), [hovered, setHovered] = useState<number | null>(null)
  const sorted = [...summaries].sort((a, b) => a.weekStart.localeCompare(b.weekStart))
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
  const todayX = today ? x(today) : null
  const todayLabelX = todayX !== null ? Math.min(Math.max(todayX, LEFT + 18), width - 18) : 0
  // Show a month label only where the previous one and the Today marker have left room.
  const shown = ticks
    .reduce<string[]>((kept, d) => kept.length && x(d) - x(kept.at(-1)!) < TICK_GAP ? kept : [...kept, d], [])
    .filter((d) => todayX === null || Math.abs(x(d) - todayLabelX) >= TICK_GAP)
  const lastPoint = actual.at(-1)
  const activeIndex = hovered !== null && hovered < actual.length ? hovered : null
  const activePoint = activeIndex !== null ? actual[activeIndex] : null
  const highlightPoint = activePoint ?? lastPoint
  const callout = lastPoint ? percent(lastPoint.s.overall, 1) : ''
  const calloutW = callout.length * 7 + 18
  const deadlineX = plan ? x(plan.completion) : 0, deadlineLabel = plan ? `Deadline ${planDate(plan.completion)}` : ''
  const deadlineW = deadlineLabel.length * 6.4 + 16
  // Voronoi-style vertical hover bands so hovering anywhere along a past week snaps cleanly to its point.
  const bands = actual.map((p, i) => {
    const prevX = i > 0 ? (actual[i - 1]!.cx + p.cx) / 2 : Math.max(LEFT, p.cx - 28)
    const nextX = i < actual.length - 1 ? (p.cx + actual[i + 1]!.cx) / 2 : Math.min(LEFT + plotW, p.cx + 28)
    return { x: prevX, width: Math.max(12, nextX - prevX) }
  })
  const tipLeft = activePoint ? Math.min(Math.max(activePoint.cx, 88), Math.max(88, width - 88)) : 0
  const tipBelow = activePoint ? activePoint.cy < 86 : false
  return <section className="nbc-panel nbc-trend">
    <div className="row-between"><div><h2>Progress curve</h2><p className="small muted">Planned against actual · actual counts confirmed reporting weeks</p></div>
      <div className="nbc-trend-tools">
        <ul className="nbc-legend" aria-label="Legend"><li><i data-line="actual" aria-hidden="true"/>Actual</li>{plan && <li><i data-line="plan" aria-hidden="true"/>Planned</li>}</ul>
        <div className="nbc-trend-seg" role="group" aria-label="Progress curve view"><button type="button" aria-pressed={!table} onClick={() => setTable(false)}>Chart</button><button type="button" aria-pressed={table} onClick={() => setTable(true)}>Table</button></div>
      </div></div>
    {table ? <div className="table-scroll"><table className="nbc-trend-table"><thead><tr><th scope="col">Week</th><th scope="col" data-num>Planned</th><th scope="col" data-num>Actual</th><th scope="col" data-num>Change</th></tr></thead><tbody>{sorted.map((s) => <tr key={s.id}><th scope="row">{weekLabel(s.weekStart)}</th><td data-num data-muted>{plannedAt(addDays(s.weekStart, 6))}</td><td data-num data-strong>{percent(s.overall)}</td><td data-num><Change value={s.overall - s.previous}/></td></tr>)}</tbody></table></div> : <>
      <div ref={box} className="nbc-trend-plot" onMouseLeave={() => setHovered(null)}>
      <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label={`${plan ? `Planned progress reaches 100% on ${planDate(plan.completion)}. ` : 'No planned curve is loaded for this project. '}${sorted.length ? sorted.map((s) => `${weekLabel(s.weekStart)}: ${percent(s.overall)}`).join('; ') : 'No confirmed reporting weeks'}`}>
        <defs><linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".22"/><stop offset="1" stopColor="var(--accent)" stopOpacity="0"/></linearGradient></defs>
        {[0, .25, .5, .75, 1].map((n) => <g key={n}><line x1={LEFT} x2={LEFT + plotW} y1={y(n)} y2={y(n)} stroke="currentColor" strokeOpacity={n === 0 ? .18 : .08}/><text x={width} y={y(n) + 4} textAnchor="end" className="nbc-trend-axis">{n * 100}%</text></g>)}
        {shown.map((d) => <text key={d} x={x(d)} y={AXIS_Y} textAnchor="middle" className="nbc-trend-axis">{month(d)}</text>)}
        {plan && <g><line x1={deadlineX} x2={deadlineX} y1={TOP - 6} y2={BASE} stroke="var(--danger-text)" strokeOpacity=".35" strokeDasharray="2 4" strokeLinecap="round"/>
          <rect x={Math.min(deadlineX - deadlineW / 2, width - RIGHT - deadlineW + 24)} y={TOP - 28} width={deadlineW} height="20" rx="10" fill="var(--status-danger-bg)"/>
          <text x={Math.min(deadlineX, width - RIGHT - deadlineW / 2 + 24)} y={TOP - 14} textAnchor="middle" className="nbc-trend-chip" fill="var(--danger-text)">{deadlineLabel}</text></g>}
        {today && todayX !== null && <g><line x1={todayX} x2={todayX} y1={TOP} y2={BASE + 4} stroke="currentColor" strokeOpacity=".22"/><text x={todayLabelX} y={AXIS_Y} textAnchor="middle" className="nbc-trend-axis nbc-trend-today">Today</text></g>}
        {plan && <path data-series="plan" data-points={planned.map(([px, py]) => `${px},${py}`).join(' ')} d={smooth(planned)} fill="none" stroke="currentColor" strokeOpacity=".38" strokeWidth="2" strokeDasharray="1 6" strokeLinecap="round" strokeLinejoin="round"/>}
        {actual.length > 1 && <>
          <path d={`${smooth(actual.map((p) => [p.cx, p.cy]))}L${actual.at(-1)!.cx},${BASE}L${actual[0]!.cx},${BASE}Z`} fill={`url(#${gradient})`}/>
          <path data-series="actual" data-points={actual.map((p) => `${p.cx},${p.cy}`).join(' ')} d={smooth(actual.map((p) => [p.cx, p.cy]))} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/></>}
        {activePoint && <line className="nbc-trend-guide" x1={activePoint.cx} x2={activePoint.cx} y1={TOP} y2={BASE} stroke="var(--accent)" strokeOpacity=".32" strokeWidth="1.25" strokeDasharray="2 3"/>}
        {highlightPoint && <ellipse cx={highlightPoint.cx} cy={highlightPoint.cy} rx="11" ry="11" fill="var(--accent)" fillOpacity=".16"/>}
        {actual.map((p, i) => {
          const band = bands[i]!
          return <rect key={`${p.s.id}-hit`} className="nbc-trend-hit" x={band.x} y={TOP - 10} width={band.width} height={PLOT + 20} fill="transparent" onMouseEnter={() => setHovered(i)}/>
        })}
        {actual.map((p, i) => {
          const emphasized = activeIndex !== null ? i === activeIndex : i === actual.length - 1
          return <circle key={p.s.id} cx={p.cx} cy={p.cy} r={emphasized ? 5.5 : 3.5} fill="var(--bg-canvas)" stroke="var(--accent)" strokeWidth={emphasized ? 3 : 2.5} onMouseEnter={() => setHovered(i)}><title>{weekLabel(p.s.weekStart)} · actual {percent(p.s.overall)} · planned {plannedAt(addDays(p.s.weekStart, 6))} · {delta(p.s.overall - p.s.previous)}%</title></circle>
        })}
        {lastPoint && activeIndex === null && <g><rect x={Math.min(lastPoint.cx - calloutW / 2, width - calloutW)} y={lastPoint.cy - 40} width={calloutW} height="24" rx="12" fill="var(--text-primary)"/><text x={Math.min(lastPoint.cx, width - calloutW / 2)} y={lastPoint.cy - 24} textAnchor="middle" className="nbc-trend-chip" fill="var(--bg-canvas)">{callout}</text></g>}
      </svg>
      {activePoint && (
        <div
          className="nbc-trend-tip"
          data-placement={tipBelow ? 'below' : 'above'}
          style={{ left: `${tipLeft}px`, top: `${tipBelow ? activePoint.cy + 16 : activePoint.cy - 14}px` }}
          aria-hidden="true"
        >
          <span className="nbc-trend-tip-week">{weekLabel(activePoint.s.weekStart)}</span>
          <div className="nbc-trend-tip-row">
            <span className="nbc-trend-tip-dot" data-series="actual"/>
            <strong className="nbc-trend-tip-pct">{percent(activePoint.s.overall)}</strong>
            <span className="nbc-trend-tip-delta" data-sign={activePoint.s.overall - activePoint.s.previous > 1e-9 ? 'up' : activePoint.s.overall - activePoint.s.previous < -1e-9 ? 'down' : 'flat'}>
              {delta(activePoint.s.overall - activePoint.s.previous).replace(/^[▲▼] /, '')}%
            </span>
          </div>
          {plan && (
            <div className="nbc-trend-tip-plan">
              <span className="nbc-trend-tip-dot" data-series="plan"/>
              <span>Plan {plannedAt(addDays(activePoint.s.weekStart, 6))}</span>
            </div>
          )}
        </div>
      )}
      </div>
      {!plan && <p className="small muted">No planned curve or contract dates were supplied for this project, so only confirmed actual progress is shown.</p>}
      {sorted.length < 2 && <p className="small muted">The actual line appears after the second confirmed week.</p>}
    </>}
  </section>
}
