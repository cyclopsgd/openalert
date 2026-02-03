import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { socketClient } from '@/lib/socket/client'
import { useIncidentsStore } from '@/stores/incidentsStore'
import { useAlertsStore } from '@/stores/alertsStore'
import type { Incident, Alert } from '@/types/api'

export function useRealtime() {
  const queryClient = useQueryClient()
  const { addIncident, updateIncident } = useIncidentsStore()
  const { addAlert } = useAlertsStore()

  useEffect(() => {
    socketClient.connect()

    socketClient.onIncidentCreated((incident: Incident) => {
      addIncident(incident)
      queryClient.invalidateQueries({ queryKey: ['incidents'] })
      queryClient.invalidateQueries({ queryKey: ['metrics'] })
    })

    socketClient.onIncidentUpdated((incident: Incident) => {
      updateIncident(incident)
      queryClient.setQueryData(['incident', incident.id], incident)
      queryClient.invalidateQueries({ queryKey: ['incidents'] })
    })

    socketClient.onIncidentAcknowledged((data) => {
      updateIncident(data.incident)
      queryClient.setQueryData(['incident', data.incident.id], data.incident)
      queryClient.invalidateQueries({ queryKey: ['incidents'] })
      queryClient.invalidateQueries({ queryKey: ['metrics'] })
    })

    socketClient.onIncidentResolved((data) => {
      updateIncident(data.incident)
      queryClient.setQueryData(['incident', data.incident.id], data.incident)
      queryClient.invalidateQueries({ queryKey: ['incidents'] })
      queryClient.invalidateQueries({ queryKey: ['metrics'] })
    })

    socketClient.onAlertCreated((alert: Alert) => {
      addAlert(alert)
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      if (alert.incidentId) {
        queryClient.invalidateQueries({
          queryKey: ['incident', alert.incidentId],
        })
      }
    })

    return () => {
      socketClient.disconnect()
    }
  }, [queryClient, addIncident, updateIncident, addAlert])

  return {
    isConnected: socketClient.isConnected,
    subscribeToIncident: socketClient.subscribeToIncident.bind(socketClient),
    unsubscribeFromIncident:
      socketClient.unsubscribeFromIncident.bind(socketClient),
  }
}
