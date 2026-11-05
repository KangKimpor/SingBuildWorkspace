import { roomFloors } from '../rooms'
import type { RoomFloor, RoomRow } from '../rooms'
import { handlers } from '../types'
import type { Handler, NbcActivity, NbcSubmission } from '../types'
import { reportingBlock, reportValues } from './workbook'
import { columnName, Sheet, Styles, writeWorkbook } from './xlsx'
import type { Style } from './xlsx'

/**
 * The BP03/BP04 area report: Overall Progress, the ID and MEP sheets and one sheet per handler, laid out like the client's
 * "WS Format" workbook. N/A cells are tasks that do not apply to an area; they drop out of every average exactly as the
 * workbook's own SUMPRODUCT(--ISNUMBER(...)) formulas do. Every formula carries the value it evaluates to.
 */
interface Report {
  number: string
  zoneLabel: string
  idBlockName: string
  /** The BP03 AV zone has its own weight and sits outside the area grid (Overall!D6, Overall!D24). */
  avArea?: string
  /** BP03 prints a weight of 1 on every MEP sub-system; BP04 leaves it blank. */
  subWeight: boolean
  /** BP04 handler sheets repeat the MEP task number ("1.1"); BP03 leaves it blank. */
  handlerTaskItem: boolean
  areaWidth: number; handlerWidth: number; overallDescription: number; mepHeaderHeight: number
}
const REPORTS: Record<string, Report> = {
  'nbc-bp03': { number: '03', zoneLabel: 'Zone weight (BOQ R06)', idBlockName: 'Finishing and Furnishing', avArea: 'AV System', subWeight: true, handlerTaskItem: false, areaWidth: 12.5, handlerWidth: 12, overallDescription: 46, mepHeaderHeight: 31.5 },
  'nbc-bp04': { number: '04', zoneLabel: 'Zone weight (BOQ share, Control sheet)', idBlockName: 'Guestroom', subWeight: false, handlerTaskItem: true, areaWidth: 14, handlerWidth: 14, overallDescription: 40, mepHeaderHeight: 43.5 },
}
export const hasAreaReport = (projectId: string | undefined) => !!projectId && projectId in REPORTS

const TITLES: Record<Handler, string> = {
  Sitha: 'MR. SITHA - Waterproofing, Screeding, Floor Finishing and Wall Stone / Marble / Tile',
  Lychhinh: 'MR. LYCHHINH - Carpet, Wood Flooring, Ceiling',
  Chhorvaon: 'MR. CHHORVAON - Sanitary ware and Glazing',
  Srun: 'MR. SRUN - Loose and Fixed Furniture, Drapery and Wall Finishes',
  Kheng: 'MR. KHENG - Decorative Lighting, Door, Plastering, Wall Frame / Backing and Painting',
  Vuth: 'MR. VUTH - Setting Out, RC Curb, Block / Brick Wall and RC Lintel',
  Tola: 'MR. TOLA - MEP',
}
const NAVY = 'FF1F3864', YELLOW = 'FFFFF2CC', BLUE = 'FFE9EEF7', GREEN = 'FFE2EFDA', INPUT = 'FFFFFFCC', GREY = 'FFBFBFBF', RED = 'FFC00000'

type Num = number | null
const wavg = (pairs: [number, Num][]): Num => {
  const live = pairs.filter((p): p is [number, number] => p[1] !== null), total = live.reduce((s, [w]) => s + w, 0)
  return live.length && total ? live.reduce((s, [w, v]) => s + w * v, 0) / total : null
}
const mean = (values: Num[]): Num => { const live = values.filter((v): v is number => v !== null); return live.length ? live.reduce((s, v) => s + v, 0) / live.length : null }
/** The workbook stores plain item numbers ("1.1") as numbers and roman numerals or "I / 1" as text. */
const itemValue = (item: string): number | string => /^\d+(\.\d+)?$/.test(item) && String(Number(item)) === item ? Number(item) : item
const quoted = (sheet: string) => `'${sheet.replaceAll("'", "''")}'`

interface Task { name: string; item: string; weight: number; row: number; cells: (NbcActivity | undefined)[]; handler: string }
interface Sub { act: NbcActivity; item: string; name: string; weight: number; counted: boolean; row: number; tasks: Task[] }
interface Sys { act: NbcActivity; item: string; name: string; row: number; subs: Sub[] }
interface Sec { act: NbcActivity; item: string; name: string; weight: number; row: number; tasks: Task[] }
interface Place { sheet: string; row: number; col: number }

function taskOf(row: RoomRow, floor: RoomFloor): Task {
  const cells = floor.rooms.map((room) => row.cells.get(room)), owners = [...new Set(cells.flatMap((c) => c ? [c.handler] : []))]
  return { name: row.activity.name, item: row.activity.item ?? '', weight: row.activity.relativeWeight, row: 0, cells, handler: owners.length === 1 ? owners[0]! : '' }
}

export function areaWorkbook(activities: NbcActivity[], submissions: NbcSubmission[], week: string) {
  const projectId = activities[0]?.projectId ?? '', cfg = REPORTS[projectId]
  if (!cfg) throw new Error('This project has no area report format.')
  const floors = roomFloors(activities), idFloor = floors.find((f) => f.root.panel === 'ID'), mepFloor = floors.find((f) => f.root.panel === 'MEP')
  if (!idFloor || !mepFloor) throw new Error('There are no BOQ activities to export.')
  const { current } = reportValues(activities, submissions, week)
  const value = (a: NbcActivity) => current.progress.get(a.id)!
  const styles = new Styles(), st = (s: Style) => styles.id(s)
  const idName = `BP-${cfg.number} (ID)`, mepName = `BP-${cfg.number} (MEP)`, idRef = quoted(idName), mepRef = quoted(mepName)
  const period = `Reporting week: ${reportingBlock(week)} ${week.slice(0, 4)}`
  const dark = st({ bold: true, color: 'FFFFFFFF', fill: NAVY, h: 'center', v: 'center', wrap: true })
  const darkPlain = st({ bold: true, color: 'FFFFFFFF', fill: NAVY, h: 'center', v: 'center' })
  const head = (sheet: Sheet, title: string) => { sheet.set(1, 1, title, st({ bold: true })); sheet.set(2, 1, period) }

  // ---- layout: the ID sections, the MEP systems and the rows they occupy ---------------------------------------------------
  const zone = idFloor.root.zone ?? idFloor.rooms.map(() => 1), idAreas = idFloor.rooms.length, mepAreas = mepFloor.rooms.length
  const avIndex = cfg.avArea ? idFloor.rooms.indexOf(cfg.avArea) : -1
  const secs: Sec[] = []
  for (const r of idFloor.rows) {
    if (r.task) { secs.at(-1)!.tasks.push(taskOf(r, idFloor)); continue }
    secs.push({ act: r.activity, item: r.activity.item ?? '', name: r.activity.name, weight: r.activity.relativeWeight, row: 0, tasks: [] })
  }
  for (const sec of secs) for (const na of [...(sec.act.naTasks ?? [])].sort((a, b) => a.at - b.at)) {
    sec.tasks.splice(na.at, 0, { name: na.name, item: '', weight: na.weight, row: 0, cells: idFloor.rooms.map(() => undefined), handler: '' })
  }
  let row = 7
  for (const sec of secs) { sec.row = row++; for (const t of sec.tasks) t.row = row++ }
  const idLast = row - 1
  const sysList: Sys[] = []
  for (const r of mepFloor.rows) {
    if (r.task) { sysList.at(-1)!.subs.at(-1)!.tasks.push(taskOf(r, mepFloor)); continue }
    if (r.level === 2) sysList.push({ act: r.activity, item: r.activity.item ?? '', name: r.activity.name, row: 0, subs: [] })
    else sysList.at(-1)!.subs.push({ act: r.activity, item: r.activity.item ?? '', name: r.activity.name, weight: r.activity.relativeWeight, counted: !r.activity.uncounted, row: 0, tasks: [] })
  }
  row = 5
  for (const sys of sysList) { sys.row = row++; for (const sub of sys.subs) { sub.row = row++; for (const t of sub.tasks) t.row = row++ } }

  // ---- handler sheets: one block per panel, only the sections / sub-systems and tasks that handler owns -------------------------
  const place = new Map<string, Place>()
  const idLetters = (n: number) => columnName(6 + n), mepLetters = (n: number) => columnName(4 + n)
  const handlerSheets = handlers.map((handler) => {
    const sheet = new Sheet(handler)
    head(sheet, `${TITLES[handler]} - SITE PROGRESS TRACKING`)
    sheet.widths.push({ from: 1, to: 1, width: 7 }, { from: 2, to: 2, width: 58 }, { from: 3, to: 3, width: 9 }, { from: 4, to: 15, width: cfg.handlerWidth })
    sheet.freeze = 'D4'
    let at = 4
    const writeBlock = (title: string, floor: RoomFloor, rows: { group?: { item: string; name: string }; tasks: Task[] }[], weightRef: (t: Task) => string) => {
      const owned = (t: Task) => t.handler === handler
      const used = rows.map((r) => ({ ...r, tasks: r.tasks.filter(owned) })).filter((r) => r.tasks.length)
      if (!used.length) return
      const keep = floor.rooms.map((room, i) => room !== cfg.avArea || used.some((r) => r.tasks.some((t) => t.cells[i]))), cols = floor.rooms.map((_, i) => i).filter((i) => keep[i])
      const last = 3 + cols.length
      sheet.set(at, 1, title, darkPlain)
      for (let c = 2; c <= last; c++) sheet.set(at, c, null, darkPlain)
      sheet.merges.push(`A${at}:${columnName(last)}${at}`); at++
      ;['Item', 'Description', 'Weight', ...cols.map((i) => floor.labels[i]!)].forEach((label, i) => sheet.set(at, i + 1, label, dark))
      sheet.heights.set(at, 43.5); at++
      for (const r of used) {
        if (r.group) {
          const s = st({ bold: true, fill: BLUE, border: true })
          sheet.set(at, 1, r.group.item, s); sheet.set(at, 2, r.group.name, s)
          for (let c = 3; c <= last; c++) sheet.set(at, c, null, s)
          at++
        }
        for (const t of r.tasks) {
          sheet.set(at, 1, floor === mepFloor && cfg.handlerTaskItem ? itemValue(t.item) : '', st({ border: true })); sheet.set(at, 2, t.name, st({ border: true }))
          sheet.set(at, 3, t.weight, st({ border: true, format: '0.0%', h: 'center' }), weightRef(t))
          cols.forEach((i, position) => {
            const leaf = t.cells[i]
            if (leaf) { sheet.set(at, 4 + position, value(leaf), st({ fill: INPUT, border: true, format: '0.0%', h: 'center' })); place.set(leaf.id, { sheet: handler, row: at, col: 4 + position }) }
            else sheet.set(at, 4 + position, null, st({ fill: GREY, border: true, size: 11, h: 'center' }))
          })
          sheet.validations.push(`D${at}:${columnName(last)}${at}`)
          at++
        }
      }
      at++
    }
    writeBlock(`${handler.toUpperCase()} - INTERIOR DESIGN (ID)`, idFloor, secs.map((s) => ({ group: { item: s.item, name: s.name }, tasks: s.tasks })), (t) => `${idRef}!E${t.row}`)
    writeBlock(`${handler.toUpperCase()} - MEP WORKS`, mepFloor, sysList.flatMap((sy) => sy.subs.map((sb) => ({ group: { item: `${sy.item} / ${sb.item}`, name: `${sy.name} - ${sb.name.replace(/\s*\(not counted[^)]*\)\s*$/i, '')}` }, tasks: sb.tasks }))), (t) => `${mepRef}!C${t.row}`)
    return sheet
  })
  const link = (leaf: NbcActivity | undefined) => { const p = leaf && place.get(leaf.id); return p ? `${p.sheet}!${columnName(p.col)}${p.row}` : undefined }

  // ---- ID sheet -------------------------------------------------------------------------------------------------------------
  const idSheet = new Sheet(idName), lastIdCol = 5 + idAreas, firstL = idLetters(0), lastL = idLetters(idAreas - 1)
  head(idSheet, `Project: Norodom Business Center - BP-${cfg.number} Interior Design (ID)`)
  idSheet.widths.push({ from: 1, to: 1, width: 7 }, { from: 2, to: 2, width: 58 }, { from: 3, to: 5, width: 10 }, { from: 6, to: lastIdCol, width: cfg.areaWidth })
  idSheet.freeze = 'C5'
  for (let c = 1; c <= lastIdCol; c++) idSheet.set(3, c, c === 6 ? 'Area Progress' : null, c === 6 ? darkPlain : st({ fill: NAVY, size: 11 }))
  idSheet.merges.push(`F3:${lastL}3`)
  ;['Item', 'Description', 'Overall', 'Activity weight', 'Leaf weight', ...idFloor.labels].forEach((label, i) => idSheet.set(4, i + 1, label, dark))
  idSheet.heights.set(4, 43.5)
  const NA = 'N/A', cell = (n: Num) => n === null ? NA : n
  const zoneRange = `$${firstL}$5:$${lastL}$5`
  const secArea = secs.map((s) => idFloor.rooms.map((_, i) => wavg(s.tasks.map((t) => [t.weight, t.cells[i] ? value(t.cells[i]!) : null]))))
  const areaTotal = idFloor.rooms.map((_, i) => wavg(secs.map((s, k) => [s.weight, secArea[k]![i]!])) ?? 0)
  const zoneSum = zone.reduce((s, z) => s + z, 0), idTotal = areaTotal.reduce((s, v, i) => s + zone[i]! * v, 0) / zoneSum
  const yellow = (extra: Style = {}) => st({ fill: YELLOW, border: true, ...extra })
  for (let c = 1; c <= lastIdCol; c++) { idSheet.set(5, c, null, yellow()); idSheet.set(6, c, null, yellow()) }
  idSheet.set(5, 2, cfg.zoneLabel, yellow({ bold: true })); idSheet.set(6, 2, `TOTAL - BP-${cfg.number} ID progress`, yellow({ bold: true }))
  idSheet.set(6, 3, idTotal, yellow({ bold: true, color: RED, format: '0.0%', h: 'center' }), `IFERROR(SUMPRODUCT(${zoneRange},${firstL}6:${lastL}6)/SUM(${zoneRange}),0)`)
  zone.forEach((z, i) => idSheet.set(5, 6 + i, z, yellow({ format: '0.00%', h: 'center' })))
  areaTotal.forEach((v, i) => idSheet.set(6, 6 + i, v, yellow({ bold: true, format: '0.0%', h: 'center' }), `IFERROR(SUMPRODUCT(--ISNUMBER(${idLetters(i)}7:${idLetters(i)}${idLast}),$D$7:$D$${idLast},${idLetters(i)}7:${idLetters(i)}${idLast})/SUMPRODUCT(--ISNUMBER(${idLetters(i)}7:${idLetters(i)}${idLast}),$D$7:$D$${idLast}),0)`))
  const areaWeighted = (r: number, values: Num[]) => ({ v: wavg(zone.map((z, i) => [z, values[i]!])), f: `IFERROR(SUMPRODUCT(--ISNUMBER(${firstL}${r}:${lastL}${r}),${zoneRange},${firstL}${r}:${lastL}${r})/SUMPRODUCT(--ISNUMBER(${firstL}${r}:${lastL}${r}),${zoneRange}),"N/A")` })
  const pct = (n: Num, base: Style) => st({ ...base, format: '0.0%', h: 'center', ...(n === null ? { fill: GREY } : {}) })
  secs.forEach((s, k) => {
    const bold = st({ bold: true, fill: BLUE, border: true }), r = s.row, first = r + 1, last = r + s.tasks.length
    idSheet.set(r, 1, s.item, bold); idSheet.set(r, 2, s.name, bold)
    const c = areaWeighted(r, secArea[k]!); idSheet.set(r, 3, cell(c.v), pct(c.v, { bold: true, fill: BLUE, border: true }), c.f)
    idSheet.set(r, 4, s.weight, st({ bold: true, fill: BLUE, border: true, format: '0.0%', h: 'center' })); idSheet.set(r, 5, null, st({ bold: true, fill: BLUE, border: true, h: 'center' }))
    secArea[k]!.forEach((v, i) => idSheet.set(r, 6 + i, cell(v), pct(v, { bold: true, fill: BLUE, border: true }), s.tasks.length ? `IFERROR(SUMPRODUCT(--ISNUMBER(${idLetters(i)}${first}:${idLetters(i)}${last}),$E$${first}:$E$${last},${idLetters(i)}${first}:${idLetters(i)}${last})/SUMPRODUCT(--ISNUMBER(${idLetters(i)}${first}:${idLetters(i)}${last}),$E$${first}:$E$${last}),"N/A")` : undefined))
    for (const t of s.tasks) {
      const plain = st({ border: true }), vals = t.cells.map((l) => l ? value(l) : null)
      idSheet.set(t.row, 1, '', plain); idSheet.set(t.row, 2, t.name, plain)
      const tc = areaWeighted(t.row, vals); idSheet.set(t.row, 3, cell(tc.v), st({ border: true, format: '0.0%', h: 'center' }), tc.f)
      idSheet.set(t.row, 4, null, plain); idSheet.set(t.row, 5, t.weight, st({ border: true, format: '0.0%', h: 'center' }))
      t.cells.forEach((l, i) => {
        const v = vals[i]!
        if (l) idSheet.set(t.row, 6 + i, v, pct(v, { border: true }), link(l))
        else idSheet.set(t.row, 6 + i, NA, st({ border: true, fill: GREY, format: '0.0%', h: 'center' }))
      })
    }
  })

  // ---- MEP sheet ------------------------------------------------------------------------------------------------------------
  const mepSheet = new Sheet(mepName), lastMepCol = 3 + mepAreas
  head(mepSheet, `Project: Norodom Business Center - BP-${cfg.number} MEP Works`)
  mepSheet.widths.push({ from: 1, to: 1, width: 7 }, { from: 2, to: 2, width: 58 }, { from: 3, to: 3, width: 9 }, { from: 4, to: lastMepCol, width: cfg.areaWidth })
  mepSheet.freeze = 'C5'
  for (let c = 1; c <= lastMepCol; c++) mepSheet.set(3, c, c === 4 ? 'Area Progress' : null, c === 4 ? darkPlain : st({ fill: NAVY, size: 11 }))
  mepSheet.merges.push(`D3:${columnName(lastMepCol)}3`)
  ;['Item', 'Description', 'Weight', ...mepFloor.labels].forEach((label, i) => mepSheet.set(4, i + 1, label, dark))
  mepSheet.heights.set(4, cfg.mepHeaderHeight)
  const subArea = sysList.map((sy) => sy.subs.map((sb) => mepFloor.rooms.map((_, i) => wavg(sb.tasks.map((t) => [t.weight, t.cells[i] ? value(t.cells[i]!) : null])))))
  const sysArea = sysList.map((sy, y) => mepFloor.rooms.map((room, i) => mean(sy.subs.flatMap((sb, b) => sb.counted ? [subArea[y]![b]![i]!] : [])) ?? ((sy.act.emptyZero ?? []).includes(room) ? 0 : null)))
  sysList.forEach((sy, y) => {
    const s = st({ bold: true, fill: BLUE, border: true })
    mepSheet.set(sy.row, 1, itemValue(sy.item), s); mepSheet.set(sy.row, 2, sy.name, s); mepSheet.set(sy.row, 3, null, s)
    sysArea[y]!.forEach((v, i) => {
      const refs = sy.subs.filter((sb) => sb.counted).map((sb) => `${mepLetters(i)}${sb.row}`).join(','), zero = (sy.act.emptyZero ?? []).includes(mepFloor.rooms[i]!)
      mepSheet.set(sy.row, 4 + i, cell(v), st({ bold: true, fill: BLUE, border: true, format: '0.0%', h: 'center' }), `IFERROR(AVERAGE(${refs}),${zero ? '0' : '"N/A"'})`)
    })
    sy.subs.forEach((sb, b) => {
      const g = st({ bold: true, fill: GREEN, border: true }), first = sb.row + 1, last = sb.row + sb.tasks.length
      mepSheet.set(sb.row, 1, itemValue(sb.item), g); mepSheet.set(sb.row, 2, sb.name, g)
      mepSheet.set(sb.row, 3, cfg.subWeight ? 1 : null, st({ bold: true, fill: GREEN, border: true, format: '0.0%', h: 'center' }))
      subArea[y]![b]!.forEach((v, i) => mepSheet.set(sb.row, 4 + i, cell(v), st({ bold: true, fill: GREEN, border: true, format: '0.0%', h: 'center' }),
        `IFERROR(SUMPRODUCT(--ISNUMBER(${mepLetters(i)}${first}:${mepLetters(i)}${last}),$C$${first}:$C$${last},${mepLetters(i)}${first}:${mepLetters(i)}${last})/SUMPRODUCT(--ISNUMBER(${mepLetters(i)}${first}:${mepLetters(i)}${last}),$C$${first}:$C$${last}),"N/A")`))
      for (const t of sb.tasks) {
        mepSheet.set(t.row, 1, itemValue(t.item), st({ border: true })); mepSheet.set(t.row, 2, t.name, st({ border: true }))
        mepSheet.set(t.row, 3, t.weight, st({ border: true, size: 11, format: '0.0%', h: 'center' }))
        t.cells.forEach((l, i) => {
          if (l) mepSheet.set(t.row, 4 + i, value(l), st({ border: true, size: 11, format: '0.0%', h: 'center' }), link(l))
          else mepSheet.set(t.row, 4 + i, NA, st({ border: true, size: 11, fill: GREY, format: '0.0%', h: 'center' }))
        })
      }
    })
  })

  // ---- Overall Progress -----------------------------------------------------------------------------------------------------
  const overall = new Sheet('Overall Progress')
  const gridAreas = idFloor.rooms.map((_, i) => i).filter((i) => i !== avIndex), cols = gridAreas.length
  const lastOverall = 4 + cols, ec = (k: number) => columnName(5 + k), eFirst = ec(0), eLast = ec(cols - 1)
  const overallSecs = secs.map((s, k) => ({ s, k })).filter(({ s }) => !s.tasks.every((t) => t.cells.every((l, i) => !l || i === avIndex)) || avIndex < 0)
  const avSec = secs.find((s) => avIndex >= 0 && s.tasks.length && s.tasks.every((t) => t.cells.every((l, i) => !l || i === avIndex)))
  const blockRow = 8, firstSec = 9, mepBlock = firstSec + overallSecs.length, firstSys = mepBlock + 1
  head(overall, `Project: Norodom Business Center - BP-${cfg.number}`)
  overall.widths.push({ from: 1, to: 1, width: 7 }, { from: 2, to: 2, width: cfg.overallDescription }, { from: 3, to: 3, width: 10 }, { from: 4, to: 4, width: 11 }, { from: 5, to: lastOverall, width: cfg.areaWidth })
  overall.freeze = 'E5'
  for (let c = 1; c <= lastOverall; c++) overall.set(3, c, c === 5 ? 'Area Progress' : null, c === 5 ? darkPlain : st({ fill: NAVY, size: 11 }))
  overall.merges.push(`E3:${columnName(lastOverall)}3`)
  ;['Item', 'Description', 'Weight', 'Overall', ...gridAreas.map((i) => idFloor.labels[i]!)].forEach((label, i) => overall.set(4, i + 1, label, dark))
  overall.heights.set(4, 43.5)
  const zoneK = gridAreas.map((i) => zone[i]!), zoneRow = `$${eFirst}$5:$${eLast}$5`, zoneSumK = zoneK.reduce((s, z) => s + z, 0)
  const band = (r: number) => { for (let c = 1; c <= lastOverall; c++) overall.set(r, c, null, st({ fill: BLUE, border: true })) }
  band(5); if (avIndex >= 0) band(6)
  overall.set(5, 2, cfg.zoneLabel, st({ bold: true, fill: BLUE, border: true }))
  gridAreas.forEach((a, k) => overall.set(5, 5 + k, zone[a]!, st({ fill: BLUE, border: true, format: '0.00%', h: 'center' }), `${idRef}!${idLetters(a)}5`))
  const avWeight = avIndex >= 0 ? zone[avIndex]! : 0
  if (avIndex >= 0) { overall.set(6, 2, 'AV System weight (BOQ R06)', st({ bold: true, fill: BLUE, border: true })); overall.set(6, 4, avWeight, st({ fill: BLUE, border: true, format: '0.00%', h: 'center' }), `${idRef}!${idLetters(avIndex)}5`) }
  const weightedD = (r: number, values: Num[]) => ({ v: wavg(zoneK.map((z, k) => [z, values[k]!])), f: `IFERROR(SUMPRODUCT(--ISNUMBER(${eFirst}${r}:${eLast}${r}),${zoneRow},${eFirst}${r}:${eLast}${r})/SUMPRODUCT(--ISNUMBER(${eFirst}${r}:${eLast}${r}),${zoneRow}),"N/A")` })
  const label = (r: number, fill: string, item: string, name: string) => { const s = st({ bold: true, fill, border: true }); overall.set(r, 1, item, s); overall.set(r, 2, name, s) }
  const numberCell = (r: number, c: number, v: Num, fill: string, f: string | undefined, extra: Style = {}) => overall.set(r, c, cell(v), st({ bold: true, border: true, format: '0.0%', h: 'center', fill: v === null ? GREY : fill, ...extra }), f)
  const idWeight = idFloor.root.relativeWeight, mepWeight = mepFloor.root.relativeWeight
  const guest = gridAreas.map((a) => areaTotal[a]!)
  // MEP seen from each ID area: the linked MEP areas of one system are averaged when more than one feeds the area.
  const linkOf = (a: number) => (idFloor.root.links?.[idFloor.rooms[a]!] ?? []).map((m) => mepFloor.rooms.indexOf(m))
  const sysFor = sysList.map((_, y) => gridAreas.map((a) => mean(linkOf(a).map((m) => sysArea[y]![m]!))))
  const mepK = gridAreas.map((_, k) => mean(sysList.map((_, y) => sysFor[y]![k]!)))
  const dGuest = weightedD(blockRow, guest), dMep = weightedD(mepBlock, mepK)
  const avValue = avSec ? secArea[secs.indexOf(avSec)]![avIndex]! ?? 0 : 0
  const total = cfg.avArea
    ? ((zoneSumK * ((dGuest.v ?? 0) * idWeight + (dMep.v ?? dGuest.v ?? 0) * mepWeight)) + avWeight * avValue) / (zoneSumK + avWeight)
    : (dGuest.v ?? 0) * idWeight + (dMep.v ?? 0) * mepWeight
  for (let c = 1; c <= lastOverall; c++) overall.set(7, c, null, st({ fill: YELLOW, border: true }))
  overall.set(7, 2, 'Overall Progress', st({ bold: true, fill: YELLOW, border: true }))
  overall.set(7, 4, total, st({ bold: true, fill: YELLOW, border: true, format: '0.0%', h: 'center', color: RED }),
    cfg.avArea ? `IFERROR((SUM(${zoneRow})*(D${blockRow}*$C$${blockRow}+IF(ISNUMBER(D${mepBlock}),D${mepBlock},D${blockRow})*$C$${mepBlock})+$D$6*D${firstSys + sysList.length})/(SUM(${zoneRow})+$D$6),0)` : `D${blockRow}*$C$${blockRow}+D${mepBlock}*$C$${mepBlock}`)
  gridAreas.forEach((_, k) => {
    const g = guest[k]!, m = mepK[k] ?? null, v = cfg.avArea ? (m !== null ? g * idWeight + m * mepWeight : g) : g * idWeight + (m ?? 0) * mepWeight
    overall.set(7, 5 + k, v, st({ bold: true, fill: YELLOW, border: true, format: '0.0%', h: 'center' }),
      cfg.avArea ? `IF(ISNUMBER(${ec(k)}${mepBlock}),${ec(k)}${blockRow}*$C$${blockRow}+${ec(k)}${mepBlock}*$C$${mepBlock},${ec(k)}${blockRow})` : `${ec(k)}${blockRow}*$C$${blockRow}+${ec(k)}${mepBlock}*$C$${mepBlock}`)
  })
  const block = (r: number, name: string, weight: number, d: { v: Num; f: string }, byArea: Num[], areaFormula: (k: number) => string) => {
    label(r, YELLOW, '', name); overall.set(r, 3, weight, st({ bold: true, fill: YELLOW, border: true, format: '0%', h: 'center' }))
    numberCell(r, 4, d.v, YELLOW, d.f); byArea.forEach((v, k) => numberCell(r, 5 + k, v, YELLOW, areaFormula(k)))
  }
  block(blockRow, cfg.idBlockName, idWeight, dGuest, guest, (k) => `${idRef}!${idLetters(gridAreas[k]!)}6`)
  overallSecs.forEach(({ s, k: si }, n) => {
    const r = firstSec + n, byArea = gridAreas.map((a) => secArea[si]![a]!)
    label(r, BLUE, s.item, s.name); overall.set(r, 3, null, st({ fill: BLUE, border: true }))
    const d = weightedD(r, byArea); numberCell(r, 4, d.v, BLUE, d.f)
    byArea.forEach((v, k) => numberCell(r, 5 + k, v, BLUE, `${idRef}!${idLetters(gridAreas[k]!)}${s.row}`))
  })
  block(mepBlock, 'MEP System', mepWeight, dMep, mepK, (k) => `IFERROR(AVERAGE(${ec(k)}${firstSys}:${ec(k)}${firstSys + sysList.length - 1}),"N/A")`)
  sysList.forEach((sy, y) => {
    const r = firstSys + y
    label(r, BLUE, sy.item, sy.name); overall.set(r, 3, null, st({ fill: BLUE, border: true }))
    const d = weightedD(r, sysFor[y]!); numberCell(r, 4, d.v, BLUE, d.f)
    gridAreas.forEach((a, k) => {
      const m = linkOf(a), refs = m.map((i) => `${mepRef}!${mepLetters(i)}${sy.row}`)
      const span = m.length > 1 ? `${mepRef}!${mepLetters(m[0]!)}${sy.row}:${mepLetters(m.at(-1)!)}${sy.row}` : ''
      numberCell(r, 5 + k, sysFor[y]![k]!, BLUE, m.length > 1 ? `IFERROR(AVERAGE(${span}),"N/A")` : refs[0])
    })
  })
  if (avSec) {
    const r = firstSys + sysList.length
    label(r, BLUE, ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][sysList.length] ?? '', 'AV System (All Floors)'); overall.set(r, 3, null, st({ fill: BLUE, border: true }))
    numberCell(r, 4, avValue, BLUE, `${idRef}!${idLetters(avIndex)}${avSec.row}`)
    gridAreas.forEach((_, k) => overall.set(r, 5 + k, '-', st({ bold: true, fill: GREY, border: true, format: '0.0%', h: 'center' })))
  }

  return { bytes: writeWorkbook([overall, idSheet, mepSheet, ...handlerSheets], styles), overall: total }
}
