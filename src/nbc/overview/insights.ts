import { addDays, weekDeadline, weekStart } from '../submissions'
import { percent } from '../format'
import { handlerComplete } from '../handlers'
import { projectHandlers } from '../types'
import type { NbcActivity, NbcSubmission } from '../types'
import { deadlineNote } from '../update/deadline'

const WEEK_MS = 7 * 86400000, STALLED_DAYS = 14

export interface AttentionItem { id: string; tone: 'red' | 'amber'; title: string; detail: string; impact?: string; to: string }
interface AttentionInput { projectId: string; activities: NbcActivity[]; submissions: NbcSubmission[]; today: string; now: number }

/** What needs a manager's eye this week, most urgent first. Private coordination tasks are deliberately not included. */
export function attentionItems({ projectId, activities, submissions, today, now }: AttentionInput): AttentionItem[] {
  const current = weekStart(today), base = `/projects-progress/${projectId}`, items: AttentionItem[] = []
  const missing = projectHandlers(projectId).filter((h) => !handlerComplete(activities, h) && activities.some((a) => a.editable && a.handler === h) && !submissions.some((s) => s.handler === h && s.weekStart === current && s.status === 'confirmed'))
  if (missing.length) {
    const overdue = now >= weekDeadline(current)
    items.push({ id: 'missing', tone: overdue ? 'red' : 'amber', title: `${missing.join(', ')} ${missing.length === 1 ? 'has' : 'have'} not updated`, detail: overdue ? 'Deadline passed Friday 11:59 PM' : deadlineNote(current, now).text, impact: overdue ? 'overdue' : `${missing.length} to go`, to: `${base}/update` })
  }
  const byId = new Map(activities.map((a) => [a.id, a]))
  const lowered = submissions.filter((s) => s.status === 'confirmed' && (s.weekStart === current || s.weekStart === addDays(current, -7)))
    .flatMap((s) => s.entries.filter((e) => e.progress < e.previous - 1e-12).map((e) => ({ s, e, a: byId.get(e.activityId) })))
    .filter((x): x is typeof x & { a: NbcActivity } => !!x.a)
    .map((x) => ({ ...x, drop: (x.e.previous - x.e.progress) * x.a.globalWeight })).sort((x, y) => y.drop - x.drop).slice(0, 3)
  for (const { s, e, a, drop } of lowered) items.push({ id: `lowered:${s.id}:${a.id}`, tone: 'amber', title: `${a.wbs} ${a.name} lowered ${percent(e.previous, 0)} → ${percent(e.progress, 0)}`, detail: `${s.handler}${e.remark.trim() ? ` · ${e.remark.trim()}` : ''}`, impact: `−${(drop * 100).toFixed(2)}% overall`, to: `${base}/activities?wbs=${encodeURIComponent(a.wbs)}` })
  const stalled = activities.filter((a) => a.editable && a.progress > 0 && a.progress < 1 && a.history.length)
    .map((a) => ({ a, idle: now - Math.max(...a.history.map((h) => Date.parse(h.at))) })).filter((x) => x.idle >= STALLED_DAYS * 86400000)
    .sort((x, y) => y.a.globalWeight * (1 - y.a.progress) - x.a.globalWeight * (1 - x.a.progress)).slice(0, 3)
  for (const { a, idle } of stalled) items.push({ id: `stalled:${a.id}`, tone: 'amber', title: `${a.wbs} ${a.name} has not moved for ${Math.floor(idle / WEEK_MS)} weeks`, detail: `${a.handler || 'Unassigned'} · ${percent(a.progress, 0)} complete`, to: `${base}/activities?wbs=${encodeURIComponent(a.wbs)}` })
  return items.sort((x, y) => Number(y.tone === 'red') - Number(x.tone === 'red'))
}
