import { remarkKey } from './store'
import type { MatItem } from './types'

/**
 * Items changed this week: an edit made in the tracker during this reporting week (the server
 * stamps `changed_week`), or a purchase/PM remark filed under this week. A workbook re-import
 * bumps `updatedAt` for sync but deliberately leaves `changedWeek` alone, so a fresh seed does
 * not outline every row.
 */
export function changedItemIds(items: MatItem[], remarks: Record<string, string>, week: string): ReadonlySet<string> {
  const ids = new Set<string>()
  for (const item of items) {
    if (item.kind !== 'item') continue
    if (item.changedWeek === week) {
      ids.add(item.id)
      continue
    }
    if (remarks[remarkKey(item.id, 'purchase', week)] || remarks[remarkKey(item.id, 'pm', week)]) ids.add(item.id)
  }
  return ids
}
