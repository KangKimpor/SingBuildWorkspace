import * as Dialog from '@radix-ui/react-dialog'
import { Download, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { GlassSelect } from '@/components/glass/GlassSelect'
import { useWorkspace } from '@/data'
import { db } from '@/data/persistence'
import { useWorkspaceUI } from '@/shell/workspace'
import { addDays, weekStart } from '../submissions'
import { projectHandlers } from '../types'
import type { NbcActivity, NbcSubmission } from '../types'
import { isAreaProject, isRoomProject } from '../rooms'
import { confirmedCount, MAX_TEMPLATE_BYTES, reportFilename, reportingBlock, weeklyWorkbook, XLSX_TYPE } from './workbook'
import { areaWorkbook } from './areaWorkbook'
import { roomWorkbook } from './roomWorkbook'
import { loadReportTemplate } from './template'
import { hasReportPatch, patchWeeklyReport } from './reportPatch'

export default function ExportWorkbook({ projectId, activities, submissions, onClose }: { projectId: string; activities: NbcActivity[]; submissions: NbcSubmission[]; onClose: () => void }) {
  const scope = useWorkspace(s => s.scope), current = weekStart()
  const owners = projectHandlers(projectId)
  // v2 invalidates the six-handler template cached before Vuth was added.
  const key = `nbc-report-template:v2:${scope}:${projectId}`
  const [week, setWeek] = useState(current), [template, setTemplate] = useState<{ data: ArrayBuffer; name: string } | null>(null)
  // BP02 reports one column per room and is written from the live activities, so it needs no uploaded template.
  const generated = isRoomProject(activities)
  // The weekly report the client receives is updated in place from a file chosen on this computer; the tracker workbook stays available.
  const reportable = generated && hasReportPatch(activities)
  const [format, setFormat] = useState<'report' | 'tracker'>(reportable ? 'report' : 'tracker'), [reportFile, setReportFile] = useState<{ data: ArrayBuffer; name: string } | null>(null)
  const reporting = reportable && format === 'report'
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(!generated), [error, setError] = useState('')
  const weeks = [...new Set([current, addDays(current, -7), ...submissions.filter(s => s.confirmedAt && s.weekStart <= current).map(s => s.weekStart)])].sort().reverse()
  const confirmed = confirmedCount(activities, submissions, week)
  useEffect(() => {
    if (generated) return
    let active = true
    setLoading(true); setTemplate(null); setError('')
    const source = (async () => {
      const cached = await db.reportTemplates.get(key).catch(() => undefined)
      if (cached?.data && cached.data.byteLength > 0) return { name: cached.name, data: cached.data }
      if (scope === 'guest') return cached
      const remote = await loadReportTemplate(projectId)
      if (remote.data.byteLength > 0) await db.reportTemplates.put({ id: key, name: remote.name, data: remote.data }).catch(() => {})
      return remote
    })()
    void source.then(file => { if (active && file) setTemplate(file) }).catch(() => { if (active) setError('Could not load the project report format. Close and reopen export to try again.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [key, projectId, scope, generated])
  async function choose(file: File) {
    setBusy(true); setError('')
    try {
      if (file.size > MAX_TEMPLATE_BYTES) throw new Error('Choose an XLSX template up to 10 MB.')
      const data = await file.arrayBuffer()
      weeklyWorkbook(new Uint8Array(data), activities, submissions, week)
      setTemplate({ data, name: file.name })
      try { await db.reportTemplates.put({ id: key, data, name: file.name }) }
      catch { setError('The template could not be remembered on this device. You can still export; select it again next time.') }
    } catch (error) { setError((error as Error).message) } finally { setBusy(false) }
  }
  async function chooseReport(file: File) {
    setError('')
    if (file.size > MAX_TEMPLATE_BYTES * 5) { setError('Choose a weekly report up to 50 MB.'); return }
    setReportFile({ data: await file.arrayBuffer(), name: file.name })
  }
  function download() {
    if ((!template && !generated) || (reporting && !reportFile) || busy) return
    setBusy(true); setError('')
    try {
      if (reporting) {
        const patched = patchWeeklyReport(new Uint8Array(reportFile!.data), activities, submissions, week)
        const link = document.createElement('a'), url = URL.createObjectURL(new Blob([Uint8Array.from(patched.bytes).buffer], { type: XLSX_TYPE }))
        link.href = url; link.download = reportFile!.name; link.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
        useWorkspaceUI.getState().notify(`Weekly report updated: ${patched.updated} percentages changed${patched.notInReport ? `, ${patched.notInReport} not in the report` : ''}`)
        onClose(); return
      }
      const result = generated ? (isAreaProject(activities) ? areaWorkbook : roomWorkbook)(activities, submissions, week) : weeklyWorkbook(new Uint8Array(template!.data), activities, submissions, week)
      const url = URL.createObjectURL(new Blob([Uint8Array.from(result.bytes).buffer], { type: XLSX_TYPE }))
      const link = document.createElement('a'); link.href = url; link.download = reportFilename(week, projectId); link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      useWorkspaceUI.getState().notify('Weekly Excel report exported')
      onClose()
    } catch (error) { setError((error as Error).message) } finally { setBusy(false) }
  }
  return <Dialog.Root open onOpenChange={open => !open && !busy && onClose()}><Dialog.Portal>
    <Dialog.Overlay className="scrim"/>
    <Dialog.Content className="event-editor project-editor glass" data-material="thick">
      <div className="row-between"><Dialog.Title className="t-h3">Weekly client report</Dialog.Title><Dialog.Close disabled={busy} className="ibtn" aria-label="Close export"><X size={18}/></Dialog.Close></div>
      <Dialog.Description className="small muted">{reporting ? 'Choose your weekly report on this computer. Its percentages are updated from the app; formulas, weights and layout stay as they are.' : generated ? (isAreaProject(activities) ? 'Export Overall Progress, the ID and MEP sheets and every handler sheet with one column per area.' : 'Export Overall Progress, every floor and every handler sheet with one column per room.') : 'Export the Progress sheet and every handler sheet in your workbook’s existing format.'}</Dialog.Description>
      <form onSubmit={event => { event.preventDefault(); void download() }}>
        <label htmlFor="export-week">Reporting week<GlassSelect id="export-week" aria-label="Reporting week" disabled={busy} value={week} onChange={event => setWeek(event.target.value)}>{weeks.map(value => <option key={value} value={value}>{reportingBlock(value)} {value.slice(0, 4)}{value === current ? ' · This week' : ''}</option>)}</GlassSelect></label>
        <p className="small" role="status">{confirmed} of {owners.length} handlers confirmed. {confirmed < owners.length ? 'The workbook will show the confirmation count.' : 'All handlers have confirmed this week.'} Unconfirmed draft edits are excluded.</p>
        {reportable && <label htmlFor="export-format">Format<GlassSelect id="export-format" aria-label="Export format" disabled={busy} value={format} onChange={event => setFormat(event.target.value as 'report' | 'tracker')}><option value="report">Update my weekly report</option><option value="tracker">Tracker workbook</option></GlassSelect></label>}
        {reporting && <label>Weekly report (.xlsx)<input type="file" accept=".xlsx" aria-label="Weekly report file" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) void chooseReport(file).catch(() => setError('Could not read that file.')); event.target.value = '' }}/></label>}
        {reporting && reportFile && <p className="small muted">Selected report: {reportFile.name}</p>}
        {!generated && scope === 'guest' && <label>Excel template<input type="file" accept=".xlsx" aria-label="Weekly report template" disabled={busy || loading} onChange={event => { const file = event.target.files?.[0]; if (file) void choose(file); event.target.value = '' }}/></label>}
        {template && <p className="small muted">Saved template: {template.name}</p>}
        <p className="small muted">{reporting ? 'Only the percentage cells of the ID and MEP sheets change. Excel recalculates the report when you open it.' : generated ? (isAreaProject(activities) ? 'The report is built from the current area percentages.' : 'The report is built from the current room percentages.') : loading ? 'Loading report format…' : scope === 'guest' ? 'Choose your NBC BOQ workbook once for this demo device.' : 'The project baseline workbook format is ready to export.'}</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <footer><Dialog.Close type="button" disabled={busy} className="btn-secondary">Cancel</Dialog.Close><button className="btn-accent" type="submit" disabled={(!template && !generated) || (reporting && !reportFile) || busy || loading}><Download size={15} aria-hidden="true"/>{busy ? 'Preparing…' : 'Export XLSX'}</button></footer>
      </form>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>
}
