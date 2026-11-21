import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { emptyContent, useWorkspace } from '@/data'
import { fixtureActivities, fixtureProject } from '@/nbc/test-fixture'
import NbcProject from '@/nbc/NbcProject'

const mocks = vi.hoisted(() => ({
  refreshCollections: vi.fn(async () => {}),
}))

vi.mock('@/data/sync', async () => ({
  ...await vi.importActual<typeof import('@/data/sync')>('@/data/sync'),
  refreshCollections: mocks.refreshCollections,
}))

afterEach(() => cleanup())

beforeEach(() => {
  mocks.refreshCollections.mockClear()
  const partial = fixtureActivities().filter((a) => a.parentId !== null)
  useWorkspace.setState({
    ...structuredClone(emptyContent),
    scope: 'account-a',
    sync: { kind: 'saved' },
    projects: [fixtureProject],
    nbc_activities: partial,
  })
})

test('NbcProject auto-reconciles once when calculate() fails on a partial local snapshot and offers manual reload', async () => {
  render(
    <MemoryRouter initialEntries={['/projects-progress/nbc-bp03/update']}>
      <NbcProject project={fixtureProject} view="update" />
    </MemoryRouter>,
  )

  expect(screen.getByText('Calculation needs attention. Progress editing is paused.')).toBeTruthy()
  await waitFor(() => {
    expect(mocks.refreshCollections).toHaveBeenCalledTimes(1)
    expect(mocks.refreshCollections).toHaveBeenCalledWith(['nbc_activities'], { full: true, projectId: 'nbc-bp03' })
  })

  const reload = screen.getByRole('button', { name: 'Reload from cloud' })
  fireEvent.click(reload)
  await waitFor(() => {
    expect(mocks.refreshCollections).toHaveBeenCalledTimes(2)
  })
})
