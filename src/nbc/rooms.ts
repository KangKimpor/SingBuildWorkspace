import type { NbcActivity } from './types'

/** BP02 keeps one editable activity per room. A task row of the matrix is the parent whose children carry `room`. */
export const isRoomProject = (activities: readonly NbcActivity[]) => activities.some((a) => a.room)

export interface RoomRow {
  activity: NbcActivity
  /** 2 section · 3 group · 4 task, so the shared WBS row styling applies. */
  level: number
  depth: number
  task: boolean
  cells: ReadonlyMap<string, NbcActivity>
}
export interface RoomFloor { root: NbcActivity; rooms: string[]; rows: RoomRow[] }

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
        rows.push({ activity: a, level: task ? 4 : depth === 0 ? 2 : 3, depth, task, cells: task ? new Map(kids.map((k) => [k.room!, k])) : new Map() })
        if (!task) walk(a, depth + 1)
      }
    }
    walk(root, 0)
    return { root, rooms, rows }
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
