import type { NbcActivity } from '../../src/nbc/types'

/**
 * Synthetic BP02 with the live shape (13 November 2026): 11 floors of 14–23 rooms, 116 matrix rows
 * per floor (80 tasks), about 15,300 room cells (16,550 activities) and Tola holding about 65% of
 * them. No real names or values; it only reproduces the sizes the screens have to render.
 */
export const bp02Project = { id: 'nbc-bp02', name: 'NBC BP02 – Pan Pacific Hotel', workspace: 'team' as const, color: 'blue' as const, description: 'Synthetic BP02 perf fixture', target: '', status: 'Active' as const, progress: 0, nbcBp03: true }

const ROOMS = [14, 21, 20, 22, 22, 23, 23, 23, 23, 23, 22]
const HANDLERS: [string, number][] = [['Tola', 0.65], ['Kheng', 0.11], ['Lychhinh', 0.08], ['Sitha', 0.08], ['Srun', 0.05], ['Chhorvaon', 0.03]]

export function bp02Activities(): NbcActivity[] {
  let seed = 7
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const pick = () => { let r = random(); for (const [h, p] of HANDLERS) { if ((r -= p) < 0) return h } return 'Tola' }
  const base = { projectId: 'nbc-bp02', description: '', area: '', location: '', trade: '', handler: '', remark: '', history: [], duration: null, boqValue: null, schedule: null, sourcePrevious: 0, sourceWeekly: 0 }
  const out: NbcActivity[] = []
  let order = 0
  const node = (id: string, wbs: string, name: string, parentId: string | null, extra: Partial<NbcActivity> = {}): NbcActivity => {
    const a = { ...base, id, wbs, name, parentId, editable: false, relativeWeight: 1, globalWeight: 0, progress: 0, baseline: 0, order: ++order, ...extra } as NbcActivity
    out.push(a)
    return a
  }
  ROOMS.forEach((roomCount, f) => {
    const level = 23 - f
    const rooms = Array.from({ length: roomCount }, (_, i) => i === roomCount - 1 ? `CRD-${level}` : `CSK${1 + (i % 4)}-${level}${String(i + 1).padStart(2, '0')}`)
    const floor = node(`nbc-bp02:${level}`, `${level}`, `Floor ${level}`, null, { roomList: rooms, relativeWeight: 1 / ROOMS.length })
    let task = 0
    for (let s = 1; s <= 5; s++) {
      const section = node(`${floor.id}.${s}`, `${level}.${s}`, `Section ${s}`, floor.id, { relativeWeight: 1 / 5 })
      for (let g = 1; g <= 6; g++) {
        const group = node(`${section.id}.${g}`, `${section.wbs}.${g}`, `Work group ${s}.${g}`, section.id, { relativeWeight: 1 / 6 })
        const tasks = g <= 2 ? 3 : 2 + (task % 3 === 0 ? 1 : 0)
        for (let t = 1; t <= tasks && task < 80; t++, task++) {
          const row = node(`${group.id}.${t}`, `${group.wbs}.${t}`, `Install item ${task + 1} with a typical BOQ description`, group.id, { relativeWeight: 1 / tasks, item: `${t}` })
          const handler = pick()
          for (const room of rooms) {
            if (random() > 0.81) continue
            const progress = [0, 0.25, 0.5, 0.75, 1][Math.floor(random() * 5)]!
            const cell = node(`${row.id}.${room}`, `${row.wbs}.${room}`, room, row.id, { room, editable: true, relativeWeight: 1, globalWeight: 1, progress, baseline: progress, handler })
            // About 20 cells per floor are shared 50/50 with a second handler.
            if (random() < 0.016) {
              cell.relativeWeight = 0.5
              node(`${cell.id}.2`, `${cell.wbs}.2`, room, row.id, { room, coOf: cell.id, editable: true, relativeWeight: 0.5, globalWeight: 0.5, progress, baseline: progress, handler: handler === 'Tola' ? 'Kheng' : 'Tola' })
            }
          }
        }
      }
    }
  })
  // Every parent needs at least one child; drop rows that ended with no room cells.
  const parents = new Set(out.map((a) => a.parentId))
  const kept = out.filter((a) => a.editable || parents.has(a.id))
  const total = kept.filter((a) => a.editable).reduce((sum, a) => sum + a.globalWeight, 0)
  for (const a of kept) if (a.editable) a.globalWeight /= total
  return kept
}
