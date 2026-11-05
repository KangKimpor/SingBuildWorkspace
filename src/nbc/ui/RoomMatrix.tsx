import './ui.css'
import './room-matrix.css'
import type { ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { percent } from '../format'
import { visibleRoomRows } from '../rooms'
import type { RoomFloor, RoomRow } from '../rooms'
import type { NbcActivity } from '../types'

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
  /** Content of one room cell. */
  cell: (leaf: NbcActivity, row: RoomRow) => ReactNode
  cellAttrs?: (leaf: NbcActivity) => Record<string, string | boolean | undefined>
  extra?: { header: string; cell: (row: RoomRow) => ReactNode }[]
  onRowClick?: (row: RoomRow) => void
  rowAttrs?: (row: RoomRow) => Record<string, string | boolean | undefined>
}

/** One column per room: rooms of the same type keep their own percentages. */
export function RoomMatrix({ floor, caption, collapsed, onToggle, progress, previous, show, cell, cellAttrs, extra = [], onRowClick, rowAttrs }: RoomMatrixProps) {
  const rows = visibleRoomRows(floor, show, collapsed)
  const span = floor.rooms.length
  return <div className="nbc-wbs-scroll nbc-rooms-scroll"><table className="nbc-wbs nbc-rooms"><caption className="sr-only">{caption}</caption>
    <thead><tr>
      <th scope="col" className="nbc-room-sticky-1">Item</th><th scope="col" className="nbc-room-sticky-2">Description</th>
      <th scope="col" className="nbc-num">Prev %</th><th scope="col" className="nbc-num">Now %</th>
      {extra.map((c) => <th scope="col" key={c.header}>{c.header}</th>)}
      {floor.rooms.map((room) => <th scope="col" key={room} className="nbc-room-head" title={room}>{room}</th>)}
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
        <td className="nbc-num" data-label="Now %">{percent(progress.get(a.id) ?? 0, 1)}</td>
        {extra.map((c) => <td key={c.header} data-label={c.header}>{row.task ? c.cell(row) : null}</td>)}
        {row.task
          ? floor.rooms.map((room) => {
            const leaf = row.cells.get(room)
            return leaf ? <td key={room} className="nbc-room-cell" data-label={room} {...cellAttrs?.(leaf)}>{cell(leaf, row)}</td> : <td key={room} className="nbc-room-na" aria-label={`${room}: not applicable`}/>
          })
          : span > 0 && <td colSpan={span} className="nbc-room-fill" aria-hidden="true"/>}
      </tr>
    })}</tbody></table></div>
}
