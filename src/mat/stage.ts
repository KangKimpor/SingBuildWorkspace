import { colPatchValue, effective, effectiveCol, formatCol, isIsoDate, n } from './formulas'
import type { CellKey, EditableColKey, FieldKey, FieldValue, MatItem } from './types'

/**
 * The item-centric view of a material (D-57): one derived stage and one next step per row,
 * computed from the workbook columns rather than stored. Every action writes plain column
 * and cell edits through `setFields`, so the Sheet view and the export see the same values.
 */
export const STAGES = [
  { id: 'notsub', label: 'Not submitted', hint: 'Nothing sent to the consultant' },
  { id: 'review', label: 'Under review', hint: 'Submitted, waiting on the consultant' },
  { id: 'revise', label: 'Revise', hint: 'Consultant asked for a resubmission' },
  { id: 'approved', label: 'Approved', hint: 'Ready to order' },
  { id: 'ordered', label: 'Ordered', hint: 'PO placed, nothing on site' },
  { id: 'partial', label: 'Partly on site', hint: 'Some quantity delivered' },
  { id: 'onsite', label: 'On site', hint: 'Full quantity delivered' },
] as const
export type StageId = (typeof STAGES)[number]['id']
export const STAGE: Record<StageId, (typeof STAGES)[number]> = Object.fromEntries(STAGES.map((s) => [s.id, s])) as never

const DAY = 864e5
const toDay = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))
/** Whole days from `b` to `a` (positive when `a` is later). */
export const days = (a: string, b: string) => Math.round((toDay(a) - toDay(b)) / DAY)
export const addDaysIso = (iso: string, count: number) => new Date(toDay(iso) + count * DAY).toISOString().slice(0, 10)
export const todayIso = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

const date = (item: MatItem, col: EditableColKey) => {
  const v = effectiveCol(item, col)
  return isIsoDate(v) ? v : null
}
const text = (item: MatItem, col: EditableColKey) => formatCol(effectiveCol(item, col)).trim()

export interface Qty { total: number; po: number; shd: number; onsite: number; unit: string }
export function qtyOf(item: MatItem): Qty {
  const e = effective(item)
  return { total: n(e.total), po: n(e.po), shd: n(e.shd), onsite: n(e.onsite), unit: text(item, 'unit') }
}

export function stageOf(item: MatItem): StageId {
  const q = qtyOf(item), status = text(item, 'msStatus')
  if (q.total > 0 ? q.onsite >= q.total : !!date(item, 'arrActual')) return 'onsite'
  if (q.onsite > 0) return 'partial'
  if (date(item, 'poActual') || q.po > 0) return 'ordered'
  if (date(item, 'msApproved') || /^approved/i.test(status)) return 'approved'
  if (/revise|reject/i.test(status)) return 'revise'
  if (date(item, 'msActual') || /under review/i.test(status)) return 'review'
  return 'notsub'
}

export interface NextStep { label: string; date: string | null; diff: number | null; done: boolean }
/** What has to happen next and when it was planned. Approval has no plan column: it is due 14 days after submission. */
export function nextOf(item: MatItem, today: string): NextStep {
  const submitted = date(item, 'msActual')
  const plan: Record<StageId, [string, string | null]> = {
    notsub: ['Submit material', date(item, 'msPlan')],
    review: ['Get approval', submitted && addDaysIso(submitted, 14)],
    revise: ['Resubmit', submitted && addDaysIso(submitted, 10)],
    approved: ['Place order', date(item, 'poPlan')],
    ordered: ['First delivery', date(item, 'arrPlan')],
    partial: ['Balance delivery', date(item, 'arrPlan')],
    onsite: ['Complete', null],
  }
  const stage = stageOf(item)
  const [label, when] = plan[stage]
  return { label, date: when, diff: when ? days(when, today) : null, done: stage === 'onsite' }
}

export const ATTENTION = [
  { id: 'late', label: 'Late', hint: 'Next step is past its plan date', test: (i: MatItem, t: string) => { const x = nextOf(i, t); return x.diff !== null && x.diff < 0 } },
  { id: 'soon', label: 'Due in 14 days', hint: 'Submit, approve, order or deliver', test: (i: MatItem, t: string) => { const x = nextOf(i, t); return x.diff !== null && x.diff >= 0 && x.diff <= 14 } },
  { id: 'consultant', label: 'With consultant', hint: 'Under review or revise', test: (i: MatItem) => ['review', 'revise'].includes(stageOf(i)) },
  { id: 'quiet', label: 'Quiet 2+ weeks', hint: 'Open, nobody has touched it', test: (i: MatItem, t: string) => stageOf(i) !== 'onsite' && days(t, i.updatedAt.slice(0, 10)) > 14 },
] as const
export type AttentionId = (typeof ATTENTION)[number]['id']

type Patch = Partial<Record<FieldKey, FieldValue>>
const col = (item: MatItem, key: EditableColKey, value: string, patch: Patch) => { patch[key] = colPatchValue(item, key, value) }
/** A cell edit relative to its imported value: null when it matches, so the override goes away. */
export function cellPatch(item: MatItem, key: CellKey, value: number): FieldValue {
  const src = item.data.cells[key]
  return src && 'v' in src && src.v === value ? null : value
}

/** Stages a person moves a material to directly; Partly on site comes from logging a delivery (`onsitePatch`). */
export type MoveStage = Exclude<StageId, 'partial'>

/**
 * The column and cell edits that put a material in `stage` on `on`. Earlier real dates are kept and
 * missing ones get `on`; later steps are cleared only where they hold a real date or a positive
 * quantity, so workbook text such as "TBC" or "n/a" and blank cells are never overwritten.
 */
export function stagePatch(item: MatItem, stage: MoveStage, on: string): Patch {
  const patch: Patch = {}, q = qtyOf(item)
  const keep = (key: EditableColKey) => date(item, key) ?? on
  const status = text(item, 'msStatus')
  const clearDate = (key: EditableColKey) => { if (date(item, key)) col(item, key, '', patch) }
  const clearQty = (key: 'po' | 'onsite') => { if (q[key] > 0) patch[key] = cellPatch(item, key, 0) }
  const clearAfter = (from: 'approval' | 'order' | 'delivery') => {
    if (from === 'approval') clearDate('msApproved')
    if (from !== 'delivery') { clearDate('poActual'); clearQty('po') }
    clearDate('arrActual'); clearQty('onsite')
  }
  const ordered = () => {
    col(item, 'poActual', keep('poActual'), patch)
    if (q.po <= 0 && q.total > 0) patch.po = cellPatch(item, 'po', q.total)
  }
  if (stage === 'notsub') { clearDate('msActual'); col(item, 'msStatus', 'Not Yet Submit', patch); clearAfter('approval') }
  if (stage === 'review') { col(item, 'msActual', keep('msActual'), patch); col(item, 'msStatus', 'Under Review', patch); clearAfter('approval') }
  if (stage === 'revise') { col(item, 'msActual', keep('msActual'), patch); col(item, 'msStatus', 'Revise & Resubmit', patch); clearAfter('approval') }
  if (stage === 'approved' || stage === 'ordered' || stage === 'onsite') {
    col(item, 'msActual', keep('msActual'), patch)
    col(item, 'msApproved', keep('msApproved'), patch)
    if (!/^approved/i.test(status)) col(item, 'msStatus', 'Approved', patch)
  }
  if (stage === 'approved') clearAfter('order')
  if (stage === 'ordered') { ordered(); clearAfter('delivery') }
  if (stage === 'onsite') {
    ordered()
    // Raise the quantity to the total only when it is short; an over-delivery stays as counted.
    if (q.total > 0 && q.onsite < q.total) patch.onsite = cellPatch(item, 'onsite', q.total)
    col(item, 'arrActual', keep('arrActual'), patch)
  }
  return patch
}

/** Sets the quantity on site; reaching the total stamps the arrival date and a first delivery stamps the order. More than the total is kept. */
export function onsitePatch(item: MatItem, onsite: number, on: string): Patch {
  const q = qtyOf(item), value = Math.max(0, onsite)
  const patch: Patch = { onsite: cellPatch(item, 'onsite', value) }
  if (value > 0 && !date(item, 'poActual')) { col(item, 'poActual', on, patch); if (q.po <= 0 && q.total > 0) patch.po = cellPatch(item, 'po', q.total) }
  if (q.total > 0 && value >= q.total) col(item, 'arrActual', date(item, 'arrActual') ?? on, patch)
  else if (date(item, 'arrActual')) col(item, 'arrActual', '', patch)
  return patch
}

/** The current edits for the keys a patch touches, so the change can be put back exactly (undefined: no override). */
export function snapshot(item: MatItem, patch: Patch): Patch {
  const before: Patch = {}
  const edits = item.edits as Record<string, FieldValue | undefined>
  for (const key of Object.keys(patch) as FieldKey[]) before[key] = edits[key] ?? null
  return before
}

/** Drops keys whose value would not change the edits, so an action that changes nothing saves nothing. */
export function effectivePatch(item: MatItem, patch: Patch): Patch {
  const edits = item.edits as Record<string, FieldValue | undefined>
  const out: Patch = {}
  for (const [key, value] of Object.entries(patch) as [FieldKey, FieldValue][]) if ((edits[key] ?? null) !== value) out[key] = value
  return out
}

/** Each material's top-level section (the nearest level-0 section row above it), by item id. */
export function sectionsOf(rows: MatItem[]): Map<string, { id: string; code: string; name: string }> {
  const out = new Map<string, { id: string; code: string; name: string }>()
  let current: { id: string; code: string; name: string } | null = null
  for (const row of rows) {
    if (row.kind === 'section' && (row.data.level ?? 0) === 0) current = { id: row.id, code: text(row, 'no'), name: text(row, 'description') }
    else if (row.kind === 'item' && current) out.set(row.id, current)
  }
  return out
}
