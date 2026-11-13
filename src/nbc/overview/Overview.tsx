import './overview.css'
import { useEffect, useMemo, useState } from 'react'
import type { ProjectSummary } from '@/data'
import { calculate } from '../progress'
import { handlerComplete } from '../handlers'
import { addDays, weekLabel, weekStart } from '../submissions'
import { percent } from '../format'
import { daysToCompletion, projectPlan, planDate, plannedProgress } from '../plan'
import { projectHandlers } from '../types'
import type { NbcActivity, NbcSubmission, NbcWeekSummary } from '../types'
import { deadlineNote } from '../update/deadline'
import Trend from '../Trend'
import { Attention } from './Attention'
import { Breakdown, Heatmap } from './Breakdown'
import type { BreakdownField } from './Breakdown'
import { HandlerTable } from './HandlerTable'
import { attentionItems } from './insights'

const GROUPS = [['location', 'Floor'], ['area', 'Work area'], ['trade', 'Trade'], ['heatmap', 'Heatmap']] as const
const pts = (n: number) => `${Math.abs(n * 100).toFixed(2)} pts`

export default function Overview({ project, activities, submissions, summaries, baseline, overall: known }: { project: ProjectSummary; activities: NbcActivity[]; submissions: NbcSubmission[]; summaries: NbcWeekSummary[]; baseline: Map<string, number>; /** Project roll-up, when the caller already has it. */ overall?: number }) {
  const [now, setNow] = useState(Date.now)
  const [group, setGroup] = useState<BreakdownField | 'heatmap'>('location')
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer) }, [])
  const overall = useMemo(() => { if (known !== undefined) return known; try { return calculate(activities).overall } catch { return 0 } }, [known, activities])
  const today = new Date(now).toLocaleDateString('en-CA', { timeZone: 'Asia/Phnom_Penh' }), current = weekStart(today)
  const owners = projectHandlers(project.id)
  const active = owners.filter((h) => !handlerComplete(activities, h))
  const updated = active.filter((h) => submissions.some((s) => s.handler === h && s.weekStart === current && s.status === 'confirmed'))
  const thisWeek = summaries.find((s) => s.weekStart === current), lastWeek = summaries.find((s) => s.weekStart === addDays(current, -7))
  const plan = projectPlan(project.id)
  const planned = plan ? plannedProgress(today, plan.points) : null, gap = planned === null ? null : overall - planned, days = plan ? daysToCompletion(today, plan.completion) : null
  const deadline = deadlineNote(current, now)
  const attention = attentionItems({ projectId: project.id, activities, submissions, today, now })
  return <div className="nbc-overview">
    <header className="nbc-ov-head"><div><h2>Overview</h2><p className="small muted">{weekLabel(current)}</p></div></header>
    <section className="nbc-kpis" aria-label="Project snapshot">
      <div className="nbc-kpi"><span className="nbc-kpi-label">Overall progress</span><strong className="nbc-kpi-value">{percent(overall)}</strong><span className="small muted">{thisWeek ? `${thisWeek.overall >= thisWeek.previous ? '+' : '−'}${pts(thisWeek.overall - thisWeek.previous)} this week` : lastWeek ? `Last week ${percent(lastWeek.overall)}` : 'No confirmed week yet'}</span></div>
      <div className="nbc-kpi"><span className="nbc-kpi-label">Versus plan</span>{gap === null || planned === null ? <><strong className="nbc-kpi-value">No plan</strong><span className="small muted">No planned curve supplied</span></> : <><strong className="nbc-kpi-value" data-tone={gap < -0.04 ? 'bad' : gap < -0.01 ? 'warn' : 'ok'}>{percent(Math.abs(gap))} {gap < 0 ? 'behind' : 'ahead'}</strong><span className="small muted">Plan: {percent(planned)} by now</span></>}</div>
      <div className="nbc-kpi"><span className="nbc-kpi-label">Completion deadline</span>{plan && days !== null ? <><strong className="nbc-kpi-value">{planDate(plan.completion)}</strong><span className="small" data-tone={days < 0 ? 'bad' : undefined}>{days < 0 ? `${-days} days overdue` : days === 0 ? 'Due today' : `${days} days left`}</span></> : <><strong className="nbc-kpi-value">Not set</strong><span className="small muted">No contract dates supplied</span></>}</div>
      <div className="nbc-kpi"><span className="nbc-kpi-label">Weekly reporting</span><strong className="nbc-kpi-value" data-tone={deadline.late && updated.length < active.length ? 'bad' : undefined}>{deadline.late ? 'Deadline passed' : deadline.text.split(' · ')[1]}</strong><span className="small muted">{active.length ? `${updated.length} of ${active.length} handlers updated this week` : 'All handler work is complete'}</span></div>
    </section>
    <Attention items={attention}/>
    <Trend summaries={summaries} today={today} plan={plan}/>
    <div className="nbc-progress-panels"><HandlerTable projectId={project.id} activities={activities} submissions={submissions} now={now}/>
    <section className="nbc-execution"><div className="row-between"><div><h2>Completion breakdown</h2><p className="small muted">Furthest behind first. Select a row to open its activities.</p></div><div className="nbc-seg" role="group" aria-label="Breakdown grouping">{GROUPS.map(([key, label]) => <button key={key} aria-pressed={group === key} onClick={() => setGroup(key)}>{label}</button>)}</div></div>
      <div className="nbc-breakdowns">{group === 'heatmap' ? <Heatmap activities={activities}/> : <Breakdown field={group} activities={activities} previous={baseline}/>}</div>
    </section></div>
  </div>
}
