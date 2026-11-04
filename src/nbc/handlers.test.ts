import { expect, test } from 'vitest'
import { activityHandlers } from './handlers'
import { fixtureActivities } from './test-fixture'

test('shows each group’s descendant handlers without assigning its rollup', () => {
  const activities = fixtureActivities(), group = activities[0]!
  expect(activityHandlers(group, activities)).toBe('Sitha, Tola')
  expect(group.handler).toBe('')
  expect(activityHandlers(activities[1]!, activities)).toBe('Sitha')
  activities[2]!.handler = 'Sitha'
  expect(activityHandlers(group, activities)).toBe('Sitha')
  activities[2]!.handler = ''
  expect(activityHandlers(group, activities)).toBe('Sitha, Unassigned')
  expect(activityHandlers(group, [{ ...activities[2]!, wbs: '1.6.10.2' }])).toBe('Unassigned')
})
