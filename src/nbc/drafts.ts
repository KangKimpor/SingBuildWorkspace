import type { Handler } from './types'
export interface HandlerDraft { values: Record<string, { text: string; remark: string; baseRevision?: string }>; note: string }
const draftKey = (scope: string, project: string, week: string, handler: Handler) => `kw-nbc-handler-draft:${scope}:${project}:${week}:${handler}`
export function readHandlerDraft(scope: string, project: string, week: string, handler: Handler, resetAt?: string): HandlerDraft | null {
  try {
    const value = JSON.parse(localStorage.getItem(draftKey(scope, project, week, handler)) || 'null')
    if (resetAt && Object.values(value?.values ?? {}).some(v => !(Date.parse((v as { baseRevision?: string })?.baseRevision ?? '') >= Date.parse(resetAt)))) return null
    return value && value.values && typeof value.note === 'string' && Object.values(value.values).every((v) => v && typeof (v as { text?: unknown }).text === 'string' && typeof (v as { remark?: unknown }).remark === 'string') ? value : null
  } catch { return null }
}
export function writeHandlerDraft(scope: string, project: string, week: string, handler: Handler, value: HandlerDraft) {
  try {
    localStorage.setItem(draftKey(scope, project, week, handler), JSON.stringify(value))
  } catch (error) {
    try {
      // If quota exceeded, prune stale cache and old drafts to make room for active editing
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('kw-cloud-cache:') || (key.startsWith('kw-nbc-handler-draft:') && key !== draftKey(scope, project, week, handler))) {
          try { localStorage.removeItem(key) } catch { /* ignore */ }
        }
      }
      localStorage.setItem(draftKey(scope, project, week, handler), JSON.stringify(value))
    } catch {
      throw error
    }
  }
}
export function clearHandlerDraft(scope: string, project: string, week: string, handler: Handler) {
  try { localStorage.removeItem(draftKey(scope, project, week, handler)) } catch { /* ignore */ }
}
