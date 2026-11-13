import { canUpdate } from '../submissions'
import type { Handler, NbcActivity, SubmissionEntry } from '../types'

export type UpdateFilter = 'need' | 'chg' | 'all'

export type UpdateItem =
  | { kind: 'heading'; id: string; path: string }
  | { kind: 'activity'; id: string; activity: NbcActivity; label: string }

export interface UpdateListInput {
  activities: NbcActivity[]
  handler: Handler
  shown: SubmissionEntry[]
  changed: ReadonlySet<string>
  problems: ReadonlySet<string>
  touched: ReadonlySet<string>
  filter: UpdateFilter
  query: string
  floorId?: string
  focusedId?: string
}

/** Flat, ordered list for the phone editor: a heading before each run of leaves that share a parent path. Same visibility rule as UpdateEditor's `visible`. */
export function updateItems(input: UpdateListInput): UpdateItem[] {
  const { activities, handler, shown, changed, problems, touched, filter, query, floorId, focusedId } = input
  if (!activities.length || !shown.length) return []

  const byId = new Map<string, NbcActivity>()
  const children = new Map<string | null, NbcActivity[]>()
  for (const a of activities) {
    byId.set(a.id, a)
    const list = children.get(a.parentId)
    if (list) list.push(a)
    else children.set(a.parentId, [a])
  }
  for (const list of children.values()) list.sort((a, b) => a.order - b.order)

  const shownById = new Map<string, SubmissionEntry>()
  for (const e of shown) shownById.set(e.activityId, e)

  const roomLabelByRoot = new Map<string, Map<string, string>>()
  for (const root of children.get(null) ?? []) {
    if (!root.roomList?.length || !root.roomLabels?.length) continue
    const map = new Map<string, string>()
    for (let i = 0; i < root.roomList.length; i++) {
      const code = root.roomList[i]!
      const label = (root.roomLabels[i] ?? code).replace(/\s*\n\s*/g, ' ').trim()
      if (label) map.set(code, label)
    }
    roomLabelByRoot.set(root.id, map)
  }

  const rootCache = new Map<string, string>()
  const rootOf = (a: NbcActivity): string => {
    const cached = rootCache.get(a.id)
    if (cached !== undefined) return cached
    let cur: NbcActivity | undefined = a
    const chain: NbcActivity[] = []
    while (cur) {
      chain.push(cur)
      if (!cur.parentId) break
      const parent = byId.get(cur.parentId)
      if (!parent) break
      cur = parent
    }
    const rid = cur?.id ?? a.id
    for (const n of chain) rootCache.set(n.id, rid)
    return rid
  }

  const q = query.trim().toLowerCase()
  const textCache = new Map<string, boolean>()
  const textMatch = (a: NbcActivity): boolean => {
    if (!q) return true
    const cached = textCache.get(a.id)
    if (cached !== undefined) return cached
    let hit = `${a.wbs} ${a.name} ${a.description}`.toLowerCase().includes(q)
    if (!hit && a.parentId) {
      const parent = byId.get(a.parentId)
      if (parent) hit = textMatch(parent)
    }
    textCache.set(a.id, hit)
    return hit
  }

  const pathCache = new Map<string, string>()
  const pathFor = (parentId: string | null): string => {
    if (!parentId) return ''
    const cached = pathCache.get(parentId)
    if (cached !== undefined) return cached
    const parts: string[] = []
    let cur = byId.get(parentId)
    const seen = new Set<string>()
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id)
      parts.push(cur.name)
      cur = cur.parentId ? byId.get(cur.parentId) : undefined
    }
    const joined = parts.reverse().join(' › ')
    pathCache.set(parentId, joined)
    return joined
  }

  const visible = (a: NbcActivity): boolean => {
    if (!canUpdate(a, handler)) return false
    const e = shownById.get(a.id)
    if (!e) return false
    if (floorId && rootOf(a) !== floorId) return false
    if (q && !textMatch(a)) return false
    if (filter === 'all') return true
    const flagged = problems.has(a.id) || focusedId === a.id
    if (filter === 'chg') return changed.has(a.id) || flagged
    return !(e.previous === 1 && e.progress === 1) || flagged || touched.has(a.id)
  }

  const items: UpdateItem[] = []
  let lastParent: string | null | undefined

  const walk = (parentId: string | null) => {
    for (const a of children.get(parentId) ?? []) {
      if (a.editable) {
        if (!visible(a)) continue
        const key = a.parentId ?? null
        if (key !== lastParent) {
          lastParent = key
          const path = pathFor(key)
          if (path) items.push({ kind: 'heading', id: `h:${key}`, path })
        }
        const label = a.room ? (roomLabelByRoot.get(rootOf(a))?.get(a.room) ?? a.name) : a.name
        items.push({ kind: 'activity', id: a.id, activity: a, label })
      } else {
        walk(a.id)
      }
    }
  }
  walk(floorId ?? null)
  return items
}

export function updateCounts(shown: SubmissionEntry[], changedCount: number): Record<UpdateFilter, number> {
  let need = 0
  for (const e of shown) if (e.previous < 1) need++
  return { need, chg: changedCount, all: shown.length }
}
