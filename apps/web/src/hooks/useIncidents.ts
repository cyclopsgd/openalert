import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { Incident } from '@/types/api'
import { useIncidentsStore } from '@/stores/incidentsStore'

function getDateRangeFromOption(option: string): { from?: string; to?: string } {
  const now = new Date()
  const to = now.toISOString()

  switch (option) {
    case '24h': {
      const from = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      return { from: from.toISOString(), to }
    }
    case '7d': {
      const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      return { from: from.toISOString(), to }
    }
    case '30d': {
      const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      return { from: from.toISOString(), to }
    }
    default:
      return {}
  }
}

export function useIncidents() {
  const { filters } = useIncidentsStore()

  const query = useQuery({
    queryKey: ['incidents', filters],
    queryFn: async () => {
      try {
        const params = new URLSearchParams()

        if (filters.status.length > 0) {
          filters.status.forEach((s) => params.append('status', s))
        }
        if (filters.severity.length > 0) {
          filters.severity.forEach((s) => params.append('severity', s))
        }
        if (filters.search) {
          params.append('search', filters.search)
        }
        if (filters.assigneeId) {
          params.append('assigneeId', filters.assigneeId.toString())
        }
        if (filters.serviceId) {
          params.append('serviceId', filters.serviceId.toString())
        }
        if (filters.sortBy) {
          params.append('sortBy', filters.sortBy)
        }

        // Handle date range
        if (filters.dateRange !== 'all') {
          if (filters.dateRange === 'custom') {
            if (filters.dateFrom) params.append('dateFrom', filters.dateFrom)
            if (filters.dateTo) params.append('dateTo', filters.dateTo)
          } else {
            const { from, to } = getDateRangeFromOption(filters.dateRange)
            if (from) params.append('dateFrom', from)
            if (to) params.append('dateTo', to)
          }
        }

        const queryString = params.toString()
        const url = queryString ? `/incidents?${queryString}` : '/incidents'

        console.log('[useIncidents] Fetching incidents from:', url)
        const response = await apiClient.get<Incident[]>(url)
        console.log('[useIncidents] Received incidents:', response.data?.length || 0)

        return response.data
      } catch (error) {
        console.error('[useIncidents] Error fetching incidents:', error)
        throw error
      }
    },
    staleTime: 30000,
    retry: 2,
  })

  return query
}

export function useIncident(id: number) {
  const query = useQuery({
    queryKey: ['incident', id],
    queryFn: async () => {
      const response = await apiClient.get<Incident>(`/incidents/${id}`)
      return response.data
    },
    enabled: !!id,
  })

  return query
}

export function useAcknowledgeIncident() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (incidentId: number) => {
      const response = await apiClient.patch<Incident>(
        `/incidents/${incidentId}/acknowledge`
      )
      return response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] })
      queryClient.setQueryData(['incident', data.id], data)
    },
  })
}

export function useResolveIncident() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (incidentId: number) => {
      const response = await apiClient.patch<Incident>(
        `/incidents/${incidentId}/resolve`
      )
      return response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] })
      queryClient.setQueryData(['incident', data.id], data)
    },
  })
}

export function useBulkAcknowledgeIncidents() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (incidentIds: number[]) => {
      const response = await apiClient.post<{ success: number; failed: number }>(
        '/incidents/bulk/acknowledge',
        { incidentIds }
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] })
    },
  })
}

export function useBulkResolveIncidents() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (incidentIds: number[]) => {
      const response = await apiClient.post<{ success: number; failed: number }>(
        '/incidents/bulk/resolve',
        { incidentIds }
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] })
    },
  })
}
