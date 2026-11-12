import type { CSSProperties } from 'react'

/**
 * Presentation hooks for a Now % cell: the 3px bar reads `--pct`, the "+x" chip reads `data-delta`.
 * Both come from the two numbers the table already has; nothing new is stored or computed elsewhere.
 */
export function nowCellProps(now: number, before: number) {
  const pct = Math.min(100, Math.max(0, now * 100))
  const diff = (now - before) * 100
  const delta = Math.abs(diff) < 0.05 ? undefined : `${diff > 0 ? '+' : '−'}${Math.abs(diff).toFixed(1)}`
  return { 'data-pct': Math.round(pct * 10) / 10, 'data-full': pct >= 99.995 ? 'true' : undefined, 'data-delta': delta, style: { '--pct': pct } as CSSProperties }
}
