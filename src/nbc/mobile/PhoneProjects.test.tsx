import { render, renderHook, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { emptyContent, useWorkspace } from '@/data'
import { usePhoneHeaderState } from '@/shell/phoneHeader'
import { fixtureActivities, fixtureProject } from '../test-fixture'
import PhoneProjects, { shortName } from './PhoneProjects'

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-28T03:00:00Z'))
  useWorkspace.setState({ ...structuredClone(emptyContent), scope: 'guest', projects: [fixtureProject], nbc_activities: fixtureActivities() })
})
afterEach(() => vi.useRealTimers())

test('shortName', () => {
  expect(shortName('NBC BP02 – Pan Pacific Hotel')).toBe('NBC BP02')
  expect(shortName('Website')).toBe('Website')
})

test('lists progress projects with their percent', () => {
  const header = renderHook(() => usePhoneHeaderState())
  render(<MemoryRouter><PhoneProjects/></MemoryRouter>)
  const card = screen.getByRole('link', { name: /NBC BP03/ })
  expect(card.getAttribute('href')).toBe('/projects-progress/nbc-bp03/overview')
  expect(card.textContent).toMatch(/43\.75%/)
  expect(card.textContent).toContain('Pan Pacific Hotel')
  expect(card.textContent).toMatch(/behind plan/)
  expect(header.result.current).toEqual({ title: 'Progress' })
})
