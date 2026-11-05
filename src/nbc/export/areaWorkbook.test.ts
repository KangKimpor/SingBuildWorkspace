import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, test } from 'vitest'
import { normalizeActivity } from '../normalize'
import { calculate } from '../progress'
import { isAreaProject, roomFloors } from '../rooms'
import type { NbcActivity } from '../types'
import { areaWorkbook } from './areaWorkbook'

/**
 * A BP04-shaped project in miniature. ID: zones .6/.4, one section, task A in both areas and task B in area 1 only (N/A in area 2).
 * MEP: one system, one sub-system, two tasks in both areas. ID area k is fed by MEP area k.
 * Overall = .7 * ID + .3 * MEP, so the leaf weights are .21 .28 .21 for the ID leaves and .09 .06 .09 .06 for the MEP leaves.
 */
function fixture(): NbcActivity[] {
  const out: NbcActivity[] = []
  let order = 0
  const base = { projectId: 'nbc-bp04', description: '', area: '', location: '', trade: '', handler: '', remark: '', history: [], duration: null, boqValue: null, schedule: null, sourcePrevious: 0, sourceWeekly: 0, baseline: 0, progress: 0 }
  const node = (wbs: string, parent: string | null, name: string, extra: Partial<NbcActivity>) => { const a = { ...base, id: `nbc-bp04:${wbs}`, wbs, parentId: parent ? `nbc-bp04:${parent}` : null, order: ++order, name, editable: false, relativeWeight: 1, globalWeight: 0, ...extra } as NbcActivity; out.push(a); return a }
  node('1', null, 'ID', { panel: 'ID', roomList: ['ID-1', 'ID-2'], roomLabels: ['ID-1\nLobby', 'ID-2\nSuite'], zone: [0.6, 0.4], links: { 'ID-1': ['M1'], 'ID-2': ['M2'] }, relativeWeight: 0.7 })
  node('2', null, 'MEP', { panel: 'MEP', roomList: ['M1', 'M2'], relativeWeight: 0.3 })
  node('1.1', '1', 'Setting Out', { item: 'I' })
  node('1.1.1', '1.1', 'Task A', {}); node('1.1.2', '1.1', 'Task B', {})
  const leaf = (wbs: string, parent: string, room: string, handler: string, progress: number, gw: number, rel = 1) => node(wbs, parent, room, { room, editable: true, handler, progress, baseline: progress, sourcePrevious: progress, globalWeight: gw, relativeWeight: rel })
  leaf('1.1.1.1', '1.1.1', 'ID-1', 'Vuth', 1, 0.21, 0.6); leaf('1.1.1.2', '1.1.1', 'ID-2', 'Vuth', 0.5, 0.28, 0.4); leaf('1.1.2.1', '1.1.2', 'ID-1', 'Kheng', 0.2, 0.21, 0.6)
  node('2.1', '2', 'Electrical System', { item: 'I' }); node('2.1.1', '2.1', 'Lighting System', { item: '1' })
  node('2.1.1.1', '2.1.1', 'Conduit', { item: '1.1', relativeWeight: 0.5 }); node('2.1.1.2', '2.1.1', 'Cable', { item: '1.2', relativeWeight: 0.5 })
  leaf('2.1.1.1.1', '2.1.1.1', 'M1', 'Tola', 0.8, 0.09); leaf('2.1.1.1.2', '2.1.1.1', 'M2', 'Tola', 0.4, 0.06)
  leaf('2.1.1.2.1', '2.1.1.2', 'M1', 'Tola', 0.1, 0.09); leaf('2.1.1.2.2', '2.1.1.2', 'M2', 'Tola', 0, 0.06)
  return out
}
const expectedOverall = 0.7 * (0.6 * (0.5 * 1 + 0.5 * 0.2) + 0.4 * 0.5) + 0.3 * (0.6 * (0.5 * 0.8 + 0.5 * 0.1) + 0.4 * (0.5 * 0.4))

describe('area panels', () => {
  test('ID and MEP are two panels with their own area columns, N/A tasks have no cell', () => {
    const [id, mep] = roomFloors(fixture())
    expect(isAreaProject(fixture())).toBe(true)
    expect(id!.rooms).toEqual(['ID-1', 'ID-2']); expect(id!.labels[0]).toBe('ID-1\nLobby')
    expect(mep!.rooms).toEqual(['M1', 'M2']); expect(mep!.labels).toEqual(['M1', 'M2'])
    expect(id!.rows.find((r) => r.activity.name === 'Task B')!.cells.has('ID-2')).toBe(false)
  })
  test('rows stored without repeated fields get them back', () => {
    const row = normalizeActivity({ id: 'x', progress: 0.4, editable: true, handler: 'Tola' })
    expect(row).toMatchObject({ baseline: 0.4, sourcePrevious: 0.4, history: [], remark: '', description: '', handler: 'Tola' })
    expect(normalizeActivity({ id: 'y', progress: 1, editable: true, baseline: 0.5 }).baseline).toBe(0.5)
  })
})

describe('area workbook', () => {
  const read = (bytes: Uint8Array) => { const files = unzipSync(bytes); return (name: string) => strFromU8(files[name]!) }
  test('writes Overall, ID, MEP and all seven handler sheets with formulas and cached values', () => {
    const activities = fixture()
    expect(Math.abs(calculate(activities).overall - expectedOverall)).toBeLessThan(1e-12)
    const { bytes, overall } = areaWorkbook(activities, [], '2026-10-26')
    expect(Math.abs(overall - expectedOverall)).toBeLessThan(1e-12)
    const text = read(bytes), book = text('xl/workbook.xml')
    expect([...book.matchAll(/<sheet name="([^"]+)"/g)].map((m) => m[1])).toEqual(['Overall Progress', 'BP-04 (ID)', 'BP-04 (MEP)', 'Sitha', 'Lychhinh', 'Chhorvaon', 'Srun', 'Kheng', 'Vuth', 'Tola'])
    const idSheet = text('xl/worksheets/sheet2.xml')
    expect(idSheet).toContain('<f>Vuth!D7</f>') // Task A, first area, links to the handler's cell
    expect(idSheet).toContain('<t xml:space="preserve">N/A</t>') // Task B is N/A in the second area
    expect(idSheet).toMatch(/<f>IFERROR\(SUMPRODUCT\(--ISNUMBER\(F8:F9\),\$E\$8:\$E\$9,F8:F9\)[^<]*<\/f><v>0\.6<\/v>/) // section value in area 1 = (1 + .2) / 2
    expect(text('xl/worksheets/sheet9.xml')).toContain('VUTH - INTERIOR DESIGN (ID)')
    expect(text('xl/worksheets/sheet10.xml')).toContain('TOLA - MEP WORKS')
    expect(book).toContain('fullCalcOnLoad')
  })
  test('an edited percentage moves the overall by its leaf weight', () => {
    const edited = fixture().map((a) => a.wbs === '1.1.1.2' ? { ...a, progress: 1 } : a)
    expect(areaWorkbook(edited, [], '2026-10-26').overall - areaWorkbook(fixture(), [], '2026-10-26').overall).toBeCloseTo(0.28 * 0.5, 12)
  })
})

// Full-size check against the client's workbooks; runs only where the private extract exists.
for (const id of ['nbc-bp03', 'nbc-bp04']) {
  const source = `.private/${id}-rooms/initial.json`
  describe.skipIf(!existsSync(source))(`${id} dataset`, () => {
    const data = existsSync(source) ? JSON.parse(readFileSync(source, 'utf8')) as { activities: Partial<NbcActivity>[]; reconciliation: { workbookOverall: number } } : null
    const activities = (data?.activities ?? []).map((a) => normalizeActivity({ ...a, projectId: id }) as unknown as NbcActivity)
    test('overall matches the reference workbook', () => {
      expect(Math.abs(calculate(activities).overall - data!.reconciliation.workbookOverall)).toBeLessThan(1e-9)
    })
    test('the export reproduces the workbook and follows edits', () => {
      const { bytes, overall } = areaWorkbook(activities, [], '2026-10-26')
      expect(Math.abs(overall - data!.reconciliation.workbookOverall)).toBeLessThan(1e-9)
      if (process.env.AREA_EXPORT_OUT) writeFileSync(process.env.AREA_EXPORT_OUT.replace('{id}', id), bytes)
      // Every leaf moved to an arbitrary percentage: the export's own figure still equals the app's weighted sum.
      const moved = activities.map((a, i) => a.editable ? { ...a, progress: ((i * 37) % 101) / 100 } : a)
      expect(Math.abs(areaWorkbook(moved, [], '2026-10-26').overall - calculate(moved).overall)).toBeLessThan(1e-9)
    })
  })
}
