import { useId } from 'react'

export type SyncVisualState = 'saved' | 'local' | 'saving' | 'offline' | 'error'

/**
 * Iconic rounded Apple iCloud silhouette centered optically on a 20×20 grid
 * (top ~3.7, base 15.1, left ~2.1, right ~17.9) with generous interior room for glyphs.
 */
const CLOUD_PATH =
  'M6.05 15.1h8.25a3.35 3.35 0 0 0 .56-6.65 4.85 4.85 0 0 0-9.36-1.1 3.65 3.65 0 0 0 .55 7.75Z'

/**
 * Apple SF-Symbol-inspired hierarchical cloud & drive signs (20×20 optical grid).
 * Soft translucent interior tint paired with uniform 1.6px rounded strokes.
 */
export function SyncGlyph({ state, size = 16 }: { state: SyncVisualState; size?: number }) {
  const maskId = useId()

  if (state === 'local') {
    return (
      <svg
        className="sync-glyph"
        width={size}
        height={size}
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path
          d="M3.4 11.2 4.9 6.15A1.7 1.7 0 0 1 6.53 4.95h6.94a1.7 1.7 0 0 1 1.63 1.2l1.5 5.05"
          fill="currentColor"
          fillOpacity="0.08"
        />
        <rect x="2.5" y="11" width="15" height="4.5" rx="1.65" fill="currentColor" fillOpacity="0.13" />
        <circle cx="14.3" cy="13.25" r="0.8" fill="currentColor" stroke="none" />
      </svg>
    )
  }

  if (state === 'saving') {
    return (
      <svg
        className="sync-glyph sync-glyph-saving"
        width={size}
        height={size}
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <defs>
          <mask id={maskId}>
            <rect width="20" height="20" fill="#ffffff" />
            <rect x="7.4" y="12.6" width="5.2" height="4.5" rx="1.2" fill="#000000" />
          </mask>
        </defs>
        <path d={CLOUD_PATH} fill="currentColor" fillOpacity="0.11" stroke="none" />
        <path d={CLOUD_PATH} mask={`url(#${maskId})`} />
        <g className="sync-upload-arrow">
          <path d="M10 16.2V9.8" />
          <path d="M7.75 11.9 10 9.65l2.25 2.25" />
        </g>
      </svg>
    )
  }

  if (state === 'offline') {
    return (
      <svg
        className="sync-glyph"
        width={size}
        height={size}
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <defs>
          <mask id={maskId}>
            <rect width="20" height="20" fill="#ffffff" />
            <line x1="3.2" y1="3.2" x2="16.8" y2="16.8" stroke="#000000" strokeWidth="3.8" strokeLinecap="round" />
          </mask>
        </defs>
        <g mask={`url(#${maskId})`}>
          <path d={CLOUD_PATH} fill="currentColor" fillOpacity="0.11" />
        </g>
        <line x1="3.6" y1="3.6" x2="16.4" y2="16.4" />
      </svg>
    )
  }

  if (state === 'error') {
    return (
      <svg
        className="sync-glyph"
        width={size}
        height={size}
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={CLOUD_PATH} fill="currentColor" fillOpacity="0.11" />
        <path d="M10 7.1v3.4" />
        <circle cx="10" cy="12.75" r="0.85" fill="currentColor" stroke="none" />
      </svg>
    )
  }

  // state === 'saved'
  return (
    <svg
      className="sync-glyph sync-check"
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={CLOUD_PATH} fill="currentColor" fillOpacity="0.11" />
      <path className="sync-check-mark" d="M7.55 10.65 9.25 12.35l3.35-3.55" />
    </svg>
  )
}
