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

test('List shows one row per material with its stage, next step and split notes, with no owner column or row checkboxes', async () => {
  open()
  const x1 = await row('XX-01')
  expect(within(x1).getByRole('button', { name: /^Submission: Approved/ })).toBeInTheDocument()
  expect(within(x1).getByRole('button', { name: /^Procurement: Ordered/ })).toBeInTheDocument()
  expect(within(x1).getByText('Production and shipping')).toBeInTheDocument()
  expect(within(x1).getByText('Quote received')).toBeInTheDocument()
  expect(within(x1).getByText('Lead time 3 weeks')).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Purchase notes' })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'PM notes' })).toBeInTheDocument()
  expect(screen.queryByRole('columnheader', { name: 'Owner' })).toBeNull()
  expect(within(x1).queryByRole('checkbox')).toBeNull()
  expect(screen.getByRole('button', { name: /Wall Finishing/ })).toHaveAttribute('aria-expanded', 'true')
})

test('changing the procurement stage saves column edits at once and Undo puts the old edits back', async () => {
  open()
  const x1 = await row('XX-01')
  fireEvent.click(within(x1).getByRole('button', { name: /^Procurement:/ }))
  const pop = await screen.findByRole('dialog', { name: 'Change procurement stage' })
  expect(within(pop).queryByLabelText(/Effective date/)).toBeNull()
  fireEvent.click(within(pop).getByRole('button', { name: /^On site/ }))
  await waitFor(() => expect(saveFields).toHaveBeenCalledWith('x1', expect.objectContaining({ onsite: 10 })))
  expect(within(x1).getByRole('button', { name: /^Procurement: On site/ })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
  await waitFor(() => expect(saveFields).toHaveBeenLastCalledWith('x1', expect.objectContaining({ onsite: null })))
  expect(within(x1).getByRole('button', { name: /^Procurement: Ordered/ })).toBeInTheDocument()
})

test('the submission stage moves on its own and leaves the order alone', async () => {
  open()
  const x1 = await row('XX-01')
  fireEvent.click(within(x1).getByRole('button', { name: /^Submission:/ }))
  fireEvent.click(within(await screen.findByRole('dialog', { name: 'Change submission stage' })).getByRole('button', { name: /^Under review/ }))
  await waitFor(() => expect(saveFields).toHaveBeenCalledWith('x1', expect.objectContaining({ msStatus: 'Under Review' })))
  const patch = vi.mocked(saveFields).mock.calls.at(-1)![1]
  expect(patch).not.toHaveProperty('po')
  expect(patch).not.toHaveProperty('poActual')
  expect(within(x1).getByRole('button', { name: /^Procurement: Ordered/ })).toBeInTheDocument()
})

test('Procurement stages include Production, Waiting for shipment and Shipping', async () => {
  open()
  const x1 = await row('XX-01')
  fireEvent.click(within(x1).getByRole('button', { name: /^Procurement:/ }))
  fireEvent.click(within(await screen.findByRole('dialog', { name: 'Change procurement stage' })).getByRole('button', { name: /^Production/ }))
  await waitFor(() => expect(saveFields).toHaveBeenCalledWith('x1', expect.objectContaining({ production: 1, waiting: 0 })))
  expect(within(x1).getByRole('button', { name: /^Procurement: Production/ })).toBeInTheDocument()

  fireEvent.click(within(x1).getByRole('button', { name: /^Procurement:/ }))
  fireEvent.click(within(await screen.findByRole('dialog', { name: 'Change procurement stage' })).getByRole('button', { name: /^Waiting for shipment/ }))
  await waitFor(() => expect(saveFields).toHaveBeenLastCalledWith('x1', expect.objectContaining({ waiting: null })))
  expect(within(x1).getByRole('button', { name: /^Procurement: Waiting for shipment/ })).toBeInTheDocument()

  fireEvent.click(within(x1).getByRole('button', { name: /^Procurement:/ }))
  fireEvent.click(within(await screen.findByRole('dialog', { name: 'Change procurement stage' })).getByRole('button', { name: /^Shipping/ }))
  await waitFor(() => expect(saveFields).toHaveBeenLastCalledWith('x1', expect.objectContaining({ shipping: 1 })))
  expect(within(x1).getByRole('button', { name: /^Procurement: Shipping/ })).toBeInTheDocument()
})

test('the row shows the timeline points and all four quantities with Total by BOQ', async () => {
  open()
  const x1 = await row('XX-01')
  // Approved by status (no dates), so submitted and approved; ordered; the sample, shipping and arrival are not reached.
  expect(within(x1).getByRole('button', { name: /^Timeline: Material submitted, Material approved, Order placed\. Next: Production and shipping, Pending/ })).toBeInTheDocument()
  expect(x1.querySelectorAll('.mi-tm-steps .mi-tm-k')).toHaveLength(6)
  expect(x1.querySelector('.mi-tm-k[title^="Order placed"]')).toHaveAttribute('data-state', 'done')
  for (const name of ['Total by BOQ: 10. Change', 'Ordered: 4. Change', 'Approved SHD: 0. Change', 'On site: 0. Change']) expect(within(x1).getByRole('button', { name })).toBeInTheDocument()
})

test('each quantity box edits its own value', async () => {
  open()
  const x1 = await row('XX-01')
  fireEvent.click(within(x1).getByRole('button', { name: 'Ordered: 4. Change' }))
  const pop = await screen.findByRole('dialog', { name: 'Change quantity' })
  fireEvent.change(within(pop).getByLabelText('Ordered'), { target: { value: '7' } })
  fireEvent.click(within(pop).getByRole('button', { name: 'Set' }))
  await waitFor(() => expect(saveFields).toHaveBeenCalledWith('x1', { po: 7 }))
})

test('Purchase and PM notes live in separate columns and each opens its own team tab', async () => {
  open()
  const x1 = await row('XX-01')
  for (const body of ['Quote received', 'Waiting for supplier quote', 'Lead time 3 weeks', 'Budget checked']) expect(within(x1).getByText(body)).toBeInTheDocument()
  // No week label in the cell (D-71): the week is in the tooltip and the popover's past notes.
  expect(within(x1).queryByText('2 wks ago')).toBeNull()
  expect(within(x1).getByText('Budget checked')).toHaveAttribute('title', expect.stringMatching(/^Week of 1 Nov/))
  fireEvent.click(within(x1).getByRole('button', { name: /^PM notes:/ }))
  const pop = await screen.findByRole('dialog', { name: "This week's note" })
  expect(within(pop).getByRole('textbox', { name: 'PM note for this week' })).toHaveValue('Quote received')
})

test("the note popover lists the team's past notes", async () => {
  open()
  const x1 = await row('XX-01')
  fireEvent.click(within(x1).getByRole('button', { name: /^Purchase notes:/ }))
  const pop = await screen.findByRole('dialog', { name: "This week's note" })
  expect(within(pop).queryByRole('list', { name: 'Past Purchase notes' })).toBeNull()
  fireEvent.click(within(pop).getByRole('button', { name: 'Past notes (2)' }))
  const past = within(pop).getByRole('list', { name: 'Past Purchase notes' })
  expect(within(past).getByText('Lead time 3 weeks')).toBeInTheDocument()
  expect(within(past).getByText('Last week')).toBeInTheDocument()
  expect(within(past).getByText('Budget checked')).toBeInTheDocument()
  // Switching team shows that team's earlier notes instead.
  fireEvent.click(within(pop).getByRole('button', { name: 'PM' }))
  expect(within(within(pop).getByRole('list', { name: 'Past PM notes' })).getByText('Waiting for supplier quote')).toBeInTheDocument()
})

test('the on-site popover sets the total on site', async () => {
  open()
  const x2 = await row('XX-02')
  fireEvent.click(within(x2).getByRole('button', { name: 'On site: 0. Change' }))
  const pop = await screen.findByRole('dialog', { name: 'Change quantity' })
  expect(within(pop).queryByText(/Received/)).toBeNull()
  fireEvent.change(within(pop).getByLabelText('On site'), { target: { value: '4' } })
  fireEvent.click(within(pop).getByRole('button', { name: 'Set' }))
  await waitFor(() => expect(saveFields).toHaveBeenCalledWith('x2', expect.objectContaining({ onsite: 4 })))
  expect(screen.getByText('On site updated')).toBeInTheDocument()
})

test('the timeline cell says Place order before an order is placed, and its popover edits plan dates and skips stages', async () => {
  vi.mocked(fetchPackage).mockResolvedValue(load([
    section('s1', 1, 'Wall Finishing'),
    material('x1', 2, 'XX-01', 0, { data: { ...material('x1', 2, 'XX-01', 0).data, cols: { ...material('x1', 2, 'XX-01', 0).data.cols, poPlan: '2025-10-07' } } }),
  ]))
  open()
  const x1 = await row('XX-01')
  expect(within(x1).getByText('Place order')).toBeInTheDocument()
  expect(within(x1).queryByText('Order placed')).toBeNull()
  // One small chip carries the lateness; the plan date sits beside it (D-74).
  expect(within(x1).getByText(/^\d+d late$/)).toHaveAttribute('data-tone', 'late')
  expect(within(x1).getByText('Planned 7 Oct')).toBeInTheDocument()
  expect(x1.querySelector('.mi-tm-k[title^="Order placed"]')).toHaveAttribute('data-state', 'now-late')
  fireEvent.click(within(x1).getByText('Place order'))
  const pop = await screen.findByRole('dialog', { name: 'Timeline' })
  for (const title of ['Material submitted', 'Material approved', 'Sample approved', 'Order placed', 'Shipped', 'Fully on site']) expect(within(pop).getByText(title)).toBeInTheDocument()
  expect(within(pop).queryByRole('button', { name: /Done today|Yesterday|Mark shipped/ })).toBeNull()
  expect(within(pop).queryByRole('button', { name: /^Shipped/ })).toBeNull()
  expect(within(pop).getByRole('button', { name: /^Order placed/ })).toHaveAttribute('aria-expanded', 'true')
  fireEvent.change(within(pop).getByLabelText('Order placed plan date'), { target: { value: '2026-12-15' } })
  expect(saveFields).not.toHaveBeenCalled()
  fireEvent.click(within(pop).getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(saveFields).toHaveBeenCalledWith('x1', { poPlan: '2026-12-15' }))
})

test('the timeline follows the status: moving Procurement to Shipping reaches the Shipped step', async () => {
  open()
  const x1 = await row('XX-01')
  expect(within(x1).getByRole('button', { name: /^Timeline: .*\. Next: Production and shipping/ })).toBeInTheDocument()
  fireEvent.click(within(x1).getByRole('button', { name: /^Procurement:/ }))
  fireEvent.click(within(await screen.findByRole('dialog', { name: 'Change procurement stage' })).getByRole('button', { name: /^Shipping/ }))
  await waitFor(() => expect(within(x1).getByRole('button', { name: /^Timeline: Material submitted, Material approved, Order placed, Shipped\. Next: Deliver to site/ })).toBeInTheDocument())
})

test('List sections expand and collapse all at once', async () => {
  open()
  await row('XX-01')
  fireEvent.click(screen.getByRole('button', { name: 'Collapse all sections' }))
  expect(screen.queryByText('Sample panel XX-01')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Expand all sections' }))
  expect(await screen.findByText('Sample panel XX-01')).toBeInTheDocument()
})

test('a note is saved as the remark for this week and the chosen team', async () => {
  open()
  const x2 = await row('XX-02')
  fireEvent.click(within(x2).getByRole('button', { name: /^Purchase notes:/ }))
  const box = await screen.findByRole('textbox', { name: /Purchase note for this week/ })
  fireEvent.change(box, { target: { value: 'ETA 2 Dec' } })
  fireEvent.keyDown(box, { key: 'Enter' })
  await waitFor(() => expect(saveRemark).toHaveBeenCalledWith('x2', 'purchase', 'ETA 2 Dec'))
})

test('the detail panel opens from the name, shows Add actual date and Total by BOQ, and closes with Escape', async () => {
  open()
  fireEvent.click(await screen.findByRole('button', { name: /Sample panel XX-01$/ }))
  const panel = await screen.findByRole('complementary', { name: 'Sample panel XX-01 details' })
  expect(within(panel).getByText('Material submitted')).toBeInTheDocument()
  expect(within(panel).getAllByText('Add actual date').length).toBeGreaterThan(0)
  expect(within(panel).getByLabelText('Total by BOQ')).toBeInTheDocument()
  expect(within(panel).getByText('Lead time 3 weeks')).toBeInTheDocument()
  fireEvent.keyDown(window, { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('complementary', { name: /details/ })).toBeNull())
})

test('Board shows all 11 stages and changes stay connected across List, Board and Sheet', async () => {
  open('/admin?v=board')
  expect(await screen.findByRole('region', { name: 'Ordered, 2' })).toBeInTheDocument()
  expect(screen.getAllByRole('region', { name: /, \d+$/ })).toHaveLength(11)
  // Switch to List, move XX-01 to Shipping, verify Board and Sheet both reflect it.
  fireEvent.click(screen.getByRole('button', { name: 'List' }))
  const x1 = await row('XX-01')
  fireEvent.click(within(x1).getByRole('button', { name: /^Procurement:/ }))
  fireEvent.click(within(await screen.findByRole('dialog', { name: 'Change procurement stage' })).getByRole('button', { name: /^Shipping/ }))
  await waitFor(() => expect(within(x1).getByRole('button', { name: /^Procurement: Shipping/ })).toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: 'Board' }))
  expect(await screen.findByRole('region', { name: 'Shipping, 1' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Sheet' }))
  expect(await screen.findByRole('button', { name: 'XX-01 Shipping On The Way' })).toHaveTextContent('100%')
  // Edit status in Sheet to Not Required and verify List reflects it.
  fireEvent.click(screen.getByRole('button', { name: 'XX-01 Material Submission Status' }))
  fireEvent.change(screen.getByRole('combobox', { name: 'XX-01 Material Submission Status' }), { target: { value: 'Not Required' } })
  await waitFor(() => expect(saveCell).toHaveBeenCalledWith('x1', 'msStatus', 'Not Required'))
  fireEvent.click(screen.getByRole('button', { name: 'List' }))
  expect(within(await row('XX-01')).getByRole('button', { name: /^Submission: Not required/ })).toBeInTheDocument()
})

test('a material can skip submission and sample stages, and Expand toggles full screen in List and Board', async () => {
  vi.mocked(fetchPackage).mockResolvedValue(load([
    section('s1', 1, 'Wall Finishing'),
    material('x1', 2, 'XX-01', 0, { data: { ...material('x1', 2, 'XX-01', 0).data, cols: { ...material('x1', 2, 'XX-01', 0).data.cols, msStatus: 'Not Yet Submit' } } }),
  ]))
  open()
  const x1 = await row('XX-01')
  fireEvent.click(within(x1).getByRole('button', { name: /^Submission:/ }))
  fireEvent.click(within(await screen.findByRole('dialog', { name: 'Change submission stage' })).getByRole('button', { name: /^Not required/ }))
  await waitFor(() => expect(saveFields).toHaveBeenCalledWith('x1', { msStatus: 'Not Required' }))
  expect(within(x1).getByText('Place order')).toBeInTheDocument()

  // Expand works in List and stays expanded when closing the detail panel with Escape.
  fireEvent.click(screen.getByRole('button', { name: 'Expand' }))
  expect(document.querySelector('.mat-page')).toHaveAttribute('data-expanded')
  fireEvent.click(within(x1).getByRole('button', { name: 'Sample panel XX-01' }))
  await screen.findByRole('complementary', { name: 'Sample panel XX-01 details' })
  fireEvent.keyDown(window, { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('complementary', { name: /details/ })).toBeNull())
  expect(document.querySelector('.mat-page')).toHaveAttribute('data-expanded')
  fireEvent.click(screen.getByRole('button', { name: 'Collapse' }))
  expect(document.querySelector('.mat-page')).not.toHaveAttribute('data-expanded')
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
  fireEvent.click(within(panel).getByRole('button', { name: /^Procurement:/ }))
  fireEvent.click(within(await screen.findByRole('dialog', { name: 'Change procurement stage' })).getByRole('button', { name: /^On site/ }))
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
  const wallRow = group('Wall Finishing').closest('[role="row"]') as HTMLElement
  expect(within(group('Wall Finishing')).getByText('1')).toBeInTheDocument()
  // No material count on section headers (D-71).
  expect(within(wallRow).queryByText('2')).toBeNull()
  expect(group('L23 Club Lounge')).toHaveAttribute('title', '1 Wall Finishing › 1.1 L23 Club Lounge')
  expect(group('Stone/Marble').closest('[role="row"]')).toHaveAttribute('data-depth', '2')
  // Clicking the band background outside the chevron/title button does not collapse the section.
  fireEvent.click(wallRow.querySelector('.mi-grp') as HTMLElement)
  expect(screen.getByText('Sample panel XX-01')).toBeInTheDocument()
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
  expect(within(row1).getByText('As per BOQ')).toBeInTheDocument()
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

test('an activity entry is reverted only after confirming, and writes back what it replaced', async () => {
  // The change being reverted is still in place: x1 holds the status and quantity it wrote.
  vi.mocked(fetchPackage).mockResolvedValue({
    ...load([section('s1', 1, 'Wall Finishing'), material('x1', 2, 'XX-01', 4, { edits: { msStatus: 'Rejected', po: 9 } }), material('x2', 3, 'XX-02', 8)]),
    log: [{ id: 5, itemId: 'x1', at: new Date().toISOString(), by: 'u1', kind: 'fields', detail: { msStatus: 'Rejected', po: 9 }, before: { msStatus: null, po: 4 } }],
    people: { u1: 'Dara' },
  })
  open()
  await row('XX-01')
  fireEvent.click(screen.getByRole('button', { name: 'Activity' }))
  const list = await screen.findByRole('dialog', { name: 'Recent activity' })
  fireEvent.click(within(list).getByRole('button', { name: /^Undo: Dara set the status to Rejected/ }))
  const confirm = await screen.findByRole('dialog', { name: 'Undo this change?' })
  expect(saveFields).not.toHaveBeenCalled()
  // Each field as it is now and as it will be after the undo (D-71): the status goes back to the workbook's own value.
  const status = within(confirm).getByRole('rowheader', { name: 'Submission status' }).closest('tr') as HTMLElement
  expect(within(status).getByText('Rejected')).toHaveClass('mi-confirm-now')
  expect(within(status).getByText('Approved')).toHaveClass('mi-confirm-after')
  const ordered = within(confirm).getByRole('rowheader', { name: 'Ordered quantity' }).closest('tr') as HTMLElement
  expect(within(ordered).getByText('9')).toHaveClass('mi-confirm-now')
  expect(within(ordered).getByText('4')).toHaveClass('mi-confirm-after')
  fireEvent.click(within(confirm).getByRole('button', { name: 'Undo change' }))
  await waitFor(() => expect(saveFields).toHaveBeenCalledWith('x1', { msStatus: null, po: 4 }))
})

test('an entry from before revert existed offers no revert', async () => {
  vi.mocked(fetchPackage).mockResolvedValue({ ...load(), log: [{ id: 6, itemId: 'x1', at: new Date().toISOString(), by: null, kind: 'fields', detail: { pic: 'Sokha' } }] })
  open()
  await row('XX-01')
  fireEvent.click(screen.getByRole('button', { name: 'Activity' }))
  const list = await screen.findByRole('dialog', { name: 'Recent activity' })
  expect(within(list).queryByRole('button', { name: /^Undo/ })).toBeNull()
})

test('the panel shows the submission image and the approved sample as separate groups', async () => {
  vi.mocked(fetchPackage).mockResolvedValue(load([
    section('s1', 1, 'Wall Finishing'),
    material('x1', 2, 'XX-01', 4, { data: { ...material('x1', 2, 'XX-01', 4).data, images: { image: ['a.webp'], sample: ['b.webp', 'c.webp'] } } }),
  ]))
  open()
  fireEvent.click(await screen.findByRole('button', { name: 'Sample panel XX-01' }))
  const panel = await screen.findByRole('complementary', { name: 'Sample panel XX-01 details' })
  const image = within(panel).getByRole('region', { name: 'Submission image' }), sample = within(panel).getByRole('region', { name: 'Approved sample' })
  expect(within(image).getAllByRole('button')).toHaveLength(1)
  expect(within(sample).getAllByRole('button')).toHaveLength(2)
  expect(within(panel).queryByLabelText(/Received/)).toBeNull()
})

test('a Board card shows the material photo', async () => {
  vi.mocked(fetchPackage).mockResolvedValue(load([
    section('s1', 1, 'Wall Finishing'),
    material('x1', 2, 'XX-01', 4, { data: { ...material('x1', 2, 'XX-01', 4).data, images: { image: ['abc.webp'], sample: ['def.webp'] } } }),
  ]))
  open('/admin?v=board')
  const card = await screen.findByRole('button', { name: 'Sample panel XX-01. Open details' })
  expect(card.querySelector('.mi-kc-ph img')).toHaveAttribute('src', '/mat/abc.webp')
  expect(within(card).getByText('2')).toBeInTheDocument()
})

test('an entry whose change is no longer in place has nothing to undo', async () => {
  // x1 has no overrides: the logged status change was already put back.
  vi.mocked(fetchPackage).mockResolvedValue({
    ...load(),
    log: [{ id: 7, itemId: 'x1', at: new Date().toISOString(), by: 'u1', kind: 'fields', detail: { msStatus: 'Rejected' }, before: { msStatus: null } }],
    people: { u1: 'Dara' },
  })
  open()
  await row('XX-01')
  fireEvent.click(screen.getByRole('button', { name: 'Activity' }))
  const list = await screen.findByRole('dialog', { name: 'Recent activity' })
  fireEvent.click(within(list).getByRole('button', { name: /^Undo: Dara/ }))
  const confirm = await screen.findByRole('dialog', { name: 'Undo this change?' })
  expect(within(confirm).getByText(/^Nothing to undo/)).toBeInTheDocument()
  expect(within(confirm).getByRole('button', { name: 'Undo change' })).toBeDisabled()
})

test('activity groups entries by day and spells out each change, with a Changes / Notes filter', async () => {
  vi.mocked(fetchPackage).mockResolvedValue({
    ...load([section('s1', 1, 'Wall Finishing'), material('x1', 2, 'XX-01', 4, { edits: { po: 9 } }), material('x2', 3, 'XX-02', 8)]),
    log: [
      { id: 8, itemId: 'x1', at: new Date().toISOString(), by: 'u1', kind: 'fields', detail: { po: 9 }, before: { po: 4 } },
      { id: 9, itemId: 'x1', at: new Date().toISOString(), by: 'u1', kind: 'remark', detail: { team: 'pm', body: 'Quote received' }, before: { team: 'pm', week: WEEK, body: '' } },
    ],
    people: { u1: 'Dara' },
  })
  open()
  await row('XX-01')
  fireEvent.click(screen.getByRole('button', { name: 'Activity' }))
  const pop = await screen.findByRole('dialog', { name: 'Recent activity' })
  const today = within(pop).getByRole('region', { name: 'Today' })
  // The field change reads from → to, and the note shows its text and team.
  const change = within(today).getByText('Ordered quantity').closest('li') as HTMLElement
  expect(within(change).getByText('4')).toHaveClass('mi-ae-from')
  expect(within(change).getByText('9')).toHaveClass('mi-ae-to')
  expect(within(today).getByText('Quote received')).toBeInTheDocument()
  expect(within(today).getAllByRole('button', { name: /Sample panel XX-01/ }).length).toBeGreaterThan(0)
  fireEvent.click(within(pop).getByRole('button', { name: /^Notes/ }))
  expect(within(pop).queryByText('Ordered quantity')).toBeNull()
  expect(within(pop).getByText('Quote received')).toBeInTheDocument()
})
