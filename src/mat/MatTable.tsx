import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { UIEvent } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import * as Dialog from '@radix-ui/react-dialog'
import { ChevronDown, Pencil, X } from 'lucide-react'
import { ChangedDot } from '@/components/ChangedDot'
import { addDays } from '@/nbc/submissions'
import { previousCellValue } from './changes'
import {
  codeOf,
  computeSheetAverages,
  effective,
  effectiveCol,
  effectiveImages,
  formatCell,
  formatCol,
  isOverride,
} from './formulas'
import { useMatImageSrc } from './images'
import { DateTextCell, NumberCell, RemarkCell, StatusCell, TextCell } from './MatCells'
import type { CellFailure, CellMove, OnCell, OnRemark } from './MatCells'
import type { MatPicture } from './MatSourcePanel'
import { remarkKey } from './store'
import { MARK_LABELS, PCT_CELLS } from './types'
import type { CellKey, ColKey, EditableColKey, MatItem, Team } from './types'



export type ColumnView = 'all' | 'details' | 'submission' | 'procurement' | 'remarks'
export const COLUMN_VIEWS: { id: ColumnView; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'details', label: 'Details' },
  { id: 'submission', label: 'Submission' },
  { id: 'procurement', label: 'Procurement' },
  { id: 'remarks', label: 'Remarks & %' },
]

type ViewTag = Exclude<ColumnView, 'all'>
type EditMode = 'date' | 'status' | 'text' | 'longtext'
type RemarkWeek = 'before' | 'last' | 'now'

type Column = { key: string; label: string; width: number; group?: string; view?: ViewTag } & (
  | { type: 'col'; col: ColKey; long?: boolean; source?: boolean; edit?: EditMode }
  | { type: 'pictures'; set: 'image' | 'sample' }
  | { type: 'cell'; cell: CellKey }
  | { type: 'remark'; team: Team; week: RemarkWeek })

const DATE = 112, NUM = 76, REMARK = 220, REMARK_HISTORY = 190
const col = (
  key: ColKey,
  label: string,
  width: number,
  group?: string,
  options?: { long?: boolean; source?: boolean; edit?: EditMode; view?: ViewTag },
): Column => ({ type: 'col', key, col: key, label, width, group, ...options })
const cell = (key: CellKey, label: string, group: string, view: ViewTag): Column =>
  ({ type: 'cell', key, cell: key, label, width: NUM, group, view })
const remark = (team: Team, week: RemarkWeek, group: string): Column =>
  ({ type: 'remark', key: `${team}-${week}`, team, week, group, view: group === PROC ? 'procurement' : 'remarks',
    label: group === PROC
      ? week === 'now' ? 'Remarks' : week === 'last' ? 'Last week' : '2 weeks ago'
      : week === 'now' ? 'This week' : 'Last week',
    width: week === 'now' ? REMARK : REMARK_HISTORY })

const MS = 'Material Submission', SS = 'Sample Submission', PROC = 'Procurement', QTY = 'Quantity', PCT = 'Percentage'
const PM = 'PM Remarks'
/** The workbook's columns, left to right. The first three stay frozen while scrolling sideways. */
const COLUMNS: Column[] = [
  col('no', 'No', 48, undefined, { source: true }),
  col('code', 'Code', 96, undefined, { source: true }),
  col('description', 'Description', 240, undefined, { long: true, source: true }),
  col('pic', 'Person In Charge', 120, undefined, { source: true, view: 'details' }),
  col('bp02', 'BP02 Mat Approval', 104, undefined, { source: true, view: 'details' }),
  col('location', 'Location', 140, undefined, { source: true, view: 'details' }),
  { type: 'pictures', key: 'image', set: 'image', label: 'Image', width: 84, view: 'details' },
  { type: 'pictures', key: 'sample', set: 'sample', label: 'Approved Sample', width: 84, view: 'details' },
  col('spec', 'Specification', 220, undefined, { long: true, source: true, view: 'details' }),
  col('brand', 'Brand', 120, undefined, { source: true, view: 'details' }),
  col('source', 'Source Location', 120, undefined, { source: true, view: 'details' }),
  col('msPlan', 'Plan Submit', DATE, MS, { edit: 'date', view: 'submission' }),
  col('msActual', 'Actual Submit', DATE, MS, { edit: 'date', view: 'submission' }),
  col('msApproved', 'Approved Date', DATE, MS, { edit: 'date', view: 'submission' }),
  col('msStatus', 'Status', 168, MS, { edit: 'status', view: 'submission' }),
  col('ssPlan', 'Plan Submit', DATE, SS, { edit: 'date', view: 'submission' }),
  col('ssActual', 'Actual Submit', DATE, SS, { edit: 'date', view: 'submission' }),
  col('ssApproved', 'Approved Date', DATE, SS, { edit: 'date', view: 'submission' }),
  col('poPlan', 'Plan Place Order', DATE, PROC, { edit: 'date', view: 'procurement' }),
  col('poActual', 'Actual Place Order', DATE, PROC, { edit: 'date', view: 'procurement' }),
  col('arrPlan', 'Plan Arrived', DATE, PROC, { edit: 'date', view: 'procurement' }),
  col('arrActual', 'Actual Arrived', DATE, PROC, { edit: 'date', view: 'procurement' }),
  remark('purchase', 'before', PROC), remark('purchase', 'last', PROC), remark('purchase', 'now', PROC),
  col('unit', 'Unit', 72, QTY, { edit: 'text', view: 'procurement' }),
  cell('total', 'Total by QS', QTY, 'procurement'),
  cell('po', 'PO by Purchase', QTY, 'procurement'),
  cell('shd', 'Approved SHD', QTY, 'procurement'),
  cell('onsite', 'On site', QTY, 'procurement'),
  cell('remaining', 'Remaining', QTY, 'procurement'),
  remark('pm', 'last', PM), remark('pm', 'now', PM),
  cell('notYetPo', 'Not Yet PO', PCT, 'remarks'),
  cell('placed', 'Placed Order', PCT, 'remarks'),
  cell('production', 'Production In Progress', PCT, 'remarks'),
  cell('waiting', 'Waiting For Shipment', PCT, 'remarks'),
  cell('shipping', 'Shipping On The Way', PCT, 'remarks'),
  cell('arrived', 'Arrived WH & Site', PCT, 'remarks'),
  col('lastUpdated', 'Last Updated', DATE, undefined, { view: 'remarks' }),
]
const FROZEN = 3
const WORK_GROUPS = new Set([PM])
const ROW_HEIGHT = 36
const VIRTUAL_THRESHOLD = 40
const PCT_SET: ReadonlySet<string> = new Set(PCT_CELLS)
const pctTone = (key: CellKey, val: number | string | null | undefined) => {
  if (!PCT_SET.has(key) || typeof val !== 'number') return {}
  return {
    'data-done': key !== 'notYetPo' && val >= 0.99995 ? 'true' : undefined,
  }
}

const isEditableCol = (c: Column) => (c.type === 'col' && !!c.edit) || c.type === 'cell' || (c.type === 'remark' && c.week === 'now')

interface ViewConfig {
  columns: readonly Column[]
  groups: readonly { group?: string; columns: Column[] }[]
  width: number
  hasPct: boolean
  colSpanMiddle: number
  colSpanAfter: number
  editableKeys: readonly string[]
  colSet: ReadonlySet<string>
}

function buildViewConfig(view: ColumnView, omit?: ReadonlySet<string>): ViewConfig {
  const columns = (view === 'all' ? COLUMNS : COLUMNS.filter((c) => !c.view || c.view === view))
    .filter((c) => !omit?.has(c.key))
  const groups = columns.reduce<{ group?: string; columns: Column[] }[]>((runs, c) => {
    const last = runs.at(-1)
    if (c.group && last?.group === c.group) last.columns.push(c)
    else runs.push({ group: c.group, columns: [c] })
    return runs
  }, [])
  const width = columns.reduce((sum, c) => sum + c.width, 0)
  const pctStart = columns.findIndex((c) => c.type === 'cell' && c.group === PCT)
  const hasPct = pctStart !== -1
  const colSpanMiddle = hasPct ? pctStart - FROZEN : columns.length - FROZEN
  const colSpanAfter = hasPct ? columns.length - pctStart - PCT_CELLS.length : 0
  return {
    columns,
    groups,
    width,
    hasPct,
    colSpanMiddle,
    colSpanAfter,
    editableKeys: columns.filter(isEditableCol).map((c) => c.key),
    colSet: new Set(columns.map((c) => c.key)),
  }
}

/** A section's name is the first five columns joined. */
const sectionLabel = (item: MatItem) =>
  (['no', 'pic', 'bp02', 'code', 'description'] as const).map((k) => formatCol(item.data.cols[k])).filter(Boolean).join(' ') || 'Section'

/** The last pos a section covers: `data.end`, else the row before the next section. */
function sectionEnd(rows: MatItem[], section: MatItem, fromIndex = 0) {
  if (section.data.end !== undefined) return section.data.end
  for (let i = fromIndex + 1; i < rows.length; i++) {
    const r = rows[i]!
    if (r.kind === 'section' && r.pos > section.pos) return r.pos - 1
  }
  return Infinity
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

const hasPosInRange = (sortedPos: number[], startExclusive: number, endInclusive: number) =>
  upperBound(sortedPos, endInclusive) > upperBound(sortedPos, startExclusive)

type Averages = Record<string, number | null>

function MatImg({ srcRef, alt }: { srcRef: string; alt: string }) {
  const src = useMatImageSrc(srcRef)
  if (!src) return <span className="mat-img-loading" aria-hidden="true"/>
  return <img loading="lazy" src={src} alt={alt}/>
}

export function MatPictureDialog({
  picture,
  onClose,
  onEditPhotos,
}: {
  picture: MatPicture | null
  onClose: () => void
  onEditPhotos?: (itemId: string) => void
}) {
  return picture ? <PictureDialogBody picture={picture} onClose={onClose} onEditPhotos={onEditPhotos}/> : null
}

function PictureDialogBody({
  picture,
  onClose,
  onEditPhotos,
}: {
  picture: MatPicture
  onClose: () => void
  onEditPhotos?: (itemId: string) => void
}) {
  const src = useMatImageSrc(picture.ref)
  return <Dialog.Root open onOpenChange={(open) => { if (!open) onClose() }}>
    <Dialog.Portal>
      <Dialog.Overlay className="mat-scrim mat-picture-scrim"/>
      <Dialog.Content className="mat-picture" aria-describedby={undefined}>
        <div className="mat-picture-head">
          <Dialog.Title className="mat-picture-title">{picture.alt}</Dialog.Title>
          {picture.itemId && onEditPhotos &&
            <button type="button" className="btn-secondary mat-picture-edit" onClick={() => onEditPhotos(picture.itemId!)}>
              <Pencil size={12} aria-hidden="true"/>Edit photos
            </button>}
        </div>
        {src ? <img src={src} alt={picture.alt}/> : <p className="small muted">Loading image…</p>}
        <Dialog.Close className="mat-picture-close" aria-label="Close picture"><X size={16} aria-hidden="true"/></Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}

interface ItemRowProps {
  item: MatItem
  columns: readonly Column[]
  remarks: Record<string, string>
  /** Column keys of this item changed this week: those cells get the accent outline. */
  changedCols?: ReadonlySet<string>
  activeCol: string | null
  /** A key typed on the idle cell that opened the active editor. */
  activeSeed?: string
  rowFailures?: ReadonlyMap<string, CellFailure>
  dataIndex?: number
  measureRef?: (el: HTMLTableRowElement | null) => void
  onCell: OnCell
  onRemark: OnRemark
  onPicture: (picture: MatPicture) => void
  onOpenSource?: (id: string) => void
  onActivate: (itemId: string, colKey: string) => void
  onCloseCell: (itemId: string, colKey: string, move?: CellMove) => void
  onFailCell: (itemId: string, colKey: string, failure: CellFailure) => void
  onClearFailCell: (itemId: string, colKey: string) => void
  onTabCell: (itemId: string, colKey: string, shift: boolean) => void
}

const ItemRow = memo(function ItemRow({
  item,
  columns,
  remarks,
  changedCols,
  activeCol,
  activeSeed,
  rowFailures,
  dataIndex,
  measureRef,
  onCell,
  onRemark,
  onPicture,
  onOpenSource,
  onActivate,
  onCloseCell,
  onFailCell,
  onClearFailCell,
  onTabCell,
}: ItemRowProps) {
  const values = effective(item)
  const code = codeOf(item)
  const { cols, cells, notes } = item.data
  return <tr ref={measureRef} data-index={dataIndex} data-item={item.id} data-mark={item.data.mark}>
    {columns.map((c, index) => {
      const frozen = index < FROZEN ? `mat-f mat-f${index + 1}` : undefined
      const failure = rowFailures?.get(c.key)
      const isActive = activeCol === c.key
      const changed = changedCols?.has(c.key) ? 'true' : undefined
      const changedDot = changed ? <ChangedDot previous={previousCellValue(item, c.key)}/> : null
      const seed = isActive ? activeSeed : undefined

      if (c.type === 'col') {
        const raw = effectiveCol(item, c.col)
        const text = formatCol(raw)
        const title = notes?.[c.col] ?? (c.long && text ? text : undefined)
        if (c.col === 'code') {
          const mark = item.data.mark
          return <th key={c.key} scope="row" className={frozen} title={notes?.code ?? (text || undefined)} data-changed={changed}>
            {onOpenSource
              ? <button type="button" className="mat-source-btn"
                  aria-label={text ? `${text} — Edit material source` : `Edit material source for ${code}`}
                  onClick={() => onOpenSource(item.id)}>
                  <span className="mat-source-main">
                    {mark && <span className="mat-mark-dot" data-mark={mark} title={MARK_LABELS[mark]} aria-hidden="true"/>}
                    <span className="mat-source-code">{text || 'Edit'}</span>
                  </span>
                  <Pencil size={12} className="mat-source-icon" aria-hidden="true"/>
                </button>
              : text}
            {changedDot}
          </th>
        }
        if (c.edit) {
          const label = `${code} ${c.group ? `${c.group} ` : ''}${c.label}`
          const editCol = c.col as EditableColKey
          const sourceRaw = cols[c.col] ?? null
          const callbacks = {
            initialDraft: failure?.draft,
            seed,
            onClose: (move?: CellMove) => onCloseCell(item.id, c.key, move),
            onFail: (f: CellFailure) => onFailCell(item.id, c.key, f),
            onClearFail: () => onClearFailCell(item.id, c.key),
            onTab: (shift: boolean) => onTabCell(item.id, c.key, shift),
          }
          if (isActive) {
            return <td key={c.key} className="mat-edit" data-active="true">
              {c.edit === 'date'
                ? <DateTextCell id={item.id} col={editCol} label={label} raw={raw} sourceRaw={sourceRaw} onCell={onCell} {...callbacks}/>
                : c.edit === 'status'
                  ? <StatusCell id={item.id} label={label} raw={raw} sourceRaw={sourceRaw} onCell={onCell} {...callbacks}/>
                  : <TextCell id={item.id} col={editCol} label={label} raw={raw} sourceRaw={sourceRaw} long={c.edit === 'longtext'} onCell={onCell} {...callbacks}/>}
            </td>
          }
          const shown = failure ? failure.draft : text
          const display = c.edit === 'status' ? shown.replace(/\s+/g, ' ').trim() : shown
          const btnClass = c.edit === 'status'
            ? 'mat-cell-btn mat-cell-status'
            : c.edit === 'longtext'
              ? 'mat-cell-btn mat-cell-remark'
              : 'mat-cell-btn mat-cell-text'
          return <td key={c.key} className="mat-edit" data-changed={changed}>
            <button type="button" className={btnClass} aria-label={label} data-cell={c.key}
              title={failure?.message ?? (display || undefined)}
              data-invalid={failure ? 'true' : undefined}
              onClick={() => onActivate(item.id, c.key)}>
              {c.edit === 'longtext'
                ? <span className="mat-clamp">{display}</span>
                : <span className="mat-cell-ellipsis">{display}</span>}
            </button>
            {failure && <button type="button" className="mat-retry" aria-label={`Retry ${label}`} title={failure.message} onClick={failure.retry}>Retry</button>}
            {changedDot}
          </td>
        }
        return <td key={c.key} className={frozen} data-changed={changed}
          onDoubleClick={c.source && onOpenSource ? () => onOpenSource(item.id) : undefined}>
          <div className="mat-clamp" title={title}>{text}</div>
          {changedDot}
        </td>
      }

      if (c.type === 'pictures') {
        const list = effectiveImages(item, c.set)
        return <td key={c.key} className="mat-pic-cell" data-changed={changed}>
          <div className="mat-pictures">
            {list.map((ref, i) => {
              const alt = `${code} ${c.label} ${i + 1}`
              return <button key={`${ref}-${i}`} type="button" className="mat-thumb"
                onClick={() => onPicture({ ref, alt, itemId: item.id })}>
                <MatImg srcRef={ref} alt={alt}/>
              </button>
            })}
          </div>
          {changedDot}
        </td>
      }

      if (c.type === 'cell') {
        const source = cells[c.cell]
        const label = `${code} ${c.label}`
        const override = isOverride(item, c.cell)
        const calculated = !!source && 'f' in source
        if (isActive) {
          return <td key={c.key} className="mat-edit" data-active="true">
            <NumberCell id={item.id} cell={c.cell} label={label} value={values[c.cell]} override={override}
              calculated={calculated} note={notes?.[c.cell]} onCell={onCell}
              initialDraft={failure?.draft} seed={seed}
              onClose={(move) => onCloseCell(item.id, c.key, move)}
              onFail={(f) => onFailCell(item.id, c.key, f)}
              onClearFail={() => onClearFailCell(item.id, c.key)}
              onTab={(shift) => onTabCell(item.id, c.key, shift)}/>
          </td>
        }
        const shown = failure ? failure.draft : formatCell(c.cell, values[c.cell])
        const dataSource = override ? 'override' : calculated ? 'formula' : 'value'
        const tone = failure ? {} : pctTone(c.cell, values[c.cell])
        return <td key={c.key} className="mat-edit" data-changed={changed}>
          <button type="button" className="mat-cell-btn mat-cell-num" data-source={dataSource} data-cell={c.key} {...tone}
            aria-label={label} title={failure?.message ?? notes?.[c.cell]}
            data-invalid={failure ? 'true' : undefined}
            onClick={() => onActivate(item.id, c.key)}>
            {shown}
          </button>
          {failure && <button type="button" className="mat-retry" aria-label={`Retry ${label}`} title={failure.message} onClick={failure.retry}>Retry</button>}
          {changedDot}
        </td>
      }

      const body = remarks[`${c.team}-${c.week}`] ?? ''
      const label = `${code} ${c.group} ${c.label}`
      if (c.week !== 'now') {
        return <td key={c.key} className="mat-last"><div className="mat-clamp" title={body || undefined}>{body}</div></td>
      }
      if (isActive) {
        return <td key={c.key} className="mat-edit" data-active="true">
          <RemarkCell id={item.id} team={c.team} label={label} body={body} onRemark={onRemark}
            initialDraft={failure?.draft} seed={seed}
            onClose={(move) => onCloseCell(item.id, c.key, move)}
            onFail={(f) => onFailCell(item.id, c.key, f)}
            onClearFail={() => onClearFailCell(item.id, c.key)}/>
        </td>
      }
      const shown = failure ? failure.draft : body
      return <td key={c.key} className="mat-edit" data-changed={changed}>
        <button type="button" className="mat-cell-btn mat-cell-remark" aria-label={label} data-cell={c.key}
          title={failure?.message ?? (shown || undefined)}
          data-invalid={failure ? 'true' : undefined}
          onClick={() => onActivate(item.id, c.key)}>
          <span className="mat-clamp">{shown}</span>
        </button>
        {failure && <button type="button" className="mat-retry" aria-label={`Retry ${label}`} title={failure.message} onClick={failure.retry}>Retry</button>}
        {changedDot}
      </td>
    })}
  </tr>
}, (a, b) => a.item === b.item && a.columns === b.columns && a.changedCols === b.changedCols
  && a.activeCol === b.activeCol && a.activeSeed === b.activeSeed
  && a.rowFailures === b.rowFailures && a.dataIndex === b.dataIndex
  && a.onCell === b.onCell && a.onRemark === b.onRemark && a.onPicture === b.onPicture && a.onOpenSource === b.onOpenSource
  && a.onActivate === b.onActivate && a.onCloseCell === b.onCloseCell && a.onFailCell === b.onFailCell
  && a.onClearFailCell === b.onClearFailCell && a.onTabCell === b.onTabCell
  && a.remarks['pm-before'] === b.remarks['pm-before'] && a.remarks['pm-last'] === b.remarks['pm-last'] && a.remarks['pm-now'] === b.remarks['pm-now']
  && a.remarks['purchase-before'] === b.remarks['purchase-before'] && a.remarks['purchase-last'] === b.remarks['purchase-last']
  && a.remarks['purchase-now'] === b.remarks['purchase-now'])

interface SummaryRowProps {
  id?: string
  label: string
  values: Averages
  level?: number
  open?: boolean
  hasPct: boolean
  colSpanMiddle: number
  colSpanAfter: number
  dataIndex?: number
  measureRef?: (el: HTMLTableRowElement | null) => void
  onToggle?: (id: string) => void
}

/** A section band (with its collapse button) or the sheet-average row: the label, then the percentage averages. */
const SummaryRow = memo(function SummaryRow({
  id,
  label,
  values,
  level = 0,
  open,
  hasPct,
  colSpanMiddle,
  colSpanAfter,
  dataIndex,
  measureRef,
  onToggle,
}: SummaryRowProps) {
  return <tr ref={measureRef} data-index={dataIndex} className={onToggle ? 'mat-section' : 'mat-total'} data-level={onToggle ? level : undefined}>
    <th scope="row" colSpan={FROZEN} className="mat-f mat-f-span">
      <div className="mat-section-label" style={onToggle ? { paddingInlineStart: level * 12 } : undefined}>
        {onToggle && id && <button type="button" className="mat-toggle" aria-expanded={open} aria-label={`${open ? 'Collapse' : 'Expand'} ${label}`} onClick={() => onToggle(id)}>
          <ChevronDown size={12} aria-hidden="true"/>
        </button>}
        <span className="mat-clamp">{label}</span>
      </div>
    </th>
    {colSpanMiddle > 0 && <td colSpan={colSpanMiddle} aria-hidden="true"/>}
    {hasPct && PCT_CELLS.map((c) => <td key={c} className="mat-avg" {...pctTone(c, values[c])}>{formatCell(c, values[c] ?? null)}</td>)}
    {colSpanAfter > 0 && <td colSpan={colSpanAfter} aria-hidden="true"/>}
  </tr>
}, (a, b) => a.id === b.id && a.label === b.label && a.level === b.level && a.open === b.open
  && a.hasPct === b.hasPct && a.colSpanMiddle === b.colSpanMiddle && a.colSpanAfter === b.colSpanAfter
  && a.dataIndex === b.dataIndex && a.onToggle === b.onToggle
  && (!a.hasPct || PCT_CELLS.every((c) => a.values[c] === b.values[c])))

export interface MatTableProps {
  /** Every row of one sheet, in order: sections and items. */
  items: MatItem[]
  week: string
  remarks: Record<string, string>
  view?: ColumnView
  /** Column keys this sheet leaves out (MEP keeps no Person In Charge). */
  omit?: ReadonlySet<string>
  /** Columns changed since Sunday, by item id: each of those cells gets an accent outline. */
  changed?: ReadonlyMap<string, ReadonlySet<string>>
  onCell: OnCell
  onRemark: OnRemark
  /** Items to keep while a search or filter is on; a section stays while any of its items is kept. */
  match?: ((item: MatItem) => boolean) | null
  caption: string
  collapsed?: ReadonlySet<string>
  onToggle?: (id: string) => void
  onOpenSource?: (id: string) => void
  onPicture?: (picture: MatPicture) => void
}

export const MatTable = memo(function MatTable({
  items,
  week,
  remarks,
  view = 'all',
  omit,
  changed,
  onCell,
  onRemark,
  match = null,
  caption,
  collapsed: controlledCollapsed,
  onToggle: controlledToggle,
  onOpenSource,
  onPicture: controlledPicture,
}: MatTableProps) {
  const [localCollapsed, setLocalCollapsed] = useState<ReadonlySet<string>>(() => new Set())
  const [localPicture, setLocalPicture] = useState<MatPicture | null>(null)
  const [activeCell, setActiveCell] = useState<{ itemId: string; colKey: string; seed?: string } | null>(null)
  const [failures, setFailures] = useState<ReadonlyMap<string, CellFailure>>(() => new Map())
  const scrollRef = useRef<HTMLDivElement>(null)
  // The idle cell to focus once the editor that closed has unmounted.
  const focusNext = useRef<{ itemId: string; colKey: string } | null>(null)

  const collapsed = controlledCollapsed ?? localCollapsed
  const localToggle = useCallback((id: string) => setLocalCollapsed((old) => {
    const next = new Set(old)
    if (!next.delete(id)) next.add(id)
    return next
  }), [])
  const toggle = controlledToggle ?? localToggle
  const openPicture = controlledPicture ?? setLocalPicture
  const viewConfig = useMemo(() => buildViewConfig(view, omit), [view, omit])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = 0
    setActiveCell((cur) => (cur && !viewConfig.colSet.has(cur.colKey) ? null : cur))
  }, [view, viewConfig])

  const onActivate = useCallback((itemId: string, colKey: string) => {
    setActiveCell({ itemId, colKey })
  }, [])
  const onFailCell = useCallback((itemId: string, colKey: string, failure: CellFailure) => {
    const key = `${itemId}\0${colKey}`
    setFailures((old) => {
      const next = new Map(old)
      next.set(key, failure)
      return next
    })
  }, [])
  const onClearFailCell = useCallback((itemId: string, colKey: string) => {
    const key = `${itemId}\0${colKey}`
    setFailures((old) => {
      if (!old.has(key)) return old
      const next = new Map(old)
      next.delete(key)
      return next
    })
  }, [])
  const onTabCell = useCallback((itemId: string, colKey: string, shift: boolean) => {
    const idx = viewConfig.editableKeys.indexOf(colKey)
    const nextKey = idx >= 0 ? viewConfig.editableKeys[idx + (shift ? -1 : 1)] : undefined
    if (!nextKey) focusNext.current = { itemId, colKey }
    setActiveCell(nextKey ? { itemId, colKey: nextKey } : null)
  }, [viewConfig.editableKeys])

  const failuresByItem = useMemo(() => {
    const byItem = new Map<string, Map<string, CellFailure>>()
    for (const [k, f] of failures) {
      const sep = k.indexOf('\0')
      const itemId = k.slice(0, sep)
      const colKey = k.slice(sep + 1)
      let map = byItem.get(itemId)
      if (!map) { map = new Map(); byItem.set(itemId, map) }
      map.set(colKey, f)
    }
    return byItem
  }, [failures])

  const sums = useMemo(() => computeSheetAverages(items), [items])

  const rows = useMemo(() => {
    let matchedPos: number[] | null = null
    if (match) {
      matchedPos = []
      for (const r of items) {
        if (r.kind === 'item' && match(r)) matchedPos.push(r.pos)
      }
      for (let i = 1; i < matchedPos.length; i++) {
        if (matchedPos[i]! < matchedPos[i - 1]!) { matchedPos.sort((a, b) => a - b); break }
      }
    }
    const shown: MatItem[] = []
    let hiddenTo = -Infinity
    for (let i = 0; i < items.length; i++) {
      const row = items[i]!
      if (row.pos <= hiddenTo) continue
      if (row.kind === 'item') {
        if (match && !match(row)) continue
      } else if (row.kind === 'section' && matchedPos) {
        const end = sectionEnd(items, row, i)
        if (!hasPosInRange(matchedPos, row.pos, end)) continue
      }
      shown.push(row)
      if (row.kind === 'section' && collapsed.has(row.id)) hiddenTo = sectionEnd(items, row, i)
    }
    return shown
  }, [items, match, collapsed])

  const virtual = rows.length > VIRTUAL_THRESHOLD
  // oxlint-disable-next-line react/incompatible-library -- React Compiler is not enabled; this virtualizer is not memoized.
  const virtualizer = useVirtualizer({
    count: virtual ? rows.length : 0,
    getScrollElement: () => scrollRef.current,
    getItemKey: (index) => rows[index]!.id,
    estimateSize: () => ROW_HEIGHT,
    measureElement: (el) => el.getBoundingClientRect().height || ROW_HEIGHT,
    overscan: 10,
    initialRect: { width: 1200, height: 800 },
    useFlushSync: false,
  })
  const virtualItems = virtual ? virtualizer.getVirtualItems() : null
  const padTop = virtualItems && virtualItems.length > 0 ? virtualItems[0]!.start : 0
  const padBottom = virtualItems && virtualItems.length > 0 ? Math.max(0, virtualizer.getTotalSize() - virtualItems.at(-1)!.end) : 0
  const visibleRows = virtualItems ? virtualItems.map((v) => ({ row: rows[v.index]!, index: v.index })) : rows.map((row, index) => ({ row, index }))
  const measureRef = virtual ? virtualizer.measureElement : undefined

  // Spreadsheet keys. Enter in an editor saves and moves down a row, Shift+Enter up, Escape stays;
  // on an idle cell the arrows move between editable cells and typing starts editing it.
  const rowsRef = useRef(rows)
  rowsRef.current = rows
  const virtualRef = useRef({ virtual, virtualizer })
  virtualRef.current = { virtual, virtualizer }
  const focusCell = useCallback((itemId: string, colKey: string) => {
    const find = () => scrollRef.current?.querySelector<HTMLElement>(
      `tr[data-item="${CSS.escape(itemId)}"] [data-cell="${CSS.escape(colKey)}"]`)
    const el = find()
    if (el) { el.focus(); return }
    const { virtual: isVirtual, virtualizer: v } = virtualRef.current
    const index = rowsRef.current.findIndex((r) => r.id === itemId)
    if (!isVirtual || index < 0) return
    v.scrollToIndex(index, { align: 'auto' })
    requestAnimationFrame(() => requestAnimationFrame(() => find()?.focus()))
  }, [])
  const neighbour = useCallback((itemId: string, step: 1 | -1) => {
    const list = rowsRef.current
    for (let i = list.findIndex((r) => r.id === itemId) + step; i >= 0 && i < list.length; i += step) {
      if (list[i]!.kind === 'item') return list[i]!.id
    }
    return null
  }, [])
  const onCloseCell = useCallback((itemId: string, colKey: string, move?: CellMove) => {
    if (move) {
      const target = move === 'stay' ? itemId : neighbour(itemId, move === 'down' ? 1 : -1) ?? itemId
      focusNext.current = { itemId: target, colKey }
    }
    setActiveCell((cur) => (cur && cur.itemId === itemId && cur.colKey === colKey ? null : cur))
  }, [neighbour])
  useEffect(() => {
    const next = focusNext.current
    if (activeCell || !next) return
    focusNext.current = null
    focusCell(next.itemId, next.colKey)
  }, [activeCell, focusCell])

  const onGridKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement
    const colKey = target.dataset.cell
    const itemId = colKey ? target.closest<HTMLElement>('tr[data-item]')?.dataset.item : undefined
    if (!colKey || !itemId || e.altKey || e.ctrlKey || e.metaKey) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const next = neighbour(itemId, e.key === 'ArrowDown' ? 1 : -1)
      e.preventDefault()
      if (next) focusCell(next, colKey)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const keys = viewConfig.editableKeys
      const next = keys[keys.indexOf(colKey) + (e.key === 'ArrowRight' ? 1 : -1)]
      e.preventDefault()
      if (next) focusCell(itemId, next)
    } else if (e.key === 'F2') {
      e.preventDefault()
      setActiveCell({ itemId, colKey })
    } else if (e.key.length === 1 && e.key !== ' ' && !failures.has(`${itemId}\0${colKey}`)) {
      e.preventDefault()
      setActiveCell({ itemId, colKey, seed: e.key })
    }
  }
  // A native listener: the scroll box is not itself a control, only a place keys from its cells pass through.
  const gridKeys = useRef(onGridKeyDown)
  gridKeys.current = onGridKeyDown
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onKey = (e: KeyboardEvent) => gridKeys.current(e)
    el.addEventListener('keydown', onKey)
    return () => el.removeEventListener('keydown', onKey)
  }, [])

  const last = addDays(week, -7)
  const before = addDays(week, -14)
  const remarkOf = (id: string, team: Team, wk: string) => remarks[remarkKey(id, team, wk)] ?? ''

  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget, scrolled = el.scrollLeft > 0
    if (scrolled !== ('scrolled' in el.dataset)) {
      if (scrolled) el.dataset.scrolled = ''
      else delete el.dataset.scrolled
    }
  }

  return <div className="mat-scroll" ref={scrollRef} onScroll={onScroll}>
    <table className="mat-table" style={{ width: viewConfig.width }}>
      <caption className="sr-only">{caption}</caption>
      {viewConfig.groups.map((run, i) => <colgroup key={i}>{run.columns.map((c) => <col key={c.key} style={{ width: c.width }}/>)}</colgroup>)}
      <thead>
        <tr className="mat-head-1">
          {viewConfig.groups.flatMap((run) => run.group
            ? [<th key={run.group} scope="colgroup" colSpan={run.columns.length} data-band={WORK_GROUPS.has(run.group) ? 'work' : 'group'}>{run.group}</th>]
            : run.columns.map((c) => {
              const index = viewConfig.columns.indexOf(c)
              return <th key={c.key} scope="col" rowSpan={2} className={index < FROZEN ? `mat-f mat-f${index + 1}` : undefined}>{c.label}</th>
            }))}
        </tr>
        <tr className="mat-head-2">
          {viewConfig.columns.filter((c) => c.group).map((c) => <th key={c.key} scope="col" data-band={WORK_GROUPS.has(c.group!) ? 'work' : 'group'}
            className={c.type === 'cell' ? 'mat-num-head' : undefined}>{c.label}</th>)}
        </tr>
      </thead>
      <tbody>
        <SummaryRow label="Sheet average" values={sums.sheet}
          hasPct={viewConfig.hasPct} colSpanMiddle={viewConfig.colSpanMiddle} colSpanAfter={viewConfig.colSpanAfter}/>
        {padTop > 0 && <tr className="mat-spacer" aria-hidden="true"><td aria-hidden="true" colSpan={viewConfig.columns.length} style={{ height: padTop }}/></tr>}
        {visibleRows.map(({ row, index }) => row.kind === 'section'
          ? <SummaryRow key={row.id} id={row.id} label={sectionLabel(row)} values={sums.byId.get(row.id)!} level={row.data.level ?? 0}
              open={!collapsed.has(row.id)} onToggle={toggle}
              hasPct={viewConfig.hasPct} colSpanMiddle={viewConfig.colSpanMiddle} colSpanAfter={viewConfig.colSpanAfter}
              dataIndex={virtual ? index : undefined} measureRef={measureRef}/>
          : <ItemRow key={row.id} item={row} columns={viewConfig.columns}
              activeCol={activeCell?.itemId === row.id ? activeCell.colKey : null}
              activeSeed={activeCell?.itemId === row.id ? activeCell.seed : undefined}
              changedCols={changed?.get(row.id)}
              rowFailures={failuresByItem.get(row.id)}
              dataIndex={virtual ? index : undefined} measureRef={measureRef}
              onCell={onCell} onRemark={onRemark} onPicture={openPicture} onOpenSource={onOpenSource}
              onActivate={onActivate} onCloseCell={onCloseCell} onFailCell={onFailCell} onClearFailCell={onClearFailCell} onTabCell={onTabCell}
              remarks={{
                'pm-before': remarkOf(row.id, 'pm', before), 'pm-last': remarkOf(row.id, 'pm', last), 'pm-now': remarkOf(row.id, 'pm', week),
                'purchase-before': remarkOf(row.id, 'purchase', before), 'purchase-last': remarkOf(row.id, 'purchase', last),
                'purchase-now': remarkOf(row.id, 'purchase', week),
              }}/>)}
        {padBottom > 0 && <tr className="mat-spacer" aria-hidden="true"><td aria-hidden="true" colSpan={viewConfig.columns.length} style={{ height: padBottom }}/></tr>}
      </tbody>
    </table>
    {!controlledPicture && <MatPictureDialog picture={localPicture} onClose={() => setLocalPicture(null)} onEditPhotos={onOpenSource ? (id) => { setLocalPicture(null); onOpenSource(id) } : undefined}/>}
  </div>
})
