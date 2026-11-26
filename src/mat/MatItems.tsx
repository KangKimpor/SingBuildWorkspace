import { memo, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import * as Dialog from '@radix-ui/react-dialog'
import { animate, motion, useMotionValue } from 'motion/react'
import type { AnimationPlaybackControls } from 'motion/react'
import { Activity, ArrowRight, CalendarDays, Check, ChevronDown, ChevronsDown, ChevronsUp, ChevronUp, History, ImageIcon, Maximize2, Minimize2, Search, Undo2, X } from 'lucide-react'
import { useMotionReduced } from '@/motion/hooks'
import { useMatImageSrc } from './images'
import type { MatPicture } from './MatSourcePanel'
import { changedCells } from './changes'
import { codeOf, colPatchValue, effective, effectiveCol, effectiveImages, formatCell, formatCol, isIsoDate } from './formulas'
import type { OnFields, OnRemark } from './MatCells'
import { remarkKey } from './store'
import type { MatState } from './store'
import {
  ATTENTION, PROC_NONE, PROC_STAGES, STAGE, STAGES, SUB_STAGES, addDaysIso, cellPatch, days, effectivePatch, nextOf, onsitePatch, procurementOf, procurementPatch,
  qtyOf, sampleSkipPatch, sampleSkipped, sectionTree, snapshot, stageOf, stagePatch, submissionOf, submissionPatch, todayIso,
} from './stage'
import type { AttentionId, MoveStage, NextStep, ProcStage, Qty, SectionInfo, SectionTree, StageId, SubStage } from './stage'
import { PCT_CELLS, QTY_CELLS } from './types'
import type { CellKey, ColKey, EditableColKey, FieldKey, FieldValue, MatItem, MatLog, Sheet, Team } from './types'

type Patch = Partial<Record<FieldKey, FieldValue>>
type Group = 'section' | 'stage' | 'owner' | 'none'
type Sort = 'pos' | 'urgency' | 'recent'
type PopType = 'sub' | 'proc' | 'next' | 'qty' | 'owner' | 'note' | 'filter-owner' | 'group' | 'sort' | 'activity'
/** `field`: which quantity a `qty` popover edits. `team`: which team's note a `note` popover opens on. */
interface PopOpts { field?: QtyField; team?: Team }
interface Pop extends PopOpts { type: PopType; id: string | null; anchor: HTMLElement }
interface Toast { message: string; undo?: { id: string; patch: Patch }[]; key: number }
interface Note { team: Team; week: string; body: string; by?: string }

const NUM = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })
const TEAM_LABEL: Record<Team, string> = { purchase: 'Purchase', pm: 'PM' }
const GROUPS: [Group, string][] = [['section', 'Section'], ['stage', 'Stage'], ['owner', 'Owner'], ['none', 'None']]
const SORTS: [Sort, string][] = [['pos', 'Workbook order'], ['urgency', 'Most urgent'], ['recent', 'Recently updated']]
const realYear = (iso: string) => /^20\d\d-\d\d-\d\d$/.test(iso)
const text = (item: MatItem, key: EditableColKey) => formatCol(effectiveCol(item, key)).trim()
// One formatter each, built once: a list of 2,000 rows formats a date in every row.
const DAY_MONTH = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
const DAY_MONTH_YEAR = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const asDate = (iso: string) => new Date(`${iso}T00:00:00`)
const shortDate = (iso: string | null) => iso ? DAY_MONTH.format(asDate(iso)) : '—'
const weekName = (week: string, current: string) => week === current ? 'This week' : week === addDaysIso(current, -7) ? 'Last week' : `Week of ${shortDate(week)}`
/** "just now", "5m ago", "3h ago", "2d ago", "3w ago". */
function ago(at: string, now = Date.now()) {
  const m = Math.round((now - Date.parse(at)) / 6e4)
  if (!Number.isFinite(m) || m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  return d < 7 ? `${d}d ago` : `${Math.round(d / 7)}w ago`
}
const FIELD_NAMES: Partial<Record<string, string>> = {
  msPlan: 'submission plan date', msActual: 'submission date', msApproved: 'approval date', msStatus: 'submission status',
  ssPlan: 'sample plan date', ssActual: 'sample submission date', ssApproved: 'sample approval date',
  poPlan: 'order plan date', poActual: 'order date', arrPlan: 'arrival plan date', arrActual: 'arrival date',
  total: 'total quantity', po: 'ordered quantity', shd: 'approved SHD', onsite: 'quantity on site', unit: 'unit',
  description: 'description', code: 'code', brand: 'brand', location: 'location', spec: 'specification', source: 'source', pic: 'owner',
}
/** One plain sentence for a log entry, written from the fields it saved ("moved it" is not stored, so it is not claimed). */
export function describeLog(entry: MatLog): string {
  const d = entry.detail
  if (entry.kind === 'remark') return `${typeof d.body === 'string' && d.body.trim() ? 'wrote' : 'cleared'} the ${d.team === 'pm' ? 'PM' : 'purchase'} note`
  const keys = Object.keys(d)
  if (keys.length === 1 && keys[0] === 'pic') return typeof d.pic === 'string' && d.pic ? `assigned it to ${d.pic}` : 'cleared the owner'
  if (typeof d.msStatus === 'string' && d.msStatus) return `set the status to ${d.msStatus}`
  if ('onsite' in d) return typeof d.onsite === 'number' ? `set on site to ${NUM.format(d.onsite)}` : 'put the on-site quantity back to the workbook value'
  if (typeof d.poActual === 'string' && d.poActual) return 'logged the order'
  if (keys.some((k) => k === 'image' || k === 'sample')) return 'updated the photos'
  if (keys.length === 1) return `${d[keys[0]!] === null ? 'reset' : 'edited'} the ${FIELD_NAMES[keys[0]!] ?? keys[0]}`
  return `edited ${keys.length} fields`
}
const SUFFIX = /^(jr|sr|ii|iii|iv|v)\.?$/i
/** "Christopher Alexander Montgomery III" gives CM, "Đặng Thị Ngọc Hân" ĐH, "Jo" J: first and last word, suffixes skipped, whole characters. */
export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter((w) => w && !SUFFIX.test(w))
  const first = (w: string | undefined) => (w ? [...w][0] ?? '' : '')
  return (words.length > 1 ? first(words[0]) + first(words.at(-1)) : first(words[0])).toUpperCase() || '?'
}
const HUES = [211, 280, 340, 145, 30, 25, 245, 190]
const hue = (name: string) => HUES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length]

function Avatar({ name, large }: { name: string | null; large?: boolean }) {
  if (!name) return <span className="mi-av" data-large={large || undefined} data-unknown aria-hidden="true">?</span>
  return <span className="mi-av" data-large={large || undefined} style={{ ['--h' as string]: hue(name) }} aria-hidden="true">{initials(name)}</span>
}
/** One symbol per stage, read left to right as the material moves: dashed (nothing yet), clock (waiting), back arrow (revise),
 * check (approved), box (ordered), truck (arriving), checked box (all on site). The symbol carries the colour; the label stays ink. */
type ChipStage = StageId | 'none'
/**
 * Two-tone stage symbols (D-64), drawn the way the reference capsules are: a soft shape in a light tint of the stage's hue
 * (`b`), and the glyph on it in the full hue (`g` stroked, `d` filled). A 20 × 20 grid, 2 px strokes, round ends.
 */
const GLYPH: Record<ChipStage, ReactNode> = {
  notsub: <><rect className="b" x="4" y="2" width="12" height="16" rx="3"/><path className="g" d="M7.5 7.5h5M7.5 11h5M7.5 14.5h2.5"/></>,
  review: <><circle className="b" cx="10" cy="10" r="8"/><path className="g" d="M10 5.8V10l2.9 1.9"/></>,
  revise: <><circle className="b" cx="10" cy="10" r="8"/><path className="g" d="M6.2 7.6a4.4 4.4 0 1 1-.3 4.7"/><path className="g" d="M5.8 4.6v3.3h3.3"/></>,
  approved: <><circle className="b" cx="10" cy="10" r="8"/><path className="g" d="m6.5 10.3 2.4 2.4 4.6-4.9"/></>,
  notreq: <><circle className="b" cx="10" cy="10" r="8"/><path className="g" d="m6.2 7 3 3-3 3M10.6 7l3 3-3 3"/></>,
  none: <><rect className="b" x="2" y="5" width="16" height="12" rx="3"/><path className="g" d="M7 11h6"/></>,
  ordered: <><rect className="b" x="2" y="5.5" width="16" height="11.5" rx="3"/><path className="g" d="M7 5.5V3.8c0-.4.4-.8.8-.8h4.4c.4 0 .8.4.8.8v1.7M2 10.3h16M10 9v2.6"/></>,
  production: <><path className="b" d="M2 17.5V9.2l4.6 2.9V9.2l4.6 2.9V4.5H18v13z"/><path className="g" d="M5.6 14.6h1.8M9.9 14.6h1.8M14.2 14.6h1.2"/></>,
  waiting: <><rect className="b" x="2" y="4" width="16" height="13" rx="3"/><path className="g" d="M10 7.4v3.2l2.2 1.4"/></>,
  shipping: <><path className="b" d="M2 6.5A1.5 1.5 0 0 1 3.5 5h8A1.5 1.5 0 0 1 13 6.5V14H2zM13 8h2.6l2.4 3v3h-5z"/><circle className="d" cx="6" cy="14.6" r="1.9"/><circle className="d" cx="14.6" cy="14.6" r="1.9"/></>,
  partial: <><rect className="b" x="2" y="4" width="16" height="13" rx="3"/><path className="g" d="M10 7.2v5.6M7.4 10.4 10 13l2.6-2.6"/></>,
  onsite: <><rect className="b" x="2" y="4" width="16" height="13" rx="3"/><path className="g" d="m6.6 10.6 2.3 2.3 4.5-4.8"/></>,
}
const stageLabel = (stage: ChipStage) => stage === 'none' ? PROC_NONE.label : STAGE[stage].label
const stageHint = (stage: ChipStage) => stage === 'none' ? PROC_NONE.hint : STAGE[stage].hint
function StageIcon({ stage, size = 16 }: { stage: ChipStage; size?: number }) {
  return <svg className="mi-sicon" data-stage={stage} width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" focusable="false">{GLYPH[stage]}</svg>
}
/** A stage as a capsule in its hue: a pale ground, a solid ring (a little heavier underneath), the two-tone symbol, the label in a deep shade. */
function StagePill({ stage, caret }: { stage: ChipStage; caret?: boolean }) {
  return <span className="mi-stage" data-stage={stage}><StageIcon stage={stage} size={19}/><span>{stageLabel(stage)}</span>{caret && <ChevronDown className="mi-caret" size={11} aria-hidden="true"/>}</span>
}

/**
 * The six points a material passes (D-66), the same in the List's Timeline column and the panel's Timeline: submitted,
 * approved, sample approved, ordered, shipped and fully on site. A point is reached by its date, or by the stage the
 * material is in (an approved status with no approval date is still approved); Shipped has no date column and follows the
 * procurement stage. An unreached point whose plan date has passed is overdue. A skipped point (D-69: no submission or no
 * sample needed) is neither reached nor overdue, and the material moves past it.
 */
interface Stone {
  key: string; title: string
  /** What the step asks for while it is the one the material is at ("Place order", not "Order placed"). */
  todo: string
  plan: string; planKey: EditableColKey | null; actual: EditableColKey | null
  /** The real date it was reached, when there is one; `note` holds workbook text such as "TBC" in that column. */
  date: string; note: string; done: boolean; late: boolean; skipped: boolean; sub?: string
}
function stonesOf(item: MatItem, today: string): Stone[] {
  const iso = (key: EditableColKey) => { const v = effectiveCol(item, key); return isIsoDate(v) ? v : '' }
  const raw = (key: EditableColKey) => { const v = text(item, key); return v && !isIsoDate(effectiveCol(item, key)) ? v : '' }
  const sub = submissionOf(item), proc = procurementOf(item), submitted = iso('msActual'), noSub = sub === 'notreq'
  const shipTodo = proc === 'production' ? 'In production' : proc === 'waiting' ? 'Waiting for shipment' : proc === 'ordered' ? 'Production and shipping' : 'Ship'
  const defs: (Omit<Stone, 'date' | 'note' | 'done' | 'late'> & { reached: boolean })[] = [
    { key: 'submitted', title: 'Material submitted', todo: 'Submit material', plan: iso('msPlan'), planKey: 'msPlan', actual: 'msActual', reached: sub !== 'notsub' && !noSub, skipped: noSub },
    { key: 'approved', title: 'Material approved', todo: 'Get approval', plan: submitted ? addDaysIso(submitted, 14) : '', planKey: null, actual: 'msApproved', reached: sub === 'approved', skipped: noSub, sub: text(item, 'msStatus') },
    { key: 'sample', title: 'Sample approved', todo: 'Get sample approved', plan: iso('ssPlan'), planKey: 'ssPlan', actual: 'ssApproved', reached: /^approved/i.test(raw('ssApproved')), skipped: sampleSkipped(item) },
    { key: 'ordered', title: 'Order placed', todo: 'Place order', plan: iso('poPlan'), planKey: 'poPlan', actual: 'poActual', reached: proc !== 'none', skipped: false },
    { key: 'shipping', title: 'Shipped', todo: shipTodo, plan: '', planKey: null, actual: null, reached: proc === 'shipping' || proc === 'partial' || proc === 'onsite', skipped: false },
    { key: 'onsite', title: 'Fully on site', todo: proc === 'partial' ? 'Deliver the balance' : 'Deliver to site', plan: iso('arrPlan'), planKey: 'arrPlan', actual: 'arrActual', reached: proc === 'onsite', skipped: false },
  ]
  return defs.map(({ reached, ...d }) => {
    const date = d.actual ? iso(d.actual) : '', done = !!date || reached
    const skipped = d.skipped && !done
    return { ...d, date, note: d.actual && !skipped ? raw(d.actual) : '', done, skipped, late: !done && !skipped && !!d.plan && days(d.plan, today) < 0 }
  })
}
/** The step a material is at: the first one not reached or skipped (the sample comes last, as it runs beside the main flow). */
const pending = (s: Stone) => !s.done && !s.skipped
const currentStone = (stones: Stone[]) => stones.find((s) => pending(s) && s.key !== 'sample') ?? stones.find(pending) ?? null
/** A step's state in the panel's words: "139d overdue", "Plan 2 Dec", "Expected 23 Nov", "Pending", or the date it was reached. */
function stoneStatus(s: Stone, today: string): { text: string; tone?: 'late' | 'soon' | 'done' } {
  if (s.done) return { text: s.date ? shortDate(s.date) : 'Done', tone: 'done' }
  if (s.skipped) return { text: 'Not required' }
  if (!s.plan) return { text: s.key === 'shipping' ? 'Pending' : 'No plan date' }
  const diff = days(s.plan, today), word = s.planKey ? 'Plan' : 'Expected'
  if (diff < 0) return { text: `${-diff}d overdue · ${word.toLowerCase()} ${shortDate(s.plan)}`, tone: 'late' }
  if (diff <= 14) return { text: `${diff ? `In ${diff}d` : 'Today'} · ${word.toLowerCase()} ${shortDate(s.plan)}`, tone: 'soon' }
  return { text: `${word} ${shortDate(s.plan)}` }
}
function StoneStatus({ stone, today }: { stone: Stone; today: string }) {
  const st = stoneStatus(stone, today)
  return <span className="mi-due" data-tone={st.tone}>{st.text}</span>
}
const stoneLine = (s: Stone, today: string) => `${s.title}: ${s.done ? s.date ? shortDate(s.date) : 'done' : s.skipped ? 'not required' : s.late ? `${-days(s.plan, today)}d overdue` : s.plan ? `plan ${shortDate(s.plan)}` : 'pending'}`
const stoneState = (s: Stone) => s.done ? 'done' : s.skipped ? 'skip' : s.late ? 'late' : undefined
/** The panel's timeline in one line of points: green with a check when reached, a red ring when overdue, a dashed ring when
 * not required, grey when pending. */
function Track({ stones }: { stones: Stone[] }) {
  return <span className="mi-track" aria-hidden="true">
    {stones.map((m) => <i key={m.key} data-state={stoneState(m)}>{m.done && <Check size={8} strokeWidth={3.6}/>}</i>)}
  </span>
}
function QtyBar({ q, large }: { q: Qty; large?: boolean }) {
  const of = (v: number) => q.total > 0 ? Math.min(1, v / q.total) : 0
  const on = of(q.onsite), shd = of(q.shd), po = of(q.po)
  return <span className="mi-qbar" data-large={large || undefined} aria-hidden="true">
    <i style={{ width: `${on * 100}%` }} data-k="onsite"/>
    {large && <i style={{ width: `${Math.max(0, shd - on) * 100}%` }} data-k="shd"/>}
    <i style={{ width: `${Math.max(0, po - Math.max(on, large ? shd : 0)) * 100}%` }} data-k="po"/>
  </span>
}

export interface MatItemsProps {
  sheet: Extract<Sheet, 'id' | 'mep'>
  state: MatState
  view: 'list' | 'board'
  onFields: OnFields
  onRemark: OnRemark
  onOpenSource: (id: string) => void
  /** Opens a photo full size. */
  onPicture: (picture: MatPicture) => void
  /** Full screen (D-69), shared with the Sheet: the page hides its heading and the app's sidebar while it is on. */
  expanded?: boolean
  onToggleExpand?: () => void
}

/** The List and Board views of one material sheet (D-57): every value is edited in place, every change can be undone. */
export function MatItems({ sheet, state, view, onFields, onRemark, onOpenSource, onPicture, expanded, onToggleExpand }: MatItemsProps) {
  const rows = useMemo(() => state.items.filter((i) => i.sheet === sheet), [state.items, sheet])
  const items = useMemo(() => rows.filter((r) => r.kind === 'item'), [rows])
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const tree = useMemo(() => sectionTree(rows), [rows])
  const changed = useMemo(() => changedCells(rows, state.remarks, state.week), [rows, state.remarks, state.week])
  const notes = useMemo(() => {
    const out = new Map<string, Note[]>()
    for (const [key, body] of Object.entries(state.remarks)) {
      if (!body.trim()) continue
      const [id, team, week] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1, key.lastIndexOf(':')), key.slice(key.lastIndexOf(':') + 1)]
      if (!byId.has(id)) continue
      const list = out.get(id) ?? []
      const author = state.remarkBy?.[key]
      list.push({ team: team as Team, week, body, by: author ? state.people?.[author] ?? 'Someone' : undefined })
      out.set(id, list)
    }
    for (const list of out.values()) list.sort((a, b) => b.week.localeCompare(a.week) || (a.team === 'pm' ? -1 : 1))
    return out
  }, [state.remarks, state.remarkBy, state.people, byId])
  const hasOwner = sheet !== 'mep'
  const people = useMemo(() => state.people ?? {}, [state.people])
  /** This sheet's recent activity, newest first. */
  const activity = useMemo(() => (state.log ?? []).filter((l) => byId.has(l.itemId)), [state.log, byId])
  const owners = useMemo(() => hasOwner ? [...new Set(items.map((i) => text(i, 'pic')).filter(Boolean))].sort((a, b) => a.localeCompare(b)) : [], [items, hasOwner])
  const today = todayIso()
  // Everything a row shows that is derived from its columns, computed once per data change instead of on every render.
  // A row's Derived object is reused while the row itself is unchanged, so an edit re-renders the edited row only.
  const derived = useMemo(() => {
    const out = new Map<string, Derived>()
    for (const i of items) out.set(i.id, derivedOf(i, today))
    return out
  }, [items, today])

  const [query, setQuery] = useState('')
  const [owner, setOwner] = useState('')
  const [stage, setStage] = useState<StageId | ''>('')
  const [attn, setAttn] = useState<AttentionId | ''>('')
  const [changedOnly, setChangedOnly] = useState(false)
  const [group, setGroup] = useState<Group>('section')
  const [sort, setSort] = useState<Sort>('pos')
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())
  const [open, setOpen] = useState<string | null>(null)
  /** Set by the List while it shows: a scroll that works with rows not yet mounted. */
  const listHandle = useRef<ListHandle | null>(null)
  const [pop, setPop] = useState<Pop | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [flash, setFlash] = useState<ReadonlySet<string>>(() => new Set())
  const searchRef = useRef<HTMLInputElement>(null)
  const q = useDeferredValue(query).trim().toLowerCase()

  const scope = useMemo(() => items.filter((i) => !owner || text(i, 'pic') === owner), [items, owner])
  const list = useMemo(() => {
    const attnTest = attn ? ATTENTION.find((a) => a.id === attn)!.test : null
    // Omitted materials never count as needing attention, here and on the overview cards.
    let out = scope.filter((i) => { const d = derived.get(i.id)!; return (!q || d.search.includes(q))
      && (!stage || d.stage === stage) && (!attnTest || (i.data.mark !== 'omit' && attnTest(i, today))) && (!changedOnly || changed.has(i.id)) })
    if (sort === 'urgency') out = [...out].sort((a, b) => (derived.get(a.id)!.next.diff ?? 1e9) - (derived.get(b.id)!.next.diff ?? 1e9))
    if (sort === 'recent') out = [...out].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    return out
  }, [scope, derived, q, stage, attn, changedOnly, changed, sort, today])
  const filtering = !!(q || owner || stage || attn || changedOnly)
  // Every group header the List can show for the current grouping, for "Collapse all sections".
  const groupKeys = useMemo(() => group === 'section' ? ['section:none', ...tree.sections.map((x) => `section:${x.id}`)]
    : group === 'stage' ? STAGES.map((x) => `stage:${x.id}`) : group === 'owner' ? [...owners, 'Unassigned'].map((o) => `owner:${o}`) : [], [group, tree, owners])
  const clearFilters = () => { setQuery(''); setOwner(''); setStage(''); setAttn(''); setChangedOnly(false) }

  // ---- edits: snapshot, save, toast with undo ----
  const toastKey = useRef(0)
  const say = useCallback((message: string, undo?: Toast['undo']) => { const key = ++toastKey.current; setToast({ message, undo, key }); return key }, [])
  // Saves every row, keeps Undo for the rows that saved, and only replaces the toast if no newer one has taken its place.
  const apply = useCallback(async (changes: { item: MatItem; patch: Patch }[], message: string) => {
    const real = changes.map((c) => ({ item: c.item, patch: effectivePatch(c.item, c.patch) })).filter((c) => Object.keys(c.patch).length)
    if (!real.length) { say('Nothing to change'); return }
    const back = real.map((c) => ({ id: c.item.id, patch: snapshot(c.item, c.patch) }))
    const key = say(message, back)
    setFlash(new Set(real.map((c) => c.item.id)))
    const results = await Promise.allSettled(real.map((c) => onFields(c.item.id, c.patch)))
    const failed = results.filter((r) => r.status === 'rejected').length
    if (!failed || toastKey.current !== key) return
    const kept = back.filter((_, i) => results[i]!.status === 'fulfilled')
    say(real.length === 1 ? 'Could not save. The change was put back.' : `Could not save ${failed} of ${real.length}. Those were put back.`, kept.length ? kept : undefined)
  }, [onFields, say])
  const undo = useCallback(async () => {
    const back = toast?.undo
    if (!back) return
    const key = say('Undone')
    const results = await Promise.allSettled(back.map((b) => onFields(b.id, b.patch)))
    if (results.some((r) => r.status === 'rejected') && toastKey.current === key) say('Could not undo every change.')
  }, [toast, onFields, say])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast((cur) => cur?.key === toast.key ? null : cur), toast.undo ? 6000 : 1800)
    return () => clearTimeout(t)
  }, [toast])
  useEffect(() => {
    if (!flash.size) return
    const t = setTimeout(() => setFlash(new Set()), 1200)
    return () => clearTimeout(t)
  }, [flash])

  const moveTo = useCallback((ids: string[], to: MoveStage, on = today) => {
    const targets = ids.map((id) => byId.get(id)).filter((i): i is MatItem => !!i)
    void apply(targets.map((item) => ({ item, patch: stagePatch(item, to, on) })), ids.length > 1 ? `${ids.length} moved to ${STAGE[to].label}` : `Moved to ${STAGE[to].label}`)
  }, [apply, byId, today])
  const moveSub = useCallback((item: MatItem, to: SubStage, on = today) => void apply([{ item, patch: submissionPatch(item, to, on) }], `Submission: ${STAGE[to].label}`), [apply, today])
  const moveProc = useCallback((item: MatItem, to: Exclude<ProcStage, 'partial'>, on = today) => void apply([{ item, patch: procurementPatch(item, to, on) }], `Procurement: ${stageLabel(to)}`), [apply, today])
  const assign = useCallback((ids: string[], name: string) => {
    const targets = ids.map((id) => byId.get(id)).filter((i): i is MatItem => !!i)
    void apply(targets.map((item) => ({ item, patch: { pic: colPatchValue(item, 'pic', name) } })), ids.length > 1 ? `${ids.length} assigned to ${name}` : `Assigned to ${name}`)
  }, [apply, byId])
  const setOnsite = useCallback((item: MatItem, value: number, message: string) => void apply([{ item, patch: onsitePatch(item, value, today) }], message), [apply, today])
  const setDate = useCallback((item: MatItem, key: EditableColKey, value: string) => {
    const patch: Patch = { [key]: colPatchValue(item, key, value) }
    if (key === 'msApproved' && value && !/^approved/i.test(text(item, 'msStatus'))) patch.msStatus = colPatchValue(item, 'msStatus', 'Approved')
    if (key === 'msActual' && value && /not yet|not required/i.test(text(item, 'msStatus') || 'not yet')) patch.msStatus = colPatchValue(item, 'msStatus', 'Under Review')
    void apply([{ item, patch }], key.endsWith('Plan') ? 'Plan date saved' : 'Date saved')
  }, [apply])
  const skipSample = useCallback((item: MatItem, skip: boolean) => {
    void apply([{ item, patch: sampleSkipPatch(item, skip) }], skip ? 'Sample marked not required' : 'Sample required again')
  }, [apply])
  const setQty = useCallback((item: MatItem, key: CellKey, value: number) => {
    void apply([{ item, patch: key === 'onsite' ? onsitePatch(item, value, today) : { [key]: cellPatch(item, key, value) } }], 'Quantity saved')
  }, [apply, today])
  const saveNote = useCallback(async (id: string, team: Team, body: string) => {
    const before = state.remarks[remarkKey(id, team, state.week)] ?? ''
    if (body.trim() === before.trim()) return
    say(body.trim() ? 'Note saved' : 'Note removed')
    try { await onRemark(id, team, body.trim()) } catch { say('Could not save the note.') }
  }, [state.remarks, state.week, onRemark, say])

  // ---- revert an activity entry: writes back what the change replaced, after a confirmation ----
  const [reverting, setReverting] = useState<MatLog | null>(null)
  const revert = useCallback(async (entry: MatLog) => {
    const item = byId.get(entry.itemId), before = entry.before
    if (!item || !before) return
    if (entry.kind === 'fields') { await apply([{ item, patch: before as Patch }], 'Change undone'); return }
    const b = before as { team?: Team; body?: string }
    if (b.team) await saveNote(item.id, b.team, b.body ?? '')
  }, [apply, byId, saveNote])
  // ---- popovers ----
  const openPop = useCallback((type: PopType, id: string | null, anchor: HTMLElement, opts?: PopOpts) =>
    setPop((cur) => cur && cur.anchor === anchor && cur.type === type ? null : { type, id, anchor, ...opts }), [])
  const closePop = useCallback(() => setPop(null), [])

  // ---- panel navigation, keys ----
  const nav = useCallback((dir: number) => {
    const i = list.findIndex((x) => x.id === open), n = list[i + dir]
    if (!n) return
    setOpen(n.id)
    if (listHandle.current) listHandle.current.reveal(n.id)
    else document.querySelector(`[data-mi-card="${CSS.escape(n.id)}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [list, open])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      const inField = e.target instanceof HTMLElement && !!e.target.closest('input,textarea,select,[contenteditable=true]')
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !inField && toast?.undo) { e.preventDefault(); void undo(); return }
      // Escape closes the innermost thing first; preventDefault keeps it from also leaving full screen.
      if (e.key === 'Escape') {
        if (pop) { e.preventDefault(); setPop(null); return }
        if (open && !document.querySelector('[role="dialog"][data-state="open"]')) { e.preventDefault(); setOpen(null); return }
      }
      if (inField || e.metaKey || e.ctrlKey || e.altKey) return
      // A popover or a dialog owns the keyboard while it is open: no list shortcuts behind it.
      if (pop || (e.target instanceof HTMLElement && e.target.closest('.mi-pop,[role="dialog"]')) || document.querySelector('[role="dialog"][data-state="open"]')) return
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus() }
      if (open && (e.key === 'j' || e.key === 'ArrowDown')) { e.preventDefault(); nav(1) }
      if (open && (e.key === 'k' || e.key === 'ArrowUp')) { e.preventDefault(); nav(-1) }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [pop, open, nav, toast, undo])

  const actions = useMemo<RowActions>(() => ({ openPop, openPanel: setOpen, openPicture: onPicture }), [openPop, onPicture])
  const canRevert = useCallback((l: MatLog) => !!l.before && byId.has(l.itemId)
    && (l.kind === 'fields' || (l.before as { week?: string }).week === state.week), [byId, state.week])
  const ctx: RowCtx = { today, week: state.week, changed, notes, people, activity, hasOwner, flash, open, pop, derived, actions, openPop, openPanel: setOpen, canRevert, askRevert: setReverting }
  const openItem = open ? byId.get(open) ?? null : null
  const popItem = pop?.id ? byId.get(pop.id) ?? null : null

  return <div className="mi" data-view={view}>
    <Overview scope={scope} derived={derived} today={today} attn={attn} stage={stage}
      onAttn={(a) => { setAttn((cur) => cur === a ? '' : a); setStage('') }}
      onStage={(s) => { setStage((cur) => cur === s ? '' : s); setAttn('') }}/>
    <div className="mi-toolbar">
      <label className="mi-search">
        <Search size={15} aria-hidden="true"/>
        <input ref={searchRef} type="search" aria-label="Search material" placeholder="Search code, name, brand, location" value={query}
          onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape' && query) { e.preventDefault(); setQuery('') } }}/>
        <kbd aria-hidden="true">/</kbd>
      </label>
      {hasOwner && <MenuButton label="Owner" value={owner || 'Everyone'} active={pop?.type === 'filter-owner'} onOpen={(el) => openPop('filter-owner', null, el)}/>}
      {view === 'list' && <MenuButton label="Group" value={GROUPS.find((g) => g[0] === group)![1]} active={pop?.type === 'group'} onOpen={(el) => openPop('group', null, el)}/>}
      {view === 'list' && <MenuButton label="Sort" value={SORTS.find((s) => s[0] === sort)![1]} active={pop?.type === 'sort'} onOpen={(el) => openPop('sort', null, el)}/>}
      <button type="button" className="mi-chip" aria-pressed={changedOnly} onClick={() => setChangedOnly((v) => !v)}>
        <span className="mi-chg" aria-hidden="true"/>Changed this week<span className="mi-chip-n">{changed.size}</span>
      </button>
      {attn && <button type="button" className="mi-chip" aria-pressed="true" onClick={() => setAttn('')}>{ATTENTION.find((a) => a.id === attn)!.label}<X size={12} aria-label="Clear"/></button>}
      {stage && <button type="button" className="mi-chip" aria-pressed="true" onClick={() => setStage('')}>{STAGE[stage].label}<X size={12} aria-label="Clear"/></button>}
      {filtering && <button type="button" className="mi-link" onClick={clearFilters}>Clear filters</button>}
      <span className="mi-spacer"/>
      {view === 'list' && group !== 'none' && <span className="mi-fold" role="group" aria-label="Sections">
        <button type="button" className="mi-menu mi-icon" title="Expand all sections" aria-label="Expand all sections" onClick={() => setCollapsed(new Set())}><ChevronsDown size={15} aria-hidden="true"/></button>
        <button type="button" className="mi-menu mi-icon" title="Collapse all sections" aria-label="Collapse all sections" onClick={() => setCollapsed(new Set(groupKeys))}><ChevronsUp size={15} aria-hidden="true"/></button>
      </span>}
      <button type="button" className="mi-menu" aria-haspopup="dialog" aria-expanded={pop?.type === 'activity'} onClick={(e) => openPop('activity', null, e.currentTarget)}>
        <Activity size={14} aria-hidden="true"/>Activity
      </button>
      <span className="mi-count" role="status" aria-live="polite">{NUM.format(list.length)} of {NUM.format(items.length)}</span>
      {onToggleExpand && <button type="button" className="mi-menu" aria-pressed={!!expanded} title={expanded ? 'Leave full screen (Esc)' : 'Full screen'} onClick={onToggleExpand}>
        {expanded ? <Minimize2 size={14} aria-hidden="true"/> : <Maximize2 size={14} aria-hidden="true"/>}{expanded ? 'Collapse' : 'Expand'}
      </button>}
    </div>

    {items.length === 0
      ? <div className="mi-empty">No materials on this sheet yet. They appear here once the workbook is imported.</div>
      : list.length === 0
      ? <div className="mi-empty">No materials match.<button type="button" className="mi-btn" onClick={clearFilters}>Clear filters</button></div>
      : view === 'list'
      ? <ListView list={list} group={group} tree={tree} collapsed={collapsed} ctx={ctx} handle={listHandle}
          onToggleGroup={(k) => setCollapsed((old) => { const n = new Set(old); if (!n.delete(k)) n.add(k); return n })}/>
      : <BoardView list={list} ctx={ctx} onDrop={(id, to, card) => {
          if (to === 'partial') { const el = document.querySelector<HTMLElement>(`[data-mi-card="${CSS.escape(id)}"]`) ?? card; openPop('qty', id, el, { field: 'onsite' }); return }
          moveTo([id], to as MoveStage)
        }}/>}

    <Panel item={openItem} ctx={ctx} section={openItem ? tree.pathOf.get(openItem.id) ?? [] : []} week={state.week} remarks={state.remarks}
      onClose={() => setOpen(null)} onNav={nav} onDate={setDate} onQty={setQty} onSub={moveSub} onSkipSample={skipSample}
      onNote={saveNote} onOpenSource={onOpenSource}/>

    <RevertDialog entry={reverting} item={reverting ? byId.get(reverting.itemId) ?? null : null} people={people} activity={activity} remarks={state.remarks}
      onClose={() => setReverting(null)} onConfirm={(e) => { setReverting(null); void revert(e) }}/>

    {pop && <Popover pop={pop} onClose={closePop}>
      <PopBody key={`${pop.type}:${pop.id ?? ''}:${pop.team ?? ''}`} pop={pop} item={popItem} today={today} owners={owners} owner={owner} group={group} sort={sort} hasOwner={hasOwner}
        week={state.week} remarks={state.remarks} notes={pop.id ? notes.get(pop.id) : undefined}
        onSub={(to) => { closePop(); if (popItem) moveSub(popItem, to) }}
        onProc={(to) => {
          if (to === 'partial') { setPop({ type: 'qty', id: pop.id!, anchor: pop.anchor, field: 'onsite' }); return }
          closePop(); if (popItem) moveProc(popItem, to)
        }}
        onPlan={(key, value) => { closePop(); if (popItem) setDate(popItem, key, value) }}
        onSkipSample={(skip) => { closePop(); if (popItem) skipSample(popItem, skip) }}
        onEditDates={() => { const id = pop.id!; closePop(); setOpen(id) }}
        onSetQty={(field, v) => { closePop(); if (popItem) { if (field === 'onsite') setOnsite(popItem, v, 'On site updated'); else setQty(popItem, field, v) } }}
        onOwner={(name) => { closePop(); assign([pop.id!], name) }}
        onNote={(team, body) => { closePop(); void saveNote(pop.id!, team, body) }}
        onFilterOwner={(name) => { closePop(); setOwner(name) }}
        onGroup={(g) => { closePop(); setGroup(g) }}
        onSort={(s) => { closePop(); setSort(s) }}
        activity={activity} people={people} byId={byId} onOpenItem={(id) => { closePop(); setOpen(id) }}
        canRevert={canRevert} onRevert={(l) => { closePop(); setReverting(l) }}/>
    </Popover>}

    <div className="mi-toast" data-on={toast ? '' : undefined} role="status">
      <span>{toast?.message}</span>
      {toast?.undo && <button type="button" onClick={() => void undo()}>Undo</button>}
    </div>
  </div>
}

function MenuButton({ label, value, active, onOpen }: { label: string; value: string; active: boolean; onOpen: (el: HTMLElement) => void }) {
  return <button type="button" className="mi-menu" aria-haspopup="dialog" aria-expanded={active} onClick={(e) => onOpen(e.currentTarget)}>
    <span className="mi-menu-l">{label}</span>{value}<ChevronDown size={12} aria-hidden="true"/>
  </button>
}

function Overview({ scope, derived, today, attn, stage, onAttn, onStage }: { scope: MatItem[]; derived: Map<string, Derived>; today: string; attn: string; stage: string; onAttn: (a: AttentionId) => void; onStage: (s: StageId) => void }) {
  const counts = useMemo(() => {
    const c = Object.fromEntries(STAGES.map((s) => [s.id, 0])) as Record<StageId, number>
    let delivered = 0
    for (const i of scope) { const d = derived.get(i.id)!; c[d.stage]++; delivered += d.qty.total > 0 ? Math.min(1, d.qty.onsite / d.qty.total) : 0 }
    return { stages: c, pct: Math.round(delivered / Math.max(1, scope.length) * 100) }
  }, [scope, derived])
  const attention = useMemo(() => ATTENTION.map((a) => ({ ...a, count: scope.filter((i) => i.data.mark !== 'omit' && a.test(i, today)).length })), [scope, today])
  return <section className="mi-overview" aria-label="Overview">
    {attention.map((a) => <button key={a.id} type="button" className="mi-card" data-attn={a.id} aria-pressed={attn === a.id} onClick={() => onAttn(a.id)}>
      <span className="mi-card-k"><span className="mi-dot" aria-hidden="true"/>{a.label}</span>
      <span className="mi-card-v">{NUM.format(a.count)}</span>
      <span className="mi-card-d">{a.hint}</span>
    </button>)}
    <div className="mi-pipe">
      <div className="mi-pipe-h"><b>Pipeline</b><span>{scope.length ? `${NUM.format(counts.stages.onsite)} of ${NUM.format(scope.length)} fully on site · ${counts.pct}% of quantity delivered` : 'No materials yet'}</span></div>
      <div className="mi-pipe-bar" aria-hidden="true">
        {STAGES.filter((s) => counts.stages[s.id] > 0).map((s) => <i key={s.id} data-stage={s.id} data-dim={(stage && stage !== s.id) || undefined} style={{ flexGrow: counts.stages[s.id] }}/>)}
      </div>
      <div className="mi-pipe-stages">
        {STAGES.map((s) => <button key={s.id} type="button" data-stage={s.id} data-zero={counts.stages[s.id] === 0 || undefined} aria-pressed={stage === s.id} onClick={() => onStage(s.id)}>
          <span className="mi-dot" aria-hidden="true"/>{s.label} <b>{NUM.format(counts.stages[s.id])}</b>
        </button>)}
      </div>
    </div>
  </section>
}

interface Derived { stage: StageId; subStage: SubStage; proc: ProcStage; stones: Stone[]; next: NextStep; qty: Qty; name: string; owner: string; sub: string; search: string; photos: number; photo: string | null; late: boolean }
/**
 * Derived values per row object and day. The store replaces only the rows that change (an edit, a save, a delta load) and
 * keeps every other row object as it was, so keying on the object gives unchanged rows the same Derived object, and their
 * memoized Row and BoardCard skip re-rendering. Without it one stage change re-rendered every row (seconds on 1,000 rows).
 */
const DERIVED = new WeakMap<MatItem, { today: string; d: Derived }>()
function derivedOf(i: MatItem, today: string): Derived {
  const hit = DERIVED.get(i)
  if (hit && hit.today === today) return hit.d
  const next = nextOf(i, today), name = text(i, 'description') || codeOf(i), sub = submissionOf(i), proc = procurementOf(i)
  const d: Derived = {
    stage: stageOf(i), subStage: sub, proc, stones: stonesOf(i, today), next, qty: qtyOf(i), name, owner: text(i, 'pic'),
    sub: [codeOf(i), text(i, 'brand'), text(i, 'location')].filter(Boolean).join(' · '),
    search: `${codeOf(i)} ${name} ${text(i, 'brand')} ${text(i, 'location')} ${text(i, 'spec')}`.toLowerCase(),
    photos: effectiveImages(i, 'image').length + effectiveImages(i, 'sample').length,
    photo: effectiveImages(i, 'image')[0] ?? effectiveImages(i, 'sample')[0] ?? null,
    late: i.data.mark !== 'omit' && next.diff !== null && next.diff < 0,
  }
  DERIVED.set(i, { today, d })
  return d
}
interface RowActions {
  openPop: (type: PopType, id: string | null, anchor: HTMLElement, opts?: PopOpts) => void
  openPanel: (id: string) => void
  openPicture: (picture: MatPicture) => void
}
interface RowCtx {
  today: string
  week: string
  people: Record<string, string>
  activity: MatLog[]
  changed: ReadonlyMap<string, ReadonlySet<string>>
  notes: Map<string, Note[]>
  hasOwner: boolean
  flash: ReadonlySet<string>
  open: string | null
  pop: Pop | null
  derived: Map<string, Derived>
  /** Stable across renders, so memoized rows skip re-rendering when only another row changed. */
  actions: RowActions
  openPop: RowActions['openPop']
  openPanel: (id: string) => void
  /** Whether an activity entry can be reverted (it carries what it replaced, and a note is still this week's). */
  canRevert: (entry: MatLog) => boolean
  askRevert: (entry: MatLog) => void
}

type Entry =
  | { kind: 'head'; key: string; no: string; name: string; title: string; depth: number; count: number; late: number }
  | { kind: 'item'; item: MatItem }

/**
 * The rows the list shows, in order. Grouped by section it follows the Sheet's nesting: every workbook section with
 * materials in it gets a header at its own depth (1 Wall Finishing > 1.1 L23 Club Lounge > 1.1.1 Stone/Marble), and
 * collapsing a section hides everything inside it. Counts and "late" cover a section's sub-sections too.
 */
function listEntries(list: MatItem[], group: Group, tree: SectionTree, derived: Map<string, Derived>, collapsed: ReadonlySet<string>): Entry[] {
  const out: Entry[] = []
  const isLate = (i: MatItem) => derived.get(i.id)!.late
  const flat = (key: string, label: string, rows: MatItem[]) => {
    out.push({ kind: 'head', key, no: '', name: label, title: label, depth: 0, count: rows.length, late: rows.filter(isLate).length })
    if (!collapsed.has(key)) for (const item of rows) out.push({ kind: 'item', item })
  }
  if (group === 'none') { for (const item of list) out.push({ kind: 'item', item }); return out }
  if (group !== 'section') {
    const keyOf = group === 'stage' ? (i: MatItem) => derived.get(i.id)!.stage : (i: MatItem) => derived.get(i.id)!.owner || 'Unassigned'
    const map = new Map<string, MatItem[]>()
    for (const i of list) { const k = keyOf(i); const g = map.get(k) ?? []; g.push(i); map.set(k, g) }
    const order = group === 'stage' ? STAGES.map((s) => s.id).filter((k) => map.has(k)) : [...map.keys()]
    for (const k of order) flat(`${group}:${k}`, group === 'stage' ? STAGE[k as StageId].label : k, map.get(k)!)
    return out
  }
  const direct = new Map<string, MatItem[]>(), count = new Map<string, number>(), late = new Map<string, number>()
  const loose: MatItem[] = []
  for (const i of list) {
    const path = tree.pathOf.get(i.id)
    if (!path) { loose.push(i); continue }
    const leaf = path.at(-1)!.id
    const rows = direct.get(leaf) ?? []
    rows.push(i)
    direct.set(leaf, rows)
    for (const s of path) {
      count.set(s.id, (count.get(s.id) ?? 0) + 1)
      if (isLate(i)) late.set(s.id, (late.get(s.id) ?? 0) + 1)
    }
  }
  const children = new Map<string | null, typeof tree.sections>()
  for (const s of tree.sections) { const c = children.get(s.parent) ?? []; c.push(s); children.set(s.parent, c) }
  if (loose.length) flat('section:none', 'No section', loose)
  const walk = (s: (typeof tree.sections)[number], trail: string) => {
    const n = count.get(s.id)
    if (!n) return
    const key = `section:${s.id}`, title = trail ? `${trail} › ${s.label}` : s.label
    out.push({ kind: 'head', key, no: s.no, name: s.name || (s.no ? '' : 'Section'), title, depth: s.depth, count: n, late: late.get(s.id) ?? 0 })
    if (collapsed.has(key)) return
    for (const item of direct.get(s.id) ?? []) out.push({ kind: 'item', item })
    for (const c of children.get(s.id) ?? []) walk(c, title)
  }
  for (const s of children.get(null) ?? []) walk(s, '')
  return out
}

interface ListHandle { reveal: (id: string) => void }
/** Above this many rows the List mounts only what is on screen (plus a margin), as the Sheet does past its own threshold. */
const LIST_VIRTUAL_THRESHOLD = 120

function ListView({ list, group, tree, collapsed, ctx, handle, onToggleGroup }: {
  list: MatItem[]; group: Group; tree: SectionTree; collapsed: ReadonlySet<string>; ctx: RowCtx
  handle: { current: ListHandle | null }; onToggleGroup: (key: string) => void
}) {
  const { derived } = ctx
  const entries = useMemo(() => listEntries(list, group, tree, derived, collapsed), [list, group, tree, derived, collapsed])
  const columns = 8
  const tableRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const headRef = useRef<HTMLDivElement>(null)
  const virtual = entries.length > LIST_VIRTUAL_THRESHOLD
  // Where the rows start inside the page scroller (below the overview, the toolbar and the column header), how much of the
  // top the sticky toolbar and column header cover, and the toolbar's height (the column header sticks just under it).
  // They move when the overview or toolbar wrap, so they are re-measured on resize.
  const [frame, setFrame] = useState({ margin: 0, cover: 0, toolbar: 0 })
  useLayoutEffect(() => {
    const table = tableRef.current, body = listRef.current, scroller = table?.closest<HTMLElement>('.mi')
    if (!table || !body || !scroller) return
    const measure = () => {
      const toolbar = scroller.querySelector<HTMLElement>('.mi-toolbar')?.offsetHeight ?? 0, head = headRef.current?.offsetHeight ?? 0
      const margin = Math.round(body.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop)
      const cover = toolbar + head
      setFrame((f) => f.margin === margin && f.cover === cover && f.toolbar === toolbar ? f : { margin, cover, toolbar })
    }
    measure()
    const ro = new ResizeObserver(measure)
    for (let el = table.previousElementSibling; el; el = el.previousElementSibling) ro.observe(el)
    ro.observe(table)
    return () => ro.disconnect()
  }, [])
  // The column header sits outside the rows' sideways scroller (so it can stick to the page scroller), and follows it.
  const syncHead = (e: { currentTarget: HTMLDivElement }) => {
    if (headRef.current) headRef.current.style.transform = `translateX(${-e.currentTarget.scrollLeft}px)`
  }
  // oxlint-disable-next-line react/incompatible-library -- React Compiler is not enabled; this virtualizer is not memoized.
  const virtualizer = useVirtualizer({
    count: virtual ? entries.length : 0,
    getScrollElement: () => listRef.current?.closest<HTMLElement>('.mi') ?? null,
    estimateSize: (i) => entries[i]?.kind === 'head' ? (entries[i] as { depth: number }).depth === 0 ? 40 : 34 : 100,
    getItemKey: (i) => { const e = entries[i]!; return e.kind === 'head' ? e.key : e.item.id },
    scrollMargin: frame.margin,
    scrollPaddingStart: frame.cover + 8,
    overscan: 6,
  })
  const shown = virtual ? virtualizer.getVirtualItems() : null
  const padTop = shown?.length ? shown[0]!.start - frame.margin : 0
  const padBottom = shown?.length ? Math.max(0, virtualizer.getTotalSize() - (shown.at(-1)!.end - frame.margin)) : 0
  const measure = virtual ? virtualizer.measureElement : undefined
  const latest = useRef({ entries, virtual, virtualizer })
  useLayoutEffect(() => { latest.current = { entries, virtual, virtualizer } })
  useEffect(() => {
    handle.current = {
      reveal: (id) => {
        const { entries: all, virtual: v, virtualizer: vz } = latest.current
        if (!v) { document.querySelector(`[data-mi-row="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest' }); return }
        const index = all.findIndex((e) => e.kind === 'item' && e.item.id === id)
        if (index >= 0) vz.scrollToIndex(index, { align: 'auto' })
      },
    }
    return () => { handle.current = null }
  }, [handle])
  const rowsOnScreen = shown ? shown.map((v) => ({ e: entries[v.index]!, index: v.index })) : entries.map((e, index) => ({ e, index }))
  return <div ref={tableRef} className="mi-list" role="table" aria-label="Materials"
    aria-rowcount={virtual ? entries.length + 1 : undefined} style={{ ['--mi-stick' as string]: `${frame.toolbar}px` }}>
    <div className="mi-lh-wrap" role="rowgroup">
      <div ref={headRef} className="mi-grid mi-lh" role="row" aria-rowindex={virtual ? 1 : undefined}>
        <span role="columnheader"><span className="sr-only">Photo</span></span><span role="columnheader">Material</span>
        <span role="columnheader">Submission</span><span role="columnheader" className="mi-c-proc">Procurement</span>
        <span role="columnheader" className="mi-c-time">Timeline</span><span role="columnheader" className="mi-c-qty">Quantity</span>
        <span role="columnheader" className="mi-c-note">Purchase notes</span><span role="columnheader" className="mi-c-note" title="Project Management notes">PM notes</span>
      </div>
    </div>
    <div ref={listRef} className="mi-list-body" role="rowgroup" onScroll={syncHead}>
    {padTop > 0 && <div className="mi-vpad" style={{ height: padTop }} aria-hidden="true"/>}
    {rowsOnScreen.map(({ e, index }) => e.kind === 'head'
      // Only the chevron and the section name toggle the section; the rest of the band is not a button (D-69).
      ? <div key={e.key} ref={measure} data-index={virtual ? index : undefined} aria-rowindex={virtual ? index + 2 : undefined}
          role="row" className="mi-gh" data-depth={Math.min(e.depth, 3)}><div role="rowheader" aria-colspan={columns} className="mi-grp" style={{ ['--depth' as string]: e.depth }}>
          <button type="button" className="mi-grp-btn" aria-expanded={!collapsed.has(e.key)} title={e.title} onClick={() => onToggleGroup(e.key)}>
            <ChevronDown className="mi-chev" size={13} aria-hidden="true"/>
            <span className="mi-grp-l">{e.no && <span className="mi-grp-no">{e.no}</span>}{e.name && <span className="mi-grp-name">{e.name}</span>}</span>
          </button>
        </div></div>
      : <Row key={e.item.id} item={e.item} d={derived.get(e.item.id)!} notes={ctx.notes.get(e.item.id)} week={ctx.week} today={ctx.today}
          changed={ctx.changed.has(e.item.id)} sel={ctx.open === e.item.id} flash={ctx.flash.has(e.item.id)}
          popType={ctx.pop?.id === e.item.id ? ctx.pop.type : undefined} popKey={ctx.pop?.id === e.item.id ? ctx.pop.field ?? ctx.pop.team : undefined} actions={ctx.actions}
          index={virtual ? index : undefined} measure={measure}/>)}
    {padBottom > 0 && <div className="mi-vpad" style={{ height: padBottom }} aria-hidden="true"/>}
    </div>
  </div>
}

/** A material photo: the workbook thumbnail or an uploaded one. Falls back to the placeholder icon if it cannot load. */
function Photo({ src: ref }: { src: string }) {
  const src = useMatImageSrc(ref)
  const [failed, setFailed] = useState<string | null>(null)
  if (!src || failed === src) return <ImageIcon size={16} aria-hidden="true"/>
  return <img src={src} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setFailed(src)}/>
}

interface RowProps {
  item: MatItem; d: Derived; notes: Note[] | undefined; week: string; today: string; changed: boolean; sel: boolean; flash: boolean
  /** The open popover on this row, and which quantity or note team it is for. */
  popType: PopType | undefined; popKey: QtyField | Team | undefined; actions: RowActions
  /** Set when the List is virtualized: the entry index the virtualizer measures this row under. */
  index?: number; measure?: (el: HTMLElement | null) => void
}
/** Memoized on plain props: opening a popover on one row re-renders that row, not all of them. */
const Row = memo(function Row({ item, d, notes, week, today, changed, sel, flash, popType, popKey, actions, index, measure }: RowProps) {
  const { subStage: sub, proc, stones, qty: q, name } = d
  const current = currentStone(stones)
  const cell = (type: PopType, opts?: PopOpts) => (e: ReactMouseEvent<HTMLButtonElement>) => { e.stopPropagation(); actions.openPop(type, item.id, e.currentTarget, opts) }
  // oxlint-disable-next-line jsx-a11y/click-events-have-key-events -- A click anywhere on the row is a pointer shortcut; the name button is the keyboard path to the same panel.
  return <div ref={measure} data-index={index} aria-rowindex={index === undefined ? undefined : index + 2} className="mi-grid mi-row" role="row" data-mi-row={item.id} data-sel={sel || undefined}
    data-flash={flash || undefined} data-mark={item.data.mark}
    onClick={(e) => { if (!(e.target as HTMLElement).closest('button,input')) actions.openPanel(item.id) }}>
    <span className="mi-lead" role="cell">
      {d.photo
        ? <button type="button" className="mi-thumb" aria-label={`View photo of ${name}`} onClick={(e) => { e.stopPropagation(); actions.openPicture({ ref: d.photo!, alt: name, itemId: item.id }) }}>
            <Photo src={d.photo}/>{d.photos > 1 && <span className="mi-thumb-n" aria-hidden="true">{d.photos}</span>}
          </button>
        : <span className="mi-thumb" data-empty aria-hidden="true"><ImageIcon size={16}/></span>}
    </span>
    <span className="mi-name" role="cell">
      <button type="button" className="mi-t" title={name} onClick={(e) => { e.stopPropagation(); actions.openPanel(item.id) }}>{name}</button>
      <span className="mi-s">{changed && <span className="mi-chg-tag" title="Changed in the app this week">Changed</span>}<span className="mi-sub" title={d.sub}>{d.sub}</span></span>
    </span>
    <span role="cell"><button type="button" className="mi-cell mi-stage-cell" aria-haspopup="dialog" aria-expanded={popType === 'sub'} aria-label={`Submission: ${stageLabel(sub)}. Change`} onClick={cell('sub')}><StagePill stage={sub}/></button></span>
    <span role="cell" className="mi-c-proc"><button type="button" className="mi-cell mi-stage-cell" aria-haspopup="dialog" aria-expanded={popType === 'proc'} aria-label={`Procurement: ${stageLabel(proc)}. Change`} onClick={cell('proc')}><StagePill stage={proc}/></button></span>
    <span role="cell" className="mi-c-time"><button type="button" className="mi-cell mi-time" aria-haspopup="dialog" aria-expanded={popType === 'next'}
      aria-label={`Timeline: ${stones.filter((m) => m.done).map((m) => m.title).join(', ') || 'nothing done yet'}. ${current ? `Next: ${current.todo}, ${stoneStatus(current, today).text}` : 'Complete'}. Update`}
      title={stones.map((m) => stoneLine(m, today)).join('\n')} onClick={cell('next')}>
      <Track stones={stones}/>
      {/* The step still to do, in its own words ("Place order"), so nothing reads as done before it is (D-69). */}
      {current ? <><span className="mi-time-l" title={`Next: ${current.todo}`}><span className="mi-time-k">Next</span>{current.todo}</span><span className="mi-s"><StoneStatus stone={current} today={today}/></span></>
        : <span className="mi-s"><span className="mi-due" data-tone="done">All on site</span></span>}
    </button></span>
    <span role="cell" className="mi-c-qty"><span className="mi-qstats">
      {QTY_FIELDS.map(([k, short]) => {
        const exact = k === 'total' ? q.totalText ?? NUM.format(q.total) : NUM.format(q[k])
        const shown = k === 'total' && q.totalText ? q.totalText : boxNumber(q[k])
        return <button key={k} type="button" className="mi-qbox" data-k={k} data-some={(k === 'onsite' && q.onsite > 0) || undefined}
          data-text={(k === 'total' && !!q.totalText) || undefined}
          aria-haspopup="dialog" aria-expanded={popType === 'qty' && popKey === k} aria-label={`${QTY_LABEL[k]}: ${exact} ${q.unit}. Change`.replace(/ +\./, '.')}
          title={`${QTY_LABEL[k]}: ${exact} ${q.unit}`.trim()} onClick={cell('qty', { field: k })}>
          <small>{short}</small><b>{shown}{k === 'total' && q.unit && !q.totalText && <i className="mi-qunit">{q.unit}</i>}</b>
        </button>
      })}
    </span></span>
    {(['purchase', 'pm'] as Team[]).map((team) => {
      const own = notes?.filter((n) => n.team === team) ?? []
      return <span key={team} role="cell" className="mi-c-note"><button type="button" className="mi-cell mi-note" aria-haspopup="dialog" aria-expanded={popType === 'note' && popKey === team}
        aria-label={`${TEAM_LABEL[team]} notes: ${own.length ? own.map((n) => `${weekName(n.week, week)}, ${n.body}`).join('. ') : 'none'}. ${own.some((n) => n.week === week) ? 'Edit' : 'Add'} this week's note`}
        onClick={cell('note', { team })}>
        {own.length ? <NoteLines notes={own} week={week}/> : <span className="mi-add">+ Add note</span>}
      </button></span>
    })}
  </div>
})

function BoardView({ list, ctx, onDrop }: { list: MatItem[]; ctx: RowCtx; onDrop: (id: string, to: StageId, card: HTMLElement) => void }) {
  const reduced = useMotionReduced()
  const gx = useMotionValue(0), gy = useMotionValue(0)
  const [drag, setDrag] = useState<{ id: string; w: number } | null>(null)
  const [over, setOver] = useState<StageId | null>(null)
  const { derived } = ctx
  const columns = useMemo(() => {
    const out = Object.fromEntries(STAGES.map((s) => [s.id, [] as MatItem[]])) as Record<StageId, MatItem[]>
    for (const i of list) out[derived.get(i.id)!.stage].push(i)
    return out
  }, [list, derived])
  // The drag in progress (its window listeners) and the settle springs, so a new drag or an unmount can stop them.
  const active = useRef<{ stop: () => void } | null>(null)
  const settle = useRef<AnimationPlaybackControls[]>([])
  const generation = useRef(0)
  useEffect(() => () => { active.current?.stop(); for (const a of settle.current) a.stop() }, [])
  const start = (e: ReactPointerEvent<HTMLDivElement>, id: string) => {
    if (e.button !== 0 || active.current) return
    for (const a of settle.current) a.stop()
    settle.current = []
    const gen = ++generation.current, pointer = e.pointerId
    const card = e.currentTarget, r = card.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top, sx = e.clientX, sy = e.clientY
    let lifted = false, target: StageId | null = null
    // The columns' boxes, read once at lift and again only if something scrolls: hit-testing the page on every pointer
    // move (elementsFromPoint) can force a layout per frame while the ghost is moving.
    let cols: { id: StageId; r: DOMRect }[] = []
    const measureCols = () => { cols = [...document.querySelectorAll<HTMLElement>('[data-mi-col]')].map((el) => ({ id: el.dataset.miCol as StageId, r: el.getBoundingClientRect() })) }
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointer) return
      if (!lifted) { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return; lifted = true; measureCols(); gx.jump(r.left); gy.jump(r.top); setDrag({ id, w: r.width }) }
      gx.set(ev.clientX - ox); gy.set(ev.clientY - oy)
      const col = cols.find((c) => ev.clientX >= c.r.left && ev.clientX <= c.r.right && ev.clientY >= c.r.top && ev.clientY <= c.r.bottom)?.id ?? null
      if (target !== col) { target = col; setOver(target) }
    }
    const stop = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); removeEventListener('scroll', measureCols, true); active.current = null }
    function up(ev: PointerEvent) {
      if (ev.pointerId !== pointer) return
      stop()
      if (!lifted) { if (ev.type === 'pointerup') ctx.actions.openPanel(id); return }
      setOver(null)
      const stageNow = derived.get(id)?.stage
      if (ev.type === 'pointerup' && stageNow && target && target !== stageNow) onDrop(id, target, card)
      // Settle the lifted card onto wherever the row now lives, carrying the release velocity.
      requestAnimationFrame(() => {
        if (gen !== generation.current) return
        const home = document.querySelector<HTMLElement>(`[data-mi-card="${CSS.escape(id)}"]`)?.getBoundingClientRect() ?? r
        const opts = { type: 'spring' as const, duration: reduced ? 0.01 : 0.38, bounce: 0.14 }
        const a = animate(gx, home.left, { ...opts, velocity: gx.getVelocity() }), b = animate(gy, home.top, { ...opts, velocity: gy.getVelocity() })
        settle.current = [a, b]
        void Promise.all([a.finished, b.finished]).then(() => { if (gen === generation.current) setDrag(null) })
      })
    }
    active.current = { stop }
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up); addEventListener('scroll', measureCols, true)
  }
  const dragged = drag ? list.find((i) => i.id === drag.id) : undefined
  // Stable handlers for the memoized columns: hovering a new column during a drag re-renders the two columns whose
  // highlight changed, not all eight with every card in them (which stalled the ghost at each column crossing).
  const startRef = useRef(start)
  useLayoutEffect(() => { startRef.current = start })
  const onStart = useCallback((e: ReactPointerEvent<HTMLDivElement>, id: string) => startRef.current(e, id), [])
  const openPanel = ctx.actions.openPanel
  const ghostStage = drag ? derived.get(drag.id)?.stage : undefined
  return <div className="mi-board">
    {STAGES.map((s) => <BoardColumn key={s.id} stage={s.id} label={s.label} rows={columns[s.id]} over={over === s.id} ghost={ghostStage === s.id ? drag!.id : undefined}
      derived={derived} changed={ctx.changed} today={ctx.today} onStart={onStart} onOpen={openPanel}/>)}
    {drag && dragged && <motion.div className="mi-kc mi-ghost" style={{ x: gx, y: gy, width: drag.w }} aria-hidden="true"><BoardCard item={dragged} d={derived.get(dragged.id)!} changed={ctx.changed.has(dragged.id)} today={ctx.today}/></motion.div>}
  </div>
}
const BoardColumn = memo(function BoardColumn({ stage, label, rows, over, ghost, derived, changed, today, onStart, onOpen }: {
  stage: StageId; label: string; rows: MatItem[]; over: boolean; ghost: string | undefined; derived: Map<string, Derived>
  changed: ReadonlyMap<string, ReadonlySet<string>>; today: string
  onStart: (e: ReactPointerEvent<HTMLDivElement>, id: string) => void; onOpen: (id: string) => void
}) {
  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>, id: string) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(id) } }
  return <section className="mi-col" data-mi-col={stage} data-over={over || undefined} aria-label={`${label}, ${rows.length}`}>
    <h3><StageIcon stage={stage} size={15}/>{label}<span className="mi-col-n">{rows.length}</span></h3>
    {rows.map((item) => <div key={item.id} className="mi-kc" role="button" tabIndex={0} aria-label={`${derived.get(item.id)!.name}. Open details`} data-mi-card={item.id} data-ghosted={ghost === item.id || undefined}
      onPointerDown={(e) => onStart(e, item.id)} onKeyDown={(e) => onKey(e, item.id)}>
      <BoardCard item={item} d={derived.get(item.id)!} changed={changed.has(item.id)} today={today}/>
    </div>)}
  </section>
})
const BoardCard = memo(function BoardCard({ item, d, changed, today }: { item: MatItem; d: Derived; changed: boolean; today: string }) {
  const { qty: q, owner } = d, current = currentStone(d.stones)
  // The material's first photo beside its name, as in the List; the card itself stays the drag handle, so the photo is not a button.
  return <>
    <span className="mi-kc-h">
      <span className="mi-kc-ph" data-empty={!d.photo || undefined} aria-hidden="true">
        {d.photo ? <Photo src={d.photo}/> : <ImageIcon size={15}/>}{d.photos > 1 && <span className="mi-thumb-n">{d.photos}</span>}
      </span>
      <span className="mi-kc-tx">
        <span className="mi-t">{d.name}</span>
        <span className="mi-s">{changed && <span className="mi-chg-tag">Changed</span>}{codeOf(item)} · {NUM.format(q.onsite)}/{q.totalText ?? NUM.format(q.total)} {q.unit}</span>
      </span>
    </span>
    <span className="mi-kc-f">{owner ? <Avatar name={owner}/> : <span/>}<span className="mi-s">{current ? <><span className="mi-kc-step">{current.todo}</span> <StoneStatus stone={current} today={today}/></> : <span className="mi-due" data-tone="done">All on site</span>}</span></span>
  </>
})

/* ---------------- popover: anchored to its trigger, grows from it ---------------- */
const POP_WIDTH: Partial<Record<PopType, number>> = { note: 340, qty: 260, sub: 300, proc: 300, activity: 420, next: 400 }
const POP_LABEL: Record<PopType, string> = {
  sub: 'Change submission stage', proc: 'Change procurement stage', next: 'Timeline', qty: 'Change quantity', owner: 'Change owner', note: 'This week\'s note',
  'filter-owner': 'Filter by owner', group: 'Group by', sort: 'Sort by', activity: 'Recent activity',
}
function Popover({ pop, onClose, children }: { pop: Pop; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number; origin: string } | null>(null)
  const width = POP_WIDTH[pop.type] ?? 250
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    // Placed again when its content grows (the note popover's past notes), so it never runs off the bottom of the screen.
    const place = () => {
      const r = pop.anchor.getBoundingClientRect(), h = el.offsetHeight
      const left = Math.min(Math.max(8, r.left), innerWidth - width - 8)
      const below = r.bottom + 6 + h <= innerHeight - 8 || r.top - h - 6 < 8
      const top = below ? Math.min(r.bottom + 6, Math.max(8, innerHeight - 8 - h)) : r.top - h - 6
      const next = { left, top: Math.max(8, top), origin: `${Math.min(width, Math.max(0, r.left + r.width / 2 - left))}px ${below ? '0' : '100%'}` }
      setPos((cur) => cur && cur.left === next.left && cur.top === next.top && cur.origin === next.origin ? cur : next)
    }
    place()
    const ro = new ResizeObserver(place)
    ro.observe(el)
    return () => ro.disconnect()
  }, [pop, width])
  // Focus moves in once per popover, not again each time it is placed.
  const focusedFor = useRef<Pop | null>(null)
  useEffect(() => {
    if (!pos || focusedFor.current === pop) return
    focusedFor.current = pop
    const first = ref.current?.querySelector<HTMLElement>('[data-autofocus]') ?? ref.current?.querySelector<HTMLElement>('button,input,textarea')
    first?.focus({ preventScroll: true })
  }, [pos, pop])
  useEffect(() => {
    const down = (e: PointerEvent) => { const t = e.target as Node; if (!ref.current?.contains(t) && !pop.anchor.contains(t)) onClose() }
    const scroll = (e: Event) => { if (!ref.current?.contains(e.target as Node)) onClose() }
    // Tabbing out of the popover (to another row's cell, say) closes it, as a click outside does.
    const blur = (e: FocusEvent) => { const t = e.relatedTarget as Node | null; if (t && !ref.current?.contains(t) && !pop.anchor.contains(t)) onClose() }
    const el = ref.current
    addEventListener('pointerdown', down, true); addEventListener('scroll', scroll, true); addEventListener('resize', onClose); el?.addEventListener('focusout', blur)
    return () => { removeEventListener('pointerdown', down, true); removeEventListener('scroll', scroll, true); removeEventListener('resize', onClose); el?.removeEventListener('focusout', blur) }
  }, [pop, onClose])
  useEffect(() => () => { if (document.activeElement === document.body || ref.current?.contains(document.activeElement)) pop.anchor.focus?.({ preventScroll: true }) }, [pop])
  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const opts = [...(ref.current?.querySelectorAll<HTMLElement>('.mi-opt') ?? [])]
    if (!opts.length) return
    e.preventDefault()
    const i = opts.indexOf(document.activeElement as HTMLElement)
    opts[(i + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length]!.focus()
  }
  // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Arrow keys move between the menu options inside this dialog.
  return <div ref={ref} className="mi-pop" role="dialog" aria-label={POP_LABEL[pop.type]} data-on={pos ? '' : undefined} onKeyDown={onKey}
    style={{ width, left: pos?.left ?? -9999, top: pos?.top ?? 0, transformOrigin: pos?.origin }}>{children}</div>
}
function Opt({ on, onClick, children, autoFocus }: { on?: boolean; onClick: () => void; children: ReactNode; autoFocus?: boolean }) {
  return <button type="button" className="mi-opt" onClick={onClick} data-autofocus={autoFocus || undefined} aria-current={on || undefined}>{children}<span className="mi-opt-chk">{on && <Check size={13} aria-hidden="true"/>}</span></button>
}

interface PopBodyProps {
  pop: Pop; item: MatItem | null; today: string; owners: string[]; owner: string; group: Group; sort: Sort; week: string; remarks: Record<string, string>; hasOwner: boolean
  /** The popover's material's notes, every team and week, for the note popover's "Past notes". */
  notes: Note[] | undefined
  onSub: (to: SubStage) => void; onProc: (to: ProcStage) => void; onEditDates: () => void
  onPlan: (key: EditableColKey, value: string) => void; onSkipSample: (skip: boolean) => void
  onSetQty: (field: QtyField, v: number) => void; onOwner: (name: string) => void; onNote: (team: Team, body: string) => void
  onFilterOwner: (name: string) => void; onGroup: (g: Group) => void; onSort: (s: Sort) => void
  activity: MatLog[]; people: Record<string, string>; byId: Map<string, MatItem>; onOpenItem: (id: string) => void
  canRevert: (entry: MatLog) => boolean; onRevert: (entry: MatLog) => void
}
function PopBody(p: PopBodyProps) {
  const { pop, item } = p
  const initialTeam: Team = pop.team ?? 'purchase'
  const [team, setTeam] = useState<Team>(initialTeam)
  const [body, setBody] = useState(() => item ? p.remarks[remarkKey(item.id, initialTeam, p.week)] ?? '' : '')
  const [showPast, setShowPast] = useState(false)
  // Keyed by popover type, row and team (see MatItems), so a draft never carries over to another material or team.
  const switchTeam = (t: Team) => { setTeam(t); if (item) setBody(p.remarks[remarkKey(item.id, t, p.week)] ?? '') }
  if ((pop.type === 'sub' || pop.type === 'proc') && item) {
    const isSub = pop.type === 'sub', current: ChipStage = isSub ? submissionOf(item) : procurementOf(item)
    const ids: readonly ChipStage[] = isSub ? SUB_STAGES : PROC_STAGES
    return <>
      <div className="mi-pop-t">{isSub ? 'Submission' : 'Procurement'}</div>
      {ids.map((id) => <Opt key={id} on={id === current} autoFocus={id === current} onClick={() => isSub ? p.onSub(id as SubStage) : p.onProc(id as ProcStage)}>
        <StageIcon stage={id} size={17}/><span>{stageLabel(id)}<span className="mi-opt-h">{stageHint(id)}</span></span>
      </Opt>)}
      <p className="mi-pad mi-faint mi-small mi-pop-foot">Dates are recorded as today. Change them in the timeline.</p>
    </>
  }
  if (pop.type === 'next' && item) return <TimelinePop key={item.id} item={item} today={p.today} onPlan={p.onPlan} onSub={p.onSub} onSkipSample={p.onSkipSample} onEditDates={p.onEditDates}/>
  if (pop.type === 'qty' && item) {
    const q = qtyOf(item), field = pop.field ?? 'onsite', rem = Math.max(0, q.total - q.onsite)
    return <div className="mi-pad">
      <SetOnsite key={`${item.id}:${field}`} label={QTY_LABEL[field]} value={q[field]} unit={q.unit} onSet={(v) => p.onSetQty(field, v)}/>
      <p className="mi-faint mi-small">{field !== 'onsite' ? `On site ${NUM.format(q.onsite)} · total ${q.totalText ?? NUM.format(q.total)}`
        : q.totalText ? `${NUM.format(q.onsite)} on site · total in the workbook: ${q.totalText}`
        : `${NUM.format(q.onsite)} of ${NUM.format(q.total)} on site · ${NUM.format(rem)} to go`}</p>
    </div>
  }
  if (pop.type === 'owner' && item) {
    const current = text(item, 'pic')
    return <>
      <div className="mi-pop-t">Owner</div>
      {p.owners.map((o) => <Opt key={o} on={o === current} autoFocus={o === current} onClick={() => p.onOwner(o)}><Avatar name={o}/><span>{o}</span></Opt>)}
      {!p.owners.length && <p className="mi-pad mi-faint">No owners on this sheet yet.</p>}
    </>
  }
  if (pop.type === 'note' && item) {
    const save = () => p.onNote(team, body)
    const past = (p.notes ?? []).filter((n) => n.team === team && n.week !== p.week)
    return <div className="mi-pad">
      <div className="mi-seg" role="group" aria-label="Team">
        {(['purchase', 'pm'] as Team[]).map((t) => <button key={t} type="button" aria-pressed={team === t} onClick={() => switchTeam(t)}>{TEAM_LABEL[t]}</button>)}
      </div>
      <textarea className="mi-compose" aria-label={`${TEAM_LABEL[team]} note for this week`} placeholder={`This week's ${TEAM_LABEL[team]} note on ${text(item, 'description') || codeOf(item)}`} value={body} maxLength={2000} data-autofocus
        onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() } }}/>
      <div className="mi-row2">
        <button type="button" className="mi-past-btn" aria-expanded={showPast} aria-controls="mi-past" disabled={!past.length} onClick={() => setShowPast((v) => !v)}>
          <History size={13} aria-hidden="true"/>{past.length ? `Past notes (${past.length})` : 'No past notes'}
          {past.length > 0 && <ChevronDown className="mi-past-chev" size={12} aria-hidden="true"/>}
        </button>
        <span className="mi-spacer"/><button type="button" className="mi-btn" data-primary title="Save (Enter)" onClick={save}>Save</button>
      </div>
      {showPast && past.length > 0 && <ol id="mi-past" className="mi-past" aria-label={`Past ${TEAM_LABEL[team]} notes`}>
        {past.map((n) => <li key={n.week}><div className="mi-wk">{weekName(n.week, p.week)}{n.by ? ` · ${n.by}` : ''}</div><div className="mi-b">{n.body}</div></li>)}
      </ol>}
    </div>
  }
  if (pop.type === 'filter-owner') return <>
    <div className="mi-pop-t">Owner</div>
    <Opt on={!p.owner} autoFocus={!p.owner} onClick={() => p.onFilterOwner('')}><span>Everyone</span></Opt>
    {p.owners.map((o) => <Opt key={o} on={p.owner === o} autoFocus={p.owner === o} onClick={() => p.onFilterOwner(o)}><Avatar name={o}/><span>{o}</span></Opt>)}
  </>
  if (pop.type === 'group') return <><div className="mi-pop-t">Group by</div>{GROUPS.filter(([g]) => p.hasOwner || g !== 'owner').map(([g, l]) => <Opt key={g} on={p.group === g} autoFocus={p.group === g} onClick={() => p.onGroup(g)}><span>{l}</span></Opt>)}</>
  if (pop.type === 'sort') return <><div className="mi-pop-t">Sort by</div>{SORTS.map(([s, l]) => <Opt key={s} on={p.sort === s} autoFocus={p.sort === s} onClick={() => p.onSort(s)}><span>{l}</span></Opt>)}</>
  if (pop.type === 'activity') {
    const recent = p.activity.slice(0, 20)
    return <>
      <div className="mi-pop-t">Recent activity · everyone</div>
      {recent.length ? recent.map((l, i) => {
        const known = l.by ? p.people[l.by] ?? null : null, name = known ?? 'Someone', it = p.byId.get(l.itemId)
        return <div key={l.id} className="mi-act-row">
          <button type="button" className="mi-opt mi-act-opt" data-autofocus={i === 0 || undefined} onClick={() => p.onOpenItem(l.itemId)}>
            <Avatar name={known}/>
            <span className="mi-act-tx"><span><b>{name}</b> {describeLog(l)}</span>
              <span className="mi-opt-h">{it ? text(it, 'description') || codeOf(it) : ''} · {ago(l.at)}</span></span>
          </button>
          {p.canRevert(l) && <UndoButton label={`${name} ${describeLog(l)}`} onClick={() => p.onRevert(l)}/>}
        </div>
      }) : <p className="mi-pad mi-faint">No changes in the last three weeks.</p>}
    </>
  }
  return null
}
function SetOnsite({ label = 'Total on site', value, unit, onSet }: { label?: string; value: number; unit: string; onSet: (v: number) => void }) {
  const [v, setV] = useState(String(value))
  const x = Number(v.replace(/,/g, ''))
  const ok = v.trim() !== '' && Number.isFinite(x) && x >= 0
  const set = () => { if (ok && x !== value) onSet(x) }
  return <form onSubmit={(e) => { e.preventDefault(); set() }}>
    <label className="mi-l" htmlFor="mi-set">{label}{unit ? ` (${unit})` : ''}</label>
    <div className="mi-row2"><input id="mi-set" className="mi-field" inputMode="decimal" value={v} data-autofocus onFocus={(e) => e.currentTarget.select()} onChange={(e) => setV(e.target.value)}/>
      <button type="submit" className="mi-btn" data-primary disabled={!ok || x === value}>Set</button></div>
  </form>
}
/** The four quantities, as the List shows them in a 2×2 grid and as their popover names them (D-69). */
type QtyField = 'total' | 'po' | 'shd' | 'onsite'
const QTY_FIELDS: [QtyField, string][] = [['total', 'Total by BOQ'], ['po', 'Ordered'], ['shd', 'Approved SHD'], ['onsite', 'On site']]
/** Each 2×2 box is about 116 px wide: from 1,000,000 up a value is written compactly (1.28M); the tooltip and popover keep it exact. */
const COMPACT = new Intl.NumberFormat('en-US', { notation: 'compact', maximumSignificantDigits: 3 })
const boxNumber = (v: number) => Math.abs(v) >= 1e6 ? COMPACT.format(v) : NUM.format(v)
const QTY_LABEL: Record<QtyField, string> = { total: 'Total by BOQ', po: 'Ordered', shd: 'Approved SHD', onsite: 'On site' }
/**
 * One team's notes for its List column (D-69, D-71): this week, last week and the week before when written, newest first.
 * No week label: this week's note is in full ink, earlier ones are quieter; the week and author are in the tooltip, and
 * the note popover lists past notes in full.
 */
function NoteLines({ notes, week }: { notes: Note[]; week: string }) {
  return <span className="mi-notes">
    <span className="mi-nl-list">{notes.map((n) => <span key={n.week} className="mi-nl" data-week={n.week === week ? 'now' : undefined}
      title={`${weekName(n.week, week)}${n.by ? ` · ${n.by}` : ''}\n${n.body}`}>{n.body}</span>)}</span>
  </span>
}
/** One-tap dates for "when did this happen": today (the default), yesterday, or any other day from the calendar. */
/**
 * The step's plan date (D-67), written out ("10 Oct 2025", or a red "Not set"); a click opens the calendar. A changed date shows
 * Save and Cancel and is only written then (or with Enter), so a half-typed date never saves. Clearing it and saving removes it.
 */
function PlanDate({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value)
  const ref = useRef<HTMLInputElement>(null)
  const dirty = v !== value, ok = (v === '' || realYear(v)) && dirty
  const save = () => { if (ok) onSave(v) }
  return <form className="mi-plan" onSubmit={(e) => { e.preventDefault(); save() }}>
    <span className="mi-plan-l">Planned for</span>
    <span className="mi-plan-field" data-empty={!v || undefined}>
      <span aria-hidden="true">{v && realYear(v) ? DAY_MONTH_YEAR.format(asDate(v)) : 'Not set'}</span>
      <CalendarDays size={14} aria-hidden="true"/>
      <input ref={ref} type="date" aria-label={label} value={v} onChange={(e) => setV(e.target.value)}
        onClick={() => { try { ref.current?.showPicker() } catch { /* older browsers open it themselves */ } }}/>
    </span>
    {dirty && <span className="mi-plan-act">
      <button type="button" className="mi-sa-btn" onClick={() => setV(value)}>Cancel</button>
      <button type="submit" className="mi-sa-main" disabled={!ok}>Save</button>
    </span>}
  </form>
}

/* ---------------- detail panel: non-modal, slides in from the right and leaves the same way ---------------- */
interface PanelProps {
  item: MatItem | null; ctx: RowCtx; section: SectionInfo[]; week: string; remarks: Record<string, string>
  onClose: () => void; onNav: (dir: number) => void
  onDate: (item: MatItem, key: EditableColKey, value: string) => void
  onQty: (item: MatItem, key: CellKey, value: number) => void
  onSub: (item: MatItem, to: SubStage) => void
  onSkipSample: (item: MatItem, skip: boolean) => void
  onNote: (id: string, team: Team, body: string) => Promise<void>
  onOpenSource: (id: string) => void
}
function Panel(props: PanelProps) {
  const { item, onClose } = props
  const reduced = useMotionReduced()
  const x = useMotionValue(9999)
  const ref = useRef<HTMLElement>(null)
  const [shown, setShown] = useState<MatItem | null>(item)
  const anim = useRef<AnimationPlaybackControls | null>(null)
  const live = useRef(item)
  // The release velocity of a flick that closed the panel, so the exit spring carries it.
  const exitVelocity = useRef<number | null>(null)
  // Where focus was when the panel opened, to return it there when the panel closes.
  const opener = useRef<HTMLElement | null>(null)
  // Declared before the open/close effect, so it already holds this render's item when that effect runs.
  useEffect(() => { live.current = item })
  useEffect(() => () => anim.current?.stop(), [])
  const width = () => (ref.current?.offsetWidth ?? 520) + 24
  const spring = (to: number, velocity = x.getVelocity(), bounce = 0) =>
    animate(x, to, { type: 'spring', duration: reduced ? 0.01 : 0.42, bounce, velocity })
  useEffect(() => {
    if (item) {
      if (!shown) {
        x.jump(width())
        opener.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null
      }
      setShown(item)
      anim.current?.stop(); anim.current = spring(0)
    } else if (shown) {
      if (ref.current?.contains(document.activeElement) && opener.current?.isConnected) opener.current.focus({ preventScroll: true })
      anim.current?.stop(); anim.current = spring(width(), exitVelocity.current ?? x.getVelocity())
      exitVelocity.current = null
      void anim.current.finished.then(() => { if (!live.current) setShown(null) })
    }
  }, [item?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (item) setShown(item) }, [item])
  // Opening from closed moves focus into the panel, so keyboard users land on what they opened.
  const wasShown = useRef(false)
  useEffect(() => {
    if (shown && !wasShown.current) ref.current?.focus({ preventScroll: true })
    wasShown.current = !!shown
  }, [shown])
  // Drag the header to the right to dismiss: 1:1, rubber-band to the left, momentum decides.
  // The running spring keeps going until the pointer has really moved, and a closing panel cannot be grabbed.
  const grab = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !live.current || (e.target as HTMLElement).closest('button,input,textarea,a')) return
    const el = e.currentTarget, sx = e.clientX, pointer = e.pointerId
    let moved = false, base = 0
    el.setPointerCapture(pointer)
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointer) return
      const dx = ev.clientX - sx
      if (!moved) {
        if (Math.abs(dx) < 6) return
        moved = true
        anim.current?.stop()
        base = x.get() - dx
      }
      const raw = base + dx, w = ref.current?.offsetWidth ?? 520
      x.set(raw < 0 ? -(-raw * w * 0.55) / (w + 0.55 * -raw) : raw)
    }
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== pointer) return
      el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up)
      if (!moved) return
      const v = x.getVelocity(), projected = x.get() + (v / 1000) * 0.998 / (1 - 0.998)
      if (projected > (ref.current?.offsetWidth ?? 520) * 0.45) { exitVelocity.current = v; onClose() }
      else { anim.current = spring(0, v, Math.abs(v) > 300 ? 0.15 : 0) }
    }
    el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up)
  }
  if (!shown) return null
  return <motion.aside ref={ref} className="mi-panel" tabIndex={-1} style={{ x }} aria-label={`${text(shown, 'description') || codeOf(shown)} details`}>
    <PanelBody {...props} item={shown} onGrab={grab}/>
  </motion.aside>
}

function PanelBody({ item, ctx, section, week, remarks, onClose, onNav, onDate, onQty, onSub, onSkipSample, onNote, onOpenSource, onGrab }: PanelProps & { item: MatItem; onGrab: (e: ReactPointerEvent<HTMLDivElement>) => void }) {
  const sub = submissionOf(item), proc = procurementOf(item), q = qtyOf(item), owner = text(item, 'pic')
  const [team, setTeam] = useState<Team>('purchase')
  const [draft, setDraft] = useState('')
  const [edge, setEdge] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const thisWeek = remarks[remarkKey(item.id, team, week)] ?? ''
  useEffect(() => { setDraft(thisWeek) }, [item.id, team, thisWeek])
  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0 }, [item.id])
  const thread = (ctx.notes.get(item.id) ?? []).filter((n) => n.team === team && n.week !== week)
  const thisWeekBy = (ctx.notes.get(item.id) ?? []).find((n) => n.team === team && n.week === week)?.by
  const history = ctx.activity.filter((l) => l.itemId === item.id).slice(0, 8)
  const raw = (key: EditableColKey) => { const v = text(item, key); return v && !isIsoDate(effectiveCol(item, key)) ? v : '' }
  const stones = stonesOf(item, ctx.today)
  const pct = (v: number) => q.total > 0 ? Math.round(Math.min(1, v / q.total) * 100) : 0
  // The submitted image and the approved sample are different things: one is what was proposed, the other what the
  // consultant signed off. They are shown as two labelled groups, never mixed in one strip.
  const sets = [
    { key: 'image' as const, title: 'Submission image', hint: 'What was submitted', refs: effectiveImages(item, 'image') },
    { key: 'sample' as const, title: 'Approved sample', hint: 'What the consultant approved', refs: effectiveImages(item, 'sample') },
  ]
  const photos = sets[0]!.refs.length + sets[1]!.refs.length
  const name = text(item, 'description') || codeOf(item)
  const popBtn = (type: PopType) => (e: ReactMouseEvent<HTMLButtonElement>) => ctx.openPop(type, item.id, e.currentTarget)
  return <>
    <div className="mi-ph" onPointerDown={onGrab}>
      <span className="mi-handle" aria-hidden="true"/>
      <div className="mi-ph-top"><span>{codeOf(item)}</span>{section.length > 0 && <><span aria-hidden="true">·</span><span className="mi-ph-sec" title={section.map((x) => x.label).join(' › ')}>{section.at(-1)!.label}</span></>}<span className="mi-spacer"/>
        <button type="button" className="mi-ibtn" aria-label="Previous material" title="Previous (K)" onClick={() => onNav(-1)}><ChevronUp size={15} aria-hidden="true"/></button>
        <button type="button" className="mi-ibtn" aria-label="Next material" title="Next (J)" onClick={() => onNav(1)}><ChevronDown size={15} aria-hidden="true"/></button>
        <button type="button" className="mi-ibtn" aria-label="Close" title="Close (Esc)" onClick={onClose}><X size={15} aria-hidden="true"/></button>
      </div>
      <h2 title={text(item, 'description') || undefined}>{text(item, 'description') || codeOf(item)}</h2>
      <div className="mi-ph-row">
        <button type="button" className="mi-cell mi-inline mi-stage-cell" aria-haspopup="dialog" aria-label={`Submission: ${stageLabel(sub)}. Change`} title="Submission" onClick={popBtn('sub')}><StagePill stage={sub}/></button>
        <button type="button" className="mi-cell mi-inline mi-stage-cell" aria-haspopup="dialog" aria-label={`Procurement: ${stageLabel(proc)}. Change`} title="Procurement" onClick={popBtn('proc')}><StagePill stage={proc}/></button>
      </div>
      {ctx.hasOwner && <div className="mi-ph-owner">
        <button type="button" className="mi-cell mi-inline mi-who" aria-haspopup="dialog" aria-label={`Owner: ${owner || 'none'}. Change`} onClick={popBtn('owner')}>
          {owner ? <><Avatar name={owner}/><span>{owner}</span></> : <span className="mi-faint">Assign owner</span>}<ChevronDown size={11} className="mi-caret" aria-hidden="true"/></button>
      </div>}
      <p className="mi-ph-meta mi-faint mi-small">{item.updatedBy
        ? `Edited by ${ctx.people[item.updatedBy] ?? 'someone'} · ${ago(item.updatedAt)}`
        : ctx.changed.has(item.id) ? 'Changed this week' : `Updated ${shortDate(item.updatedAt.slice(0, 10))}`}</p>
    </div>
    <div className="mi-edge" data-on={edge || undefined}/>
    <div className="mi-pbody" ref={bodyRef} onScroll={(e) => setEdge(e.currentTarget.scrollTop > 2)}>
      {photos > 0 && <div className="mi-sec mi-photos">
        {sets.map((set) => <section key={set.key} className="mi-photo-set" data-set={set.key} aria-label={set.title}>
          <h4><span className="mi-photo-k" data-set={set.key}>{set.title}</span><span className="mi-faint">{set.refs.length ? `${set.refs.length} · ${set.hint}` : 'None yet'}</span></h4>
          {set.refs.length > 0 && <ul className="mi-gallery">
            {set.refs.map((ref, i) => <li key={`${ref}:${i}`}>
              <button type="button" className="mi-gallery-btn" data-set={set.key} aria-label={`View ${set.title.toLowerCase()} ${i + 1} of ${set.refs.length}`}
                onClick={() => ctx.actions.openPicture({ ref, alt: `${name} · ${set.title.toLowerCase()}`, itemId: item.id })}>
                <Photo src={ref}/>
              </button>
            </li>)}
          </ul>}
        </section>)}
      </div>}
      <div className="mi-sec">
        <h4>Timeline<span className="mi-spacer"/><span className="mi-faint">Plan · Actual · Variance</span></h4>
        <ol className="mi-tl">
          {stones.map((s) => {
            const { date: actual, done, late, skipped } = s
            const v = actual && s.plan ? days(actual, s.plan) : null
            const canSkip = !done && (s.key === 'submitted' || s.key === 'sample')
            const toggleSkip = () => s.key === 'submitted' ? onSub(item, skipped ? 'notsub' : 'notreq') : onSkipSample(item, !skipped)
            const shipText = done ? 'Shipped' : proc === 'production' ? 'In production' : proc === 'waiting' ? 'Waiting' : 'From Procurement'
            return <li key={s.key} className="mi-ms" data-state={stoneState(s)}>
              <span className="mi-o" aria-hidden="true">{done && <Check size={9} strokeWidth={3.4}/>}</span>
              <div><div className="mi-t">{s.title}</div>
                <div className="mi-s">{skipped ? <span>Not required</span> : <>Plan {s.planKey
                  ? <DateField label={`${s.title} plan date`} value={s.plan} plain onSave={(val) => onDate(item, s.planKey!, val)}/>
                  : <span className="mi-num">{shortDate(s.plan || null)}</span>}{raw(s.planKey ?? 'msPlan') && s.planKey && !s.plan ? ` (${raw(s.planKey)})` : ''}{s.sub ? ` · ${s.sub}` : ''}{s.note && s.note !== s.sub ? ` · ${s.note}` : ''}</>}{canSkip && <> · <button type="button" className="mi-link mi-skip-btn" onClick={toggleSkip}>{skipped ? 'Require' : 'Skip'}</button></>}</div></div>
              {skipped ? <span className="mi-faint mi-ship">Skipped</span>
                : s.actual ? <DateField label={`${s.title} actual date`} value={actual} onSave={(val) => onDate(item, s.actual!, val)}/>
                : <span className="mi-faint mi-ship" title="Set by the Procurement status">{shipText}</span>}
              <div className="mi-var">{done
                ? v === null ? <span className="mi-faint">Done</span> : v > 0 ? <span className="mi-late">{v}d late</span> : v < 0 ? <span className="mi-early">{-v}d early</span> : <span className="mi-faint">On time</span>
                : skipped ? <span className="mi-faint">Not required</span> : late ? <span className="mi-late">{-days(s.plan, ctx.today)}d overdue</span> : <span className="mi-faint">Pending</span>}</div>
            </li>
          })}
        </ol>
      </div>
      <div className="mi-sec">
        <h4>Quantity{q.unit ? ` · ${q.unit}` : ''}</h4>
        <QtyBar q={q} large/>
        <div className="mi-legend"><span><i data-k="onsite"/>On site {pct(q.onsite)}%</span><span><i data-k="shd"/>Approved SHD {pct(q.shd)}%</span><span><i data-k="po"/>Ordered {pct(q.po)}%</span></div>
        <div className="mi-qgrid">
          {([['total', 'Total by BOQ'], ['po', 'Ordered'], ['shd', 'Approved SHD'], ['onsite', 'On site']] as [CellKey, string][]).map(([k, l]) =>
            <QtyField key={`${item.id}:${k}`} label={l} value={q[k as 'total']} onSave={(v) => onQty(item, k, v)}/>)}
        </div>
      </div>
      <div className="mi-sec">
        <h4>Notes<span className="mi-spacer"/><span className="mi-seg" role="group" aria-label="Team">
          {(['purchase', 'pm'] as Team[]).map((t) => <button key={t} type="button" aria-pressed={team === t} onClick={() => setTeam(t)}>{TEAM_LABEL[t]}</button>)}
        </span></h4>
        <textarea className="mi-compose" aria-label={`${TEAM_LABEL[team]} note for this week`} placeholder={`This week's ${TEAM_LABEL[team]} note…`} value={draft} maxLength={2000}
          onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void onNote(item.id, team, draft) } }}/>
        <div className="mi-cbar"><span className="mi-faint mi-small">One note per team each week · earlier weeks stay as they were</span><span className="mi-spacer"/>
          <button type="button" className="mi-btn" data-primary disabled={draft.trim() === thisWeek.trim()} onClick={() => void onNote(item.id, team, draft)}>Save</button></div>
        <div className="mi-thread">
          {thisWeekBy && draft.trim() === thisWeek.trim() && thisWeek.trim() && <p className="mi-faint mi-small mi-note-by">Written by {thisWeekBy}</p>}
          {thread.length ? thread.map((n) => <div key={n.week} className="mi-msg"><div className="mi-wk">{weekName(n.week, week)}{n.by ? ` · ${n.by}` : ''}</div><div className="mi-b">{n.body}</div></div>)
            : <p className="mi-faint mi-small">No earlier {TEAM_LABEL[team]} notes.</p>}
        </div>
      </div>
      <div className="mi-sec">
        <h4>Activity</h4>
        {history.length ? <ul className="mi-acts">
          {history.map((l) => { const known = l.by ? ctx.people[l.by] ?? null : null, name = known ?? 'Someone'
            return <li key={l.id} className="mi-act"><Avatar name={known}/><span><b>{name}</b> {describeLog(l)}</span><time dateTime={l.at}>{ago(l.at)}</time>
              {ctx.canRevert(l) ? <UndoButton label={`${name} ${describeLog(l)}`} onClick={() => ctx.askRevert(l)}/> : <span/>}</li> })}
        </ul> : <p className="mi-faint mi-small">No changes in the last three weeks.</p>}
      </div>
      <div className="mi-sec">
        <h4>Details</h4>
        <dl className="mi-kv">
          {([['Brand', 'brand'], ['Location', 'location'], ['Specification', 'spec'], ['Submission', 'msStatus'], ['BP02 approval', 'bp02'], ['Source', 'source']] as [string, EditableColKey][])
            .map(([l, k]) => <div key={k}><dt>{l}</dt><dd>{text(item, k) || <span className="mi-faint">—</span>}</dd></div>)}
        </dl>
        <button type="button" className="mi-btn mi-src" onClick={() => onOpenSource(item.id)}><ImageIcon size={14} aria-hidden="true"/>{photos ? `${photos} photo${photos === 1 ? '' : 's'} · edit details` : 'Add photos · edit details'}</button>
      </div>
    </div>
  </>
}

function DateField({ label, value, plain, onSave }: { label: string; value: string; plain?: boolean; onSave: (v: string) => void }) {
  // A formatted date ("10 Nov 2025") that opens the native picker: the input stays the real control for keyboard and screen readers.
  const ref = useRef<HTMLInputElement>(null)
  const shown = value ? (plain ? DAY_MONTH : DAY_MONTH_YEAR).format(asDate(value)) : plain ? 'Set' : 'Add actual date'
  return <span className="mi-date-wrap" data-plain={plain || undefined} data-filled={value && !plain ? '' : undefined}>
    <span className="mi-date-btn" data-empty={!value || undefined} aria-hidden="true"><span>{shown}</span></span>
    <input ref={ref} type="date" className="mi-date" aria-label={label} value={value}
      onClick={() => { try { ref.current?.showPicker() } catch { /* older browsers open it themselves */ } }}
      onChange={(e) => { if (e.target.value !== value) onSave(e.target.value) }}/>
    {value && !plain && <button type="button" className="mi-date-clear" aria-label={`Clear ${label}`} onClick={() => onSave('')}><X size={11} aria-hidden="true"/></button>}
  </span>
}
function QtyField({ label, value, onSave }: { label: string; value: number; onSave: (v: number) => void }) {
  const [v, setV] = useState(NUM.format(value))
  // Saves only what was typed: tabbing through the field never rounds a stored 12.345 to 12.35.
  const [dirty, setDirty] = useState(false)
  useEffect(() => { setV(NUM.format(value)); setDirty(false) }, [value])
  const commit = () => {
    const x = Number(v.replace(/,/g, ''))
    if (dirty && Number.isFinite(x) && x >= 0 && x !== value) onSave(x)
    else setV(NUM.format(value))
    setDirty(false)
  }
  return <label className="mi-qcell"><span className="mi-k">{label}</span>
    <input inputMode="decimal" value={v} onChange={(e) => { setV(e.target.value); setDirty(true) }} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur() } }}/>
  </label>
}

/** An activity entry's undo control: a labelled button, the same word the toast uses after any edit. */
function UndoButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" className="mi-revert" title="Undo this change" aria-label={`Undo: ${label}`} onClick={onClick}>
    <Undo2 size={13} aria-hidden="true"/>Undo
  </button>
}

const CELL_KEYS: ReadonlySet<string> = new Set<string>([...QTY_CELLS, ...PCT_CELLS])
/** A field as the material shows it: dates as "10 Jul 2026", quantities with their unit, photos counted, nothing as "Empty". */
function shownValue(item: MatItem, key: string): string {
  if (key === 'image' || key === 'sample') { const n = effectiveImages(item, key).length; return n ? `${n} photo${n === 1 ? '' : 's'}` : 'No photos' }
  if (CELL_KEYS.has(key)) {
    const v = effective(item)[key as CellKey]
    const out = typeof v === 'number' && QTY_CELLS.includes(key as (typeof QTY_CELLS)[number]) ? NUM.format(v) : formatCell(key as CellKey, v)
    return out.trim() || 'Empty'
  }
  const v = effectiveCol(item, key as ColKey)
  if (isIsoDate(v)) return DAY_MONTH_YEAR.format(asDate(v))
  return formatCol(v).trim() || 'Empty'
}
/** The material as it would be with the entry's `before` overrides put back (null: back to the workbook's own value). */
function withBefore(item: MatItem, before: Record<string, unknown>): MatItem {
  const edits = { ...item.edits } as Record<string, unknown>
  for (const [k, v] of Object.entries(before)) { if (v === null || v === undefined) delete edits[k]; else edits[k] = v }
  return { ...item, edits: edits as MatItem['edits'] }
}

/**
 * Asks before an activity entry is undone (D-71). It shows each field as it is now and as it will be after the undo, side
 * by side, so there is nothing to work out; fields already back where they were are left out. When someone changed the
 * same field again later, it says who, because the undo replaces their value too.
 */
function RevertDialog({ entry, item, people, activity, remarks, onClose, onConfirm }: {
  entry: MatLog | null; item: MatItem | null; people: Record<string, string>; activity: MatLog[]; remarks: Record<string, string>
  onClose: () => void; onConfirm: (entry: MatLog) => void
}) {
  const before = (entry?.before ?? {}) as Record<string, unknown>
  const rows: { key: string; label: string; now: string; after: string }[] = []
  if (entry && item) {
    if (entry.kind === 'remark') {
      const team = before.team as Team, week = String(before.week ?? '')
      const now = (remarks[remarkKey(item.id, team, week)] ?? '').trim(), after = String(before.body ?? '').trim()
      rows.push({ key: 'body', label: `${TEAM_LABEL[team] ?? 'Team'} note`, now: now || 'No note', after: after || 'No note' })
    } else {
      const restored = withBefore(item, before)
      for (const k of Object.keys(before)) {
        const label = FIELD_NAMES[k] ?? k
        rows.push({ key: k, label: label.charAt(0).toUpperCase() + label.slice(1), now: shownValue(item, k), after: shownValue(restored, k) })
      }
    }
  }
  const changes = rows.filter((r) => r.now !== r.after)
  const later = entry ? activity.filter((l) => l.itemId === entry.itemId && l.at > entry.at
    && (entry.kind === 'remark' ? l.kind === 'remark' && l.detail.team === before.team : l.kind === 'fields' && Object.keys(l.detail).some((k) => k in before))) : []
  const laterNames = [...new Set(later.map((l) => l.by ? people[l.by] ?? 'Someone' : 'Someone'))]
  const who = entry?.by ? people[entry.by] ?? 'Someone' : 'Someone'
  return <Dialog.Root open={!!entry} onOpenChange={(o) => { if (!o) onClose() }}>
    <Dialog.Portal>
      <Dialog.Overlay className="mi-confirm-scrim"/>
      <Dialog.Content className="mi-confirm" aria-describedby="mi-confirm-d">
        <Dialog.Title className="mi-confirm-t">Undo this change?</Dialog.Title>
        {entry && <div id="mi-confirm-d">
          <p className="mi-confirm-what"><b>{who}</b> {describeLog(entry)} <span className="mi-faint">· {ago(entry.at)}</span></p>
          <p className="mi-confirm-item">{item ? text(item, 'description') || codeOf(item) : ''}</p>
          {changes.length ? <table className="mi-confirm-table">
            <thead><tr><th scope="col"><span className="sr-only">Field</span></th><th scope="col">Now</th><th scope="col" aria-hidden="true"/><th scope="col">After undo</th></tr></thead>
            <tbody>{changes.map((r) => <tr key={r.key}>
              <th scope="row">{r.label}</th><td className="mi-confirm-now">{r.now}</td>
              <td className="mi-confirm-arrow" aria-hidden="true"><ArrowRight size={13}/></td><td className="mi-confirm-after">{r.after}</td>
            </tr>)}</tbody>
          </table> : <p className="mi-confirm-none">Nothing to undo: every field already has the value it had before this change.</p>}
          {changes.length > 0 && later.length > 0 && <p className="mi-confirm-warn">
            {laterNames.join(', ')} changed {keysWord(changes.length)} again afterwards. Undo replaces that newer value too.</p>}
        </div>}
        <div className="mi-confirm-actions">
          <Dialog.Close className="mi-btn">Cancel</Dialog.Close>
          <button type="button" className="mi-btn" data-primary data-autofocus disabled={!changes.length} onClick={() => entry && onConfirm(entry)}>Undo change</button>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}
const keysWord = (n: number) => n === 1 ? 'this field' : 'these fields'

/**
 * The timeline popover (D-67, D-69): the six steps as the panel shows them, read from the Submission and Procurement status.
 * Steps with a plan column open to their plan date; unreached submission and sample steps can also be marked not required so
 * a material can skip straight to ordering.
 */
function TimelinePop({ item, today, onPlan, onSub, onSkipSample, onEditDates }: {
  item: MatItem; today: string; onPlan: (key: EditableColKey, value: string) => void
  onSub: (to: SubStage) => void; onSkipSample: (skip: boolean) => void; onEditDates: () => void
}) {
  const stones = stonesOf(item, today), current = currentStone(stones)
  const [openKey, setOpenKey] = useState(() => current?.planKey ? current.key : null)
  return <>
    <div className="mi-pop-t">Timeline</div>
    <p className="mi-tlp-hint">Follows the Submission and Procurement status. Change plan dates or skip submission/sample here.</p>
    <ol className="mi-tlp">
      {stones.map((s) => {
        const status = stoneStatus(s, today), open = !!s.planKey && openKey === s.key
        const canSkip = !s.done && (s.key === 'submitted' || s.key === 'sample')
        const body = <>
          <span className="mi-o" aria-hidden="true">{s.done && <Check size={9} strokeWidth={3.4}/>}</span>
          <span className="mi-tlp-t">{s.title}{s.key === current?.key && <span className="mi-tlp-now">Now</span>}</span>
          <span className="mi-due" data-tone={status.tone}>{status.text}</span>
        </>
        return <li key={s.key} data-state={stoneState(s)} data-open={open || undefined}>
          {s.planKey
            ? <button type="button" className="mi-tlp-row" aria-expanded={open} data-autofocus={open || undefined} title="Change the plan date"
                onClick={() => setOpenKey(open ? null : s.key)}>{body}</button>
            : <div className="mi-tlp-row" title={s.key === 'approved' ? 'Expected 14 days after the submission' : 'Set by the Procurement status'}>{body}</div>}
          {open && <div className="mi-tlp-act">
            {!s.skipped && <PlanDate key={`${item.id}:${s.planKey}`} label={`${s.title} plan date`} value={s.plan} onSave={(v) => onPlan(s.planKey!, v)}/>}
            {canSkip && <div className="mi-tlp-skip">
              <span className="mi-faint mi-small">{s.key === 'submitted'
                ? s.skipped ? 'Submission skipped — can order directly.' : 'No submission needed for this material?'
                : s.skipped ? 'Sample marked not required.' : 'No sample approval needed?'}</span>
              <button type="button" className="mi-sa-btn" onClick={() => s.key === 'submitted' ? onSub(s.skipped ? 'notsub' : 'notreq') : onSkipSample(!s.skipped)}>
                {s.key === 'submitted' ? (s.skipped ? 'Require submission' : 'Skip submission') : (s.skipped ? 'Require sample' : 'Skip sample')}
              </button>
            </div>}
          </div>}
        </li>
      })}
    </ol>
    <div className="mi-sep"/>
    <div className="mi-step-links"><button type="button" className="mi-link" onClick={onEditDates}>All dates…</button></div>
  </>
}
