import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, test } from 'vitest'
import { calculate } from '../progress'
import { fixtureActivities } from '../test-fixture'
import PhoneProgress from './PhoneProgress'

function show(initialEntry = '/projects-progress/nbc-bp03/activities') {
  const activities = fixtureActivities()
  const live = calculate(activities)
  const baseline = new Map(activities.map((a) => [a.id, a.id === 'nbc:1.6.1.2' ? 0 : a.progress]))
  const before = calculate(activities, baseline)
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/projects-progress/:id/activities"
          element={<PhoneProgress projectId="nbc-bp03" activities={activities} rollups={{ live, before }} />}
        />
      </Routes>
    </MemoryRouter>,
  )
}

test('drills from top level to an activity', () => {
  show()
  const list = screen.getByRole('list', { name: 'Activities' })
  const rows = within(list).getAllByRole('listitem')
  expect(rows).toHaveLength(1)
  expect(rows[0]!.textContent).toContain('%')

  fireEvent.click(within(rows[0]!).getByRole('button'))
  const trail = screen.getByRole('navigation', { name: 'Path' })
  expect(trail.textContent).toContain('Test area')

  const leafBtn = screen.getByRole('button', { name: /Install board/ })
  fireEvent.click(leafBtn)

  const dialog = screen.getByRole('dialog')
  expect(dialog.textContent).toContain('Previous week %')
  expect(dialog.textContent).toContain('This week %')
})

test('unknown at shows the top level', () => {
  show('/projects-progress/nbc-bp03/activities?at=nope')
  const list = screen.getByRole('list', { name: 'Activities' })
  expect(within(list).getByRole('button', { name: /Test area/ })).toBeTruthy()
})

test('wbs param opens at parent with activity sheet open', () => {
  show('/projects-progress/nbc-bp03/activities?wbs=1.6.1.2')
  const trail = screen.getByRole('navigation', { name: 'Path', hidden: true })
  expect(trail.textContent).toContain('Test area')
  const dialog = screen.getByRole('dialog')
  expect(dialog.textContent).toContain('Install board')
  expect(dialog.textContent).toContain('Previous week %')
})
