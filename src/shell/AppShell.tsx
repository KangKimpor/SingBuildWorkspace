import '@/styles/stitch.css'
import '@/styles/phone.css'
import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { UpdateNotice } from './UpdateNotice'
import { registerUpdates } from '@/lib/pwa'
import { afterFirstPaint } from '@/lib/paint'
import { prefetchRoutes } from '@/lib/prefetch'
const BottomSheet = lazy(() =>
  import('./Overlays').then((module) => ({ default: module.BottomSheet })),
)
const SideSheet = lazy(() =>
  import('./Overlays').then((module) => ({ default: module.SideSheet })),
)
const Sidebar = lazy(() =>
  import('./Sidebar').then((module) => ({ default: module.Sidebar })),
)
const SidebarContent = lazy(() =>
  import('./SidebarContent').then((module) => ({ default: module.SidebarContent })),
)
import { TabBar } from './TabBar'
import { PhoneTopBar } from './PhoneTopBar'
import { TopBar } from './TopBar'
import { useCrumb } from './routes'
import { breakpointFor, useShell } from './store'
const WorkspaceOverlays = lazy(() =>
  import('./WorkspaceOverlays').then((module) => ({
    default: module.WorkspaceOverlays,
  })),
)
import { useWorkspaceUI } from './workspace'
import { useWorkspace } from '@/data'
const Reminders = lazy(() => import('@/components/Reminders'))
const QuickAdd = lazy(() =>
  import('@/components/QuickAdd').then((module) => ({
    default: module.QuickAdd,
  })),
)

/** Text fields raise the on-screen keyboard, so the phone tab bar steps aside while one has focus. */
const TEXT_FIELD = 'textarea, input:not([type=checkbox], [type=radio], [type=range], [type=color], [type=file], [type=button], [type=submit], [type=reset], [type=image])'
const projectPath = /^\/projects-progress\/[^/]+(\/[^/]+)?\/?$/
const isTyping = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || el.matches(TEXT_FIELD))

/** Flat sidebar navigation with an overlay drawer on tablets, and a phone top bar with bottom tabs below 768 px. */
export function AppShell() {
  useEffect(() => afterFirstPaint(registerUpdates), [])
  useEffect(() => {
    let stop = () => {}
    const cancel = afterFirstPaint(() => { stop = prefetchRoutes() })
    return () => { cancel(); stop() }
  }, [])
  const hasOverlay = useWorkspaceUI(
    (state) =>
      !!(state.commandOpen || state.toast),
  )
  const hasReminders = useWorkspace(
    (s) =>
      s.tasks.some((t) => t.reminder && !t.deletedAt && t.status !== 'Done'),
  )
  const scope = useWorkspace((s) => s.scope)
  const lastScope = useRef(scope)
  const root = useRef<HTMLDivElement>(null)
  const [bp, setBp] = useState(() => breakpointFor(window.innerWidth))
  const { pathname } = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    if (lastScope.current !== scope) { lastScope.current = scope; navigate('/', { replace: true }) }
  }, [scope, navigate])
  const crumb = useCrumb(pathname)
  const shell = useShell()
  const persistent = bp === 'expanded' || bp === 'large'
  const phone = bp === 'compact'
  // On phones the bottom bar exists only inside a progress project, as that project's views.
  const projectTabs = phone && projectPath.test(pathname)
  const [overlaysReady, setOverlaysReady] = useState(false)
  useEffect(() => {
    if (shell.drawerOpen || shell.sheet) setOverlaysReady(true)
  }, [shell.drawerOpen, shell.sheet])

  useEffect(() => {
    const el = root.current
    if (!el) return
    const ro = new ResizeObserver(
      // The viewport width, not the shell's, so the switch matches the 767 px media queries exactly.
      () => setBp(breakpointFor(window.innerWidth)),
    )
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Set on the element directly: toggling it must not re-render the screen underneath.
  useEffect(() => {
    let tapping = false
    let settle: number | undefined
    const sync = (typing: boolean) => root.current?.toggleAttribute('data-typing', typing)
    const clear = () => {
      tapping = false
      clearTimeout(settle)
      settle = undefined
      sync(isTyping(document.activeElement))
    }
    const armSettle = (ms: number) => {
      clearTimeout(settle)
      settle = window.setTimeout(clear, ms)
    }
    const onFocusIn = (e: FocusEvent) => {
      if (isTyping(e.target)) {
        tapping = false
        clearTimeout(settle)
        settle = undefined
        sync(true)
      }
    }
    const onFocusOut = (e: FocusEvent) => {
      if (isTyping(e.relatedTarget)) { sync(true); return }
      // Defer removing data-typing while a pointer tap is in flight so fixed bottom bars do not shift before click fires.
      if (tapping) return
      sync(false)
    }
    const onDown = () => { tapping = true; clearTimeout(settle); settle = undefined }
    const onUp = () => armSettle(80)
    const onClick = () => { if (tapping) armSettle(0) }
    addEventListener('focusin', onFocusIn)
    addEventListener('focusout', onFocusOut)
    addEventListener('pointerdown', onDown, true)
    addEventListener('pointerup', onUp, true)
    addEventListener('pointercancel', onUp, true)
    addEventListener('click', onClick, true)
    return () => {
      clearTimeout(settle)
      removeEventListener('focusin', onFocusIn)
      removeEventListener('focusout', onFocusOut)
      removeEventListener('pointerdown', onDown, true)
      removeEventListener('pointerup', onUp, true)
      removeEventListener('pointercancel', onUp, true)
      removeEventListener('click', onClick, true)
    }
  }, [])

  // Overlays that do not exist at this breakpoint close when the breakpoint changes.
  const { setDrawerOpen, setSheet } = shell
  useEffect(() => {
    if (bp !== 'medium') setDrawerOpen(false)
    if (bp !== 'compact') setSheet(null)
  }, [bp, setDrawerOpen, setSheet])

  // Ctrl or Cmd plus backslash toggles the sidebar; Ctrl or Cmd plus K opens search.
  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) {
        if (
          !e.altKey &&
          e.key.toLowerCase() === 'c' &&
          !(e.target as HTMLElement).closest(
            'input,textarea,select,[contenteditable="true"]',
          ) &&
          !document.querySelector('[role="dialog"]')
        ) {
          e.preventDefault()
          useShell.getState().setSheet('quick-add')
        }
        return
      }
      if (e.key === '\\') {
        e.preventDefault()
        if (persistent)
          useShell.getState().setSidebarOpen(!useShell.getState().sidebarOpen)
        else if (bp === 'medium')
          useShell.getState().setDrawerOpen(!useShell.getState().drawerOpen)
      } else if (e.key.toLowerCase() === 'k') {
        e.preventDefault()
        useWorkspaceUI
          .getState()
          .setCommandOpen(!useWorkspaceUI.getState().commandOpen)
      }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [bp, navigate, persistent])

  return (
    <div
      ref={root}
      className="shell"
      data-bp={bp}
      data-sidebar={shell.sidebarOpen ? 'open' : 'closed'}
      data-tabbar={projectTabs || undefined}
      style={{ ['--sidebar-w' as string]: `${shell.sidebarWidth}px` }}
    >
      <a className="skip" href="#main">
        Skip to content
      </a>
      {hasReminders && (
        <Suspense fallback={null}>
          <Reminders />
        </Suspense>
      )}
      {persistent ? <Suspense fallback={null}><Sidebar /></Suspense> : null}

      <div className="main">
        {phone ? <PhoneTopBar crumb={crumb} /> : <TopBar crumb={crumb} bp={bp} />}
        <main id="main" tabIndex={-1} className="canvas">
          <Outlet context={crumb.meta} />
        </main>
      </div>

      {projectTabs ? <TabBar /> : null}
      <UpdateNotice />
      <Suspense
        fallback={
          <span className="sr-only" role="status">
            Opening…
          </span>
        }
      >
        {overlaysReady && bp === 'medium' ? (
          <>
            <SideSheet
              side="left"
              className="drawer"
              title="Sidebar"
              open={shell.drawerOpen}
              onOpenChange={shell.setDrawerOpen}
            >
              <SidebarContent onNavigate={() => shell.setDrawerOpen(false)} />
            </SideSheet>
          </>
        ) : null}

        {phone ? (
          <>
            {overlaysReady && (
              <BottomSheet
                open={shell.sheet !== null}
                onOpenChange={(o) => !o && shell.setSheet(null)}
                title="Quick add"
              >
                <Suspense fallback={<p>Loading quick add…</p>}>
                  <QuickAdd onDone={() => shell.setSheet(null)} />
                </Suspense>
              </BottomSheet>
            )}
          </>
        ) : null}
        {overlaysReady && !phone && (
          <SideSheet
            side="right"
            className="rsheet"
            open={shell.sheet !== null}
            onOpenChange={(open) => !open && shell.setSheet(null)}
            title="Quick add"
          >
            <Suspense fallback={<p>Loading quick add…</p>}>
              <QuickAdd onDone={() => shell.setSheet(null)} />
            </Suspense>
          </SideSheet>
        )}
      </Suspense>
      {hasOverlay && (
        <Suspense
          fallback={
            <span className="sr-only" role="status">
              Opening…
            </span>
          }
        >
          <WorkspaceOverlays />
        </Suspense>
      )}
    </div>
  )
}
