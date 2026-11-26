import { expect, test } from 'vitest'
import { nextOf, onsitePatch, procurementOf, procurementPatch, qtyOf, sampleSkipPatch, sampleSkipped, sectionTree, snapshot, stageOf, stagePatch, submissionOf, submissionPatch } from './stage'
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

test('each material sits under the same nested sections as on the Sheet', () => {
  const sec = (id: string, pos: number, level: number, end?: number, cols: MatItem['data']['cols'] = { no: id, description: `S ${id}` }): MatItem =>
    ({ id, package: 'bp03', sheet: 'id', pos, kind: 'section', edits: {}, updatedAt: '', data: { cols, cells: {}, level, end } })
  const at = (id: string, pos: number): MatItem => ({ ...item({}), id, pos })
  const rows = [
    sec('1', 1, 0, 6, { no: '1', code: 'Wall Finishing' }), sec('1.1', 2, 1, 6, { no: '1.1', pic: 'L23 Club Lounge' }), sec('1.1.1', 3, 2, 4), at('a', 4),
    sec('1.1.2', 5, 2, 6), at('b', 6), at('c', 7), sec('2', 8, 0), at('d', 9),
  ]
  const { sections, pathOf } = sectionTree(rows)
  const ids = (id: string) => pathOf.get(id)?.map((s) => s.id)
  expect(ids('a')).toEqual(['1', '1.1', '1.1.1'])
  expect(ids('b')).toEqual(['1', '1.1', '1.1.2'])
  expect(ids('c')).toBeUndefined() // past every enclosing section's end
  expect(ids('d')).toEqual(['2'])
  expect(sections.map((s) => [s.label, s.depth, s.parent])).toEqual([
    ['1 Wall Finishing', 0, null], ['1.1 L23 Club Lounge', 1, '1'], ['1.1.1 S 1.1.1', 2, '1.1'], ['1.1.2 S 1.1.2', 2, '1.1'], ['2 S 2', 0, null],
  ])
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

test('a resubmission takes the date given; a first submission keeps the date already recorded', () => {
  const revise = item({ msActual: '2026-10-01', msStatus: 'Revise & Resubmit' })
  expect(stagePatch(revise, 'review', '2026-11-25')).toMatchObject({ msActual: '2026-11-25', msStatus: 'Under Review' })
  // Already submitted on 1 Oct and marked Under Review again: the recorded date stays (null = the workbook's own value).
  const submitted = item({ msActual: '2026-10-01', msStatus: 'Approved' })
  expect(stagePatch(submitted, 'review', '2026-11-25')).toMatchObject({ msActual: null })
})

test('a total the workbook holds as text is kept as text, not read as zero', () => {
  const it: MatItem = { ...item({ unit: 'set' }), data: { cols: { unit: 'set' }, cells: { total: { v: 'As per BOQ' }, onsite: { v: 0 } } } }
  expect(qtyOf(it)).toMatchObject({ total: 0, totalText: 'As per BOQ' })
  expect(qtyOf(item({}, [10, 0, 0])).totalText).toBeNull()
})

test('initials use the first and last word, skip suffixes and keep whole characters', async () => {
  const { initials } = await import('./MatItems')
  expect(initials('Christopher Alexander Montgomery III')).toBe('CM')
  expect(initials('Đặng Thị Ngọc Hân')).toBe('ĐH')
  expect(initials('Jo')).toBe('J')
  expect(initials('dara')).toBe('D')
  expect(initials('🦊 Fox')).toBe('🦊F')
  expect(initials('  ')).toBe('?')
})

test('submission and procurement are separate tracks, with Production, Waiting for shipment and Shipping between ordered and on site', () => {
  const ordered = item({ msStatus: 'Under Review', msActual: '2026-10-01' }, [10, 10, 0])
  const withFormulas: MatItem = { ...ordered, data: { ...ordered.data, cells: { ...ordered.data.cells, production: { v: 0 }, waiting: { f: 'waiting' }, shipping: { v: 0 }, arrived: { f: 'arrived' } } } }
  expect([submissionOf(withFormulas), procurementOf(withFormulas), stageOf(withFormulas)]).toEqual(['review', 'ordered', 'ordered'])

  const inProdPatch = procurementPatch(withFormulas, 'production', '2026-11-25')
  expect(inProdPatch).toMatchObject({ production: 1, waiting: 0 })
  expect(inProdPatch).not.toHaveProperty('msStatus')
  const inProd: MatItem = { ...withFormulas, edits: { ...(inProdPatch as MatItem['edits']) } }
  expect(procurementOf(inProd)).toBe('production')

  const waitPatch = procurementPatch(inProd, 'waiting', '2026-11-25')
  expect(waitPatch).toMatchObject({ waiting: null })
  const waiting: MatItem = { ...withFormulas, edits: { ...inProd.edits, waiting: undefined } }
  expect(procurementOf(waiting)).toBe('waiting')

  // When a row has no formula for waiting (or a text total), moving to Waiting still sets waiting to 100%.
  const textTotal: MatItem = { ...ordered, data: { ...ordered.data, cells: { total: { v: 'As per BOQ' }, po: { v: 10 }, onsite: { v: 0 }, waiting: { f: 'waiting' } } } }
  const textWait = procurementPatch(textTotal, 'waiting', '2026-11-25')
  expect(textWait).toMatchObject({ production: 1, waiting: 1 })
  expect(procurementOf({ ...textTotal, edits: { ...(textWait as MatItem['edits']) } })).toBe('waiting')

  const shipPatch = procurementPatch(waiting, 'shipping', '2026-11-25')
  expect(shipPatch).toMatchObject({ shipping: 1 })
  const shipping: MatItem = { ...withFormulas, edits: { ...(shipPatch as MatItem['edits']) } }
  expect(procurementOf(shipping)).toBe('shipping')
  expect(procurementOf(item({}, [10, 0, 0]))).toBe('none')

  // Moving the submission leaves the order alone; moving procurement leaves the submission alone.
  const sub = submissionPatch(ordered, 'approved', '2026-11-25')
  expect(sub).toMatchObject({ msStatus: 'Approved', msApproved: '2026-11-25' })
  expect(sub).not.toHaveProperty('po')
  expect(procurementPatch(shipping, 'onsite', '2026-11-25')).toMatchObject({ shipping: null, onsite: 10, arrActual: '2026-11-25' })
})

test('materials can skip submission and sample stages and order directly', () => {
  const direct = item({ msStatus: 'Not Yet Submit' })
  const skip = submissionPatch(direct, 'notreq', '2026-11-25')
  expect(skip).toMatchObject({ msStatus: 'Not Required' })
  const skipped: MatItem = { ...direct, edits: { ...(skip as MatItem['edits']) } }
  expect(submissionOf(skipped)).toBe('notreq')
  expect(nextOf(skipped, '2026-11-25').label).toBe('Place order')

  // Ordering a material whose submission is not required keeps Not Required instead of marking it Approved.
  const orderPatch = stagePatch(skipped, 'ordered', '2026-11-25')
  expect(orderPatch).not.toHaveProperty('msApproved')
  expect(orderPatch).not.toHaveProperty('msStatus')

  // Workbook "N/A" on msActual counts as not required, and moving back to Not submitted clears it.
  const naItem = item({ msActual: 'N/A' })
  expect(submissionOf(naItem)).toBe('notreq')
  const backPatch = submissionPatch(naItem, 'notsub', '2026-11-25')
  expect(backPatch).toMatchObject({ msActual: '', msStatus: 'Not Yet Submit' })
  expect(submissionOf({ ...naItem, edits: { ...(backPatch as MatItem['edits']) } })).toBe('notsub')

  // Sample skip marks ssApproved as N/A and clearing removes both ssApproved and ssActual N/A markers.
  expect(sampleSkipped(direct)).toBe(false)
  const sSkip = sampleSkipPatch(direct, true)
  expect(sSkip).toEqual({ ssApproved: 'N/A' })
  const skippedSample: MatItem = { ...direct, edits: { ...(sSkip as MatItem['edits']) } }
  expect(sampleSkipped(skippedSample)).toBe(true)
  expect(sampleSkipPatch(skippedSample, false)).toEqual({ ssApproved: null })
})
