import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'

export interface NotificationPreferences {
  emailEnabled: boolean
  smsEnabled: boolean
  pushEnabled: boolean
  slackEnabled: boolean
  quietHoursStart?: string
  quietHoursEnd?: string
  notificationDelay: number
  phoneNumber?: string
}

export function useNotificationPreferences() {
  const queryClient = useQueryClient()

  const { data: preferences, isLoading, error } = useQuery<NotificationPreferences>({
    queryKey: ['notification-preferences'],
    queryFn: async () => {
      try {
        const response = await apiClient.get('/users/me/notification-preferences')
        return response.data
      } catch (err) {
        // Return default preferences if not found
        return {
          emailEnabled: true,
          smsEnabled: false,
          pushEnabled: true,
          slackEnabled: false,
          quietHoursStart: '',
          quietHoursEnd: '',
          notificationDelay: 0,
          phoneNumber: '',
        }
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<NotificationPreferences>) => {
      const response = await apiClient.put('/users/me/notification-preferences', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] })
    },
  })

  return {
    preferences,
    isLoading,
    error,
    updatePreferences: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  }
}
