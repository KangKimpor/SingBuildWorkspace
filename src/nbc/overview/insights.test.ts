import { expect, test } from 'vitest'
import { fixtureActivities } from '../test-fixture'
import { submissionId } from '../submissions'
import type { NbcSubmission } from '../types'
import { attentionItems } from './insights'

const sub = (handler: 'Tola' | 'Sitha', week: string, entries: NbcSubmission['entries'], status: NbcSubmission['status'] = 'confirmed'): NbcSubmission =>
  ({ id: submissionId('nbc-bp03', week, handler), projectId: 'nbc-bp03', weekStart: week, handler, status, confirmedAt: status === 'confirmed' ? `${week}T08:00:00Z` : null, confirmedBy: 'a', late: false, note: '', entries, updatedAt: '' })
const input = { projectId: 'nbc-bp03', today: '2026-10-28', now: Date.parse('2026-10-28T03:00:00Z') }

test('handlers who have not confirmed this week are listed, and turn red at Saturday midnight', () => {
  const activities = fixtureActivities()
  const soon = attentionItems({ ...input, activities, submissions: [] })
  expect(soon[0]).toMatchObject({ id: 'missing', tone: 'amber' })
  expect(soon[0]!.title).toBe('Tola has not updated')
  const late = attentionItems({ ...input, now: Date.parse('2026-10-30T17:00:00Z'), activities, submissions: [] })
  expect(late[0]).toMatchObject({ tone: 'red', title: 'Tola has not updated', impact: 'overdue' })
})

test('a confirmed update that lowers progress is flagged with its remark and weighted impact', () => {
  const a = fixtureActivities().find((x) => x.wbs === '1.6.1.2')!
  const items = attentionItems({ ...input, activities: fixtureActivities(), submissions: [sub('Tola', '2026-10-26', [{ activityId: a.id, previous: .25, progress: .1, remark: 'Rework after inspection' }])] })
  const lowered = items.find((i) => i.id.startsWith('lowered'))!
  expect(lowered.title).toBe('1.6.1.2 Install board lowered 25% → 10%')
  expect(lowered.detail).toBe('Tola · Rework after inspection')
  expect(lowered.impact).toBe('−11.25% overall')
})

test('in-progress work with no change for two weeks is reported, never-updated work is not', () => {
  const activities = fixtureActivities(), a = activities.find((x) => x.wbs === '1.6.1.2')!
  expect(attentionItems({ ...input, activities, submissions: [] }).some((i) => i.id.startsWith('stalled'))).toBe(false)
  a.history = [{ id: 'h', at: '2026-10-05T00:00:00Z', editor: 'x', previous: 0, progress: .25, remark: '', handler: 'Tola' }]
  const stalled = attentionItems({ ...input, activities, submissions: [] }).find((i) => i.id.startsWith('stalled'))!
  expect(stalled.title).toBe('1.6.1.2 Install board has not moved for 3 weeks')
})
