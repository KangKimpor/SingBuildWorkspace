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
  { id: 'notreq', label: 'Not required', hint: 'No submission needed, order directly' },
  { id: 'ordered', label: 'Ordered', hint: 'PO placed, production not started' },
  { id: 'production', label: 'Production', hint: 'Being made by the supplier' },
  { id: 'waiting', label: 'Waiting for shipment', hint: 'Made, waiting to be shipped' },
  { id: 'shipping', label: 'Shipping', hint: 'Shipped, on the way to site' },
  { id: 'partial', label: 'Partly on site', hint: 'Some quantity delivered' },
  { id: 'onsite', label: 'On site', hint: 'Full quantity delivered' },
] as const
export type StageId = (typeof STAGES)[number]['id']
export const STAGE: Record<StageId, (typeof STAGES)[number]> = Object.fromEntries(STAGES.map((s) => [s.id, s])) as never

/**
 * The two tracks a material moves along (D-64). Submission is the consultant's side (submitted, approved), Procurement the
 * purchase side (ordered, shipped, on site). They are shown as two columns and moved independently; the single `stageOf` is
 * the furthest of the two, for the board, the pipeline and the overview counts. D-69 adds Not required to Submission, and
 * Production, Waiting for shipment and Shipping (formerly Delivering) to Procurement.
 */
export const SUB_STAGES = ['notsub', 'review', 'revise', 'approved', 'notreq'] as const
export type SubStage = (typeof SUB_STAGES)[number]
export const PROC_STAGES = ['none', 'ordered', 'production', 'waiting', 'shipping', 'partial', 'onsite'] as const
export type ProcStage = (typeof PROC_STAGES)[number]
export const PROC_NONE = { id: 'none', label: 'Not ordered', hint: 'No purchase order yet' } as const

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

/** `totalText`: the workbook's own words when the total is not a number ("As per BOQ", "TBC"), else null. */
export interface Qty { total: number; po: number; shd: number; onsite: number; unit: string; totalText: string | null }
export function qtyOf(item: MatItem): Qty {
  const e = effective(item)
  const t = e.total
  return { total: n(t), po: n(e.po), shd: n(e.shd), onsite: n(e.onsite), unit: text(item, 'unit'), totalText: typeof t === 'string' && t.trim() ? t.trim() : null }
}

/** The workbook's procurement percentages: "Production in progress", "Waiting for shipment" (a formula: production less
 * shipped and arrived) and "Shipping on the way". The three procurement stages between Ordered and on site read them (D-69). */
const pctOf = (item: MatItem, key: 'production' | 'waiting' | 'shipping') => n(effective(item)[key])

/**
 * A material that needs no submission (D-69): the status says "Not required" (or the workbook's "Not Submit, Exist in BP02"),
 * or the submission date column holds "N/A". An approval still wins: an approved material is approved.
 */
const NOT_REQUIRED = /^(not required|not submit\s+exist in bp0?2)/i
export const NOT_REQUIRED_STATUS = 'Not Required'
const isNa = (value: string) => /^(n\/?a|not required)$/i.test(value)

export function submissionOf(item: MatItem): SubStage {
  const status = text(item, 'msStatus')
  if (date(item, 'msApproved') || /^approved/i.test(status)) return 'approved'
  if (NOT_REQUIRED.test(status) || (!date(item, 'msActual') && isNa(text(item, 'msActual')))) return 'notreq'
  if (/revise|reject/i.test(status)) return 'revise'
  if (date(item, 'msActual') || /under review/i.test(status)) return 'review'
  return 'notsub'
}
export function procurementOf(item: MatItem): ProcStage {
  const q = qtyOf(item)
  if (q.total > 0 ? q.onsite >= q.total : !!date(item, 'arrActual')) return 'onsite'
  if (q.onsite > 0) return 'partial'
  if (!date(item, 'poActual') && q.po <= 0) return 'none'
  if (pctOf(item, 'shipping') > 0) return 'shipping'
  if (pctOf(item, 'waiting') > 0) return 'waiting'
  if (pctOf(item, 'production') > 0) return 'production'
  return 'ordered'
}
/** Whether the sample step is skipped: its approval or submission column says "N/A" or "Not required". */
export function sampleSkipped(item: MatItem): boolean {
  return !date(item, 'ssApproved') && (isNa(text(item, 'ssApproved')) || isNa(text(item, 'ssActual')))
}
/** Marks the sample step as not required ("N/A") or clears those markers so it is required again. */
export function sampleSkipPatch(item: MatItem, skip: boolean): Patch {
  const patch: Patch = {}
  if (skip) {
    if (!isNa(text(item, 'ssApproved'))) col(item, 'ssApproved', 'N/A', patch)
    return patch
  }
  if (isNa(text(item, 'ssApproved'))) col(item, 'ssApproved', '', patch)
  if (isNa(text(item, 'ssActual'))) col(item, 'ssActual', '', patch)
  return patch
}
export function stageOf(item: MatItem): StageId {
  const proc = procurementOf(item)
  return proc === 'none' ? submissionOf(item) : proc
}

/** `expected`: the date is derived (approval 14 days after submission), not a plan column. */
export interface NextStep { label: string; date: string | null; diff: number | null; done: boolean; expected: boolean }
/** What has to happen next and when it was planned. Approval has no plan column: it is due 14 days after submission. */
export function nextOf(item: MatItem, today: string): NextStep {
  const submitted = date(item, 'msActual')
  const plan: Record<StageId, [string, string | null]> = {
    notsub: ['Submit material', date(item, 'msPlan')],
    review: ['Get approval', submitted && addDaysIso(submitted, 14)],
    revise: ['Resubmit', submitted && addDaysIso(submitted, 10)],
    approved: ['Place order', date(item, 'poPlan')],
    notreq: ['Place order', date(item, 'poPlan')],
    ordered: ['Start production', date(item, 'arrPlan')],
    production: ['Finish production', date(item, 'arrPlan')],
    waiting: ['Ship', date(item, 'arrPlan')],
    shipping: ['Arrival on site', date(item, 'arrPlan')],
    partial: ['Balance delivery', date(item, 'arrPlan')],
    onsite: ['Complete', null],
  }
  const stage = stageOf(item)
  const [label, when] = plan[stage]
  return { label, date: when, diff: when ? days(when, today) : null, done: stage === 'onsite', expected: stage === 'review' || stage === 'revise' }
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

/** Stages a person moves a material to directly; Partly on site comes from setting the quantity on site (`onsitePatch`). */
export type MoveStage = Exclude<StageId, 'partial'>

/**
 * Moves the Submission track only: the submission and approval dates and the status. Procurement is left as it is, so marking
 * an ordered material "Under review" again does not cancel its order.
 */
export function submissionPatch(item: MatItem, to: SubStage, on: string): Patch {
  const patch: Patch = {}
  const keep = (key: EditableColKey) => date(item, key) ?? on
  const clearDate = (key: EditableColKey) => { if (date(item, key)) col(item, key, '', patch) }
  if (to === 'notsub') {
    if (date(item, 'msActual') || isNa(text(item, 'msActual'))) col(item, 'msActual', '', patch)
    clearDate('msApproved')
    col(item, 'msStatus', 'Not Yet Submit', patch)
  }
  // A resubmission is a new submission: it takes the date given, where a first submission keeps a date already recorded.
  if (to === 'review') { col(item, 'msActual', submissionOf(item) === 'revise' ? on : keep('msActual'), patch); clearDate('msApproved'); col(item, 'msStatus', 'Under Review', patch) }
  if (to === 'revise') { col(item, 'msActual', keep('msActual'), patch); clearDate('msApproved'); col(item, 'msStatus', 'Revise & Resubmit', patch) }
  // Not required: the status says so (the Sheet's status column shows it); an approval date would still read as approved, so it goes.
  if (to === 'notreq') { clearDate('msApproved'); if (submissionOf(item) !== 'notreq' || date(item, 'msApproved')) col(item, 'msStatus', NOT_REQUIRED_STATUS, patch) }
  if (to === 'approved') {
    col(item, 'msActual', keep('msActual'), patch)
    col(item, 'msApproved', keep('msApproved'), patch)
    if (!/^approved/i.test(text(item, 'msStatus'))) col(item, 'msStatus', 'Approved', patch)
  }
  return patch
}

/**
 * Moves the Procurement track only: order date and quantity, the production, waiting and shipping percentages, the quantity on
 * site and the arrival date. Each stage writes the workbook percentages the Sheet shows (D-69): Ordered clears them; Production
 * sets production to 100% (unless it already has a share) and holds waiting at 0; Waiting for shipment lets the workbook's
 * waiting formula (production less shipped and arrived) show the produced share; Shipping sets shipping to 100%; On site clears
 * shipping. Later steps are cleared only where they hold a real date or a positive value, so workbook text such as "TBC" is
 * never overwritten.
 */
export function procurementPatch(item: MatItem, to: Exclude<ProcStage, 'partial'>, on: string): Patch {
  const patch: Patch = {}, q = qtyOf(item)
  const keep = (key: EditableColKey) => date(item, key) ?? on
  const clearDate = (key: EditableColKey) => { if (date(item, key)) col(item, key, '', patch) }
  const setQty = (key: 'po' | 'onsite' | 'shipping' | 'production', value: number) => { if (n(effective(item)[key]) !== value) patch[key] = cellPatch(item, key, value) }
  const ordered = () => { col(item, 'poActual', keep('poActual'), patch); if (q.po <= 0 && q.total > 0) patch.po = cellPatch(item, 'po', q.total) }
  const notOnSite = () => { if (q.onsite > 0) setQty('onsite', 0); clearDate('arrActual') }
  const produced = () => { if (pctOf(item, 'production') <= 0) setQty('production', 1) }
  if (to === 'none') { clearDate('poActual'); if (q.po > 0) setQty('po', 0); setQty('production', 0); setQty('shipping', 0); notOnSite() }
  if (to === 'ordered') { ordered(); setQty('production', 0); setQty('shipping', 0); notOnSite() }
  if (to === 'production' || to === 'waiting') { ordered(); produced(); setQty('shipping', 0); notOnSite() }
  if (to === 'shipping') { ordered(); if (pctOf(item, 'shipping') <= 0) setQty('shipping', 1); notOnSite() }
  if (to === 'onsite') {
    ordered()
    setQty('shipping', 0)
    // Raise the quantity to the total only when it is short; an over-delivery stays as counted.
    if (q.total > 0 && q.onsite < q.total) patch.onsite = cellPatch(item, 'onsite', q.total)
    col(item, 'arrActual', keep('arrActual'), patch)
  }
  // "Waiting for shipment" is the workbook's formula over the other percentages. Waiting lets a positive formula show through
  // (or writes 100% when the cell is static or the total is non-numeric); every other stage holds it at 0 (clearing any
  // override whenever the workbook formula already yields 0, so later Sheet edits keep driving the stage).
  if (to === 'waiting') {
    if (pctAfter(item, 'waiting', patch) > 0) { if (item.edits.waiting !== undefined) patch.waiting = null }
    else patch.waiting = cellPatch(item, 'waiting', 1)
  } else {
    setPct(item, 'waiting', 0, patch)
  }
  return patch
}

/** What a percentage cell reads once the other edits in `patch` are applied and its own override is removed. */
function pctAfter(item: MatItem, key: 'waiting', patch: Patch) {
  const edits = { ...item.edits } as Record<string, unknown>
  for (const [k, v] of Object.entries(patch)) { if (v === null) delete edits[k]; else edits[k] = v }
  delete edits[key]
  return n(effective({ ...item, edits: edits as MatItem['edits'] })[key])
}

/**
 * Sets a percentage cell against what it would read with the other changes in `patch` applied: null removes any override (the
 * workbook's formula or value shows again); a number is written only when the cell would not already read it.
 */
function setPct(item: MatItem, key: 'waiting', value: number | null, patch: Patch) {
  const base = pctAfter(item, key, patch)
  if (value === null || base === value) { if (item.edits[key] !== undefined) patch[key] = null }
  else patch[key] = value
}

/**
 * The column and cell edits that put a material in `stage` on `on` (the board and bulk moves). A submission stage also takes
 * the order back; a procurement stage also marks the submission approved. Earlier real dates are kept and missing ones get
 * `on`; later steps are cleared only where they hold a real date or a positive quantity.
 */
export function stagePatch(item: MatItem, stage: MoveStage, on: string): Patch {
  if ((SUB_STAGES as readonly string[]).includes(stage)) return { ...procurementPatch(item, 'none', on), ...submissionPatch(item, stage as SubStage, on) }
  // A material that needs no submission keeps that when it is ordered; any other is marked approved.
  const sub = submissionOf(item) === 'notreq' ? {} : submissionPatch(item, 'approved', on)
  return { ...sub, ...procurementPatch(item, stage as Exclude<ProcStage, 'partial'>, on) }
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

/** One section header row of the workbook: its number ("1.1.2"), its name, and how deep it sits. */
export interface SectionInfo { id: string; no: string; name: string; label: string; depth: number; parent: string | null }
export interface SectionTree {
  /** Every section, in workbook order. */
  sections: SectionInfo[]
  /** Each material's enclosing sections, outermost first, by item id. Materials above the first section have none. */
  pathOf: Map<string, SectionInfo[]>
}

/**
 * The workbook's section nesting (1 Wall Finishing > 1.1 L23 Club Lounge > 1.1.1 Stone/Marble), as the Sheet shows it.
 * The name is the section row's text columns joined, the same text the Sheet's section band shows after the number.
 * A section covers rows up to its `end` (the importer's SUBTOTAL range); `level` says how deep it is.
 */
export function sectionTree(rows: MatItem[]): SectionTree {
  const sections: SectionInfo[] = []
  const pathOf = new Map<string, SectionInfo[]>()
  const stack: { info: SectionInfo; level: number; end: number }[] = []
  const leave = (pos: number) => { while (stack.length && stack.at(-1)!.end < pos) stack.pop() }
  for (const row of rows) {
    if (row.kind === 'section') {
      const level = row.data.level ?? 0
      leave(row.pos)
      while (stack.length && stack.at(-1)!.level >= level) stack.pop()
      const no = text(row, 'no')
      const name = (['pic', 'bp02', 'code', 'description'] as const).map((k) => text(row, k)).filter(Boolean).join(' ')
      const info: SectionInfo = { id: row.id, no, name, label: [no, name].filter(Boolean).join(' ') || 'Section', depth: stack.length, parent: stack.at(-1)?.info.id ?? null }
      sections.push(info)
      stack.push({ info, level, end: row.data.end ?? Infinity })
    } else if (row.kind === 'item') {
      leave(row.pos)
      if (stack.length) pathOf.set(row.id, stack.map((s) => s.info))
    }
  }
  return { sections, pathOf }
}
