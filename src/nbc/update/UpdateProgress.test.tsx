import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { emptyContent, useWorkspace } from '@/data'
import { fixtureActivities, fixtureProject } from '../test-fixture'
import UpdateProgress from './UpdateProgress'

function load(patch?: (a: ReturnType<typeof fixtureActivities>) => void) {
  const activities = fixtureActivities(); patch?.(activities)
  useWorkspace.setState({ ...structuredClone(emptyContent), scope: 'guest', projects: [fixtureProject], nbc_activities: activities })
}
beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-27T07:05:00Z')); load() })
afterEach(() => vi.useRealTimers())
function Screen({ handler = 'Tola' }: { handler?: string | null }) {
  const activities = useWorkspace((s) => s.nbc_activities!), submissions = useWorkspace((s) => s.nbc_submissions ?? [])
  return <MemoryRouter initialEntries={[handler ? `/update?handler=${handler}` : '/update']}><UpdateProgress projectId={fixtureProject.id} activities={activities} submissions={submissions}/></MemoryRouter>
}
// Sitha's only fixture activity is finished, which would lock the handler; a second, unfinished one keeps the update open.
const withOpenSithaWork = (a: ReturnType<typeof fixtureActivities>) => { a.push({ ...a[1]!, id: 'nbc:1.6.1.3', wbs: '1.6.1.3', name: 'Extra', progress: .2, baseline: .2, order: 4, relativeWeight: 0, globalWeight: 0 }) }
const wbsOrder = () => [...document.querySelectorAll('tbody tr[data-wbs]')].map((r) => r.getAttribute('data-wbs'))
const value = (wbs: string) => screen.getByLabelText(`This week % for ${wbs}`) as HTMLInputElement

test('the first autosave keeps the confirmation sheet open and the active field mounted', async () => {
  render(<Screen/>)
  const input = value('1.6.1.2')
  fireEvent.change(input, { target: { value: '45.25' } })
  fireEvent.click(screen.getByRole('button', { name: 'Confirm update' }))
  await act(async () => { await vi.advanceTimersByTimeAsync(450) })
  expect(useWorkspace.getState().nbc_submissions).toHaveLength(1)
  expect(screen.getByRole('dialog', { name: 'Confirm update' })).toBeInTheDocument()
  expect(value('1.6.1.2')).toBe(input)
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(input).toHaveValue('45.25')
})

test('expanding and collapsing the editor preserves typed progress and remarks', () => {
  render(<Screen/>)
  fireEvent.change(value('1.6.1.2'), { target: { value: '45' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add remark for 1.6.1.2' }))
  fireEvent.change(screen.getByLabelText('Remark for 1.6.1.2'), { target: { value: 'Inspection rework' } })
  const editor = screen.getByRole('region', { name: 'Weekly progress update' })
  fireEvent.click(screen.getByRole('button', { name: 'Expand editor' }))
  expect(editor).toHaveAttribute('data-expanded', 'true')
  expect(value('1.6.1.2')).toHaveValue('45')
  fireEvent.click(screen.getByRole('button', { name: 'Collapse editor' }))
  expect(editor).toHaveAttribute('data-expanded', 'false')
  expect(screen.getByLabelText('Remark for 1.6.1.2')).toHaveValue('Inspection rework')
})

test('shows the handler leaves under their ancestor groups', () => {
  render(<Screen/>)
  expect(wbsOrder()).toEqual(['1.6.1', '1.6.1.2'])
  expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['WBS', 'Description', 'Previous week %', 'This week %', 'Remark'])
})

test('only the current week is available', () => {
  render(<Screen/>)
  expect(screen.queryByRole('button', { name: 'Last week' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'This week' })).toBeNull()
  expect(screen.queryByText('This week', {exact:true})).toBeNull()
})

test('invalid text keeps its group expanded and visible when the group is collapsed', () => {
  render(<Screen/>)
  fireEvent.change(value('1.6.1.2'), { target: { value: 'bad' } })
  fireEvent.click(screen.getByRole('button', { name: 'Collapse 1.6.1' }))
  expect(value('1.6.1.2').value).toBe('bad'); expect(value('1.6.1.2').getAttribute('aria-invalid')).toBe('true')
})

test('Needs update hides finished rows but never a row that was edited or is changed', () => {
  load(withOpenSithaWork)
  render(<Screen handler="Sitha"/>)
  expect(wbsOrder()).toEqual(['1.6.1', '1.6.1.3'])
  fireEvent.click(screen.getByRole('button', { name: /^All/ }))
  expect(wbsOrder()).toContain('1.6.1.1')
  fireEvent.change(value('1.6.1.1'), { target: { value: '90' } })
  fireEvent.change(value('1.6.1.1'), { target: { value: '100' } })
  fireEvent.click(screen.getByRole('button', { name: /^Needs update/ }))
  expect(wbsOrder()).toContain('1.6.1.1')
})

test('the Changed filter lists only rows that differ from last week', () => {
  render(<Screen/>)
  expect(wbsOrder()).toEqual(['1.6.1', '1.6.1.2'])
  fireEvent.click(screen.getByRole('button', { name: /^Changed/ }))
  expect(screen.getByText(/No changes yet/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /^All/ }))
  fireEvent.change(value('1.6.1.2'), { target: { value: '65' } })
  fireEvent.click(screen.getByRole('button', { name: /^Changed/ }))
  expect(wbsOrder()).toEqual(['1.6.1', '1.6.1.2'])
})

test('a handler whose activities are all at 100% is locked out of the update', () => {
  render(<Screen handler="Sitha"/>)
  expect(screen.getByText('Sitha is complete')).toBeTruthy()
  expect(document.querySelector('tbody tr[data-wbs]')).toBeNull()
})

test('people type percentages themselves: there are no preset chips', () => {
  render(<Screen/>)
  fireEvent.focus(value('1.6.1.2'))
  expect(screen.queryByRole('button', { name: /^Set 1\.6\.1\.2 to/ })).toBeNull()
  fireEvent.change(value('1.6.1.2'), { target: { value: '50' } })
  expect(value('1.6.1.2').value).toBe('50')
})

test('asks who is updating first and only opens the editor after Continue', () => {
  render(<Screen handler={null}/>)
  expect(screen.getByRole('heading', { name: 'Who is updating?' })).toBeTruthy()
  expect(screen.queryByLabelText('This week % for 1.6.1.2')).toBeNull()
  expect((screen.getByRole('button', { name: 'Choose a handler' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: /^Tola/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Continue as Tola' }))
  expect(value('1.6.1.2')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /^Change handler/ }))
  expect(screen.getByRole('heading', { name: 'Who is updating?' })).toBeTruthy()
})

test('the search row shows the Friday 11:59 PM deadline while the week stays Monday to Sunday', () => {
  render(<Screen/>)
  expect(screen.getByTitle('Due Fri 11:59 PM · 3d left').textContent).toBe('Due Fri 11:59 PM · 3d left')
  expect(screen.queryByRole('heading', { name: 'Update Progress' })).toBeNull()
  expect(screen.queryByText(/^Tola · 26 Oct – 1 Nov/)).toBeNull()
})

test('after the deadline the header does not show the late banner and the sheet repeats it', () => {
  vi.setSystemTime(new Date('2026-10-31T07:00:00Z'))
  render(<Screen/>)
  expect(screen.queryByText(/Deadline passed Friday 11:59 PM/)).toBeNull()
  fireEvent.change(value('1.6.1.2'), { target: { value: '65' } })
  fireEvent.click(screen.getByRole('button', { name: 'Confirm update' }))
  expect(within(screen.getByRole('dialog', { name: 'Confirm update' })).getByText('Late')).toBeTruthy()
})

test('lowering a value opens the confirm sheet without asking for a remark', () => {
  render(<Screen/>)
  fireEvent.change(value('1.6.1.2'), { target: { value: '10' } })
  expect(screen.queryByText(/A remark is required/)).toBeNull()
  expect(screen.queryByLabelText('Remark for 1.6.1.2')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Confirm update' }))
  expect(screen.getByRole('dialog', { name: 'Confirm update' })).toBeTruthy()
})

test('an invalid value blocks the confirm sheet and names the fix', () => {
  render(<Screen/>)
  fireEvent.change(value('1.6.1.2'), { target: { value: 'abc' } })
  fireEvent.click(screen.getByRole('button', { name: /^Confirm/ }))
  expect(screen.getByText('Enter 0 to 100')).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('the sheet can list every updated task with its old and new percentage, then confirms and locks the table', async () => {
  render(<Screen/>)
  fireEvent.change(value('1.6.1.2'), { target: { value: '65' } })
  expect(screen.getByText(/1 changed/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Confirm update' }))
  const sheet = screen.getByRole('dialog', { name: 'Confirm update' })
  expect(within(sheet).queryByRole('list')).toBeNull()
  fireEvent.click(within(sheet).getByRole('switch'))
  expect(within(within(sheet).getByRole('list', { name: 'Updated tasks' })).getByText(/25\.0% → 65\.0%/)).toBeTruthy()
  fireEvent.change(within(sheet).getByLabelText(/Weekly note/), { target: { value: 'Crane done' } })
  await act(async () => { fireEvent.click(within(sheet).getByRole('button', { name: 'Confirm' })); await vi.advanceTimersByTimeAsync(10) })
  expect(screen.getByText(/^Confirmed /)).toBeTruthy()
  expect(screen.queryByLabelText('This week % for 1.6.1.2')).toBeNull()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(within(screen.getByRole('group', { name: 'Update actions' })).getByRole('button', { name: 'Edit' })).toBeTruthy()
})

test('past-week links always open the current week', () => {
  const activities = useWorkspace.getState().nbc_activities!
  render(<MemoryRouter initialEntries={['/update?handler=Tola&week=2026-10-18']}><UpdateProgress projectId={fixtureProject.id} activities={activities} submissions={[]}/></MemoryRouter>)
  expect(screen.queryByText(/editing last week/)).toBeNull()
  expect(screen.getAllByText(/25 Oct – 31 Oct/)).toBeTruthy()
  expect(value('1.6.1.2')).toBeTruthy()
})
