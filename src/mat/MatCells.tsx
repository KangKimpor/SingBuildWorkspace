import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { RotateCcw } from 'lucide-react'
import { formatCell, parseInput } from './formulas'
import type { CellKey, Scalar, Team } from './types'

export type OnCell = (id: string, cell: CellKey, value: number | string | null) => Promise<void>
export type OnRemark = (id: string, team: Team, body: string) => Promise<void>

export const REMARK_LIMIT = 2000

interface Failure { message: string; retry?: () => void }
const reason = (e: unknown) => (e instanceof Error && e.message ? e.message : 'Could not save.')

/**
 * The typed text of one cell while it is being edited or after its save failed. The store has put
 * the stored value back by the time a save rejects, so the text the person typed lives only here.
 */
interface Draft {
  /** Sends `run` and keeps `text` on screen until it succeeds; on failure offers Retry. */
  save: (text: string, run: () => Promise<void>) => Promise<void>
  /** Marks the cell invalid without a retry (the text itself is wrong). */
  reject: (message: string) => void
  cancel: () => void
}

function useDraft(stored: string, send: (text: string, draft: Draft) => void) {
  const [draft, setDraft] = useState<string | null>(null)
  const [failure, setFailure] = useState<Failure | null>(null)
  // The text of the save in flight: Enter followed by blur must not send it twice.
  const inflight = useRef<string | null>(null)

  async function save(text: string, run: () => Promise<void>) {
    inflight.current = text
    try {
      await run()
      setDraft((d) => (d === text ? null : d))
      setFailure(null)
    } catch (e) {
      setFailure({ message: reason(e), retry: () => void save(text, run) })
    } finally {
      if (inflight.current === text) inflight.current = null
    }
  }
  function commit() {
    if (draft === null || draft === inflight.current) return
    if (draft === stored && !failure) return setDraft(null)
    send(draft, { save, reject: (message) => setFailure({ message }), cancel })
  }
  function cancel() {
    setDraft(null)
    setFailure(null)
  }
  return { draft, setDraft, failure, save, commit, cancel }
}

function Retry({ label, failure }: { label: string; failure: Failure | null }) {
  if (!failure?.retry) return null
  return <button type="button" className="mat-retry" aria-label={`Retry ${label}`} title={failure.message} onClick={failure.retry}>Retry</button>
}

export interface NumberCellProps {
  id: string
  cell: CellKey
  label: string
  value: Scalar
  override: boolean
  calculated: boolean
  note?: string
  onCell: OnCell
}

/** A quantity or percentage: commits on Enter or blur through parseInput; Escape cancels. */
export function NumberCell({ id, cell, label, value, override, calculated, note, onCell }: NumberCellProps) {
  const shown = formatCell(cell, value)
  const edit = useDraft(shown, (text, { save, reject, cancel }) => {
    let next: number | string | null
    try {
      next = parseInput(cell, text)
    } catch (e) {
      return reject(reason(e))
    }
    // An empty field on a cell without an override has nothing to clear.
    if (next === null && !override) return cancel()
    void save(text, () => onCell(id, cell, next))
  })
  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      edit.commit()
    } else if (e.key === 'Escape') edit.cancel()
  }
  const source = override ? 'override' : calculated ? 'formula' : 'value'
  return <div className="mat-num" data-source={source}>
    <input aria-label={label} value={edit.draft ?? shown} title={edit.failure?.message ?? note} aria-invalid={edit.failure ? true : undefined}
      autoComplete="off" spellCheck={false}
      onChange={(e) => edit.setDraft(e.target.value)} onBlur={edit.commit} onKeyDown={onKeyDown}/>
    {override && <span className="mat-dot" aria-hidden="true"/>}
    {override && edit.draft === null && !edit.failure &&
      <button type="button" className="mat-formula" aria-label={`Use formula for ${label}`} title="Use formula" onClick={() => void edit.save('', () => onCell(id, cell, null))}>
        <RotateCcw size={11} strokeWidth={2.2} aria-hidden="true"/>
      </button>}
    <Retry label={label} failure={edit.failure}/>
  </div>
}

export interface RemarkCellProps { id: string; team: Team; label: string; body: string; onRemark: OnRemark }

/** This week's remark: commits on blur or Ctrl+Enter; Escape cancels. */
export function RemarkCell({ id, team, label, body, onRemark }: RemarkCellProps) {
  const edit = useDraft(body, (text, { save }) => void save(text, () => onRemark(id, team, text)))
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      edit.commit()
    } else if (e.key === 'Escape') edit.cancel()
  }
  const text = edit.draft ?? body
  return <div className="mat-remark">
    <textarea aria-label={label} value={text} maxLength={REMARK_LIMIT} title={edit.failure?.message ?? (text || undefined)}
      aria-invalid={edit.failure ? true : undefined}
      onChange={(e) => edit.setDraft(e.target.value)} onBlur={edit.commit} onKeyDown={onKeyDown}/>
    <Retry label={label} failure={edit.failure}/>
  </div>
}
