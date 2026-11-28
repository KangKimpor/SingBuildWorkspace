import {
  BarChart3,
  Eye,
  PanelLeft,
  Settings,
  SquarePen,
} from 'lucide-react'
import { useMemo } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useProjects } from '@/data'
import { useShell } from './store'

const ic = { size: 14, strokeWidth: 1.75 } as const
const bpNumber = (name: string) => Number(/BP\s*0*(\d+)/i.exec(name)?.[1] ?? Number.MAX_SAFE_INTEGER)
const shortCode = (name: string) => /BP\s*0*(\d+)/i.exec(name)?.[0]?.replace(/\s+/g, '').toUpperCase() ?? name.slice(0, 4).toUpperCase()

const RING_R = 7
const RING_C = Number((2 * Math.PI * RING_R).toFixed(2))

function ProgressRing({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent))
  const offset = Number((RING_C * (1 - clamped / 100)).toFixed(2))
  return (
    <svg className="proj-ring" viewBox="0 0 18 18" aria-hidden="true">
      <circle className="proj-ring-track" cx="9" cy="9" r={RING_R} />
      <circle
        className="proj-ring-fill"
        cx="9"
        cy="9"
        r={RING_R}
        strokeDasharray={RING_C}
        strokeDashoffset={offset}
      />
    </svg>
  )
}

function Item({
  to,
  icon,
  label,
  onNavigate,
}: {
  to: string
  icon: React.ReactNode
  label: string
  onNavigate?: () => void
}) {
  return (
    <li>
      <NavLink
        to={to}
        end
        className="nav-item"
        onClick={onNavigate}
      >
        <span className="nav-icon" aria-hidden="true">{icon}</span>
        <span className="nav-label">{label}</span>
      </NavLink>
    </li>
  )
}

/** Sidebar contents, shared by the persistent sidebar and the overlay drawer. */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const projects = useProjects()
  const sidebarOpen = useShell((s) => s.sidebarOpen)
  const setSidebarOpen = useShell((s) => s.setSidebarOpen)

  const progressProjects = useMemo(
    () => projects.filter((p) => p.nbcBp03).sort((a, b) => bpNumber(a.name) - bpNumber(b.name)),
    [projects],
  )

  const { pathname } = useLocation()
  return (
    <>
      <div className="sidebar-header">
        {/* The brand is the way into the material list (/admin). Everyone else gets the ordinary Not found page there. */}
        <NavLink to="/admin" className="sidebar-home" aria-label="SingBuild Workspace: open the material list" title="Material list" onClick={onNavigate}>
          <img className="brand-logo" src="/brand/favicon.svg" alt="" width={18} height={18} />
          <span className="sidebar-brand">SingBuild Workspace</span>
        </NavLink>
        <div className="sidebar-header-actions">
          {!onNavigate ? (
            <button
              type="button"
              className="sidebar-icon-btn sidebar-collapse-btn"
              aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              aria-pressed={!sidebarOpen}
              title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <PanelLeft size={14} strokeWidth={1.8} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      <nav className="sidebar-body" aria-label="Primary">
        <div className="nav-section">
          <div className="t-caption">Projects</div>
          <ul className="nav-list nav-projects nav-progress" aria-label="Progress projects">
            {progressProjects.map((project) => {
              const isCurrent = pathname.startsWith(`/projects-progress/${project.id}/`)
              const [name, subtitle] = project.name.split(' – ')
              const pct = Math.round(project.progress * 100)
              return (
                <li key={project.id} data-current={isCurrent}>
                  <div
                    className="nav-item nav-project-toggle"
                    title={project.name}
                    style={{ '--pct': pct } as React.CSSProperties}
                  >
                    <span className="project-ring-wrap">
                      <ProgressRing percent={pct} />
                    </span>
                    <span className="project-heading">
                      <span className="project-name">{name}</span>
                      {subtitle ? <span className="project-subtitle">{subtitle}</span> : null}
                    </span>
                    <span className="project-trailing">
                      <span className="nav-meta">{pct}%</span>
                    </span>
                  </div>

                  <NavLink
                    to={`/projects-progress/${project.id}/overview`}
                    className="nav-rail-tile"
                    aria-label={`${project.name} (${pct}%)`}
                    onClick={onNavigate}
                  >
                    <ProgressRing percent={pct} />
                    <span className="nav-rail-code">{shortCode(project.name)}</span>
                  </NavLink>
                  <div className="nav-rail-tip" role="tooltip">
                    {project.name} · {pct}%
                  </div>

                  <div className="nav-project-views-wrap">
                    <ul className="nav-list nav-project-views" aria-label={`${project.name} views`}>
                      <Item to={`/projects-progress/${project.id}/overview`} icon={<Eye {...ic} />} label="Overview" onNavigate={onNavigate} />
                      <Item to={`/projects-progress/${project.id}/activities`} icon={<BarChart3 {...ic} />} label="Project Progress" onNavigate={onNavigate} />
                      <Item to={`/projects-progress/${project.id}/update`} icon={<SquarePen {...ic} />} label="Update Progress" onNavigate={onNavigate} />
                    </ul>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </nav>

      <div className="sidebar-foot">
        <ul className="nav-list">
          <Item to="/settings/account" icon={<Settings size={15} strokeWidth={1.75} />} label="Settings" onNavigate={onNavigate} />
        </ul>
      </div>
    </>
  )
}
