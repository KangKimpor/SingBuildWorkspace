export const handlers = ['Sitha', 'Lychhinh', 'Chhorvaon', 'Srun', 'Kheng', 'Vuth', 'Tola'] as const
export type Handler = typeof handlers[number]
/** BP02 still uses the original seven-sheet workbook, so it keeps its six handler tabs. */
export const bp02Handlers = ['Sitha', 'Lychhinh', 'Chhorvaon', 'Srun', 'Kheng', 'Tola'] as const satisfies readonly Handler[]
export const projectHandlers = (projectId: string | undefined): readonly Handler[] => projectId === 'nbc-bp02' ? bp02Handlers : handlers
export interface SubmissionEntry {
  activityId: string
  previous: number
  progress: number
  remark: string
  previousRemark?: string
  baseRevision?: string
}
export interface NbcSubmission {
  id: string
  projectId: string
  weekStart: string
  handler: Handler
  status: 'draft' | 'confirmed'
  confirmedAt: string | null
  confirmedBy: string | null
  late: boolean
  note: string
  entries: SubmissionEntry[]
  /** The last applied version stays live while a confirmed update is edited. */
  appliedEntries?: SubmissionEntry[]
  undoUntil?: string | null
  updatedAt: string
}
export interface NbcWeekSummary {
  id: string
  projectId: string
  weekStart: string
  overall: number
  previous: number
  contributions: Record<string, number>
  updatedAt: string
}
export interface ProgressChange {
  id: string
  at: string
  editor: string
  previous: number
  progress: number
  remark: string
  handler: string
  recordedAt?: string
}
export interface NbcActivity {
  baselineResetAt?: string
  id: string
  projectId: string
  wbs: string
  parentId: string | null
  order: number
  name: string
  description: string
  area: string
  location: string
  trade: string
  editable: boolean
  relativeWeight: number
  globalWeight: number
  progress: number
  baseline: number
  sourcePrevious: number
  sourceWeekly: number
  duration: number | null
  boqValue: number | null
  schedule: number | null
  handler: string
  remark: string
  updatedAt?: string
  history: ProgressChange[]
  sourceRow?: number
  sourceFormulas?: Record<string, string>
  /** BP02 room layout: a leaf with `room` is one cell of the floor matrix (task × room). */
  room?: string
  /** The workbook's Item label ("A", "III", "1.2") for matrix and export rows. */
  item?: string
  /** Floor roots list their room columns in workbook order (the last one is usually the corridor, CRD). */
  roomList?: string[]
  /** Group scored as the plain average of the tasks a room has, instead of a weighted sum. */
  average?: boolean
}
