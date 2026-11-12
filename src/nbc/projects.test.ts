import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { emptyContent, useWorkspace } from '@/data'
import { fixtureActivities, fixtureProject } from './test-fixture'
import { confirmUpdate, deleteUpdate, draftEntries, reopenUpdate, saveDraft } from './submission-actions'
import { calculate } from './progress'
import { BP04_PLAN, NBC_PLAN, plannedProgress, projectPlan } from './plan'
import { reportFilename, weeklyWorkbook } from './export/workbook'
import { strFromU8, unzipSync } from 'fflate'
import type { NbcActivity } from './types'

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-30T03:00:00Z')); localStorage.clear() })
afterEach(() => vi.useRealTimers())

test('both projects isolate drafts, confirm/reopen/delete, summaries and audit history', async () => {
  const bp04 = fixtureActivities().map(a => ({ ...a, id: a.id.replace('nbc:', 'nbc-bp04:'), parentId: a.parentId?.replace('nbc:', 'nbc-bp04:') ?? null, projectId: 'nbc-bp04' }))
  useWorkspace.setState({ ...structuredClone(emptyContent), scope: 'guest', projects: [fixtureProject, { ...fixtureProject, id: 'nbc-bp04' }], nbc_activities: [...fixtureActivities(), ...bp04] })
  const snapshot = (id: string) => JSON.stringify({ activities: useWorkspace.getState().nbc_activities?.filter(a => a.projectId === id), submissions: useWorkspace.getState().nbc_submissions?.filter(a => a.projectId === id), summaries: useWorkspace.getState().nbc_summaries?.filter(a => a.projectId === id) })
  for (const [id, other] of [['nbc-bp04', 'nbc-bp03'], ['nbc-bp03', 'nbc-bp04']]) {
    const untouched = snapshot(other!)
    const entries = draftEntries('2026-10-25', 'Tola', id).map(e => ({ ...e, progress: .6 }))
    saveDraft('2026-10-25', 'Tola', entries, '', id)
    await confirmUpdate('2026-10-25', 'Tola', id)
    expect(snapshot(other!)).toBe(untouched)
    await reopenUpdate('2026-10-25', 'Tola', id)
    await deleteUpdate('2026-10-25', 'Tola', id)
    expect(snapshot(other!)).toBe(untouched)
  }
  expect(() => draftEntries('2026-10-25', 'Tola', 'missing')).toThrow('not initialized')
  expect(() => saveDraft('2026-10-25', 'Tola', draftEntries('2026-10-25', 'Tola', 'nbc-bp03'), '', 'nbc-bp04')).toThrow('only your')
})

test('BP04 plan is independent and uses only the approved report dates/projected ratios', () => {
  expect(projectPlan('nbc-bp03')).toBe(NBC_PLAN)
  expect(projectPlan('nbc-bp04')).toBe(BP04_PLAN)
  expect(BP04_PLAN.commencement).toBe('2026-03-18')
  expect(BP04_PLAN.completion).toBe('2026-06-20')
  expect(BP04_PLAN.points).toHaveLength(33)
  expect(plannedProgress('2026-04-05', BP04_PLAN.points)).toBe(.09)
  expect(plannedProgress('2026-04-05', NBC_PLAN.points)).toBe(.3)
  expect(reportFilename('2026-10-25', 'nbc-bp04')).toContain('NBC-BP04-')
})

test.skipIf(!existsSync('.private/nbc-bp04/initial.json'))('private BP04 BOQ reconciles every parent, weights and export totals', () => {
  const source = JSON.parse(readFileSync('.private/nbc-bp04/initial.json', 'utf8')) as { activities: NbcActivity[]; reconciliation: { boqValue: number; workbookOverall: number } }
  const { reconciliation } = source, general = source.activities.find(a => a.wbs === 'GR&P')!
  // Same transformation as the nbc_remove_general_requirements migration: drop item 1 and rescale the rest to 100%.
  const scale = 1 / (1 - general.globalWeight)
  const activities = source.activities.filter(a => a !== general).map(a => ({ ...a, globalWeight: a.globalWeight * scale, relativeWeight: a.parentId ? a.relativeWeight : a.relativeWeight * scale }))
  const c = calculate(activities)
  expect(activities).toHaveLength(381); expect(c.leaves).toHaveLength(283)
  expect(c.overall).toBeCloseTo(reconciliation.workbookOverall * scale, 12)
  expect(c.leaves.reduce((s, a) => s + a.globalWeight, 0)).toBeCloseTo(1, 12)
  expect(activities.filter(a => !a.parentId).reduce((s, a) => s + (a.boqValue ?? 0), 0)).toBeCloseTo(reconciliation.boqValue - (general.boqValue ?? 0), 6)
  for (const a of activities) expect(c.progress.get(a.id)).toBeCloseTo(a.progress, 12)
  const template = new Uint8Array(readFileSync('.private/nbc-bp04/template.xlsx'))
  const output = unzipSync(weeklyWorkbook(template, activities, [], '2026-10-25').bytes)
  const doc = new DOMParser().parseFromString(strFromU8(output['xl/worksheets/sheet1.xml']!), 'application/xml')
  expect(doc.querySelector('c[r="N5"] v')?.textContent).toBe('0')
  const leaf = c.leaves.find(a => a.handler === 'Tola')!
  const edited = activities.map(a => a.id === leaf.id ? { ...a, progress: .5 } : a)
  expect(calculate(edited).overall).toBeCloseTo(leaf.globalWeight * .5, 14)
  const editedFiles = unzipSync(weeklyWorkbook(template, edited, [], '2026-10-25').bytes)
  const editedDoc = new DOMParser().parseFromString(strFromU8(editedFiles['xl/worksheets/sheet1.xml']!), 'application/xml')
  expect(Number(editedDoc.querySelector('c[r="N5"] v')?.textContent)).toBeCloseTo(leaf.globalWeight * .5, 14)
  expect(() => weeklyWorkbook(template, fixtureActivities(), [], '2026-10-25')).toThrow('do not match')
})

test('BP02 uses its own report plan and exports a distinct report name', () => {
  expect(projectPlan('nbc-bp02').commencement).toBe('2025-09-01')
  expect(reportFilename('2026-10-25', 'nbc-bp02')).toContain('NBC-BP02-')
})

test.skipIf(!existsSync('.private/nbc-bp02/initial.json'))('private BP02 BOQ reconciles every parent, weights and export totals', () => {
  const { activities, reconciliation } = JSON.parse(readFileSync('.private/nbc-bp02/initial.json', 'utf8')) as { activities: NbcActivity[]; reconciliation: { boqValue: number; workbookBoqOverall: number; nodes: number; editableEntries: number } }
  const c = calculate(activities)
  expect(activities).toHaveLength(reconciliation.nodes); expect(c.leaves).toHaveLength(reconciliation.editableEntries)
  expect(c.leaves.every(a => ['Sitha', 'Lychhinh', 'Chhorvaon', 'Srun', 'Kheng', 'Tola'].includes(a.handler))).toBe(true)
  expect(c.overall).toBeCloseTo(reconciliation.workbookBoqOverall, 12)
  expect(c.leaves.reduce((s, a) => s + a.globalWeight, 0)).toBeCloseTo(1, 12)
  expect(activities.filter(a => !a.parentId).reduce((s, a) => s + (a.boqValue ?? 0), 0)).toBeCloseTo(reconciliation.boqValue, 6)
  for (const a of activities) expect(c.progress.get(a.id)).toBeCloseTo(a.progress, 10)
  const template = new Uint8Array(readFileSync('.private/nbc-bp02/template.xlsx'))
  const doc = (bytes: Uint8Array) => new DOMParser().parseFromString(strFromU8(unzipSync(bytes)['xl/worksheets/sheet1.xml']!), 'application/xml')
  expect(Number(doc(weeklyWorkbook(template, activities, [], '2026-10-25').bytes).querySelector('c[r="P5"] v')?.textContent)).toBeCloseTo(c.overall, 12)
  // Excel's shared formulas must not be orphaned: every formula is written out and repeated MEP rows still link to Tola's floor row.
  const sheet = new DOMParser().parseFromString(strFromU8(unzipSync(weeklyWorkbook(template, activities, [], '2026-10-25').bytes)['xl/worksheets/sheet1.xml']!), 'application/xml')
  expect(sheet.querySelectorAll('f[t="shared"]')).toHaveLength(0)
  const tolaLinks = [...sheet.querySelectorAll('c f')].filter(f => /^'Tola'!M\d+$/.test(f.textContent ?? '') && /^N\d+$/.test(f.parentElement!.getAttribute('r')!))
  expect(tolaLinks.length).toBeGreaterThan(5000)
  const leaf = c.leaves.find(a => a.handler === 'Tola' && a.progress < 1)!
  const edited = activities.map(a => a.id === leaf.id ? { ...a, progress: 1 } : a)
  expect(Number(doc(weeklyWorkbook(template, edited, [], '2026-10-25').bytes).querySelector('c[r="P5"] v')?.textContent)).toBeCloseTo(c.overall + leaf.globalWeight * (1 - leaf.progress), 12)
}, 120000)

test.skipIf(!existsSync('.private/nbc-bp02/initial.json'))('BP02 export keeps its hierarchy column and floor code when a handler is reassigned', () => {
  const { activities } = JSON.parse(readFileSync('.private/nbc-bp02/initial.json', 'utf8')) as { activities: NbcActivity[] }
  const template = new Uint8Array(readFileSync('.private/nbc-bp02/template.xlsx'))
  const leaf = activities.find(a => a.editable && a.handler === 'Sitha' && a.wbs === '1.8.1.3.1.1.1')!
  const files = unzipSync(weeklyWorkbook(template, activities.map(a => a.id === leaf.id ? { ...a, handler: 'Kheng' } : a), [], '2026-10-25').bytes)
  const text = strFromU8(files['xl/worksheets/sheet6.xml']!)
  const row = [...new DOMParser().parseFromString(text, 'application/xml').querySelectorAll('row')].find(r => r.querySelector('c[r^="A"]')?.textContent?.includes(leaf.wbs) || r.textContent?.includes(leaf.wbs))
  expect(row?.querySelector('c[r^="N"]')?.textContent).toBe('L18')
  expect(row?.textContent).toContain(leaf.name)
}, 120000)
