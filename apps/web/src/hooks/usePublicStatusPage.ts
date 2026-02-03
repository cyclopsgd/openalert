import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export interface PublicStatusPageService {
  id: number
  name: string
  slug: string
  description: string | null
  status: 'operational' | 'degraded' | 'outage' | 'maintenance'
  displayOrder: number
}

export interface PublicStatusPageIncident {
  id: number
  title: string
  severity: string
  status: string
  createdAt: string
  acknowledgedAt: string | null
  resolvedAt: string | null
}

export interface PublicStatusPageData {
  name: string
  description: string | null
  themeColor: string
  overallStatus: 'operational' | 'partial_outage' | 'major_outage' | 'maintenance'
  services: PublicStatusPageService[]
  recentIncidents: PublicStatusPageIncident[]
  lastUpdated: string
}

export function usePublicStatusPage(slug: string) {
  return useQuery({
    queryKey: ['public-status-page', slug],
    queryFn: async () => {
      const response = await axios.get<PublicStatusPageData>(
        `${API_URL}/public/status/${slug}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
      return response.data
    },
    enabled: !!slug,
    staleTime: 30000,
    refetchInterval: 60000,
  })
}
