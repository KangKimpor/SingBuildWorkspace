import { expect, test } from 'vitest'
import { fixtureActivities } from './test-fixture'
import { buildWbsRows, wbsLevel } from './wbs-table'
import type { NbcActivity } from './types'

const base = fixtureActivities()[1]!
function node(wbs: string, parent: string | null, patch: Partial<NbcActivity> = {}): NbcActivity {
  return { ...base, id: `nbc:${wbs}`, wbs, name: wbs, parentId: parent ? `nbc:${parent}` : null, editable: false, relativeWeight: 1, globalWeight: 0.1, baseline: 0, progress: 0, history: [], ...patch }
}
function tree(): NbcActivity[] {
  return [
    node('1.6.1', null, { order: 1 }),
    node('1.6.1.1', '1.6.1', { order: 2 }),
    node('1.6.1.1.1', '1.6.1.1', { order: 3, editable: true, handler: 'A', progress: 1 }),
    node('1.6.1.3', '1.6.1', { order: 4 }),
    node('1.6.1.3.1', '1.6.1.3', { order: 5, editable: true, handler: 'B', progress: 0.5 }),
    node('1.6.1.3.2', '1.6.1.3', { order: 6, editable: true, handler: 'B', progress: 0 }),
  ]
}

test('wbsLevel counts levels below 1.6', () => {
  expect([wbsLevel('1.6.1'), wbsLevel('1.6.1.1.1'), wbsLevel('1.6.1.3.4.2.4')]).toEqual([1, 3, 5])
})

test('wbsLevel treats 1.8.1.3 as level 1 for project BP02', () => {
  expect([wbsLevel('1.8.1.3', 'nbc-bp02'), wbsLevel('1.8.1.3.1', 'nbc-bp02'), wbsLevel('1.8.1.3.1.1', 'nbc-bp02'), wbsLevel('1.8.1.3.1.1.1', 'nbc-bp02')]).toEqual([1, 2, 3, 4])
  expect(wbsLevel('1.8.1.3')).toBe(1)
  expect(wbsLevel('1.8.1.3.1')).toBe(2)
})

test('a handler scope keeps only that handler leaves with their ancestors, indented by level', () => {
  const rows = buildWbsRows(tree(), { leaf: (a) => a.handler === 'A' })
  expect(rows.map((r) => r.activity.wbs)).toEqual(['1.6.1', '1.6.1.1', '1.6.1.1.1'])
  expect(rows.map((r) => r.depth)).toEqual([0, 1, 2])
  expect(rows.map((r) => r.group)).toEqual([true, true, false])
})

test('real WBS numbers are kept when numbers skip', () => {
  expect(buildWbsRows(tree()).map((r) => r.activity.wbs)).toContain('1.6.1.3')
  expect(buildWbsRows(tree()).map((r) => r.activity.wbs)).not.toContain('1.6.1.2')
})

test('collapsing a group hides descendants but keeps its leaf count', () => {
  const rows = buildWbsRows(tree(), { collapsed: new Set(['nbc:1.6.1.3']) })
  expect(rows.map((r) => r.activity.wbs)).not.toContain('1.6.1.3.1')
  expect(rows.find((r) => r.activity.wbs === '1.6.1.3')!.leafCount).toBe(2)
})

test('group progress is the relative-weight average and reflects value overrides', () => {
  const rows = buildWbsRows(tree())
  expect(rows.find((r) => r.activity.wbs === '1.6.1.3')!.progress).toBe(0.25)
  const over = buildWbsRows(tree(), { values: new Map([['nbc:1.6.1.3.2', 1]]) })
  expect(over.find((r) => r.activity.wbs === '1.6.1.3')!.progress).toBe(0.75)
})
