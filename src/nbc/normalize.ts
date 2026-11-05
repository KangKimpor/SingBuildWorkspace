import type { NbcActivity } from './types'

/**
 * Area-layout projects (BP03/BP04) are stored without the fields that repeat on every row, to keep what Supabase sends small.
 * A stored row restores them here: labels default to empty, `baseline` and `sourcePrevious` to the stored `progress`.
 * Rows that already carry a field keep it, so other projects are unaffected.
 */
export function normalizeActivity<T extends Record<string, unknown>>(data: T): T {
  if (typeof data.progress !== 'number' || typeof data.editable !== 'boolean') return data
  const out: Record<string, unknown> = { ...data }
  out.description ??= ''; out.area ??= ''; out.location ??= ''; out.trade ??= ''; out.handler ??= ''; out.remark ??= ''
  out.history ??= []; out.sourceWeekly ??= 0; out.duration ??= null; out.boqValue ??= null; out.schedule ??= null
  out.baseline ??= data.progress; out.sourcePrevious ??= data.progress
  return out as T
}
export type StoredActivity = Partial<NbcActivity> & Pick<NbcActivity, 'id' | 'wbs' | 'parentId' | 'order' | 'name' | 'editable' | 'relativeWeight' | 'globalWeight' | 'progress'>
