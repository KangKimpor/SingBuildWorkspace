import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import Trend from './Trend'

const summary = { projectId: 'nbc-bp03', previous: .1, contributions: {}, updatedAt: '' }

test('actual points come only from confirmed summaries in week order, drawn against the plan, with a table view', () => {
  render(<Trend today="2026-10-28" summaries={[
    { ...summary, id: 'later', weekStart: '2026-10-25', overall: .4 },
    { ...summary, id: 'earlier', weekStart: '2026-10-18', overall: .2 },
  ]}/>)
  const chart = screen.getByRole('img')
  expect(chart.querySelector('[data-series=plan]')?.getAttribute('data-points')?.split(' ')).toHaveLength(15)
  expect(chart.querySelector('[data-series=actual]')?.getAttribute('data-points')?.split(' ')).toHaveLength(2)
  expect(chart.querySelectorAll('circle')).toHaveLength(2)
  expect(chart.textContent).toContain('Deadline 20 Jun 2026')
  fireEvent.click(screen.getByRole('button', { name: 'View as table' }))
  expect(screen.getAllByRole('row').slice(1).map((row) => row.textContent)).toEqual(['18 Oct – 24 Oct100.00%20.00%▲ +10.00%', '25 Oct – 31 Oct100.00%40.00%▲ +30.00%'])
})

test('hovering a past week shows its percentage, change and planned progress', () => {
  render(<Trend today="2026-10-28" summaries={[
    { ...summary, id: 'later', weekStart: '2026-10-25', previous: .2, overall: .4 },
    { ...summary, id: 'earlier', weekStart: '2026-10-18', previous: .1, overall: .2 },
  ]}/>)
  const plot = document.querySelector('.nbc-trend-plot') as HTMLElement
  expect(plot.querySelector('.nbc-trend-tip')).toBeNull()
  const circles = plot.querySelectorAll('circle')
  expect(circles).toHaveLength(2)
  fireEvent.mouseEnter(circles[0]!)
  const tip = plot.querySelector('.nbc-trend-tip') as HTMLElement
  expect(tip).not.toBeNull()
  expect(tip.textContent).toContain('18 Oct – 24 Oct')
  expect(tip.textContent).toContain('20.00%')
  expect(tip.textContent).toContain('Plan 100.00%')
  fireEvent.mouseLeave(plot)
  expect(plot.querySelector('.nbc-trend-tip')).toBeNull()
})

test('empty history still shows the plan and says there are no confirmed weeks', () => {
  render(<Trend summaries={[]}/>)
  expect(screen.getByRole('img').getAttribute('aria-label')).toContain('No confirmed reporting weeks')
  expect(document.querySelectorAll('.nbc-trend circle')).toHaveLength(0)
  expect(document.querySelector('[data-series=plan]')).toBeTruthy()
})
