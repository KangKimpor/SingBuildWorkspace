import { describe, expect, test } from 'vitest'
import { fixtureActivities } from '../test-fixture'
import type { NbcActivity, SubmissionEntry } from '../types'
import { updateCounts, updateItems } from './updateList'

const base: NbcActivity = {
  ...fixtureActivities()[1]!,
  id: 'a:0',
  wbs: '0',
  name: 'Base',
  description: '',
  parentId: null,
  editable: false,
  relativeWeight: 1,
  globalWeight: 0,
  baseline: 0,
  progress: 0,
  order: 0,
  handler: '',
  remark: '',
  history: [],
}

function entry(activity: NbcActivity, previous = activity.baseline, progress = activity.progress): SubmissionEntry {
  return {
    activityId: activity.id,
    previous,
    progress,
    remark: activity.remark,
    baseRevision: '',
  }
}

describe('updateList', () => {
  test('need hides finished rows', () => {
    const acts: NbcActivity[] = [
      { ...base, id: 'g1', wbs: '1', name: 'Group', order: 1 },
      { ...base, id: 'l1', wbs: '1.1', name: 'Done task', parentId: 'g1', editable: true, handler: 'Tola', baseline: 1, progress: 1, order: 2 },
      { ...base, id: 'l2', wbs: '1.2', name: 'Open task', parentId: 'g1', editable: true, handler: 'Tola', baseline: 0.2, progress: 0.2, order: 3 },
    ]
    const shown = [entry(acts[1]!, 1, 1), entry(acts[2]!, 0.2, 0.2)]
    const baseInput = {
      activities: acts,
      handler: 'Tola' as const,
      shown,
      changed: new Set<string>(),
      problems: new Set<string>(),
      touched: new Set<string>(),
      query: '',
    }

    const need = updateItems({ ...baseInput, filter: 'need' })
    expect(need.filter((x) => x.kind === 'activity').map((x) => x.id)).toEqual(['l2'])

    const all = updateItems({ ...baseInput, filter: 'all' })
    expect(all.filter((x) => x.kind === 'activity').map((x) => x.id)).toEqual(['l1', 'l2'])
  })

  test('touched rows stay under need', () => {
    const acts: NbcActivity[] = [
      { ...base, id: 'g1', wbs: '1', name: 'Group', order: 1 },
      { ...base, id: 'l1', wbs: '1.1', name: 'Done task', parentId: 'g1', editable: true, handler: 'Tola', baseline: 1, progress: 1, order: 2 },
    ]
    const shown = [entry(acts[1]!, 1, 1)]
    const items = updateItems({
      activities: acts,
      handler: 'Tola',
      shown,
      changed: new Set(),
      problems: new Set(),
      touched: new Set(['l1']),
      filter: 'need',
      query: '',
    })
    expect(items.filter((x) => x.kind === 'activity').map((x) => x.id)).toEqual(['l1'])
  })

  test('chg shows changed and problems only', () => {
    const acts: NbcActivity[] = [
      { ...base, id: 'g1', wbs: '1', name: 'Group', order: 1 },
      { ...base, id: 'l1', wbs: '1.1', name: 'Changed', parentId: 'g1', editable: true, handler: 'Tola', baseline: 0.2, progress: 0.5, order: 2 },
      { ...base, id: 'l2', wbs: '1.2', name: 'Invalid', parentId: 'g1', editable: true, handler: 'Tola', baseline: 0.3, progress: 0.3, order: 3 },
      { ...base, id: 'l3', wbs: '1.3', name: 'Untouched', parentId: 'g1', editable: true, handler: 'Tola', baseline: 0.4, progress: 0.4, order: 4 },
    ]
    const shown = [entry(acts[1]!, 0.2, 0.5), entry(acts[2]!, 0.3, 0.3), entry(acts[3]!, 0.4, 0.4)]
    const items = updateItems({
      activities: acts,
      handler: 'Tola',
      shown,
      changed: new Set(['l1']),
      problems: new Set(['l2']),
      touched: new Set(),
      filter: 'chg',
      query: '',
    })
    expect(items.filter((x) => x.kind === 'activity').map((x) => x.id)).toEqual(['l1', 'l2'])
  })

  test('headings precede their leaves and are not repeated', () => {
    const acts: NbcActivity[] = [
      { ...base, id: 'f18', wbs: '1', name: 'Level 18', order: 1 },
      { ...base, id: 'r1', wbs: '1.1', name: 'Guest Room ST1', parentId: 'f18', order: 2 },
      { ...base, id: 't1', wbs: '1.1.1', name: 'Wall Finishes', parentId: 'r1', order: 3 },
      { ...base, id: 'l1', wbs: '1.1.1.1', name: 'Primer coat', parentId: 't1', editable: true, handler: 'Tola', progress: 0.2, order: 4 },
      { ...base, id: 'l2', wbs: '1.1.1.2', name: 'Finish coat', parentId: 't1', editable: true, handler: 'Tola', progress: 0.2, order: 5 },
      { ...base, id: 't2', wbs: '1.1.2', name: 'Floor Finishes', parentId: 'r1', order: 6 },
      { ...base, id: 'l3', wbs: '1.1.2.1', name: 'Tiling', parentId: 't2', editable: true, handler: 'Tola', progress: 0.2, order: 7 },
    ]
    const shown = [entry(acts[3]!), entry(acts[4]!), entry(acts[6]!)]
    const items = updateItems({
      activities: acts,
      handler: 'Tola',
      shown,
      changed: new Set(),
      problems: new Set(),
      touched: new Set(),
      filter: 'all',
      query: '',
    })
    expect(items.map((x) => (x.kind === 'heading' ? `H:${x.path}` : `A:${x.id}`))).toEqual([
      'H:Level 18 › Guest Room ST1 › Wall Finishes',
      'A:l1',
      'A:l2',
      'H:Level 18 › Guest Room ST1 › Floor Finishes',
      'A:l3',
    ])
    for (let i = 1; i < items.length; i++) {
      expect(items[i - 1]!.kind === 'heading' && items[i]!.kind === 'heading').toBe(false)
    }
  })

  test('query matches an ancestor name', () => {
    const acts = fixtureActivities()
    const shown = [entry(acts[2]!, 0.25, 0.25)]
    const items = updateItems({
      activities: acts,
      handler: 'Tola',
      shown,
      changed: new Set(),
      problems: new Set(),
      touched: new Set(),
      filter: 'all',
      query: 'test area',
    })
    expect(items.filter((x) => x.kind === 'activity').map((x) => x.id)).toEqual(['nbc:1.6.1.2'])
  })

  test("other handlers' leaves never appear", () => {
    const acts = fixtureActivities()
    // Even if another handler's leaf id is somehow passed in shown, updateItems restricts to `handler`.
    const shown = [entry(acts[1]!, 1, 1), entry(acts[2]!, 0.25, 0.25)]
    const items = updateItems({
      activities: acts,
      handler: 'Tola',
      shown,
      changed: new Set(),
      problems: new Set(),
      touched: new Set(),
      filter: 'all',
      query: '',
    })
    expect(items.filter((x) => x.kind === 'activity').map((x) => x.id)).toEqual(['nbc:1.6.1.2'])
  })

  test('shared cell: each handler sees only their half', () => {
    const acts: NbcActivity[] = [
      { ...base, id: 'f9', wbs: '9', name: 'Floor 9', order: 1, roomList: ['R1'], roomLabels: ['Room R1'] },
      { ...base, id: 't1', wbs: '9.1', name: 'Wall', parentId: 'f9', order: 2 },
      { ...base, id: 'h1', wbs: '9.1.1', name: 'R1', room: 'R1', parentId: 't1', editable: true, handler: 'Tola', progress: 0.4, order: 3 },
      { ...base, id: 'h2', wbs: '9.1.2', name: 'R1', room: 'R1', coOf: 'h1', parentId: 't1', editable: true, handler: 'Sitha', progress: 0.6, order: 4 },
    ]
    const tola = updateItems({
      activities: acts,
      handler: 'Tola',
      shown: [entry(acts[2]!, 0.4, 0.4)],
      changed: new Set(),
      problems: new Set(),
      touched: new Set(),
      filter: 'all',
      query: '',
      floorId: 'f9',
    })
    expect(tola.filter((x) => x.kind === 'activity').map((x) => ({ id: x.id, label: x.kind === 'activity' ? x.label : '' }))).toEqual([
      { id: 'h1', label: 'Room R1' },
    ])

    const sitha = updateItems({
      activities: acts,
      handler: 'Sitha',
      shown: [entry(acts[3]!, 0.6, 0.6)],
      changed: new Set(),
      problems: new Set(),
      touched: new Set(),
      filter: 'all',
      query: '',
      floorId: 'f9',
    })
    expect(sitha.filter((x) => x.kind === 'activity').map((x) => x.id)).toEqual(['h2'])
  })

  test('counts', () => {
    const acts: NbcActivity[] = [
      { ...base, id: 'l1', wbs: '1.1', name: 'A', editable: true, handler: 'Tola', baseline: 1, progress: 1, order: 1 },
      { ...base, id: 'l2', wbs: '1.2', name: 'B', editable: true, handler: 'Tola', baseline: 0.5, progress: 0.7, order: 2 },
      { ...base, id: 'l3', wbs: '1.3', name: 'C', editable: true, handler: 'Tola', baseline: 0.2, progress: 0.2, order: 3 },
    ]
    const shown = [entry(acts[0]!, 1, 1), entry(acts[1]!, 0.5, 0.7), entry(acts[2]!, 0.2, 0.2)]
    expect(updateCounts(shown, 1)).toEqual({ need: 2, chg: 1, all: 3 })
  })
})
