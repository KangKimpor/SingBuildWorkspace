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

describe('TopBar', () => {
  test('omits the breadcrumb and hides the bar on desktop progress screens until sync fails', () => {
    useWorkspace.setState({ scope: 'user-1', sync: { kind: 'saved' } })
    const { container, rerender } = render(
      <MemoryRouter>
        <TopBar crumb={{ label: 'Overview', parent: 'Projects Progress' }} bp="expanded" />
      </MemoryRouter>,
    )
    expect(container.querySelector('.topbar')).toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull()
    expect(screen.queryByTestId('sync-pill')).toBeNull()

    useWorkspace.setState({ scope: 'guest', sync: { kind: 'saved' } })
    rerender(<MemoryRouter><TopBar crumb={{ label: 'Overview', parent: 'Projects Progress' }} bp="expanded" /></MemoryRouter>)
    expect(container.querySelector('.topbar')).toBeNull()
    expect(screen.queryByTestId('sync-pill')).toBeNull()

    useWorkspace.setState({ scope: 'user-1', sync: { kind: 'saving' } })
    rerender(<MemoryRouter><TopBar crumb={{ label: 'Overview', parent: 'Projects Progress' }} bp="expanded" /></MemoryRouter>)
    expect(container.querySelector('.topbar')).toBeNull()
    expect(screen.queryByTestId('sync-pill')).toBeNull()

    useWorkspace.setState({ scope: 'user-1', sync: { kind: 'offline', pending: 2 } })
    rerender(<MemoryRouter><TopBar crumb={{ label: 'Overview', parent: 'Projects Progress' }} bp="expanded" /></MemoryRouter>)
    expect(container.querySelector('.topbar')).toBeNull()
    expect(screen.queryByTestId('sync-pill')).toBeNull()

    useWorkspace.setState({ scope: 'user-1', sync: { kind: 'error', reason: 'Network timeout' } })
    rerender(<MemoryRouter><TopBar crumb={{ label: 'Overview', parent: 'Projects Progress' }} bp="expanded" /></MemoryRouter>)
    expect(container.querySelector('.topbar')).not.toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull()
    const pill = screen.getByTestId('sync-pill')
    expect(pill).toHaveAttribute('data-state', 'error')
    expect(pill).toHaveAttribute('data-tone', 'error')
    expect(pill).toHaveAttribute('title', 'Network timeout')
    expect(pill.querySelector('svg')).toBeTruthy()
    expect(pill).toHaveTextContent('Retry')
    expect(pill.textContent).not.toContain('Sync failed')
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })

  test('keeps the sidebar drawer button on tablet and command palette on non-progress, non-settings screens without a breadcrumb', () => {
    const { container, rerender } = render(
      <MemoryRouter>
        <TopBar crumb={{ label: 'NBC BP03 – Pan Pacific Hotel', parent: 'Projects Progress' }} bp="medium" />
      </MemoryRouter>,
    )
    expect(screen.getByRole('button', { name: 'Open sidebar' })).toBeTruthy()
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Open command palette' })).toBeNull()

    rerender(
      <MemoryRouter>
        <TopBar crumb={{ label: 'Settings' }} bp="expanded" />
      </MemoryRouter>,
    )
    expect(container.querySelector('.topbar')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Open command palette' })).toBeNull()

    // The material list starts its heading at the top of the page instead of under a bar holding only a search icon.
    rerender(
      <MemoryRouter>
        <TopBar crumb={{ label: 'Material list' }} bp="expanded" />
      </MemoryRouter>,
    )
    expect(container.querySelector('.topbar')).toBeNull()

    rerender(
      <MemoryRouter>
        <TopBar crumb={{ label: 'Workspace' }} bp="expanded" />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('button', { name: 'Open sidebar' })).toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Open command palette' })).toBeTruthy()
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
