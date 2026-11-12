import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { calculate } from '../progress'
import { roomFloors } from '../rooms'
import type { NbcActivity } from '../types'
import { fixtureActivities } from '../test-fixture'
import { RoomMatrix } from './RoomMatrix'

const base = fixtureActivities()[1]!
const node = (wbs: string, parent: string | null, patch: Partial<NbcActivity>): NbcActivity => ({ ...base, id: `n:${wbs}`, wbs, name: `N ${wbs}`, parentId: parent ? `n:${parent}` : null, editable: false, relativeWeight: 1, globalWeight: 0, baseline: 0, progress: 0, history: [], ...patch })
const activities = [
  node('1', null, { name: 'Floor 9', order: 1, roomList: ['R1', 'R2', 'CRD'] }),
  node('1.1', '1', { name: 'Section', order: 2, item: 'A' }),
  node('1.1.1', '1.1', { name: 'Marble', order: 3 }),
  node('1.1.1.1', '1.1.1', { name: 'Marble — R1', order: 4, editable: true, room: 'R1', progress: 1, globalWeight: 0.5 }),
  node('1.1.1.2', '1.1.1', { name: 'Marble — R2', order: 5, editable: true, room: 'R2', progress: 0.25, globalWeight: 0.5 }),
]

test('one column per room, rooms keep their own percentage and missing rooms are not applicable', () => {
  const floor = roomFloors(activities)[0]!, { progress } = calculate(activities)
  const toggle = vi.fn()
  render(<RoomMatrix floor={floor} caption="Floor 9" collapsed={new Set()} onToggle={toggle} progress={progress} previous={progress} show={() => true} cell={(leaf) => <span>{`v ${leaf.room} ${leaf.progress}`}</span>}/>)
  expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Item', 'Description', 'Prev %', 'Now %', 'R1', 'R2', 'CRD'])
  expect(screen.getByText('v R1 1')).toBeTruthy()
  expect(screen.getByText('v R2 0.25')).toBeTruthy()
  expect(screen.getByLabelText('CRD: not applicable')).toBeTruthy()
  // Task row averages its rooms.
  expect(within(screen.getByText('Marble').closest('tr')!).getByText('62.5%', { selector: 'td[data-label="Now %"]' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Collapse Section' }))
  expect(toggle).toHaveBeenCalledWith('n:1.1')
})

test('area panels show the full area label in each column heading', () => {
  const labelled = activities.map((a) => a.wbs === '1' ? { ...a, name: 'ID', panel: 'ID' as const, roomList: ['R1', 'R2'], roomLabels: ['R1\nLobby', 'R2\nSuite'] } : a)
  const floor = roomFloors(labelled)[0]!, { progress } = calculate(labelled)
  render(<RoomMatrix floor={floor} caption="ID" collapsed={new Set()} onToggle={() => {}} progress={progress} previous={progress} show={() => true} cell={(leaf) => <span>{leaf.room}</span>}/>)
  expect(screen.getAllByRole('columnheader').slice(4).map((h) => h.textContent)).toEqual(['R1\nLobby', 'R2\nSuite'])
})
