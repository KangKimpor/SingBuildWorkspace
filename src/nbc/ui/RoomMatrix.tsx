import './ui.css'
import './room-matrix.css'
import { memo, useEffect, useLayoutEffect, useRef } from 'react'
import type { ReactNode, UIEvent } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { percent } from '../format'
import { visibleRoomRows } from '../rooms'
import type { RoomFloor, RoomRow } from '../rooms'
import type { NbcActivity } from '../types'
import { nowCellProps } from './now-cell'

export interface RoomMatrixProps {
  floor: RoomFloor
  caption: string
  collapsed: ReadonlySet<string>
  onToggle: (id: string) => void
  /** Progress of every node now and before the period, keyed by activity id. */
  progress: ReadonlyMap<string, number>
  previous: ReadonlyMap<string, number>
  /** Which task rows to list. Groups appear when one of their tasks does. */
  show: (row: RoomRow) => boolean
  /** Content of one room cell; `co` is the second half when two handlers share the cell. */
  cell: (leaf: NbcActivity, row: RoomRow, co?: NbcActivity) => ReactNode
  cellAttrs?: (leaf: NbcActivity, co?: NbcActivity) => Record<string, string | boolean | undefined>
  extra?: { header: string; cell: (row: RoomRow) => ReactNode }[]
  onRowClick?: (row: RoomRow) => void
  rowAttrs?: (row: RoomRow) => Record<string, string | boolean | undefined>
  /**
   * Everything a task row's cells show that is not on `row` or in `progress`/`previous`, as one string.
   * A row whose signature, row object, values and open state are unchanged is not re-rendered, so typing
   * in one cell of a 2,000-cell floor re-renders one row. Its cells must therefore read live state
   * (handlers, form values) through refs rather than from the render that created them.
   */
  rowSignature?: (row: RoomRow) => string
}

/** Room codes like `CSK4-2301` read as type above, number below; the hyphen stays for screen readers and copy. Area labels (`code\nplace`) and anything else render as they are. */
const roomHead = (label: string | undefined) => {
  const parts = label ? /^([A-Z0-9]+)-(\d+)$/.exec(label) : null
  return parts ? <><span className="nbc-room-type">{parts[1]}</span><span className="sr-only">-</span><span className="nbc-room-no">{parts[2]}</span></> : label
}

const NO_EXTRA: NonNullable<RoomMatrixProps['extra']> = []
type Handlers = { current: Pick<RoomMatrixProps, 'onRowClick' | 'onToggle'> }
interface RowProps extends Pick<RoomMatrixProps, 'cell' | 'cellAttrs' | 'rowAttrs'> {
  row: RoomRow; rooms: string[]; open: boolean; count?: number; now: number; before: number
  extra: NonNullable<RoomMatrixProps['extra']>; span: number; onRowClick: boolean
  /** Undefined turns the memo off: the row then re-renders with its parent, as before. */
  signature?: string
  handlers: Handlers
}

const MatrixRow = memo(function MatrixRow({ row, rooms, open, count, now, before, cell, cellAttrs, extra, rowAttrs, span, onRowClick, handlers }: RowProps) {
  const a = row.activity
  return <tr data-level={row.level} data-group={!row.task} data-wbs={a.wbs} {...rowAttrs?.(row)}>
    <td className="nbc-wbs-no nbc-room-item" data-label="Item">{a.item || ''}</td>
    <td className="nbc-room-sticky" style={{ paddingInlineStart: `${row.depth * 14 + 8}px` }} data-label="Description"><div className="nbc-desc">
      {!row.task ? <button className="nbc-toggle" aria-expanded={open} aria-label={`${open ? 'Collapse' : 'Expand'} ${a.name}`} onClick={(e) => { e.stopPropagation(); handlers.current.onToggle(a.id) }}>{open ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</button> : <span className="nbc-toggle-gap" aria-hidden="true">{row.depth > 0 && <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor"><path d="M3 1v8a2 2 0 002 2h8" strokeWidth="1.75" strokeLinecap="round"/></svg>}</span>}
      {onRowClick ? <button className="nbc-name nbc-name-button" onClick={() => handlers.current.onRowClick?.(row)}>{a.name}</button> : <span className="nbc-name">{a.name}</span>}{!row.task && count !== undefined && <span className="nbc-count" title="Activities">{count}</span>}
    </div></td>
    <td className="nbc-num" data-label="Prev %">{percent(before, 1)}</td>
    <td className="nbc-num" data-label="Now %" {...nowCellProps(now, before)}>{percent(now, 1)}</td>
    {row.task
      ? <>
        {extra.map((c) => <td key={c.header} data-label={c.header}>{c.cell(row)}</td>)}
        {rooms.map((room) => {
          const leaf = row.cells.get(room), co = row.co.get(room)
          return leaf ? <td key={room} className="nbc-room-cell" data-label={room} {...cellAttrs?.(leaf, co)}>{cell(leaf, row, co)}</td> : <td key={room} className="nbc-room-na" aria-label={`${room}: not applicable`}/>
        })}
      </>
      : span > 0 && <td colSpan={span} className="nbc-room-fill" aria-hidden="true"/>}
  </tr>
}, (a, b) => b.signature !== undefined && a.signature === b.signature && a.row === b.row && a.rooms === b.rooms && a.open === b.open && a.count === b.count && a.now === b.now && a.before === b.before && a.span === b.span && a.onRowClick === b.onRowClick)

/** One column per room: rooms of the same type keep their own percentages. */
export function RoomMatrix({ floor, caption, collapsed, onToggle, progress, previous, show, cell, cellAttrs, extra = NO_EXTRA, onRowClick, rowAttrs, rowSignature }: RoomMatrixProps) {
  const rows = visibleRoomRows(floor, show, collapsed)
  const span = floor.rooms.length
  // Number of task rows under each group, shown at the end of its description.
  const parents = new Map(floor.rows.map((r) => [r.activity.id, r.activity.parentId])), counts = new Map<string, number>()
  for (const row of rows) if (row.task) for (let p = row.activity.parentId; p; p = parents.get(p) ?? null) counts.set(p, (counts.get(p) ?? 0) + 1)
  // Click handlers of a row that skipped re-rendering read the latest callbacks from here.
  const handlers: Handlers = useRef({ onToggle, onRowClick })
  useLayoutEffect(() => { handlers.current = { onToggle, onRowClick } })
  // Hovering a room cell marks its whole column, like the row hover marks its row.
  const table = useRef<HTMLTableElement>(null), hot = useRef(-1)
  const mark = (index: number) => {
    if (index === hot.current || !table.current) return
    hot.current = index
    table.current.querySelectorAll('.nbc-hot').forEach((el) => el.classList.remove('nbc-hot'))
    if (index < 0) return
    for (const tr of table.current.rows) { const cell = tr.cells[index]; if (cell?.matches('.nbc-room-head, .nbc-room-cell, .nbc-room-na')) cell.classList.add('nbc-hot') }
  }
  useEffect(() => {
    const el = table.current
    if (!el) return
    const over = (event: MouseEvent) => { const cell = (event.target as HTMLElement).closest<HTMLTableCellElement>('.nbc-room-head, .nbc-room-cell, .nbc-room-na'); mark(cell ? cell.cellIndex : -1) }
    const leave = () => mark(-1)
    el.addEventListener('mouseover', over); el.addEventListener('mouseleave', leave)
    return () => { el.removeEventListener('mouseover', over); el.removeEventListener('mouseleave', leave) }
  })
  // Marks the scroller once it leaves the left edge; CSS draws the frozen-column shadow from it.
  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget, scrolled = el.scrollLeft > 0
    if (scrolled !== ('scrolled' in el.dataset)) { if (scrolled) el.dataset.scrolled = ''; else delete el.dataset.scrolled }
  }
  return <div className="nbc-wbs-scroll nbc-rooms-scroll" onScroll={onScroll}><table ref={table} className="nbc-wbs nbc-rooms" data-area={floor.labels.some((l) => l.includes('\n')) || undefined}><caption className="sr-only">{caption}</caption>
    <thead><tr>
      <th scope="col" className="nbc-room-item">Item</th><th scope="col" className="nbc-room-sticky">Description</th>
      <th scope="col" className="nbc-num">Prev %</th><th scope="col" className="nbc-num">Now %</th>
      {extra.map((c) => <th scope="col" key={c.header}>{c.header}</th>)}
      {floor.rooms.map((room, i) => <th scope="col" key={room} className="nbc-room-head" title={floor.labels[i]}>{roomHead(floor.labels[i])}</th>)}
    </tr></thead>
    <tbody>{rows.map((row) => <MatrixRow key={row.activity.id} row={row} rooms={floor.rooms} open={!collapsed.has(row.activity.id)} count={counts.get(row.activity.id)}
      now={progress.get(row.activity.id) ?? 0} before={previous.get(row.activity.id) ?? 0} signature={rowSignature?.(row)} handlers={handlers}
      cell={cell} cellAttrs={cellAttrs} extra={extra} rowAttrs={rowAttrs} span={extra.length + span} onRowClick={!!onRowClick}/>)}</tbody></table></div>
}
