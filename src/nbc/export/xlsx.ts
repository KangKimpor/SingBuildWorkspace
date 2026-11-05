import { strToU8, zipSync } from 'fflate'

/** Just enough SpreadsheetML to write styled grids with formulas and cached results, so no spreadsheet library is needed. */
export interface Style {
  bold?: boolean; size?: number; color?: string; fill?: string; border?: boolean; format?: string
  h?: 'center' | 'left' | 'right'; v?: 'center'; wrap?: boolean
}
export type CellValue = number | string | null
export interface Cell { v: CellValue; f?: string; s?: number }

const esc = (text: string) => text.replace(/[&<>]/g, (c) => c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;').replace(/\p{Cc}/gu, (c) => c === '\t' || c === '\n' || c === '\r' ? c : '')
export const columnName = (n: number) => { let name = ''; for (let i = n; i > 0; i = Math.floor((i - 1) / 26)) name = String.fromCharCode(65 + (i - 1) % 26) + name; return name }
const BORDER = '<border><left style="thin"><color rgb="FFBFBFBF"/></left><right style="thin"><color rgb="FFBFBFBF"/></right><top style="thin"><color rgb="FFBFBFBF"/></top><bottom style="thin"><color rgb="FFBFBFBF"/></bottom><diagonal/></border>'

export class Styles {
  private specs: Style[] = [{}]
  private keys = new Map<string, number>([['{}', 0]])
  id(style: Style) {
    const key = JSON.stringify(Object.entries(style).filter(([, value]) => value !== undefined).sort())
    let id = this.keys.get(key)
    if (id === undefined) { id = this.specs.push(style) - 1; this.keys.set(key, id) }
    return id
  }
  xml() {
    const fonts: string[] = [], fills: string[] = [], codes: string[] = [], pick = (list: string[], xml: string) => { const i = list.indexOf(xml); return i >= 0 ? i : list.push(xml) - 1 }
    pick(fonts, '<font><sz val="10"/><name val="Calibri"/></font>'); pick(fills, '<fill><patternFill patternType="none"/></fill>'); pick(fills, '<fill><patternFill patternType="gray125"/></fill>')
    const xfs = this.specs.map((s) => {
      const font = pick(fonts, `<font>${s.bold ? '<b/>' : ''}<sz val="${s.size ?? 10}"/>${s.color ? `<color rgb="${s.color}"/>` : ''}<name val="Calibri"/></font>`)
      const fill = s.fill ? pick(fills, `<fill><patternFill patternType="solid"><fgColor rgb="${s.fill}"/><bgColor indexed="64"/></patternFill></fill>`) : 0
      const format = s.format ? 164 + (codes.includes(s.format) ? codes.indexOf(s.format) : codes.push(s.format) - 1) : 0
      const align = s.h || s.v || s.wrap ? `<alignment${s.h ? ` horizontal="${s.h}"` : ''}${s.v ? ` vertical="${s.v}"` : ''}${s.wrap ? ' wrapText="1"' : ''}/>` : ''
      return `<xf numFmtId="${format}" fontId="${font}" fillId="${fill}" borderId="${s.border ? 1 : 0}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"${align ? ' applyAlignment="1">' + align + '</xf>' : '/>'}`
    })
    const formats = codes.map((code, i) => `<numFmt numFmtId="${164 + i}" formatCode="${esc(code)}"/>`)
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${formats.length ? `<numFmts count="${formats.length}">${formats.join('')}</numFmts>` : ''}<fonts count="${fonts.length}">${fonts.join('')}</fonts><fills count="${fills.length}">${fills.join('')}</fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>${BORDER}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`
  }
}

export class Sheet {
  readonly cells = new Map<number, Map<number, Cell>>()
  readonly merges: string[] = []
  readonly widths: { from: number; to: number; width: number }[] = []
  readonly heights = new Map<number, number>()
  readonly validations: string[] = []
  freeze = ''
  constructor(readonly name: string) {}
  set(row: number, col: number, v: CellValue, s = 0, f?: string) {
    const cols = this.cells.get(row) ?? new Map<number, Cell>()
    cols.set(col, { v, s, f }); this.cells.set(row, cols)
  }
  get(row: number, col: number) { return this.cells.get(row)?.get(col) }
  xml() {
    const rows = [...this.cells.keys()].sort((a, b) => a - b)
    const maxCol = Math.max(1, ...rows.flatMap((r) => [...this.cells.get(r)!.keys()]))
    const body = rows.map((r) => {
      const cols = this.cells.get(r)!, height = this.heights.get(r)
      return `<row r="${r}"${height ? ` ht="${height}" customHeight="1"` : ''}>${[...cols.keys()].sort((a, b) => a - b).map((c) => {
        const { v, f, s } = cols.get(c)!, ref = `${columnName(c)}${r}`, style = s ? ` s="${s}"` : ''
        if (f !== undefined) return typeof v === 'number' && Number.isFinite(v) ? `<c r="${ref}"${style}><f>${esc(f)}</f><v>${v}</v></c>` : `<c r="${ref}"${style} t="str"><f>${esc(f)}</f><v>${esc(String(v ?? ''))}</v></c>`
        if (v === null) return `<c r="${ref}"${style}/>`
        if (typeof v === 'number') return `<c r="${ref}"${style}><v>${v}</v></c>`
        return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`
      }).join('')}</row>`
    }).join('')
    const pane = this.freeze && /^([A-Z]+)(\d+)$/.exec(this.freeze)
    const view = pane ? `<sheetViews><sheetView zoomScale="90" zoomScaleNormal="90" workbookViewId="0"><pane${pane[1] !== 'A' ? ` xSplit="${[...pane[1]!].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1}"` : ''}${pane[2] !== '1' ? ` ySplit="${Number(pane[2]) - 1}"` : ''} topLeftCell="${this.freeze}" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>` : '<sheetViews><sheetView zoomScale="90" zoomScaleNormal="90" workbookViewId="0"/></sheetViews>'
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${columnName(maxCol)}${rows.at(-1) ?? 1}"/>${view}<sheetFormatPr defaultRowHeight="15"/>${this.widths.length ? `<cols>${this.widths.map((w) => `<col min="${w.from}" max="${w.to}" width="${w.width}" customWidth="1"/>`).join('')}</cols>` : ''}<sheetData>${body}</sheetData>${this.merges.length ? `<mergeCells count="${this.merges.length}">${this.merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : ''}${this.validations.length ? `<dataValidations count="1"><dataValidation type="decimal" operator="between" allowBlank="1" showErrorMessage="1" errorTitle="Accumulation %" error="Enter a value between 0% and 100%." sqref="${this.validations.join(' ')}"><formula1>0</formula1><formula2>1</formula2></dataValidation></dataValidations>` : ''}<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>`
  }
}

/** Zips the sheets into an .xlsx. Excel recalculates on open; the cached values are what a protected-view reader shows. */
export function writeWorkbook(sheets: Sheet[], styles: Styles) {
  const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main', REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
  const quote = (name: string) => esc(name).replace(/"/g, '&quot;')
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${NS}" xmlns:r="${REL}"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${sheets.map((s, i) => `<sheet name="${quote(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets><calcPr calcMode="auto" fullCalcOnLoad="1"/></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="${REL}/styles" Target="styles.xml"/></Relationships>`),
    'xl/styles.xml': strToU8(styles.xml()),
  }
  sheets.forEach((s, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(s.xml()) })
  return zipSync(files, { level: 6 })
}
