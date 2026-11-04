import { expect, test } from 'vitest'
import { deadlineNote } from './deadline'

const week = '2026-10-26'
test('counts days, then hours, then flips to late at Saturday midnight in Phnom Penh', () => {
  expect(deadlineNote(week, Date.parse('2026-10-27T07:05:00Z'))).toMatchObject({ text: 'Due Fri 11:59 PM · 3d left', tone: 'calm', late: false })
  expect(deadlineNote(week, Date.parse('2026-10-30T09:00:00Z'))).toMatchObject({ text: 'Due Fri 11:59 PM · 8h left', tone: 'soon' })
  expect(deadlineNote(week, Date.parse('2026-10-30T16:30:00Z')).text).toBe('Due Fri 11:59 PM · <1h left')
  expect(deadlineNote(week, Date.parse('2026-10-30T17:00:00Z'))).toMatchObject({ tone: 'late', late: true })
  expect(deadlineNote(week, Date.parse('2026-11-01T12:00:00Z')).late).toBe(true)
})
