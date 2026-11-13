import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { fixtureActivities, fixtureProject } from '../test-fixture'
import Overview from './Overview'

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-28T03:00:00Z')) })
afterEach(() => vi.useRealTimers())
const show = () => render(<MemoryRouter><Overview project={fixtureProject} activities={fixtureActivities()} submissions={[]} summaries={[]} baseline={new Map()}/></MemoryRouter>)

test('headline numbers compare actual progress with the contract plan and deadline', () => {
  show()
  const kpis = within(screen.getByRole('region', { name: 'Project snapshot' }))
  expect(kpis.getByText('Overall progress')).toBeTruthy()
  expect(kpis.getByText('20 Jun 2026')).toBeTruthy()
  expect(kpis.getByText('130 days overdue')).toBeTruthy()
  expect(kpis.getByText(/behind/)).toBeTruthy()
  expect(kpis.getByText('Plan: 100.00% by now')).toBeTruthy()
  expect(kpis.getByText('0 of 6 handlers updated this week')).toBeTruthy()
  expect(kpis.getByText('2d left')).toBeTruthy()
})

test('attention lists handlers who have not updated', () => {
  show()
  expect(screen.queryByText('Forecast')).toBeNull()
  const attention = within(screen.getByRole('region', { name: 'Needs attention' }))
  expect(attention.getByText('Tola has not updated')).toBeTruthy()
  expect(attention.getByRole('link', { name: 'Open' }).getAttribute('href')).toBe('/projects-progress/nbc-bp03/update')
})

test('the breakdown groups by floor or work area only', () => {
  show()
  const seg = within(screen.getByRole('group', { name: 'Breakdown grouping' }))
  expect(seg.getAllByRole('button').map((button) => button.textContent)).toEqual(['Floor', 'Work area'])
  expect(screen.queryByRole('button', { name: 'Trade' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Heatmap' })).toBeNull()
  fireEvent.click(seg.getByRole('button', { name: 'Work area' }))
  expect(screen.getByRole('region', { name: 'Work area' })).toBeTruthy()
})

describe('phone', () => {
  const desktop = window.matchMedia
  beforeEach(() => { window.matchMedia = (query: string) => ({ ...desktop(query), matches: query === '(max-width: 767px)' }) })
  afterEach(() => { window.matchMedia = desktop })

  test('shows KPIs and attention, sections collapsed', () => {
    show()
    const kpis = within(screen.getByRole('region', { name: 'Project snapshot' }))
    for (const label of ['Overall progress', 'Versus plan', 'Completion deadline', 'Weekly reporting']) expect(kpis.getByText(label)).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Needs attention' })).toBeTruthy()
    for (const name of ['Progress curve', 'Handler contributions', 'Completion breakdown']) expect(screen.getByRole('button', { name: new RegExp(`^${name}`) }).getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByRole('button', { name: /^Progress curve/ }).textContent).toContain('43.75%')
    expect(screen.queryByRole('region', { name: 'Handler updates' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Overview' })).toBeNull()
  })

  test('breakdown shows five then all', () => {
    const base = fixtureActivities(), leaf = base[2]!
    const floors = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7']
    const activities = [base[0]!, ...floors.map((floor, i) => ({ ...leaf, id: `nbc:floor-${i}`, wbs: `1.6.1.${i + 2}`, location: floor, progress: i / 10, globalWeight: 1 / 7, relativeWeight: 1 / 7 }))]
    render(<MemoryRouter><Overview project={fixtureProject} activities={activities} submissions={[]} summaries={[]} baseline={new Map()}/></MemoryRouter>)
    const toggle = screen.getByRole('button', { name: /^Completion breakdown/ })
    expect(toggle.textContent).toContain('L1')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    const rows = () => within(screen.getByRole('region', { name: 'Floor / location' })).getAllByRole('listitem')
    expect(rows()).toHaveLength(5)
    fireEvent.click(screen.getByRole('button', { name: 'Show all 7' }))
    expect(rows()).toHaveLength(7)
  })
})

