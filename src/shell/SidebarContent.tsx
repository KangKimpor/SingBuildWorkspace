import {
  BarChart3,
  ChevronRight,
  Eye,
  PanelLeft,
  Search,
  Settings,
  SquarePen,
  X,
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useProjects, useWorkspace } from '@/data'
import { attentionItems } from '@/nbc/overview/insights'
import { useShell } from './store'

const ic = { size: 15, strokeWidth: 1.75 } as const
const expandedKey = 'kw-sidebar-expanded-projects'
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
  badge,
  onNavigate,
}: {
  to: string
  icon: React.ReactNode
  label: string
  badge?: number
  onNavigate?: () => void
}) {
  return (
    <li>
      <NavLink to={to} end className="nav-item" onClick={onNavigate}>
        <span className="nav-icon" aria-hidden="true">{icon}</span>
        <span className="nav-label">{label}</span>
        {badge ? <span className="nav-badge" aria-label={`${badge} needing attention`}>{badge}</span> : null}
      </NavLink>
    </li>
  )
}

/** Sidebar contents, shared by the persistent sidebar and the overlay drawer. */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const projects = useProjects()
  const nbcActivities = useWorkspace((s) => s.nbc_activities)
  const nbcSubmissions = useWorkspace((s) => s.nbc_submissions)
  const sidebarOpen = useShell((s) => s.sidebarOpen)
  const setSidebarOpen = useShell((s) => s.setSidebarOpen)

  const progressProjects = useMemo(
    () => projects.filter((p) => p.nbcBp03).sort((a, b) => bpNumber(a.name) - bpNumber(b.name)),
    [projects],
  )

  const { pathname } = useLocation()
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

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

  const attentionCounts = useMemo(() => {
    const counts = new Map<string, number>()
    if (!nbcActivities?.length) return counts
    const now = Date.now()
    const today = new Date(now).toLocaleDateString('en-CA', { timeZone: 'Asia/Phnom_Penh' })
    for (const p of progressProjects) {
      const activities = nbcActivities.filter((a) => a.projectId === p.id)
      if (!activities.length) continue
      const submissions = (nbcSubmissions ?? []).filter((s) => s.projectId === p.id)
      const count = attentionItems({ projectId: p.id, activities, submissions, today, now }).length
      if (count > 0) counts.set(p.id, count)
    }
    return counts
  }, [nbcActivities, nbcSubmissions, progressProjects])

  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return progressProjects
    return progressProjects.filter((p) => p.name.toLowerCase().includes(q))
  }, [progressProjects, query])

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

  const toggleSearch = () => {
    setSearchOpen((open) => {
      const next = !open
      if (next) {
        requestAnimationFrame(() => searchInputRef.current?.focus())
      } else {
        setQuery('')
      }
      return next
    })
  }

  return (
    <>
      <div className="sidebar-header">
        <img className="brand-logo" src="/brand/favicon.svg" alt="" width={28} height={28} />
        <span className="sidebar-brand">SingBuild Workspace</span>
        <div className="sidebar-header-actions">
          <button
            type="button"
            className="sidebar-icon-btn sidebar-search-btn"
            aria-label="Filter projects"
            aria-pressed={searchOpen}
            title="Filter projects"
            onClick={toggleSearch}
          >
            <Search size={15} strokeWidth={1.85} aria-hidden="true" />
          </button>
          {!onNavigate ? (
            <button
              type="button"
              className="sidebar-icon-btn sidebar-collapse-btn"
              aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              aria-pressed={!sidebarOpen}
              title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <PanelLeft size={15} strokeWidth={1.8} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="sidebar-search-drawer" data-open={searchOpen} aria-hidden={!searchOpen} inert={!searchOpen}>
        <div className="sidebar-search-inner">
          <div className="sidebar-search-box" data-has-query={query.length > 0}>
            <span className="sidebar-search-glyph" aria-hidden="true">
              <Search size={13} strokeWidth={2} />
            </span>
            <input
              ref={searchInputRef}
              type="text"
              className="sidebar-search-input"
              placeholder="Filter projects…"
              aria-label="Filter projects"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  if (query) setQuery('')
                  else toggleSearch()
                }
              }}
            />
            {query.length > 0 ? (
              <button
                type="button"
                className="sidebar-search-clear"
                aria-label="Clear filter"
                onClick={() => {
                  setQuery('')
                  searchInputRef.current?.focus()
                }}
              >
                <X size={10} strokeWidth={2.5} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <nav className="sidebar-body" aria-label="Primary">
        <div className="nav-section">
          <div className="t-caption">Projects</div>
          <ul className="nav-list nav-projects nav-progress" aria-label="Progress projects">
            {filteredProjects.map((project) => {
              const isExpanded = expanded.has(project.id)
              const isCurrent = pathname.startsWith(`/projects-progress/${project.id}/`)
              const [name, subtitle] = project.name.split(' – ')
              const pct = Math.round(project.progress * 100)
              const viewsId = `sidebar-views-${project.id}`
              const attentionCount = attentionCounts.get(project.id)
              return (
                <li key={project.id} data-current={isCurrent} data-expanded={isExpanded}>
                  <button
                    type="button"
                    className="nav-item nav-project-toggle"
                    aria-expanded={isExpanded}
                    aria-controls={viewsId}
                    aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${project.name}`}
                    title={project.name}
                    style={{ '--pct': pct } as React.CSSProperties}
                    onClick={() => toggleProject(project.id)}
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
                      <span className="nav-icon project-chevron" aria-hidden="true">
                        <ChevronRight size={12} strokeWidth={2.4} />
                      </span>
                    </span>
                  </button>

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

                  <div
                    id={viewsId}
                    className="nav-project-views-wrap"
                    data-expanded={isExpanded}
                    aria-hidden={!isExpanded}
                    inert={!isExpanded}
                  >
                    <ul className="nav-list nav-project-views" aria-label={`${project.name} views`}>
                      <Item to={`/projects-progress/${project.id}/overview`} icon={<Eye {...ic} />} label="Overview" badge={attentionCount} onNavigate={onNavigate} />
                      <Item to={`/projects-progress/${project.id}/activities`} icon={<BarChart3 {...ic} />} label="Project Progress" onNavigate={onNavigate} />
                      <Item to={`/projects-progress/${project.id}/update`} icon={<SquarePen {...ic} />} label="Update Progress" onNavigate={onNavigate} />
                    </ul>
                  </div>
                </li>
              )
            })}
          </ul>
          {filteredProjects.length === 0 && query.trim() ? (
            <div className="sidebar-empty">No matching projects</div>
          ) : null}
        </div>
      </nav>

      <div className="sidebar-foot">
        <ul className="nav-list">
          <Item to="/settings/account" icon={<Settings size={16} strokeWidth={1.75} />} label="Settings" onNavigate={onNavigate} />
        </ul>
      </div>
    </>
  )
}
