import { describe, expect, test } from 'vitest'
import { calculate } from '../progress'
import { fixtureActivities } from '../test-fixture'
import type { NbcActivity } from '../types'
import { drillRows, drillSearch, drillTrail } from './drill'

const base = {
  projectId: 'nbc-bp03',
  description: 'Synthetic activity',
  area: 'Area',
  location: 'GF',
  trade: 'Trade',
  handler: 'Tola',
  remark: '',
  history: [],
  duration: 1,
  boqValue: null,
  schedule: null,
  sourcePrevious: 0,
  sourceWeekly: 0,
}

describe('drill', () => {
  test('top level returns the roots in order with rolled-up progress', () => {
    const acts = fixtureActivities()
    const live = calculate(acts)
    const rows = drillRows(null, { live })
    const expectedRoots = acts.filter((a) => a.parentId === null).sort((a, b) => a.order - b.order)
    expect(rows.map((r) => r.activity.id)).toEqual(expectedRoots.map((a) => a.id))
    for (const r of rows) expect(r.progress).toBe(live.progress.get(r.activity.id))
  })

  test('a group row counts its leaves', () => {
    const acts = fixtureActivities()
    const live = calculate(acts)
    const [root] = drillRows(null, { live })
    expect(root!.group).toBe(true)
    expect(root!.leafCount).toBe(2)
  })

  test('leaf filter prunes empty branches', () => {
    const acts: NbcActivity[] = [
      ...fixtureActivities(),
      { ...base, id: 'nbc:2', wbs: '2', name: 'Other branch', parentId: null, editable: false, relativeWeight: 0, globalWeight: 0, baseline: 0, progress: 0, order: 4, handler: '' },
      { ...base, id: 'nbc:2.1', wbs: '2.1', name: 'Sitha only', parentId: 'nbc:2', editable: true, relativeWeight: 1, globalWeight: 0, baseline: 0, progress: 0, order: 5, handler: 'Sitha' },
    ]
    const live = calculate(acts)
    const roots = drillRows(null, { live, leaf: (a) => a.handler === 'Tola' })
    expect(roots.map((r) => r.activity.id)).toEqual(['nbc:1.6.1'])
    expect(roots[0]!.leafCount).toBe(1)
    const kids = drillRows('nbc:1.6.1', { live, leaf: (a) => a.handler === 'Tola' })
    expect(kids.map((r) => r.activity.handler)).toEqual(['Tola'])
  })

  test('previous comes from before', () => {
    const acts = fixtureActivities()
    const live = calculate(acts)
    const baseline = new Map(acts.map((a) => [a.id, a.id === 'nbc:1.6.1.2' ? 0 : a.progress]))
    const before = calculate(acts, baseline)
    const kids = drillRows('nbc:1.6.1', { live, before })
    const row = kids.find((r) => r.activity.id === 'nbc:1.6.1.2')!
    expect(row.progress - row.previous).toBeCloseTo(0.25, 12)
  })

  test('trail', () => {
    const acts = fixtureActivities()
    const { byId } = calculate(acts)
    expect(drillTrail(byId, 'nbc:1.6.1.2').map((a) => a.wbs)).toEqual(['1.6.1', '1.6.1.2'])
    expect(drillTrail(byId, 'nope')).toEqual([])
    expect(drillTrail(byId, null)).toEqual([])
  })

  test('shared cell appears once', () => {
    const acts: NbcActivity[] = [
      { ...base, id: 't1', wbs: '1', name: 'Wall', parentId: null, editable: false, relativeWeight: 1, globalWeight: 1, baseline: 0.5, progress: 0.5, order: 1, handler: '' },
      { ...base, id: 'h1', wbs: '1.1', name: 'Room R1', parentId: 't1', editable: true, relativeWeight: 0.5, globalWeight: 0.5, baseline: 1, progress: 1, order: 2, room: 'R1', handler: 'Tola' },
      { ...base, id: 'h2', wbs: '1.2', name: 'Room R1', parentId: 't1', editable: true, relativeWeight: 0.5, globalWeight: 0.5, baseline: 0, progress: 0, order: 3, room: 'R1', coOf: 'h1', handler: 'Sitha' },
    ]
    const live = calculate(acts)
    const rows = drillRows('t1', { live })
    expect(rows).toHaveLength(1)
    expect(rows[0]!.activity.id).toBe('h1')
    expect(rows[0]!.progress).toBeCloseTo(0.5, 12)
    expect(rows[0]!.previous).toBeCloseTo(0.5, 12)
  })

  test('search matches ancestors and caps', () => {
    const acts = fixtureActivities()
    const live = calculate(acts)
    const byGroup = drillSearch('Test area', { live })
    expect(byGroup.map((r) => r.activity.id)).toEqual(['nbc:1.6.1.1', 'nbc:1.6.1.2'])

    const many: NbcActivity[] = [
      { ...base, id: 'root', wbs: '1', name: 'Root', parentId: null, editable: false, relativeWeight: 1, globalWeight: 1, baseline: 0, progress: 0, order: 1, handler: '' },
      ...Array.from({ length: 500 }, (_, i) => ({
        ...base,
        id: `leaf:${i}`,
        wbs: `1.${i + 1}`,
        name: `Install item ${i + 1}`,
        parentId: 'root',
        editable: true,
        relativeWeight: 1 / 500,
        globalWeight: 1 / 500,
        baseline: 0,
        progress: 0,
        order: i + 2,
      })),
    ]
    const manyLive = calculate(many)
    expect(drillSearch('install', { live: manyLive })).toHaveLength(200)
  })

  test('16,550 activities', () => {
    const acts: NbcActivity[] = []
    let order = 0
    // 10 floors + 500 groups + 16,040 leaves = 16,550 nodes
    const floors = 10, groupsPerFloor = 50
    for (let f = 0; f < floors; f++) {
      const fid = `f:${f}`
      acts.push({ ...base, id: fid, wbs: `${f + 1}`, name: `Floor ${f + 1}`, parentId: null, editable: false, relativeWeight: 1 / floors, globalWeight: 1 / floors, baseline: 0, progress: 0, order: ++order, handler: '' })
      for (let g = 0; g < groupsPerFloor; g++) {
        const gid = `g:${f}:${g}`
        const count = f === 0 && g < 40 ? 33 : 32
        acts.push({ ...base, id: gid, wbs: `${f + 1}.${g + 1}`, name: `Group ${g + 1}`, parentId: fid, editable: false, relativeWeight: 1 / groupsPerFloor, globalWeight: 1 / (floors * groupsPerFloor), baseline: 0, progress: 0, order: ++order, handler: '' })
        for (let l = 0; l < count; l++) {
          acts.push({ ...base, id: `l:${f}:${g}:${l}`, wbs: `${f + 1}.${g + 1}.${l + 1}`, name: l % 2 === 0 ? `Install pipe ${l}` : `Paint wall ${l}`, parentId: gid, editable: true, relativeWeight: 1 / count, globalWeight: 1 / 16040, baseline: 0, progress: 0.5, order: ++order })
        }
      }
    }
    expect(acts).toHaveLength(16550)
    const live = calculate(acts)
    const t0 = performance.now()
    const top = drillRows(null, { live })
    const t1 = performance.now()
    const hits = drillSearch('install', { live })
    const t2 = performance.now()
    expect(top.length).toBe(floors)
    expect(hits).toHaveLength(200)
    expect(t1 - t0).toBeLessThan(50)
    expect(t2 - t1).toBeLessThan(50)
  })
})
