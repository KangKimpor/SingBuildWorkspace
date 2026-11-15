import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { PHONE_QUERY } from '@/shell/usePhone'
import { fetchAccess, fetchPackage, saveCell, saveRemark } from './api'
import type { MatPackage } from './api'
import { cache } from './store'
import type { MatItem } from './types'
import MaterialTracker from './MaterialTracker'

vi.mock('./api', () => ({ fetchAccess: vi.fn(), fetchPackage: vi.fn(), saveCell: vi.fn(), saveRemark: vi.fn() }))

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
  vi.mocked(saveRemark).mockResolvedValue({ week: WEEK })
})
afterEach(() => {
  vi.restoreAllMocks()
  for (const fn of [fetchAccess, fetchPackage, saveCell, saveRemark]) vi.mocked(fn).mockReset()
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
  // ISO dates read as day, month and year.
  expect(screen.getAllByText('7 Oct 2025').length).toBeGreaterThan(0)
})

test('package and sheet come from the query string', async () => {
  vi.mocked(fetchPackage).mockResolvedValue(load([{ ...material('m1', 1, 'MP-01', 4), package: 'bp04', sheet: 'mep' }]))
  open('/admin?p=bp04&s=mep')
  expect(await screen.findByText('Sample panel MP-01')).toBeInTheDocument()
  expect(fetchPackage).toHaveBeenCalledWith('bp04', null, null)
  expect(screen.getByRole('button', { name: 'BP04' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'MEP Material' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Review' })).toBeInTheDocument()
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
