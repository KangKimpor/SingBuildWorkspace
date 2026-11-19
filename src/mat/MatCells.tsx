import { useEffect, useRef, useState } from 'react'
import type { FocusEvent, KeyboardEvent } from 'react'
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

export interface CellFailure {
  draft: string
  message: string
  retry: () => void
}

export interface ActiveCellCallbacks {
  onClose: () => void
  onFail: (failure: CellFailure) => void
  onClearFail: () => void
  initialDraft?: string
  onTab?: (shift: boolean) => void
}

export const REMARK_LIMIT = MAX_LONG_TEXT

const reason = (e: unknown) => (e instanceof Error && e.message ? e.message : 'Could not save.')

function fireSave(
  draftText: string,
  run: () => Promise<void>,
  onFail: (failure: CellFailure) => void,
  onClearFail: () => void,
) {
  const attempt = () => {
    onClearFail()
    void run().catch((e) => {
      onFail({ draft: draftText, message: reason(e), retry: attempt })
    })
  }
  attempt()
}

export interface NumberCellProps extends ActiveCellCallbacks {
  id: string
  cell: CellKey
  label: string
  value: Scalar
  override: boolean
  calculated: boolean
  note?: string
  onCell: OnCell
}

/** Active quantity or percentage editor: mounts on click, commits on Enter/Tab/blur, Escape cancels. */
export function NumberCell({
  id,
  cell,
  label,
  value,
  override,
  calculated,
  note,
  onCell,
  onClose,
  onFail,
  onClearFail,
  initialDraft,
  onTab,
}: NumberCellProps) {
  const shown = formatCell(cell, value)
  const [text, setText] = useState(initialDraft ?? shown)
  const [invalid, setInvalid] = useState<string | null>(null)
  const committed = useRef(false)

  function commit(closeOnSuccess: boolean): boolean {
    if (committed.current) return true
    let next: number | string | null
    try {
      next = parseInput(cell, text)
    } catch (e) {
      setInvalid(reason(e))
      return false
    }
    if (text === shown || (next === null && !override)) {
      committed.current = true
      if (initialDraft !== undefined) onClearFail()
      if (closeOnSuccess) onClose()
      return true
    }
    committed.current = true
    if (closeOnSuccess) onClose()
    fireSave(text, () => onCell(id, cell, next), onFail, onClearFail)
    return true
  }

  function cancel() {
    committed.current = true
    onClose()
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit(true)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancel()
    } else if (e.key === 'Tab' && onTab) {
      e.preventDefault()
      if (commit(false)) onTab(e.shiftKey)
    }
  }

  function onBlur(e: FocusEvent<HTMLDivElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    commit(true)
  }

  const source = override ? 'override' : calculated ? 'formula' : 'value'
  return <div className="mat-active-cell mat-num" data-source={source} onBlur={onBlur}>
    <input aria-label={label} value={text} title={invalid ?? note} aria-invalid={invalid ? true : undefined}
      autoFocus autoComplete="off" spellCheck={false}
      onChange={(e) => { setText(e.target.value); setInvalid(null) }} onKeyDown={onKeyDown}/>
    {override && <span className="mat-dot" aria-hidden="true"/>}
    {override && text === shown && !invalid &&
      <button type="button" className="mat-formula" aria-label={`Use formula for ${label}`} title="Use formula"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          committed.current = true
          onClose()
          fireSave('', () => onCell(id, cell, null), onFail, onClearFail)
        }}>
        <RotateCcw size={11} strokeWidth={2.2} aria-hidden="true"/>
      </button>}
  </div>
}

export interface DateTextCellProps extends ActiveCellCallbacks {
  id: string
  col: EditableColKey
  label: string
  raw: Scalar
  sourceRaw: Scalar
  onCell: OnCell
}

/** Active date/text editor ("7 Oct 2025", "TBC", "-/-"): free typing plus native calendar picker. */
export function DateTextCell({
  id,
  col,
  label,
  raw,
  sourceRaw,
  onCell,
  onClose,
  onFail,
  onClearFail,
  initialDraft,
  onTab,
}: DateTextCellProps) {
  const shown = formatCol(raw)
  const [text, setText] = useState(initialDraft ?? shown)
  const [invalid, setInvalid] = useState<string | null>(null)
  const committed = useRef(false)
  const currentRaw = raw === null || raw === undefined ? '' : String(raw)

  function commit(closeOnSuccess: boolean): boolean {
    if (committed.current) return true
    let next: string
    try {
      next = parseDateTextInput(text)
    } catch (e) {
      setInvalid(reason(e))
      return false
    }
    if (next === currentRaw) {
      committed.current = true
      if (initialDraft !== undefined) onClearFail()
      if (closeOnSuccess) onClose()
      return true
    }
    const patch = patchForSource(sourceRaw, next)
    committed.current = true
    if (closeOnSuccess) onClose()
    fireSave(text, () => onCell(id, col, patch), onFail, onClearFail)
    return true
  }

  function cancel() {
    committed.current = true
    onClose()
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit(true)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancel()
    } else if (e.key === 'Tab' && onTab) {
      e.preventDefault()
      if (commit(false)) onTab(e.shiftKey)
    }
  }

  function onBlur(e: FocusEvent<HTMLDivElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    commit(true)
  }

  return <div className="mat-active-cell mat-date" onBlur={onBlur}>
    <input aria-label={label} value={text} title={invalid ?? (text || undefined)}
      aria-invalid={invalid ? true : undefined} autoFocus autoComplete="off" spellCheck={false}
      onChange={(e) => { setText(e.target.value); setInvalid(null) }} onKeyDown={onKeyDown}/>
    <label className="mat-date-pick" title="Choose date">
      <Calendar size={12} aria-hidden="true"/>
      <input type="date" tabIndex={-1} aria-label={`Pick date for ${label}`}
        value={isIsoDate(raw) ? raw : ''}
        onChange={(e) => {
          const picked = e.target.value
          if (picked === currentRaw) {
            cancel()
            return
          }
          const display = formatCol(picked || null)
          const patch = patchForSource(sourceRaw, picked)
          committed.current = true
          onClose()
          fireSave(display, () => onCell(id, col, patch), onFail, onClearFail)
        }}/>
    </label>
  </div>
}

export interface StatusCellProps extends ActiveCellCallbacks {
  id: string
  label: string
  raw: Scalar
  sourceRaw: Scalar
  onCell: OnCell
}

/** Active Material Submission status selector: standard statuses plus any existing custom value. */
export function StatusCell({
  id,
  label,
  raw,
  sourceRaw,
  onCell,
  onClose,
  onFail,
  onClearFail,
  initialDraft,
}: StatusCellProps) {
  const current = raw === null || raw === undefined ? '' : String(raw)
  const custom = current !== '' && !(MS_STATUS_OPTIONS as readonly string[]).includes(current)
  const selectRef = useRef<HTMLSelectElement>(null)
  const committed = useRef(false)

  useEffect(() => {
    try {
      selectRef.current?.showPicker?.()
    } catch {
      // showPicker is unsupported in some browsers/JSDOM or requires direct gesture.
    }
  }, [])

  function save(next: string) {
    committed.current = true
    if (next === current) {
      if (initialDraft !== undefined) onClearFail()
      onClose()
      return
    }
    const patch = patchForSource(sourceRaw, next)
    onClose()
    fireSave(next, () => onCell(id, 'msStatus', patch), onFail, onClearFail)
  }

  return <div className="mat-active-cell mat-select-wrap" onBlur={(e) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    if (!committed.current) onClose()
  }}>
    <select ref={selectRef} autoFocus className="mat-select" aria-label={label}
      value={initialDraft ?? current}
      title={current ? formatCol(current) : undefined}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); committed.current = true; onClose() } }}
      onChange={(e) => save(e.target.value)}>
      <option value="" aria-label="Clear status"/>
      {custom && <option value={current}>{formatCol(current).replace(/\s+/g, ' ').trim()}</option>}
      {MS_STATUS_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
    </select>
  </div>
}

export interface TextCellProps extends ActiveCellCallbacks {
  id: string
  col: EditableColKey
  label: string
  raw: Scalar
  sourceRaw: Scalar
  long?: boolean
  maxLength?: number
  onCell: OnCell
}

/** Active inline text editor (`Unit` or `Procurement Remarks`). */
export function TextCell({
  id,
  col,
  label,
  raw,
  sourceRaw,
  long,
  maxLength,
  onCell,
  onClose,
  onFail,
  onClearFail,
  initialDraft,
  onTab,
}: TextCellProps) {
  const shown = formatCol(raw)
  const limit = maxLength ?? (long ? MAX_LONG_TEXT : MAX_SHORT_TEXT)
  const [text, setText] = useState(initialDraft ?? shown)
  const [invalid, setInvalid] = useState<string | null>(null)
  const committed = useRef(false)
  const currentRaw = raw === null || raw === undefined ? '' : String(raw)

  function commit(closeOnSuccess: boolean): boolean {
    if (committed.current) return true
    let next: string
    try {
      next = parseTextInput(text, limit)
    } catch (e) {
      setInvalid(reason(e))
      return false
    }
    if (next === currentRaw) {
      committed.current = true
      if (initialDraft !== undefined) onClearFail()
      if (closeOnSuccess) onClose()
      return true
    }
    const patch = patchForSource(sourceRaw, next)
    committed.current = true
    if (closeOnSuccess) onClose()
    fireSave(text, () => onCell(id, col, patch), onFail, onClearFail)
    return true
  }

  function cancel() {
    committed.current = true
    onClose()
  }

  function onBlur(e: FocusEvent<HTMLDivElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    commit(true)
  }

  if (long) {
    function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        commit(true)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        cancel()
      }
    }
    return <div className="mat-active-cell mat-remark" onBlur={onBlur}>
      <textarea autoFocus aria-label={label} value={text} maxLength={limit} title={invalid ?? (text || undefined)}
        aria-invalid={invalid ? true : undefined}
        onChange={(e) => { setText(e.target.value); setInvalid(null) }} onKeyDown={onKeyDown}/>
    </div>
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit(true)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancel()
    } else if (e.key === 'Tab' && onTab) {
      e.preventDefault()
      if (commit(false)) onTab(e.shiftKey)
    }
  }
  return <div className="mat-active-cell mat-text" onBlur={onBlur}>
    <input autoFocus aria-label={label} value={text} maxLength={limit} title={invalid ?? (text || undefined)}
      aria-invalid={invalid ? true : undefined} autoComplete="off" spellCheck={false}
      onChange={(e) => { setText(e.target.value); setInvalid(null) }} onKeyDown={onKeyDown}/>
  </div>
}

export interface RemarkCellProps extends ActiveCellCallbacks {
  id: string
  team: Team
  label: string
  body: string
  onRemark: OnRemark
}

/** Active "This week" remark editor: mounts on click, commits on blur or Ctrl+Enter, Escape cancels. */
export function RemarkCell({
  id,
  team,
  label,
  body,
  onRemark,
  onClose,
  onFail,
  onClearFail,
  initialDraft,
}: RemarkCellProps) {
  const [text, setText] = useState(initialDraft ?? body)
  const committed = useRef(false)

  function commit() {
    if (committed.current) return
    committed.current = true
    if (text === body) {
      if (initialDraft !== undefined) onClearFail()
      onClose()
      return
    }
    onClose()
    fireSave(text, () => onRemark(id, team, text), onFail, onClearFail)
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      commit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      committed.current = true
      onClose()
    }
  }

  return <div className="mat-active-cell mat-remark" onBlur={(e) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    commit()
  }}>
    <textarea autoFocus aria-label={label} value={text} maxLength={REMARK_LIMIT} title={text || undefined}
      onChange={(e) => setText(e.target.value)} onKeyDown={onKeyDown}/>
  </div>
}
