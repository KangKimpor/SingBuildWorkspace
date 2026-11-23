import { useState } from 'react'
import { handlerComplete } from '../handlers'
import { canUpdate, changedEntries, submissionId } from '../submissions'
import { projectHandlers } from '../types'
import { Avatar } from '../ui/Avatar'
import type { Handler, NbcActivity, NbcSubmission } from '../types'

interface Props { projectId: string; week: string; activities: NbcActivity[]; submissions: NbcSubmission[]; onChoose: (handler: Handler) => void }

/** First step of Update Progress: say who you are before any activity can be edited. */
export function HandlerGate({ projectId, week, activities, submissions, onChoose }: Props) {
  const [picked, setPicked] = useState<Handler | null>(null)
  return <div className="nbc-gate">
    <h2>Who is updating?</h2>
    <div className="nbc-gate-list" role="group" aria-label="Handler">
      {projectHandlers(projectId).map((h) => {
        const submission = submissions.find((s) => s.id === submissionId(projectId, week, h))
        const complete = handlerComplete(activities, h)
        const count = activities.filter((a) => canUpdate(a, h)).length
        const status = complete ? 'Complete' : submission?.status === 'confirmed' ? 'Updated' : submission?.status === 'draft' && changedEntries(submission.entries).length > 0 ? 'Draft' : 'Not yet'
        return <button key={h} aria-pressed={picked === h} disabled={complete} onClick={() => setPicked(h)}>
          <span className="nbc-radio" aria-hidden="true"/>
          <Avatar name={h} size="lg"/>
          <span className="nbc-gate-name"><strong>{h}</strong><small>{count} activities</small></span>
          <span className="nbc-pill" data-status={status}>{status}</span>
        </button>
      })}
    </div>
    <button className="btn-accent nbc-gate-go" disabled={!picked} onClick={() => picked && onChoose(picked)}>{picked ? `Continue as ${picked}` : 'Choose a handler'}</button>
  </div>
}
