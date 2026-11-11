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
    const { bytes } = roomWorkbook(fixture(), [], '2026-10-26')
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
    expect(roomWorkbook(split(), [], '2026-10-26').overall).toBeCloseTo(roomWorkbook(fixture(), [], '2026-10-26').overall, 12)
  })
  test('the workbook shows the cell as one activity and each handler their own half', () => {
    const files = unzipSync(roomWorkbook(split(), [], '2026-10-26').bytes), text = (name: string) => strFromU8(files[name]!)
    expect(text('xl/worksheets/sheet2.xml')).toMatch(/<f>AVERAGE\(Tola!D\d+,Chhorvaon!D\d+\)<\/f>/)
    expect(text('xl/worksheets/sheet6.xml')).toContain('Installation EMT Conduit')
    expect(text('xl/worksheets/sheet9.xml')).toContain('Installation EMT Conduit')
  })
})

// Full-size check against the client's workbook; runs only where the private extract exists.
const source = '.private/nbc-bp02-rooms/initial.json'
describe.skipIf(!existsSync(source))('BP02 dataset', () => {
  test('overall matches the reference workbook and the export covers every room', () => {
    const data = JSON.parse(readFileSync(source, 'utf8')) as { activities: NbcActivity[]; reconciliation: { workbookOverall: number } }
    expect(Math.abs(calculate(data.activities).overall - data.reconciliation.workbookOverall)).toBeLessThan(1e-5)
    const { bytes, overall } = roomWorkbook(data.activities, [], '2026-10-26')
    expect(Math.abs(overall - data.reconciliation.workbookOverall)).toBeLessThan(1e-5)
    if (process.env.ROOM_EXPORT_OUT) writeFileSync(process.env.ROOM_EXPORT_OUT, bytes)
    expect(bytes.byteLength).toBeGreaterThan(100_000)
  })
})
