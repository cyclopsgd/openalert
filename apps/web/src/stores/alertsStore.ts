import { create } from 'zustand'
import type { Alert } from '@/types/api'

interface AlertsState {
  alerts: Alert[]
  selectedAlert: Alert | null
  filters: {
    status: string[]
    severity: string[]
    search: string
  }
  setAlerts: (alerts: Alert[]) => void
  addAlert: (alert: Alert) => void
  updateAlert: (alert: Alert) => void
  removeAlert: (id: number) => void
  setSelectedAlert: (alert: Alert | null) => void
  setFilters: (filters: Partial<AlertsState['filters']>) => void
  clearFilters: () => void
}

export const useAlertsStore = create<AlertsState>((set) => ({
  alerts: [],
  selectedAlert: null,
  filters: {
    status: [],
    severity: [],
    search: '',
  },

  setAlerts: (alerts) => set({ alerts }),

  addAlert: (alert) =>
    set((state) => ({
      alerts: [alert, ...state.alerts],
    })),

  updateAlert: (alert) =>
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === alert.id ? alert : a)),
      selectedAlert:
        state.selectedAlert?.id === alert.id ? alert : state.selectedAlert,
    })),

  removeAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.filter((a) => a.id !== id),
      selectedAlert:
        state.selectedAlert?.id === id ? null : state.selectedAlert,
    })),

  setSelectedAlert: (alert) => set({ selectedAlert: alert }),

  setFilters: (filters) =>
    set((state) => ({
      filters: { ...state.filters, ...filters },
    })),

  clearFilters: () =>
    set({
      filters: {
        status: [],
        severity: [],
        search: '',
      },
    }),
}))
