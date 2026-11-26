import type { CellKey, ColKey } from './types'

/**
 * The material sheets' columns, found by their header text in rows 6 and 7 rather than by letter, with the same patterns
 * as `scripts/mat-import.py` (TOP and GROUPS there), so the export writes to the columns the import read from.
 */
export type Role = ColKey | CellKey | 'image' | 'sample' | 'pmRemarks'

const GROUP_ROW = 6, SUB_ROW = 7
const TOP: [RegExp, Role | null][] = [
  [/^no$/, 'no'], [/^person in charge$/, 'pic'], [/^bp02 mat approval$/, 'bp02'], [/^material code$/, 'code'],
  [/^description$/, 'description'], [/^location$/, 'location'], [/^image$/, 'image'], [/^approved sample$/, 'sample'],
  [/^specification$/, 'spec'], [/^brand$/, 'brand'], [/^source location$/, 'source'], [/^last updated$/, 'lastUpdated'],
  [/^pm team remarks$/, 'pmRemarks'], [/^updated on .*$/, null], [/^clarification .*$/, null],
]
const GROUPS: [RegExp, [RegExp, Role][]][] = [
  [/^material submi?ss?ion.*$/, [[/^plan submit date$/, 'msPlan'], [/^actual submit date$/, 'msActual'], [/^approved date$/, 'msApproved'], [/^status$/, 'msStatus']]],
  [/^sample submi?ss?ion$/, [[/^plan submit date$/, 'ssPlan'], [/^actual submit date$/, 'ssActual'], [/^approved date$/, 'ssApproved']]],
  [/^procu?re?ment$/, [[/^plan place order$/, 'poPlan'], [/^actual place order( date)?$/, 'poActual'], [/^plan arrived site$/, 'arrPlan'],
    [/^act(ua|au)l arrived site$/, 'arrActual'], [/^remarks$/, 'procRemarks']]],
  [/^total quantity$/, [[/^unit$/, 'unit'], [/^total quantity ?\(by qs\)$/, 'total'], [/^po quantity ?\(by purchase\)$/, 'po'],
    [/^approved shd quantity$/, 'shd'], [/^on site quantity$/, 'onsite'], [/^remaining quantity$/, 'remaining']]],
  [/^percentage \(%\)$/, [[/^not yet po$/, 'notYetPo'], [/^placed order$/, 'placed'], [/^production in progress?$/, 'production'],
    [/^waiting for shipment$/, 'waiting'], [/^shipping on the way$/, 'shipping'], [/^arrived? (wh|wharehourse|warehouse) ?(&|and) site$/, 'arrived']]],
]
const norm = (text: string) => text.replace(/\s+/g, ' ').trim().toLowerCase()
const letter = (n: number) => { let s = ''; for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s }

/**
 * {role: column letter}. A row-7 header belongs to the row-6 group merged above it; a group header left blank (BP04 MEP
 * "Total Quantity") is accepted when the row-7 text names one role only. Headers this tracker does not keep are skipped.
 */
export function findColumns(
  text: (column: number, row: number) => string, maxColumn: number,
  merges: { c1: number; r1: number; c2: number; r2: number }[], sheet: string,
): Map<Role, string> {
  const groupOf = (c: number): [string, boolean] => {
    const m = merges.find((x) => x.r1 <= GROUP_ROW && GROUP_ROW <= x.r2 && x.c2 > x.c1 && x.c1 <= c && c <= x.c2)
    return m ? [text(m.c1, m.r1), c === m.c1] : [text(c, GROUP_ROW), true]
  }
  const out = new Map<Role, string>()
  for (let c = 1; c <= maxColumn; c++) {
    const [groupText, first] = groupOf(c)
    const top = norm(groupText), sub = norm(text(c, SUB_ROW))
    let role: Role | null | undefined
    if (sub) {
      let subs = GROUPS.find(([g]) => g.test(top))?.[1]
      if (!subs && !top) {
        const all = GROUPS.flatMap(([, s]) => s).filter(([p]) => p.test(sub))
        subs = all.length === 1 ? all : undefined
      }
      role = subs?.find(([p]) => p.test(sub))?.[1]
    } else if (top && first) {
      role = TOP.find(([p]) => p.test(top))?.[1]
    }
    if (role && !out.has(role)) out.set(role, letter(c))
  }
  for (const need of ['code', 'description'] as const) if (!out.has(need)) throw new Error(`The "${sheet}" sheet has no "${need === 'code' ? 'Material Code' : 'Description'}" column in rows 6 and 7. Choose the material list workbook.`)
  return out
}
