import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useWorkspace } from '@/data'
import { workspaceStart } from '@/shell/landing'
import { usePhone } from '@/shell/usePhone'
import { AuthGate } from '@/components/AuthGate'
import { NotFound } from '@/components/NotFound'
const AppShell = lazy(() => import('@/shell/AppShell').then(module => ({ default: module.AppShell })))
const SearchPage = lazy(()=>import('@/shell/WorkspaceOverlays').then(module=>({default:module.SearchPage})))

const Design = lazy(() => import('@/pages/Design'))
const Projects = lazy(() => import('@/pages/Projects'))
const Tasks = lazy(() => import('@/pages/Tasks'))
const PageEditor = lazy(() => import('@/pages/PageEditor'))
const Trash = lazy(() => import('@/pages/Trash'))
const Settings = lazy(() => import('@/pages/Settings'))
const MaterialTracker = lazy(() => import('@/mat/MaterialTracker'))

function WorkspaceStart() {
  const { scope, projects } = useWorkspace(), phone = usePhone()
  return <Navigate to={workspaceStart(scope, projects, phone)} replace />
}
export function App() {
  return <AuthGate><WorkspaceApp /></AuthGate>
}
function WorkspaceApp() {
  return (
    <Suspense
      fallback={
        <div className="page quiet-empty" role="status">
          Opening your workspace…
        </div>
      }
    >
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<WorkspaceStart />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<Projects />} />
          <Route path="projects/:id/:view" element={<Projects />} />
          <Route path="projects-progress" element={<Projects progressSection />} />
          <Route path="projects-progress/:id" element={<Projects progressSection />} />
          <Route path="projects-progress/:id/:view" element={<Projects progressSection />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="p/:id" element={<PageEditor />} />
          <Route path="calendar/*" element={<Navigate to="/" replace />} />
          <Route path="settings" element={<Settings />} />
          <Route path="settings/:section" element={<Settings />} />
          <Route path="trash" element={<Trash />} />
          <Route path="search" element={<SearchPage />} />
          <Route
            path="design"
            element={
              <Suspense
                fallback={
                  <div className="page">
                    <div className="skeleton" style={{ height: 48 }} />
                  </div>
                }
              >
                <Design />
              </Suspense>
            }
          />
          <Route path="admin" element={<MaterialTracker />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
