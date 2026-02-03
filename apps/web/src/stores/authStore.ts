import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types/api'
import { apiClient } from '@/lib/api/client'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (token: string) => Promise<void>
  logout: () => void
  fetchProfile: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (token: string) => {
        try {
          set({ isLoading: true, error: null })
          localStorage.setItem('authToken', token)

          const response = await apiClient.get<User>('/auth/profile')
          set({
            user: response.data,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (error: any) {
          set({
            error: error.response?.data?.message || 'Login failed',
            isLoading: false,
          })
          localStorage.removeItem('authToken')
        }
      },

      logout: () => {
        localStorage.removeItem('authToken')
        set({
          user: null,
          isAuthenticated: false,
          error: null,
        })
      },

      fetchProfile: async () => {
        try {
          set({ isLoading: true, error: null })
          const response = await apiClient.get<User>('/auth/profile')
          set({
            user: response.data,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (error: any) {
          set({
            error: error.response?.data?.message || 'Failed to fetch profile',
            isLoading: false,
            isAuthenticated: false,
            user: null,
          })
          localStorage.removeItem('authToken')
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
