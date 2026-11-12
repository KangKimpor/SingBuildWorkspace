import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { describe, expect, test } from 'vitest'
import type { NbcActivity } from '../types'
import { hasReportPatch, patchWeeklyReport } from './reportPatch'

/** A BP04-shaped project in miniature: ID has Task A (both areas) and Task B (area 1 only); MEP has two tasks in both areas. */
function fixture(progress: Record<string, number> = {}): NbcActivity[] {
  const out: NbcActivity[] = []
  let order = 0
  const base = { projectId: 'nbc-bp04', description: '', area: '', location: '', trade: '', handler: 'Tola', remark: '', history: [], duration: null, boqValue: null, schedule: null, sourcePrevious: 0, sourceWeekly: 0, baseline: 0, progress: 0, editable: false, relativeWeight: 1, globalWeight: 0 }
  const node = (wbs: string, parent: string | null, name: string, extra: Partial<NbcActivity>) => out.push({ ...base, id: `nbc-bp04:${wbs}`, wbs, parentId: parent ? `nbc-bp04:${parent}` : null, order: ++order, name, ...extra } as NbcActivity)
  const leaf = (wbs: string, parent: string, room: string) => node(wbs, parent, room, { room, editable: true, progress: progress[wbs] ?? 0 })
  node('1', null, 'ID', { panel: 'ID', roomList: ['ID-1', 'ID-2'], zone: [0.6, 0.4] })
  node('2', null, 'MEP', { panel: 'MEP', roomList: ['ID-1', 'ID-2'] })
  node('1.1', '1', 'Setting Out', { item: 'I' }); node('1.1.1', '1.1', 'Task A', {}); node('1.1.2', '1.1', 'Task B', {})
  leaf('1.1.1.1', '1.1.1', 'ID-1'); leaf('1.1.1.2', '1.1.1', 'ID-2'); leaf('1.1.2.1', '1.1.2', 'ID-1')
  node('2.1', '2', 'Electrical System', { item: 'I' }); node('2.1.1', '2.1', 'Lighting System', { item: '1' })
  node('2.1.1.1', '2.1.1', 'Conduit', { item: '1.1' }); node('2.1.1.2', '2.1.1', 'Cable', { item: '1.2' })
  leaf('2.1.1.1.1', '2.1.1.1', 'ID-1'); leaf('2.1.1.1.2', '2.1.1.1', 'ID-2'); leaf('2.1.1.2.1', '2.1.1.2', 'ID-1'); leaf('2.1.1.2.2', '2.1.1.2', 'ID-2')
  return out
}

const text = (ref: string, value: string) => `<c r="${ref}" t="inlineStr"><is><t>${value}</t></is></c>`
const num = (ref: string, value: number) => `<c r="${ref}"><v>${value}</v></c>`
const sheet = (rows: Record<number, string>) => `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${Object.entries(rows).map(([r, cells]) => `<row r="${r}">${cells}</row>`).join('')}</sheetData></worksheet>`
function report(extraRows: Record<number, string> = {}) {
  const id = sheet({
    7: text('F7', 'ID-1\nLobby') + text('G7', 'ID-2\nSuite'), 9: text('B9', 'Guestroom') + '<c r="F9"><f>F11</f><v>0.1</v></c>',
    10: text('A10', 'I') + text('B10', 'Setting Out'), 11: text('B11', 'Task A') + num('F11', 0.1) + num('G11', 0.2), 12: text('B12', 'Task B') + num('F12', 0.3) + text('G12', 'N/A'),
  })
  const mep = sheet({
    10: text('F10', 'ID-1') + text('G10', 'ID-2'), 12: text('A12', 'I') + text('B12', 'Electrical System'), 13: text('A13', '1') + text('B13', 'Lighting System'),
    14: text('A14', '1.1') + text('B14', 'Conduit') + num('F14', 0.5) + num('G14', 0.5), 15: text('A15', '1.2') + text('B15', 'Cable') + num('F15', 0.5) + '<c r="G15"><f>F15</f><v>0.5</v></c>', ...extraRows,
  })
  const other = sheet({ 1: num('A1', 0.42) })
  const book = '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="BP-04 (ID)" sheetId="1" r:id="rId1"/><sheet name="BP-04(MEP)" sheetId="2" r:id="rId2"/><sheet name="Other" sheetId="3" r:id="rId3"/></sheets><calcPr calcId="191029"/></workbook>'
  const rels = '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="x" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="x" Target="worksheets/sheet3.xml"/></Relationships>'
  return zipSync({ 'xl/workbook.xml': strToU8(book), 'xl/_rels/workbook.xml.rels': strToU8(rels), 'xl/worksheets/sheet1.xml': strToU8(id), 'xl/worksheets/sheet2.xml': strToU8(mep), 'xl/worksheets/sheet3.xml': strToU8(other) })
}
const read = (bytes: Uint8Array) => { const files = unzipSync(bytes); return (name: string) => strFromU8(files[name]!) }

describe('weekly report update', () => {
  test('writes the app percentages into the constant cells and nothing else', () => {
    const activities = fixture({ '1.1.1.1': 0.9, '1.1.1.2': 0.8, '1.1.2.1': 0.7, '2.1.1.1.1': 0.4, '2.1.1.1.2': 0.3, '2.1.1.2.1': 0.2, '2.1.1.2.2': 0.1 })
    expect(hasReportPatch(activities)).toBe(true)
    const result = patchWeeklyReport(report(), activities, [], '2026-11-02'), file = read(result.bytes)
    const id = file('xl/worksheets/sheet1.xml'), mep = file('xl/worksheets/sheet2.xml')
    expect(id).toContain('<c r="F11"><v>0.9</v></c>'); expect(id).toContain('<c r="G11"><v>0.8</v></c>'); expect(id).toContain('<c r="F12"><v>0.7</v></c>')
    expect(id).toContain('<t>N/A</t>') // Task B is N/A in the second area
    expect(id).toContain('<f>F11</f>') // formulas stay
    expect(mep).toContain('<c r="F14"><v>0.4</v></c>'); expect(mep).toContain('<c r="G14"><v>0.3</v></c>'); expect(mep).toContain('<c r="F15"><v>0.2</v></c>')
    expect(mep).toContain('<c r="G15"><f>F15</f><v>0.5</v></c>') // a linked cell is not overwritten
    expect(file('xl/worksheets/sheet3.xml')).toBe(strFromU8(unzipSync(report())['xl/worksheets/sheet3.xml']!)) // other sheets are copied unchanged
    expect(file('xl/workbook.xml')).toContain('fullCalcOnLoad="1"')
    expect(result).toMatchObject({ updated: 6, unchanged: 0, notInReport: 1, sheets: ['BP-04 (ID)', 'BP-04(MEP)'] })
  })
  test('cells that already hold the value are left alone', () => {
    const result = patchWeeklyReport(report(), fixture({ '1.1.1.1': 0.1, '1.1.1.2': 0.2, '1.1.2.1': 0.3, '2.1.1.1.1': 0.5, '2.1.1.1.2': 0.5, '2.1.1.2.1': 0.5 }), [], '2026-11-02')
    expect(result.updated).toBe(0); expect(result.sheets).toEqual([])
  })
  test('a BP02 room renamed on the ID sheet only is found on the MEP sheet by its unit number', () => {
    // Weekly 63 prints the merged suite as PS-ST3-2119 on 'F21 (ID)' but still as PS-2119 on '21F(MEP)'.
    const out: NbcActivity[] = []
    let order = 0
    const base = { projectId: 'nbc-bp02', description: '', location: '', trade: '', handler: 'Tola', remark: '', history: [], duration: null, boqValue: null, schedule: null, sourcePrevious: 0, sourceWeekly: 0, baseline: 0, progress: 0, editable: false, relativeWeight: 1, globalWeight: 0 }
    const node = (wbs: string, parent: string | null, name: string, area: string, extra: Partial<NbcActivity> = {}) => out.push({ ...base, id: `nbc-bp02:${wbs}`, wbs, parentId: parent ? `nbc-bp02:${parent}` : null, order: ++order, name, area, ...extra } as NbcActivity)
    const leaf = (wbs: string, parent: string, room: string, area: string, progress: number) => node(wbs, parent, room, area, { room, editable: true, progress })
    const id = 'GUESTROOM - INTERIOR DESIGN (ID)', mepArea = 'MEP WORKS'
    node('1', null, 'Floor 21', 'Floor 21', { roomList: ['CSK1-2118', 'PS-ST3-2119'] })
    node('1.1', '1', id, id, { item: 'A' }); node('1.1.1', '1.1', 'Setting Out', id, { item: 'I' }); node('1.1.1.1', '1.1.1', 'Unit Setting Out', id)
    leaf('1.1.1.1.1', '1.1.1.1', 'CSK1-2118', id, 0.9); leaf('1.1.1.1.2', '1.1.1.1', 'PS-ST3-2119', id, 0.8)
    // The report prints this task as "Install Single Leaf"; the app calls it "Install Swing Door (D4)".
    node('1.1.1.2', '1.1.1', 'Install Swing Door (D4)', id); leaf('1.1.1.2.1', '1.1.1.2', 'CSK1-2118', id, 0.6); leaf('1.1.1.2.2', '1.1.1.2', 'PS-ST3-2119', id, 0.7)
    node('1.2', '1', mepArea, mepArea, { item: 'C' }); node('1.2.1', '1.2', 'Electrical System', mepArea, { item: 'I' }); node('1.2.1.1', '1.2.1', 'Lighting System', mepArea, { item: '1' })
    node('1.2.1.1.1', '1.2.1.1', 'Conduit', mepArea, { item: '1.1' })
    leaf('1.2.1.1.1.1', '1.2.1.1.1', 'CSK1-2118', mepArea, 0.4); leaf('1.2.1.1.1.2', '1.2.1.1.1', 'PS-ST3-2119', mepArea, 0.3)
    const idSheet = sheet({ 6: text('F6', 'CSK1-2118') + text('G6', 'PS-ST3-2119'), 8: text('B8', 'Guestroom'), 9: text('A9', 'I') + text('B9', 'Setting Out'), 10: text('B10', 'Unit Setting Out') + num('F10', 0) + num('G10', 0), 11: text('B11', 'Install Single Leaf') + num('F11', 0) + num('G11', 0) })
    const mepSheet = sheet({ 9: text('E9', 'CSK1-2118') + text('F9', 'PS-2119'), 10: text('A10', 'I') + text('B10', 'Electrical System'), 11: text('A11', '1') + text('B11', 'Lighting System'), 12: text('A12', '1.1') + text('B12', 'Conduit') + num('E12', 0) + num('F12', 0) })
    const book = '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="F21 (ID)" sheetId="1" r:id="rId1"/><sheet name="21F(MEP)" sheetId="2" r:id="rId2"/></sheets><calcPr calcId="191029"/></workbook>'
    const rels = '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="x" Target="worksheets/sheet2.xml"/></Relationships>'
    const template = zipSync({ 'xl/workbook.xml': strToU8(book), 'xl/_rels/workbook.xml.rels': strToU8(rels), 'xl/worksheets/sheet1.xml': strToU8(idSheet), 'xl/worksheets/sheet2.xml': strToU8(mepSheet) })
    const result = patchWeeklyReport(template, out, [], '2026-11-09'), file = read(result.bytes)
    expect(file('xl/worksheets/sheet1.xml')).toContain('<c r="G10"><v>0.8</v></c>')
    expect(file('xl/worksheets/sheet2.xml')).toContain('<c r="F12"><v>0.3</v></c>')
    expect(file('xl/worksheets/sheet1.xml')).toContain('<c r="G11"><v>0.7</v></c>')
    expect(file('xl/worksheets/sheet1.xml')).toContain('<t>Install Swing Door (D4)</t>')
    expect(file('xl/worksheets/sheet1.xml')).not.toContain('Install Single Leaf')
    expect(result).toMatchObject({ updated: 6, notInReport: 0, relabeled: 1 })
    expect(patchWeeklyReport(result.bytes, out, [], '2026-11-09')).toMatchObject({ updated: 0, relabeled: 0 }) // a patched report is left as it is
  })
  test('a report with a different structure is refused', () => {
    expect(() => patchWeeklyReport(report({ 16: text('A16', '1.3') + text('B16', 'Extra task') }), fixture(), [], '2026-11-02')).toThrow(/task rows/)
    expect(() => patchWeeklyReport(new Uint8Array([1, 2, 3]), fixture(), [], '2026-11-02')).toThrow(/Excel workbook/)
  })
})
