import './changed-dot.css'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface TipPos {
  left: number
  top: number
  place: 'above' | 'below'
  align: 'center' | 'end'
}

/**
 * Corner indicator for cells changed this week.
 * Hovering the indicator reveals the previous value in a portaled tooltip so scroll containers and sticky headers never clip it.
 */
export function ChangedDot({ previous }: { previous?: string }) {
  const dotRef = useRef<HTMLSpanElement>(null)
  const [pos, setPos] = useState<TipPos | null>(null)

  useEffect(() => {
    const el = dotRef.current
    if (!el || !previous) return
    const open = () => {
      const rect = el.getBoundingClientRect()
      const place = rect.top < 44 ? 'below' : 'above'
      const nearRight = window.innerWidth - rect.right < 96
      setPos({
        left: nearRight ? rect.right : rect.left + rect.width / 2,
        top: place === 'above' ? rect.top - 4 : rect.bottom + 4,
        place,
        align: nearRight ? 'end' : 'center',
      })
    }
    const close = () => setPos(null)
    el.addEventListener('mouseenter', open)
    el.addEventListener('mouseleave', close)
    return () => {
      el.removeEventListener('mouseenter', open)
      el.removeEventListener('mouseleave', close)
    }
  }, [previous])

  useEffect(() => {
    if (!pos) return
    const close = () => setPos(null)
    addEventListener('scroll', close, { capture: true, passive: true })
    return () => removeEventListener('scroll', close, { capture: true })
  }, [pos])

  return <>
    <span
      ref={dotRef}
      className="changed-dot"
      role="img"
      aria-label={previous ? `Changed this week, previous: ${previous}` : 'Changed this week'}
    />
    {pos && previous && createPortal(
      <span
        className="changed-tip"
        role="tooltip"
        data-place={pos.place}
        data-align={pos.align}
        style={{ left: pos.left, top: pos.top }}
      >
        <span className="changed-tip-label">Previous</span>
        <span className="changed-tip-val">{previous}</span>
      </span>,
      document.body,
    )}
  </>
}
