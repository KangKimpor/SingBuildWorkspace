import { createElement, type ReactNode } from 'react'
import { MemoryRouter, Outlet, useLocation } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pageTree, useWorkspace } from '@/data'

const initial = useWorkspace.getState()
beforeEach(() => {
  useWorkspace.setState(initial)
  localStorage.clear()
  vi.restoreAllMocks()
})
describe('local workspace', () => {
  it('reorders board cards and gives tasks a valid project in an empty account', () => {
    useWorkspace.setState({tasks:[], projects:[], pages:[]})
    const first = useWorkspace.getState().addTask({title:'First',projectId:'missing'})
    const second = useWorkspace.getState().addTask({title:'Second',projectId:'missing'})
    const state = useWorkspace.getState()
    expect(state.projects).toHaveLength(1)
    expect(state.tasks.every(t=>t.projectId === state.projects[0]?.id)).toBe(true)
    state.moveTask(second,'Not started',first)
    expect(useWorkspace.getState().tasks.find(t=>t.id===second)?.position).toBe(0)
    expect(useWorkspace.getState().tasks.find(t=>t.id===first)?.position).toBe(1)
  })
  it('creates a child page and keeps the saved tree consistent through trash and restore', () => {
    const root = useWorkspace.getState().addPage('Parent')
    const child = useWorkspace.getState().addPage('Child', root)
    expect(
      pageTree(useWorkspace.getState().pages).find((p) => p.id === root)
        ?.children[0]?.id,
    ).toBe(child)
    useWorkspace
      .getState()
      .updatePage(root, { deletedAt: new Date().toISOString() })
    expect(
      pageTree(useWorkspace.getState().pages).some((p) => p.id === root),
    ).toBe(false)
    useWorkspace.getState().updatePage(root, { deletedAt: null })
    expect(
      pageTree(useWorkspace.getState().pages).find((p) => p.id === root)
        ?.children,
    ).toHaveLength(1)
    expect(
      JSON.parse(localStorage.getItem('kw-workspace-v1')!).pages,
    ).toHaveLength(initial.pages.length + 2)
  })
  it('updates a task in place', () => {
    const id = useWorkspace
      .getState()
      .addTask({ title: '  New task  ', projectId: 'website' })
    useWorkspace.getState().updateTask(id, { status: 'Done' })
    expect(
      useWorkspace.getState().tasks.find((t) => t.id === id),
    ).toMatchObject({ title: 'New task', status: 'Done' })
    expect(useWorkspace.getState().tasks.filter((t) => t.id === id)).toHaveLength(1)
  })
  it('keeps edits in memory and reports a storage failure', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Quota exceeded')
    })
    useWorkspace.getState().setScratchpad('Do not lose this thought')
    expect(useWorkspace.getState().scratchpad).toBe('Do not lose this thought')
    expect(useWorkspace.getState().storageError).toBe(true)
  })
  it('ignores retired calendar data in stored content', async () => {
    const page = { id: 'kept-page', title: 'Kept page', parentId: null, icon: 'note', isFavorite: false, blocks: [], deletedAt: null }
    const task = { id: 'kept-task', title: 'Kept task', status: 'Not started', priority: 'Low', projectId: 'website', due: '2026-11-20', notes: '', subtasks: [] }
    localStorage.setItem('kw-workspace-v1', JSON.stringify({ pages: [page], tasks: [task], projects: [], scratchpad: '', taskViews: [], events: [{ id: 'e1', title: 'Old' }], calendarPreferences: { weekStart: 1, hour12: false } }))
    vi.resetModules()
    const { useWorkspace: fresh } = await import('@/data')
    const state = fresh.getState()
    expect(state.pages).toEqual([page])
    expect(state.tasks).toEqual([task])
    expect('events' in state).toBe(false)
    expect('calendarPreferences' in state).toBe(false)
  })
  it('no calendar route', async () => {
    vi.resetModules()
    vi.doMock('@/components/AuthGate', () => ({ AuthGate: ({ children }: { children: ReactNode }) => children }))
    vi.doMock('@/shell/AppShell', () => ({ AppShell: () => createElement(Outlet) }))
    vi.doMock('@/pages/Projects', () => ({ default: () => null }))
    const { App } = await import('@/App')
    function Where() { return createElement('output', { 'data-testid': 'path' }, useLocation().pathname) }
    render(createElement(MemoryRouter, { initialEntries: ['/calendar/day/today'] }, createElement(App), createElement(Where)))
    await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/projects-progress'))
  })
})
