import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { expect, test } from 'vitest'
import { excelSerial, exportToWorkbook, shiftFormula, updatedName } from './workbookExport'
import type { MatItem } from './types'

const s = (ref: string, text: string, style = 1) => `<c r="${ref}" s="${style}" t="inlineStr"><is><t>${text}</t></is></c>`
/** A two-row material sheet: headers in rows 6 and 7 the way the workbooks write them, materials in rows 9 and 10. */
function workbook(pkg = 'BP04') {
  const sheet = `<worksheet><sheetData>
<row r="3">${s('A3', `PACKAGE : ${pkg}`)}</row>
<row r="6">${s('A6', 'No')}${s('B6', 'Person In Charge')}${s('D6', 'Material Code ')}${s('E6', 'Description ')}${s('S6', 'Procurement ')}${s('X6', 'Total Quantity ')}${s('AE6', 'PM TEAM REMARKS')}${s('AL6', 'LAST UPDATED')}</row>
<row r="7">${s('S7', 'Plan Place Order')}${s('T7', 'Actual Place Order')}${s('W7', 'Remarks')}${s('Y7', 'Total Quantity (By QS)')}${s('AB7', 'On site Quantity ')}${s('AC7', 'Remaining Quantity ')}</row>
<row r="9" spans="1:38">${s('A9', '1.1')}${s('B9', 'Dara')}${s('D9', 'ST-01')}${s('E9', 'Stone')}<c r="S9" s="2"><v>46000</v></c>${s('T9', '-/-', 3)}<c r="Y9"><v>10</v></c><c r="AC9"><f t="shared" ref="AC9:AC10" si="0">Y9-AB9</f><v>10</v></c></row>
<row r="10">${s('A10', '1.2')}${s('D10', 'ST-02')}${s('E10', 'Marble')}<c r="Y10"><v>4</v></c><c r="AC10"><f t="shared" si="0"/><v>4</v></c></row>
</sheetData><mergeCells count="1"><mergeCell ref="S6:W6"/></mergeCells></worksheet>`
  return zipSync({
    '[Content_Types].xml': strToU8('<Types><Override PartName="/xl/calcChain.xml" ContentType="x"/></Types>'),
    'xl/workbook.xml': strToU8('<workbook><sheets><sheet name="ID Material" sheetId="1" r:id="rId1"/></sheets><calcPr calcId="1"/></workbook>'),
    'xl/_rels/workbook.xml.rels': strToU8('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId9" Target="calcChain.xml"/></Relationships>'),
    'xl/worksheets/sheet1.xml': strToU8(sheet),
    'xl/calcChain.xml': strToU8('<calcChain><c r="AC9"/></calcChain>'),
    'xl/styles.xml': strToU8('<styleSheet><numFmts count="1"><numFmt numFmtId="164" formatCode="d\\-mmm\\-yy"/></numFmts><cellXfs count="4"><xf numFmtId="0" fontId="0"/><xf numFmtId="0" fontId="1"/><xf numFmtId="164" fontId="0"/><xf numFmtId="0" fontId="0" fillId="5"/></cellXfs></styleSheet>'),
    'xl/media/image1.png': new Uint8Array([137, 80, 78, 71]),
  })
}
const item = (id: string, pos: number, code: string, description: string, edits: MatItem['edits']): MatItem =>
  ({ id, package: 'bp04', sheet: 'id', pos, kind: 'item', data: { cols: { code, description }, cells: {} }, edits, updatedAt: '2026-11-25T03:00:00Z' })
const sheetOf = (bytes: Uint8Array) => strFromU8(unzipSync(bytes)['xl/worksheets/sheet1.xml']!)

test('writes the app changes into their cells and leaves everything else as it was', () => {
  const items = [
    item('a', 9, 'ST-01', 'Stone', { pic: 'Sokha', poActual: '2026-11-24', onsite: 3, remaining: 7 }),
    item('b', 99, 'ST-02', 'Marble', { poPlan: 'TBC' }), // moved: found by code and description
    item('c', 11, 'XX-9', 'Gone', { pic: 'Dara' }),
  ]
  const remarks = { 'a:purchase:2026-11-22': 'PO sent', 'a:pm:2026-11-15': 'Chased consultant', 'a:pm:2026-11-08': 'Too old' }
  const res = exportToWorkbook(workbook(), 'bp04', items, remarks, '2026-11-22', '2026-11-15')
  const xml = sheetOf(res.bytes), files = unzipSync(res.bytes)
  expect(xml).toContain('<c r="B9" s="1" t="inlineStr"><is><t xml:space="preserve">Sokha</t></is></c>')
  expect(xml).toContain(`<c r="AB9"><v>3</v></c>`)
  expect(xml).toContain('<t xml:space="preserve">PO sent</t>')
  expect(xml).toContain('<t xml:space="preserve">Chased consultant</t>')
  expect(xml).not.toContain('Too old')
  // A cell the row did not have takes the column's style from the row above.
  expect(xml).toContain('<c r="S10" s="2" t="inlineStr"><is><t xml:space="preserve">TBC</t></is></c>')
  // The overwritten cell led a shared formula: the next cell gets the formula written out for its own row.
  expect(xml).toContain('<c r="AC9"><v>7</v></c>')
  expect(xml).toContain('<c r="AC10"><f>Y10-AB10</f><v>4</v></c>')
  // A date in a text-styled cell gets a copy of that style with the column's date format; fill kept.
  expect(xml).toContain(`<c r="T9" s="4"><v>${excelSerial('2026-11-24')}</v></c>`)
  expect(strFromU8(files['xl/styles.xml']!)).toContain('<cellXfs count="6">')
  expect(strFromU8(files['xl/styles.xml']!)).toContain('<xf numFmtId="15" applyNumberFormat="1" fontId="0" fillId="5"/>') // no real date in T yet: Excel's d-mmm-yy
  // Last updated: the day of the material's last edit, on every row that changed.
  expect(xml).toContain(`<c r="AL9" s="5"><v>${excelSerial('2026-11-25')}</v></c>`)
  expect(xml).toContain(`<c r="AL10" s="5"><v>${excelSerial('2026-11-25')}</v></c>`)
  expect(xml).toContain('<row r="9">')
  expect(res).toMatchObject({ materials: 2, notFound: ['BP04 ID Material · XX-9 Gone'], photos: 0 })
  expect(files['xl/calcChain.xml']).toBeUndefined()
  expect(strFromU8(files['xl/_rels/workbook.xml.rels']!)).not.toContain('calcChain')
  expect(strFromU8(files['xl/workbook.xml']!)).toContain('fullCalcOnLoad="1"')
  expect(files['xl/media/image1.png']).toEqual(new Uint8Array([137, 80, 78, 71]))
})

test('a value the workbook already has is not counted, and another package is refused', () => {
  const same = exportToWorkbook(workbook(), 'bp04', [item('a', 9, 'ST-01', 'Stone', { pic: 'Dara' })], {}, '2026-11-22', '2026-11-15')
  expect(same.cells).toBe(0)
  expect(() => exportToWorkbook(workbook('BP03'), 'bp04', [], {}, '2026-11-22', '2026-11-15')).toThrow('This is the BP03 workbook')
  expect(() => exportToWorkbook(new Uint8Array([1, 2, 3]), 'bp04', [], {}, '2026-11-22', '2026-11-15')).toThrow('not an Excel workbook')
})

test('formula references move with the cell; absolute parts and quoted text stay', () => {
  expect(shiftFormula('IF(N(Y9)=0,"",1-AG9)', 2, 0)).toBe('IF(N(Y11)=0,"",1-AG11)')
  expect(shiftFormula('SUBTOTAL(1,AF$9:AF39)+$A1&"B2"', 1, 1)).toBe('SUBTOTAL(1,AG$9:AG40)+$A2&"B2"')
})

test('the downloaded file carries today\'s date', () => {
  expect(updatedName('SB_SCC_TPMCD_BP04_MAT_LIST_SUBMISSION_PROCUREMENT_21_11_26.xlsx', '2026-11-26')).toBe('SB_SCC_TPMCD_BP04_MAT_LIST_SUBMISSION_PROCUREMENT_26_11_26.xlsx')
  expect(updatedName('bp04.xlsx', '2026-11-26')).toBe('bp04_26_11_26.xlsx')
})

/** A one-material workbook whose text lives in sharedStrings.xml, as Excel writes it. */
function sharedWorkbook(cells: string, strings: string[]) {
  const sheet = `<worksheet><sheetData><row r="6"><c r="D6" t="s"><v>0</v></c><c r="E6" t="s"><v>1</v></c><c r="I6" t="s"><v>2</v></c><c r="S6" t="s"><v>3</v></c></row>`
    + `<row r="7"><c r="S7" t="s"><v>4</v></c><c r="Y7" t="s"><v>5</v></c></row><row r="9">${cells}</row></sheetData><mergeCells><mergeCell ref="S6:T6"/></mergeCells></worksheet>`
  const si = ['Material Code', 'Description', 'Specification', 'Procurement', 'Plan Place Order', 'Total Quantity (By QS)', ...strings]
    .map((t) => `<si>${t.startsWith('<') ? t : `<t>${t}</t>`}</si>`).join('')
  return zipSync({
    '[Content_Types].xml': strToU8('<Types/>'),
    'xl/workbook.xml': strToU8('<workbook><sheets><sheet name="ID Material" sheetId="1" r:id="rId1"/></sheets></workbook>'),
    'xl/_rels/workbook.xml.rels': strToU8('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'),
    'xl/worksheets/sheet1.xml': strToU8(sheet),
    'xl/sharedStrings.xml': strToU8(`<sst>${si}</sst>`),
  })
}

test('rows are found through shared strings with rich runs, phonetic guides and empty runs', () => {
  // Code "ST-01" split over two runs with an empty run between; the description carries a phonetic guide.
  const book = sharedWorkbook('<c r="D9" t="s"><v>6</v></c><c r="E9" t="s"><v>7</v></c><c r="Y9" t="s"><v>8</v></c>', [
    '<r><t>ST-</t></r><r><t xml:space="preserve"/></r><r><t>01</t></r>', '<t>Stone</t><rPh sb="0" eb="1"><t>ストーン</t></rPh>', '10',
  ])
  const res = exportToWorkbook(book, 'bp04', [item('a', 9, 'ST-01', 'Stone', { total: 10, spec: '2026-11-24 & <rev B>\u0007', poPlan: '2026-12-01' })], {}, '2026-11-22', '2026-11-15')
  const xml = sheetOf(res.bytes)
  expect(res.notFound).toEqual([])
  // "10" stored as text becomes the number 10.
  expect(xml).toContain('<c r="Y9"><v>10</v></c>')
  // An ISO date in a text column stays text; XML is escaped and the control character dropped.
  expect(xml).toContain('<c r="I9" t="inlineStr"><is><t xml:space="preserve">2026-11-24 &amp; &lt;rev B&gt;</t></is></c>')
  expect(xml).toContain(`<c r="S9"><v>${excelSerial('2026-12-01')}</v></c>`)
})

test('clearing a value empties the cell, and nothing is zipped when the workbook already matches', () => {
  const book = sharedWorkbook('<c r="D9" t="s"><v>6</v></c><c r="E9" t="s"><v>7</v></c><c r="S9" s="3"><v>46000</v></c>', ['ST-01', 'Stone'])
  const cleared = exportToWorkbook(book, 'bp04', [item('a', 9, 'ST-01', 'Stone', { poPlan: '' })], {}, '2026-11-22', '2026-11-15')
  expect(sheetOf(cleared.bytes)).toContain('<c r="S9" s="3"/>')
  const none = exportToWorkbook(book, 'bp04', [item('a', 9, 'ST-01', 'Stone', { poPlan: '2025-12-09' })], {}, '2026-11-22', '2026-11-15')
  expect(none.cells).toBe(0)
  expect(none.bytes.length).toBe(0)
})

test('shared formulas keep sheet names and dollar signs when written out', () => {
  expect(shiftFormula("BP04!A9+'Sheet 2'!B9&\"C9\"", 1, 0)).toBe("BP04!A10+'Sheet 2'!B10&\"C9\"")
  expect(shiftFormula('$A$1+$B9+C$2', 3, 1)).toBe('$A$1+$B12+D$2')
})
