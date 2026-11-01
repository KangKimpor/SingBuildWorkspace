import { useWorkspace } from '@/data'
import { pendingCollectionIds, refreshCollections, syncWorkspace } from '@/data/sync'
import { supabase } from '@/lib/supabase'
import { appliedEntries, assertEditableWeek, canUpdate, sameDraftIntent, submissionId, transitionSubmission, validateEntries } from './submissions'
import type { SubmissionOperation } from './submissions'
import type { Handler, NbcSubmission, SubmissionEntry } from './types'

function context(week: string, handler: Handler, projectId: string) {
  assertEditableWeek(week)
  const state = useWorkspace.getState(), project = state.projects.find((p) => p.id === projectId && p.nbcBp03)
  if (!project) throw new Error('This NBC project is not initialized.')
  const id = submissionId(project.id, week, handler)
  return { state, project, id, submission: state.nbc_submissions?.find((s) => s.id === id) }
}
export function draftEntries(week: string, handler: Handler, projectId = 'nbc-bp03'): SubmissionEntry[] {
  const { state, project, submission } = context(week, handler, projectId)
  const existing = new Map(submission?.entries.map((e) => [e.activityId, e]))
  return (state.nbc_activities ?? []).filter((a) => a.projectId === project.id && canUpdate(a, handler)).map((a) => {
    if (existing.has(a.id)) return existing.get(a.id)!
    let previous = a.progress, remark = a.remark
    for (const s of [...(state.nbc_submissions ?? [])].filter((s) => s.projectId === project.id && s.weekStart > week).sort((a, b) => b.weekStart.localeCompare(a.weekStart) || (b.confirmedAt ?? '').localeCompare(a.confirmedAt ?? ''))) {
      const e = appliedEntries(s).find((e) => e.activityId === a.id)
      if (e) { previous = e.previous; remark = e.previousRemark ?? '' }
    }
    return { activityId: a.id, previous, progress: previous, remark, baseRevision: a.updatedAt }
  })
}
/** Synchronous store commit journals autosaves through the existing cloud/offline queue. */
function buildDraft(week: string, handler: Handler, entries: SubmissionEntry[], note: string, projectId: string) {
  const { state, project, id, submission } = context(week, handler, projectId)
  if (submission?.status === 'confirmed') throw new Error('Choose Edit before changing a confirmed update.')
  if (note.length > 4000) throw new Error('Keep the note under 4,000 characters.')
  const activities = (state.nbc_activities ?? []).filter((a) => a.projectId === project.id)
  validateEntries(entries, activities, handler)
  // Untouched shared GR&P never competes with another handler's update.
  const savedEntries = entries.filter((e) => activities.find((a) => a.id === e.activityId)?.wbs !== 'GR&P' || e.progress !== e.previous || e.remark !== activities.find((a) => a.id === e.activityId)?.remark || submission?.appliedEntries?.some((p) => p.activityId === e.activityId))
  const draft: NbcSubmission = { id, projectId: project.id, weekStart: week, handler, status: 'draft', confirmedAt: null, confirmedBy: null, late: false, note, entries: savedEntries, ...submission, updatedAt: new Date().toISOString() }
  draft.entries = savedEntries; draft.note = note
  return draft
}
export function saveDraft(week: string, handler: Handler, entries: SubmissionEntry[], note = '', projectId = 'nbc-bp03') {
  saveDraftBatch(week, [{ handler, entries, note }], projectId)
}
/** Validate every handler before one local/offline-queue commit. */
export function saveDraftBatch(week: string, updates: { handler: Handler; entries: SubmissionEntry[]; note: string }[], projectId: string) {
  if (new Set(updates.map(u => u.handler)).size !== updates.length) throw new Error('Duplicate handler draft.')
  const drafts = updates.map(u => buildDraft(week, u.handler, u.entries, u.note, projectId))
  const ids = new Set(drafts.map(d => d.id)), state = useWorkspace.getState()
  state.commitNbc({ nbc_submissions: [...(state.nbc_submissions ?? []).filter(s => !ids.has(s.id)), ...drafts] })
  if (useWorkspace.getState().storageError && useWorkspace.getState().scope === 'guest') {
    throw new Error('Could not autosave on this device. Keep this page open.')
  }
}

// A confirmation writes one submission, its activities and two summaries. Re-reading the whole
// workspace for that was the slowest part of Confirm, Edit and Delete.
const NBC_COLLECTIONS = ['nbc_activities', 'nbc_submissions', 'nbc_summaries'] as const
const write = (submission: NbcSubmission, week: string, handler: Handler, operation: SubmissionOperation) => supabase!.rpc('kw_nbc_submission_write', { operation, payload: { projectId: submission.projectId, weekStart: week, handler }, expected: submission.updatedAt })

async function operate(week: string, handler: Handler, operation: SubmissionOperation, projectId: string) {
  let { state, id, submission } = context(week, handler, projectId)
  if (!submission) throw new Error('Update not found.')
  if (state.scope === 'guest') {
    const result = transitionSubmission({ activities: state.nbc_activities ?? [], submissions: state.nbc_submissions ?? [], summaries: state.nbc_summaries ?? [] }, id, operation, state.scope)
    state.commitNbc({ nbc_activities: result.activities, nbc_submissions: result.submissions, nbc_summaries: result.summaries })
  } else {
    const scope = state.scope
    // Push the pending draft only. The server write below is the operation itself, so a full
    // workspace pull here was pure latency.
    await syncWorkspace(false)
    if (pendingCollectionIds('nbc_submissions').has(id) || pendingCollectionIds('nbc_activities').size || !navigator.onLine || !supabase) throw new Error('Your draft is kept. Connect and wait for autosave before confirming.')
    if (useWorkspace.getState().scope !== scope) throw new Error('Account changed. Reopen this update.')
    ;({ state, submission } = context(week, handler, projectId))
    if (!submission) throw new Error('This update changed. Reload before continuing.')
    let result = await write(submission, week, handler, operation)
    if (result.error && operation === 'confirm' && result.error.message.includes('Assignments changed')) {
      // The assignment set moved after this draft was saved. Pull the new rows, re-save the
      // draft (late assignments join as unchanged) and confirm once more instead of dead-ending.
      await syncWorkspace()
      ;({ submission } = context(week, handler, projectId))
      if (!submission) throw new Error('This update changed. Reload before continuing.')
      saveDraft(week, handler, draftEntries(week, handler, projectId), submission.note, projectId)
      await syncWorkspace(false)
      ;({ submission } = context(week, handler, projectId))
      if (!submission) throw new Error('This update changed. Reload before continuing.')
      result = await write(submission, week, handler, operation)
    }
    if (!result.error && result.data?.conflict) {
      // Another handler confirming re-chains every draft in the two-week window, which bumps this
      // row's version without changing a value this handler wrote, and NBC rows are not live-
      // subscribed. When the stored draft still holds the same progress and remarks, confirm the
      // row the server reported instead of dead-ending on a version the user cannot see.
      const row = result.data.row as { data: NbcSubmission; updated_at: string } | null
      if (row && Array.isArray(row.data?.entries) && sameDraftIntent(submission, row.data)) result = await write({ ...submission, updatedAt: row.updated_at }, week, handler, operation)
    }
    const { data, error } = result
    if (error) { await syncWorkspace(); throw new Error(error.message) }
    await refreshCollections([...NBC_COLLECTIONS])
    if (useWorkspace.getState().scope !== scope) throw new Error('Account changed.')
    if (data.conflict) throw new Error('This update changed in another session. Review it and try again.')
  }
  return { weekStart: week, handler, undo: () => undoConfirm(week, handler, projectId) }
}
export const confirmUpdate = (week: string, handler: Handler, projectId = 'nbc-bp03') => operate(week, handler, 'confirm', projectId)
export const reopenUpdate = (week: string, handler: Handler, projectId = 'nbc-bp03') => operate(week, handler, 'reopen', projectId)
export const deleteUpdate = (week: string, handler: Handler, projectId = 'nbc-bp03') => operate(week, handler, 'delete', projectId)
export const undoConfirm = (week: string, handler: Handler, projectId = 'nbc-bp03') => operate(week, handler, 'undo', projectId)
