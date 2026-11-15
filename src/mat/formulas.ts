import { PCT_CELLS, QTY_CELLS, type CellKey, type FormulaKey, type MatItem, type Scalar } from './types'

const CELLS: readonly CellKey[] = [...QTY_CELLS, ...PCT_CELLS]
const PERCENT = new Set<CellKey>(PCT_CELLS)
const MAX_INPUT = 60
// Plain (12, 12.5, .5) or with thousands commas (1,200 or 1,200.5).
const NUMBER = /^[-+]?(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d*)?|\.\d+)$/

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
  totalMinusOnsite: difference('total', 'onsite'),
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

/** Every cell's value: the typed edit, else the source value or its formula over the other effective values. */
export function effective(item: MatItem): Record<CellKey, Scalar> {
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
  return Object.fromEntries(CELLS.map(cell => [cell, get(cell)])) as Record<CellKey, Scalar>
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

/** Mean of the numeric effective values, as Excel's SUBTOTAL(1, …); null when there are none. */
export function average(items: MatItem[], cell: CellKey): number | null {
  const numbers = items
    .map(item => effective(item)[cell])
    .filter((value): value is number => typeof value === 'number')
  return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : null
}

export function formatCell(cell: CellKey, value: Scalar): string {
  if (value === null) return ''
  if (typeof value === 'string') return value
  return PERCENT.has(cell)
    ? `${Math.round(value * 100)}%`
    : value.toLocaleString('en-US', { maximumFractionDigits: 2 })
}
