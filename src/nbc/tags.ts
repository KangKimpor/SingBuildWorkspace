import type { NbcActivity } from './types'

export type TagField = 'area' | 'location' | 'trade'
export type Tags = Record<TagField, string>

/**
 * Floor, work area and trade of every activity, taken from the nearest row that sets them.
 * BP02 room cells leave these blank and their floor sheet and trade group carry them, so reading
 * a leaf's own fields alone put every room under "Unassigned".
 */
export function activityTags(activities: readonly NbcActivity[]): Map<string, Tags> {
  const byId = new Map(activities.map((a) => [a.id, a]))
  const tags = new Map<string, Tags>()
  const resolve = (a: NbcActivity): Tags => {
    const known = tags.get(a.id)
    if (known) return known
    const parent = a.parentId ? byId.get(a.parentId) : undefined
    const up = parent ? resolve(parent) : { area: '', location: '', trade: '' }
    const own = { area: a.area || up.area, location: a.location || up.location, trade: a.trade || up.trade }
    tags.set(a.id, own)
    return own
  }
  for (const a of activities) resolve(a)
  return tags
}
