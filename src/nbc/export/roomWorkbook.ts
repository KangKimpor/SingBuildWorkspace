import { cellHalves, cellProgress, roomFloors } from '../rooms'
import type { RoomFloor, RoomRow } from '../rooms'
import { bp02Handlers } from '../types'
import type { NbcActivity, NbcSubmission } from '../types'
import { reportingBlock, reportValues } from './workbook'
import { columnName, Sheet, Styles, writeWorkbook } from './xlsx'
import type { Style } from './xlsx'

const NAVY = 'FF1F3864', YELLOW = 'FFFFF2CC', BLUE = 'FFE9EEF7', GREEN = 'FFE2EFDA', INPUT = 'FFFFFFCC', GREY = 'FFBFBFBF', RED = 'FFC00000'
const TITLES: Record<string, string> = {
  Sitha: 'MR. SITHA - Setting out, Curb, Waterproofing, Marble (wall and floor) and Skirting',
  Lychhinh: 'MR. LYCHHINH - Ceiling and Carpet',
  Chhorvaon: 'MR. CHHORVAON - Glass doors and Shower screen',
  Srun: 'MR. SRUN - Loose and Fixed Furniture, Drapery and Timber veneer / wallpaper panel',
  Kheng: 'MR. KHENG - Doors, Decorative lighting, Masonry, Wall backing and Cement board',
  Tola: 'MR. TOLA - MEP and Final T&C',
}
const PROJECT = 'Project: Norodom Business Center - BP-02 guestrooms'
type Num = number | ''
const mean = (values: Num[]) => { const n = values.filter((v): v is number => v !== ''); return n.length ? n.reduce((a, b) => a + b, 0) / n.length : '' as const }
const quoted = (sheet: string) => `'${sheet.replaceAll("'", "''")}'`

interface Node { row: RoomRow; kids: Node[]; sheetRow: number; c: Num; cols: Num[] }

/**
 * The room-column report: Overall Progress, one sheet per floor and one per handler, laid out like the client's workbook.
 * Every formula carries the value it evaluates to, so viewers that do not recalculate still show the figures.
 */
export function roomWorkbook(activities: NbcActivity[], submissions: NbcSubmission[], week: string) {
  const { current } = reportValues(activities, submissions, week)
  const value = (a: NbcActivity) => current.progress.get(a.id)!
  const floors = roomFloors(activities), styles = new Styles()
  const period = `Reporting week: ${reportingBlock(week)} ${week.slice(0, 4)}`
  const st = (s: Style) => styles.id(s)
  const head = (sheet: Sheet) => { sheet.set(1, 1, PROJECT, st({ bold: true })); sheet.set(2, 1, period) }
  const dark = st({ bold: true, color: 'FFFFFFFF', fill: NAVY, h: 'center', v: 'center' }), darkWrap = st({ bold: true, color: 'FFFFFFFF', fill: NAVY, h: 'center', v: 'center', wrap: true })

  // 1. Handler sheets: one block per floor, listing only the sections, groups and tasks that handler owns.
  const place = new Map<string, { sheet: string; row: number }>()
  const handlerSheets = bp02Handlers.map((handler) => {
    const sheet = new Sheet(handler)
    head(sheet); sheet.set(1, 1, `${TITLES[handler]} - SITE PROGRESS TRACKING (BP-02, L13-L23)`, st({ bold: true }))
    sheet.widths.push({ from: 1, to: 1, width: 6 }, { from: 2, to: 2, width: 58 }, { from: 3, to: 3, width: 11 }, { from: 4, to: 26, width: 10.51 })
    sheet.freeze = 'D3'
    let row = 4
    for (const floor of floors) {
      const last = 3 + floor.rooms.length, owned = (r: RoomRow) => r.leaves.some((l) => l.handler === handler)
      const index = new Map(floor.rows.map((r) => [r.activity.id, r]))
      const wanted = new Set<string>()
      for (const r of floor.rows) if (r.task && owned(r)) for (let p: RoomRow | undefined = r; p; p = p.activity.parentId ? index.get(p.activity.parentId) : undefined) wanted.add(p.activity.id)
      if (!wanted.size) continue
      sheet.set(row, 1, handler.toUpperCase(), st({ bold: true, color: 'FFFFFFFF', fill: NAVY }))
      for (let c = 2; c <= last; c++) sheet.set(row, c, null, st({ fill: NAVY }))
      sheet.set(row, 4, `${floor.root.name} Progress`, dark); sheet.merges.push(`D${row}:${columnName(last)}${row}`)
      sheet.heights.set(row, 15); row++
      ;['Item', 'Description', handler === 'Tola' ? 'Floor avg (report)' : 'Floor avg', ...floor.rooms].forEach((label, i) => sheet.set(row, i + 1, label, i < 3 ? dark : darkWrap))
      sheet.heights.set(row, 31.5); row++
      for (const r of floor.rows) {
        if (!wanted.has(r.activity.id)) continue
        const a = r.activity
        if (r.level === 2 && a.item === 'C') continue // MEP tabs start straight at the systems
        if (!r.task) {
          const fill = r.level === 2 ? YELLOW : r.depth > 1 ? GREEN : BLUE, s = st({ bold: true, fill, border: true })
          sheet.set(row, 1, a.item || '', s); sheet.set(row, 2, a.name, s)
          for (let c = 3; c <= last; c++) sheet.set(row, c, null, s)
        } else {
          sheet.set(row, 1, a.item || '', st({ border: true })); sheet.set(row, 2, (a.item ? a.name : `    ${a.name}`), st({ border: true }))
          // A cell shared by two handlers shows each of them their own half here; the floor sheet averages the halves back into one value.
          const mine = floor.rooms.map((room) => cellHalves(r, room).find((l) => l.handler === handler))
          const values = mine.map((l) => l ? value(l) : '' as const)
          sheet.set(row, 3, mean(values), st({ border: true, format: '0%' }), `IFERROR(AVERAGE(D${row}:${columnName(last)}${row}),"")`)
          mine.forEach((l, i) => {
            if (l) { sheet.set(row, 4 + i, value(l), st({ fill: INPUT, border: true, format: '0%', h: 'center' })); place.set(l.id, { sheet: handler, row }) }
            else sheet.set(row, 4 + i, null, st({ fill: GREY, border: true, h: 'center' }))
          })
          sheet.validations.push(`D${row}:${columnName(last)}${row}`)
        }
        row++
      }
      row++
    }
    return sheet
  })

  // 2. Overall Progress layout: the sections and their top-level groups, matched by item and name across floors.
  const sectionsOf = (floor: RoomFloor) => floor.rows.filter((r) => r.level === 2)
  const firstFloor = floors[0]
  if (!firstFloor) throw new Error('There are no BOQ activities to export.')
  const groupsOf = (floor: RoomFloor, sec: RoomRow) => floor.rows.filter((r) => !r.task && r.activity.parentId === sec.activity.id)
  const seenGroups = new Map<string, { item: string; name: string }[]>()
  for (const floor of floors) for (const sec of sectionsOf(floor)) {
    const list = seenGroups.get(sec.activity.item ?? '') ?? []
    for (const g of groupsOf(floor, sec)) if (!list.some((x) => x.item === (g.activity.item ?? '') && x.name === g.activity.name)) list.push({ item: g.activity.item ?? '', name: g.activity.name })
    seenGroups.set(sec.activity.item ?? '', list)
  }
  const overallRows: { key: string; item: string; name: string; section: boolean; row: number }[] = []
  for (const sec of sectionsOf(firstFloor)) {
    const item = sec.activity.item ?? ''
    overallRows.push({ key: `S|${item}`, item, name: sec.activity.name, section: true, row: 7 + overallRows.length })
    for (const g of seenGroups.get(item) ?? []) overallRows.push({ key: `G|${item}|${g.item}|${g.name}`, item: g.item, name: g.name, section: false, row: 7 + overallRows.length })
  }
  const sectionRow = (item: string) => overallRows.find((r) => r.key === `S|${item}`)!.row
  const lastFloorCol = 4 + floors.length

  // 3. Floor sheets: weights and links on the left, one value column per room.
  const overallValues = new Map<string, Num>(), overallFormulas = new Map<string, string>()
  const floorSheets = floors.map((floor, floorIndex) => {
    const sheet = new Sheet(floor.root.name), last = 3 + floor.rooms.length, lastName = columnName(last)
    head(sheet)
    sheet.widths.push({ from: 1, to: 1, width: 6 }, { from: 2, to: 2, width: 58 }, { from: 3, to: 3, width: 11 }, { from: 4, to: Math.max(last, 17), width: 10.51 })
    sheet.freeze = 'D5'
    sheet.set(3, 4, `${floor.root.name} Progress`, st({ bold: true, color: 'FFFFFFFF', fill: NAVY, h: 'center' })); sheet.merges.push(`D3:${lastName}3`)
    for (let c = 5; c <= last; c++) sheet.set(3, c, null, st({ fill: NAVY }))
    const nodes = new Map<string, Node>(), top: Node[] = []
    for (const r of floor.rows) {
      const node: Node = { row: r, kids: [], sheetRow: 0, c: '', cols: [] }
      nodes.set(r.activity.id, node)
      const parent = r.activity.parentId ? nodes.get(r.activity.parentId) : undefined
      if (parent) parent.kids.push(node); else top.push(node)
    }
    let rowNumber = 5
    const assign = (node: Node) => { node.sheetRow = rowNumber++; node.kids.forEach(assign) }
    top.forEach((sec, i) => { if (i) rowNumber++; assign(sec) })
    const col = (i: number) => columnName(4 + i)
    const span = (kids: Node[], i: number) => `${col(i)}${kids[0]!.sheetRow}:${col(i)}${kids.at(-1)!.sheetRow}`
    const weights = (kids: Node[]) => `$C${kids[0]!.sheetRow}:$C${kids.at(-1)!.sheetRow}`
    const weight = (n: Node) => n.row.activity.relativeWeight
    const progressC = (fill: string) => st({ bold: true, fill, border: true, format: '0.00%', color: RED })
    const tasksUnder = (n: Node): Node[] => n.row.task ? [n] : n.kids.flatMap(tasksUnder)
    // A guestroom task row stores the sum of its room shares, not the weight the report prints (E): a room scores its tasks over the
    // ones it has, so a leaf holds E / (rooms in the group x the room's task weights). The room with every task of the group has
    // task weights of 1, so there the leaf's share times the room count is E. Data stored differently keeps its task weights.
    const taskWeight = new Map<Node, number>()
    const settle = (n: Node) => {
      if (n.row.task) return
      if (!n.kids.length || !n.kids.every((k) => k.row.task)) { n.kids.forEach(settle); return }
      const rooms = new Set(n.kids.flatMap((k) => floor.rooms.filter((room) => k.row.cells.has(room))))
      let fullest = '', most = 0
      for (const room of floor.rooms) { const count = n.kids.filter((k) => k.row.cells.has(room)).length; if (count > most) { most = count; fullest = room } }
      const derived = n.kids.map((k) => (k.row.cells.get(fullest)?.relativeWeight ?? NaN) * rooms.size)
      const sound = derived.every(Number.isFinite) && Math.abs(derived.reduce((s, x) => s + x, 0) - 1) < 1e-6
      n.kids.forEach((k, i) => taskWeight.set(k, sound ? derived[i]! : weight(k)))
    }
    const w = (n: Node) => taskWeight.get(n) ?? weight(n)

    const evaluate = (node: Node, mep: boolean, lo: number, hi: number) => {
      const a = node.row.activity, r = node.sheetRow
      node.cols = floor.rooms.map(() => '' as Num)
      if (node.row.task) {
        floor.rooms.forEach((room, i) => {
          const halves = cellHalves(node.row, room), style = st({ border: true, format: '0%', h: 'center' })
          if (!halves.length) { sheet.set(r, 4 + i, null, style); return }
          const v = cellProgress(halves, value)
          node.cols[i] = v
          const refs = halves.map((l) => place.get(l.id)).map((at) => at ? `${at.sheet}!${col(i)}${at.row}` : '')
          sheet.set(r, 4 + i, v, style, refs.every(Boolean) ? refs.length > 1 ? `AVERAGE(${refs.join(',')})` : refs[0] : undefined)
        })
        node.c = mean(node.cols)
        sheet.set(r, 1, a.item || '', st({})); sheet.set(r, 2, (a.item ? a.name : `    ${a.name}`), st({})); sheet.set(r, 3, w(node), st({ format: '0.00%' }))
        return
      }
      node.kids.forEach((k) => evaluate(k, mep, lo, hi))
      const kids = node.kids, section = node.row.level === 2, leafGroup = kids.every((k) => k.row.task)
      const fill = section ? YELLOW : node.row.depth > 1 ? GREEN : BLUE, plain = st({ bold: true, fill, border: true })
      sheet.set(r, 1, a.item || '', plain); sheet.set(r, 2, a.name, plain)
      for (let c = 3; c <= last; c++) sheet.set(r, c, null, plain)
      for (let i = lo; i <= hi; i++) {
        const present = kids.filter((k) => k.cols[i] !== ''), numbers = present.map((k) => k.cols[i] as number)
        let v: Num, f: string
        // The report scores a room over the tasks (and groups) it has: what is blank drops out and the rest are re-weighted.
        const total = present.reduce((s, k) => s + w(k), 0), weighted = present.reduce((s, k) => s + w(k) * (k.cols[i] as number), 0)
        if (leafGroup && a.average && !mep) { v = mean(numbers); f = `AVERAGE(${span(kids, i)})` }
        else if (leafGroup) {
          v = total ? weighted / total : ''
          f = `IFERROR(SUMPRODUCT(${span(kids, i)},${weights(kids)})/SUMPRODUCT((${span(kids, i)}<>"")*${weights(kids)}),"")`
        } else if (mep) { v = numbers.length ? numbers.reduce((s, x) => s + x, 0) / numbers.length : ''; f = `IFERROR((${kids.map((k) => `N(${col(i)}${k.sheetRow})`).join('+')})/COUNT(${kids.map((k) => `${col(i)}${k.sheetRow}`).join(',')}),"")` }
        else {
          v = total ? weighted / total : ''
          f = `IFERROR((${kids.map((k) => `$C${k.sheetRow}*N(${col(i)}${k.sheetRow})`).join('+')})/(${kids.map((k) => `$C${k.sheetRow}*(${col(i)}${k.sheetRow}<>"")`).join('+')}),"")`
        }
        node.cols[i] = v
        sheet.set(r, 4 + i, v, st({ bold: true, fill, border: true, format: '0%', h: 'center' }), f)
      }
      if (section && !mep) {
        // Each group averages the rooms that have it; the section weighs those group figures, over the groups that have any room.
        const groups = kids.map((k) => ({ weight: w(k), value: mean(k.cols.slice(lo, hi + 1)) })).filter((g) => g.value !== '')
        const total = groups.reduce((s, g) => s + g.weight, 0)
        node.c = total ? groups.reduce((s, g) => s + g.weight * (g.value as number), 0) / total : ''
        const range = (k: Node) => `${col(lo)}${k.sheetRow}:${col(hi)}${k.sheetRow}`
        sheet.set(r, 3, node.c, progressC(fill), `IFERROR((${kids.map((k) => `$C${k.sheetRow}*IFERROR(AVERAGE(${range(k)}),0)`).join('+')})/(${kids.map((k) => `$C${k.sheetRow}*(COUNT(${range(k)})>0)`).join('+')}),"")`)
      } else if (leafGroup && mep) {
        node.c = kids.reduce((s, k) => s + weight(k) * (k.c === '' ? 0 : k.c as number), 0)
        sheet.set(r, 3, node.c, progressC(fill), kids.map((k) => `$C${k.sheetRow}*AVERAGE(D${k.sheetRow}:${lastName}${k.sheetRow})`).join('+'))
      } else if (mep) {
        node.c = mean(kids.map((k) => k.c))
        sheet.set(r, 3, node.c, progressC(fill), `AVERAGE(${kids.map((k) => `C${k.sheetRow}`).join(',')})`)
      } else sheet.set(r, 3, weight(node), st({ bold: true, fill, border: true, format: '0.00%' }))
    }
    const sectionItem = (n: Node) => n.row.activity.item ?? ''
    top.filter((sec) => sectionItem(sec) !== 'C').forEach(settle)
    for (const sec of top) {
      const used = tasksUnder(sec).flatMap((t) => floor.rooms.map((room, i) => t.row.cells.has(room) ? i : -1)).filter((i) => i >= 0)
      evaluate(sec, sectionItem(sec) === 'C', Math.min(...used), Math.max(...used))
    }
    const total = top.reduce((s, sec) => s + weight(sec) * (sec.c === '' ? 0 : sec.c as number), 0)
    sheet.set(4, 1, 'Item', dark); sheet.set(4, 2, 'Description', dark)
    sheet.set(4, 3, total, st({ bold: true, size: 11, color: 'FFFFFF99', fill: NAVY, format: '0.00%', h: 'center', v: 'center' }), top.map((sec) => `'Overall Progress'!$C$${sectionRow(sectionItem(sec))}*C${sec.sheetRow}`).join('+'))
    floor.rooms.forEach((room, i) => sheet.set(4, 4 + i, room, darkWrap)); sheet.heights.set(4, 31.5)
    // What the Overall sheet reads from this floor.
    const sheetName = quoted(floor.root.name)
    for (const sec of top) {
      const item = sectionItem(sec), cols = sec.cols.flatMap((x, i) => x === '' ? [] : [i]), first = cols[0] ?? 0, end = cols.at(-1) ?? 0
      overallValues.set(`${floorIndex}|S|${item}`, sec.c); overallFormulas.set(`${floorIndex}|S|${item}`, `${sheetName}!C${sec.sheetRow}`)
      for (const g of sec.kids) {
        const key = `${floorIndex}|G|${item}|${g.row.activity.item ?? ''}|${g.row.activity.name}`
        if (item === 'C') { overallValues.set(key, g.c); overallFormulas.set(key, `${sheetName}!C${g.sheetRow}`) }
        else if (first === end) { overallValues.set(key, g.cols[first] ?? ''); overallFormulas.set(key, `${sheetName}!${col(first)}${g.sheetRow}`) }
        else { overallValues.set(key, mean(g.cols.slice(first, end + 1))); overallFormulas.set(key, `AVERAGE(${sheetName}!${col(first)}${g.sheetRow}:${col(end)}${g.sheetRow})`) }
      }
    }
    overallValues.set(`${floorIndex}|T`, total)
    return sheet
  })

  // 4. Overall Progress.
  const overall = new Sheet('Overall Progress')
  head(overall)
  overall.widths.push({ from: 1, to: 1, width: 6 }, { from: 2, to: 2, width: 58 }, { from: 3, to: 3, width: 10 }, { from: 4, to: 4, width: 11 }, { from: 5, to: lastFloorCol, width: 10.5 })
  overall.freeze = 'E6'
  const lastLetter = columnName(lastFloorCol)
  for (let c = 1; c <= lastFloorCol; c++) overall.set(3, c, c === 5 ? 'Floor Progress' : null, dark)
  overall.merges.push(`E3:${lastLetter}3`)
  ;['Item', 'Description', 'Weight', 'Overall', ...floors.map((f) => f.root.name)].forEach((label, i) => overall.set(4, i + 1, label, dark))
  overall.heights.set(4, 24)
  // Guestroom and MEP weigh a floor by its guestrooms, as 'F<n> (ID)'!D6 does in the client's report; the corridor weighs floors equally.
  const guestRooms = floors.map((floor) => {
    const rows = new Map(floor.rows.map((r) => [r.activity.id, r]))
    const inGuestroom = (row: RoomRow) => { for (let p: RoomRow | undefined = row; p; p = p.activity.parentId ? rows.get(p.activity.parentId) : undefined) if (p.level === 2) return p.activity.item === 'A'; return false }
    const rooms = new Set<string>()
    for (const row of floor.rows) if (row.task && inGuestroom(row)) for (const room of row.cells.keys()) rooms.add(room)
    return rooms.size || floor.rooms.filter((room) => room !== 'CRD').length || 1
  })
  const totalRooms = guestRooms.reduce((s, n) => s + n, 0), roomsRow = `$E$5:$${lastLetter}$5`
  overall.set(5, 2, 'Guestrooms (floor weight of Guestroom and MEP)')
  floors.forEach((_, i) => overall.set(5, 5 + i, guestRooms[i]!, st({ h: 'center', v: 'center' })))
  const sectionRows = overallRows.filter((r) => r.section)
  const totalStyle = (extra: Style = {}) => st({ bold: true, fill: YELLOW, border: true, format: '0.00%', h: 'center', v: 'center', ...extra })
  const label = st({ bold: true, fill: YELLOW, border: true })
  overall.set(6, 1, null, label); overall.set(6, 2, 'TOTAL - BP-02 guestrooms L13-L23', label)
  const weights = sectionRows.map((s) => ({ ...s, w: sectionsOf(firstFloor).find((x) => x.activity.item === s.item)!.activity.relativeWeight }))
  overall.set(6, 3, weights.reduce((s, x) => s + x.w, 0), totalStyle(), weights.map((s) => `C${s.row}`).join('+'))
  const floorTotals = floors.map((_, i) => overallValues.get(`${i}|T`) as number)
  floors.forEach((_, i) => overall.set(6, 5 + i, floorTotals[i]!, totalStyle(), weights.map((s) => `$C$${s.row}*${columnName(5 + i)}${s.row}`).join('+')))
  const isCorridor = (key: string) => key.split('|')[1] === 'B'
  const rowOverall = new Map<number, number>()
  for (const item of overallRows) {
    const fill = item.section ? YELLOW : BLUE, text = st({ bold: true, fill, border: true })
    overall.set(item.row, 1, item.item, text); overall.set(item.row, 2, item.name, text)
    const w = weights.find((x) => x.row === item.row)
    overall.set(item.row, 3, w ? w.w : null, st({ bold: true, fill, border: true, format: '0.00%', h: 'center', v: 'center' }))
    const perFloor = floors.map((_, i) => overallValues.get(`${i}|${item.key}`) ?? '' as Num)
    floors.forEach((_, i) => {
      const f = overallFormulas.get(`${i}|${item.key}`), v = perFloor[i]!
      overall.set(item.row, 5 + i, v === '' ? null : v, st({ bold: true, fill, border: true, format: '0.0%', h: 'center', v: 'center' }), v === '' ? undefined : f)
    })
    const numeric = perFloor.map((x) => x === '' ? 0 : x), held = perFloor.filter((x): x is number => x !== '')
    const value = isCorridor(item.key) ? (held.length ? held.reduce((s, x) => s + x, 0) / held.length : 0) : numeric.reduce((s, x, i) => s + x * guestRooms[i]!, 0) / totalRooms
    rowOverall.set(item.row, value)
    overall.set(item.row, 4, value, st({ bold: true, fill, border: true, format: '0.0%', h: 'center', v: 'center', color: RED }),
      isCorridor(item.key) ? `IFERROR(AVERAGE(E${item.row}:${lastLetter}${item.row}),0)` : `SUMPRODUCT(${roomsRow},E${item.row}:${lastLetter}${item.row})/SUM(${roomsRow})`)
  }
  // The project figure weighs the three sections 50 / 5 / 45 %, as the report's overall does.
  const projectOverall = weights.reduce((s, x) => s + x.w * (rowOverall.get(x.row) ?? 0), 0)
  overall.set(6, 4, projectOverall, totalStyle({ color: RED }), weights.map((s) => `$C$${s.row}*D${s.row}`).join('+'))
  return { bytes: writeWorkbook([overall, ...floorSheets, ...handlerSheets], styles), overall: projectOverall }
}
