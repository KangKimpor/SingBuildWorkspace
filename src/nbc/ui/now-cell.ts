/**
 * Presentation hooks for a Now % cell: `data-full` turns 100% green, and `data-delta` / `data-delta-dir`
 * render the plain inline delta text ("+1.8" / "−0.5") before the value.
 */
export function nowCellProps(now: number, before: number) {
  const pct = Math.min(100, Math.max(0, now * 100))
  const diff = (now - before) * 100
  const delta = Math.abs(diff) < 0.05 ? undefined : `${diff > 0 ? '+' : '−'}${Math.abs(diff).toFixed(1)}`
  return {
    'data-full': pct >= 99.995 ? 'true' : undefined,
    'data-delta': delta,
    'data-delta-dir': delta ? (diff > 0 ? 'up' : 'down') : undefined,
  }
}
