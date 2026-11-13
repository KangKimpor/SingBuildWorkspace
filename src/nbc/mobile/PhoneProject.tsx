import './mobile.css'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Download, MoreHorizontal } from 'lucide-react'
import type { ProjectSummary } from '@/data'
import { GlassPopover } from '@/components/glass/GlassPopover'
import { usePhoneHeader } from '@/shell/phoneHeader'
import { shortName } from './PhoneProjects'

export interface PhoneProjectProps { project: ProjectSummary; weekText: string; onExport?: () => void; children: ReactNode }

/** Phone frame of a progress project: the top bar names it and holds the "⋯" menu; the tab bar switches views. */
export function PhoneProject({ project, weekText, onExport, children }: PhoneProjectProps) {
  const [menu, setMenu] = useState(false)
  const actions = <GlassPopover label="Project actions" open={menu} onOpenChange={setMenu}
    trigger={<button type="button" className="ibtn" aria-label="Project actions"><MoreHorizontal size={22} strokeWidth={1.75} aria-hidden="true"/></button>}>
    <div className="ph-menu">
      <button type="button" disabled={!onExport} onClick={() => { setMenu(false); onExport?.() }}><Download size={20} strokeWidth={1.75} aria-hidden="true"/>Export XLSX</button>
    </div>
  </GlassPopover>
  usePhoneHeader({ title: shortName(project.name), back: '/projects-progress', actions })
  return <>
    <p className="ph-week">{weekText}</p>
    {children}
  </>
}
