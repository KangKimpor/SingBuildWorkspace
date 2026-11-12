import './ui.css'

export type LegendKey = 'changed' | 'problem' | 'na'
const LEGEND: Record<LegendKey, string> = { changed: 'Changed this week', problem: 'Needs attention', na: 'Not applicable' }

/** Activity counter and key for the marks used in the table above it. Shared by Project Progress and Update Progress. */
/** `triangle`: changed cells carry the corner mark (Project Progress matrix) instead of an outline. */
export function TableFooter({ count, legend, triangle = false }: { count: number; legend: LegendKey[]; triangle?: boolean }) {
  return <div className="nbc-key-bar">
    <span role="status" aria-live="polite">{count} {count === 1 ? 'activity' : 'activities'}</span>
    <ul className="nbc-key" aria-label="Legend">{legend.map((key) => <li key={key}><i className="nbc-sw" data-kind={key === 'changed' && !triangle ? 'changed-row' : key} aria-hidden="true"/>{LEGEND[key]}</li>)}</ul>
  </div>
}
