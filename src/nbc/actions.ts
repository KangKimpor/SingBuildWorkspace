import { useWorkspace } from '@/data'
import { useAccount, reassignNbcActivities } from '@/data/sync'
import { handlers } from './types'
import type { Handler, NbcActivity } from './types'
export { saveDraft, confirmUpdate, undoConfirm, reopenUpdate, deleteUpdate } from './submission-actions'

export function assignActivities(ids: string[], handler: string) {
  const state = useWorkspace.getState(), activities = state.nbc_activities ?? [], selected = new Set(ids)
  if (!handlers.includes(handler as Handler) || ids.some((id) => !activities.some((a) => a.id === id && a.editable))) throw new Error('Choose editable activities and a valid handler.')
  const at = new Date().toISOString()
  const updated = activities.map((a) => selected.has(a.id) && a.handler !== handler ? {
    ...a, handler, updatedAt: at, history: [...a.history, { id: crypto.randomUUID(), at, editor: state.scope, previous: a.progress, progress: a.progress, remark: a.remark, handler }],
  } : a)
  if (state.scope !== 'guest') {
    if (!useAccount.getState().session) throw new Error('Wait for cloud sync before reassigning activities.')
    if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('Connect to the internet before reassigning activities.')
    const changed = updated.filter((a, index) => a !== activities[index])
    if (!changed.length) return
    const expected = changed.map((a) => [a.id, activities.find((previous) => previous.id === a.id)!.updatedAt] as const)
    if (expected.some(([, version]) => !version)) throw new Error('Reload activities before reassigning them.')
    return reassignNbcActivities(changed[0]!.projectId, changed.map((a) => a.id), handler, Object.fromEntries(expected) as Record<string, string>)
  }
  state.commitNbc({ nbc_activities: updated })
}

export function updateActivity(id: string, patch: Pick<Partial<NbcActivity>, 'progress' | 'handler' | 'remark'>) {
  const state = useWorkspace.getState(), activities = state.nbc_activities ?? []
  const activity = activities.find((a) => a.id === id)
  if (!activity?.editable) throw new Error('Only leaf activities and GR&P can be edited.')
  if (patch.progress !== undefined || patch.remark !== undefined) throw new Error('Use a handler draft and Confirm update.')
  if (patch.handler !== undefined && !handlers.includes(patch.handler as Handler) && !(activity.wbs === 'GR&P' && patch.handler === '')) throw new Error('Choose one of the six handlers.')
  if (Object.entries(patch).every(([key, value]) => activity[key as keyof NbcActivity] === value)) return
  if (state.scope !== 'guest') {
    if (!useAccount.getState().session) throw new Error('Wait for cloud sync before reassigning activities.')
    if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('Connect to the internet before reassigning activities.')
    if (!activity.updatedAt) throw new Error('Reload activities before reassigning them.')
    return reassignNbcActivities(activity.projectId, [activity.id], patch.handler!, { [activity.id]: activity.updatedAt })
  }
  const at = new Date().toISOString(), next = { ...activity, ...patch, updatedAt: at }
  next.history = [...activity.history, { id: crypto.randomUUID(), at, editor: state.scope, previous: activity.progress, progress: next.progress, remark: next.remark, handler: next.handler }]
  state.commitNbc({ nbc_activities: activities.map((a) => a.id === id ? next : a) })
}
