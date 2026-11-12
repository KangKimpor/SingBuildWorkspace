import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
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

test('the breakdown can switch to a floor by trade heatmap whose cells open filtered activities', () => {
  show()
  fireEvent.click(screen.getByRole('button', { name: 'Heatmap' }))
  const cell = screen.getByRole('link', { name: /^GF, Test trade/ })
  expect(cell.getAttribute('href')).toContain('location=GF')
  expect(cell.getAttribute('href')).toContain('trade=Test+trade')
})

