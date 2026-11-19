import { PCT_CELLS, QTY_CELLS, type CellKey, type ColKey, type EditableColKey, type FormulaKey, type ImageSet, type MatData, type MatEdits, type MatItem, type Scalar } from './types'

const CELLS: readonly CellKey[] = [...QTY_CELLS, ...PCT_CELLS]
const PERCENT = new Set<CellKey>(PCT_CELLS)
const MAX_INPUT = 60
export const MAX_SHORT_TEXT = 200
export const MAX_LONG_TEXT = 2000
// Plain (12, 12.5, .5) or with thousands commas (1,200 or 1,200.5).
const NUMBER = /^[-+]?(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d*)?|\.\d+)$/
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const DISPLAY_DATE = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/
const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

type Get = (cell: CellKey) => Scalar

/** Excel N(): numbers pass, everything else is 0. */
export function n(value: Scalar | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

const isText = (value: Scalar) => typeof value === 'string' && value !== ''

const difference = (left: CellKey, right: CellKey) => (get: Get): number | null =>
  isText(get(left)) || isText(get(right)) ? null : n(get(left)) - n(get(right))

const FORMULAS: Record<FormulaKey, (get: Get) => number | null> = {
  placedPoOverTotal: get => {
    const total = n(get('total')), po = n(get('po'))
    return total === 0 ? null : po === 0 ? 0 : Math.min(1, po / total)
  },
  shdOverPo: get => {
    const po = n(get('po')), shd = n(get('shd'))
    return po === 0 ? null : shd === 0 ? 0 : Math.min(1, shd / po)
  },
  notYetPo: get => {
    const placed = get('placed')
    return n(get('total')) === 0 || typeof placed !== 'number' ? null : 1 - placed
  },
  waiting: get =>
    n(get('total')) === 0 ? null : Math.max(0, n(get('production')) - n(get('shipping')) - n(get('arrived'))),
  arrived: get => {
    const total = n(get('total'))
    return total === 0 ? null : Math.min(1, n(get('onsite')) / total)
  },
  // Excel's =Y-N(AB): blank only when Total is text; text in On site counts as 0.
  totalMinusOnsite: get => (isText(get('total')) ? null : n(get('total')) - n(get('onsite'))),
  shdMinusOnsite: difference('shd', 'onsite'),
  totalMinusShd: difference('total', 'shd'),
}

function resolve(item: MatItem, cell: CellKey, get: Get): Scalar {
  const edit = item.edits[cell]
  if (edit !== undefined) return edit
  const source = item.data.cells[cell]
  if (!source) return null
  if ('v' in source) return source.v ?? null
  const result = FORMULAS[source.f](get)
  return result !== null && Number.isFinite(result) ? result : null
}

const effectiveCache = new WeakMap<MatData, WeakMap<MatEdits, Record<CellKey, Scalar>>>()

/** Every cell's value: the typed edit, else the source value or its formula over the other effective values. */
export function effective(item: MatItem): Record<CellKey, Scalar> {
  let byEdits = effectiveCache.get(item.data)
  if (byEdits) {
    const cached = byEdits.get(item.edits)
    if (cached) return cached
  } else {
    byEdits = new WeakMap()
    effectiveCache.set(item.data, byEdits)
  }
  const values = new Map<CellKey, Scalar>()
  const resolving = new Set<CellKey>()
  const get = (cell: CellKey): Scalar => {
    if (values.has(cell)) return values.get(cell) ?? null
    if (resolving.has(cell)) return null // a formula that depends on itself
    resolving.add(cell)
    const value = resolve(item, cell, get)
    resolving.delete(cell)
    values.set(cell, value)
    return value
  }
  const out = Object.fromEntries(CELLS.map(cell => [cell, get(cell)])) as Record<CellKey, Scalar>
  byEdits.set(item.edits, out)
  return out
}

export function isOverride(item: MatItem, cell: CellKey): boolean {
  return item.edits[cell] !== undefined
}

/** What a typed cell saves as; null clears the override. Percent cells take whole percents (50 or 50% is 0.5). */
export function parseInput(cell: CellKey, text: string): number | string | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  if (trimmed.length > MAX_INPUT) throw new Error(`Use at most ${MAX_INPUT} characters.`)
  const percent = PERCENT.has(cell)
  const digits = percent && trimmed.endsWith('%') ? trimmed.slice(0, -1) : trimmed
  if (!NUMBER.test(digits)) return trimmed
  const value = Number(digits.replace(/,/g, ''))
  return percent ? value / 100 : value
}

/**
 * The material rows a section covers: items of the same package and sheet with pos in (section pos, section end].
 * Without `data.end`, the section runs up to the row before the next section of that sheet (or to the end).
 */
export function sectionItems(items: MatItem[], section: MatItem): MatItem[] {
  const sameSheet = items.filter(item => item.package === section.package && item.sheet === section.sheet)
  const next = sameSheet
    .filter(item => item.kind === 'section' && item.pos > section.pos)
    .reduce((first, item) => Math.min(first, item.pos), Infinity)
  const end = section.data.end ?? next - 1
  return sameSheet.filter(item => item.kind === 'item' && item.pos > section.pos && item.pos <= end)
}

/** Mean of the numeric effective values, as Excel's SUBTOTAL(1, …); null when there are none. */
export function average(items: MatItem[], cell: CellKey): number | null {
  const numbers = items
    .map(item => effective(item)[cell])
    .filter((value): value is number => typeof value === 'number')
  return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : null
}

function upperBound(arr: number[], target: number): number {
  let lo = 0, hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (arr[mid]! <= target) lo = mid + 1
    else hi = mid
  }
  return lo
}

function sortedByPos(list: MatItem[]): MatItem[] {
  for (let i = 1; i < list.length; i++) {
    if (list[i]!.pos < list[i - 1]!.pos) return [...list].sort((a, b) => a.pos - b.pos)
  }
  return list
}

/** Single-pass sheet & section percentage averages for one sheet's rows via prefix sums + binary search. */
export function computeSheetAverages(rows: MatItem[]): { sheet: Record<string, number | null>; byId: Map<string, Record<string, number | null>> } {
  const items = sortedByPos(rows.filter((r) => r.kind === 'item'))
  const sections = sortedByPos(rows.filter((r) => r.kind === 'section'))
  const nItems = items.length
  const posArr: number[] = []
  const sums = PCT_CELLS.map(() => new Float64Array(nItems + 1))
  const counts = PCT_CELLS.map(() => new Int32Array(nItems + 1))

  for (let i = 0; i < nItems; i++) {
    const item = items[i]!
    posArr.push(item.pos)
    const vals = effective(item)
    for (let k = 0; k < PCT_CELLS.length; k++) {
      const v = vals[PCT_CELLS[k]!]
      const numeric = typeof v === 'number'
      sums[k]![i + 1] = sums[k]![i]! + (numeric ? v : 0)
      counts[k]![i + 1] = counts[k]![i]! + (numeric ? 1 : 0)
    }
  }

  const sheet: Record<string, number | null> = {}
  for (let k = 0; k < PCT_CELLS.length; k++) {
    const cnt = counts[k]![nItems]!
    sheet[PCT_CELLS[k]!] = cnt > 0 ? sums[k]![nItems]! / cnt : null
  }

  const byId = new Map<string, Record<string, number | null>>()
  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i]!
    let end = sec.data.end
    if (end === undefined) {
      let nextPos = Infinity
      for (let j = i + 1; j < sections.length; j++) {
        if (sections[j]!.pos > sec.pos) { nextPos = sections[j]!.pos; break }
      }
      end = nextPos - 1
    }
    const firstIdx = upperBound(posArr, sec.pos)
    const afterIdx = end === Infinity ? nItems : upperBound(posArr, end)
    const avg: Record<string, number | null> = {}
    for (let k = 0; k < PCT_CELLS.length; k++) {
      const cnt = afterIdx > firstIdx ? counts[k]![afterIdx]! - counts[k]![firstIdx]! : 0
      avg[PCT_CELLS[k]!] = cnt > 0 ? (sums[k]![afterIdx]! - sums[k]![firstIdx]!) / cnt : null
    }
    byId.set(sec.id, avg)
  }

  return { sheet, byId }
}

export function formatCell(cell: CellKey, value: Scalar): string {
  if (value === null) return ''
  if (typeof value === 'string') return value
  return PERCENT.has(cell)
    ? `${Math.round(value * 100)}%`
    : value.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

/** Effective value of a column: typed edit (empty string clears imported value to null), else source `data.cols`. */
export function effectiveCol(item: MatItem, col: ColKey): Scalar {
  if (col !== 'lastUpdated') {
    const edit = item.edits[col]
    if (edit !== undefined) return edit === '' ? null : edit
  }
  return item.data.cols[col] ?? null
}

/** ISO dates as "7 Oct 2025"; free text ("TBC", "-/-") as typed. */
export function formatCol(value: Scalar | undefined): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return date ? `${Number(date[3])} ${MONTHS[Number(date[2]) - 1]} ${date[1]}` : value
}

/** The words a material is known by in labels: its code, else its number. */
export const codeOf = (item: MatItem) => formatCol(effectiveCol(item, 'code')) || formatCol(effectiveCol(item, 'no')) || `Row ${item.pos}`

/** Effective image refs for one picture column: edited list if present, else imported `data.images`. */
export function effectiveImages(item: MatItem, set: ImageSet): string[] {
  return item.edits[set] ?? item.data.images?.[set] ?? []
}

function validCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  const dt = new Date(Date.UTC(year, month - 1, day))
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day
}

/** True when `value` is a real calendar date formatted as YYYY-MM-DD. */
export function isIsoDate(value: Scalar | undefined): value is string {
  if (typeof value !== 'string') return false
  const match = ISO_DATE.exec(value)
  if (!match) return false
  return validCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]))
}

/** Parse a date/text column input: normalizes "YYYY-MM-DD" and "7 Oct 2025" to ISO, or keeps free text verbatim. */
export function parseDateTextInput(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  if (trimmed.length > MAX_SHORT_TEXT) throw new Error(`Use at most ${MAX_SHORT_TEXT} characters.`)
  if (isIsoDate(trimmed)) return trimmed
  const display = DISPLAY_DATE.exec(trimmed)
  if (display) {
    const day = Number(display[1])
    const month = MONTH_NAMES.indexOf(display[2]!.toLowerCase()) + 1
    const year = Number(display[3])
    if (month > 0 && validCalendarDate(year, month, day)) {
      return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }
  return trimmed
}

/** Parse a text column input, enforcing its server-side character cap. */
export function parseTextInput(text: string, maxLength = MAX_SHORT_TEXT): string {
  const trimmed = text.trim()
  if (trimmed.length > maxLength) throw new Error(`Use at most ${maxLength} characters.`)
  return trimmed
}

/** Patch value for a text/date/status column relative to a raw source value. */
export function patchForSource(sourceRaw: Scalar | undefined, next: string): string | null {
  const source = sourceRaw === null || sourceRaw === undefined ? '' : String(sourceRaw)
  return next === source ? null : next
}

/** Patch value for a text/date/status column: null clears the override when matching `data.cols`, otherwise stores `next` (including ""). */
export function colPatchValue(item: MatItem, col: EditableColKey, next: string): string | null {
  return patchForSource(item.data.cols[col], next)
}

/** Patch value for an image list: null clears the override when matching `data.images`, otherwise stores `next` (including []). */
export function imagesPatchValue(item: MatItem, set: ImageSet, next: string[]): string[] | null {
  const source = item.data.images?.[set] ?? []
  const same = source.length === next.length && source.every((v, i) => v === next[i])
  return same ? null : next
}
