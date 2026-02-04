import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { GlobalSearch } from '../GlobalSearch'
import apiClient from '@/lib/api/client'

// Mock the API client
vi.mock('@/lib/api/client', () => ({
  default: {
    get: vi.fn(),
  },
}))

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('GlobalSearch', () => {
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render when open', () => {
    render(
      <BrowserRouter>
        <GlobalSearch isOpen={true} onClose={mockOnClose} />
      </BrowserRouter>
    )

    expect(screen.getByPlaceholderText(/search incidents/i)).toBeInTheDocument()
  })

  it('should not render when closed', () => {
    render(
      <BrowserRouter>
        <GlobalSearch isOpen={false} onClose={mockOnClose} />
      </BrowserRouter>
    )

    expect(screen.queryByPlaceholderText(/search incidents/i)).not.toBeInTheDocument()
  })

  it('should show minimum character message', () => {
    render(
      <BrowserRouter>
        <GlobalSearch isOpen={true} onClose={mockOnClose} />
      </BrowserRouter>
    )

    expect(screen.getByText(/type at least 2 characters/i)).toBeInTheDocument()
  })

  it('should call onClose when ESC is pressed', () => {
    render(
      <BrowserRouter>
        <GlobalSearch isOpen={true} onClose={mockOnClose} />
      </BrowserRouter>
    )

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should perform search when typing', async () => {
    const mockResults = {
      incidents: [
        {
          id: 1,
          incidentNumber: 123,
          title: 'Test Incident',
          status: 'triggered',
          severity: 'critical',
          serviceId: 1,
          triggeredAt: '2025-01-01T10:00:00Z',
        },
      ],
      alerts: [],
      services: [],
      teams: [],
      users: [],
    }

    vi.mocked(apiClient.get).mockResolvedValue({ data: mockResults })

    render(
      <BrowserRouter>
        <GlobalSearch isOpen={true} onClose={mockOnClose} />
      </BrowserRouter>
    )

    const input = screen.getByPlaceholderText(/search incidents/i)
    fireEvent.change(input, { target: { value: 'test' } })

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/search', {
        params: { q: 'test', limit: 5 },
      })
    })

    await waitFor(() => {
      expect(screen.getByText(/Test Incident/i)).toBeInTheDocument()
    })
  })

  it('should show no results message', async () => {
    const mockResults = {
      incidents: [],
      alerts: [],
      services: [],
      teams: [],
      users: [],
    }

    vi.mocked(apiClient.get).mockResolvedValue({ data: mockResults })

    render(
      <BrowserRouter>
        <GlobalSearch isOpen={true} onClose={mockOnClose} />
      </BrowserRouter>
    )

    const input = screen.getByPlaceholderText(/search incidents/i)
    fireEvent.change(input, { target: { value: 'nonexistent' } })

    await waitFor(() => {
      expect(screen.getByText(/no results found/i)).toBeInTheDocument()
    })
  })

  it('should navigate to incident detail on click', async () => {
    const mockResults = {
      incidents: [
        {
          id: 1,
          incidentNumber: 123,
          title: 'Test Incident',
          status: 'triggered',
          severity: 'critical',
          serviceId: 1,
          triggeredAt: '2025-01-01T10:00:00Z',
        },
      ],
      alerts: [],
      services: [],
      teams: [],
      users: [],
    }

    vi.mocked(apiClient.get).mockResolvedValue({ data: mockResults })

    render(
      <BrowserRouter>
        <GlobalSearch isOpen={true} onClose={mockOnClose} />
      </BrowserRouter>
    )

    const input = screen.getByPlaceholderText(/search incidents/i)
    fireEvent.change(input, { target: { value: 'test' } })

    await waitFor(() => {
      expect(screen.getByText(/Test Incident/i)).toBeInTheDocument()
    })

    const incidentLink = screen.getByText(/Test Incident/i).closest('div')
    if (incidentLink) {
      fireEvent.click(incidentLink)
      expect(mockNavigate).toHaveBeenCalledWith('/incidents/1')
      expect(mockOnClose).toHaveBeenCalled()
    }
  })

  it('should handle search errors gracefully', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('API Error'))

    render(
      <BrowserRouter>
        <GlobalSearch isOpen={true} onClose={mockOnClose} />
      </BrowserRouter>
    )

    const input = screen.getByPlaceholderText(/search incidents/i)
    fireEvent.change(input, { target: { value: 'test' } })

    await waitFor(() => {
      // Should not crash and should show no results
      expect(screen.queryByText(/Test Incident/i)).not.toBeInTheDocument()
    })
  })

  it('should debounce search input', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        incidents: [],
        alerts: [],
        services: [],
        teams: [],
        users: [],
      },
    })

    render(
      <BrowserRouter>
        <GlobalSearch isOpen={true} onClose={mockOnClose} />
      </BrowserRouter>
    )

    const input = screen.getByPlaceholderText(/search incidents/i)

    // Type multiple characters quickly
    fireEvent.change(input, { target: { value: 't' } })
    fireEvent.change(input, { target: { value: 'te' } })
    fireEvent.change(input, { target: { value: 'tes' } })
    fireEvent.change(input, { target: { value: 'test' } })

    // Should only call API once after debounce
    await waitFor(
      () => {
        expect(apiClient.get).toHaveBeenCalledTimes(1)
      },
      { timeout: 500 }
    )
  })
})
