import { expect, test } from 'vitest'
import { nextOf, onsitePatch, sectionsOf, snapshot, stageOf, stagePatch } from './stage'
import type { MatItem } from './types'

const item = (cols: MatItem['data']['cols'], qty: [number, number, number] = [10, 0, 0], edits: MatItem['edits'] = {}): MatItem => ({
  id: 'i', package: 'bp03', sheet: 'id', pos: 2, kind: 'item', updatedAt: '2026-11-20T00:00:00Z', edits,
  data: { cols, cells: { total: { v: qty[0] }, po: { v: qty[1] }, onsite: { v: qty[2] }, shd: { v: 0 } } },
})

test('the stage follows the furthest step the workbook shows', () => {
  expect(stageOf(item({ msStatus: 'Not Yet Submit' }))).toBe('notsub')
  expect(stageOf(item({ msActual: '2026-10-01' }))).toBe('review')
  expect(stageOf(item({ msActual: '2026-10-01', msStatus: 'Revise & Resubmit' }))).toBe('revise')
  expect(stageOf(item({ msStatus: 'Approved with comments' }))).toBe('approved')
  expect(stageOf(item({ msStatus: 'Approved' }, [10, 10, 0]))).toBe('ordered')
  expect(stageOf(item({}, [10, 10, 4]))).toBe('partial')
  expect(stageOf(item({}, [10, 10, 10]))).toBe('onsite')
})

test('the next step is due from its plan column, approval 14 days after submission', () => {
  expect(nextOf(item({ msPlan: '2026-11-20' }), '2026-11-25')).toMatchObject({ label: 'Submit material', diff: -5 })
  expect(nextOf(item({ msActual: '2026-11-20' }), '2026-11-25')).toMatchObject({ label: 'Get approval', date: '2026-12-04', diff: 9 })
  expect(nextOf(item({}, [10, 10, 10]), '2026-11-25')).toMatchObject({ label: 'Complete', done: true, diff: null })
})

test('moving to a stage keeps earlier dates, stamps missing ones and clears later steps', () => {
  const it = item({ msActual: '2026-10-01', msStatus: 'Under Review', poActual: 'TBC' }, [10, 0, 0])
  expect(stagePatch(it, 'ordered', '2026-11-25')).toMatchObject({ msActual: null, msApproved: '2026-11-25', msStatus: 'Approved', poActual: '2026-11-25', po: 10 })
  expect(stagePatch(item({ msActual: '2026-10-01', msApproved: '2026-10-09', poActual: '2026-10-20' }, [10, 10, 4]), 'review', '2026-11-25'))
    .toMatchObject({ msApproved: '', poActual: '', po: 0, onsite: 0 })
})

test('moving a stage never overwrites workbook text or blank cells', () => {
  const it: MatItem = { ...item({ msStatus: 'Not Yet Submit', poActual: 'n/a' }), data: { cols: { msStatus: 'Not Yet Submit', poActual: 'n/a' }, cells: { total: { v: 'As per BOQ' }, po: { v: 'TBC' }, onsite: { v: null } } } }
  const patch = stagePatch(it, 'review', '2026-11-25')
  expect(patch).toEqual({ msActual: '2026-11-25', msStatus: 'Under Review' })
})

test('On site keeps over-deliveries and works without a numeric total', () => {
  expect(stagePatch(item({}, [40, 40, 60]), 'onsite', '2026-11-25')).not.toHaveProperty('onsite')
  const noTotal = item({}, [0, 0, 5])
  const patch = stagePatch(noTotal, 'onsite', '2026-11-25')
  expect(patch).not.toHaveProperty('onsite')
  expect(stageOf({ ...noTotal, edits: { ...(patch as MatItem['edits']) } })).toBe('onsite')
  expect(onsitePatch(item({ poActual: '2026-11-01' }, [40, 40, 60]), 65, '2026-11-25')).toMatchObject({ onsite: 65 })
})

test('a delivery that reaches the total stamps arrival; undo restores the previous edits exactly', () => {
  const it = item({ poActual: '2026-11-01' }, [10, 10, 4], { onsite: 6 })
  const patch = onsitePatch(it, 10, '2026-11-25')
  expect(patch).toMatchObject({ onsite: 10, arrActual: '2026-11-25' })
  expect(snapshot(it, patch)).toEqual({ onsite: 6, arrActual: null })
})

test('each material belongs to the nearest top-level section above it', () => {
  const sec = (id: string, pos: number, level: number): MatItem => ({ id, package: 'bp03', sheet: 'id', pos, kind: 'section', edits: {}, updatedAt: '', data: { cols: { no: id, description: `S ${id}` }, cells: {}, level } })
  const rows = [sec('A', 1, 0), { ...item({}), id: 'a1' }, sec('A1', 3, 1), { ...item({}), id: 'a2' }, sec('B', 5, 0), { ...item({}), id: 'b1' }]
  const map = sectionsOf(rows)
  expect([map.get('a1')?.id, map.get('a2')?.id, map.get('b1')?.id]).toEqual(['A', 'A', 'B'])
})

test('activity entries read as plain sentences', async () => {
  const { describeLog } = await import('./MatItems')
  const log = (kind: 'fields' | 'remark', detail: Record<string, unknown>) => ({ id: 1, itemId: 'i', at: '', by: null, kind, detail })
  expect(describeLog(log('remark', { team: 'pm', body: 'ETA 2 Dec' }))).toBe('wrote the PM note')
  expect(describeLog(log('fields', { pic: 'Dara' }))).toBe('assigned it to Dara')
  expect(describeLog(log('fields', { msStatus: 'Approved', msApproved: '2026-11-25' }))).toBe('set the status to Approved')
  expect(describeLog(log('fields', { onsite: 40, arrActual: '2026-11-25' }))).toBe('set on site to 40')
  expect(describeLog(log('fields', { msPlan: '2026-12-01' }))).toBe('edited the submission plan date')
  expect(describeLog(log('fields', { brand: null }))).toBe('reset the brand')
})
