import { calculate, percentage } from './progress'
import { projectHandlers } from './types'
import type { Handler, NbcActivity, NbcSubmission, NbcWeekSummary, SubmissionEntry } from './types'

export const REPORTING_TIMEZONE = 'Asia/Phnom_Penh'
// Updates are due Saturday 12:00 in Phnom Penh while the week itself still runs Monday to Sunday.
// Exclusive boundary: exactly noon is already late.
export const WEEK_DEADLINE = 'T12:00:00+07:00'
export const DEADLINE_DAY = 5
export const UNDO_SECONDS = 10
export function reportingDate(now = new Date()) {
  const formatted = now.toLocaleDateString('en-CA', { timeZone: REPORTING_TIMEZONE })
  return /^\d{4}-\d{2}-\d{2}$/.test(formatted) ? formatted : new Date(+now + 7 * 3600000).toISOString().slice(0, 10)
}
export function weekStart(date = reportingDate()) {
  const day = new Date(`${date}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(+day) || day.toISOString().slice(0, 10) !== date) throw new Error('Invalid reporting date.')
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7)
  return day.toISOString().slice(0, 10)
}
export function addDays(date: string, days: number) { return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10) }
export const weekDeadline = (week: string) => Date.parse(`${addDays(week, DEADLINE_DAY)}${WEEK_DEADLINE}`)
export function assertEditableWeek(week: string, now = new Date()) {
  const current = weekStart(reportingDate(now))
  if (weekStart(week) !== week || ![current, addDays(current, -7)].includes(week)) throw new Error('Only this week and last week can be changed.')
}
export const submissionId = (project: string, week: string, handler: Handler) => `${project}:${week}:${handler}`
export const canUpdate = (activity: NbcActivity, handler: Handler) => activity.editable && activity.handler === handler
export const appliedEntries = (s: NbcSubmission) => s.status === 'confirmed' ? s.entries : s.appliedEntries ?? []
export const changedEntries = (entries: SubmissionEntry[]) => entries.filter((e) => Math.abs(e.progress - e.previous) > 1e-12)
/**
 * Whether two copies of a submission hold the same values its handler authored.
 *
 * The server re-chains every draft in the two-week window whenever anyone confirms, which
 * rewrites `previous`/`baseRevision` and bumps `updatedAt` without touching progress or
 * remarks. Large BOQ drafts (BP02) also compact unchanged entries on save, so an omitted
 * entry matches an untouched entry (`progress === previous` and empty remark).
 */
export function sameDraftIntent(a: NbcSubmission, b: NbcSubmission) {
  if (a.status !== b.status || a.note !== b.note) return false
  if (a.entries.length === b.entries.length) {
    const authored = (s: NbcSubmission) => s.entries.map((e) => JSON.stringify([e.activityId, e.progress, e.remark])).sort()
    const left = authored(a), right = authored(b)
    return left.every((entry, index) => entry === right[index])
  }
  const mapA = new Map(a.entries.map((e) => [e.activityId, e]))
  const mapB = new Map(b.entries.map((e) => [e.activityId, e]))
  const ids = new Set([...mapA.keys(), ...mapB.keys()])
  const untouched = (e: SubmissionEntry) => Math.abs(e.progress - e.previous) <= 1e-12 && !e.remark.trim()
  for (const id of ids) {
    const left = mapA.get(id), right = mapB.get(id)
    if (left && right) {
      if (Math.abs(left.progress - right.progress) > 1e-12 || left.remark !== right.remark) return false
    } else if (!untouched((left ?? right)!)) {
      return false
    }
  }
  return true
}
export function weekLabel(week: string) {
  const format = (date: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
  return `${format(week)} – ${format(addDays(week, 6))}`
}
export function submissionStatus(s: NbcSubmission | undefined, week: string, activities: NbcActivity[], now = Date.now()) {
  if (s?.confirmedAt) {
    const byId = new Map(activities.map((a) => [a.id, a]))
    const assigned = new Set(activities.filter((a) => a.editable && a.handler === s.handler).map((a) => a.id))
    const recorded = new Set(appliedEntries(s).filter((e) => byId.has(e.activityId)).map((e) => e.activityId))
    if (assigned.size !== recorded.size || [...assigned].some((id) => !recorded.has(id))) return 'Needs review'
  }
  return s?.status === 'confirmed' ? s.late ? 'Updated late' : 'Updated' : now >= weekDeadline(week) ? 'Overdue' : 'Not yet'
}

export function validateEntries(entries: SubmissionEntry[], activities: NbcActivity[], handler: Handler) {
  if (!projectHandlers(activities[0]?.projectId).includes(handler) || new Set(entries.map((e) => e.activityId)).size !== entries.length) throw new Error('Invalid handler or duplicate activities.')
  const byId = new Map(activities.map((a) => [a.id, a]))
  for (const e of entries) {
    const activity = byId.get(e.activityId)
    if (!activity || !canUpdate(activity, handler)) throw new Error('Update only your own activities.')
    percentage(e.previous); percentage(e.progress)
    if (typeof e.remark !== 'string' || e.remark.length > 4000) throw new Error('Remarks must be 4,000 characters or fewer.')
  }
}

export interface SubmissionState { activities: NbcActivity[]; submissions: NbcSubmission[]; summaries: NbcWeekSummary[] }
export type SubmissionOperation = 'confirm' | 'reopen' | 'delete' | 'undo'
/** Pure counterpart of the atomic database operation, also used by the offline demo. */
export function transitionSubmission(input: SubmissionState, id: string, operation: SubmissionOperation, editor: string, now = new Date()): SubmissionState {
  const state = structuredClone(input), submission = state.submissions.find((s) => s.id === id)
  if (!submission) throw new Error('Update not found.')
  assertEditableWeek(submission.weekStart, now)
  const at = now.toISOString(), project = state.activities.filter((a) => a.projectId === submission.projectId)
  const byId = new Map(project.map((a) => [a.id, a]))
  const order = (a: NbcSubmission, b: NbcSubmission) => a.weekStart.localeCompare(b.weekStart) || (a.confirmedAt ?? '').localeCompare(b.confirmedAt ?? '') || a.id.localeCompare(b.id)
  const before = state.submissions.filter((s) => s.projectId === submission.projectId).sort(order)
  const bases = new Map<string, { progress: number; remark: string }>()
  for (const s of before) for (const e of appliedEntries(s)) if (!bases.has(e.activityId) && s.weekStart >= addDays(weekStart(reportingDate(now)), -7)) bases.set(e.activityId, { progress: e.previous, remark: e.previousRemark ?? '' })
  if (operation === 'confirm') {
    if (submission.status !== 'draft') throw new Error('This update is already confirmed.')
    // Work assigned after this draft was saved joins as unchanged, so a late assignment never dead-ends a confirmation.
    const assigned = project.filter((a) => canUpdate(a, submission.handler))
    const recorded = new Set(submission.entries.map((e) => e.activityId))
    for (const a of assigned) if (!recorded.has(a.id)) submission.entries.push({ activityId: a.id, previous: a.progress, progress: a.progress, remark: a.remark, baseRevision: a.updatedAt })
    validateEntries(submission.entries, project, submission.handler)
    for (const e of submission.entries) {
      const a = byId.get(e.activityId)!
      if (!bases.has(a.id)) bases.set(a.id, { progress: a.progress, remark: a.remark })
    }
    submission.status = 'confirmed'; submission.confirmedAt = at; submission.confirmedBy = editor
    submission.late = +now >= weekDeadline(submission.weekStart); submission.undoUntil = new Date(+now + UNDO_SECONDS * 1000).toISOString()
    delete submission.appliedEntries
  } else if (operation === 'reopen') {
    if (submission.status !== 'confirmed') throw new Error('Only a confirmed update can be edited.')
    submission.appliedEntries = structuredClone(submission.entries); submission.status = 'draft'; submission.undoUntil = null
    submission.entries = submission.entries.filter((e) => { const a = byId.get(e.activityId); return !!a && canUpdate(a, submission.handler) })
    for (const e of submission.entries) e.baseRevision = byId.get(e.activityId)?.updatedAt
  } else {
    if (operation === 'undo' && (submission.status !== 'confirmed' || submission.confirmedBy !== editor || +now > Date.parse(submission.undoUntil ?? ''))) throw new Error('The undo window has expired.')
    if (operation === 'undo') { submission.status = 'draft'; submission.confirmedAt = null; submission.confirmedBy = null; submission.undoUntil = null; delete submission.appliedEntries }
    else state.submissions = state.submissions.filter((s) => s.id !== id)
  }
  submission.updatedAt = at
  const editableStart = addDays(weekStart(reportingDate(now)), -7)
  const chain = state.submissions.filter((s) => s.projectId === submission.projectId && s.weekStart >= editableStart).sort(order)
  const running = new Map(bases)
  for (const s of chain) {
    if (s.status === 'draft') for (const e of s.entries) {
      const base = running.get(e.activityId)
      if (base && e.previous !== base.progress) { e.previous = base.progress; s.updatedAt = at }
    }
    for (const e of appliedEntries(s)) {
      const base = running.get(e.activityId)
      if (!base) continue
      if (e.previous !== base.progress || e.previousRemark !== base.remark) s.updatedAt = at
      e.previous = base.progress; e.previousRemark = base.remark
      running.set(e.activityId, { progress: e.progress, remark: e.remark })
    }
  }
  for (const a of state.activities) {
    const value = a.projectId === submission.projectId ? running.get(a.id) : undefined
    if (value && (a.progress !== value.progress || a.remark !== value.remark)) {
      a.history.push({ id: crypto.randomUUID(), at, editor, previous: a.progress, progress: value.progress, remark: value.remark, handler: a.handler })
      a.progress = value.progress; a.remark = value.remark; a.updatedAt = at
    }
  }
  const updatedById = new Map(state.activities.map((a) => [a.id, a]))
  if (operation === 'undo') for (const e of submission.entries) e.baseRevision = updatedById.get(e.activityId)?.updatedAt
  // Only two small summaries are recalculated; older summaries are never restated.
  for (const week of [editableStart, addDays(editableStart, 7)]) {
    const values = new Map(project.filter((a) => a.editable).map((a) => [a.id, updatedById.get(a.id)!.progress]))
    for (const s of [...chain].reverse()) if (s.weekStart > week) for (const e of [...appliedEntries(s)].reverse()) values.set(e.activityId, e.previous)
    const overall = calculate(project, values).overall, contributions: Record<string, number> = {}
    for (const a of project.filter((a) => a.editable)) contributions[a.handler] = (contributions[a.handler] ?? 0) + a.globalWeight * values.get(a.id)!
    const previousValues = new Map(values)
    for (const s of [...chain].reverse()) if (s.weekStart === week) for (const e of [...appliedEntries(s)].reverse()) previousValues.set(e.activityId, e.previous)
    const summary = { id: `${submission.projectId}:${week}`, projectId: submission.projectId, weekStart: week, overall, previous: calculate(project, previousValues).overall, contributions, updatedAt: at }
    state.summaries = [...state.summaries.filter((s) => s.id !== summary.id), summary]
  }
  return state
}
