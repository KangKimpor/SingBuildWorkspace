import type { NbcActivity } from './types'
export const fixtureProject = { id: 'nbc-bp03', name: 'NBC BP03 – Pan Pacific Hotel', workspace: 'team' as const, nbcBp03: true, color: 'blue' as const, description: 'Synthetic test project', target: '', progress: 0.4375, status: 'Active' as const }
export function fixtureActivities(): NbcActivity[] {
  const base = { projectId: 'nbc-bp03', description: 'Synthetic test activity', area: 'Test area', location: 'GF', trade: 'Test trade', handler: '', remark: '', history: [], duration: 1, boqValue: null, schedule: null, sourcePrevious: 0, sourceWeekly: 0 }
  return [
    { ...base, id: 'nbc:1.6.1', wbs: '1.6.1', name: 'Test area', parentId: null, editable: false, relativeWeight: 1, globalWeight: 1, baseline: 0.4375, progress: 0.4375, order: 1, boqValue: 80 },
    { ...base, id: 'nbc:1.6.1.1', wbs: '1.6.1.1', name: 'Survey', parentId: 'nbc:1.6.1', editable: true, relativeWeight: 0.25, globalWeight: 0.25, baseline: 1, progress: 1, handler: 'Sitha', order: 2 },
    { ...base, id: 'nbc:1.6.1.2', wbs: '1.6.1.2', name: 'Install board', parentId: 'nbc:1.6.1', editable: true, relativeWeight: 0.75, globalWeight: 0.75, baseline: 0.25, progress: 0.25, handler: 'Tola', order: 3 },
  ]
}
