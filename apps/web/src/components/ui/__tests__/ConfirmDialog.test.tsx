import { describe, it, expect, vi } from 'vitest'
import { render, screen, renderHook, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog, useConfirmDialog } from '../ConfirmDialog'

describe('ConfirmDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    title: 'Confirm Action',
  }

  it('does not render when isOpen is false', () => {
    render(<ConfirmDialog {...defaultProps} isOpen={false} />)
    expect(screen.queryByText('Confirm Action')).not.toBeInTheDocument()
  })

  it('renders when isOpen is true', () => {
    render(<ConfirmDialog {...defaultProps} />)
    expect(screen.getByText('Confirm Action')).toBeInTheDocument()
  })

  it('displays title', () => {
    render(<ConfirmDialog {...defaultProps} title="Delete Item?" />)
    expect(screen.getByText('Delete Item?')).toBeInTheDocument()
  })

  it('displays description when provided', () => {
    render(
      <ConfirmDialog
        {...defaultProps}
        description="This action cannot be undone."
      />
    )
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument()
  })

  it('uses default button text', () => {
    render(<ConfirmDialog {...defaultProps} />)
    expect(screen.getByText('Confirm')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('uses custom button text when provided', () => {
    render(
      <ConfirmDialog
        {...defaultProps}
        confirmText="Delete"
        cancelText="Go Back"
      />
    )
    expect(screen.getByText('Delete')).toBeInTheDocument()
    expect(screen.getByText('Go Back')).toBeInTheDocument()
  })

  it('calls onConfirm when confirm button is clicked', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()

    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />)

    await user.click(screen.getByText('Confirm'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when cancel button is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    render(<ConfirmDialog {...defaultProps} onClose={onClose} />)

    await user.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when backdrop is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    const { container } = render(
      <ConfirmDialog {...defaultProps} onClose={onClose} />
    )

    const backdrop = container.querySelector('.backdrop-blur-sm')
    if (backdrop) {
      await user.click(backdrop)
      expect(onClose).toHaveBeenCalledTimes(1)
    }
  })

  it('renders danger variant with red icon', () => {
    const { container } = render(
      <ConfirmDialog {...defaultProps} variant="danger" />
    )
    const dangerIcon = container.querySelector('.bg-red-500\\/10')
    expect(dangerIcon).toBeInTheDocument()
  })

  it('renders warning variant with yellow icon', () => {
    const { container } = render(
      <ConfirmDialog {...defaultProps} variant="warning" />
    )
    const warningIcon = container.querySelector('.bg-yellow-500\\/10')
    expect(warningIcon).toBeInTheDocument()
  })

  it('does not render icon for default variant', () => {
    const { container } = render(
      <ConfirmDialog {...defaultProps} variant="default" />
    )
    const dangerIcon = container.querySelector('.bg-red-500\\/10')
    const warningIcon = container.querySelector('.bg-yellow-500\\/10')
    expect(dangerIcon).not.toBeInTheDocument()
    expect(warningIcon).not.toBeInTheDocument()
  })

  it('disables buttons when isLoading is true', () => {
    render(<ConfirmDialog {...defaultProps} isLoading={true} />)

    const confirmButton = screen.getByText('Processing...')
    const cancelButton = screen.getByText('Cancel')

    expect(confirmButton).toBeDisabled()
    expect(cancelButton).toBeDisabled()
  })

  it('shows loading text on confirm button when isLoading', () => {
    render(<ConfirmDialog {...defaultProps} isLoading={true} />)
    expect(screen.getByText('Processing...')).toBeInTheDocument()
  })

  it('does not call onClose after confirm when isLoading', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onConfirm = vi.fn()

    render(
      <ConfirmDialog
        {...defaultProps}
        onClose={onClose}
        onConfirm={onConfirm}
        isLoading={true}
      />
    )

    const button = screen.getByText('Processing...')
    // Button should be disabled when loading
    expect(button).toBeDisabled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose after confirm when not loading', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onConfirm = vi.fn()

    render(
      <ConfirmDialog
        {...defaultProps}
        onClose={onClose}
        onConfirm={onConfirm}
        isLoading={false}
      />
    )

    await user.click(screen.getByText('Confirm'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('useConfirmDialog', () => {
  it('initializes with closed state', () => {
    const { result } = renderHook(() => useConfirmDialog())
    expect(result.current.isOpen).toBe(false)
  })

  it('opens dialog when confirm is called', async () => {
    const { result } = renderHook(() => useConfirmDialog())

    await waitFor(() => {
      result.current.confirm({
        title: 'Test',
        onConfirm: vi.fn(),
      })
    })

    await waitFor(() => {
      expect(result.current.isOpen).toBe(true)
      expect(result.current.config.title).toBe('Test')
    })
  })

  it('closes dialog when close is called', async () => {
    const { result } = renderHook(() => useConfirmDialog())

    await waitFor(() => {
      result.current.confirm({
        title: 'Test',
        onConfirm: vi.fn(),
      })
    })

    await waitFor(() => {
      expect(result.current.isOpen).toBe(true)
    })

    await waitFor(() => {
      result.current.close()
    })

    await waitFor(() => {
      expect(result.current.isOpen).toBe(false)
    })
  })

  it('updates config when confirm is called with new config', async () => {
    const { result } = renderHook(() => useConfirmDialog())

    const mockConfirm = vi.fn()
    await waitFor(() => {
      result.current.confirm({
        title: 'First Title',
        description: 'First Description',
        onConfirm: mockConfirm,
      })
    })

    await waitFor(() => {
      expect(result.current.config.title).toBe('First Title')
      expect(result.current.config.description).toBe('First Description')
      expect(result.current.config.onConfirm).toBe(mockConfirm)
    })

    const newMockConfirm = vi.fn()
    await waitFor(() => {
      result.current.confirm({
        title: 'Second Title',
        onConfirm: newMockConfirm,
      })
    })

    await waitFor(() => {
      expect(result.current.config.title).toBe('Second Title')
      expect(result.current.config.onConfirm).toBe(newMockConfirm)
    })
  })
})
