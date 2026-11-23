import { effective, effectiveCol, effectiveImages, formatCell, formatCol } from './formulas'
import { remarkKey } from './store'
import { PCT_CELLS, QTY_CELLS } from './types'
import type { CellKey, ColKey, ImageSet, MatItem } from './types'

const CELL_KEYS: ReadonlySet<string> = new Set<string>([...QTY_CELLS, ...PCT_CELLS])
const IMAGE_KEYS: ReadonlySet<string> = new Set<string>(['image', 'sample'])
/** Remark column keys in the table (`${team}-now`). */
const REMARK_COLUMNS = [['purchase', 'purchase-now'], ['pm', 'pm-now']] as const

const NONE: ReadonlySet<string> = new Set()

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i])

/**
 * The table columns of one item changed this week: every field whose value now differs from its
 * value at the start of the week (`weekEdits`, the edits as they stood before the week's first
 * edit), plus a remark filed under this week. Comparing values rather than recording keystrokes
 * means a cell typed back to what it was is no longer changed. Without a baseline (a row cached
 * before the server kept one) the start of the week is taken as no edits at all.
 *
 * A workbook re-import bumps `updatedAt` but leaves `changedWeek` alone, so it marks nothing.
 */
function changedColumns(item: MatItem, remarks: Record<string, string>, week: string): ReadonlySet<string> {
  if (item.kind !== 'item') return NONE
  const out = new Set<string>()
  if (item.changedWeek === week) {
    const base: MatItem = { ...item, edits: item.weekEdits ?? {} }
    const keys = new Set([...Object.keys(item.edits), ...Object.keys(base.edits)])
    const now = effective(item)
    const then = keys.size ? effective(base) : now
    for (const key of keys) {
      if (CELL_KEYS.has(key)) {
        if (now[key as CellKey] !== then[key as CellKey]) out.add(key)
      } else if (IMAGE_KEYS.has(key)) {
        if (!sameList(effectiveImages(item, key as ImageSet), effectiveImages(base, key as ImageSet))) out.add(key)
      } else if ((effectiveCol(item, key as ColKey) ?? '') !== (effectiveCol(base, key as ColKey) ?? '')) {
        out.add(key)
      }
    }
  }
  for (const [team, column] of REMARK_COLUMNS) {
    if (remarks[remarkKey(item.id, team, week)]?.trim()) out.add(column)
  }
  return out.size ? out : NONE
}

/** Changed columns by item id, for the items with at least one change this week. */
export function changedCells(items: MatItem[], remarks: Record<string, string>, week: string): ReadonlyMap<string, ReadonlySet<string>> {
  const byItem = new Map<string, ReadonlySet<string>>()
  for (const item of items) {
    const cols = changedColumns(item, remarks, week)
    if (cols.size) byItem.set(item.id, cols)
  }
  return byItem
}

/** Formatted value a changed cell held at the start of the week (`weekEdits`), for the indicator tooltip. */
export function previousCellValue(item: MatItem, colKey: string): string {
  if (colKey === 'purchase-now' || colKey === 'pm-now') return 'Empty'
  const base: MatItem = { ...item, edits: item.weekEdits ?? {} }
  if (CELL_KEYS.has(colKey)) {
    return formatCell(colKey as CellKey, effective(base)[colKey as CellKey]) || 'Empty'
  }
  if (IMAGE_KEYS.has(colKey)) {
    const count = effectiveImages(base, colKey as ImageSet).length
    return count === 1 ? '1 photo' : `${count} photos`
  }
  return formatCol(effectiveCol(base, colKey as ColKey)) || 'Empty'
}
