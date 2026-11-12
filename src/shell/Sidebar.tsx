import { Glass } from '@/components/glass/Glass'
import { SidebarContent } from './SidebarContent'
import { useShell } from './store'

/** Persistent sidebar for expanded and large layouts. */
export function Sidebar() {
  const open = useShell((s) => s.sidebarOpen)
  const collapsed = !open

  return (
    <div className="sidebar-slot" data-collapsed={collapsed}>
      <Glass as="aside" material="regular" className="sidebar" aria-label="Sidebar" data-testid="sidebar" data-collapsed={collapsed}>
        <SidebarContent />
      </Glass>
    </div>
  )
}
