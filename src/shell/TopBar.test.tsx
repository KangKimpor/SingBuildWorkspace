import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, test } from 'vitest'
import { emptyContent, useWorkspace } from '@/data'
import { fixtureActivities, fixtureProject } from '@/nbc/test-fixture'
import { TopBar } from './TopBar'
import { SidebarContent } from './SidebarContent'

afterEach(() => {
  useWorkspace.setState({ ...structuredClone(emptyContent), scope: 'guest', sync: { kind: 'saved' } })
})

describe('TopBar cloud sync indicator', () => {
  test('stays hidden for saved, local, saving, and offline states, and shows only the icon and Retry button on error', () => {
    useWorkspace.setState({ scope: 'user-1', sync: { kind: 'saved' } })
    const { rerender } = render(
      <MemoryRouter>
        <TopBar crumb={{ label: 'Overview', parent: 'Projects Progress' }} bp="expanded" />
      </MemoryRouter>,
    )
    expect(screen.queryByTestId('sync-pill')).toBeNull()

    useWorkspace.setState({ scope: 'guest', sync: { kind: 'saved' } })
    rerender(<MemoryRouter><TopBar crumb={{ label: 'Overview', parent: 'Projects Progress' }} bp="expanded" /></MemoryRouter>)
    expect(screen.queryByTestId('sync-pill')).toBeNull()

    useWorkspace.setState({ scope: 'user-1', sync: { kind: 'saving' } })
    rerender(<MemoryRouter><TopBar crumb={{ label: 'Overview', parent: 'Projects Progress' }} bp="expanded" /></MemoryRouter>)
    expect(screen.queryByTestId('sync-pill')).toBeNull()

    useWorkspace.setState({ scope: 'user-1', sync: { kind: 'offline', pending: 2 } })
    rerender(<MemoryRouter><TopBar crumb={{ label: 'Overview', parent: 'Projects Progress' }} bp="expanded" /></MemoryRouter>)
    expect(screen.queryByTestId('sync-pill')).toBeNull()

    useWorkspace.setState({ scope: 'user-1', sync: { kind: 'error', reason: 'Network timeout' } })
    rerender(<MemoryRouter><TopBar crumb={{ label: 'Overview', parent: 'Projects Progress' }} bp="expanded" /></MemoryRouter>)
    const pill = screen.getByTestId('sync-pill')
    expect(pill).toHaveAttribute('data-state', 'error')
    expect(pill).toHaveAttribute('data-tone', 'error')
    expect(pill).toHaveAttribute('title', 'Network timeout')
    expect(pill.querySelector('svg')).toBeTruthy()
    expect(pill).toHaveTextContent('Retry')
    expect(pill.textContent).not.toContain('Sync failed')
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })
})

describe('SidebarContent', () => {
  test('omits the needs-attention count badge on the Overview tab', () => {
    useWorkspace.setState({
      ...structuredClone(emptyContent),
      scope: 'guest',
      projects: [fixtureProject],
      nbc_activities: fixtureActivities(),
    })
    render(
      <MemoryRouter initialEntries={['/projects-progress/nbc-bp03/overview']}>
        <SidebarContent />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Overview' })).toBeTruthy()
    expect(document.querySelector('.nav-badge')).toBeNull()
    expect(screen.queryByText(/needing attention/i)).toBeNull()
  })
})
