import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { IncidentTrend } from '@/types/api'

export function useIncidentTrends(days: number = 30) {
  const query = useQuery({
    queryKey: ['incident-trends', days],
    queryFn: async () => {
      const response = await apiClient.get<IncidentTrend[]>('/metrics/incidents/trends', {
        params: { days },
      })
      return response.data
    },
    staleTime: 60000, // 1 minute
    refetchInterval: 60000,
  })

  return query
}
