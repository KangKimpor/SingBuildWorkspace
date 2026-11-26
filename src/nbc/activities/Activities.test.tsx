import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test } from 'vitest'
import { emptyContent, useWorkspace } from '@/data'
import { fixtureActivities, fixtureProject } from '../test-fixture'
import Activities from './Activities'

beforeEach(() => {
  // jsdom has no layout; give elements a size so the virtualizer renders rows.
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 800 })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 1200 })
  localStorage.clear(); useWorkspace.setState({ ...structuredClone(emptyContent), scope: 'guest', projects: [fixtureProject], nbc_activities: fixtureActivities() }) })
function setup(query = '', view: 'activities' | 'issues' = 'activities') {
  const activities = fixtureActivities(), baseline = new Map(activities.map((a) => [a.id, a.progress]))
  render(<MemoryRouter initialEntries={[`/activities${query}`]}><Activities projectId={fixtureProject.id} activities={activities} baseline={baseline} view={view}/></MemoryRouter>)
}
const wbsOrder = () => [...document.querySelectorAll('tbody tr[data-wbs]')].map((r) => r.getAttribute('data-wbs'))

test('expanding Project Progress preserves the search and filtered rows', () => {
  setup()
  fireEvent.change(screen.getByLabelText('Search activity'), { target: { value: 'Install' } })
  const rows = wbsOrder()
  fireEvent.click(screen.getByRole('button', { name: 'Expand editor' }))
  expect(document.querySelector('.nbc-activities-page')).toHaveAttribute('data-expanded', 'true')
  expect(wbsOrder()).toEqual(rows)
  fireEvent.click(screen.getByRole('button', { name: 'Collapse editor' }))
  expect(screen.getByLabelText('Search activity')).toHaveValue('Install')
})

test('a handler filter keeps only that handler leaves with their ancestor groups', () => {
  setup('?handler=Tola')
  expect(wbsOrder()).toEqual(['1.6.1', '1.6.1.2'])
})

test('removes the table footer and Completion Distribution', () => {
  setup('?handler=Tola')
  expect(screen.queryByRole('region', {name:'Completion distribution'})).toBeNull()
  expect(document.querySelector('.nbc-table-footer')).toBeNull()
})

test('shows the workbook columns plus Handler, and no progress input', () => {
  setup()
  expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['WBS', 'Description', 'Previous week %', 'This week %', 'Remark', 'Handler'])
  expect(document.querySelectorAll('table input')).toHaveLength(0)
})

test('search matches WBS or name, and a group name brings its whole subtree', () => {
  setup()
  fireEvent.change(screen.getByLabelText('Search activity'), { target: { value: 'Install' } })
  expect(wbsOrder()).toEqual(['1.6.1', '1.6.1.2'])
  fireEvent.change(screen.getByLabelText('Search activity'), { target: { value: '1.6.1.1' } })
  expect(wbsOrder()).toEqual(['1.6.1', '1.6.1.1'])
  fireEvent.change(screen.getByLabelText('Search activity'), { target: { value: 'Test area' } })
  expect(wbsOrder()).toEqual(['1.6.1', '1.6.1.1', '1.6.1.2'])
})

test('the Unassigned filter is empty when every activity has a handler', () => {
  setup('?handler=Unassigned')
  expect(wbsOrder()).toEqual([])
})

test('the expand editor sits in the search row and the issues switcher is gone', () => {
  setup()
  const filters = document.querySelector('.nbc-filters')!
  const expand = within(filters as HTMLElement).getByRole('button', { name: 'Expand editor' })
  expect(expand.className).toContain('nbc-expand-editor')
  expect(document.querySelector('.nbc-activity-band')).toBeNull()
  expect(screen.queryByRole('link', { name: 'Issues' })).toBeNull()
  expect(screen.queryByRole('link', { name: 'Table' })).toBeNull()
})

test('issues search supports its shortcut, WBS search and a clearable empty state', () => {
  useWorkspace.getState().addTask({ title: 'Check ceiling', projectId: fixtureProject.id, nbcActivityId: 'nbc:1.6.1.2' })
  setup('', 'issues')
  const search = screen.getByRole('textbox', { name: 'Search issues or WBS' })
  fireEvent.keyDown(window, { key: '/' })
  expect(document.activeElement).toBe(search)
  fireEvent.change(search, { target: { value: '1.6.1.2' } })
  expect(screen.getByRole('textbox', { name: 'Title for Check ceiling' })).toBeTruthy()
  fireEvent.change(search, { target: { value: 'nothing matches' } })
  expect(screen.getByText('No matching issues')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
  expect(screen.getByRole('textbox', { name: 'Title for Check ceiling' })).toBeTruthy()
})

test('a new issue clears search and preserves the selected WBS link', () => {
  setup('?wbs=1.6.1.2', 'issues')
  fireEvent.change(screen.getByRole('textbox', { name: 'Search issues or WBS' }), { target: { value: 'no match' } })
  fireEvent.click(screen.getByRole('button', { name: 'New action' }))
  expect(screen.getByRole('textbox', { name: 'Title for New site action' })).toBeTruthy()
  expect(useWorkspace.getState().tasks[0]?.nbcActivityId).toBe('nbc:1.6.1.2')
  expect(screen.queryByText('No matching issues')).toBeNull()
})

test('activity names open nothing and handlers are shown in full, without a picker', () => {
  setup()
  expect(screen.queryByRole('button', { name: 'Install board' })).toBeNull()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByTitle('Sitha, Tola')).toBeVisible()
  expect(screen.queryByRole('button', { name: /Assign handler/ })).toBeNull()
})

test('the toolbar has no area or progress selectors, columns menu or more menu, and search shows its / shortcut like Update Progress', () => {
  setup()
  expect(screen.queryByLabelText('Work area')).toBeNull()
  expect(screen.queryByLabelText('Progress range')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Columns' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Activity tools' })).toBeNull()
  expect(screen.getByPlaceholderText('Search activity')).toBeTruthy()
  expect(document.querySelector('.search-field kbd')).toBeNull()
})

test('shared room rows show two handler profile avatars without 50/50 text', () => {
  const base = fixtureActivities()[0]!
  const floor = { ...base, id: 'f1', wbs: '1', name: 'Level 23', parentId: null, editable: false, globalWeight: 1, relativeWeight: 1 }
  const task = { ...base, id: 't1', wbs: '1.1', name: 'Wall framing', parentId: 'f1', editable: false, globalWeight: 1, relativeWeight: 1 }
  const first = { ...base, id: 'r1a', wbs: '1.1.1', name: 'Room 2301', room: '2301', parentId: 't1', editable: true, handler: 'Sitha' as const, progress: .4, globalWeight: .5, relativeWeight: .5 }
  const second = { ...base, id: 'r1b', wbs: '1.1.2', name: 'Room 2301', room: '2301', sharedWith: 'r1a', parentId: 't1', editable: true, handler: 'Kheng' as const, progress: .6, globalWeight: .5, relativeWeight: .5 }
  const activities = [floor, task, first, second]
  render(<MemoryRouter><Activities projectId="nbc-bp02" activities={activities} baseline={new Map(activities.map((a) => [a.id, a.progress]))} view="activities"/></MemoryRouter>)
  expect(screen.queryByText(/50\/50/)).toBeNull()
  const pair = document.querySelector('.nbc-handler-pair') as HTMLElement
  expect(pair).not.toBeNull()
  expect(pair.getAttribute('title')).toBe('Sitha, Kheng')
  const avatars = [...pair.querySelectorAll('.nbc-av')].map((el) => el.getAttribute('data-initials'))
  expect(avatars).toEqual(['S', 'K'])
})

test('with Changed this week on, the floor picker marks the floors that changed', () => {
  const base = fixtureActivities()[0]!
  const room = (id: string, wbs: string, parentId: string, progress: number) => ({ ...base, id, wbs, name: 'Room', room: '2301', parentId, editable: true, handler: 'Sitha' as const, progress, globalWeight: .5, relativeWeight: 1 })
  const level = (id: string, wbs: string, name: string) => ({ ...base, id, wbs, name, parentId: null, editable: false, globalWeight: .5, relativeWeight: 1 })
  const task = (id: string, wbs: string, parentId: string) => ({ ...base, id, wbs, name: 'Wall framing', parentId, editable: false, globalWeight: .5, relativeWeight: 1 })
  const activities = [level('f23', '1', 'Level 23'), task('t23', '1.1', 'f23'), room('r23', '1.1.1', 't23', .5), level('f22', '2', 'Level 22'), task('t22', '2.1', 'f22'), room('r22', '2.1.1', 't22', .2)]
  // Level 23 moved from 0.1 to 0.5 this week; Level 22 did not move.
  const baseline = new Map(activities.map((a) => [a.id, a.id === 'r23' ? .1 : a.progress]))
  render(<MemoryRouter><Activities projectId="nbc-bp02" activities={activities} baseline={baseline} view="activities"/></MemoryRouter>)
  expect(document.querySelector('.nbc-seg-chg')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Changed this week' }))
  expect(screen.getByRole('button', { name: 'Level 23, changed this week' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Level 22' })).toBeInTheDocument()
})
