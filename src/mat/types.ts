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

export const SOURCE_COLS = ['no', 'code', 'description', 'pic', 'bp02', 'location', 'spec', 'brand', 'source'] as const
export const DATE_COLS = [
  'msPlan', 'msActual', 'msApproved',
  'ssPlan', 'ssActual', 'ssApproved',
  'poPlan', 'poActual', 'arrPlan', 'arrActual',
] as const
export const INLINE_TEXT_COLS = ['procRemarks', 'unit'] as const
export const LONG_TEXT_COLS = ['description', 'spec', 'procRemarks'] as const
export const MS_STATUS_OPTIONS = [
  'Not Yet Submit',
  'Under Review',
  'Approved',
  'Approved with comments',
  'Approved Partial',
  'Revise & Resubmit',
  'Rejected',
  'Information only',
] as const

export type EditableColKey = Exclude<ColKey, 'lastUpdated'>
export type ImageSet = 'image' | 'sample'
export type FieldKey = CellKey | EditableColKey | ImageSet
export type FieldValue = number | string | string[] | null
export type MatEdits = Partial<Record<CellKey, number | string>>
  & Partial<Record<EditableColKey, string>>
  & Partial<Record<ImageSet, string[]>>

export interface MatData {
  cols: Partial<Record<ColKey, Scalar>>        // dates as 'YYYY-MM-DD'; text kept as typed
  cells: Partial<Record<CellKey, Source>>
  mark?: 'done' | 'tracking' | 'omit'
  images?: { image?: string[]; sample?: string[] }  // file names under /mat/ or storage:<path>
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
  edits: MatEdits
  updatedAt: string
}
