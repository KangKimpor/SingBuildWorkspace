import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { emptyContent, useWorkspace } from '@/data'
import { fixtureActivities, fixtureProject } from '../test-fixture'
import type { NbcActivity } from '../types'
import UpdateProgress from './UpdateProgress'

// A small BP02-style floor: two tasks, each with a cell in rooms R1 and R2, all assigned to Tola.
const base = fixtureActivities()[1]!
const node = (wbs: string, parent: string | null, patch: Partial<NbcActivity>): NbcActivity => ({ ...base, id: `nbc:${wbs}`, wbs, name: `N ${wbs}`, parentId: parent ? `nbc:${parent}` : null, editable: false, relativeWeight: 1, globalWeight: 0, baseline: 0, progress: 0, handler: '', history: [], ...patch })
const cell = (wbs: string, parent: string, room: string, order: number) => node(wbs, parent, { name: room, room, order, editable: true, handler: 'Tola', relativeWeight: 0.5, globalWeight: 0.25, progress: 0.2, baseline: 0.2 })
const activities = [
  node('9', null, { name: 'Floor 9', order: 1, roomList: ['R1', 'R2'] }),
  node('9.1', '9', { name: 'Section', order: 2, relativeWeight: 1 }),
  node('9.1.1', '9.1', { name: 'Marble', order: 3, relativeWeight: 0.5 }),
  cell('9.1.1.1', '9.1.1', 'R1', 4), cell('9.1.1.2', '9.1.1', 'R2', 5),
  node('9.1.2', '9.1', { name: 'Paint', order: 6, relativeWeight: 0.5 }),
  cell('9.1.2.1', '9.1.2', 'R1', 7), cell('9.1.2.2', '9.1.2', 'R2', 8),
]

beforeEach(() => {
  localStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-27T07:05:00Z'))
  useWorkspace.setState({ ...structuredClone(emptyContent), scope: 'guest', projects: [fixtureProject], nbc_activities: structuredClone(activities) })
})
afterEach(() => vi.useRealTimers())

function Screen() {
  const list = useWorkspace((s) => s.nbc_activities!), submissions = useWorkspace((s) => s.nbc_submissions ?? [])
  return <MemoryRouter initialEntries={['/update?handler=Tola']}><UpdateProgress projectId={fixtureProject.id} activities={list} submissions={submissions}/></MemoryRouter>
}
const input = (wbs: string) => screen.getByLabelText(`This week % for ${wbs}`) as HTMLInputElement

test('memoized matrix rows keep every edit: a cell edited after another row changed does not undo it', async () => {
  render(<Screen/>)
  fireEvent.change(input('9.1.1.1'), { target: { value: '50' } })
  // The Paint row did not re-render for the first edit; its input must still write into the current draft.
  fireEvent.change(input('9.1.2.2'), { target: { value: '75' } })
  expect(input('9.1.1.1')).toHaveValue('50')
  expect(input('9.1.2.2')).toHaveValue('75')
  await act(async () => { await vi.advanceTimersByTimeAsync(450) })
  const saved = useWorkspace.getState().nbc_submissions![0]!.entries
  expect(saved.find((e) => e.activityId === 'nbc:9.1.1.1')!.progress).toBe(0.5)
  expect(saved.find((e) => e.activityId === 'nbc:9.1.2.2')!.progress).toBe(0.75)
  // Each task row's Now % follows its own cells: Marble (50 + 20) / 2, Paint (20 + 75) / 2.
  expect(input('9.1.1.1').closest('tr')!.querySelector('td[data-label="Now %"]')).toHaveTextContent('35.0%')
  expect(input('9.1.2.2').closest('tr')!.querySelector('td[data-label="Now %"]')).toHaveTextContent('47.5%')
})

test('Enter moves to the same room on the next task, with handlers from the latest render', async () => {
  render(<Screen/>)
  fireEvent.change(input('9.1.1.2'), { target: { value: '30' } })
  fireEvent.keyDown(input('9.1.1.2'), { key: 'Enter' })
  await act(async () => { await vi.advanceTimersByTimeAsync(50) })
  expect(document.activeElement).toBe(input('9.1.2.2'))
  // Escape restores the value the cell had when it was focused.
  fireEvent.focus(input('9.1.2.2'))
  fireEvent.change(input('9.1.2.2'), { target: { value: '99' } })
  fireEvent.keyDown(input('9.1.2.2'), { key: 'Escape' })
  expect(input('9.1.2.2')).toHaveValue('20')
  expect(input('9.1.1.2')).toHaveValue('30')
})
