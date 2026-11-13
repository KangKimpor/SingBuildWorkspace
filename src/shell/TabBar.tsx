import { ChartNoAxesColumn, Eye, SquarePen } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { Glass } from '@/components/glass/Glass'
import { aliases } from '@/nbc/views'

const ic = { size: 22, strokeWidth: 1.75, 'aria-hidden': true } as const

const tabs = [
  { view: 'overview', label: 'Overview', icon: <Eye {...ic} /> },
  { view: 'activities', label: 'Progress', icon: <ChartNoAxesColumn {...ic} /> },
  { view: 'update', label: 'Update', icon: <SquarePen {...ic} /> },
] as const

/** The tab a project view belongs to: legacy names follow their alias, Issues sits under Progress, no view is Overview. */
function tabFor(view = 'overview') {
  const v = aliases[view] ?? view
  return v === 'issues' ? 'activities' : tabs.some((t) => t.view === v) ? v : 'overview'
}

/** Phone navigation inside a progress project: its three views, 64 px plus the safe area. */
export function TabBar() {
  const [, , id, view] = useLocation().pathname.split('/')
  const current = tabFor(view || undefined)
  return (
    <Glass as="nav" material="regular" className="tabbar" aria-label="Project tabs" data-testid="tabbar">
      {tabs.map((t) => (
        <Link
          key={t.view}
          className="tab"
          to={`/projects-progress/${id}/${t.view}`}
          aria-current={t.view === current ? 'page' : undefined}
        >
          {t.icon}
          <span>{t.label}</span>
        </Link>
      ))}
    </Glass>
  )
}
