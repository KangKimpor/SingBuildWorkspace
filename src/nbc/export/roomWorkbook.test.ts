import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { unzipSync, strFromU8 } from 'fflate'
import { describe, expect, test } from 'vitest'
import { calculate } from '../progress'
import { roomFloors, visibleRoomRows } from '../rooms'
import type { NbcActivity } from '../types'
import { roomWorkbook } from './roomWorkbook'

/** Two floors, three rooms (the last is the corridor). Floor 2 has no corridor column. */
function fixture(): NbcActivity[] {
  const out: NbcActivity[] = []
  let order = 0
  const base = { projectId: 'nbc-bp02', description: '', area: '', location: '', trade: '', handler: '', remark: '', history: [], duration: null, boqValue: null, schedule: null, sourcePrevious: 0, sourceWeekly: 0, baseline: 0, progress: 0 }
  const node = (wbs: string, parent: string | null, name: string, extra: Partial<NbcActivity>) => { const a = { ...base, id: `nbc-bp02:${wbs}`, wbs, parentId: parent ? `nbc-bp02:${parent}` : null, order: ++order, name, editable: false, relativeWeight: 1, globalWeight: 0, ...extra } as NbcActivity; out.push(a); return a }
  for (const [f, rooms] of [['23', ['R1', 'R2', 'CRD']], ['22', ['R1', 'R2']]] as const) {
    const floor = `1.8.1.${f}`
    node(floor, null, `Floor ${f}`, { relativeWeight: 0.5, globalWeight: 0.5, roomList: [...rooms] })
    node(`${floor}.1`, floor, 'GUESTROOM', { item: 'A', relativeWeight: 0.6 })
    node(`${floor}.1.1`, `${floor}.1`, 'Setting Out', { item: 'I', relativeWeight: 1 })
    node(`${floor}.1.1.1`, `${floor}.1.1`, 'Unit Setting Out', { relativeWeight: 1 })
    rooms.filter((r) => r !== 'CRD').forEach((room, i) => node(`${floor}.1.1.1.${i + 1}`, `${floor}.1.1.1`, `Unit Setting Out — ${room}`, { room, editable: true, handler: 'Sitha', progress: i ? 0.5 : 1, globalWeight: 0.15 * (f === '23' ? 1 : 1.5) / 1 }))
    node(`${floor}.2`, floor, 'MEP WORKS', { item: 'C', relativeWeight: 0.4 })
    node(`${floor}.2.1`, `${floor}.2`, 'ELECTRICAL SYSTEM', { item: 'I', relativeWeight: 1 })
    node(`${floor}.2.1.1`, `${floor}.2.1`, 'Lighting system', { item: '1', relativeWeight: 1 })
    node(`${floor}.2.1.1.1`, `${floor}.2.1.1`, 'Installation EMT Conduit', { item: '1.1', relativeWeight: 1 })
    rooms.forEach((room, i) => node(`${floor}.2.1.1.1.${i + 1}`, `${floor}.2.1.1.1`, `Installation EMT Conduit — ${room}`, { room, editable: true, handler: 'Tola', progress: 0.25 * (i + 1), globalWeight: 0.1 }))
  }
  return out
}

describe('room matrix model', () => {
  test('floors expose their room columns and one task row per matrix line', () => {
    const [first, second] = roomFloors(fixture())
    expect(first!.rooms).toEqual(['R1', 'R2', 'CRD'])
    expect(second!.rooms).toEqual(['R1', 'R2'])
    const tasks = first!.rows.filter((r) => r.task)
    expect(tasks.map((r) => r.activity.name)).toEqual(['Unit Setting Out', 'Installation EMT Conduit'])
    // Same task, different percentage per room.
    expect([...tasks[0]!.cells.values()].map((l) => l.progress)).toEqual([1, 0.5])
    expect(tasks[1]!.cells.has('CRD')).toBe(true)
    expect(tasks[0]!.cells.has('CRD')).toBe(false)
  })

  test('collapsed groups hide their tasks and filters keep only matching rows with their groups', () => {
    const floor = roomFloors(fixture())[0]!
    const names = (rows: ReturnType<typeof visibleRoomRows>) => rows.map((r) => r.activity.name)
    expect(names(visibleRoomRows(floor, () => true, new Set()))).toContain('Installation EMT Conduit')
    expect(names(visibleRoomRows(floor, () => true, new Set(['nbc-bp02:1.8.1.23.2'])))).toEqual(['GUESTROOM', 'Setting Out', 'Unit Setting Out', 'MEP WORKS'])
    expect(names(visibleRoomRows(floor, (r) => r.activity.name.startsWith('Install'), new Set()))).toEqual(['MEP WORKS', 'ELECTRICAL SYSTEM', 'Lighting system', 'Installation EMT Conduit'])
  })
})

describe('room workbook', () => {
  test('writes Overall, floor and handler sheets with formulas and cached values', () => {
    const { bytes } = roomWorkbook(fixture(), [], '2026-10-25')
    const files = unzipSync(bytes), text = (name: string) => strFromU8(files[name]!)
    expect([...text('xl/workbook.xml').matchAll(/<sheet name="([^"]+)"/g)].map((m) => m[1])).toEqual(['Overall Progress', 'Floor 23', 'Floor 22', 'Sitha', 'Lychhinh', 'Chhorvaon', 'Srun', 'Kheng', 'Tola'])
    expect(text('xl/worksheets/sheet1.xml')).toContain('Reporting week: 25 October to 31 October 2026')
    const floor = text('xl/worksheets/sheet2.xml')
    expect(floor).toContain('<f>Sitha!D')
    expect(floor).toContain('R1</t>')
    expect(text('xl/worksheets/sheet4.xml')).toContain('Unit Setting Out')
    expect(text('xl/workbook.xml')).toContain('fullCalcOnLoad')
  })
})

/** Splits a room leaf into two halves of 50% weight each, like the Water Closet / Lavatory / Shower rooms. */
function share(activities: NbcActivity[], id: string, second: string, progress: number): NbcActivity[] {
  return activities.flatMap((a) => a.id !== id ? [a] : [
    { ...a, relativeWeight: a.relativeWeight / 2, globalWeight: a.globalWeight / 2 },
    { ...a, id: `${a.id}.2`, wbs: `${a.wbs}.2`, coOf: a.id, handler: second, progress, baseline: progress, history: [], relativeWeight: a.relativeWeight / 2, globalWeight: a.globalWeight / 2 },
  ])
}

describe('cells shared by two handlers', () => {
  const split = () => share(fixture(), 'nbc-bp02:1.8.1.23.2.1.1.1.1', 'Chhorvaon', 0.25)
  test('the matrix keeps one cell per room with both halves', () => {
    const task = roomFloors(split())[0]!.rows.find((r) => r.activity.name === 'Installation EMT Conduit')!
    expect(task.cells.get('R1')!.handler).toBe('Tola')
    expect(task.co.get('R1')!.handler).toBe('Chhorvaon')
    expect(task.co.has('R2')).toBe(false)
    expect(task.leaves).toHaveLength(4)
  })
  test('the overall progress does not change', () => {
    expect(calculate(split()).overall).toBeCloseTo(calculate(fixture()).overall, 12)
    expect(roomWorkbook(split(), [], '2026-10-25').overall).toBeCloseTo(roomWorkbook(fixture(), [], '2026-10-25').overall, 12)
  })
  test('the workbook shows the cell as one activity and each handler their own half', () => {
    const files = unzipSync(roomWorkbook(split(), [], '2026-10-25').bytes), text = (name: string) => strFromU8(files[name]!)
    expect(text('xl/worksheets/sheet2.xml')).toMatch(/<f>AVERAGE\(Tola!D\d+,Chhorvaon!D\d+\)<\/f>/)
    expect(text('xl/worksheets/sheet6.xml')).toContain('Installation EMT Conduit')
    expect(text('xl/worksheets/sheet9.xml')).toContain('Installation EMT Conduit')
  })
})

/**
 * The report's formulas in miniature: 3 guestrooms (floor X has 2, floor Y has 1), a task one room does not have, and a MEP row.
 * Leaf weights follow the report: guestroom and MEP weigh a floor by its rooms, a room scores the tasks it has.
 */
function weekly(): NbcActivity[] {
  const out: NbcActivity[] = []
  let order = 0
  const base = { projectId: 'nbc-bp02', description: '', area: '', location: '', trade: '', handler: '', remark: '', history: [], duration: null, boqValue: null, schedule: null, sourcePrevious: 0, sourceWeekly: 0, baseline: 0, progress: 0 }
  const node = (wbs: string, parent: string | null, name: string, extra: Partial<NbcActivity>) => out.push({ ...base, id: `nbc-bp02:${wbs}`, wbs, parentId: parent ? `nbc-bp02:${parent}` : null, order: ++order, name, editable: false, relativeWeight: 1, globalWeight: 0, ...extra } as NbcActivity)
  const leaf = (wbs: string, parent: string, room: string, handler: string, progress: number, share: number, gw: number) => node(wbs, parent, room, { room, editable: true, handler, progress, baseline: progress, relativeWeight: share, globalWeight: gw })
  node('x', null, 'Floor 23', { roomList: ['a', 'b'] })
  node('x.1', 'x', 'GUESTROOM', { item: 'A', relativeWeight: 0.6 }); node('x.1.1', 'x.1', 'Group', { item: 'I' })
  node('x.1.1.1', 'x.1.1', 'T1', { relativeWeight: 0.75 }); node('x.1.1.2', 'x.1.1', 'T2', { relativeWeight: 0.25 })
  // Room a has both tasks; room b has no T2, so its T1 carries the whole room: 0.5 / (2 rooms x 0.5).
  leaf('x.1.1.1.1', 'x.1.1.1', 'a', 'Sitha', 1, 0.25, 0.6 * (2 / 3) * 0.25); leaf('x.1.1.1.2', 'x.1.1.1', 'b', 'Sitha', 0.5, 0.5, 0.6 * (2 / 3) * 0.5)
  leaf('x.1.1.2.1', 'x.1.1.2', 'a', 'Sitha', 0, 0.25, 0.6 * (2 / 3) * 0.25)
  node('x.2', 'x', 'MEP WORKS', { item: 'C', relativeWeight: 0.4 }); node('x.2.1', 'x.2', 'SYSTEM', { item: 'I' }); node('x.2.1.1', 'x.2.1', 'Sub', { item: '1' })
  node('x.2.1.1.1', 'x.2.1.1', 'Task', { item: '1.1' })
  leaf('x.2.1.1.1.1', 'x.2.1.1.1', 'a', 'Tola', 0.5, 1, 0.4 * (2 / 3) / 2); leaf('x.2.1.1.1.2', 'x.2.1.1.1', 'b', 'Tola', 1, 1, 0.4 * (2 / 3) / 2)
  node('y', null, 'Floor 22', { roomList: ['c'] })
  node('y.1', 'y', 'GUESTROOM', { item: 'A', relativeWeight: 0.6 }); node('y.1.1', 'y.1', 'Group', { item: 'I' })
  node('y.1.1.1', 'y.1.1', 'T1', { relativeWeight: 0.5 }); node('y.1.1.2', 'y.1.1', 'T2', { relativeWeight: 0.5 })
  leaf('y.1.1.1.1', 'y.1.1.1', 'c', 'Sitha', 0.2, 0.5, 0.6 / 3 * 0.5); leaf('y.1.1.2.1', 'y.1.1.2', 'c', 'Sitha', 0.8, 0.5, 0.6 / 3 * 0.5)
  node('y.2', 'y', 'MEP WORKS', { item: 'C', relativeWeight: 0.4 }); node('y.2.1', 'y.2', 'SYSTEM', { item: 'I' }); node('y.2.1.1', 'y.2.1', 'Sub', { item: '1' })
  node('y.2.1.1.1', 'y.2.1.1', 'Task', { item: '1.1' })
  leaf('y.2.1.1.1.1', 'y.2.1.1.1', 'c', 'Tola', 0.25, 1, 0.4 / 3)
  return out
}

describe('the report formulas', () => {
  test('the project figure weighs floors by their guestrooms and equals the weighted sum of the leaves', () => {
    const activities = weekly()
    // Guestroom: floor X rooms score 0.5 (a: T1 and T2 equally) and 0.5 (b: T1 only), floor Y 0.5; MEP 0.75 and 0.25 -> 0.6 x 0.5 + 0.4 x (2 x 0.75 + 0.25) / 3.
    const expected = 0.6 * 0.5 + 0.4 * ((2 * 0.75 + 0.25) / 3)
    expect(calculate(activities).overall).toBeCloseTo(expected, 12)
    expect(roomWorkbook(activities, [], '2026-11-08').overall).toBeCloseTo(expected, 12)
  })
  test('the Overall sheet reads the room counts and weighs the sections 60 / 40', () => {
    const files = unzipSync(roomWorkbook(weekly(), [], '2026-11-08').bytes), overall = strFromU8(files['xl/worksheets/sheet1.xml']!)
    expect(overall).toContain('Guestrooms (floor weight of Guestroom and MEP)')
    expect(overall).toContain('<c r="E5"')
    expect(overall).toMatch(/<f>SUMPRODUCT\(\$E\$5:\$F\$5,E\d+:F\d+\)\/SUM\(\$E\$5:\$F\$5\)<\/f>/)
    expect(overall).toMatch(/<c r="D6"[^>]*><f>\$C\$\d+\*D\d+\+\$C\$\d+\*D\d+<\/f>/)
  })
  test('a room scores the tasks it has: the floor sheet re-weights over the cells that hold a number', () => {
    const files = unzipSync(roomWorkbook(weekly(), [], '2026-11-08').bytes), floor = strFromU8(files['xl/worksheets/sheet2.xml']!)
    expect(floor).toContain('SUMPRODUCT((')
    const plain = floor.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"')
    expect(plain).toMatch(/IFERROR\(\(\$C\d+\*N\(D\d+\)\)\/\(\$C\d+\*\(D\d+<>""\)\),""\)/)
    expect(floor).toMatch(/IFERROR\(AVERAGE\(D\d+:E\d+\),0\)/)
  })
})

// Full-size check against the client's weekly report (python scripts/nbc-bp02-report-extract.py REPORT.xlsx); runs only where the private extract exists.
const source = '.private/nbc-bp02-weekly/initial.json'
describe.skipIf(!existsSync(source))('BP02 dataset', () => {
  test('overall matches the report and the export covers every room', () => {
    const data = JSON.parse(readFileSync(source, 'utf8')) as { activities: NbcActivity[]; reconciliation: { workbookOverall: number } }
    expect(Math.abs(calculate(data.activities).overall - data.reconciliation.workbookOverall)).toBeLessThan(1e-9)
    const { bytes, overall } = roomWorkbook(data.activities, [], '2026-11-08')
    expect(Math.abs(overall - data.reconciliation.workbookOverall)).toBeLessThan(1e-9)
    if (process.env.ROOM_EXPORT_OUT) writeFileSync(process.env.ROOM_EXPORT_OUT, bytes)
    expect(bytes.byteLength).toBeGreaterThan(100_000)
  })
})
