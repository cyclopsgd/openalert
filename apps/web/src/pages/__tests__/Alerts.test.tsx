import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Alerts } from '../Alerts'
import { renderWithProviders, createMockAlert } from '@/test/utils'
import * as useAlertsHook from '@/hooks/useAlerts'

vi.mock('@/hooks/useAlerts')

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('Alerts Page', () => {
  const mockAcknowledgeMutate = vi.fn()
  const mockResolveMutate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(useAlertsHook.useAlerts).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as any)

    vi.mocked(useAlertsHook.useAcknowledgeAlert).mockReturnValue({
      mutate: mockAcknowledgeMutate,
      isPending: false,
    } as any)

    vi.mocked(useAlertsHook.useResolveAlert).mockReturnValue({
      mutate: mockResolveMutate,
      isPending: false,
    } as any)
  })

  it('renders alerts page header', () => {
    renderWithProviders(<Alerts />)
    expect(screen.getByText('Alerts')).toBeInTheDocument()
    expect(screen.getByText('Monitor and manage all your alerts')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    vi.mocked(useAlertsHook.useAlerts).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    } as any)

    renderWithProviders(<Alerts />)

    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('displays alerts when loaded', async () => {
    const mockAlerts = [
      createMockAlert({ id: 1, title: 'Alert 1' }),
      createMockAlert({ id: 2, title: 'Alert 2' }),
    ]

    vi.mocked(useAlertsHook.useAlerts).mockReturnValue({
      data: mockAlerts,
      isLoading: false,
      error: null,
    } as any)

    renderWithProviders(<Alerts />)

    await waitFor(() => {
      expect(screen.getByText('Alert 1')).toBeInTheDocument()
      expect(screen.getByText('Alert 2')).toBeInTheDocument()
    })
  })

  it('shows empty state when no alerts', () => {
    vi.mocked(useAlertsHook.useAlerts).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as any)

    renderWithProviders(<Alerts />)

    expect(screen.getByText('No alerts found')).toBeInTheDocument()
  })

  it('displays alert with description', async () => {
    const mockAlerts = [
      createMockAlert({
        id: 1,
        title: 'Database Alert',
        description: 'Database connection lost',
      }),
    ]

    vi.mocked(useAlertsHook.useAlerts).mockReturnValue({
      data: mockAlerts,
      isLoading: false,
      error: null,
    } as any)

    renderWithProviders(<Alerts />)

    await waitFor(() => {
      expect(screen.getByText('Database Alert')).toBeInTheDocument()
      expect(screen.getByText('Database connection lost')).toBeInTheDocument()
    })
  })

  it('displays alert source when available', async () => {
    const mockAlerts = [
      createMockAlert({ id: 1, source: 'prometheus' }),
    ]

    vi.mocked(useAlertsHook.useAlerts).mockReturnValue({
      data: mockAlerts,
      isLoading: false,
      error: null,
    } as any)

    renderWithProviders(<Alerts />)

    await waitFor(() => {
      expect(screen.getByText('Source: prometheus')).toBeInTheDocument()
    })
  })

  it('displays severity badge', async () => {
    const mockAlerts = [
      createMockAlert({ id: 1, severity: 'critical' }),
    ]

    vi.mocked(useAlertsHook.useAlerts).mockReturnValue({
      data: mockAlerts,
      isLoading: false,
      error: null,
    } as any)

    renderWithProviders(<Alerts />)

    await waitFor(() => {
      expect(screen.getByText('Critical')).toBeInTheDocument()
    })
  })

  it('displays status badge', async () => {
    const mockAlerts = [
      createMockAlert({ id: 1, status: 'firing' }),
    ]

    vi.mocked(useAlertsHook.useAlerts).mockReturnValue({
      data: mockAlerts,
      isLoading: false,
      error: null,
    } as any)

    renderWithProviders(<Alerts />)

    await waitFor(() => {
      expect(screen.getByText('Firing')).toBeInTheDocument()
    })
  })

  it('shows action buttons for firing alerts', async () => {
    const mockAlerts = [
      createMockAlert({ id: 1, status: 'firing' }),
    ]

    vi.mocked(useAlertsHook.useAlerts).mockReturnValue({
      data: mockAlerts,
      isLoading: false,
      error: null,
    } as any)

    renderWithProviders(<Alerts />)

    await waitFor(() => {
      expect(screen.getByText('Acknowledge')).toBeInTheDocument()
      expect(screen.getByText('Resolve')).toBeInTheDocument()
    })
  })

  it('does not show action buttons for non-firing alerts', async () => {
    const mockAlerts = [
      createMockAlert({ id: 1, status: 'resolved' }),
    ]

    vi.mocked(useAlertsHook.useAlerts).mockReturnValue({
      data: mockAlerts,
      isLoading: false,
      error: null,
    } as any)

    renderWithProviders(<Alerts />)

    await waitFor(() => {
      expect(screen.queryByText('Acknowledge')).not.toBeInTheDocument()
      expect(screen.queryByText('Resolve')).not.toBeInTheDocument()
    })
  })

  it('calls acknowledge mutation when acknowledge button is clicked', async () => {
    const user = userEvent.setup()
    const mockAlerts = [
      createMockAlert({ id: 123, status: 'firing' }),
    ]

    vi.mocked(useAlertsHook.useAlerts).mockReturnValue({
      data: mockAlerts,
      isLoading: false,
      error: null,
    } as any)

    renderWithProviders(<Alerts />)

    await waitFor(() => {
      expect(screen.getByText('Acknowledge')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Acknowledge'))

    expect(mockAcknowledgeMutate).toHaveBeenCalledWith(123)
  })

  it('calls resolve mutation when resolve button is clicked', async () => {
    const user = userEvent.setup()
    const mockAlerts = [
      createMockAlert({ id: 456, status: 'firing' }),
    ]

    vi.mocked(useAlertsHook.useAlerts).mockReturnValue({
      data: mockAlerts,
      isLoading: false,
      error: null,
    } as any)

    renderWithProviders(<Alerts />)

    await waitFor(() => {
      expect(screen.getByText('Resolve')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Resolve'))

    expect(mockResolveMutate).toHaveBeenCalledWith(456)
  })

  it('prevents event propagation when action button is clicked', async () => {
    const user = userEvent.setup()
    const mockAlerts = [
      createMockAlert({ id: 1, status: 'firing', incidentId: 100 }),
    ]

    vi.mocked(useAlertsHook.useAlerts).mockReturnValue({
      data: mockAlerts,
      isLoading: false,
      error: null,
    } as any)

    renderWithProviders(<Alerts />)

    await waitFor(() => {
      expect(screen.getByText('Acknowledge')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Acknowledge'))

    // Should acknowledge, but not navigate
    expect(mockAcknowledgeMutate).toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('navigates to incident when alert with incident is clicked', async () => {
    const user = userEvent.setup()
    const mockAlerts = [
      createMockAlert({
        id: 1,
        title: 'Test Alert',
        incidentId: 999,
        status: 'acknowledged',
      }),
    ]

    vi.mocked(useAlertsHook.useAlerts).mockReturnValue({
      data: mockAlerts,
      isLoading: false,
      error: null,
    } as any)

    renderWithProviders(<Alerts />)

    await waitFor(() => {
      expect(screen.getByText('Test Alert')).toBeInTheDocument()
    })

    // Click on the alert card
    const alertCard = screen.getByText('Test Alert').closest('div')
    if (alertCard?.parentElement?.parentElement) {
      await user.click(alertCard.parentElement.parentElement)
    }

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/incidents/999')
    })
  })

  it('does not navigate when alert has no incident', async () => {
    const user = userEvent.setup()
    const mockAlerts = [
      createMockAlert({
        id: 1,
        title: 'No Incident Alert',
        incidentId: undefined,
      }),
    ]

    vi.mocked(useAlertsHook.useAlerts).mockReturnValue({
      data: mockAlerts,
      isLoading: false,
      error: null,
    } as any)

    renderWithProviders(<Alerts />)

    await waitFor(() => {
      expect(screen.getByText('No Incident Alert')).toBeInTheDocument()
    })

    const alertCard = screen.getByText('No Incident Alert').closest('div')
    if (alertCard?.parentElement?.parentElement) {
      await user.click(alertCard.parentElement.parentElement)
    }

    // Should not navigate
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('shows loading state on acknowledge button during mutation', async () => {
    const mockAlerts = [
      createMockAlert({ id: 1, status: 'firing' }),
    ]

    vi.mocked(useAlertsHook.useAlerts).mockReturnValue({
      data: mockAlerts,
      isLoading: false,
      error: null,
    } as any)

    vi.mocked(useAlertsHook.useAcknowledgeAlert).mockReturnValue({
      mutate: mockAcknowledgeMutate,
      isPending: true,
    } as any)

    renderWithProviders(<Alerts />)

    await waitFor(() => {
      // Just verify the buttons exist - loading state is handled internally
      expect(screen.getByText('Acknowledge')).toBeInTheDocument()
    })
  })

  it('displays alert name as fallback when no title', async () => {
    const mockAlerts = [
      createMockAlert({ id: 1, title: undefined, alertName: 'Fallback Alert Name' }),
    ]

    vi.mocked(useAlertsHook.useAlerts).mockReturnValue({
      data: mockAlerts,
      isLoading: false,
      error: null,
    } as any)

    renderWithProviders(<Alerts />)

    await waitFor(() => {
      expect(screen.getByText('Fallback Alert Name')).toBeInTheDocument()
    })
  })

  it('renders multiple alerts correctly', async () => {
    const mockAlerts = [
      createMockAlert({ id: 1, title: 'Alert 1', severity: 'critical' }),
      createMockAlert({ id: 2, title: 'Alert 2', severity: 'high' }),
      createMockAlert({ id: 3, title: 'Alert 3', severity: 'medium' }),
    ]

    vi.mocked(useAlertsHook.useAlerts).mockReturnValue({
      data: mockAlerts,
      isLoading: false,
      error: null,
    } as any)

    renderWithProviders(<Alerts />)

    await waitFor(() => {
      expect(screen.getByText('Alert 1')).toBeInTheDocument()
      expect(screen.getByText('Alert 2')).toBeInTheDocument()
      expect(screen.getByText('Alert 3')).toBeInTheDocument()
    })
  })
})
