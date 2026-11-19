import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Calendar, RotateCcw } from 'lucide-react'
import {
  formatCell,
  formatCol,
  isIsoDate,
  MAX_LONG_TEXT,
  MAX_SHORT_TEXT,
  parseDateTextInput,
  parseInput,
  parseTextInput,
  patchForSource,
} from './formulas'
import { MS_STATUS_OPTIONS } from './types'
import type { CellKey, EditableColKey, FieldKey, FieldValue, Scalar, Team } from './types'

export type OnCell = (id: string, cell: FieldKey, value: FieldValue) => Promise<void>
export type OnFields = (id: string, patch: Partial<Record<FieldKey, FieldValue>>) => Promise<void>
export type OnRemark = (id: string, team: Team, body: string) => Promise<void>

export const REMARK_LIMIT = MAX_LONG_TEXT

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

export interface DateTextCellProps {
  id: string
  col: EditableColKey
  label: string
  raw: Scalar
  sourceRaw: Scalar
  onCell: OnCell
}

/** A date or text cell ("7 Oct 2025", "TBC", "-/-"): supports free typing and a calendar picker. */
export function DateTextCell({ id, col, label, raw, sourceRaw, onCell }: DateTextCellProps) {
  const shown = formatCol(raw)
  const edit = useDraft(shown, (text, { save, reject, cancel }) => {
    let next: string
    try {
      next = parseDateTextInput(text)
    } catch (e) {
      return reject(reason(e))
    }
    const currentRaw = raw === null || raw === undefined ? '' : String(raw)
    if (next === currentRaw) return cancel()
    const patch = patchForSource(sourceRaw, next)
    void save(text, () => onCell(id, col, patch))
  })
  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      edit.commit()
    } else if (e.key === 'Escape') edit.cancel()
  }
  const text = edit.draft ?? shown
  return <div className="mat-date">
    <input aria-label={label} value={text} title={edit.failure?.message ?? (text || undefined)}
      aria-invalid={edit.failure ? true : undefined} autoComplete="off" spellCheck={false}
      onChange={(e) => edit.setDraft(e.target.value)} onBlur={edit.commit} onKeyDown={onKeyDown}/>
    <label className="mat-date-pick" title="Choose date">
      <Calendar size={12} aria-hidden="true"/>
      <input type="date" tabIndex={-1} aria-label={`Pick date for ${label}`}
        value={isIsoDate(raw) ? raw : ''}
        onChange={(e) => {
          const picked = e.target.value
          const currentRaw = raw === null || raw === undefined ? '' : String(raw)
          if (picked === currentRaw) return
          const display = formatCol(picked || null)
          const patch = patchForSource(sourceRaw, picked)
          edit.setDraft(display)
          void edit.save(display, () => onCell(id, col, patch))
        }}/>
    </label>
    <Retry label={label} failure={edit.failure}/>
  </div>
}

export interface StatusCellProps {
  id: string
  label: string
  raw: Scalar
  sourceRaw: Scalar
  onCell: OnCell
}

/** Material Submission status selector: standard statuses plus any existing workbook custom value. */
export function StatusCell({ id, label, raw, sourceRaw, onCell }: StatusCellProps) {
  const current = raw === null || raw === undefined ? '' : String(raw)
  const [pending, setPending] = useState<string | null>(null)
  const [failure, setFailure] = useState<Failure | null>(null)
  const shown = pending ?? current
  const custom = current !== '' && !(MS_STATUS_OPTIONS as readonly string[]).includes(current)

  async function save(next: string) {
    if (next === current && !failure) return
    const patch = patchForSource(sourceRaw, next)
    setPending(next)
    try {
      await onCell(id, 'msStatus', patch)
      setPending((p) => (p === next ? null : p))
      setFailure(null)
    } catch (e) {
      setFailure({ message: reason(e), retry: () => void save(next) })
    }
  }

  return <div className="mat-select-wrap">
    <select className="mat-select" aria-label={label} value={shown}
      title={failure?.message ?? (shown ? formatCol(shown) : undefined)}
      aria-invalid={failure ? true : undefined}
      onChange={(e) => void save(e.target.value)}>
      <option value="" aria-label="Clear status"/>
      {custom && <option value={current}>{formatCol(current).replace(/\s+/g, ' ').trim()}</option>}
      {MS_STATUS_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
    </select>
    <Retry label={label} failure={failure}/>
  </div>
}

export interface TextCellProps {
  id: string
  col: EditableColKey
  label: string
  raw: Scalar
  sourceRaw: Scalar
  long?: boolean
  maxLength?: number
  onCell: OnCell
}

/** Inline editable text cell (`Unit` or `Procurement Remarks`). */
export function TextCell({ id, col, label, raw, sourceRaw, long, maxLength, onCell }: TextCellProps) {
  const shown = formatCol(raw)
  const limit = maxLength ?? (long ? MAX_LONG_TEXT : MAX_SHORT_TEXT)
  const edit = useDraft(shown, (text, { save, reject, cancel }) => {
    let next: string
    try {
      next = parseTextInput(text, limit)
    } catch (e) {
      return reject(reason(e))
    }
    const currentRaw = raw === null || raw === undefined ? '' : String(raw)
    if (next === currentRaw) return cancel()
    const patch = patchForSource(sourceRaw, next)
    void save(text, () => onCell(id, col, patch))
  })
  const text = edit.draft ?? shown
  if (long) {
    function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        edit.commit()
      } else if (e.key === 'Escape') edit.cancel()
    }
    return <div className="mat-remark">
      <textarea aria-label={label} value={text} maxLength={limit} title={edit.failure?.message ?? (text || undefined)}
        aria-invalid={edit.failure ? true : undefined}
        onChange={(e) => edit.setDraft(e.target.value)} onBlur={edit.commit} onKeyDown={onKeyDown}/>
      <Retry label={label} failure={edit.failure}/>
    </div>
  }
  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      edit.commit()
    } else if (e.key === 'Escape') edit.cancel()
  }
  return <div className="mat-text">
    <input aria-label={label} value={text} maxLength={limit} title={edit.failure?.message ?? (text || undefined)}
      aria-invalid={edit.failure ? true : undefined} autoComplete="off" spellCheck={false}
      onChange={(e) => edit.setDraft(e.target.value)} onBlur={edit.commit} onKeyDown={onKeyDown}/>
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
