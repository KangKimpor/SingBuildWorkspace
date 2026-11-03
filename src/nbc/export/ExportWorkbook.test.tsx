import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { useWorkspace } from '@/data'
import { fixtureActivities } from '../test-fixture'
import ExportWorkbook from './ExportWorkbook'
import { loadReportTemplate } from './template'

vi.mock('./template', () => ({ loadReportTemplate: vi.fn() }))
const cachedTemplates = vi.hoisted(() => new Map<string, { id: string; name: string; data: ArrayBuffer }>())
vi.mock('@/data/persistence', async () => {
  const actual = await vi.importActual<typeof import('@/data/persistence')>('@/data/persistence')
  return { ...actual, db: { ...actual.db, reportTemplates: {
    get: vi.fn(async (id: string) => cachedTemplates.get(id)),
    put: vi.fn(async (template: { id: string; name: string; data: ArrayBuffer }) => { cachedTemplates.set(template.id, template) }),
    delete: vi.fn(async (id: string) => { cachedTemplates.delete(id) }),
  } } }
})
const key = 'nbc-report-template:v2:signed-in-account:nbc-bp03'
beforeEach(() => { vi.clearAllMocks(); cachedTemplates.clear(); useWorkspace.setState({ scope: 'signed-in-account' }) })
const show = () => render(<ExportWorkbook projectId="nbc-bp03" activities={fixtureActivities()} submissions={[]} onClose={() => {}}/>)

test('signed-in export loads the shared format automatically without a file picker', async () => {
  vi.mocked(loadReportTemplate).mockResolvedValue({ name: 'BP03.xlsx', data: new ArrayBuffer(0) })
  show()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Export XLSX' })).toBeEnabled())
  expect(loadReportTemplate).toHaveBeenCalledWith('nbc-bp03')
  expect(screen.queryByLabelText('Weekly report template')).toBeNull()
})

test('signed-in export reuses the cached report template', async () => {
  vi.mocked(loadReportTemplate).mockResolvedValue({ name: 'BP03.xlsx', data: new ArrayBuffer(1) })
  const first = show()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Export XLSX' })).toBeEnabled())
  expect(cachedTemplates.get(key)).toMatchObject({ name: 'BP03.xlsx' })
  first.unmount()
  vi.mocked(loadReportTemplate).mockClear()
  show()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Export XLSX' })).toBeEnabled())
  expect(loadReportTemplate).not.toHaveBeenCalled()
})

test('unavailable shared format blocks download and explains how to retry', async () => {
  vi.mocked(loadReportTemplate).mockRejectedValue(new Error('Offline'))
  show()
  expect(await screen.findByRole('alert')).toHaveTextContent('Close and reopen')
  expect(screen.getByRole('button', { name: 'Export XLSX' })).toBeDisabled()
})
