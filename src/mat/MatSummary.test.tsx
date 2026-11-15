import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MatNotes, noteBlocks } from './MatNotes'
import { MatSummary, summaryRows } from './MatSummary'
import type { MatData, MatItem, Scalar } from './types'

let row = 0
function make(kind: MatItem['kind'], data: Partial<MatData>, sheet: MatItem['sheet'] = 'id'): MatItem {
  row += 1
  return { id: `bp03-${sheet}-${row}`, package: 'bp03', sheet, pos: row, kind, data: { cols: {}, cells: {}, ...data }, edits: {}, updatedAt: '2026-11-15T00:00:00Z' }
}
const section = (label: string, level: number, end: number) => make('section', { cols: { code: label }, level, end })
const material = (placed: Scalar) => make('item', { cols: { code: 'X-1' }, cells: { placed: { v: placed }, arrived: { v: placed } } })

function fixture() {
  row = 0
  return [
    section('Wall finishing', 0, 4), // pos 1, covers 2..4
    material(0.2), //                    pos 2
    section('Tiles', 1, 4), //           pos 3, covers 4
    material(0.6), //                    pos 4
    section('Loose furniture', 0, 6), // pos 5, covers 6
    material('N/A'), //                  pos 6
  ]
}

describe('summaryRows', () => {
  it('averages each section over the materials it covers, nested ones included', () => {
    const rows = summaryRows(fixture(), 'id', 'ID Material')
    expect(rows.map((r) => [r.label, r.count, r.values.placed])).toEqual([
      ['ID Material overall', 2, '40%'],
      ['Wall finishing', 2, '40%'],
      ['Tiles', 1, '60%'],
      ['Loose furniture', 0, ''],
    ])
  })
  it('leaves out sections deeper than the first sub-level', () => {
    const items = [...fixture(), make('section', { cols: { code: 'Deep' }, level: 2, end: 99 })]
    expect(summaryRows(items, 'id', 'ID Material').map((r) => r.label)).not.toContain('Deep')
  })
})

describe('MatSummary', () => {
  it('shows a block per sheet with an empty cell where a section has no figure', () => {
    render(<MatSummary items={fixture()} />)
    const block = screen.getByRole('region', { name: 'ID Material' })
    const loose = within(block).getByRole('row', { name: /Loose furniture/ })
    expect(within(loose).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['0', '', '', '', '', '', ''])
    expect(within(block).getByRole('row', { name: /Wall finishing/ })).toHaveTextContent('40%')
    expect(screen.getByRole('region', { name: 'MEP Material' })).toBeInTheDocument()
  })
})

describe('notes', () => {
  const note = (cells: string[]) => make('note', { note: cells }, 'changelog')
  it('groups a heading, its column header and its rows', () => {
    row = 0
    const items = [note(['Change log']), note(['1. Copied values']), note(['Row', 'Material', 'New value']), note(['12', 'X-1']), note(['2. Other']), note(['Row', 'Remark']), note(['3', 'Checked'])]
    const blocks = noteBlocks(items, 'changelog')
    expect(blocks.map((b) => [b.heading, b.header, b.rows.length])).toEqual([
      [['Change log', '1. Copied values'], ['Row', 'Material', 'New value'], 1],
      [['2. Other'], ['Row', 'Remark'], 1],
    ])
    render(<MatNotes items={items} sheet="changelog" />)
    expect(screen.getByRole('heading', { name: 'Change log' })).toBeInTheDocument()
    // A short row is padded to the header's width.
    expect(within(screen.getByRole('row', { name: /12 X-1/ })).getAllByRole('cell')).toHaveLength(3)
  })
  it('says so when the sheet is empty', () => {
    render(<MatNotes items={[]} sheet="review" />)
    expect(screen.getByText('Nothing was recorded on this sheet.')).toBeInTheDocument()
  })
})
