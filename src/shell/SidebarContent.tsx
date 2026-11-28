import {
  BarChart3,
  Eye,
  PanelLeft,
  Settings,
  SquarePen,
} from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useProjects } from '@/data'
import { useShell } from './store'

const ic = { size: 16, strokeWidth: 1.75 } as const
const popIc = { size: 14, strokeWidth: 1.8 } as const
const bpNumber = (name: string) => Number(/BP\s*0*(\d+)/i.exec(name)?.[1] ?? Number.MAX_SAFE_INTEGER)
const shortCode = (name: string) => /BP\s*0*(\d+)/i.exec(name)?.[0]?.replace(/\s+/g, '').toUpperCase() ?? name.slice(0, 4).toUpperCase()

const RING_R = 7
const RING_C = Number((2 * Math.PI * RING_R).toFixed(2))
const SPRING_RESPONSE = 0.24

function prefersReducedMotion() {
  if (typeof window === 'undefined') return true
  if (document.documentElement.dataset.motion === 'reduced') return true
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

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

/**
 * Critically damped Apple spring (damping ratio 1.0, response 0.24 s) that glides
 * the active project-view pill from its live presentation value and velocity.
 */
function useSpringSelectionPill(
  bodyRef: React.RefObject<HTMLElement | null>,
  pillRef: React.RefObject<HTMLDivElement | null>,
  activeKey: string,
  disabled: boolean,
) {
  const [ready, setReady] = useState(false)
  const springRef = useRef({ y: 0, v: 0, target: 0, raf: 0, init: false })

  useLayoutEffect(() => {
    const body = bodyRef.current
    const pill = pillRef.current
    const s = springRef.current
    if (s.raf) {
      cancelAnimationFrame(s.raf)
      s.raf = 0
    }

    if (disabled || !body || !pill || prefersReducedMotion()) {
      s.init = false
      if (pill) pill.style.opacity = '0'
      setReady(false)
      return
    }

    const active = body.querySelector<HTMLElement>('.nav-project-views .nav-item[aria-current="page"]')
    if (!active) {
      s.init = false
      pill.style.opacity = '0'
      setReady(false)
      return
    }

    const bodyRect = body.getBoundingClientRect()
    const rowRect = active.getBoundingClientRect()
    if (rowRect.height === 0 || rowRect.width === 0) {
      s.init = false
      pill.style.opacity = '0'
      setReady(false)
      return
    }

    const targetY = rowRect.top - bodyRect.top + body.scrollTop
    const leftInset = rowRect.left - bodyRect.left
    const rightInset = bodyRect.right - rowRect.right
    pill.style.left = `${leftInset}px`
    pill.style.right = `${rightInset}px`
    pill.style.height = `${rowRect.height}px`
    pill.style.opacity = '1'
    s.target = targetY
    setReady(true)

    if (!s.init) {
      s.init = true
      s.y = targetY
      s.v = 0
      pill.style.transform = `translate3d(0, ${targetY.toFixed(2)}px, 0)`
      return
    }

    let last = performance.now()
    const omega = (2 * Math.PI) / SPRING_RESPONSE
    const step = (now: number) => {
      const dt = Math.min(0.032, Math.max(0.004, (now - last) / 1000))
      last = now
      const x = s.y - s.target
      const exp = Math.exp(-omega * dt)
      const nextX = (x + (s.v + omega * x) * dt) * exp
      s.v = (s.v - (s.v + omega * x) * omega * dt) * exp
      s.y = s.target + nextX
      pill.style.transform = `translate3d(0, ${s.y.toFixed(2)}px, 0)`
      if (Math.abs(s.y - s.target) < 0.25 && Math.abs(s.v) < 1) {
        s.y = s.target
        s.v = 0
        pill.style.transform = `translate3d(0, ${s.y.toFixed(2)}px, 0)`
        s.raf = 0
        return
      }
      s.raf = requestAnimationFrame(step)
    }
    s.raf = requestAnimationFrame(step)
  }, [bodyRef, pillRef, activeKey, disabled])

  useEffect(() => () => {
    if (springRef.current.raf) cancelAnimationFrame(springRef.current.raf)
  }, [])

  return ready
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
  const isRail = !onNavigate && !sidebarOpen
  const bodyRef = useRef<HTMLElement | null>(null)
  const pillRef = useRef<HTMLDivElement | null>(null)
  const projectKey = progressProjects.map((p) => p.id).join(',')
  const springReady = useSpringSelectionPill(bodyRef, pillRef, `${pathname}|${projectKey}`, isRail)

  return (
    <>
      <div className="sidebar-header">
        {/* The brand is the way into the material list (/admin). Everyone else gets the ordinary Not found page there. */}
        <NavLink to="/admin" className="sidebar-home" aria-label="SingBuild Workspace: open the material list" title="Material list" onClick={onNavigate}>
          <img className="brand-logo" src="/brand/favicon.svg" alt="" width={22} height={22} />
          <span className="sidebar-brand">
            <span className="sidebar-brand-name">SingBuild</span>
            {' '}
            <span className="sidebar-brand-sub">Workspace</span>
          </span>
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
              <PanelLeft {...ic} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      {isRail ? <div className="sidebar-rail-divider" aria-hidden="true" /> : null}

      <nav
        ref={bodyRef}
        className="sidebar-body"
        aria-label="Primary"
        data-spring-ready={springReady || undefined}
      >
        {!isRail ? <div ref={pillRef} className="nav-spring-pill" aria-hidden="true" /> : null}
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
                      <span className="project-top">
                        <span className="project-name">{name}</span>
                        <span className="nav-meta">{pct}%</span>
                      </span>
                      {subtitle ? <span className="project-subtitle">{subtitle}</span> : null}
                    </span>
                  </div>

                  {isRail ? (
                    <>
                      <NavLink
                        to={`/projects-progress/${project.id}/overview`}
                        className="nav-rail-tile"
                        aria-label={`${project.name} (${pct}%)`}
                      >
                        <ProgressRing percent={pct} />
                        <span className="nav-rail-code">{shortCode(project.name)}</span>
                      </NavLink>
                      <div className="nav-rail-popover" role="group" aria-label={`${project.name} quick views`}>
                        <div className="nav-rail-pop-head">
                          <span className="nav-rail-pop-title">{name}</span>
                          <span className="nav-rail-pop-pct">{pct}%</span>
                        </div>
                        {subtitle ? <div className="nav-rail-pop-sub">{subtitle}</div> : null}
                        <div className="nav-rail-pop-links">
                          <NavLink to={`/projects-progress/${project.id}/overview`} end className="nav-rail-pop-link">
                            <Eye {...popIc} aria-hidden="true" />
                            <span>Overview</span>
                          </NavLink>
                          <NavLink to={`/projects-progress/${project.id}/activities`} end className="nav-rail-pop-link">
                            <BarChart3 {...popIc} aria-hidden="true" />
                            <span>Project Progress</span>
                          </NavLink>
                          <NavLink to={`/projects-progress/${project.id}/update`} end className="nav-rail-pop-link">
                            <SquarePen {...popIc} aria-hidden="true" />
                            <span>Update Progress</span>
                          </NavLink>
                        </div>
                      </div>
                    </>
                  ) : null}

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
          <Item to="/settings/account" icon={<Settings {...ic} />} label="Settings" onNavigate={onNavigate} />
        </ul>
        {isRail ? <div className="sidebar-foot-tip" role="tooltip">Settings</div> : null}
      </div>
    </>
  )
}
