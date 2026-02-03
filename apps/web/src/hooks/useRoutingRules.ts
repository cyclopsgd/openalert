import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'

export interface RoutingRuleCondition {
  type: 'label_matches' | 'source_equals' | 'severity_in' | 'title_contains' | 'description_regex'
  key?: string
  value?: string
  values?: string[]
}

export interface RoutingRuleAction {
  type: 'route_to_service' | 'set_severity' | 'suppress' | 'add_tags'
  serviceId?: number
  severity?: string
  tags?: string[]
}

export interface RoutingRule {
  id: number
  name: string
  teamId: number
  priority: number
  enabled: boolean
  matchAllConditions: boolean
  conditions: RoutingRuleCondition[]
  actions: RoutingRuleAction[]
  matchCount: number
  createdAt: string
  updatedAt: string
}

export interface CreateRoutingRuleDto {
  name: string
  teamId: number
  priority?: number
  enabled?: boolean
  matchAllConditions: boolean
  conditions: RoutingRuleCondition[]
  actions: RoutingRuleAction[]
}

export interface UpdateRoutingRuleDto {
  name?: string
  priority?: number
  enabled?: boolean
  matchAllConditions?: boolean
  conditions?: RoutingRuleCondition[]
  actions?: RoutingRuleAction[]
}

export interface TestRuleRequest {
  conditions: RoutingRuleCondition[]
  matchAllConditions: boolean
  alert: any
}

export interface TestRuleResponse {
  matched: boolean
  matchedConditions: string[]
  failedConditions: string[]
  actions: RoutingRuleAction[]
}

export function useRoutingRules(teamId?: number) {
  return useQuery({
    queryKey: ['routing-rules', teamId],
    queryFn: async () => {
      if (!teamId) return []
      const response = await apiClient.get<RoutingRule[]>(`/alert-routing/rules/team/${teamId}`)
      return response.data
    },
    enabled: !!teamId,
    staleTime: 30000,
  })
}

export function useCreateRoutingRule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateRoutingRuleDto) => {
      const response = await apiClient.post<RoutingRule>('/alert-routing/rules', data)
      return response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['routing-rules', data.teamId] })
    },
  })
}

export function useUpdateRoutingRule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateRoutingRuleDto }) => {
      const response = await apiClient.put<RoutingRule>(`/alert-routing/rules/${id}`, data)
      return response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['routing-rules', data.teamId] })
    },
  })
}

export function useDeleteRoutingRule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, teamId }: { id: number; teamId: number }) => {
      await apiClient.delete(`/alert-routing/rules/${id}`)
      return { id, teamId }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['routing-rules', data.teamId] })
    },
  })
}

export function useUpdateRulePriority() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, priority, teamId }: { id: number; priority: number; teamId: number }) => {
      const response = await apiClient.put<RoutingRule>(`/alert-routing/rules/${id}/priority`, { priority })
      return { ...response.data, teamId }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['routing-rules', data.teamId] })
    },
  })
}

export function useTestRoutingRule() {
  return useMutation({
    mutationFn: async (data: TestRuleRequest) => {
      const response = await apiClient.post<TestRuleResponse>('/alert-routing/rules/test', data)
      return response.data
    },
  })
}
