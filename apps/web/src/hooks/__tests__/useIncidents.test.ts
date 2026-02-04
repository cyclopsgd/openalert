import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import {
  useIncidents,
  useIncident,
  useAcknowledgeIncident,
  useResolveIncident,
  useBulkAcknowledgeIncidents,
  useBulkResolveIncidents,
} from '../useIncidents'
import { apiClient } from '@/lib/api/client'
import { createMockIncident } from '@/test/utils'
import * as incidentsStore from '@/stores/incidentsStore'

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
  },
}))

vi.mock('@/stores/incidentsStore', () => ({
  useIncidentsStore: vi.fn(() => ({
    filters: {
      status: [],
      severity: [],
      search: '',
      dateRange: 'all',
      sortBy: 'newest',
    },
  })),
}))

describe('useIncidents', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    vi.clearAllMocks()
  })

  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }

  it('fetches incidents successfully', async () => {
    const mockIncidents = [createMockIncident(), createMockIncident({ id: 2 })]
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockIncidents })

    const { result } = renderHook(() => useIncidents(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toEqual(mockIncidents)
    expect(apiClient.get).toHaveBeenCalledWith('/incidents')
  })

  it('applies status filters', async () => {
    vi.mocked(incidentsStore.useIncidentsStore).mockReturnValue({
      filters: {
        status: ['triggered', 'acknowledged'],
        severity: [],
        search: '',
        dateRange: 'all',
        sortBy: 'newest',
      },
    } as any)

    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [] })

    renderHook(() => useIncidents(), { wrapper })

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalled()
    })

    const callArg = vi.mocked(apiClient.get).mock.calls[0][0]
    expect(callArg).toContain('status=triggered')
    expect(callArg).toContain('status=acknowledged')
  })

  it('applies severity filters', async () => {
    vi.mocked(incidentsStore.useIncidentsStore).mockReturnValue({
      filters: {
        status: [],
        severity: ['critical', 'high'],
        search: '',
        dateRange: 'all',
        sortBy: 'newest',
      },
    } as any)

    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [] })

    renderHook(() => useIncidents(), { wrapper })

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalled()
    })

    const callArg = vi.mocked(apiClient.get).mock.calls[0][0]
    expect(callArg).toContain('severity=critical')
    expect(callArg).toContain('severity=high')
  })

  it('applies search filter', async () => {
    vi.mocked(incidentsStore.useIncidentsStore).mockReturnValue({
      filters: {
        status: [],
        severity: [],
        search: 'test search',
        dateRange: 'all',
        sortBy: 'newest',
      },
    } as any)

    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [] })

    renderHook(() => useIncidents(), { wrapper })

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalled()
    })

    const callArg = vi.mocked(apiClient.get).mock.calls[0][0]
    expect(callArg).toContain('search=test+search')
  })

  it('applies date range filter', async () => {
    vi.mocked(incidentsStore.useIncidentsStore).mockReturnValue({
      filters: {
        status: [],
        severity: [],
        search: '',
        dateRange: '24h',
        sortBy: 'newest',
      },
    } as any)

    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [] })

    renderHook(() => useIncidents(), { wrapper })

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalled()
    })

    const callArg = vi.mocked(apiClient.get).mock.calls[0][0]
    expect(callArg).toContain('dateFrom=')
    expect(callArg).toContain('dateTo=')
  })

  it('handles fetch error', async () => {
    const error = new Error('Failed to fetch')
    vi.mocked(apiClient.get).mockRejectedValueOnce(error)

    const { result } = renderHook(() => useIncidents(), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toEqual(error)
  })
})

describe('useIncident', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    vi.clearAllMocks()
  })

  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }

  it('fetches single incident by id', async () => {
    const mockIncident = createMockIncident({ id: 1 })
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockIncident })

    const { result } = renderHook(() => useIncident(1), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toEqual(mockIncident)
    expect(apiClient.get).toHaveBeenCalledWith('/incidents/1')
  })

  it('does not fetch when id is not provided', () => {
    renderHook(() => useIncident(0), { wrapper })
    expect(apiClient.get).not.toHaveBeenCalled()
  })
})

describe('useAcknowledgeIncident', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
      },
    })
    vi.clearAllMocks()
  })

  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }

  it('acknowledges incident successfully', async () => {
    const mockIncident = createMockIncident({
      id: 1,
      status: 'acknowledged',
    })
    vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: mockIncident })

    const { result } = renderHook(() => useAcknowledgeIncident(), { wrapper })

    result.current.mutate(1)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(apiClient.patch).toHaveBeenCalledWith('/incidents/1/acknowledge')
  })

  it('invalidates incidents query on success', async () => {
    const mockIncident = createMockIncident({ id: 1 })
    vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: mockIncident })

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useAcknowledgeIncident(), { wrapper })

    result.current.mutate(1)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['incidents'] })
  })
})

describe('useResolveIncident', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
      },
    })
    vi.clearAllMocks()
  })

  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }

  it('resolves incident successfully', async () => {
    const mockIncident = createMockIncident({ id: 1, status: 'resolved' })
    vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: mockIncident })

    const { result } = renderHook(() => useResolveIncident(), { wrapper })

    result.current.mutate(1)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(apiClient.patch).toHaveBeenCalledWith('/incidents/1/resolve')
  })
})

describe('useBulkAcknowledgeIncidents', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
      },
    })
    vi.clearAllMocks()
  })

  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }

  it('acknowledges multiple incidents', async () => {
    const mockResponse = { success: 3, failed: 0 }
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockResponse })

    const { result } = renderHook(() => useBulkAcknowledgeIncidents(), { wrapper })

    result.current.mutate([1, 2, 3])

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(apiClient.post).toHaveBeenCalledWith('/incidents/bulk/acknowledge', {
      incidentIds: [1, 2, 3],
    })
  })
})

describe('useBulkResolveIncidents', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
      },
    })
    vi.clearAllMocks()
  })

  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }

  it('resolves multiple incidents', async () => {
    const mockResponse = { success: 2, failed: 0 }
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockResponse })

    const { result } = renderHook(() => useBulkResolveIncidents(), { wrapper })

    result.current.mutate([1, 2])

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(apiClient.post).toHaveBeenCalledWith('/incidents/bulk/resolve', {
      incidentIds: [1, 2],
    })
  })
})
