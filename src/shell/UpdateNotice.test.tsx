import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { useInstall } from '@/lib/install'
import { UpdateNotice } from './UpdateNotice'

afterEach(() => useInstall.setState({ update: null }))

test('shows progress while an update applies automatically', () => {
  const apply = vi.fn().mockResolvedValue(undefined)
  useInstall.setState({ update: { status: 'pending', apply } })
  render(<UpdateNotice />)
  expect(screen.getByText('Update ready. Reloading automatically…')).toBeInTheDocument()
  expect(document.querySelector('.update-notice .spinner')).toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(apply).not.toHaveBeenCalled()
})

test('keeps showing progress once activation starts', () => {
  useInstall.setState({ update: { status: 'installing', apply: vi.fn().mockResolvedValue(undefined) } })
  render(<UpdateNotice />)
  expect(screen.getByRole('status')).toHaveTextContent('Updating to the latest version…')
})

test('failed updates offer a retry', () => {
  const apply = vi.fn().mockResolvedValue(undefined)
  useInstall.setState({ update: { status: 'failed', apply } })
  render(<UpdateNotice />)
  expect(screen.getByText('Update failed. Reload to finish updating.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(apply).toHaveBeenCalledTimes(1)
})

test('renders nothing when no update is waiting', () => {
  useInstall.setState({ update: null })
  const { container } = render(<UpdateNotice />)
  expect(container).toBeEmptyDOMElement()
})
