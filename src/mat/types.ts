export type Pkg = 'bp03' | 'bp04'
export type Sheet = 'id' | 'mep' | 'review' | 'changelog'
export type Team = 'pm' | 'purchase'
export const QTY_CELLS = ['total', 'po', 'shd', 'onsite', 'remaining'] as const
export const PCT_CELLS = ['notYetPo', 'placed', 'production', 'waiting', 'shipping', 'arrived'] as const
export type CellKey = (typeof QTY_CELLS)[number] | (typeof PCT_CELLS)[number]
export type FormulaKey =
  | 'notYetPo' | 'placedPoOverTotal' | 'shdOverPo' | 'waiting' | 'arrived'
  | 'totalMinusOnsite' | 'shdMinusOnsite' | 'totalMinusShd'
export type Scalar = number | string | null
export type Source = { f: FormulaKey } | { v: Scalar }
export type ColKey = 'no' | 'pic' | 'bp02' | 'code' | 'description' | 'location' | 'spec' | 'brand' | 'source'
  | 'msPlan' | 'msActual' | 'msApproved' | 'msStatus' | 'ssPlan' | 'ssActual' | 'ssApproved'
  | 'poPlan' | 'poActual' | 'arrPlan' | 'arrActual' | 'procRemarks' | 'unit' | 'lastUpdated'
export interface MatData {
  cols: Partial<Record<ColKey, Scalar>>        // dates as 'YYYY-MM-DD'; text kept as typed
  cells: Partial<Record<CellKey, Source>>
  mark?: 'done' | 'tracking' | 'omit'
  images?: { image?: string[]; sample?: string[] }  // file names under /mat/
  notes?: Partial<Record<CellKey | ColKey, string>> // e.g. the '=296+8' expression
  note?: string[]                              // kind 'note' rows: the row's cells, left to right
  end?: number                                 // section rows: pos of the last row the section covers
  level?: number                               // section rows: 0 for a top-level section, +1 per enclosing section
}
export interface MatItem {
  id: string
  package: Pkg
  sheet: Sheet
  pos: number
  kind: 'section' | 'item' | 'note'
  data: MatData
  edits: Partial<Record<CellKey, number | string>>
  updatedAt: string
}
