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

/** The prototype's handler palette (Apple system colors); unknown names hash onto the same palette. */
const HANDLER_COLORS: Readonly<Record<string, string>> = {
  Sitha: '#5e5ce6', Lychhinh: '#ff9f0a', Chhorvaon: '#30b0c7', Srun: '#ff375f', Kheng: '#0a84ff', Vuth: '#bf5af2', Tola: '#32a852',
}
const FALLBACK_COLORS = ['#5e5ce6', '#30b0c7', '#ff375f', '#0a84ff', '#bf5af2', '#32a852', '#ff9f0a'] as const

/** One color per handler, so the same person reads the same on every screen. A shared task ("Kheng, Sitha") takes the first name's color. */
export function handlerColor(name: string) {
  const first = name.split(',')[0]!.trim()
  const known = HANDLER_COLORS[first]
  if (known) return known
  let hash = 0
  for (const ch of first) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length]!
}
