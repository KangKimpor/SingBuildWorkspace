import type { ProjectSummary } from '@/data'
type Selection = { workspace: 'team' | 'personal'; projectId?: string }
export function rememberWorkspace(scope: string, selection: Selection) {
  try { localStorage.setItem(`kw-start:${scope}`, JSON.stringify(selection)) } catch { /* Device preference is optional. */ }
}
export function workspaceStart(scope: string, projects: ProjectSummary[], phone = false) {
  // On a phone the projects list is home; it does not reopen the last project.
  if (phone) return '/projects-progress'
  let selected: Selection | undefined
  try { selected = JSON.parse(localStorage.getItem(`kw-start:${scope}`) || 'null') } catch { /* Progress is the default. */ }
  // Projects Progress is the main screen; resume a remembered progress project when there is one.
  const project = selected?.projectId
    ? projects.find((p) => p.status !== 'Archived' && p.nbcBp03 && p.id === selected.projectId)
    : undefined
  return project ? `/projects-progress/${encodeURIComponent(project.id)}/overview` : '/projects-progress'
}
