import { memo, useCallback, useMemo, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { ChevronDown, ChevronRight, Pencil, X } from 'lucide-react'
import { addDays } from '@/nbc/submissions'
import {
  average,
  codeOf,
  effective,
  effectiveCol,
  effectiveImages,
  formatCell,
  formatCol,
  isOverride,
  sectionItems,
} from './formulas'
import { useMatImageSrc } from './images'
import { DateTextCell, NumberCell, RemarkCell, StatusCell, TextCell } from './MatCells'
import type { OnCell, OnRemark } from './MatCells'
import type { MatPicture } from './MatSourcePanel'
import { remarkKey } from './store'
import type { MatState } from './store'
import { PCT_CELLS } from './types'
import type { CellKey, ColKey, EditableColKey, MatItem, Team } from './types'

export { codeOf, formatCol } from './formulas'

type EditMode = 'date' | 'status' | 'text' | 'longtext'

type Column = { key: string; label: string; width: number; group?: string } & (
  | { type: 'col'; col: ColKey; long?: boolean; source?: boolean; edit?: EditMode }
  | { type: 'pictures'; set: 'image' | 'sample' }
  | { type: 'cell'; cell: CellKey }
  | { type: 'remark'; team: Team; now: boolean })

const DATE = 112, NUM = 76, REMARK = 220
const col = (
  key: ColKey,
  label: string,
  width: number,
  group?: string,
  options?: { long?: boolean; source?: boolean; edit?: EditMode },
): Column => ({ type: 'col', key, col: key, label, width, group, ...options })
const cell = (key: CellKey, label: string, group: string): Column => ({ type: 'cell', key, cell: key, label, width: NUM, group })
const remark = (team: Team, now: boolean, group: string): Column => ({ type: 'remark', key: `${team}-${now ? 'now' : 'last'}`, team, now, label: now ? 'This week' : 'Last week', width: REMARK, group })

const MS = 'Material Submission', SS = 'Sample Submission', PROC = 'Procurement', QTY = 'Quantity', PCT = 'Percentage'
const PM = 'PM Remarks', BUY = 'Purchase Remarks'
/** The workbook's columns, left to right. The first three stay frozen while scrolling sideways. */
export const COLUMNS: Column[] = [
  col('no', 'No', 48, undefined, { source: true }),
  col('code', 'Code', 96, undefined, { source: true }),
  col('description', 'Description', 240, undefined, { long: true, source: true }),
  col('pic', 'Person In Charge', 120, undefined, { source: true }),
  col('bp02', 'BP02 Mat Approval', 104, undefined, { source: true }),
  col('location', 'Location', 140, undefined, { source: true }),
  { type: 'pictures', key: 'image', set: 'image', label: 'Image', width: 84 },
  { type: 'pictures', key: 'sample', set: 'sample', label: 'Approved Sample', width: 84 },
  col('spec', 'Specification', 220, undefined, { long: true, source: true }),
  col('brand', 'Brand', 120, undefined, { source: true }),
  col('source', 'Source Location', 120, undefined, { source: true }),
  col('msPlan', 'Plan Submit', DATE, MS, { edit: 'date' }),
  col('msActual', 'Actual Submit', DATE, MS, { edit: 'date' }),
  col('msApproved', 'Approved Date', DATE, MS, { edit: 'date' }),
  col('msStatus', 'Status', 168, MS, { edit: 'status' }),
  col('ssPlan', 'Plan Submit', DATE, SS, { edit: 'date' }),
  col('ssActual', 'Actual Submit', DATE, SS, { edit: 'date' }),
  col('ssApproved', 'Approved Date', DATE, SS, { edit: 'date' }),
  col('poPlan', 'Plan Place Order', DATE, PROC, { edit: 'date' }),
  col('poActual', 'Actual Place Order', DATE, PROC, { edit: 'date' }),
  col('arrPlan', 'Plan Arrived', DATE, PROC, { edit: 'date' }),
  col('arrActual', 'Actual Arrived', DATE, PROC, { edit: 'date' }),
  col('procRemarks', 'Remarks', REMARK, PROC, { long: true, edit: 'longtext' }),
  col('unit', 'Unit', 72, QTY, { edit: 'text' }),
  cell('total', 'Total by QS', QTY), cell('po', 'PO by Purchase', QTY), cell('shd', 'Approved SHD', QTY),
  cell('onsite', 'On site', QTY), cell('remaining', 'Remaining', QTY),
  remark('purchase', false, BUY), remark('purchase', true, BUY), remark('pm', false, PM), remark('pm', true, PM),
  cell('notYetPo', 'Not Yet PO', PCT), cell('placed', 'Placed Order', PCT), cell('production', 'Production In Progress', PCT),
  cell('waiting', 'Waiting For Shipment', PCT), cell('shipping', 'Shipping On The Way', PCT), cell('arrived', 'Arrived WH & Site', PCT),
  col('lastUpdated', 'Last Updated', DATE),
]
const FROZEN = 3
const TABLE_WIDTH = COLUMNS.reduce((sum, c) => sum + c.width, 0)
/** Columns between the frozen ones and the percentages: one empty span on section rows. */
const MIDDLE = COLUMNS.findIndex((c) => c.type === 'cell' && c.group === PCT) - FROZEN
const AFTER = COLUMNS.length - FROZEN - MIDDLE - PCT_CELLS.length
const WORK_GROUPS = new Set([PM, BUY])

/** Consecutive columns of one group, for the colgroups and the first header row. */
const GROUPS = COLUMNS.reduce<{ group?: string; columns: Column[] }[]>((runs, c) => {
  const last = runs.at(-1)
  if (c.group && last?.group === c.group) last.columns.push(c)
  else runs.push({ group: c.group, columns: [c] })
  return runs
}, [])

/** A section's name is the first five columns joined. */
export const sectionLabel = (item: MatItem) =>
  (['no', 'pic', 'bp02', 'code', 'description'] as const).map((k) => formatCol(item.data.cols[k])).filter(Boolean).join(' ') || 'Section'

/** The last pos a section covers: `data.end`, else the row before the next section. */
function sectionEnd(rows: MatItem[], section: MatItem) {
  if (section.data.end !== undefined) return section.data.end
  const next = rows.find((r) => r.kind === 'section' && r.pos > section.pos)
  return next ? next.pos - 1 : Infinity
}

type Averages = Record<string, number | null>
const averages = (items: MatItem[]): Averages => Object.fromEntries(PCT_CELLS.map((c) => [c, average(items, c)]))

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
  remarks: Record<`${Team}-${'last' | 'now'}`, string>
  onCell: OnCell
  onRemark: OnRemark
  onPicture: (picture: MatPicture) => void
  onOpenSource?: (id: string) => void
}

const ItemRow = memo(function ItemRow({ item, remarks, onCell, onRemark, onPicture, onOpenSource }: ItemRowProps) {
  const values = useMemo(() => effective(item), [item])
  const code = codeOf(item)
  const { cols, cells, notes } = item.data
  return <tr data-mark={item.data.mark}>
    {COLUMNS.map((c, index) => {
      const frozen = index < FROZEN ? `mat-f mat-f${index + 1}` : undefined
      if (c.type === 'col') {
        const raw = effectiveCol(item, c.col)
        const text = formatCol(raw)
        const title = notes?.[c.col] ?? (c.long && text ? text : undefined)
        if (c.col === 'code') {
          return <th key={c.key} scope="row" className={frozen} title={notes?.code ?? (text || undefined)}>
            {onOpenSource
              ? <button type="button" className="mat-source-btn"
                  aria-label={text ? `${text} — Edit material source` : `Edit material source for ${code}`}
                  onClick={() => onOpenSource(item.id)}>
                  <span className="mat-source-code">{text || 'Edit'}</span>
                  <Pencil size={12} className="mat-source-icon" aria-hidden="true"/>
                </button>
              : text}
          </th>
        }
        if (c.edit) {
          const label = `${code} ${c.group ? `${c.group} ` : ''}${c.label}`
          const editCol = c.col as EditableColKey
          const sourceRaw = cols[c.col] ?? null
          if (c.edit === 'date') {
            return <td key={c.key} className="mat-edit">
              <DateTextCell id={item.id} col={editCol} label={label} raw={raw} sourceRaw={sourceRaw} onCell={onCell}/>
            </td>
          }
          if (c.edit === 'status') {
            return <td key={c.key} className="mat-edit">
              <StatusCell id={item.id} label={label} raw={raw} sourceRaw={sourceRaw} onCell={onCell}/>
            </td>
          }
          return <td key={c.key} className="mat-edit">
            <TextCell id={item.id} col={editCol} label={label} raw={raw} sourceRaw={sourceRaw} long={c.edit === 'longtext'} onCell={onCell}/>
          </td>
        }
        return <td key={c.key} className={frozen} onDoubleClick={c.source && onOpenSource ? () => onOpenSource(item.id) : undefined}>
          <div className="mat-clamp" title={title}>{text}</div>
        </td>
      }
      if (c.type === 'pictures') {
        const list = effectiveImages(item, c.set)
        return <td key={c.key}>
          <div className="mat-pictures">
            {list.map((ref, i) => {
              const alt = `${code} ${c.label} ${i + 1}`
              return <button key={`${ref}-${i}`} type="button" className="mat-thumb"
                onClick={() => onPicture({ ref, alt, itemId: item.id })}>
                <MatImg srcRef={ref} alt={alt}/>
              </button>
            })}
            {onOpenSource && <button type="button" className="mat-pic-edit" aria-label={`Edit ${code} ${c.label}`}
              title={`Edit ${c.label}`} onClick={() => onOpenSource(item.id)}>
              <Pencil size={11} aria-hidden="true"/>
            </button>}
          </div>
        </td>
      }
      if (c.type === 'cell') {
        const source = cells[c.cell]
        return <td key={c.key} className="mat-edit">
          <NumberCell id={item.id} cell={c.cell} label={`${code} ${c.label}`} value={values[c.cell]} override={isOverride(item, c.cell)}
            calculated={!!source && 'f' in source} note={notes?.[c.cell]} onCell={onCell}/>
        </td>
      }
      const body = remarks[`${c.team}-${c.now ? 'now' : 'last'}`]
      const label = `${code} ${c.group} ${c.label}`
      return c.now
        ? <td key={c.key} className="mat-edit"><RemarkCell id={item.id} team={c.team} label={label} body={body} onRemark={onRemark}/></td>
        : <td key={c.key} className="mat-last"><div className="mat-clamp" title={body || undefined}>{body}</div></td>
    })}
  </tr>
}, (a, b) => a.item === b.item && a.onCell === b.onCell && a.onRemark === b.onRemark && a.onPicture === b.onPicture && a.onOpenSource === b.onOpenSource
  && a.remarks['pm-last'] === b.remarks['pm-last'] && a.remarks['pm-now'] === b.remarks['pm-now']
  && a.remarks['purchase-last'] === b.remarks['purchase-last'] && a.remarks['purchase-now'] === b.remarks['purchase-now'])

interface SummaryRowProps { id?: string; label: string; values: Averages; level?: number; open?: boolean; onToggle?: (id: string) => void }

/** A section band (with its collapse button) or the sheet-average row: the label, then the percentage averages. */
const SummaryRow = memo(function SummaryRow({ id, label, values, level = 0, open, onToggle }: SummaryRowProps) {
  return <tr className={onToggle ? 'mat-section' : 'mat-total'} data-level={onToggle ? level : undefined}>
    <th scope="row" colSpan={FROZEN} className="mat-f mat-f-span">
      <div className="mat-section-label" style={onToggle ? { paddingInlineStart: level * 12 } : undefined}>
        {onToggle && id && <button type="button" className="mat-toggle" aria-expanded={open} aria-label={`${open ? 'Collapse' : 'Expand'} ${label}`} onClick={() => onToggle(id)}>
          {open ? <ChevronDown size={14} aria-hidden="true"/> : <ChevronRight size={14} aria-hidden="true"/>}
        </button>}
        <span className="mat-clamp">{label}</span>
      </div>
    </th>
    <td colSpan={MIDDLE} aria-hidden="true"/>
    {PCT_CELLS.map((c) => <td key={c} className="mat-avg">{formatCell(c, values[c] ?? null)}</td>)}
    <td colSpan={AFTER} aria-hidden="true"/>
  </tr>
})

export interface MatTableProps {
  /** Every row of one sheet, in order: sections and items. */
  items: MatItem[]
  state: MatState
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

export function MatTable({
  items,
  state,
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
  const collapsed = controlledCollapsed ?? localCollapsed
  const localToggle = useCallback((id: string) => setLocalCollapsed((old) => {
    const next = new Set(old)
    if (!next.delete(id)) next.add(id)
    return next
  }), [])
  const toggle = controlledToggle ?? localToggle
  const openPicture = controlledPicture ?? setLocalPicture
  // Averages follow the workbook's SUBTOTAL rows: all of a section's items, whatever is filtered.
  const sums = useMemo(() => {
    const byId = new Map<string, Averages>()
    for (const row of items) if (row.kind === 'section') byId.set(row.id, averages(sectionItems(items, row)))
    return { sheet: averages(items.filter((row) => row.kind === 'item')), byId }
  }, [items])
  const rows = useMemo(() => {
    const shown: MatItem[] = []
    let hiddenTo = -Infinity
    for (const row of items) {
      if (row.pos <= hiddenTo) continue
      if (row.kind === 'item' && match && !match(row)) continue
      if (row.kind === 'section' && match && !sectionItems(items, row).some(match)) continue
      shown.push(row)
      if (row.kind === 'section' && collapsed.has(row.id)) hiddenTo = sectionEnd(items, row)
    }
    return shown
  }, [items, match, collapsed])
  const last = addDays(state.week, -7)
  const remarkOf = (id: string, team: Team, week: string) => state.remarks[remarkKey(id, team, week)] ?? ''

  return <div className="mat-scroll">
    <table className="mat-table" style={{ width: TABLE_WIDTH }}>
      <caption className="sr-only">{caption}</caption>
      {GROUPS.map((run, i) => <colgroup key={i}>{run.columns.map((c) => <col key={c.key} style={{ width: c.width }}/>)}</colgroup>)}
      <thead>
        <tr className="mat-head-1">
          {GROUPS.flatMap((run) => run.group
            ? [<th key={run.group} scope="colgroup" colSpan={run.columns.length} data-band={WORK_GROUPS.has(run.group) ? 'work' : 'group'}>{run.group}</th>]
            : run.columns.map((c) => {
              const index = COLUMNS.indexOf(c)
              return <th key={c.key} scope="col" rowSpan={2} className={index < FROZEN ? `mat-f mat-f${index + 1}` : undefined}>{c.label}</th>
            }))}
        </tr>
        <tr className="mat-head-2">
          {COLUMNS.filter((c) => c.group).map((c) => <th key={c.key} scope="col" data-band={WORK_GROUPS.has(c.group!) ? 'work' : 'group'}
            className={c.type === 'cell' ? 'mat-num-head' : undefined}>{c.label}</th>)}
        </tr>
      </thead>
      <tbody>
        <SummaryRow label="Sheet average" values={sums.sheet}/>
        {rows.map((row) => row.kind === 'section'
          ? <SummaryRow key={row.id} id={row.id} label={sectionLabel(row)} values={sums.byId.get(row.id)!} level={row.data.level ?? 0}
            open={!collapsed.has(row.id)} onToggle={toggle}/>
          : <ItemRow key={row.id} item={row} onCell={onCell} onRemark={onRemark} onPicture={openPicture} onOpenSource={onOpenSource} remarks={{
            'pm-last': remarkOf(row.id, 'pm', last), 'pm-now': remarkOf(row.id, 'pm', state.week),
            'purchase-last': remarkOf(row.id, 'purchase', last), 'purchase-now': remarkOf(row.id, 'purchase', state.week),
          }}/>)}
      </tbody>
    </table>
    {!controlledPicture && <MatPictureDialog picture={localPicture} onClose={() => setLocalPicture(null)} onEditPhotos={onOpenSource ? (id) => { setLocalPicture(null); onOpenSource(id) } : undefined}/>}
  </div>
}
