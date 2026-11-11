import { useState } from 'react'
import { GlassSelect } from '@/components/glass/GlassSelect'
import { BottomSheet } from '@/shell/Overlays'
import { assignActivities, sharedHalfIds } from '../actions'
import { projectHandlers } from '../types'
import type { NbcActivity } from '../types'

/** Audited bulk reassignment of every leaf under one parent activity. */
export function ReassignSheet({ activities, open, onOpenChange }: { activities: NbcActivity[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const owners = projectHandlers(activities[0]?.projectId)
  const [parent, setParent] = useState(''), [handler, setHandler] = useState<string>(owners[0]!), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const root = activities.find((a) => a.id === parent)
  const shared = sharedHalfIds(activities)
  // Cells shared 50/50 by two handlers keep both of them.
  const leaves = activities.filter((a) => a.editable && root && !shared.has(a.id) && (a.id === root.id || a.wbs.startsWith(`${root.wbs}.`)))
  return <BottomSheet initial="large" open={open} onOpenChange={onOpenChange} title="Reassign handlers">
    <form className="nbc-sheet-fields" onSubmit={(e) => { e.preventDefault(); try { if (!parent) throw new Error('Select a parent activity.'); setBusy(true); setError(''); void Promise.resolve(assignActivities(leaves.map((a) => a.id), handler)).then(() => onOpenChange(false)).catch((err) => setError((err as Error).message)).finally(() => setBusy(false)) } catch (err) { setError((err as Error).message) } }}>
      <label className="nbc-field">Parent activity<GlassSelect aria-label="Parent activity" value={parent} onChange={(e) => setParent(e.target.value)}><option value="">Choose parent…</option>{activities.filter((a) => !a.editable).map((a) => <option key={a.id} value={a.id}>{a.wbs} · {a.name}</option>)}</GlassSelect></label>
      <label className="nbc-field">Assign to<GlassSelect aria-label="Bulk handler" value={handler} onChange={(e) => setHandler(e.target.value)}>{owners.map((h) => <option key={h}>{h}</option>)}</GlassSelect></label>
      <p>{leaves.length} leaf activities will be assigned to {handler}. Progress percentages stay the same.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn-accent" type="submit" disabled={!leaves.length || busy}>{busy ? 'Saving…' : `Confirm assignment · ${leaves.length} activities`}</button>
    </form>
  </BottomSheet>
}
