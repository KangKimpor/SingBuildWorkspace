import type { NbcActivity } from './types'

/** BP02 keeps one editable activity per room. A task row of the matrix is the parent whose children carry `room`. */
export const isRoomProject = (activities: readonly NbcActivity[]) => activities.some((a) => a.room)

export interface RoomRow {
  activity: NbcActivity
  /** 2 section · 3 group · 4 task, so the shared WBS row styling applies. */
  level: number
  depth: number
  task: boolean
  /** The leaf of each room cell; for a cell shared by two handlers this is the first half. */
  cells: ReadonlyMap<string, NbcActivity>
  /** The second half of the cells shared by two handlers (50% each), by room. */
  co: ReadonlyMap<string, NbcActivity>
  /** Every leaf of the row, second halves included. */
  leaves: readonly NbcActivity[]
}

/** What a room cell shows as one activity: the average of its halves. */
export const cellProgress = (halves: readonly NbcActivity[], value: (a: NbcActivity) => number) => halves.length ? halves.reduce((sum, a) => sum + value(a), 0) / halves.length : 0
/** The halves of one room cell, first half first. */
export const cellHalves = (row: Pick<RoomRow, 'cells' | 'co'>, room: string): NbcActivity[] => [row.cells.get(room), row.co.get(room)].filter((a): a is NbcActivity => !!a)
export interface RoomFloor { root: NbcActivity; rooms: string[]; /** Column headings, aligned with `rooms`. */ labels: string[]; rows: RoomRow[] }

/** BP03/BP04 keep ID and MEP panels (one set of area columns each) where BP02 keeps floors. */
export const isAreaProject = (activities: readonly NbcActivity[]) => activities.some((a) => a.panel)
/** Name of the picker above the matrix and the text on each of its buttons. */
export const floorPickerLabel = (floors: readonly RoomFloor[]) => floors.some((f) => f.root.panel) ? 'Panel' : 'Floor'
export const floorTabName = (root: NbcActivity) => root.panel ? root.name : root.name.replace('Floor ', '')

/** Floors (in workbook order) with their room columns and the matrix rows under each. */
export function roomFloors(activities: readonly NbcActivity[]): RoomFloor[] {
  const children = new Map<string | null, NbcActivity[]>()
  for (const a of activities) {
    const siblings = children.get(a.parentId) ?? []
    siblings.push(a)
    children.set(a.parentId, siblings)
  }
  const byOrder = (a: NbcActivity, b: NbcActivity) => a.order - b.order
  return [...(children.get(null) ?? [])].sort(byOrder).map((root) => {
    const rows: RoomRow[] = []
    const rooms = root.roomList ?? []
    const walk = (parent: NbcActivity, depth: number) => {
      for (const a of [...(children.get(parent.id) ?? [])].sort(byOrder)) {
        if (a.room) continue
        const kids = children.get(a.id) ?? []
        const task = kids.length > 0 && kids.every((k) => k.room)
        const first = kids.filter((k) => !k.coOf), second = kids.filter((k) => k.coOf)
        rows.push({ activity: a, level: task ? 4 : depth === 0 ? 2 : 3, depth, task,
          cells: task ? new Map(first.map((k) => [k.room!, k])) : new Map(),
          co: task ? new Map(second.flatMap((k) => { const own = first.find((f) => f.id === k.coOf); return own ? [[own.room!, k] as const] : [] })) : new Map(),
          leaves: task ? kids : [] })
        if (!task) walk(a, depth + 1)
      }
    }
    walk(root, 0)
    return { root, rooms, labels: root.roomLabels ?? rooms, rows }
  })
}

/** Ids of the rows to show: tasks that pass `show`, plus their groups. Collapsed groups hide their descendants. */
export function visibleRoomRows(floor: RoomFloor, show: (row: RoomRow) => boolean, collapsed: ReadonlySet<string>) {
  const index = new Map(floor.rows.map((row, i) => [row.activity.id, i]))
  const keep = new Set<string>()
  for (const row of floor.rows) {
    if (!row.task || !show(row)) continue
    keep.add(row.activity.id)
    for (let p = row.activity.parentId; p && index.has(p) && !keep.has(p); p = floor.rows[index.get(p)!]!.activity.parentId) keep.add(p)
  }
  const hidden = new Set<string>()
  return floor.rows.filter((row) => {
    const parent = row.activity.parentId
    if (parent && index.has(parent) && (hidden.has(parent) || collapsed.has(parent))) { hidden.add(row.activity.id); return false }
    return keep.has(row.activity.id)
  })
}
