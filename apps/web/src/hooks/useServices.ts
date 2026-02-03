import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'

export interface Service {
  id: number
  name: string
  slug: string
  description: string | null
  teamId: number
  status: 'operational' | 'degraded' | 'outage' | 'maintenance'
  activeIncidentCount: number
  dependencyCount: number
  createdAt: string
}

export function useServices() {
  return useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const response = await apiClient.get<Service[]>('/services')
      return response.data
    },
    staleTime: 60000,
  })
}
