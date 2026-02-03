import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { Incident } from '@/types/api'
import { useIncidentsStore } from '@/stores/incidentsStore'

export function useIncidents() {
  const { filters } = useIncidentsStore()

  const query = useQuery({
    queryKey: ['incidents', filters],
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

      const response = await apiClient.get<Incident[]>(
        `/incidents?${params.toString()}`
      )
      return response.data
    },
    staleTime: 30000,
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
