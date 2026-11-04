import { expect, test } from 'vitest'
import { fixtureActivities } from './test-fixture'
import { addDays, assertEditableWeek, canUpdate, sameDraftIntent, submissionId, transitionSubmission, weekDeadline, weekStart } from './submissions'
import type { SubmissionState } from './submissions'
import type { Handler, NbcSubmission } from './types'

const now = new Date('2026-10-27T07:05:00Z'), week = '2026-10-26'
function draft(handler: Handler, date = week, progress = .5): NbcSubmission {
  const a = fixtureActivities().find((a) => a.handler === handler)!
  return { id: submissionId('nbc-bp03', date, handler), projectId: 'nbc-bp03', weekStart: date, handler, status: 'draft', confirmedAt: null, confirmedBy: null, late: false, note: '', updatedAt: now.toISOString(), entries: [{ activityId: a.id, previous: a.progress, progress, remark: 'Site update' }] }
}
const initial = (): SubmissionState => ({ activities: fixtureActivities(), submissions: [draft('Tola')], summaries: [] })
test('Monday weeks, year boundaries, Phnom Penh midnight and Friday deadline', () => {
  expect(weekStart('2027-01-01')).toBe('2026-12-28')
  expect(weekStart('2026-11-01')).toBe(week)
  expect(weekStart('2026-11-02')).toBe('2026-11-02')
  expect(weekDeadline(week)).toBe(Date.parse('2026-10-30T17:00:00Z'))
  expect(weekDeadline('2026-11-02')).toBe(Date.parse('2026-11-06T17:00:00Z'))
  expect(() => weekStart('2026-02-30')).toThrow()
  expect(() => assertEditableWeek(addDays(week, -14), now)).toThrow('Only this week')
  expect(() => assertEditableWeek(addDays(week, 7), now)).toThrow()
  assertEditableWeek(addDays(week, -7), now)
})
test('confirming before Saturday midnight is on time, at the boundary or after is late, and Sunday is still this week', () => {
  const at = (iso: string) => transitionSubmission(initial(), initial().submissions[0]!.id, 'confirm', 'actor', new Date(iso)).submissions[0]!.late
  expect(at('2026-10-30T16:59:59.999Z')).toBe(false)
  expect(at('2026-10-30T17:00:00Z')).toBe(true)
  expect(at('2026-11-01T10:00:00Z')).toBe(true)
  expect(weekStart('2026-11-01')).toBe(week)
})
test('drafts stay separate; confirm, reopen, reconfirm, delete and audit are consistent', () => {
  const start = initial(), id = start.submissions[0]!.id
  expect(start.activities[2]!.progress).toBe(.25)
  let s = transitionSubmission(start, id, 'confirm', 'actor', now)
  expect(s.activities[2]!.progress).toBe(.5)
  expect(s.activities[2]!.history[0]!.editor).toBe('actor')
  expect(s.summaries.find((r) => r.weekStart === week)!.overall).toBeCloseTo(.625)
  s = transitionSubmission(s, id, 'reopen', 'actor', now)
  expect(s.activities[2]!.progress).toBe(.5)
  s.submissions[0]!.entries[0]!.progress = .75
  s = transitionSubmission(s, id, 'confirm', 'actor', now)
  expect(s.submissions[0]!.entries[0]!.previous).toBe(.25)
  s = transitionSubmission(s, id, 'delete', 'actor', now)
  expect(s.activities[2]!.progress).toBe(.25)
  expect(s.activities[2]!.history).toHaveLength(3)
})
test('undo is short-lived, restores values, and keeps the editable autosaved draft', () => {
  let s = initial(), id = s.submissions[0]!.id
  s = transitionSubmission(s, id, 'confirm', 'actor', now)
  expect(() => transitionSubmission(s, id, 'undo', 'other', now)).toThrow()
  expect(() => transitionSubmission(s, id, 'undo', 'actor', new Date(+now + 11000))).toThrow('expired')
  s = transitionSubmission(s, id, 'undo', 'actor', now)
  expect(s.activities[2]!.progress).toBe(.25)
  expect(s.submissions[0]!.entries[0]!.progress).toBe(.5)
  expect(s.submissions[0]!.status).toBe('draft')
})
test('editing/deleting last week rechains this week and freezes older summaries', () => {
  let s = initial(), last = draft('Tola', addDays(week, -7), .4)
  s.submissions = [last]
  s = transitionSubmission(s, last.id, 'confirm', 'actor', now)
  expect(s.submissions[0]!.late).toBe(true)
  s.submissions.push(draft('Tola', week, .8))
  const currentId = s.submissions[1]!.id
  s = transitionSubmission(s, currentId, 'confirm', 'actor', now)
  s.summaries.push({ id: 'frozen', projectId: 'nbc-bp03', weekStart: '2026-01-05', overall: .3, previous: .2, contributions: {}, updatedAt: 'unchanged' })
  s = transitionSubmission(s, last.id, 'reopen', 'actor', now)
  s.submissions[0]!.entries[0]!.progress = .6
  s = transitionSubmission(s, last.id, 'confirm', 'actor', now)
  expect(s.submissions.find((r) => r.id === currentId)!.entries[0]!.previous).toBe(.6)
  expect(s.activities[2]!.progress).toBe(.8)
  expect(s.summaries.find((r) => r.weekStart === addDays(week, -7))!.overall).toBeCloseTo(.7)
  s = transitionSubmission(s, last.id, 'delete', 'actor', now)
  expect(s.submissions[0]!.entries[0]!.previous).toBe(.25)
  expect(s.summaries.find((r) => r.id === 'frozen')!.updatedAt).toBe('unchanged')
  s.submissions[0]!.weekStart = '2026-01-05'
  for (const operation of ['confirm','reopen','delete','undo'] as const) expect(() => transitionSubmission(s, currentId, operation, 'actor', now)).toThrow('Only this week')
})
test('handlers may edit only their own activities; foreign activities are rejected', () => {
  let s = initial(), id = s.submissions[0]!.id
  expect(canUpdate(s.activities[2]!, 'Tola')).toBe(true)
  expect(canUpdate(s.activities[2]!, 'Sitha')).toBe(false)
  s = transitionSubmission(s, id, 'confirm', 'actor', now)
  s = transitionSubmission(s, id, 'reopen', 'actor', now)
  s.submissions[0]!.entries[0]!.activityId = 'nbc:1.6.1.1'
  expect(() => transitionSubmission(s, id, 'confirm', 'actor', now)).toThrow('only your own')
})

test('an activity assigned after the draft was saved joins as unchanged instead of blocking confirmation', () => {
  const start = initial(), id = start.submissions[0]!.id
  const late = { ...start.activities[2]!, id: 'nbc:1.6.1.9', wbs: '1.6.1.9', name: 'Late assignment', progress: .4, baseline: .4 }
  start.activities.push(late)
  const s = transitionSubmission(start, id, 'confirm', 'actor', now)
  expect(s.submissions[0]!.status).toBe('confirmed')
  expect(s.submissions[0]!.entries.find((e) => e.activityId === late.id)).toMatchObject({ previous: .4, progress: .4 })
  expect(s.activities.find((a) => a.id === late.id)!.progress).toBe(.4)
  expect(s.activities[2]!.progress).toBe(.5)
  // A later reopen keeps the backfilled row, so reconfirming cannot regress either.
  const again = transitionSubmission(s, id, 'reopen', 'actor', now)
  expect(again.submissions[0]!.entries.some((e) => e.activityId === late.id)).toBe(true)
  expect(() => transitionSubmission(again, id, 'confirm', 'actor', now)).not.toThrow()
})

test('a re-chained draft is the same intent, but changed values are not', () => {
  const s = initial(), local = s.submissions[0]!
  // The server rewrites previous/baseRevision/updatedAt for every draft whenever anyone confirms.
  const rechained = { ...local, updatedAt: '2026-10-27T09:00:00Z', entries: local.entries.map((e) => ({ ...e, previous: .2, baseRevision: '2026-10-27T09:00:00Z' })) }
  expect(sameDraftIntent(local, rechained)).toBe(true)
  expect(sameDraftIntent(local, { ...rechained, entries: rechained.entries.map((e) => ({ ...e, progress: .9 })) })).toBe(false)
  expect(sameDraftIntent(local, { ...rechained, note: 'Other device' })).toBe(false)
  expect(sameDraftIntent(local, { ...rechained, status: 'confirmed' })).toBe(false)
})

test('unconfirmed current drafts are re-chained and the late flag flips at Saturday midnight', () => {
  let s = initial(), last = draft('Tola', addDays(week, -7), .4)
  s.submissions.push(last)
  s = transitionSubmission(s, last.id, 'confirm', 'actor', now)
  expect(s.submissions[0]!.entries[0]!.previous).toBe(.4)
  let onTime = initial()
  onTime = transitionSubmission(onTime, onTime.submissions[0]!.id, 'confirm', 'actor', new Date('2026-10-30T16:59:59.999Z'))
  expect(onTime.submissions[0]!.late).toBe(false)
  const late = transitionSubmission(initial(), initial().submissions[0]!.id, 'confirm', 'actor', new Date('2026-10-30T17:00:00Z'))
  expect(late.submissions[0]!.late).toBe(true)
})
