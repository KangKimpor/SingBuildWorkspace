import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { useWorkspace } from '@/data'
import { TaskTable, columns } from '@/components/TaskTable'
import { SidebarContent } from '@/shell/SidebarContent'
import { TaskRow } from '@/components/TaskRow'
import { rebaseWrite } from '@/data/sync-merge'
import { fixtureProject } from '@/nbc/test-fixture'
const initial = useWorkspace.getState()
afterEach(() => { useWorkspace.setState(initial); localStorage.clear() })
test('projects default to Personal, retain assignment and appear in only their group', () => {
  const state = useWorkspace.getState()
  const personal = state.addProject('Private planning')
  const team = state.addProject('Team planning', 'team')
  expect(useWorkspace.getState().projects.find((p) => p.id === personal)?.workspace).toBe('personal')
  state.updateProject(personal, { workspace: 'team' })
  expect(JSON.parse(localStorage.getItem('kw-workspace-v1')!).projects.find((p: { id: string }) => p.id === personal).workspace).toBe('team')
  render(<MemoryRouter><SidebarContent /></MemoryRouter>)
  expect(screen.queryByText('Team Workspace')).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /Private planning/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /Team planning/ })).not.toBeInTheDocument()
  expect(screen.queryByText('Personal Workspace (Testing Phase)')).not.toBeInTheDocument()
  expect(screen.getByText('Projects Progress')).toBeInTheDocument()
  expect(useWorkspace.getState().projects.find((p) => p.id === team)?.workspace).toBe('team')
  for (const name of ['Favorites', 'Pages', 'New page', 'My tasks', 'Home', 'Calendar']) expect(screen.queryByText(name, { exact: true })).not.toBeInTheDocument()
  expect(useWorkspace.getState().pages).toEqual(initial.pages)
})
test('table edits description inline without extra fields and has the requested order', () => {
  const task = initial.tasks[0]!
  render(<MemoryRouter><TaskTable tasks={[task]} mobile toolbar={null} actions={null} /></MemoryRouter>)
  expect(columns).toEqual(['title', 'status', 'priority', 'due', 'notes'])
  expect(screen.getAllByRole('columnheader').map((h) => h.textContent?.replace(/[^a-z ]/gi, '').trim())).toEqual(['Task name', 'Status', 'Priority', 'Due date', 'Description'])
  fireEvent.change(screen.getByLabelText(`Description for ${task.title}`), { target: { value: 'An editable description' } })
  expect(useWorkspace.getState().tasks.find((t) => t.id === task.id)?.notes).toBe('An editable description')
  expect(screen.queryByText('More fields')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Reminder')).not.toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /^Open / })).not.toBeInTheDocument()
})
test('list and board rows expose editable titles and colored status choices', () => {
  const task = initial.tasks[0]!
  render(<MemoryRouter><TaskRow task={task} compact /></MemoryRouter>)
  fireEvent.change(screen.getByLabelText(`Title for ${task.title}`), { target: { value: 'Inline rename' } })
  expect(useWorkspace.getState().tasks.find((t) => t.id === task.id)?.title).toBe('Inline rename')
  fireEvent.click(screen.getByRole('combobox', { name: `Status for ${task.title}` }))
  for (const status of ['Not started', 'In progress', 'In review', 'Blocked', 'Done']) expect(screen.getByRole('option', { name: status }).querySelector('.status-badge')).not.toBeNull()
})
test('concurrent independent fields merge, while overlapping edits and deletions retain a recovery draft', () => {
  const base = { id: 'task', title: 'Original', status: 'Not started' }
  expect(rebaseWrite(base, { ...base, title: 'Local title' }, { ...base, status: 'Done' })).toEqual({ conflicts: false, data: { id: 'task', title: 'Local title', status: 'Done' } })
  expect(rebaseWrite(base, { ...base, title: 'Local title' }, { ...base, title: 'Remote title' }).conflicts).toBe(true)
  expect(rebaseWrite(base, { ...base, title: 'Local title' }, { ...base, deletedAt: 'now' }).conflicts).toBe(true)
  expect(rebaseWrite(base, { ...base, title: 'Local title' }, null).conflicts).toBe(true)
})


test('opening screen defaults to Projects Progress and remembers a progress project', async () => {
  const { rememberWorkspace, workspaceStart } = await import('@/shell/landing')
  const progressProject = { ...initial.projects[0]!, id: 'nbc-bp03', workspace: 'team' as const, nbcBp03: true }
  expect(workspaceStart('guest', initial.projects)).toBe('/projects-progress')
  rememberWorkspace('account-a', { workspace: 'personal', projectId: 'mobile' })
  expect(workspaceStart('account-a', initial.projects)).toBe('/projects-progress')
  rememberWorkspace('account-a', { workspace: 'team', projectId: 'nbc-bp03' })
  expect(workspaceStart('account-a', [...initial.projects, progressProject])).toBe('/projects-progress/nbc-bp03/overview')
  expect(workspaceStart('account-b', [])).toBe('/projects-progress')
})

test('sidebar shows live project progress and remembers collapsible groups', () => {
  const project = { ...fixtureProject, id: 'nbc-bp02', name: 'NBC BP02 – Pan Pacific Hotel', progress: 0.81 }
  useWorkspace.setState({ ...initial, projects: [project] })
  render(<MemoryRouter initialEntries={['/projects-progress/nbc-bp02/activities']}><SidebarContent /></MemoryRouter>)
  expect(screen.getByText('81%')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Project Progress' })).toHaveAttribute('aria-current', 'page')
  const toggle = screen.getByRole('button', { name: 'Collapse NBC BP02 – Pan Pacific Hotel' })
  fireEvent.click(toggle)
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(JSON.parse(localStorage.getItem('kw-sidebar-expanded-projects')!)).toEqual([])
  fireEvent.click(toggle)
  expect(toggle).toHaveAttribute('aria-expanded', 'true')
})
