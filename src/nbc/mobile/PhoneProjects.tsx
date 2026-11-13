import './mobile.css'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { ProjectSummary } from '@/data'
import { useProjects } from '@/data'
import { projectTile, Tile } from '@/components/WorkspaceUI'
import { usePhoneHeader } from '@/shell/phoneHeader'
import { percent } from '../format'
import { plannedProgress, projectPlan } from '../plan'
import { reportingDate, weekStart } from '../submissions'
import { deadlineNote, useNow } from '../update/deadline'

/** Project name before the client ("NBC BP02 – Pan Pacific Hotel" → "NBC BP02"). */
export const shortName = (name: string) => name.split(' – ')[0]!.trim()
const client = (name: string) => name.split(' – ').slice(1).join(' – ')
const bpNumber = (name: string) => Number(/BP\s*0*(\d+)/i.exec(name)?.[1] ?? Number.MAX_SAFE_INTEGER)

function Card({ project, today, report }: { project: ProjectSummary; today: string; report: { text: string; tone?: string } }) {
  // Overall is the store's per-project roll-up (the sidebar's figure); the plan point is one interpolation.
  const plan = useMemo(() => { const p = projectPlan(project.id); return p ? plannedProgress(today, p.points) : null }, [project.id, today])
  const gap = plan === null ? null : project.progress - plan
  const vs = gap === null ? { text: 'No plan' } : Math.abs(gap) < 5e-5 ? { text: 'On plan' }
    : { text: `${percent(Math.abs(gap))} ${gap < 0 ? 'behind' : 'ahead of'} plan`, tone: gap < -0.04 ? 'bad' : gap < -0.01 ? 'warn' : gap > 0 ? 'ok' : undefined }
  const sub = client(project.name)
  return <li>
    <Link className="ph-card" to={`/projects-progress/${project.id}/overview`}>
      <Tile name={projectTile(project)} color={project.color}/>
      <span className="ph-card-name"><strong>{shortName(project.name)}</strong>{sub && <span>{sub}</span>}</span>
      <span className="ph-card-pct">{percent(project.progress)}</span>
      <span className="ph-bar" style={{ '--pct': `${Math.min(100, Math.max(0, project.progress * 100))}%` } as React.CSSProperties} aria-hidden="true"/>
      <span className="ph-card-status"><span data-tone={vs.tone}>{vs.text}</span> · <span data-tone={report.tone}>{report.text}</span></span>
    </Link>
  </li>
}

/** Phone home: one card per progress project, in BP order. Settings is the top bar's gear. */
export default function PhoneProjects() {
  usePhoneHeader({ title: 'Progress' })
  const all = useProjects(), now = useNow()
  const projects = useMemo(() => all.filter((p) => p.nbcBp03 && p.status !== 'Archived').sort((a, b) => bpNumber(a.name) - bpNumber(b.name)), [all])
  const today = reportingDate(new Date(now)), deadline = deadlineNote(weekStart(today), now)
  const report = deadline.late ? { text: 'Reporting closed', tone: 'bad' } : { text: `${deadline.text.split(' · ')[1]} to report`, tone: deadline.tone === 'soon' ? 'warn' : undefined }
  return <div className="ph-projects">
    {projects.length
      ? <ul className="ph-cards" aria-label="Progress projects">{projects.map((p) => <Card key={p.id} project={p} today={today} report={report}/>)}</ul>
      : <p className="ph-empty">No progress projects yet.</p>}
  </div>
}
