import { create } from 'zustand'
import type { Incident } from '@/types/api'

interface IncidentsState {
  incidents: Incident[]
  selectedIncident: Incident | null
  filters: {
    status: string[]
    severity: string[]
    search: string
  }
  setIncidents: (incidents: Incident[]) => void
  addIncident: (incident: Incident) => void
  updateIncident: (incident: Incident) => void
  removeIncident: (id: number) => void
  setSelectedIncident: (incident: Incident | null) => void
  setFilters: (filters: Partial<IncidentsState['filters']>) => void
  clearFilters: () => void
}

export const useIncidentsStore = create<IncidentsState>((set) => ({
  incidents: [],
  selectedIncident: null,
  filters: {
    status: [],
    severity: [],
    search: '',
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
      },
    }),
}))
