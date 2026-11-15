import { useMemo } from 'react'
import type { MatItem, Sheet } from './types'

interface NoteBlock { key: string; heading: string[]; header: string[] | null; rows: { key: string; cells: string[] }[] }

/**
 * The Review and Change Log sheets are stacked lists: a one-cell line introduces a list,
 * the next line is its column header, and the lines after it are its rows.
 */
export function noteBlocks(items: MatItem[], sheet: Sheet): NoteBlock[] {
  const blocks: NoteBlock[] = []
  let block: NoteBlock | null = null
  for (const item of items) {
    if (item.sheet !== sheet || item.kind !== 'note') continue
    const cells = (item.data.note ?? []).map((cell) => String(cell ?? ''))
    if (cells.filter((cell) => cell.trim()).length <= 1) {
      // Consecutive one-cell lines (a title and its explanation) belong to the same heading.
      if (block && !block.header && !block.rows.length) block.heading.push(cells.join(' ').trim())
      else blocks.push((block = { key: item.id, heading: [cells.join(' ').trim()], header: null, rows: [] }))
      continue
    }
    if (!block) blocks.push((block = { key: item.id, heading: [], header: null, rows: [] }))
    if (!block.header) block.header = cells
    else block.rows.push({ key: item.id, cells })
  }
  return blocks
}

export function MatNotes({ items, sheet }: { items: MatItem[]; sheet: Sheet }) {
  const blocks = useMemo(() => noteBlocks(items, sheet), [items, sheet])
  if (!blocks.length) return <p className="mat-empty">Nothing was recorded on this sheet.</p>
  return (
    <div className="mat-notes">
      {blocks.map((block) => {
        const width = Math.max(block.header?.length ?? 0, ...block.rows.map((row) => row.cells.length))
        const pad = (cells: string[]) => Array.from({ length: width }, (_, index) => cells[index] ?? '')
        return (
          <section key={block.key}>
            {block.heading.map((line, index) =>
              index === 0 ? <h2 key={index} className="mat-summary-title">{line}</h2> : <p key={index} className="mat-summary-note">{line}</p>,
            )}
            {block.header && (
              <div className="mat-plain-scroll">
                <table className="mat-plain mat-plain-text">
                  <thead>
                    <tr>{pad(block.header).map((cell, index) => <th key={index} scope="col">{cell}</th>)}</tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row) => (
                      <tr key={row.key}>{pad(row.cells).map((cell, index) => <td key={index}>{cell}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
