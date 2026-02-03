import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { ResponseTimeBucket } from '@/types/api'

export function useResponseTimes() {
  const query = useQuery({
    queryKey: ['response-times'],
    queryFn: async () => {
      const response = await apiClient.get<ResponseTimeBucket[]>('/metrics/incidents/response-times')
      return response.data
    },
    staleTime: 60000, // 1 minute
    refetchInterval: 60000,
  })

  return query
}
