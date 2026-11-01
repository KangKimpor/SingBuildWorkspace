import { useWorkspace } from '@/data'
import { acknowledgeSavedRow, flushPending, pendingCollectionIds, refreshCollections, syncWorkspace } from '@/data/sync'
import { supabase } from '@/lib/supabase'
import { appliedEntries, assertEditableWeek, canUpdate, sameDraftIntent, submissionId, transitionSubmission, validateEntries } from './submissions'
import type { SubmissionOperation } from './submissions'
import type { Handler, NbcActivity, NbcSubmission, SubmissionEntry } from './types'

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
  const newer = [...(state.nbc_submissions ?? [])]
    .filter((s) => s.projectId === project.id && s.weekStart > week)
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart) || (b.confirmedAt ?? '').localeCompare(a.confirmedAt ?? ''))
  const newerApplied = newer.map((s) => new Map(appliedEntries(s).map((e) => [e.activityId, e])))
  return (state.nbc_activities ?? []).filter((a) => a.projectId === project.id && canUpdate(a, handler)).map((a) => {
    if (existing.has(a.id)) {
      const saved = existing.get(a.id)!
      if (a.wbs !== 'GR&P' && a.updatedAt && (!saved.baseRevision || (a.baselineResetAt && Date.parse(saved.baseRevision) < Date.parse(a.baselineResetAt)))) {
        return { ...saved, baseRevision: a.updatedAt }
      }
      return saved
    }
    let previous = a.progress, remark = a.remark
    for (const entriesById of newerApplied) {
      const e = entriesById.get(a.id)
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
  const byId = new Map(activities.map((a) => [a.id, a]))
  const appliedIds = new Set(submission?.appliedEntries?.map((p) => p.activityId))
  // Untouched shared GR&P never competes with another handler's update.
  const savedEntries = entries.filter((e) => {
    const a = byId.get(e.activityId)
    return a?.wbs !== 'GR&P' || e.progress !== e.previous || e.remark !== a?.remark || appliedIds.has(e.activityId)
  })
  const draft: NbcSubmission = { id, projectId: project.id, weekStart: week, handler, status: 'draft', confirmedAt: null, confirmedBy: null, late: false, note, entries: savedEntries, ...submission, updatedAt: new Date().toISOString() }
  draft.entries = savedEntries; draft.note = note
  if (submission && submission.status === 'draft' && submission.entries.length === savedEntries.length && sameDraftIntent(submission, draft)) {
    draft.updatedAt = submission.updatedAt
  }
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

function compactDraft(draft: NbcSubmission, activities: NbcActivity[]): NbcSubmission {
  const byId = new Map(activities.map((a) => [a.id, a]))
  const appliedIds = new Set(draft.appliedEntries?.map((e) => e.activityId))
  const normalized = draft.entries.map((e) => {
    const a = byId.get(e.activityId)
    if (a && a.wbs !== 'GR&P' && a.updatedAt && (!e.baseRevision || (a.baselineResetAt && Date.parse(e.baseRevision) < Date.parse(a.baselineResetAt)))) {
      return { ...e, baseRevision: a.updatedAt }
    }
    return e
  })
  if (normalized.length <= 500) return { ...draft, entries: normalized }
  const changedOnly = normalized.filter((e) => Math.abs(e.progress - e.previous) > 1e-12 || (e.remark && e.remark.trim().length > 0) || appliedIds.has(e.activityId))
  return changedOnly.length <= 1000 ? { ...draft, entries: changedOnly } : { ...draft, entries: normalized }
}

async function ensureDraftOnServer(draft: NbcSubmission, scope: string): Promise<NbcSubmission> {
  if (!supabase) throw new Error('Your draft is kept. Connect and wait for autosave before confirming.')
  const activities = (useWorkspace.getState().nbc_activities ?? []).filter((a) => a.projectId === draft.projectId)
  const payload = compactDraft(draft, activities)
  const send = (body: NbcSubmission, expected: string | null) =>
    supabase!.rpc('kw_workspace_write', { collection: 'nbc_submissions', record_id: draft.id, payload: body as unknown as Record<string, unknown>, expected })

  let res = await send(payload, draft.updatedAt || null)
  if (res.error && payload.entries.length === draft.entries.length && draft.entries.length > 0 && (res.error.message?.includes('Invalid draft') || res.error.code === '57014')) {
    const appliedIds = new Set(draft.appliedEntries?.map((e) => e.activityId))
    const fallback: NbcSubmission = { ...payload, entries: payload.entries.filter((e) => Math.abs(e.progress - e.previous) > 1e-12 || (e.remark && e.remark.trim().length > 0) || appliedIds.has(e.activityId)) }
    res = await send(fallback, draft.updatedAt || null)
  }
  if (!res.error && res.data?.conflict) {
    const remoteRow = res.data.row as { id: string; data: NbcSubmission; updated_at: string } | null
    if (remoteRow?.data?.status === 'confirmed') {
      acknowledgeSavedRow(scope, 'nbc_submissions', draft.id, remoteRow as unknown as { id: string; data: Record<string, unknown>; updated_at: string })
      return { ...remoteRow.data, updatedAt: remoteRow.updated_at }
    }
    res = await send(payload, remoteRow?.updated_at ?? null)
  }
  if (res.error) throw new Error(res.error.message || 'Your draft is kept. Connect and wait for autosave before confirming.')
  const savedRow = res.data?.row as { id: string; data: NbcSubmission; updated_at: string } | null
  if (!savedRow) throw new Error('Your draft is kept. Connect and wait for autosave before confirming.')
  const merged: NbcSubmission = { ...draft, ...savedRow.data, entries: draft.entries, note: draft.note, updatedAt: savedRow.updated_at }
  acknowledgeSavedRow(scope, 'nbc_submissions', draft.id, { id: draft.id, data: merged as unknown as Record<string, unknown>, updatedAt: savedRow.updated_at } as unknown as { id: string; data: Record<string, unknown>; updated_at: string })
  return merged
}

async function operate(week: string, handler: Handler, operation: SubmissionOperation, projectId: string) {
  let { state, id, submission } = context(week, handler, projectId)
  if (!submission) throw new Error('Update not found.')
  if (state.scope === 'guest') {
    const result = transitionSubmission({ activities: state.nbc_activities ?? [], submissions: state.nbc_submissions ?? [], summaries: state.nbc_summaries ?? [] }, id, operation, state.scope)
    state.commitNbc({ nbc_activities: result.activities, nbc_submissions: result.submissions, nbc_summaries: result.summaries })
  } else {
    const scope = state.scope
    const initialDraft = structuredClone(submission)
    // Push the pending draft only. The server write below is the operation itself, so a full
    // workspace pull here was pure latency.
    const unsaved = () => pendingCollectionIds('nbc_submissions').has(id) || pendingCollectionIds('nbc_activities').size > 0
    if (!supabase) throw new Error('Your draft is kept. Connect and wait for autosave before confirming.')
    const flushed = await flushPending(unsaved)
    if (useWorkspace.getState().scope !== scope) throw new Error('Account changed. Reopen this update.')
    ;({ state, submission } = context(week, handler, projectId))
    if (!flushed || !submission) {
      if (operation === 'confirm') {
        submission = await ensureDraftOnServer(submission ?? initialDraft, scope)
      } else {
        if (!flushed) throw new Error('Your draft is kept. Connect and wait for autosave before confirming.')
        await refreshCollections([...NBC_COLLECTIONS])
        ;({ state, submission } = context(week, handler, projectId))
        if (!submission) throw new Error('This update changed. Reload before continuing.')
      }
    }
    let result = await write(submission, week, handler, operation)
    if (result.error && operation === 'confirm' && result.error.message.includes('Update not found')) {
      submission = await ensureDraftOnServer(submission ?? initialDraft, scope)
      result = await write(submission, week, handler, operation)
    }
    if (result.error && operation === 'confirm' && result.error.message.includes('Assignments changed')) {
      // The assignment set moved after this draft was saved. Pull the new rows, re-save the
      // draft (late assignments join as unchanged) and confirm once more instead of dead-ending.
      await syncWorkspace()
      ;({ submission } = context(week, handler, projectId))
      const baseSubmission = submission ?? initialDraft
      const authored = new Map(initialDraft.entries.map((e) => [e.activityId, e]))
      const mergedEntries = draftEntries(week, handler, projectId).map((e) => {
        const prev = authored.get(e.activityId)
        return prev ? { ...e, progress: prev.progress, remark: prev.remark } : e
      })
      saveDraft(week, handler, mergedEntries, baseSubmission.note, projectId)
      const retryFlushed = await flushPending(unsaved)
      ;({ submission } = context(week, handler, projectId))
      if (!retryFlushed || !submission) {
        submission = await ensureDraftOnServer(submission ?? { ...baseSubmission, entries: mergedEntries }, scope)
      }
      result = await write(submission, week, handler, operation)
    }
    if (!result.error && result.data?.conflict) {
      // Fallback for servers that still compare versions on operations (the writer now only does
      // so for draft saves). Another handler's re-chain bumps this row without changing a value
      // this handler wrote, and NBC rows are not live-subscribed. When the stored draft still
      // holds the same progress and remarks, act on the row the server reported.
      const row = result.data.row as { data: NbcSubmission; updated_at: string } | null
      if (row && Array.isArray(row.data?.entries) && sameDraftIntent(submission, row.data)) {
        result = await write({ ...submission, updatedAt: row.updated_at }, week, handler, operation)
      } else if (!row && operation === 'confirm') {
        submission = await ensureDraftOnServer(submission ?? initialDraft, scope)
        result = await write(submission, week, handler, operation)
      }
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
