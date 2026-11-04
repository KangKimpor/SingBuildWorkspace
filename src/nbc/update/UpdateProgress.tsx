import './update.css'
import { useState } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useWorkspace } from '@/data'
import { handlerComplete } from '../handlers'
import { submissionId, weekStart } from '../submissions'
import { projectHandlers } from '../types'
import type { Handler, NbcActivity, NbcSubmission } from '../types'
import { deadlineNote, useNow } from './deadline'
import { HandlerGate } from './HandlerGate'
import { UpdateEditor } from './UpdateEditor'

interface Props { projectId: string; activities: NbcActivity[]; submissions: NbcSubmission[] }

function UpdateScreen({ projectId, activities, submissions, handler, onChange }: Props & { handler: Handler; onChange: () => void }) {
  const scope = useWorkspace((s) => s.scope), now = useNow()
  const [expanded, setExpanded] = useState(false)
  const week = weekStart()
  const selected = submissions.find((s) => s.id === submissionId(projectId, week, handler))
  const deadline = deadlineNote(week, now)
  if (handlerComplete(activities, handler)) return <div className="nbc-gate" data-complete="true">
    <h2>{handler} is complete</h2>
    <p className="muted">Every activity assigned to {handler} is at 100%, so this update is locked. If more work is needed, an activity must first be reassigned or corrected.</p>
    <button className="btn-secondary nbc-gate-go" onClick={onChange}>Choose another handler</button>
  </div>
  // Deadline and editor controls sit in the table's search row so the header row is not needed.
  const controls = <>
    {selected?.status === 'confirmed'
      ? <span className="nbc-deadline" data-tone={selected.late ? 'late' : 'ok'}>{selected.late ? 'Late' : 'On time'}</span>
      : deadline.tone !== 'late' && <span className="nbc-deadline" data-tone={deadline.tone}>{deadline.text}</span>}
    <button className="nbc-chip nbc-change-handler" aria-label={`Change handler, currently ${handler}`} onClick={onChange}>Change Handler</button>
    <button className="nbc-chip nbc-expand-editor" aria-pressed={expanded} onClick={() => setExpanded(!expanded)}>
      {expanded ? <Minimize2 size={15} aria-hidden="true" /> : <Maximize2 size={15} aria-hidden="true" />}
      {expanded ? 'Collapse editor' : 'Expand editor'}
    </button>
  </>
  return <section className="nbc-update" data-expanded={expanded} aria-label="Weekly progress update">
    <UpdateEditor key={`${scope}:${week}:${handler}:${selected?.status === 'confirmed' ? 'confirmed' : 'editing'}:${activities[0]?.baselineResetAt ?? ''}`} projectId={projectId} week={week} handler={handler} activities={activities} submission={selected} pastDeadline={deadline.late} controls={controls}/>
  </section>
}

export default function UpdateProgress({ projectId, activities, submissions }: Props) {
  const [params, setParams] = useSearchParams()
  // A handler in the link (for example from Overview) counts as already chosen. Otherwise ask first.
  const [handler, setHandler] = useState<Handler | null>(() => projectHandlers(projectId).find((h) => h === params.get('handler')) ?? null)
  function choose(value: Handler | null) {
    setHandler(value)
    const next = new URLSearchParams(params)
    if (value) next.set('handler', value); else next.delete('handler')
    setParams(next, { replace: true })
  }
  if (!handler) return <section className="nbc-update nbc-update-gate" aria-label="Choose your handler"><HandlerGate projectId={projectId} week={weekStart()} activities={activities} submissions={submissions} onChoose={choose}/></section>
  return <UpdateScreen projectId={projectId} activities={activities} submissions={submissions} handler={handler} onChange={() => choose(null)}/>
}
