import type { Handler, NbcActivity } from './types'

/**
 * A handler is complete once every editable activity assigned to them reaches 100%.
 * Completion is derived from confirmed live progress, so it unlocks again if work is reassigned or corrected.
 */
export function handlerComplete(activities: NbcActivity[], handler: Handler) {
  return completion(activities).get(handler) ?? false
}

// Store arrays are replaced, never mutated, so one pass per array answers every handler. Overview,
// the update gate and the attention list each asked again, and BP02 has about 16,500 activities.
const completed = new WeakMap<readonly NbcActivity[], Map<string, boolean>>()
function completion(activities: NbcActivity[]) {
  let byHandler = completed.get(activities)
  if (!byHandler) {
    byHandler = new Map()
    for (const a of activities) if (a.editable) byHandler.set(a.handler, (byHandler.get(a.handler) ?? true) && a.progress >= 1 - 1e-9)
    completed.set(activities, byHandler)
  }
  return byHandler
}

export function activityHandlers(activity: NbcActivity, activities: NbcActivity[]) {
  if (activity.editable) return activity.handler || 'Unassigned'
  return [...new Set(activities.filter((a) => a.editable && a.wbs.startsWith(`${activity.wbs}.`)).map((a) => a.handler || 'Unassigned'))].join(', ') || 'Unassigned'
}
