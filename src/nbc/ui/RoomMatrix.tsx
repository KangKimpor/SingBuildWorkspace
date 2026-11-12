import './ui.css'
import './room-matrix.css'
import type { ReactNode } from 'react'
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
}

/** Room codes like `CSK4-2301` read as type above, number below; the hyphen stays for screen readers and copy. Area labels (`code\nplace`) and anything else render as they are. */
const roomHead = (label: string | undefined) => {
  const parts = label ? /^([A-Z0-9]+)-(\d+)$/.exec(label) : null
  return parts ? <><span className="nbc-room-type">{parts[1]}</span><span className="sr-only">-</span><span className="nbc-room-no">{parts[2]}</span></> : label
}

/** One column per room: rooms of the same type keep their own percentages. */
export function RoomMatrix({ floor, caption, collapsed, onToggle, progress, previous, show, cell, cellAttrs, extra = [], onRowClick, rowAttrs }: RoomMatrixProps) {
  const rows = visibleRoomRows(floor, show, collapsed)
  const span = floor.rooms.length
  return <div className="nbc-wbs-scroll nbc-rooms-scroll"><table className="nbc-wbs nbc-rooms" data-area={floor.labels.some((l) => l.includes('\n')) || undefined}><caption className="sr-only">{caption}</caption>
    <thead><tr>
      <th scope="col" className="nbc-room-sticky-1">Item</th><th scope="col" className="nbc-room-sticky-2">Description</th>
      <th scope="col" className="nbc-num">Prev %</th><th scope="col" className="nbc-num">Now %</th>
      {extra.map((c) => <th scope="col" key={c.header}>{c.header}</th>)}
      {floor.rooms.map((room, i) => <th scope="col" key={room} className="nbc-room-head" title={floor.labels[i]}>{roomHead(floor.labels[i])}</th>)}
    </tr></thead>
    <tbody>{rows.map((row) => {
      const a = row.activity, open = !collapsed.has(a.id)
      return <tr key={a.id} data-level={row.level} data-group={!row.task} data-wbs={a.wbs} {...rowAttrs?.(row)}>
        <td className="nbc-wbs-no nbc-room-sticky-1" data-label="Item">{a.item || ''}</td>
        <td className="nbc-room-sticky-2" style={{ paddingInlineStart: `${row.depth * 14 + 8}px` }} data-label="Description"><div className="nbc-desc">
          {!row.task ? <button className="nbc-toggle" aria-expanded={open} aria-label={`${open ? 'Collapse' : 'Expand'} ${a.name}`} onClick={(e) => { e.stopPropagation(); onToggle(a.id) }}>{open ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</button> : <span className="nbc-toggle-gap" aria-hidden="true"/>}
          {onRowClick ? <button className="nbc-name nbc-name-button" onClick={() => onRowClick(row)}>{a.name}</button> : <span className="nbc-name">{a.name}</span>}
        </div></td>
        <td className="nbc-num" data-label="Prev %">{percent(previous.get(a.id) ?? 0, 1)}</td>
        <td className="nbc-num" data-label="Now %" {...nowCellProps(progress.get(a.id) ?? 0, previous.get(a.id) ?? 0)}>{percent(progress.get(a.id) ?? 0, 1)}</td>
        {extra.map((c) => <td key={c.header} data-label={c.header}>{row.task ? c.cell(row) : null}</td>)}
        {row.task
          ? floor.rooms.map((room) => {
            const leaf = row.cells.get(room), co = row.co.get(room)
            return leaf ? <td key={room} className="nbc-room-cell" data-label={room} {...cellAttrs?.(leaf, co)}>{cell(leaf, row, co)}</td> : <td key={room} className="nbc-room-na" aria-label={`${room}: not applicable`}/>
          })
          : span > 0 && <td colSpan={span} className="nbc-room-fill" aria-hidden="true"/>}
      </tr>
    })}</tbody></table></div>
}
