import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
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

// The reporting week of Sunday 15 November 2026; "Last week" starts on the 8th, "2 weeks ago" the 1st.
const WEEK = '2026-11-15'
const LAST = '2026-11-08'
const BEFORE = '2026-11-01'
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
    week: WEEK, now: NOW, items, log: [], people: {},
    remarks: [
      { itemId: 'x1', team: 'pm', weekStart: LAST, body: 'Waiting for supplier quote' },
      { itemId: 'x1', team: 'pm', weekStart: WEEK, body: 'Quote received' },
      { itemId: 'x1', team: 'purchase', weekStart: BEFORE, body: 'Budget checked' },
      { itemId: 'x1', team: 'purchase', weekStart: LAST, body: 'Lead time 3 weeks' },
    ],
  }
}

beforeEach(() => {
  // jsdom has no layout; give scroll containers a viewport size so @tanstack/react-virtual renders rows.
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 800 })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 1200 })
  vi.spyOn(cache, 'read').mockResolvedValue(null)
  vi.spyOn(cache, 'write').mockResolvedValue()
  vi.mocked(fetchAccess).mockResolvedValue(true)
  vi.mocked(fetchPackage).mockResolvedValue(load())
  vi.mocked(saveCell).mockResolvedValue({})
  vi.mocked(saveFields).mockResolvedValue({})
  vi.mocked(saveRemark).mockResolvedValue({ week: WEEK })
  vi.mocked(uploadMatImage).mockResolvedValue('storage:x1/image/new.webp')
  vi.mocked(deleteMatImages).mockResolvedValue()
})
afterEach(() => {
  vi.restoreAllMocks()
  for (const fn of [fetchAccess, fetchPackage, saveCell, saveFields, saveRemark, uploadMatImage, deleteMatImages]) vi.mocked(fn).mockReset()
})

/** The workbook table is the Sheet view; List and Board have their own tests (MatItems.test.tsx). */
function open(path = '/admin') {
  return render(<MemoryRouter initialEntries={[path]}><MaterialTracker /></MemoryRouter>)
}
const row = async (code: string) => (await screen.findByText(`Sample panel ${code}`)).closest('[role="row"]') as HTMLElement

test('List shows one row per material with its stage, next step and latest note', async () => {
  open()
  const x1 = await row('XX-01')
  expect(within(x1).getByRole('button', { name: /^Stage: Ordered/ })).toBeInTheDocument()
  expect(within(x1).getByText('First delivery')).toBeInTheDocument()
  expect(within(x1).getByText('Quote received')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Wall Finishing/ })).toHaveAttribute('aria-expanded', 'true')
})

test('changing the stage saves column edits at once and Undo puts the old edits back', async () => {
  open()
  const x1 = await row('XX-01')
  fireEvent.click(within(x1).getByRole('button', { name: /^Stage:/ }))
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /^On site/ }))
  await waitFor(() => expect(saveFields).toHaveBeenCalledWith('x1', expect.objectContaining({ onsite: 10 })))
  expect(within(x1).getByRole('button', { name: /^Stage: On site/ })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
  await waitFor(() => expect(saveFields).toHaveBeenLastCalledWith('x1', expect.objectContaining({ onsite: null })))
  expect(within(x1).getByRole('button', { name: /^Stage: Ordered/ })).toBeInTheDocument()
})

test('the on-site popover sets the total on site', async () => {
  open()
  const x2 = await row('XX-02')
  fireEvent.click(within(x2).getByRole('button', { name: /^On site 0 of 10/ }))
  const pop = await screen.findByRole('dialog', { name: 'Quantity on site' })
  expect(within(pop).queryByText(/Received/)).toBeNull()
  fireEvent.change(within(pop).getByLabelText('Total on site'), { target: { value: '4' } })
  fireEvent.click(within(pop).getByRole('button', { name: 'Set' }))
  await waitFor(() => expect(saveFields).toHaveBeenCalledWith('x2', expect.objectContaining({ onsite: 4 })))
  expect(screen.getByText('On site updated')).toBeInTheDocument()
})

test('the next step says when it is due and finishes with a one-tap date', async () => {
  vi.mocked(fetchPackage).mockResolvedValue(load([
    section('s1', 1, 'Wall Finishing'),
    material('x1', 2, 'XX-01', 0, { data: { ...material('x1', 2, 'XX-01', 0).data, cols: { ...material('x1', 2, 'XX-01', 0).data.cols, poPlan: '2025-10-07' } } }),
  ]))
  open()
  const x1 = await row('XX-01')
  expect(within(x1).getByText('Place order')).toBeInTheDocument()
  expect(within(x1).getByText(/^\d+d late$/)).toBeInTheDocument()
  expect(within(x1).getByText('due 7 Oct')).toBeInTheDocument()
  fireEvent.click(within(x1).getByText('Place order'))
  const pop = await screen.findByRole('dialog', { name: 'Next step' })
  expect(within(pop).getByText(/^Planned 7 Oct · \d+ days late$/)).toBeInTheDocument()
  fireEvent.click(within(within(pop).getByRole('group', { name: 'Order placed' })).getByRole('button', { name: 'Yesterday' }))
  const yesterday = new Date(Date.now() - 864e5)
  const iso = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`
  await waitFor(() => expect(saveFields).toHaveBeenCalledWith('x1', expect.objectContaining({ poActual: iso, po: 10 })))
})

test('a plan date set from the next step saves that column', async () => {
  vi.mocked(fetchPackage).mockResolvedValue(load([
    section('s1', 1, 'Wall Finishing'), material('x1', 2, 'XX-01', 0),
  ]))
  open()
  fireEvent.click(within(await row('XX-01')).getByText('Place order'))
  const pop = await screen.findByRole('dialog', { name: 'Next step' })
  fireEvent.change(within(pop).getByLabelText('Place order plan date'), { target: { value: '2026-12-15' } })
  expect(saveFields).not.toHaveBeenCalled() // a date being typed is not saved until Save or Enter
  fireEvent.click(within(pop).getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(saveFields).toHaveBeenCalledWith('x1', { poPlan: '2026-12-15' }))
})

test('a note is saved as the remark for this week and the chosen team', async () => {
  open()
  const x2 = await row('XX-02')
  fireEvent.click(within(x2).getByText('+ Add note'))
  const box = await screen.findByRole('textbox', { name: /Purchase note for this week/ })
  fireEvent.change(box, { target: { value: 'ETA 2 Dec' } })
  fireEvent.keyDown(box, { key: 'Enter' })
  await waitFor(() => expect(saveRemark).toHaveBeenCalledWith('x2', 'purchase', 'ETA 2 Dec'))
})

test('the detail panel opens from the name and closes with Escape', async () => {
  open()
  fireEvent.click(await screen.findByRole('button', { name: /Sample panel XX-01$/ }))
  const panel = await screen.findByRole('complementary', { name: 'Sample panel XX-01 details' })
  expect(within(panel).getByText('Material submitted')).toBeInTheDocument()
  expect(within(panel).getByText('Lead time 3 weeks')).toBeInTheDocument()
  fireEvent.keyDown(window, { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('complementary', { name: /details/ })).toBeNull())
})

test('Board shows one column per stage and Sheet keeps the workbook table', async () => {
  open('/admin?v=board')
  expect(await screen.findByRole('region', { name: 'Ordered, 2' })).toBeInTheDocument()
  expect(screen.getAllByRole('region', { name: /, \d+$/ })).toHaveLength(7)
  fireEvent.click(screen.getByRole('button', { name: 'Sheet' }))
  expect(await screen.findByRole('searchbox', { name: 'Search material' })).toBeInTheDocument()
  expect(document.querySelector('.mat-table')).not.toBeNull()
})

test('a bulk change that fails for one row says so and keeps Undo for the rows that saved', async () => {
  open()
  const x1 = await row('XX-01'), x2 = await row('XX-02')
  fireEvent.click(within(x1).getByRole('checkbox'))
  fireEvent.click(within(x2).getByRole('checkbox'))
  vi.mocked(saveFields).mockImplementation(async (id) => { if (id === 'x1') throw new Error('Network down'); return {} })
  fireEvent.click(screen.getByRole('button', { name: 'Stage' }))
  fireEvent.click(within(await screen.findByRole('dialog', { name: 'Move selected to stage' })).getByRole('button', { name: /^Approved/ }))
  expect(await screen.findByText('Could not save 1 of 2. Those were put back.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
})

test('omitted materials never count as late or show under the Late filter', async () => {
  vi.mocked(fetchPackage).mockResolvedValue(load([
    section('s1', 1, 'Wall Finishing'),
    material('x1', 2, 'XX-01', 0, { data: { ...material('x1', 2, 'XX-01', 0).data, mark: 'omit', cols: { ...material('x1', 2, 'XX-01', 0).data.cols, msStatus: 'Not Yet Submit' } } }),
    material('x2', 3, 'XX-02', 0, { data: { ...material('x2', 3, 'XX-02', 0).data, cols: { ...material('x2', 3, 'XX-02', 0).data.cols, msStatus: 'Not Yet Submit' } } }),
  ]))
  open()
  await row('XX-01')
  const late = screen.getByRole('button', { name: /^Late/ })
  expect(within(late).getByText('1')).toBeInTheDocument()
  fireEvent.click(late)
  expect(screen.queryByText('Sample panel XX-01')).toBeNull()
  expect(screen.getByText('Sample panel XX-02')).toBeInTheDocument()
})

test('a save shows who made it in the panel and in the Activity list', async () => {
  vi.mocked(saveFields).mockResolvedValue({ log: { id: 7, itemId: 'x1', at: new Date().toISOString(), by: 'u1', kind: 'fields', detail: { pic: 'Sokha' } }, byName: 'Kimpor Kang' })
  open()
  fireEvent.click(await screen.findByRole('button', { name: /Sample panel XX-01$/ }))
  const panel = await screen.findByRole('complementary', { name: 'Sample panel XX-01 details' })
  fireEvent.click(within(panel).getByRole('button', { name: /^Stage:/ }))
  fireEvent.click(within(await screen.findByRole('dialog', { name: 'Change stage' })).getByRole('button', { name: /^On site/ }))
  expect(await within(panel).findByText(/Edited by Kimpor Kang · just now/)).toBeInTheDocument()
  expect(within(panel).getByText('assigned it to Sokha')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Activity' }))
  const list = await screen.findByRole('dialog', { name: 'Recent activity' })
  expect(within(list).getByText('Kimpor Kang')).toBeInTheDocument()
})

test('List groups materials under the same nested sections as the Sheet, and collapsing a parent hides its children', async () => {
  const head = (id: string, pos: number, no: string, name: string, level: number, end: number): MatItem =>
    ({ ...section(id, pos, '', { level, end }), data: { cols: { no, code: name }, cells: {}, level, end } })
  vi.mocked(fetchPackage).mockResolvedValue(load([
    head('s1', 1, '1', 'Wall Finishing', 0, 6), head('s11', 2, '1.1', 'L23 Club Lounge', 1, 6),
    head('s111', 3, '1.1.1', 'Stone/Marble', 2, 4), material('x1', 4, 'XX-01', 4),
    head('s112', 5, '1.1.2', 'Wall Column Finishes', 2, 6), material('x2', 6, 'XX-02', 8),
  ]))
  open()
  await row('XX-01')
  const group = (name: string) => screen.getByRole('button', { name: new RegExp(name) })
  expect(within(group('Wall Finishing')).getByText('1')).toBeInTheDocument()
  expect(within(group('Wall Finishing')).getByText('2')).toBeInTheDocument()
  expect(group('L23 Club Lounge')).toHaveAttribute('title', '1 Wall Finishing › 1.1 L23 Club Lounge')
  expect(group('Stone/Marble').closest('[role="row"]')).toHaveAttribute('data-depth', '2')
  fireEvent.click(group('Wall Finishing'))
  expect(screen.queryByText('Sample panel XX-01')).toBeNull()
  expect(screen.queryByRole('button', { name: /Stone\/Marble/ })).toBeNull()
})

test('a material photo shows in its List row and opens full size', async () => {
  vi.mocked(fetchPackage).mockResolvedValue(load([
    section('s1', 1, 'Wall Finishing'),
    material('x1', 2, 'XX-01', 4, { data: { ...material('x1', 2, 'XX-01', 4).data, images: { image: ['abc.webp'] } } }),
  ]))
  open()
  const x1 = await row('XX-01')
  const thumb = within(x1).getByRole('button', { name: 'View photo of Sample panel XX-01' })
  expect(thumb.querySelector('img')).toHaveAttribute('src', '/mat/abc.webp')
  fireEvent.click(thumb)
  expect(await screen.findByRole('dialog', { name: 'Sample panel XX-01' })).toBeInTheDocument()
})

test('a text total shows the workbook words, and an unnamed author gets no made-up initials', async () => {
  const x1 = material('x1', 2, 'XX-01', 0)
  vi.mocked(fetchPackage).mockResolvedValue({
    ...load([section('s1', 1, 'Wall Finishing'), { ...x1, data: { ...x1.data, cells: { ...x1.data.cells, total: { v: 'As per BOQ' } } } }]),
    log: [{ id: 1, itemId: 'x1', at: new Date().toISOString(), by: null, kind: 'fields', detail: { pic: 'Sokha' } }],
  })
  open()
  const row1 = await row('XX-01')
  expect(within(row1).getByText('/ As per BOQ')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Activity' }))
  const list = await screen.findByRole('dialog', { name: 'Recent activity' })
  expect(within(list).getByText('Someone')).toBeInTheDocument()
  expect(list.querySelector('.mi-av[data-unknown]')).not.toBeNull()
})

test('an empty sheet says so instead of "0 of 0 fully on site"', async () => {
  vi.mocked(fetchPackage).mockResolvedValue(load([]))
  open()
  expect(await screen.findByText('No materials yet')).toBeInTheDocument()
})
