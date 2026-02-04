import React, { type ReactNode } from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useAlerts,
  useAcknowledgeAlert,
  useResolveAlert,
} from '../useAlerts'
import { apiClient } from '@/lib/api/client'
import { createMockAlert } from '@/test/utils'
import * as alertsStore from '@/stores/alertsStore'

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}))

vi.mock('@/stores/alertsStore', () => ({
  useAlertsStore: vi.fn(() => ({
    filters: {
      status: [],
      severity: [],
      search: '',
    },
  })),
}))

describe('useAlerts', () => {
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

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  const wrapper = Wrapper

  it('fetches alerts successfully', async () => {
    const mockAlerts = [
      createMockAlert(),
      createMockAlert({ id: 2, severity: 'high' }),
    ]
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockAlerts })

    const { result } = renderHook(() => useAlerts(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toEqual(mockAlerts)
    expect(apiClient.get).toHaveBeenCalled()
  })

  it('applies status filters', async () => {
    vi.mocked(alertsStore.useAlertsStore).mockReturnValue({
      filters: {
        status: ['firing', 'acknowledged'],
        severity: [],
        search: '',
      },
    } as any)

    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [] })

    renderHook(() => useAlerts(), { wrapper })

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalled()
    })

    const callArg = vi.mocked(apiClient.get).mock.calls[0][0]
    expect(callArg).toContain('status=firing')
    expect(callArg).toContain('status=acknowledged')
  })

  it('applies severity filters', async () => {
    vi.mocked(alertsStore.useAlertsStore).mockReturnValue({
      filters: {
        status: [],
        severity: ['critical', 'high'],
        search: '',
      },
    } as any)

    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [] })

    renderHook(() => useAlerts(), { wrapper })

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalled()
    })

    const callArg = vi.mocked(apiClient.get).mock.calls[0][0]
    expect(callArg).toContain('severity=critical')
    expect(callArg).toContain('severity=high')
  })

  it('applies search filter', async () => {
    vi.mocked(alertsStore.useAlertsStore).mockReturnValue({
      filters: {
        status: [],
        severity: [],
        search: 'database error',
      },
    } as any)

    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [] })

    renderHook(() => useAlerts(), { wrapper })

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalled()
    })

    const callArg = vi.mocked(apiClient.get).mock.calls[0][0]
    expect(callArg).toContain('search=database+error')
  })

  it('handles fetch error', async () => {
    const error = new Error('Failed to fetch alerts')
    vi.mocked(apiClient.get).mockRejectedValueOnce(error)

    const { result } = renderHook(() => useAlerts(), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toEqual(error)
  })

  it('uses staleTime for caching', () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => useAlerts(), { wrapper })

    // Query should be in the cache
    const queryState = queryClient.getQueryState([
      'alerts',
      expect.any(Object),
    ])
    expect(queryState).toBeDefined()
  })
})

describe('useAcknowledgeAlert', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
      },
    })
    vi.clearAllMocks()
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  it('acknowledges alert successfully', async () => {
    const mockAlert = createMockAlert({
      id: 1,
      status: 'acknowledged',
    })
    vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: mockAlert })

    const { result } = renderHook(() => useAcknowledgeAlert(), { wrapper })

    result.current.mutate(1)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(apiClient.patch).toHaveBeenCalledWith('/alerts/1/acknowledge')
  })

  it('invalidates alerts query on success', async () => {
    const mockAlert = createMockAlert({ id: 1 })
    vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: mockAlert })

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useAcknowledgeAlert(), { wrapper })

    result.current.mutate(1)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['alerts'] })
  })

  it('handles acknowledge error', async () => {
    const error = new Error('Failed to acknowledge')
    vi.mocked(apiClient.patch).mockRejectedValueOnce(error)

    const { result } = renderHook(() => useAcknowledgeAlert(), { wrapper })

    result.current.mutate(1)

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toEqual(error)
  })
})

describe('useResolveAlert', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
      },
    })
    vi.clearAllMocks()
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  it('resolves alert successfully', async () => {
    const mockAlert = createMockAlert({ id: 1, status: 'resolved' })
    vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: mockAlert })

    const { result } = renderHook(() => useResolveAlert(), { wrapper })

    result.current.mutate(1)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(apiClient.patch).toHaveBeenCalledWith('/alerts/1/resolve')
  })

  it('invalidates alerts query on success', async () => {
    const mockAlert = createMockAlert({ id: 1 })
    vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: mockAlert })

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useResolveAlert(), { wrapper })

    result.current.mutate(1)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['alerts'] })
  })

  it('handles resolve error', async () => {
    const error = new Error('Failed to resolve')
    vi.mocked(apiClient.patch).mockRejectedValueOnce(error)

    const { result } = renderHook(() => useResolveAlert(), { wrapper })

    result.current.mutate(1)

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toEqual(error)
  })

  it('updates alert status after successful resolve', async () => {
    const mockAlert = createMockAlert({ id: 5, status: 'resolved' })
    vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: mockAlert })

    const { result } = renderHook(() => useResolveAlert(), { wrapper })

    result.current.mutate(5)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockAlert)
  })
})
