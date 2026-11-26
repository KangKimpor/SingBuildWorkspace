import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import type { Zippable } from 'fflate'
import { remarkKey } from './store'
import { findColumns } from './workbookColumns'
import type { Role } from './workbookColumns'
import type { MatItem, Pkg, Team } from './types'

/**
 * Writes what people changed in the app back into the BP03 / BP04 material workbook (D-60). Only the cells the app holds
 * a value for are touched: overridden columns and quantities (`edits`), the latest Purchase and PM notes, and Last updated
 * on the rows that changed. Every other cell, style, picture, row, column and sheet is copied through as it was, so the
 * file is still the team's workbook and imports again cleanly.
 *
 * Rows are matched by the code and description the workbook had when it was imported, so rows inserted above a material
 * since then do not send its values to the wrong line. A material the workbook no longer has is reported, not guessed.
 */
export interface ExportResult {
  bytes: Uint8Array
  /** Cells written with a new value. */
  cells: number
  /** Materials with at least one cell written. */
  materials: number
  /** Materials with changes that the workbook has no row for, as "BP04 ID Material · J08 Service station". */
  notFound: string[]
  /** Materials whose photos changed in the app: pictures are not written into the workbook. */
  photos: number
}

const SHEETS: { key: 'id' | 'mep'; title: string }[] = [{ key: 'id', title: 'ID Material' }, { key: 'mep', title: 'MEP Material' }]
const FIRST_ROW = 9
const ATTR = (name: string) => new RegExp(`\\s${name}="([^"]*)"`)
const attr = (tag: string, name: string) => ATTR(name).exec(tag)?.[1]
const decode = (text: string) => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&')
/** Escapes for XML text, dropping the control characters XML 1.0 cannot hold (they make Excel offer to repair the file). */
// oxlint-disable-next-line no-control-regex -- matching those characters is the point.
const escapeXml = (text: string) => text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const norm = (text: string) => text.replace(/\s+/g, ' ').trim().toLowerCase()
const ISO = /^\d{4}-\d{2}-\d{2}$/
/** Excel's serial day number for a calendar date (1900 date system). */
export const excelSerial = (iso: string) => (Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - Date.UTC(1899, 11, 30)) / 864e5
export const columnNumber = (column: string) => [...column].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0)
const columnLetter = (n: number) => { let s = ''; for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s }

const CELL = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g
interface Cell { ref: string; column: string; row: number; attrs: string; inner: string; text: string }

/** The text of a string item or inline string: its runs joined, phonetic guides (`<rPh>`) left out, `<t/>` read as empty. */
export function runText(xml: string) {
  const body = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').replace(/<t\b[^>]*\/>/g, '')
  return decode([...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(''))
}
function sharedStrings(files: Record<string, Uint8Array>) {
  const part = files['xl/sharedStrings.xml']
  if (!part) return [] as string[]
  return [...strFromU8(part).matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)].map((m) => runText(m[1] ?? ''))
}
function cellText(attrs: string, inner: string, strings: string[]) {
  const type = attr(attrs, 't'), value = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1]
  if (type === 's') return value === undefined ? '' : strings[Number(value)] ?? ''
  if (type === 'inlineStr') return runText(inner)
  return value === undefined ? '' : decode(value)
}
function readCells(xml: string, strings: string[]) {
  const cells = new Map<string, Cell>()
  for (const m of xml.matchAll(CELL)) {
    const attrs = m[1]!, ref = attr(attrs, 'r')
    if (!ref) continue
    const [, column, row] = /^([A-Z]+)(\d+)$/.exec(ref) ?? []
    if (!column) continue
    cells.set(ref, { ref, column, row: Number(row), attrs, inner: m[2] ?? '', text: cellText(attrs, m[2] ?? '', strings) })
  }
  return cells
}

/**
 * Moves every relative reference in a formula by the given rows and columns. Text in double quotes and quoted sheet names
 * are left alone, and a sheet name such as `BP04!` is not read as a cell.
 */
export function shiftFormula(formula: string, rows: number, columns: number) {
  return formula.replace(/("[^"]*"|'[^']*')|(?<![A-Za-z0-9_.])(\$?)([A-Z]{1,3})(\$?)(\d+)(?![\d(A-Za-z_!])/g,
    (whole: string, quoted: string | undefined, colAbs: string, col: string, rowAbs: string, row: string) => quoted ? whole
      : `${colAbs}${colAbs ? col : columnLetter(columnNumber(col) + columns)}${rowAbs}${rowAbs ? row : Number(row) + rows}`)
}

/**
 * A shared formula is written once, in its first cell, and the other cells of its range point at it. Before that first cell
 * is overwritten, every cell of the group gets its own copy of the formula, so the rest of the range keeps calculating.
 */
function unshare(xml: string, group: string, master: Cell) {
  const formula = /<f\b[^>]*>([\s\S]*?)<\/f>/.exec(master.inner)?.[1] ?? ''
  const origin = { row: master.row, col: columnNumber(master.column) }
  return xml.replace(CELL, (whole, attrs: string, inner: string | undefined) => {
    if (!inner || !/<f\b[^>]*\bt="shared"/.test(inner) || attr(` ${/<f\b([^>]*)/.exec(inner)?.[1] ?? ''}`, 'si') !== group) return whole
    const ref = attr(attrs, 'r')!, [, column, row] = /^([A-Z]+)(\d+)$/.exec(ref)!
    const own = shiftFormula(decode(formula), Number(row) - origin.row, columnNumber(column!) - origin.col)
    return `<c${attrs}>${inner.replace(/<f\b[^>]*?(?:\/>|>[\s\S]*?<\/f>)/, () => `<f>${escapeXml(own)}</f>`)}</c>`
  })
}

const DATE_ROLES: ReadonlySet<Role> = new Set<Role>(['msPlan', 'msActual', 'msApproved', 'ssPlan', 'ssActual', 'ssApproved', 'poPlan', 'poActual', 'arrPlan', 'arrActual', 'lastUpdated'])
type Value = { kind: 'number'; value: number; date?: boolean } | { kind: 'text'; value: string } | { kind: 'empty' }
function valueOf(raw: unknown, role: Role): Value | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'number') return Number.isFinite(raw) ? { kind: 'number', value: raw } : null
  if (typeof raw !== 'string') return null
  if (raw === '') return { kind: 'empty' }
  if (ISO.test(raw) && DATE_ROLES.has(role)) return { kind: 'number', value: excelSerial(raw), date: true }
  return { kind: 'text', value: raw }
}

/**
 * Cell styles (`xl/styles.xml` cellXfs). A date written into a cell styled for text ("-/-", "TBC") would show as a serial
 * number, so such a cell gets a copy of its own style with a date format: fill, borders and font stay as they were.
 */
class Styles {
  private xfs: string[]
  private formats = new Map<number, string>()
  private added = new Map<string, number>()
  constructor(private xml: string) {
    this.xfs = [...(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml)?.[1] ?? '').matchAll(/<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g)].map((m) => m[0])
    for (const m of xml.matchAll(/<numFmt\b[^>]*>/g)) this.formats.set(Number(attr(m[0], 'numFmtId')), decode(attr(m[0], 'formatCode') ?? ''))
  }
  formatOf(style: number) { return Number(attr(this.xfs[style] ?? '', 'numFmtId') ?? 0) }
  isDate(format: number) {
    if ((format >= 14 && format <= 22) || (format >= 27 && format <= 36) || (format >= 45 && format <= 47) || (format >= 50 && format <= 58)) return true
    const code = this.formats.get(format)
    return !!code && /[dmy]/i.test(code.replace(/"[^"]*"|\[[^\]]*\]|\\./g, ''))
  }
  /** A style index showing dates: `style` itself when it already does, else a copy of it with `format`. */
  dated(style: number, format: number) {
    // A workbook without cell styles keeps the cell as it is rather than point at a style that does not exist.
    if (!this.xfs.length || this.isDate(this.formatOf(style))) return style
    const key = `${style}:${format}`
    if (!this.added.has(key)) {
      const base = this.xfs[style] ?? '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
      const copy = base.replace(/\snumFmtId="[^"]*"/, '').replace(/\sapplyNumberFormat="[^"]*"/, '').replace(/^<xf\b/, `<xf numFmtId="${format}" applyNumberFormat="1"`)
      this.added.set(key, this.xfs.length)
      this.xfs.push(copy)
    }
    return this.added.get(key)!
  }
  get changed() { return this.added.size > 0 }
  toXml() {
    return this.xml.replace(/<cellXfs\b[^>]*>[\s\S]*?<\/cellXfs>/, `<cellXfs count="${this.xfs.length}">${this.xfs.join('')}</cellXfs>`)
  }
}
function sameValue(cell: Cell | undefined, v: Value) {
  const text = cell?.text ?? ''
  if (v.kind === 'empty') return text === '' && !/<f\b/.test(cell?.inner ?? '')
  if (/<f\b/.test(cell?.inner ?? '')) return false
  if (v.kind === 'number') return text !== '' && !/^(s|str|inlineStr)$/.test(attr(cell?.attrs ?? '', 't') ?? '') && Math.abs(Number(text) - v.value) < 1e-9
  return text === v.value
}
function writeCell(ref: string, attrs: string, v: Value) {
  const kept = attrs.replace(/\s(?:r|t|cm|vm)="[^"]*"/g, '')
  if (v.kind === 'empty') return `<c r="${ref}"${kept}/>`
  if (v.kind === 'number') return `<c r="${ref}"${kept}><v>${v.value}</v></c>`
  return `<c r="${ref}"${kept} t="inlineStr"><is><t xml:space="preserve">${escapeXml(v.value)}</t></is></c>`
}

interface Plan { writes: Map<string, Value>; formulasRemoved: boolean }
type Totals = Omit<ExportResult, 'bytes'> & { formulasRemoved?: boolean }

function planSheet(xml: string, strings: string[], items: MatItem[], remarks: Record<string, string>, weeks: string[], label: string, result: Totals, styles: Styles): { xml: string; changed: boolean } {
  const cells = readCells(xml, strings)
  const merges = [...xml.matchAll(/<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"/g)].map((m) => ({ c1: columnNumber(m[1]!), r1: Number(m[2]), c2: columnNumber(m[3]!), r2: Number(m[4]) }))
  let headerWidth = 0
  for (const c of cells.values()) if (c.row <= 7) headerWidth = Math.max(headerWidth, columnNumber(c.column))
  const columns = findColumns((col, row) => cells.get(`${columnLetter(col)}${row}`)?.text ?? '', headerWidth, merges, label)
  const at = (role: Role, row: number) => columns.get(role) ? cells.get(`${columns.get(role)}${row}`) : undefined
  const identity = (code: string, description: string) => `${norm(code)}|${norm(description)}`
  const rowsByKey = new Map<string, number[]>()
  let lastRow = FIRST_ROW
  for (const c of cells.values()) if (c.row > lastRow) lastRow = c.row
  for (let r = FIRST_ROW; r <= lastRow; r++) {
    const key = identity(at('code', r)?.text ?? '', at('description', r)?.text ?? '')
    if (key === '|') continue
    const list = rowsByKey.get(key) ?? []
    list.push(r)
    rowsByKey.set(key, list)
  }
  const plan: Plan = { writes: new Map(), formulasRemoved: false }
  for (const item of items) {
    const writes = new Map<Role, Value>()
    for (const [key, raw] of Object.entries(item.edits)) {
      if (key === 'image' || key === 'sample') continue
      const v = valueOf(raw, key as Role)
      if (v && columns.has(key as Role)) writes.set(key as Role, v)
    }
    if ('image' in item.edits || 'sample' in item.edits) result.photos++
    // The newest note of each team from this week or last: the workbook's remark cell holds the current status, not a history.
    for (const [team, role] of [['purchase', 'procRemarks'], ['pm', 'pmRemarks']] as [Team, Role][]) {
      const body = weeks.map((w) => remarks[remarkKey(item.id, team, w)]?.trim()).find(Boolean)
      if (body && columns.has(role)) writes.set(role, { kind: 'text', value: body })
    }
    if (!writes.size) continue
    const cols = item.data.cols, key = identity(String(cols.code ?? ''), String(cols.description ?? ''))
    const candidates = rowsByKey.get(key) ?? []
    const row = candidates.includes(item.pos) ? item.pos : candidates.length === 1 ? candidates[0]! : null
    const name = `${label} · ${[cols.code, cols.description].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() || `row ${item.pos}`}`
    if (row === null) { result.notFound.push(name); continue }
    let touched = false
    for (const [role, v] of writes) {
      const ref = `${columns.get(role)}${row}`
      if (sameValue(cells.get(ref), v)) continue
      plan.writes.set(ref, v)
      touched = true
    }
    if (!touched) continue
    result.materials++
    if (columns.has('lastUpdated')) {
      const ref = `${columns.get('lastUpdated')}${row}`, v: Value = { kind: 'number', value: excelSerial(item.updatedAt.slice(0, 10)), date: true }
      if (ISO.test(item.updatedAt.slice(0, 10)) && !sameValue(cells.get(ref), v)) plan.writes.set(ref, v)
    }
  }
  if (!plan.writes.size) return { xml, changed: false }
  result.cells += plan.writes.size

  // Shared-formula groups whose first cell is about to be overwritten get their formulas spelled out first.
  let out = xml
  for (const ref of plan.writes.keys()) {
    const cell = cells.get(ref)
    if (!cell || !/<f\b/.test(cell.inner)) continue
    plan.formulasRemoved = true
    const f = /<f\b([^>]*)/.exec(cell.inner)![1]!
    if (/\bt="shared"/.test(f) && /\bref="/.test(f)) out = unshare(out, attr(` ${f}`, 'si')!, cell)
  }
  // Style for a cell the row does not have yet: the same column on the nearest material row (above first, then below) that
  // has one. Section rows are skipped, so a material never takes a section band's fill.
  const materialRows = new Set([...rowsByKey.values()].flat())
  const styleFor = (column: string, row: number) => {
    const style = (r: number) => { const a = materialRows.has(r) ? cells.get(`${column}${r}`)?.attrs : undefined; return a ? attr(a, 's') : undefined }
    for (let d = 1; row - d >= FIRST_ROW || row + d <= lastRow; d++) {
      const found = style(row - d) ?? style(row + d)
      if (found) return ` s="${found}"`
    }
    return ''
  }
  // A date's style: the cell's own, given the date format the column's real dates use when it shows something else.
  const dateFormat = new Map<string, number>()
  const formatFor = (column: string) => {
    if (!dateFormat.has(column)) {
      let found = 15
      for (const c of cells.values()) {
        if (c.column !== column || c.row < FIRST_ROW || attr(c.attrs, 't') || !c.text || /<f\b/.test(c.inner)) continue
        const f = styles.formatOf(Number(attr(c.attrs, 's') ?? 0))
        if (styles.isDate(f)) { found = f; break }
      }
      dateFormat.set(column, found)
    }
    return dateFormat.get(column)!
  }
  const styled = (ref: string, attrs: string, v: Value) => {
    if (v.kind !== 'number' || !v.date) return attrs
    const current = Number(attr(attrs, 's') ?? 0), style = styles.dated(current, formatFor(/^[A-Z]+/.exec(ref)![0]))
    if (style === current) return attrs
    return / s="/.test(attrs) ? attrs.replace(/ s="[^"]*"/, ` s="${style}"`) : `${attrs} s="${style}"`
  }
  const byRow = new Map<number, [string, Value][]>()
  for (const [ref, v] of plan.writes) { const r = Number(/\d+$/.exec(ref)![0]); const list = byRow.get(r) ?? []; list.push([ref, v]); byRow.set(r, list) }
  out = out.replace(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g, (whole, rowAttrs: string, inner: string | undefined) => {
    const r = Number(attr(rowAttrs, 'r'))
    const list = byRow.get(r)
    if (!list) return whole
    const pending = new Map(list)
    let body = (inner ?? '').replace(CELL, (cellXml, attrs: string) => {
      const ref = attr(attrs, 'r')!
      const v = pending.get(ref)
      if (!v) return cellXml
      pending.delete(ref)
      return writeCell(ref, styled(ref, attrs, v), v)
    })
    // Cells the row has no element for yet go in column order.
    for (const [ref, v] of pending) {
      const column = /^[A-Z]+/.exec(ref)![0], n = columnNumber(column)
      const fresh = writeCell(ref, styled(ref, styleFor(column, r), v), v)
      let placed = false
      body = body.replace(CELL, (cellXml, attrs: string) => {
        if (placed) return cellXml
        const other = /^[A-Z]+/.exec(attr(attrs, 'r')!)![0]
        if (columnNumber(other) > n) { placed = true; return fresh + cellXml }
        return cellXml
      })
      if (!placed) body += fresh
    }
    // A row's `spans` is only a loading hint; drop it rather than keep a range the new cells may sit outside of.
    return `<row${rowAttrs.replace(/\sspans="[^"]*"/, '')}>${body}</row>`
  })
  if (plan.formulasRemoved) result.formulasRemoved = true
  return { xml: out, changed: true }
}

/** File name for the updated workbook: the date at the end of the name ("…_21_11_26") becomes today's. */
export function updatedName(name: string, today: string) {
  const stamp = `${today.slice(8, 10)}_${today.slice(5, 7)}_${today.slice(2, 4)}`
  const base = name.replace(/\.xlsx$/i, '')
  return /_\d{1,2}_\d{1,2}_\d{2}$/.test(base) ? `${base.replace(/_\d{1,2}_\d{1,2}_\d{2}$/, `_${stamp}`)}.xlsx` : `${base}_${stamp}.xlsx`
}

export function exportToWorkbook(file: Uint8Array, pkg: Pkg, items: MatItem[], remarks: Record<string, string>, week: string, lastWeek: string): ExportResult & { formulasRemoved?: boolean } {
  let files: Record<string, Uint8Array>
  try { files = unzipSync(file) } catch { throw new Error('This file is not an Excel workbook (.xlsx).') }
  const book = files['xl/workbook.xml'], rels = files['xl/_rels/workbook.xml.rels']
  if (!book || !rels) throw new Error('This file is not an Excel workbook (.xlsx).')
  const targets = new Map([...strFromU8(rels).matchAll(/<Relationship\b[^>]*>/g)].map((m) => [attr(m[0], 'Id')!, attr(m[0], 'Target')!]))
  const parts = new Map<string, string>()
  for (const m of strFromU8(book).matchAll(/<sheet\b[^>]*>/g)) {
    const target = targets.get(attr(m[0], 'r:id') ?? '')
    if (target) parts.set(decode(attr(m[0], 'name')!), target.startsWith('/') ? target.slice(1) : `xl/${target}`)
  }
  const strings = sharedStrings(files)
  const styles = new Styles(files['xl/styles.xml'] ? strFromU8(files['xl/styles.xml']) : '')
  // The package is printed in the sheet's title block ("PACKAGE : BP04"); a workbook of the other package is refused.
  const first = parts.get('ID Material') ?? parts.get('MEP Material')
  if (!first || !files[first]) throw new Error('This workbook has no "ID Material" or "MEP Material" sheet.')
  const head = [...readCells(strFromU8(files[first]!), strings).values()].filter((c) => c.row <= 5).map((c) => c.text).join(' ')
  const named = /BP\s*-?\s*0?(\d)/i.exec(head)
  if (named && `bp0${named[1]}` !== pkg) throw new Error(`This is the BP0${named[1]} workbook. Open BP0${named[1]} in the material list to update it.`)

  const result: ExportResult & { formulasRemoved?: boolean } = { bytes: new Uint8Array(), cells: 0, materials: 0, notFound: [], photos: 0 }
  const weeks = [week, lastWeek]
  for (const { key, title } of SHEETS) {
    const part = parts.get(title)
    if (!part || !files[part]) continue
    const own = items.filter((i) => i.package === pkg && i.sheet === key && i.kind === 'item')
    const { xml, changed } = planSheet(strFromU8(files[part]!), strings, own, remarks, weeks, `${pkg.toUpperCase()} ${title}`, result, styles)
    if (changed) files[part] = strToU8(xml)
  }
  if (!result.cells) return result
  if (styles.changed) files['xl/styles.xml'] = strToU8(styles.toXml())
  if (result.formulasRemoved && files['xl/calcChain.xml']) {
    // The calculation chain lists formula cells; Excel rebuilds it, and a stale one makes it offer to repair the file.
    delete files['xl/calcChain.xml']
    files['[Content_Types].xml'] = strToU8(strFromU8(files['[Content_Types].xml']!).replace(/<Override\b[^>]*PartName="\/xl\/calcChain\.xml"[^>]*\/>/, ''))
    files['xl/_rels/workbook.xml.rels'] = strToU8(strFromU8(files['xl/_rels/workbook.xml.rels']!).replace(/<Relationship\b[^>]*Target="[^"]*calcChain\.xml"[^>]*\/>/, ''))
  }
  // Values changed under the workbook's formulas: ask Excel to recalculate when the file opens.
  const workbook = strFromU8(files['xl/workbook.xml']!)
  files['xl/workbook.xml'] = strToU8(/<calcPr\b[^>]*>/.test(workbook)
    ? workbook.replace(/<calcPr\b([^>]*?)(\/?)>/, (_, a: string, end: string) => `<calcPr${a.replace(/\sfullCalcOnLoad="[^"]*"/, '')} fullCalcOnLoad="1"${end}>`)
    : workbook)
  // Photos are already compressed; storing them as they are keeps the export quick on a 90 MB workbook.
  const zippable: Zippable = {}
  for (const [name, data] of Object.entries(files)) zippable[name] = [data, { level: /\.(png|jpe?g|gif|webp)$/i.test(name) ? 0 : 6 }]
  result.bytes = zipSync(zippable)
  return result
}
