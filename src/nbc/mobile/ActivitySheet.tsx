import { BottomSheet } from '@/shell/Overlays'
import { percent } from '../format'
import type { DrillRow } from './drill'

const points = (n: number) => `${n > 0 ? '+' : '−'}${Number((Math.abs(n) * 100).toFixed(2))}`

export interface ActivitySheetProps {
  row: DrillRow | null
  path: string
  handler: string
  remark: string
  onClose: () => void
}

/** Bottom sheet with one activity's full context: path, previous vs this week %, handler and remark. */
export function ActivitySheet({ row, path, handler, remark, onClose }: ActivitySheetProps) {
  const diff = row ? row.progress - row.previous : 0
  return (
    <BottomSheet open={!!row} onOpenChange={(open) => { if (!open) onClose() }} title={row?.activity.name ?? 'Activity'}>
      {row && (
        <div className="ph-sheet-body">
          <p className="ph-sheet-path">{row.activity.wbs}{path ? ` · ${path}` : ''}</p>
          <dl className="ph-sheet-stats">
            <div>
              <dt>Previous week %</dt>
              <dd>{percent(row.previous)}</dd>
            </div>
            <div>
              <dt>This week %</dt>
              <dd>
                {percent(row.progress)}
                {Math.abs(diff) > 1e-12 && (
                  <span className="nbc-delta" data-dir={diff > 0 ? 'up' : 'down'}>{points(diff)}</span>
                )}
              </dd>
            </div>
          </dl>
          <dl className="ph-sheet-meta">
            <div>
              <dt>Handler</dt>
              <dd>{handler}</dd>
            </div>
            <div>
              <dt>Remark</dt>
              <dd>{remark || '—'}</dd>
            </div>
          </dl>
        </div>
      )}
    </BottomSheet>
  )
}
