import type { calculate } from '../progress'
import type { NbcActivity } from '../types'

type Calculation = ReturnType<typeof calculate>
type LeafFn = (a: NbcActivity) => boolean

export interface DrillRow {
  activity: NbcActivity
  group: boolean
  leafCount: number
  progress: number
  previous: number
}

export interface DrillOptions {
  live: Calculation
  before?: Calculation
  leaf?: LeafFn
}

interface LiveIndex {
  coByFirst: Map<string, NbcActivity[]>
  sortedChildren: Map<string | null, NbcActivity[]>
  orderedLeaves: NbcActivity[]
}

const DEFAULT_LEAF: LeafFn = () => true
const indexCache = new WeakMap<Calculation, LiveIndex>()
const metaCache = new WeakMap<Calculation, WeakMap<LeafFn, Map<string, number>>>()

function getIndex(live: Calculation): LiveIndex {
  let idx = indexCache.get(live)
  if (idx) return idx
  const coByFirst = new Map<string, NbcActivity[]>()
  for (const a of live.leaves) {
    if (!a.coOf || !live.byId.has(a.coOf)) continue
    const list = coByFirst.get(a.coOf)
    if (list) list.push(a)
    else coByFirst.set(a.coOf, [a])
  }
  const sortedChildren = new Map<string | null, NbcActivity[]>()
  for (const [parent, list] of live.children) {
    sortedChildren.set(parent, [...list].sort((a, b) => a.order - b.order))
  }
  const orderedLeaves: NbcActivity[] = []
  const walk = (parent: string | null) => {
    for (const a of sortedChildren.get(parent) ?? []) {
      if (a.editable) {
        if (!a.coOf || !live.byId.has(a.coOf)) orderedLeaves.push(a)
      } else {
        walk(a.id)
      }
    }
  }
  walk(null)
  idx = { coByFirst, sortedChildren, orderedLeaves }
  indexCache.set(live, idx)
  return idx
}

function getLeafCounts(live: Calculation, leaf: LeafFn): Map<string, number> {
  let byLeaf = metaCache.get(live)
  if (!byLeaf) {
    byLeaf = new WeakMap()
    metaCache.set(live, byLeaf)
  }
  let counts = byLeaf.get(leaf)
  if (counts) return counts
  const { coByFirst, orderedLeaves } = getIndex(live)
  counts = new Map()
  for (const a of orderedLeaves) {
    const co = coByFirst.get(a.id)
    const matches = leaf(a) || (co ? co.some(leaf) : false)
    if (!matches) continue
    let node: NbcActivity | undefined = a
    while (node) {
      counts.set(node.id, (counts.get(node.id) ?? 0) + 1)
      node = node.parentId ? live.byId.get(node.parentId) : undefined
    }
  }
  byLeaf.set(leaf, counts)
  return counts
}

function rowFor(a: NbcActivity, leafCount: number, live: Calculation, before: Calculation | undefined, coByFirst: Map<string, NbcActivity[]>): DrillRow {
  if (!a.editable) {
    const progress = live.progress.get(a.id) ?? a.progress
    const previous = before ? (before.progress.get(a.id) ?? progress) : progress
    return { activity: a, group: true, leafCount, progress, previous }
  }
  const co = coByFirst.get(a.id)
  if (!co) {
    const progress = live.progress.get(a.id) ?? a.progress
    const previous = before ? (before.progress.get(a.id) ?? progress) : progress
    return { activity: a, group: false, leafCount: 1, progress, previous }
  }
  const halves = [a, ...co]
  let sumLive = 0
  let sumBefore = 0
  for (const h of halves) {
    const p = live.progress.get(h.id) ?? h.progress
    sumLive += p
    sumBefore += before ? (before.progress.get(h.id) ?? p) : p
  }
  return {
    activity: a,
    group: false,
    leafCount: 1,
    progress: sumLive / halves.length,
    previous: sumBefore / halves.length,
  }
}

/** Children of `parentId` (null = top level) in `order`, keeping only rows that hold at least one leaf passing `leaf`. A `coOf` half is merged into its first half: one row, progress and previous = mean of the halves. */
export function drillRows(parentId: string | null, options: DrillOptions): DrillRow[] {
  const { live, before, leaf = DEFAULT_LEAF } = options
  const { coByFirst, sortedChildren } = getIndex(live)
  const counts = getLeafCounts(live, leaf)
  const rows: DrillRow[] = []
  for (const a of sortedChildren.get(parentId) ?? []) {
    if (a.coOf && live.byId.has(a.coOf)) continue
    const count = counts.get(a.id) ?? 0
    if (!count) continue
    rows.push(rowFor(a, count, live, before, coByFirst))
  }
  return rows
}

/** Ancestors of `id` from the top level down to `id` itself; [] for null or unknown ids. */
export function drillTrail(byId: ReadonlyMap<string, NbcActivity>, id: string | null): NbcActivity[] {
  if (!id) return []
  let node = byId.get(id)
  if (!node) return []
  const trail: NbcActivity[] = []
  const seen = new Set<string>()
  while (node && !seen.has(node.id)) {
    seen.add(node.id)
    trail.push(node)
    node = node.parentId ? byId.get(node.parentId) : undefined
  }
  return trail.reverse()
}

/** Leaves whose own or any ancestor's "wbs name description" contains `query` (case-insensitive), first `limit` in workbook order. */
export function drillSearch(query: string, options: DrillOptions, limit = 200): DrillRow[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const { live, before, leaf = DEFAULT_LEAF } = options
  const { coByFirst, orderedLeaves } = getIndex(live)
  const counts = getLeafCounts(live, leaf)
  const textMatched = new Map<string, boolean>()
  const matches = (a: NbcActivity): boolean => {
    const cached = textMatched.get(a.id)
    if (cached !== undefined) return cached
    let hit = `${a.wbs} ${a.name} ${a.description}`.toLowerCase().includes(q)
    if (!hit && a.parentId) {
      const parent = live.byId.get(a.parentId)
      if (parent) hit = matches(parent)
    }
    textMatched.set(a.id, hit)
    return hit
  }
  const results: DrillRow[] = []
  for (const a of orderedLeaves) {
    if (!counts.get(a.id)) continue
    const co = coByFirst.get(a.id)
    if (!matches(a) && !(co && co.some(matches))) continue
    results.push(rowFor(a, 1, live, before, coByFirst))
    if (results.length >= limit) break
  }
  return results
}
