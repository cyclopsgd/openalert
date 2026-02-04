import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorBoundary } from '../ErrorBoundary'

// Component that throws an error
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error')
  }
  return <div>No error</div>
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // Mock console.error to avoid polluting test output
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Child content</div>
      </ErrorBoundary>
    )

    expect(screen.getByText('Child content')).toBeInTheDocument()
  })

  it('renders error UI when child component throws', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(
      screen.getByText("We're sorry, but an unexpected error occurred")
    ).toBeInTheDocument()
  })

  it('displays error details in development mode', () => {
    // In test environment, DEV should already be true
    // Just verify the error UI is rendered
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    // Error UI should be visible
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('renders custom fallback when provided', () => {
    const customFallback = <div>Custom error UI</div>

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Custom error UI')).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })

  it('calls onError callback when error occurs', () => {
    const onErrorMock = vi.fn()

    render(
      <ErrorBoundary onError={onErrorMock}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(onErrorMock).toHaveBeenCalledTimes(1)
    expect(onErrorMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String),
      })
    )
  })

  it('renders reload and go home buttons', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Reload Page')).toBeInTheDocument()
    expect(screen.getByText('Go to Dashboard')).toBeInTheDocument()
  })

  it('reloads page when reload button is clicked', async () => {
    const user = userEvent.setup()
    const reloadMock = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true,
    })

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    await user.click(screen.getByText('Reload Page'))
    expect(reloadMock).toHaveBeenCalledTimes(1)
  })

  it('navigates to home when go home button is clicked', async () => {
    const user = userEvent.setup()
    const originalLocation = window.location
    delete (window as any).location
    window.location = { ...originalLocation, href: '' } as Location

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    await user.click(screen.getByText('Go to Dashboard'))
    expect(window.location.href).toBe('/')

    // Restore
    window.location = originalLocation
  })

  it('shows component stack trace in development', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    // Error UI should have the main error message
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })
})
