import type { Handler, NbcActivity } from './types'

/**
 * A handler is complete once every editable activity assigned to them reaches 100%.
 * Completion is derived from confirmed live progress, so it unlocks again if work is reassigned or corrected.
 */
export function handlerComplete(activities: NbcActivity[], handler: Handler) {
  const own = activities.filter((a) => a.editable && a.handler === handler)
  return own.length > 0 && own.every((a) => a.progress >= 1 - 1e-9)
}

export function activityHandlers(activity: NbcActivity, activities: NbcActivity[]) {
  if (activity.editable) return activity.handler || 'Unassigned'
  return [...new Set(activities.filter((a) => a.editable && a.wbs.startsWith(`${activity.wbs}.`)).map((a) => a.handler || 'Unassigned'))].join(', ') || 'Unassigned'
}
