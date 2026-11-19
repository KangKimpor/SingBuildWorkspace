import { describe, expect, it } from 'vitest'
import {
  average,
  colPatchValue,
  computeSheetAverages,
  effective,
  effectiveCol,
  effectiveImages,
  formatCell,
  imagesPatchValue,
  isIsoDate,
  isOverride,
  n,
  parseDateTextInput,
  parseInput,
  parseTextInput,
  sectionItems,
} from './formulas'
import type { CellKey, MatItem, Scalar, Source } from './types'

const make = (cells: Partial<Record<CellKey, Source>>, edits: MatItem['edits'] = {}): MatItem => ({
  id: 'bp03-id-0001',
  package: 'bp03',
  sheet: 'id',
  pos: 1,
  kind: 'item',
  data: { cols: { description: 'Sample tile' }, cells },
  edits,
  updatedAt: '2026-11-15T00:00:00Z',
})
const pct = (v: Scalar) => make({ placed: { v } })
const v = (value: Scalar): Source => ({ v: value })

describe('n', () => {
  it('passes numbers and turns everything else into 0', () => {
    expect(n(3.5)).toBe(3.5)
    expect(n('12')).toBe(0)
    expect(n(null)).toBe(0)
    expect(n(undefined)).toBe(0)
  })
})

describe('placedPoOverTotal', () => {
  const placed = (total: Scalar, po: Scalar) =>
    effective(make({ total: v(total), po: v(po), placed: { f: 'placedPoOverTotal' } })).placed
  it('is null when total is blank or zero', () => {
    expect(placed(null, 10)).toBeNull()
    expect(placed(0, 10)).toBeNull()
  })
  it('is 0 when po is blank, zero or text', () => {
    expect(placed(100, null)).toBe(0)
    expect(placed(100, 0)).toBe(0)
    expect(placed(100, 'Pending')).toBe(0)
  })
  it('is po over total, capped at 1', () => {
    expect(placed(200, 50)).toBe(0.25)
    expect(placed(100, 150)).toBe(1)
  })
})

describe('shdOverPo', () => {
  const ratio = (po: Scalar, shd: Scalar) =>
    effective(make({ po: v(po), shd: v(shd), production: { f: 'shdOverPo' } })).production
  it('is null when po is blank or zero', () => {
    expect(ratio(null, 10)).toBeNull()
    expect(ratio(0, 10)).toBeNull()
  })
  it('is 0 when shd is blank', () => {
    expect(ratio(40, null)).toBe(0)
  })
  it('is shd over po, capped at 1', () => {
    expect(ratio(40, 10)).toBe(0.25)
    expect(ratio(40, 60)).toBe(1)
  })
})

describe('notYetPo', () => {
  const notYet = (total: Scalar, placed: Scalar) =>
    effective(make({ total: v(total), placed: v(placed), notYetPo: { f: 'notYetPo' } })).notYetPo
  it('is null when total is blank or zero', () => {
    expect(notYet(null, 0.3)).toBeNull()
    expect(notYet(0, 0.3)).toBeNull()
  })
  it('is null when placed is not a number', () => {
    expect(notYet(100, null)).toBeNull()
    expect(notYet(100, 'N/A')).toBeNull()
  })
  it('is 1 minus placed', () => {
    expect(notYet(100, 0.3)).toBeCloseTo(0.7)
    expect(notYet(100, 0)).toBe(1)
  })
})

describe('waiting', () => {
  const wait = (total: Scalar, production: Scalar, shipping: Scalar, arrived: Scalar) =>
    effective(make({
      total: v(total), production: v(production), shipping: v(shipping), arrived: v(arrived),
      waiting: { f: 'waiting' },
    })).waiting
  it('is null when total is blank or zero', () => {
    expect(wait(null, 0.5, 0, 0)).toBeNull()
    expect(wait(0, 0.5, 0, 0)).toBeNull()
  })
  it('is production minus shipping minus arrived, never below 0', () => {
    expect(wait(100, 0.5, 0.1, 0.2)).toBeCloseTo(0.2)
    expect(wait(100, 0.2, 0.3, 0.4)).toBe(0)
  })
  it('counts blanks and text as 0', () => {
    expect(wait(100, 0.5, null, 'TBC')).toBe(0.5)
  })
  it('uses calculated inputs', () => {
    const item = make({
      total: v(100), po: v(40), shd: v(20), onsite: v(10),
      production: { f: 'shdOverPo' }, arrived: { f: 'arrived' }, waiting: { f: 'waiting' },
    })
    expect(effective(item).waiting).toBeCloseTo(0.4)
  })
})

describe('arrived', () => {
  const arrived = (total: Scalar, onsite: Scalar) =>
    effective(make({ total: v(total), onsite: v(onsite), arrived: { f: 'arrived' } })).arrived
  it('is null when total is blank or zero', () => {
    expect(arrived(null, 5)).toBeNull()
    expect(arrived(0, 5)).toBeNull()
  })
  it('is 0 when on site is blank', () => {
    expect(arrived(100, null)).toBe(0)
  })
  it('is on site over total, capped at 1', () => {
    expect(arrived(200, 50)).toBe(0.25)
    expect(arrived(100, 120)).toBe(1)
  })
})

describe.each([
  ['totalMinusOnsite', 'total', 'onsite'],
  ['shdMinusOnsite', 'shd', 'onsite'],
  ['totalMinusShd', 'total', 'shd'],
] as const)('%s', (key, left, right) => {
  const remaining = (a: Scalar, b: Scalar) =>
    effective(make({ [left]: v(a), [right]: v(b), remaining: { f: key } })).remaining
  it('is the difference, with blanks as 0', () => {
    expect(remaining(826, 26)).toBe(800)
    expect(remaining(826, null)).toBe(826)
    expect(remaining(null, 26)).toBe(-26)
    expect(remaining('', 26)).toBe(-26)
  })
  it('is null when the first operand is text', () => {
    expect(remaining('Excluded', 26)).toBeNull()
  })
  if (key === 'totalMinusOnsite') {
    it('counts text in on site as 0, as Excel N() does', () => {
      expect(remaining(826, 'TBC')).toBe(826)
    })
  } else {
    it('is null when the second operand is text', () => {
      expect(remaining(826, 'TBC')).toBeNull()
    })
  }
})

describe('sectionItems', () => {
  const row = (pos: number, kind: MatItem['kind'], data: Partial<MatItem['data']> = {}, sheet: MatItem['sheet'] = 'id'): MatItem => ({
    ...make({}),
    id: `bp03-${sheet}-${String(pos).padStart(4, '0')}`,
    sheet,
    pos,
    kind,
    data: { cols: {}, cells: {}, ...data },
  })
  const ids = (list: MatItem[]) => list.map(item => item.pos)

  it('gives a parent section the items of its sub-sections', () => {
    const parent = row(9, 'section', { end: 15, level: 0 })
    const child = row(11, 'section', { end: 13, level: 1 })
    const items = [parent, row(10, 'item'), child, row(12, 'item'), row(13, 'item'), row(14, 'section', { end: 15, level: 1 }),
      row(15, 'item'), row(16, 'item'), row(12, 'item', {}, 'mep')]
    expect(ids(sectionItems(items, parent))).toEqual([10, 12, 13, 15])
    expect(ids(sectionItems(items, child))).toEqual([12, 13])
  })

  it('runs to the row before the next section when end is absent', () => {
    const first = row(9, 'section')
    const last = row(13, 'section')
    const items = [first, row(10, 'item'), row(11, 'note'), row(12, 'item'), last, row(14, 'item'), row(20, 'item')]
    expect(ids(sectionItems(items, first))).toEqual([10, 12])
    expect(ids(sectionItems(items, last))).toEqual([14, 20])
  })
})

describe('effective', () => {
  it('returns every cell, null when there is no source and no edit', () => {
    const values = effective(make({ total: v(10) }))
    expect(Object.keys(values).sort()).toEqual([
      'arrived', 'notYetPo', 'onsite', 'placed', 'po', 'production', 'remaining', 'shd', 'shipping', 'total', 'waiting',
    ])
    expect(values.total).toBe(10)
    expect(values.po).toBeNull()
    expect(values.waiting).toBeNull()
  })
  it('an override feeds dependent formulas', () => {
    const item = make({ total: { v: 100 }, po: { v: 50 }, placed: { f: 'placedPoOverTotal' }, notYetPo: { f: 'notYetPo' } }, { po: 80 })
    expect(effective(item).placed).toBe(0.8)
    expect(effective(item).notYetPo).toBeCloseTo(0.2)
    expect(isOverride(item, 'po')).toBe(true)
  })
  it('an override replaces a formula', () => {
    const item = make({ total: v(100), po: v(50), placed: { f: 'placedPoOverTotal' } }, { placed: 'On hold' })
    expect(effective(item).placed).toBe('On hold')
  })
  it('text in a number cell counts as 0 and is kept', () => {
    const item = make({ total: { v: 'Not in the BOQ' }, placed: { f: 'placedPoOverTotal' } })
    expect(effective(item).total).toBe('Not in the BOQ')
    expect(effective(item).placed).toBeNull()
  })
  it('a formula that depends on itself is null', () => {
    const item = make({ total: { f: 'arrived' }, onsite: v(5), arrived: { f: 'arrived' } })
    expect(effective(item).total).toBeNull()
    expect(effective(item).arrived).toBeNull()
  })
})

describe('isOverride', () => {
  it('is false when the cell has no edit', () => {
    const item = make({ total: v(10) }, { po: 4 })
    expect(isOverride(item, 'total')).toBe(false)
    expect(isOverride(item, 'po')).toBe(true)
  })
})

describe('parseInput', () => {
  it('parses typed input', () => {
    expect(parseInput('placed', '50')).toBe(0.5)
    expect(parseInput('placed', '50%')).toBe(0.5)
    expect(parseInput('placed', '0.5')).toBe(0.005)
    expect(parseInput('total', '1,200')).toBe(1200)
    expect(parseInput('total', 'Pending')).toBe('Pending')
    expect(parseInput('total', '   ')).toBeNull()
    expect(() => parseInput('total', 'x'.repeat(61))).toThrow('Use at most 60 characters.')
  })
  it('trims and keeps other text as typed', () => {
    expect(parseInput('total', '  12.5 ')).toBe(12.5)
    expect(parseInput('placed', ' 1,250% ')).toBe(12.5)
    expect(parseInput('placed', 'N/A')).toBe('N/A')
    expect(parseInput('total', '50%')).toBe('50%')
    expect(parseInput('total', '1,5')).toBe('1,5')
    expect(parseInput('total', 'x'.repeat(60))).toBe('x'.repeat(60))
  })
})

describe('average', () => {
  it('averages only numeric cells', () => {
    expect(average([pct(0.2), pct('N/A'), pct(null), pct(0.6)], 'placed')).toBeCloseTo(0.4)
    expect(average([pct('N/A')], 'placed')).toBeNull()
    expect(average([], 'placed')).toBeNull()
  })
})

describe('formatCell', () => {
  it('shows percent cells as whole percent', () => {
    expect(formatCell('placed', 0.52)).toBe('52%')
    expect(formatCell('arrived', 1)).toBe('100%')
  })
  it('shows quantities with thousands separators and up to 2 decimals', () => {
    expect(formatCell('total', 1200)).toBe('1,200')
    expect(formatCell('total', 1234.567)).toBe('1,234.57')
  })
  it('shows text as is and null as empty', () => {
    expect(formatCell('total', 'Pending')).toBe('Pending')
    expect(formatCell('placed', 'N/A')).toBe('N/A')
    expect(formatCell('placed', null)).toBe('')
  })
})

describe('effectiveCol and effectiveImages', () => {
  it('prefers edits over data.cols and treats empty string edit as cleared null', () => {
    const base = make({})
    base.data.cols = { pic: 'Alice', msPlan: '2025-10-07', lastUpdated: '2026-01-01' }
    expect(effectiveCol(base, 'pic')).toBe('Alice')
    base.edits = { pic: 'Bob', msPlan: '' }
    expect(effectiveCol(base, 'pic')).toBe('Bob')
    expect(effectiveCol(base, 'msPlan')).toBeNull()
    expect(effectiveCol(base, 'lastUpdated')).toBe('2026-01-01')
  })

  it('prefers edited image lists including empty array over data.images', () => {
    const base = make({})
    base.data.images = { image: ['a.webp'], sample: ['b.webp'] }
    expect(effectiveImages(base, 'image')).toEqual(['a.webp'])
    base.edits = { image: [], sample: ['storage:x/sample/1.webp'] }
    expect(effectiveImages(base, 'image')).toEqual([])
    expect(effectiveImages(base, 'sample')).toEqual(['storage:x/sample/1.webp'])
  })
})

describe('date and text parsers and patch helpers', () => {
  it('validates real ISO dates', () => {
    expect(isIsoDate('2025-10-07')).toBe(true)
    expect(isIsoDate('2025-02-29')).toBe(false)
    expect(isIsoDate('TBC')).toBe(false)
  })

  it('parses display dates, ISO dates, blanks, and free text', () => {
    expect(parseDateTextInput('2025-10-07')).toBe('2025-10-07')
    expect(parseDateTextInput('7 Oct 2025')).toBe('2025-10-07')
    expect(parseDateTextInput(' 15 nov 2026 ')).toBe('2026-11-15')
    expect(parseDateTextInput('31 Feb 2026')).toBe('31 Feb 2026')
    expect(parseDateTextInput('TBC')).toBe('TBC')
    expect(parseDateTextInput('-/-')).toBe('-/-')
    expect(parseDateTextInput('   ')).toBe('')
    expect(() => parseDateTextInput('x'.repeat(201))).toThrow('Use at most 200 characters.')
  })

  it('trims text and enforces cap', () => {
    expect(parseTextInput('  set  ')).toBe('set')
    expect(() => parseTextInput('x'.repeat(201))).toThrow('Use at most 200 characters.')
    expect(parseTextInput('x'.repeat(2000), 2000)).toHaveLength(2000)
  })

  it('returns null when matching source and stores empty override when clearing imported value', () => {
    const item = make({})
    item.data.cols = { pic: 'Alice', no: 5 }
    item.data.images = { image: ['a.webp'] }
    expect(colPatchValue(item, 'pic', 'Alice')).toBeNull()
    expect(colPatchValue(item, 'pic', '')).toBe('')
    expect(colPatchValue(item, 'no', '5')).toBeNull()
    expect(colPatchValue(item, 'no', '5A')).toBe('5A')
    expect(colPatchValue(item, 'brand', '')).toBeNull()
    expect(imagesPatchValue(item, 'image', ['a.webp'])).toBeNull()
    expect(imagesPatchValue(item, 'image', [])).toEqual([])
    expect(imagesPatchValue(item, 'sample', [])).toBeNull()
  })
})

describe('computeSheetAverages and effective cache', () => {
  it('computes sheet and nested section averages in one pass matching sectionItems', () => {
    const row = (pos: number, kind: MatItem['kind'], placed?: Scalar, nest: { end?: number; level?: number } = {}): MatItem => ({
      ...make(placed === undefined ? {} : { placed: v(placed), arrived: v(placed) }),
      id: `bp03-id-${pos}`,
      pos,
      kind,
      data: { cols: {}, cells: placed === undefined ? {} : { placed: v(placed), arrived: v(placed) }, ...nest },
    })
    const parent = row(9, 'section', undefined, { end: 15, level: 0 })
    const child = row(11, 'section', undefined, { end: 13, level: 1 })
    const empty = row(17, 'section', undefined, { end: 18, level: 0 })
    const items = [
      parent, row(10, 'item', 0.2), child, row(12, 'item', 0.6), row(13, 'item', 'N/A'),
      row(14, 'section', undefined, { end: 15, level: 1 }), row(15, 'item', 1.0),
      empty, row(18, 'item', 'TBC'),
    ]
    const sums = computeSheetAverages(items)
    expect(sums.sheet.placed).toBeCloseTo((0.2 + 0.6 + 1.0) / 3)
    expect(sums.byId.get(parent.id)!.placed).toBeCloseTo((0.2 + 0.6 + 1.0) / 3)
    expect(sums.byId.get(child.id)!.placed).toBeCloseTo(0.6)
    expect(sums.byId.get(empty.id)!.placed).toBeNull()
  })

  it('caches effective values per data+edits reference and updates on new edits', () => {
    const base = make({ total: v(100), po: v(40), placed: { f: 'placedPoOverTotal' } })
    const first = effective(base)
    expect(effective(base)).toBe(first)
    expect(first.placed).toBe(0.4)
    const updated = { ...base, edits: { po: 80 } }
    expect(effective(updated).placed).toBe(0.8)
  })
})
