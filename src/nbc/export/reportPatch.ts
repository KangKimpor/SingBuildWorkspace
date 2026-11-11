import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { isAreaProject, roomFloors } from '../rooms'
import type { RoomFloor } from '../rooms'
import type { NbcActivity, NbcSubmission } from '../types'
import { reportValues } from './workbook'

/**
 * Writes the app's percentages into the client's weekly report. Only the constant percentage cells of the ID / MEP sheets are touched;
 * every formula, label, weight, style and other sheet is copied through byte for byte, so the report keeps its structure and recalculates
 * itself when Excel opens it.
 */
export interface PatchResult { bytes: Uint8Array; updated: number; unchanged: number; notInReport: number; sheets: string[] }

const NS_REL = /<Relationship\b[^>]*>/g
const CELL = /<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g
const attr = (tag: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1]
const decode = (text: string) => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
const ROMAN = /^[IVX]+$/
const DOTTED = /^\d+\.\d+$/

interface Cell { text: string; numeric: boolean; formula: boolean }
type Grid = Map<string, Cell>
const columnNumber = (column: string) => [...column].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0)

function sharedStrings(files: Record<string, Uint8Array>) {
  const part = files['xl/sharedStrings.xml']
  if (!part) return [] as string[]
  return [...strFromU8(part).matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => decode([...m[1]!.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(t => t[1]).join('')))
}
function readGrid(xml: string, strings: string[]): Grid {
  const grid: Grid = new Map()
  for (const m of xml.matchAll(CELL)) {
    const [, column, row, attrs = '', inner = ''] = m
    const type = attr(attrs, 't'), formula = /<f[\s>/]/.test(inner), value = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1]
    let text = ''
    if (type === 's' && value !== undefined) text = strings[Number(value)] ?? ''
    else if (type === 'inlineStr') text = decode([...inner.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(t => t[1]).join(''))
    else if (value !== undefined) text = decode(value)
    grid.set(`${column}${row}`, { text, numeric: !formula && (type === undefined || type === 'n') && value !== undefined && value !== '' && Number.isFinite(Number(value)), formula })
  }
  return grid
}

/** One report row that carries percentages. */
interface ReportTask { row: number; name: string }

const SKIP_ID_BLOCK = /^(guestroom|corridor|finishing|total|zone|overall|mep)/i
function idTasks(grid: Grid, firstRow: number, lastRow: number): ReportTask[] {
  const out: ReportTask[] = []
  let inSection = false
  for (let row = firstRow; row <= lastRow; row++) {
    const a = grid.get(`A${row}`)?.text.trim() ?? '', b = grid.get(`B${row}`)?.text.trim() ?? ''
    if (ROMAN.test(a)) { inSection = true; continue }
    if (!b) continue
    if (!a && SKIP_ID_BLOCK.test(b)) { inSection = false; continue }
    if (inSection && !a) out.push({ row, name: b })
  }
  return out
}
function mepTasks(grid: Grid, firstRow: number, lastRow: number): ReportTask[] {
  const out: ReportTask[] = []
  for (let row = firstRow; row <= lastRow; row++) {
    const a = grid.get(`A${row}`)?.text.trim() ?? '', b = grid.get(`B${row}`)?.text.trim() ?? ''
    if (DOTTED.test(a) && b) out.push({ row, name: b })
  }
  return out
}
const maxRow = (grid: Grid) => Math.max(0, ...[...grid.keys()].map(k => Number(/\d+/.exec(k)![0])))

/** Header codes ("ID-69\nL10 …", "ID 57", "CSK4-2301") to the app's room names. */
function headerColumns(grid: Grid, row: number, firstColumn: number, accept: (text: string) => string | undefined) {
  const columns = new Map<string, string>()
  for (const [ref, cell] of grid) {
    const [, column, r] = /^([A-Z]+)(\d+)$/.exec(ref)!
    if (Number(r) !== row || columnNumber(column!) < firstColumn || !cell.text) continue
    const room = accept(cell.text.trim())
    if (room && !columns.has(room)) columns.set(room, column!)
  }
  return columns
}
const idCode = (text: string) => { const m = /^ID[\s-]*(\d+)/i.exec(text); return m ? `ID-${m[1]}` : undefined }
const roomCode = (text: string) => /^[A-Za-z0-9()]+(?:-[A-Za-z0-9()]+)*-\d+$/.test(text) || text === 'CRD' ? text : undefined

// BP03 prints the MEP areas by name, two header rows deep, and repeats the GF Lobby column; the app's areas sit in these columns.
const BP03_MEP_COLUMNS: Record<string, string> = { 'GF Lobby': 'F', 'GF WC': 'G', '10F WC': 'H', '11F WC': 'I', 'Pre Function': 'J', 'Conference Room': 'K', 'Meeting Room City': 'L', 'Creative Meeting Room': 'M', 'Lift Lobby & Corridor': 'N', 'Lift Car': 'O' }

interface AppTask { name: string; cells: ReadonlyMap<string, NbcActivity> }
function floorTasks(floor: RoomFloor, filter: (a: NbcActivity) => boolean = () => true): AppTask[] {
  const sections: { act: NbcActivity; tasks: AppTask[] }[] = []
  const loose: AppTask[] = []
  for (const row of floor.rows) {
    if (row.task) { if (filter(row.activity)) (sections.at(-1)?.tasks ?? loose).push({ name: row.activity.name, cells: row.cells }) }
    else sections.push({ act: row.activity, tasks: [] })
  }
  // Tasks that apply to no area still print a row of N/A; the workbook layout keeps them at their position.
  for (const section of sections) for (const na of [...(section.act.naTasks ?? [])].sort((a, b) => a.at - b.at)) section.tasks.splice(na.at, 0, { name: na.name, cells: new Map() })
  return [...loose, ...sections.flatMap(s => s.tasks)]
}
const same = (a: string, b: string) => a.replace(/[^a-z]/gi, '').toLowerCase().slice(0, 5) === b.replace(/[^a-z]/gi, '').toLowerCase().slice(0, 5)

function align(sheet: string, report: ReportTask[], app: AppTask[], columns: ReadonlyMap<string, string>) {
  // Tasks the report does not print (BP03 prints no AV section or lift car) have no cell in any of its columns.
  const printed = app.filter(t => t.cells.size === 0 || [...t.cells.keys()].some(room => columns.has(room)))
  if (printed.length !== report.length) throw new Error(`The report's ${sheet} sheet has ${report.length} task rows but the project has ${printed.length}. Choose the report that matches this project.`)
  const odd = printed.filter((t, i) => !same(t.name, report[i]!.name)).length
  if (odd > Math.max(2, printed.length * 0.2)) throw new Error(`The task names on the report's ${sheet} sheet do not line up with this project. Choose the report that matches it.`)
  return printed
}

interface Plan { sheet: string; writes: Map<string, number>; expected: number }

function planPanel(sheet: string, grid: Grid, tasks: ReportTask[], columns: Map<string, string>, app: AppTask[], value: (a: NbcActivity) => number): Plan {
  const printed = align(sheet, tasks, app, columns), writes = new Map<string, number>()
  let expected = 0
  printed.forEach((task, i) => {
    for (const [room, activity] of task.cells) {
      const column = columns.get(room)
      if (!column) continue
      expected++
      const ref = `${column}${tasks[i]!.row}`
      if (grid.get(ref)?.numeric) writes.set(ref, value(activity))
    }
  })
  return { sheet, writes, expected }
}

export const hasReportPatch = (activities: readonly NbcActivity[]) => /^nbc-bp0[2-4]$/.test(activities[0]?.projectId ?? '')

export function patchWeeklyReport(template: Uint8Array, activities: NbcActivity[], submissions: NbcSubmission[], week: string): PatchResult {
  let files: Record<string, Uint8Array>
  try { files = unzipSync(template) } catch { throw new Error('This file is not an Excel workbook (.xlsx).') }
  const book = files['xl/workbook.xml'], rels = files['xl/_rels/workbook.xml.rels']
  if (!book || !rels) throw new Error('This file is not an Excel workbook (.xlsx).')
  const targets = new Map([...strFromU8(rels).matchAll(NS_REL)].map(m => [attr(m[0], 'Id')!, attr(m[0], 'Target')!]))
  const sheetPart = new Map<string, string>()
  for (const m of strFromU8(book).matchAll(/<sheet\b[^>]*>/g)) {
    const target = targets.get(attr(m[0], 'r:id') ?? '')
    if (target) sheetPart.set(decode(attr(m[0], 'name')!), target.startsWith('/') ? target.slice(1) : `xl/${target}`)
  }
  const strings = sharedStrings(files), texts = new Map<string, string>(), grids = new Map<string, Grid>()
  const grid = (name: string) => {
    const part = sheetPart.get(name)
    if (!part || !files[part]) throw new Error(`The report has no "${name}" sheet. Choose the report that matches this project.`)
    if (!grids.has(name)) { const xml = strFromU8(files[part]!); texts.set(name, xml); grids.set(name, readGrid(xml, strings)) }
    return grids.get(name)!
  }
  const projectId = activities[0]?.projectId ?? ''
  const { current } = reportValues(activities, submissions, week)
  // A room cell shared by two handlers prints as the single activity it was: the average of its halves.
  const second = new Map(activities.flatMap(a => a.coOf ? [[a.coOf, a] as const] : []))
  const own = (a: NbcActivity) => current.progress.get(a.id) ?? a.progress
  const value = (a: NbcActivity) => Math.round((second.has(a.id) ? (own(a) + own(second.get(a.id)!)) / 2 : own(a)) * 1e12) / 1e12
  const plans: Plan[] = []

  if (isAreaProject(activities)) {
    const number = projectId.slice(-1), floors = roomFloors(activities), idFloor = floors.find(f => f.root.panel === 'ID'), mepFloor = floors.find(f => f.root.panel === 'MEP')
    if (!idFloor || !mepFloor) throw new Error('There are no BOQ activities to export.')
    const idSheet = `BP-0${number} (ID)`, mepSheet = `BP-0${number}(MEP)`
    const id = grid(idSheet), mep = grid(mepSheet)
    const idColumns = headerColumns(id, 7, 6, idCode)
    const mepColumns = number === '3' ? new Map(Object.entries(BP03_MEP_COLUMNS)) : headerColumns(mep, 10, 6, idCode)
    plans.push(planPanel(idSheet, id, idTasks(id, 9, maxRow(id)), idColumns, floorTasks(idFloor), value))
    plans.push(planPanel(mepSheet, mep, mepTasks(mep, 12, maxRow(mep)), mepColumns, floorTasks(mepFloor), value))
  } else {
    for (const floor of roomFloors(activities)) {
      const n = floor.root.name.replace(/\D+/g, ''), idSheet = `F${n} (ID)`, mepSheet = `${n}F(MEP)`
      const id = grid(idSheet), mep = grid(mepSheet)
      const idColumns = headerColumns(id, 6, 6, roomCode).set('CRD', 'F'), mepColumns = headerColumns(mep, 9, 5, roomCode)
      const design = (a: NbcActivity) => a.area !== 'MEP WORKS'
      plans.push(planPanel(idSheet, id, idTasks(id, 7, maxRow(id)), idColumns, floorTasks(floor, design), value))
      plans.push(planPanel(mepSheet, mep, mepTasks(mep, 10, maxRow(mep)), mepColumns, floorTasks(floor, a => !design(a)), value))
    }
  }

  let updated = 0, unchanged = 0, notInReport = 0
  const sheets: string[] = []
  for (const plan of plans) {
    notInReport += plan.expected - plan.writes.size
    const xml = texts.get(plan.sheet)!
    let changed = false
    const next = xml.replace(CELL, (whole, column: string, row: string, attrs: string, inner: string | undefined) => {
      const target = plan.writes.get(`${column}${row}`)
      if (target === undefined || inner === undefined) return whole
      const old = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1]
      if (old !== undefined && Math.abs(Number(old) - target) < 1e-12) { unchanged++; return whole }
      updated++; changed = true
      return `<c r="${column}${row}"${attrs}><v>${target}</v></c>`
    })
    if (changed) { files[sheetPart.get(plan.sheet)!] = strToU8(next); sheets.push(plan.sheet) }
  }
  // The percentages changed under the report's formulas; ask Excel to recalculate them when the file opens.
  const workbook = strFromU8(files['xl/workbook.xml']!)
  files['xl/workbook.xml'] = strToU8(/<calcPr\b[^>]*>/.test(workbook) ? workbook.replace(/<calcPr\b([^>]*?)(\/?)>/, (_, a: string, end: string) => `<calcPr${a.replace(/\sfullCalcOnLoad="[^"]*"/, '')} fullCalcOnLoad="1"${end}>`): workbook)
  return { bytes: zipSync(files), updated, unchanged, notInReport, sheets }
}
