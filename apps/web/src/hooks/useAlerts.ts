import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { Alert } from '@/types/api'
import { useAlertsStore } from '@/stores/alertsStore'

export function useAlerts() {
  const { filters } = useAlertsStore()

  const query = useQuery({
    queryKey: ['alerts', filters],
    queryFn: async () => {
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

      const response = await apiClient.get<Alert[]>(
        `/alerts?${params.toString()}`
      )
      return response.data
    },
    staleTime: 30000,
  })

  return query
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (alertId: number) => {
      const response = await apiClient.patch<Alert>(
        `/alerts/${alertId}/acknowledge`
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
    },
  })
}

export function useResolveAlert() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (alertId: number) => {
      const response = await apiClient.patch<Alert>(`/alerts/${alertId}/resolve`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
    },
  })
}
