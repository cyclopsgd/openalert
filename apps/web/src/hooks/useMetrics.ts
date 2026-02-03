import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { Metrics } from '@/types/api'

export function useMetrics() {
  const query = useQuery({
    queryKey: ['metrics'],
    queryFn: async () => {
      const response = await apiClient.get<Metrics>('/metrics')
      return response.data
    },
    staleTime: 60000,
    refetchInterval: 60000,
  })

  return query
}
