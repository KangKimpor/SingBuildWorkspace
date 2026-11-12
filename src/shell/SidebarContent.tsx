import {
  BarChart3,
  Building2,
  ChevronDown,
  ChevronRight,
  Eye,
  Settings,
  SquarePen,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useProjects } from '@/data'

const ic = { size: 18, strokeWidth: 1.75 } as const
const expandedKey = 'kw-sidebar-expanded-projects'
const bpNumber = (name: string) => Number(/BP\s*0*(\d+)/i.exec(name)?.[1] ?? Number.MAX_SAFE_INTEGER)

function Item({ to, icon, label, onNavigate }: { to: string; icon: React.ReactNode; label: string; onNavigate?: () => void }) {
  return (
    <li>
      <NavLink to={to} end className="nav-item" onClick={onNavigate}>
        <span className="nav-icon">{icon}</span>
        <span className="nav-label">{label}</span>
      </NavLink>
    </li>
  )
}

/** Sidebar contents, shared by the persistent sidebar and the overlay drawer. */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const projects = useProjects()
  const progressProjects = projects.filter((p) => p.nbcBp03).sort((a, b) => bpNumber(a.name) - bpNumber(b.name))
  const { pathname } = useLocation()
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(expandedKey) ?? 'null')
      if (Array.isArray(stored)) {
        return new Set(stored.filter((id): id is string => typeof id === 'string' && projects.some((p) => p.id === id)))
      }
    } catch {
      // Ignore an unavailable or stale preference.
    }
    const active = projects.find((p) => pathname.startsWith(`/projects-progress/${p.id}/`))?.id
    const first = active ?? progressProjects[0]?.id
    return new Set(first ? [first] : [])
  })

  const toggleProject = (id: string) => setExpanded((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    try {
      localStorage.setItem(expandedKey, JSON.stringify([...next]))
    } catch {
      // Keep the in-memory state when storage is unavailable.
    }
    return next
  })

  return (
    <>
      <div className="sidebar-header">
        <img className="brand-logo" src="/brand/favicon.svg" alt="" width={28} height={28} />
        <span className="sidebar-brand">SingBuild Workspace</span>
      </div>

      <nav className="sidebar-body" aria-label="Primary">
        <div className="nav-section">
          <div className="t-caption"><NavLink to="/projects-progress" end onClick={onNavigate}>Projects Progress</NavLink></div>
          <ul className="nav-list nav-projects nav-progress" aria-label="Progress projects">
            {progressProjects.map((project) => {
              const isExpanded = expanded.has(project.id)
              const isCurrent = pathname.startsWith(`/projects-progress/${project.id}/`)
              const [name, subtitle] = project.name.split(' – ')
              const viewsId = `sidebar-views-${project.id}`
              return (
                <li key={project.id} data-current={isCurrent}>
                  <button
                    type="button"
                    className="nav-item nav-project-toggle"
                    aria-expanded={isExpanded}
                    aria-controls={viewsId}
                    aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${project.name}`}
                    title={project.name}
                    style={{ '--pct': Math.round(project.progress * 100) } as React.CSSProperties}
                    onClick={() => toggleProject(project.id)}
                  >
                    <span className="nav-icon project-chevron" aria-hidden="true">
                      {isExpanded ? <ChevronDown {...ic} /> : <ChevronRight {...ic} />}
                    </span>
                    <span className="nav-icon project-symbol" aria-hidden="true"><Building2 {...ic} /></span>
                    <span className="project-heading">
                      <span className="project-name">{name}</span>
                      {subtitle ? <span className="project-subtitle">{subtitle}</span> : null}
                    </span>
                    <span className="nav-meta">{Math.round(project.progress * 100)}%</span>
                  </button>
                  <div
                    id={viewsId}
                    className="nav-project-views-wrap"
                    data-expanded={isExpanded}
                    aria-hidden={!isExpanded}
                    inert={!isExpanded}
                  >
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
          <Item to="/settings/appearance" icon={<Settings {...ic} />} label="Settings" onNavigate={onNavigate} />
        </ul>
      </div>
    </>
  )
}
