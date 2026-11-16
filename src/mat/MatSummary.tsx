import { useMemo } from 'react'
import { average, effective, formatCell, sectionItems } from './formulas'
import { sectionLabel } from './MatTable'
import { PCT_CELLS, type CellKey, type MatItem, type Sheet } from './types'

export { sectionLabel } from './MatTable'

const SHEETS: { sheet: Sheet; title: string }[] = [
  { sheet: 'id', title: 'ID Material' },
  { sheet: 'mep', title: 'MEP Material' },
]
export const PCT_LABELS: Record<(typeof PCT_CELLS)[number], string> = {
  notYetPo: 'Not yet PO',
  placed: 'Placed order',
  production: 'Production in progress',
  waiting: 'Waiting for shipment',
  shipping: 'Shipping on the way',
  arrived: 'Arrived WH & site',
}
// The workbook's Summary lists the main categories and their first level of sub-categories.
const DEEPEST_LEVEL = 1

interface SummaryRow { key: string; label: string; level: number; count: number; values: Record<string, string> }

/** Items that have a number in Placed Order, as the workbook's "No. of items" counts them. */
const counted = (items: MatItem[]) => items.filter((item) => typeof effective(item).placed === 'number').length

function summarise(key: string, label: string, level: number, items: MatItem[]): SummaryRow {
  const values = Object.fromEntries(PCT_CELLS.map((cell: CellKey) => [cell, formatCell(cell, average(items, cell))]))
  return { key, label, level, count: counted(items), values }
}

export function summaryRows(items: MatItem[], sheet: Sheet, title: string): SummaryRow[] {
  const rows = items.filter((item) => item.sheet === sheet)
  const sections = rows.filter((item) => item.kind === 'section' && (item.data.level ?? 0) <= DEEPEST_LEVEL)
  return [
    summarise(`${sheet}-all`, `${title} overall`, -1, rows.filter((item) => item.kind === 'item')),
    ...sections.map((section) =>
      summarise(section.id, sectionLabel(section), section.data.level ?? 0, sectionItems(rows, section)),
    ),
  ]
}

export function MatSummary({ items }: { items: MatItem[] }) {
  const blocks = useMemo(
    () => SHEETS.map(({ sheet, title }) => ({ sheet, title, rows: summaryRows(items, sheet, title) })),
    [items],
  )
  return (
    <div className="mat-summary">
      <p className="small muted mat-summary-note">Averages of the materials that have a figure, worked out the same way as the workbook's Summary sheet.</p>
      {blocks.map(({ sheet, title, rows }) => (
        <section key={sheet} aria-label={title}>
          <div className="section-title"><h2>{title}</h2></div>
          <div className="mat-plain-scroll">
            <table className="mat-plain">
              <caption className="sr-only">{title} summary</caption>
              <thead>
                <tr>
                  <th scope="col">Description</th>
                  <th scope="col" className="mat-plain-num">Items with a figure</th>
                  {PCT_CELLS.map((cell) => <th key={cell} scope="col" className="mat-plain-num">{PCT_LABELS[cell]}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} data-level={row.level}>
                    <th scope="row" style={{ paddingLeft: 12 + Math.max(0, row.level) * 16 }}>{row.label}</th>
                    <td className="mat-plain-num">{row.count}</td>
                    {PCT_CELLS.map((cell) => <td key={cell} className="mat-plain-num">{row.values[cell]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  )
}
