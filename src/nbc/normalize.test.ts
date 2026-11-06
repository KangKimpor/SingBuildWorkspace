import { describe, expect, it } from 'vitest'
import { normalizeActivity } from './normalize'

// The shape scripts/nbc-bp02-rooms-extract.py stores for a BP02 room task once apply.sql has added the table's required keys.
const stored = {
  id: 'nbc-bp02:1.8.1.1.1.1.1.1', wbs: '1.8.1.1.1.1.1.1', parentId: 'nbc-bp02:1.8.1.1.1.1.1', projectId: 'nbc-bp02', order: 5,
  name: 'CSK4-2301', room: 'CSK4-2301', area: 'GUESTROOM - INTERIOR DESIGN (ID)', editable: true, handler: 'Sitha',
  progress: 0.4, baseline: 0.4, relativeWeight: 0.0769230769231, globalWeight: 0.000174825174825,
  history: [], remark: '', trade: '', location: '', updatedAt: '2026-11-06T00:00:00+00:00',
}

describe('normalizeActivity', () => {
  it('restores the fields a compact BP02 room task leaves out', () => {
    const row = normalizeActivity(stored as Record<string, unknown>)
    expect(row).toMatchObject({ description: '', sourceWeekly: 0, duration: null, boqValue: null, schedule: null, sourcePrevious: 0.4, baseline: 0.4 })
  })
  it('keeps values a row already carries', () => {
    const row = normalizeActivity({ ...stored, baseline: 0.1, sourcePrevious: 0.2, description: 'kept' } as Record<string, unknown>)
    expect(row).toMatchObject({ baseline: 0.1, sourcePrevious: 0.2, description: 'kept' })
  })
  it('leaves non-activity data alone', () => {
    const odd = { id: 'x' }
    expect(normalizeActivity(odd)).toBe(odd)
  })
})
