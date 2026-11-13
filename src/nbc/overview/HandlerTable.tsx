import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { MoreMenu } from '../ui/MoreMenu'
import { StatusPill } from '../ui/StatusPill'
import { reopenUpdate } from '../actions'
import { handlerComplete } from '../handlers'
import { summarize } from '../progress'
import { addDays, changedEntries, submissionStatus, weekLabel, weekStart } from '../submissions'
import { delta, exportSubmission, percent } from '../format'
import { projectHandlers } from '../types'
import type { Handler, NbcActivity, NbcSubmission } from '../types'
import { SubmissionPeek } from './SubmissionPeek'

export function HandlerTable({ projectId, activities, submissions, now }: { projectId: string; activities: NbcActivity[]; submissions: NbcSubmission[]; now: number }) {
  const navigate = useNavigate(), current = weekStart(new Date(now).toLocaleDateString('en-CA', { timeZone: 'Asia/Phnom_Penh' })), last = addDays(current, -7)
  const owners = projectHandlers(projectId)
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set()), [older, setOlder] = useState<ReadonlySet<string>>(new Set())
  const [peek, setPeek] = useState<NbcSubmission | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  // One pass per activities array: totals, each handler's share and weights by id (BP02 has ~16,500 rows).
  const { total, shares, weights, unassigned } = useMemo(() => {
    const weights = new Map<string, number>(), mine = new Map<string, NbcActivity[]>()
    for (const a of activities) { weights.set(a.id, a.globalWeight); const list = mine.get(a.handler); if (list) list.push(a); else mine.set(a.handler, [a]) }
    const shares = new Map([...mine].map(([h, list]) => [h, summarize(list)]))
    // Project weight held by activities with no listed handler; normally none, so the footer only mentions it when it exists.
    const unassigned = [...shares].filter(([h]) => !(projectHandlers(projectId) as readonly string[]).includes(h)).reduce((sum, [, s]) => sum + s.weight, 0)
    return { total: summarize(activities).contribution, shares, weights, unassigned }
  }, [activities, projectId])
  const flip = (set: ReadonlySet<string>, key: string) => { const next = new Set(set); if (next.has(key)) next.delete(key); else next.add(key); return next }
  const find = (handler: Handler, week: string) => submissions.find((s) => s.handler === handler && s.weekStart === week)
  const weighted = (s: NbcSubmission) => s.entries.reduce((sum, e) => sum + (e.progress - e.previous) * (weights.get(e.activityId) ?? 0), 0)

  async function edit(s: NbcSubmission) {
    if (handlerComplete(activities, s.handler)) { setError(`${s.handler} has completed all activities and can no longer update them.`); return }
    setBusy(true)
    try {
      if (s.status === 'confirmed') await reopenUpdate(s.weekStart, s.handler, projectId)
      navigate(`/projects-progress/${projectId}/update?handler=${s.handler}${s.weekStart === last ? `&week=${s.weekStart}` : ''}`)
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  function weekRow(handler: Handler, week: string, label: string, complete: boolean) {
    const s = find(handler, week), editable = week === current
    return <li className="nbc-week-row" key={week}>
      <strong>{label}</strong><span className="small muted">{weekLabel(week)}</span>
      {complete ? <span className="nbc-pill" data-status="Complete">Complete</span> : s || week === current ? <StatusPill status={submissionStatus(s, week, activities, now)} time={s?.confirmedAt}/> : <span className="small muted">Missing</span>}
      <span className="small">{s ? `${changedEntries(s.entries).length} changed · ${delta(weighted(s))}%` : ''}</span>
      {s && <MoreMenu label={`Actions for ${handler} ${label}`}>
        <button onClick={() => setPeek(s)}>Open</button>
        {editable && !complete && <button disabled={busy} onClick={() => void edit(s)}>Edit</button>}
        <button onClick={() => exportSubmission(s, activities)}>Export CSV</button>
      </MoreMenu>}
    </li>
  }
  return <section className="nbc-handler-panel" aria-label="Handler updates">
    <header className="nbc-section-heading"><h2>Handler contributions</h2><p>How far each handler is through their own work, and what that adds to the project.</p></header>
    <div className="table-scroll">
    <table className="nbc-handlers"><caption className="sr-only">Handler updates · due Friday 11:59 PM · Phnom Penh</caption>
      <thead className="sr-only"><tr><th scope="col">Handler</th><th scope="col">This week</th><th scope="col">Last week</th><th scope="col" className="nbc-num">Changed</th><th scope="col" className="nbc-num">Contribution</th></tr></thead>
      <tbody>{owners.flatMap((handler) => {
        const now_ = find(handler, current), prev = find(handler, last), expanded = open.has(handler)
        const complete = handlerComplete(activities, handler)
        const share = shares.get(handler), scope = share?.progress ?? 0
        const cell = (s: NbcSubmission | undefined, week: string, missing: string) => complete
          ? <span className="nbc-pill" data-status="Complete">Complete</span>
          : s || week === current
            ? <StatusPill status={submissionStatus(s, week, activities, now)} time={s?.confirmedAt}/> : <span className="small muted">{missing}</span>
        const rows = [<tr key={handler} className="nbc-handler-row">
          <td><div className="nbc-handler-name"><span className="nbc-handler-avatar" aria-hidden="true">{handler[0]}</span><button className="nbc-handler-toggle" aria-expanded={expanded} aria-label={`${expanded ? 'Collapse' : 'Expand'} ${handler}`} onClick={() => setOpen(flip(open, handler))}><span>{handler}</span>{expanded ? <ChevronDown size={14} aria-hidden="true"/> : <ChevronRight size={14} aria-hidden="true"/>}</button>{complete && <span className="nbc-pill" data-status="Complete">Complete</span>}</div></td>
          <td hidden={!expanded}><span className="nbc-handler-meta-label" aria-hidden="true">This week</span>{complete ? cell(now_, current, 'Missing') : <Link to={`/projects-progress/${projectId}/update?handler=${handler}`}><span className="sr-only">{handler} this week update · </span>{cell(now_, current, 'Missing')}</Link>}</td>
          <td hidden={!expanded}><span className="nbc-handler-meta-label" aria-hidden="true">Last week</span>{prev ? <button className="nbc-linkish" onClick={() => setPeek(prev)}><span className="sr-only">{handler} last week update · </span>{cell(prev, last, 'Missing')}</button> : complete ? cell(undefined, last, 'Missing') : <span className="small muted">Missing</span>}</td>
          <td className="nbc-num" hidden={!expanded}><span className="nbc-handler-meta-label" aria-hidden="true">Changed</span>{now_ ? changedEntries(now_.entries).length : '—'}</td>
          <td className="nbc-handler-contribution" data-empty={scope === 0}><span className="nbc-progress-value">{share ? percent(scope) : '—'}</span><progress max={1} value={scope} aria-label={`${handler} progress on assigned work`}/><span className="nbc-progress-note">{share ? `Adds ${percent(share.contribution)} of the project · ${percent(share.weight)} of the project assigned` : 'No activities assigned'}</span></td></tr>]
        if (expanded) rows.push(<tr key={`${handler}-weeks`} className="nbc-weeks"><td colSpan={5}><ul>
          {weekRow(handler, current, 'This week', complete)}{weekRow(handler, last, 'Last week', complete)}
          <li><button className="nbc-linkish" aria-expanded={older.has(handler)} onClick={() => setOlder(flip(older, handler))}>Older weeks</button>
            {older.has(handler) && <ul>{submissions.filter((s) => s.handler === handler && s.weekStart < last).sort((a, b) => b.weekStart.localeCompare(a.weekStart)).map((s) => weekRow(handler, s.weekStart, weekLabel(s.weekStart), false))}</ul>}</li>
        </ul></td></tr>)
        return rows
      })}</tbody></table></div>
    <footer className="nbc-handler-footer"><div><span>Total contribution</span><strong>{percent(total)}</strong></div><progress max={1} value={total} aria-label="Total project contribution"/><p>{percent(Math.max(0, 1 - total))} of the project remains.{unassigned > 1e-9 ? ` ${percent(unassigned)} of the project has no handler yet.` : ''}</p></footer>
    {error && <p className="form-error" role="alert">{error}</p>}
    <SubmissionPeek submission={peek} activities={activities} now={now} onClose={() => setPeek(null)}/>
  </section>
}
