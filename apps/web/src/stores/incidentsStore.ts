import { create } from 'zustand'
import type { Incident } from '@/types/api'

export type DateRangeOption = 'all' | '24h' | '7d' | '30d' | 'custom'

interface IncidentsState {
  incidents: Incident[]
  selectedIncident: Incident | null
  selectedIncidentIds: number[]
  filters: {
    status: string[]
    severity: string[]
    search: string
    assigneeId?: number
    serviceId?: number
    dateRange: DateRangeOption
    dateFrom?: string
    dateTo?: string
    sortBy: 'newest' | 'oldest' | 'severity' | 'status'
  }
  setIncidents: (incidents: Incident[]) => void
  addIncident: (incident: Incident) => void
  updateIncident: (incident: Incident) => void
  removeIncident: (id: number) => void
  setSelectedIncident: (incident: Incident | null) => void
  setFilters: (filters: Partial<IncidentsState['filters']>) => void
  clearFilters: () => void
  toggleIncidentSelection: (id: number) => void
  clearSelection: () => void
  selectAll: (incidents: Incident[]) => void
}

export const useIncidentsStore = create<IncidentsState>((set) => ({
  incidents: [],
  selectedIncident: null,
  selectedIncidentIds: [],
  filters: {
    status: [],
    severity: [],
    search: '',
    dateRange: 'all',
    sortBy: 'newest',
  },

  setIncidents: (incidents) => set({ incidents }),

  addIncident: (incident) =>
    set((state) => ({
      incidents: [incident, ...state.incidents],
    })),

  updateIncident: (incident) =>
    set((state) => ({
      incidents: state.incidents.map((i) =>
        i.id === incident.id ? incident : i
      ),
      selectedIncident:
        state.selectedIncident?.id === incident.id
          ? incident
          : state.selectedIncident,
    })),

  removeIncident: (id) =>
    set((state) => ({
      incidents: state.incidents.filter((i) => i.id !== id),
      selectedIncident:
        state.selectedIncident?.id === id ? null : state.selectedIncident,
    })),

  setSelectedIncident: (incident) => set({ selectedIncident: incident }),

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
        dateRange: 'all',
        sortBy: 'newest',
      },
    }),

  toggleIncidentSelection: (id) =>
    set((state) => ({
      selectedIncidentIds: state.selectedIncidentIds.includes(id)
        ? state.selectedIncidentIds.filter((i) => i !== id)
        : [...state.selectedIncidentIds, id],
    })),

  clearSelection: () => set({ selectedIncidentIds: [] }),

  selectAll: (incidents) =>
    set({
      selectedIncidentIds: incidents.map((i) => i.id),
    }),
}))
