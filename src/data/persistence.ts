import Dexie from 'dexie'
import type { Table } from 'dexie'
import type { NbcActivity, NbcSubmission, NbcWeekSummary } from '@/nbc/types'
import type {
  ProjectSummary,
  Task,
  WorkspacePage,
  TaskView,
} from './types'

export interface Content {
  nbc_activities?: NbcActivity[]
  nbc_submissions?: NbcSubmission[]
  nbc_summaries?: NbcWeekSummary[]
  pages: WorkspacePage[]
  projects: ProjectSummary[]
  tasks: Task[]
  scratchpad: string
  taskViews: TaskView[]
}
export type Collection = 'pages' | 'projects' | 'tasks' | 'nbc_activities' | 'nbc_submissions' | 'nbc_summaries'
export const collections: Collection[] = [
  'pages',
  'projects',
  'tasks',
  'nbc_activities',
  'nbc_submissions',
  'nbc_summaries',
]
/** Include legacy task notes that predate paired soft deletion. */
export function purgedRows(collection: 'pages' | 'tasks', previous: Content, content: Content) {
  const remaining = new Set(content[collection].map((row) => row.id)), tasks = new Set(content.tasks.map((task) => task.id))
  const notes = new Set(previous.tasks.filter((task) => task.deletedAt && !tasks.has(task.id)).map((task) => task.pageId))
  return previous[collection].filter((row) => !remaining.has(row.id) && (row.deletedAt || collection === 'pages' && notes.has(row.id)))
}
export interface Pending {
  remove?: boolean
  key: string
  scope: string
  collection: Collection | 'profiles'
  id: string
  data: Record<string, unknown>
  version: string
  base: string | null
}
/** Per-account sync state kept beside the per-row snapshot (D-37). */
export interface SnapshotMeta {
  scope: string
  scratchpad: string
  taskViews: TaskView[]
  watermarks?: Record<string, string>
  lastFullPull?: string
}
/** One workspace row of a signed-in account's local snapshot, keyed by [scope+collection+id]. */
export interface SnapshotRow { scope: string; collection: Collection; id: string; row: unknown }
class WorkspaceDB extends Dexie {
  /** Whole-workspace records: the guest workspace, and accounts not yet moved to `rows`/`meta`. */
  snapshots!: Table<{ scope: string; content: Content; watermarks?: Record<string, string>; lastFullPull?: string }, string>
  rows!: Table<SnapshotRow, [string, string, string]>
  meta!: Table<SnapshotMeta, string>
  outbox!: Table<Pending, string>
  versions!: Table<{ key: string; value: string }, string>
  files!: Table<{ id: string; blob: Blob; name: string }, string>
  reportTemplates!: Table<{ id: string; data: ArrayBuffer; name: string }, string>
  constructor() {
    super('kimpor-workspace')
    this.version(1).stores({
      snapshots: 'scope',
      outbox: 'key,scope',
      versions: 'key',
      files: 'id',
    })
    this.version(2).stores({ reportTemplates: 'id' })
    // A signed-in workspace was one record holding every row (about 26 MB for BP02), rewritten after
    // every change. Rows are now stored individually and only changed rows are written.
    this.version(3).stores({ rows: '[scope+collection+id], scope', meta: 'scope' })
  }
}
export const db = new WorkspaceDB()
let writeQueue: Promise<unknown> = Promise.resolve()
export function persist(scope: string, content: Content, previous: Content) {
  writeQueue = writeQueue
    .catch(() => undefined)
    .then(() =>
      db.transaction('rw', db.snapshots, db.outbox, db.versions, async () => {
        await db.snapshots.put({ scope, content: structuredClone(content) })
        if (scope === 'guest') return
        if (
          content.scratchpad !== previous.scratchpad ||
          content.taskViews !== previous.taskViews
        ) {
          const key = `${scope}:profiles:${scope}`
          await db.outbox.put({
            key,
            scope,
            collection: 'profiles',
            id: scope,
            data: {
              id: scope,
              scratchpad: content.scratchpad,
              taskViews: content.taskViews,
            },
            version: crypto.randomUUID(),
            base: (await db.versions.get(key))?.value ?? null,
          })
        }
        for (const collection of collections) {
          const old = new Map<string, unknown>(
            (previous[collection] ?? []).map((row) => [row.id, row]),
          )
          for (const row of content[collection] ?? []) {
            const before = old.get(row.id)
            if (before === row || (before !== undefined && JSON.stringify(before) === JSON.stringify(row))) continue
            const key = `${scope}:${collection}:${row.id}`
            const base = (await db.versions.get(key))?.value ?? null
            await db.outbox.put({
              key,
              scope,
              collection,
              id: row.id,
              data: row as unknown as Record<string, unknown>,
              version: crypto.randomUUID(),
              base,
            })
          }
          if (collection === 'pages' || collection === 'tasks') {
            for (const row of purgedRows(collection, previous, content)) {
              const key = `${scope}:${collection}:${row.id}`
              await db.outbox.put({ key, scope, collection, id: row.id, data: { id: row.id }, version: crypto.randomUUID(), base: (await db.versions.get(key))?.value ?? null, remove: true })
            }
          }
        }

      }),
    )
  return writeQueue
}
export async function flushLocal() {
  await writeQueue
}
