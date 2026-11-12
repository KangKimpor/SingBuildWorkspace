import './ui.css'
import './room-matrix.css'
import { useEffect, useRef } from 'react'
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
  // Number of task rows under each group, shown at the end of its description.
  const parents = new Map(floor.rows.map((r) => [r.activity.id, r.activity.parentId])), counts = new Map<string, number>()
  for (const row of rows) if (row.task) for (let p = row.activity.parentId; p; p = parents.get(p) ?? null) counts.set(p, (counts.get(p) ?? 0) + 1)
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
  return <div className="nbc-wbs-scroll nbc-rooms-scroll"><table ref={table} className="nbc-wbs nbc-rooms" data-area={floor.labels.some((l) => l.includes('\n')) || undefined}><caption className="sr-only">{caption}</caption>
    <thead><tr>
      <th scope="col" className="nbc-room-item">Item</th><th scope="col" className="nbc-room-sticky">Description</th>
      <th scope="col" className="nbc-num">Prev %</th><th scope="col" className="nbc-num">Now %</th>
      {extra.map((c) => <th scope="col" key={c.header}>{c.header}</th>)}
      {floor.rooms.map((room, i) => <th scope="col" key={room} className="nbc-room-head" title={floor.labels[i]}>{roomHead(floor.labels[i])}</th>)}
    </tr></thead>
    <tbody>{rows.map((row) => {
      const a = row.activity, open = !collapsed.has(a.id)
      return <tr key={a.id} data-level={row.level} data-group={!row.task} data-wbs={a.wbs} {...rowAttrs?.(row)}>
        <td className="nbc-wbs-no nbc-room-item" data-label="Item">{a.item || ''}</td>
        <td className="nbc-room-sticky" style={{ paddingInlineStart: `${row.depth * 14 + 8}px` }} data-label="Description"><div className="nbc-desc">
          {!row.task ? <button className="nbc-toggle" aria-expanded={open} aria-label={`${open ? 'Collapse' : 'Expand'} ${a.name}`} onClick={(e) => { e.stopPropagation(); onToggle(a.id) }}>{open ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</button> : <span className="nbc-toggle-gap" aria-hidden="true">{row.depth > 0 && <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor"><path d="M3 1v8a2 2 0 002 2h8" strokeWidth="1.75" strokeLinecap="round"/></svg>}</span>}
          {onRowClick ? <button className="nbc-name nbc-name-button" onClick={() => onRowClick(row)}>{a.name}</button> : <span className="nbc-name">{a.name}</span>}{!row.task && counts.has(a.id) && <span className="nbc-count" title="Activities">{counts.get(a.id)}</span>}
        </div></td>
        <td className="nbc-num" data-label="Prev %">{percent(previous.get(a.id) ?? 0, 1)}</td>
        <td className="nbc-num" data-label="Now %" {...nowCellProps(progress.get(a.id) ?? 0, previous.get(a.id) ?? 0)}>{percent(progress.get(a.id) ?? 0, 1)}</td>
        {row.task
          ? <>
            {extra.map((c) => <td key={c.header} data-label={c.header}>{c.cell(row)}</td>)}
            {floor.rooms.map((room) => {
              const leaf = row.cells.get(room), co = row.co.get(room)
              return leaf ? <td key={room} className="nbc-room-cell" data-label={room} {...cellAttrs?.(leaf, co)}>{cell(leaf, row, co)}</td> : <td key={room} className="nbc-room-na" aria-label={`${room}: not applicable`}/>
            })}
          </>
          : (extra.length + span) > 0 && <td colSpan={extra.length + span} className="nbc-room-fill" aria-hidden="true"/>}
      </tr>
    })}</tbody></table></div>
}
