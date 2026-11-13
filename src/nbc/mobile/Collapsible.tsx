import './mobile.css'
import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

/** A 52 px row that opens a section in place. Children mount only while open, so closed sections cost nothing. */
export function Collapsible({ title, summary, defaultOpen = false, children }: { title: string; summary: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen), id = useId()
  return <section className="ph-collapsible" aria-label={title} data-open={open || undefined}>
    <button type="button" className="ph-collapsible-head" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(!open)}>
      <span className="ph-collapsible-title">{title}</span>
      <span className="ph-collapsible-summary">{summary}</span>
      <ChevronDown size={20} strokeWidth={1.75} aria-hidden="true"/>
    </button>
    {open && <div id={id} className="ph-collapsible-body">{children}</div>}
  </section>
}
