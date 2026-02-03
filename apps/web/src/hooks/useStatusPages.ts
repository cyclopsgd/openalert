import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'

export interface StatusPage {
  id: number
  name: string
  slug: string
  description: string | null
  isPublic: boolean
  themeColor: string
  teamId: number
  createdAt: string
  updatedAt: string
  serviceCount: number
}

export interface CreateStatusPageDto {
  name: string
  slug: string
  description?: string
  isPublic?: boolean
  themeColor?: string
  teamId: number
  serviceIds?: number[]
}

export interface UpdateStatusPageDto {
  name?: string
  slug?: string
  description?: string
  isPublic?: boolean
  themeColor?: string
  serviceIds?: number[]
}

export function useStatusPages(teamId?: number) {
  return useQuery({
    queryKey: ['status-pages', teamId],
    queryFn: async () => {
      const url = teamId ? `/status-pages/team/${teamId}` : '/status-pages'
      const response = await apiClient.get<StatusPage[]>(url)
      return response.data
    },
    enabled: !!teamId,
    staleTime: 30000,
  })
}

export function useStatusPage(id: number) {
  return useQuery({
    queryKey: ['status-page', id],
    queryFn: async () => {
      const response = await apiClient.get<StatusPage>(`/status-pages/${id}`)
      return response.data
    },
    enabled: !!id,
  })
}

export function useCreateStatusPage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateStatusPageDto) => {
      const response = await apiClient.post<StatusPage>('/status-pages', data)
      return response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['status-pages', data.teamId] })
    },
  })
}

export function useUpdateStatusPage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateStatusPageDto }) => {
      const response = await apiClient.put<StatusPage>(`/status-pages/${id}`, data)
      return response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['status-pages', data.teamId] })
      queryClient.invalidateQueries({ queryKey: ['status-page', data.id] })
    },
  })
}

export function useDeleteStatusPage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, teamId }: { id: number; teamId: number }) => {
      await apiClient.delete(`/status-pages/${id}`)
      return { id, teamId }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['status-pages', data.teamId] })
    },
  })
}
