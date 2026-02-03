import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { DashboardMetrics } from '@/types/api'

export function useDashboardMetrics() {
  const query = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: async () => {
      const response = await apiClient.get<DashboardMetrics>('/metrics/dashboard')
      return response.data
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 30000, // Refetch every 30 seconds
  })

  return query
}
