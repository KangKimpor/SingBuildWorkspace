import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { PHONE_QUERY } from '@/shell/usePhone'
import { fetchAccess, fetchPackage, saveCell, saveFields, saveRemark } from './api'
import type { MatPackage } from './api'
import { deleteMatImages, uploadMatImage } from './images'
import { cache } from './store'
import type { MatItem } from './types'
import MaterialTracker from './MaterialTracker'

vi.mock('./api', () => ({ fetchAccess: vi.fn(), fetchPackage: vi.fn(), saveCell: vi.fn(), saveFields: vi.fn(), saveRemark: vi.fn() }))
vi.mock('./images', () => ({
  MAX_IMAGES_PER_SET: 10,
  isStorageRef: (ref: string) => ref.startsWith('storage:'),
  uploadMatImage: vi.fn(),
  deleteMatImages: vi.fn(),
  useMatImageSrc: (ref: string) => (ref.startsWith('storage:') ? `https://signed.test/${ref.slice(8)}` : `/mat/${ref}`),
}))

// The reporting week of Sunday 15 November 2026; "Last week" starts on the 8th.
const WEEK = '2026-11-15'
const LAST = '2026-11-08'
const NOW = '2026-11-15T03:00:00.000Z'

const section = (id: string, pos: number, label: string, nest: { end?: number; level?: number } = {}): MatItem => ({
  id, package: 'bp03', sheet: 'id', pos, kind: 'section', data: { cols: { description: label }, cells: {}, ...nest }, edits: {}, updatedAt: NOW,
})
const material = (id: string, pos: number, code: string, po: number, over: Partial<MatItem> = {}): MatItem => ({
  id, package: 'bp03', sheet: 'id', pos, kind: 'item',
  data: {
    cols: { no: pos, code, description: `Sample panel ${code}`, pic: 'Dara', msStatus: 'Approved', msPlan: '2025-10-07' },
    cells: {
      total: { v: 10 }, po: { v: po }, shd: { v: 0 }, onsite: { v: 0 }, remaining: { f: 'totalMinusOnsite' },
      notYetPo: { f: 'notYetPo' }, placed: { f: 'placedPoOverTotal' }, production: { v: 0 }, waiting: { f: 'waiting' },
      shipping: { v: 0 }, arrived: { f: 'arrived' },
    },
  },
  edits: {}, updatedAt: NOW, ...over,
})

function load(items: MatItem[] = [section('s1', 1, 'Wall Finishing'), material('x1', 2, 'XX-01', 4), material('x2', 3, 'XX-02', 8)]): MatPackage {
  return {
    week: WEEK, now: NOW, items,
    remarks: [
      { itemId: 'x1', team: 'pm', weekStart: LAST, body: 'Waiting for supplier quote' },
      { itemId: 'x1', team: 'pm', weekStart: WEEK, body: 'Quote received' },
    ],
  }
}

beforeEach(() => {
  vi.spyOn(cache, 'read').mockResolvedValue(null)
  vi.spyOn(cache, 'write').mockResolvedValue()
  vi.mocked(fetchAccess).mockResolvedValue(true)
  vi.mocked(fetchPackage).mockResolvedValue(load())
  vi.mocked(saveCell).mockResolvedValue()
  vi.mocked(saveFields).mockResolvedValue()
  vi.mocked(saveRemark).mockResolvedValue({ week: WEEK })
  vi.mocked(uploadMatImage).mockResolvedValue('storage:x1/image/new.webp')
  vi.mocked(deleteMatImages).mockResolvedValue()
})
afterEach(() => {
  vi.restoreAllMocks()
  for (const fn of [fetchAccess, fetchPackage, saveCell, saveFields, saveRemark, uploadMatImage, deleteMatImages]) vi.mocked(fn).mockReset()
})

function open(path = '/admin') {
  return render(<MemoryRouter initialEntries={[path]}><MaterialTracker /></MemoryRouter>)
}
async function openList(path?: string) {
  open(path)
  await screen.findByText('Sample panel XX-01')
}
const field = (name: string) => screen.getByRole('textbox', { name }) as HTMLInputElement

test('a visitor without access sees Not found and nothing is loaded', async () => {
  vi.mocked(fetchAccess).mockResolvedValue(false)
  open()
  expect(await screen.findByRole('heading', { name: 'Not found' })).toBeInTheDocument()
  expect(fetchPackage).not.toHaveBeenCalled()
})

test('a signed-out visit, where the access check fails, sees Not found and nothing is loaded', async () => {
  vi.mocked(fetchAccess).mockRejectedValue(new Error('Sign in to continue.'))
  open()
  expect(await screen.findByRole('heading', { name: 'Not found' })).toBeInTheDocument()
  expect(fetchPackage).not.toHaveBeenCalled()
})

test('a phone shows one line instead of the table', async () => {
  const matchMedia = window.matchMedia
  window.matchMedia = ((query: string) => ({ ...matchMedia(query), matches: query === PHONE_QUERY })) as typeof window.matchMedia
  try {
    open()
    expect(await screen.findByText('Open the material list on a tablet or computer.')).toBeInTheDocument()
    expect(fetchPackage).not.toHaveBeenCalled()
  } finally {
    window.matchMedia = matchMedia
  }
})

test('the header shows the week label, and an item shows last week as text and this week in a textbox', async () => {
  await openList()
  expect(screen.getByRole('heading', { name: 'Material list' })).toBeInTheDocument()
  expect(screen.getByText('Week 15 Nov – 21 Nov')).toBeInTheDocument()
  expect(fetchPackage).toHaveBeenCalledWith('bp03', null, null)
  const last = screen.getByText('Waiting for supplier quote')
  expect(last.closest('textarea, input')).toBeNull()
  expect(field('XX-01 PM Remarks This week')).toHaveValue('Quote received')
  expect(field('XX-01 Purchase Remarks This week')).toHaveValue('')
  // ISO dates read as day, month and year inside the editable submission cell.
  expect(field('XX-01 Material Submission Plan Submit')).toHaveValue('7 Oct 2025')
})

test('package and sheet come from the query string', async () => {
  vi.mocked(fetchPackage).mockResolvedValue(load([{ ...material('m1', 1, 'MP-01', 4), package: 'bp04', sheet: 'mep' }]))
  open('/admin?p=bp04&s=mep')
  expect(await screen.findByText('Sample panel MP-01')).toBeInTheDocument()
  expect(fetchPackage).toHaveBeenCalledWith('bp04', null, null)
  expect(screen.getByRole('button', { name: 'BP04' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('button', { name: 'MEP Material' })).toHaveAttribute('aria-current', 'page')
  // The workbook's note sheets are not offered as tabs.
  expect(screen.queryByRole('button', { name: 'Review' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Change Log' })).toBeNull()
})

test('typing a remark and leaving the field saves it for that team', async () => {
  await openList()
  const remark = field('XX-01 PM Remarks This week')
  fireEvent.focus(remark)
  fireEvent.change(remark, { target: { value: 'Quote approved' } })
  fireEvent.blur(remark)
  await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument())
  expect(saveRemark).toHaveBeenCalledExactlyOnceWith('x1', 'pm', 'Quote approved')
  expect(remark).toHaveValue('Quote approved')
})

test('typing 50 in Placed Order saves 0.5 and Not Yet PO follows', async () => {
  await openList()
  expect(field('XX-01 Not Yet PO')).toHaveValue('60%')
  const placed = field('XX-01 Placed Order')
  expect(placed).toHaveValue('40%')
  fireEvent.focus(placed)
  fireEvent.change(placed, { target: { value: '50' } })
  fireEvent.keyDown(placed, { key: 'Enter' })
  await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument())
  expect(saveCell).toHaveBeenCalledExactlyOnceWith('x1', 'placed', 0.5)
  expect(field('XX-01 Not Yet PO')).toHaveValue('50%')
  expect(placed).toHaveValue('50%')
})

test('Escape puts back the stored value without saving', async () => {
  await openList()
  const placed = field('XX-01 Placed Order')
  fireEvent.change(placed, { target: { value: '90' } })
  fireEvent.keyDown(placed, { key: 'Escape' })
  fireEvent.blur(placed)
  expect(placed).toHaveValue('40%')
  expect(saveCell).not.toHaveBeenCalled()
})

test('Use formula clears the override', async () => {
  vi.mocked(fetchPackage).mockResolvedValue(load([material('x1', 1, 'XX-01', 4, { edits: { placed: 0.5 } })]))
  await openList()
  expect(field('XX-01 Placed Order')).toHaveValue('50%')
  fireEvent.click(screen.getByRole('button', { name: 'Use formula for XX-01 Placed Order' }))
  await waitFor(() => expect(field('XX-01 Placed Order')).toHaveValue('40%'))
  expect(saveCell).toHaveBeenCalledExactlyOnceWith('x1', 'placed', null)
  await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument())
  expect(screen.queryByRole('button', { name: 'Use formula for XX-01 Placed Order' })).toBeNull()
})

test('a failed save keeps the typed text, marks the cell invalid and offers Retry', async () => {
  vi.mocked(saveCell).mockRejectedValueOnce(new Error('Network down'))
  await openList()
  const placed = field('XX-01 Placed Order')
  fireEvent.change(placed, { target: { value: '50' } })
  fireEvent.blur(placed)
  const retry = await screen.findByRole('button', { name: 'Retry XX-01 Placed Order' })
  expect(placed).toHaveValue('50')
  expect(placed).toHaveAttribute('aria-invalid', 'true')
  expect(screen.getByText('Could not save')).toBeInTheDocument()
  fireEvent.click(retry)
  await waitFor(() => expect(placed).toHaveValue('50%'))
  expect(saveCell).toHaveBeenLastCalledWith('x1', 'placed', 0.5)
  expect(placed).not.toHaveAttribute('aria-invalid')
  await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument())
})

test('a section row shows the average Placed Order of its items, and the first row the sheet average', async () => {
  vi.mocked(fetchPackage).mockResolvedValue(load([
    section('s1', 1, 'Wall Finishing'), material('x1', 2, 'XX-01', 4), material('x2', 3, 'XX-02', 8),
    section('s2', 4, 'Floor Finishing'), material('x3', 5, 'XX-03', 10),
  ]))
  await openList()
  // Placed Order is the second percentage column; Not Yet PO the first.
  const placedOf = (name: RegExp) => within(screen.getByRole('row', { name })).getAllByText(/%$/)[1]
  expect(placedOf(/Wall Finishing/)).toHaveTextContent('60%')
  expect(placedOf(/Floor Finishing/)).toHaveTextContent('100%')
  expect(placedOf(/Sheet average/)).toHaveTextContent('73%')
})

test('a parent section averages the items of its nested sections, and collapsing it hides them all', async () => {
  vi.mocked(fetchPackage).mockResolvedValue(load([
    section('p', 1, 'Finishes', { end: 5, level: 0 }), material('x1', 2, 'XX-01', 4),
    section('c', 3, 'Wall Finishing', { end: 5, level: 1 }), material('x2', 4, 'XX-02', 8), material('x3', 5, 'XX-03', 10),
    section('n', 6, 'Doors', { end: 7, level: 0 }), material('x4', 7, 'XX-04', 2),
  ]))
  await openList()
  const placedOf = (name: RegExp) => within(screen.getByRole('row', { name })).getAllByText(/%$/)[1]
  expect(placedOf(/Finishes/)).toHaveTextContent('73%')
  expect(placedOf(/Wall Finishing/)).toHaveTextContent('90%')
  fireEvent.click(screen.getByRole('button', { name: 'Collapse Finishes' }))
  expect(screen.queryByRole('button', { name: 'Collapse Wall Finishing' })).toBeNull()
  for (const code of ['XX-01', 'XX-02', 'XX-03']) expect(screen.queryByText(`Sample panel ${code}`)).toBeNull()
  expect(screen.getByText('Sample panel XX-04')).toBeInTheDocument()
})

test('collapsing a section hides its items', async () => {
  await openList()
  fireEvent.click(screen.getByRole('button', { name: 'Collapse Wall Finishing' }))
  expect(screen.queryByText('Sample panel XX-01')).toBeNull()
  expect(screen.getByRole('button', { name: 'Expand Wall Finishing' })).toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(screen.getByRole('button', { name: 'Expand Wall Finishing' }))
  expect(screen.getByText('Sample panel XX-01')).toBeInTheDocument()
})

test('search keeps the matching materials and their section', async () => {
  await openList()
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search materials' }), { target: { value: 'xx-02' } })
  await waitFor(() => expect(screen.queryByText('Sample panel XX-01')).toBeNull())
  expect(screen.getByText('Sample panel XX-02')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Collapse Wall Finishing' })).toBeInTheDocument()
})

test('the key bar counts the materials and follows the search', async () => {
  await openList()
  expect(screen.getByText('2 materials')).toBeInTheDocument()
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search materials' }), { target: { value: 'xx-02' } })
  await waitFor(() => expect(screen.getByText('1 material of 2')).toBeInTheDocument())
})

test('no match keeps the table frame, the zero count and the legend', async () => {
  await openList()
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search materials' }), { target: { value: 'zzz' } })
  expect(await screen.findByText(/No materials match these filters/)).toBeInTheDocument()
  expect(screen.getByText('0 materials of 2')).toBeInTheDocument()
  expect(document.querySelector('.mat-empty-scroll')).not.toBeNull()
  expect(screen.getByRole('list', { name: 'Legend' })).toBeInTheDocument()
  // The toolbar hides its own "Clear filters"; the one inside the frame does the work.
  expect(screen.getAllByRole('button', { name: 'Clear filters' })).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
  expect(await screen.findByText('Sample panel XX-01')).toBeInTheDocument()
})

test('the "/" key focuses the search box without typing into it', async () => {
  await openList()
  const search = screen.getByRole('searchbox', { name: 'Search materials' })
  fireEvent.keyDown(document.body, { key: '/' })
  expect(search).toHaveFocus()
  expect(search).toHaveValue('')
})

test('Expand sets full-screen mode, keeps SaveState visible, and Collapse restores layout', async () => {
  await openList()
  fireEvent.click(screen.getByRole('button', { name: 'Expand' }))
  expect(document.querySelector('.mat-page')).toHaveAttribute('data-expanded')
  const unit = field('XX-01 Quantity Unit')
  fireEvent.change(unit, { target: { value: 'set' } })
  fireEvent.keyDown(unit, { key: 'Enter' })
  await waitFor(() => expect(within(document.querySelector('.mat-toolbar-actions') as HTMLElement).getByText('Saved')).toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: 'Collapse' }))
  expect(document.querySelector('.mat-page')).not.toHaveAttribute('data-expanded')
})

test('the section controls collapse every section and expand them again', async () => {
  await openList()
  fireEvent.click(screen.getByRole('button', { name: 'Collapse all sections' }))
  expect(screen.queryByText('Sample panel XX-01')).toBeNull()
  expect(screen.getByRole('button', { name: 'Expand all sections' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Expand all sections' }))
  expect(screen.getByText('Sample panel XX-01')).toBeInTheDocument()
})

test('a picture opens larger in a dialog', async () => {
  vi.mocked(fetchPackage).mockResolvedValue(load([material('x1', 1, 'XX-01', 4, {
    data: { ...material('x1', 1, 'XX-01', 4).data, images: { image: ['a1b2c3.webp'] } },
  })]))
  await openList()
  const thumb = screen.getByRole('img', { name: 'XX-01 Image 1' })
  expect(thumb).toHaveAttribute('src', '/mat/a1b2c3.webp')
  expect(thumb).toHaveAttribute('loading', 'lazy')
  fireEvent.click(screen.getByRole('button', { name: 'XX-01 Image 1' }))
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByRole('img')).toHaveAttribute('src', '/mat/a1b2c3.webp')
})

test('the Summary tab is removed and ?s=summary falls back to ID Material', async () => {
  open('/admin?p=bp03&s=summary')
  expect(await screen.findByText('Sample panel XX-01')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Summary' })).toBeNull()
  expect(screen.getByRole('button', { name: 'ID Material' })).toHaveAttribute('aria-current', 'page')
})

test('Purchase Remarks columns appear before PM Remarks columns', async () => {
  await openList()
  const headers = screen.getAllByRole('columnheader').map((el) => el.textContent)
  expect(headers.indexOf('Purchase Remarks')).toBeGreaterThan(-1)
  expect(headers.indexOf('PM Remarks')).toBeGreaterThan(-1)
  expect(headers.indexOf('Purchase Remarks')).toBeLessThan(headers.indexOf('PM Remarks'))
})

test('Material Submission, Sample Submission, Procurement, and Quantity Unit are editable, with a Status selector', async () => {
  vi.mocked(fetchPackage).mockResolvedValue(load([
    material('x1', 2, 'XX-01', 4, {
      data: {
        ...material('x1', 2, 'XX-01', 4).data,
        cols: { no: 2, code: 'XX-01', description: 'Sample panel XX-01', pic: 'Dara', msStatus: 'Waiting Client', msPlan: '2025-10-07' },
      },
    }),
  ]))
  await openList()

  const msPlan = field('XX-01 Material Submission Plan Submit')
  fireEvent.change(msPlan, { target: { value: '2026-01-15' } })
  fireEvent.keyDown(msPlan, { key: 'Enter' })
  await waitFor(() => expect(saveCell).toHaveBeenCalledWith('x1', 'msPlan', '2026-01-15'))
  expect(msPlan).toHaveValue('15 Jan 2026')

  const status = screen.getByRole('combobox', { name: 'XX-01 Material Submission Status' }) as HTMLSelectElement
  expect(status).toHaveValue('Waiting Client')
  expect(within(status).getByRole('option', { name: 'Waiting Client' })).toBeInTheDocument()
  expect(within(status).getByRole('option', { name: 'Revise & Resubmit' })).toBeInTheDocument()
  fireEvent.change(status, { target: { value: 'Revise & Resubmit' } })
  await waitFor(() => expect(saveCell).toHaveBeenCalledWith('x1', 'msStatus', 'Revise & Resubmit'))
  expect(status).toHaveValue('Revise & Resubmit')

  const ssPlan = field('XX-01 Sample Submission Plan Submit')
  fireEvent.change(ssPlan, { target: { value: 'TBC' } })
  fireEvent.blur(ssPlan)
  await waitFor(() => expect(saveCell).toHaveBeenCalledWith('x1', 'ssPlan', 'TBC'))

  const poPlan = field('XX-01 Procurement Plan Place Order')
  fireEvent.change(poPlan, { target: { value: '2026-02-01' } })
  fireEvent.keyDown(poPlan, { key: 'Enter' })
  await waitFor(() => expect(saveCell).toHaveBeenCalledWith('x1', 'poPlan', '2026-02-01'))

  const procRemarks = field('XX-01 Procurement Remarks')
  fireEvent.change(procRemarks, { target: { value: 'Lead time 3w' } })
  fireEvent.blur(procRemarks)
  await waitFor(() => expect(saveCell).toHaveBeenCalledWith('x1', 'procRemarks', 'Lead time 3w'))

  const unit = field('XX-01 Quantity Unit')
  fireEvent.change(unit, { target: { value: 'm2' } })
  fireEvent.keyDown(unit, { key: 'Enter' })
  await waitFor(() => expect(saveCell).toHaveBeenCalledWith('x1', 'unit', 'm2'))
})

test('Material Source panel edits all source fields and photos via saveFields, and Cancel cleans up uploaded photos', async () => {
  const base = material('x1', 1, 'XX-01', 4)
  vi.mocked(fetchPackage).mockResolvedValue(load([{
    ...base,
    data: {
      ...base.data,
      cols: {
        no: 2, code: 'XX-01', description: 'Sample panel XX-01', pic: 'Dara',
        bp02: 'Yes', location: 'Lobby', spec: 'Spec A', brand: 'Brand A', source: 'Local',
        msStatus: 'Approved', msPlan: '2025-10-07',
      },
      images: { image: ['a1b2c3.webp'] },
    },
  }]))
  await openList()

  fireEvent.click(screen.getByRole('button', { name: 'XX-01 — Edit material source' }))
  const dialog = await screen.findByRole('dialog', { name: 'Material Source' })
  for (const label of ['No', 'Code', 'Description', 'Person In Charge', 'BP02 Mat Approval', 'Location', 'Specification', 'Brand', 'Source Location']) {
    expect(within(dialog).getByLabelText(label)).toBeInTheDocument()
  }
  expect(within(dialog).getByText('Image')).toBeInTheDocument()
  expect(within(dialog).getByText('Approved Sample')).toBeInTheDocument()

  fireEvent.change(within(dialog).getByLabelText('Brand'), { target: { value: 'Brand B' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Remove Image 1' }))
  const file = new File(['img'], 'photo.png', { type: 'image/png' })
  fireEvent.change(within(dialog).getByLabelText('Add Image photo'), { target: { files: [file] } })
  await waitFor(() => expect(uploadMatImage).toHaveBeenCalledWith('x1', 'image', file))

  fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
  await waitFor(() => expect(saveFields).toHaveBeenCalledWith('x1', {
    brand: 'Brand B',
    image: ['storage:x1/image/new.webp'],
  }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Material Source' })).toBeNull())
  expect(screen.getByText('Brand B')).toBeInTheDocument()

  vi.mocked(uploadMatImage).mockResolvedValueOnce('storage:x1/sample/temp.webp')
  fireEvent.click(screen.getByRole('button', { name: 'XX-01 — Edit material source' }))
  const reopened = await screen.findByRole('dialog', { name: 'Material Source' })
  fireEvent.change(within(reopened).getByLabelText('Add Approved Sample photo'), { target: { files: [file] } })
  await waitFor(() => expect(uploadMatImage).toHaveBeenCalledWith('x1', 'sample', file))
  fireEvent.click(within(reopened).getByRole('button', { name: 'Cancel' }))
  await waitFor(() => expect(deleteMatImages).toHaveBeenCalledWith(['storage:x1/sample/temp.webp']))
  expect(saveFields).toHaveBeenCalledTimes(1)
})
