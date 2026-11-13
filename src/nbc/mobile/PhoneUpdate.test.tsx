import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { emptyContent, useWorkspace } from '@/data'
import { fixtureActivities, fixtureProject } from '../test-fixture'
import type { NbcActivity } from '../types'
import UpdateProgress from '../update/UpdateProgress'
import PhoneUpdate from './PhoneUpdate'

function load(patch?: (a: NbcActivity[]) => void) {
  const activities = fixtureActivities()
  patch?.(activities)
  useWorkspace.setState({
    ...structuredClone(emptyContent),
    scope: 'guest',
    projects: [fixtureProject],
    nbc_activities: activities,
  })
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-27T07:05:00Z'))
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  load()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

function Screen({ initialEntry = '/projects-progress/nbc-bp03/update', desktop = false }: { initialEntry?: string; desktop?: boolean }) {
  const activities = useWorkspace((s) => s.nbc_activities!)
  const submissions = useWorkspace((s) => s.nbc_submissions ?? [])
  return (
    <MemoryRouter initialEntries={[initialEntry]}>
      {desktop
        ? <UpdateProgress projectId={fixtureProject.id} activities={activities} submissions={submissions} />
        : <PhoneUpdate projectId={fixtureProject.id} activities={activities} submissions={submissions} />}
    </MemoryRouter>
  )
}

test('pick handler, change a value, confirm', async () => {
  render(<Screen />)
  expect(screen.getByRole('heading', { name: 'Who is updating?' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /^Tola/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Continue as Tola' }))

  const input = screen.getByLabelText('This week % for 1.6.1.2') as HTMLInputElement
  fireEvent.change(input, { target: { value: '50' } })

  const bar = screen.getByRole('group', { name: 'Update actions' })
  expect(bar.textContent).toContain('1 changed')

  fireEvent.click(within(bar).getByRole('button', { name: 'Confirm update' }))
  const sheet = screen.getByRole('dialog', { name: 'Confirm update' })
  fireEvent.click(within(sheet).getByRole('switch'))
  const list = within(sheet).getByRole('list', { name: 'Updated tasks' })
  expect(list.textContent).toContain('1.6.1.2')
  expect(list.textContent).toContain('Install board')
  expect(list.textContent).toContain('25.0% → 50.0%')

  await act(async () => {
    fireEvent.click(within(sheet).getByRole('button', { name: 'Confirm' }))
    await vi.advanceTimersByTimeAsync(10)
  })
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByRole('group', { name: 'Update actions' }).textContent).toContain('Confirmed')
})

test('draft survives a remount', () => {
  const view = render(<Screen initialEntry="/projects-progress/nbc-bp03/update?handler=Tola" />)
  const phoneInput = screen.getByLabelText('This week % for 1.6.1.2') as HTMLInputElement
  fireEvent.change(phoneInput, { target: { value: '55' } })
  view.unmount()

  render(<Screen initialEntry="/projects-progress/nbc-bp03/update?handler=Tola" desktop />)
  const desktopInput = screen.getByLabelText('This week % for 1.6.1.2') as HTMLInputElement
  expect(desktopInput.value).toBe('55')
})

test('shared cell: each handler sees and edits only their half', () => {
  load((acts) => {
    const base = acts[1]!
    acts.splice(0, acts.length,
      { ...base, id: 'f9', wbs: '9', name: 'Floor 9', parentId: null, editable: false, handler: '', progress: 0.5, baseline: 0.5, order: 1, roomList: ['R1'], roomLabels: ['Room R1'] },
      { ...base, id: 't1', wbs: '9.1', name: 'Wall', parentId: 'f9', editable: false, handler: '', progress: 0.5, baseline: 0.5, order: 2 },
      { ...base, id: 'h1', wbs: '9.1.1', name: 'R1', room: 'R1', parentId: 't1', editable: true, handler: 'Tola', progress: 0.4, baseline: 0.4, order: 3 },
      { ...base, id: 'h2', wbs: '9.1.2', name: 'R1', room: 'R1', coOf: 'h1', parentId: 't1', editable: true, handler: 'Sitha', progress: 0.6, baseline: 0.6, order: 4 },
    )
  })
  const view = render(<Screen initialEntry="/projects-progress/nbc-bp03/update?handler=Tola" />)
  expect(screen.getByLabelText('This week % for 9.1.1')).toBeTruthy()
  expect(screen.queryByLabelText('This week % for 9.1.2')).toBeNull()
  view.unmount()

  render(<Screen initialEntry="/projects-progress/nbc-bp03/update?handler=Sitha" />)
  expect(screen.getByLabelText('This week % for 9.1.2')).toBeTruthy()
  expect(screen.queryByLabelText('This week % for 9.1.1')).toBeNull()
})
