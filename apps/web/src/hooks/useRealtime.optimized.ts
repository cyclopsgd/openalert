import { useEffect, useCallback, useMemo, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { socketClient } from '@/lib/socket/client'
import { useIncidentsStore } from '@/stores/incidentsStore'
import { useAlertsStore } from '@/stores/alertsStore'
import type { Incident, Alert } from '@/types/api'

// Debounce utility
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * Optimized realtime hook with reduced re-renders and cache invalidation
 */
export function useRealtime() {
  const queryClient = useQueryClient()
  const { addIncident, updateIncident } = useIncidentsStore()
  const { addAlert } = useAlertsStore()

  // Track if we've already connected to prevent duplicate connections
  const isConnectedRef = useRef(false)

  // Stable callback for incident creation
  const handleIncidentCreated = useCallback(
    (incident: Incident) => {
      addIncident(incident)
      // Only invalidate the incidents list, not detail views
      queryClient.invalidateQueries({
        queryKey: ['incidents', 'list'],
        exact: false,
      })
    },
    [addIncident, queryClient]
  )

  // Stable callback for incident updates
  const handleIncidentUpdated = useCallback(
    (incident: Incident) => {
      updateIncident(incident)
      // Update specific incident in cache
      queryClient.setQueryData(['incident', incident.id], incident)
      // Invalidate list to show updated data
      queryClient.invalidateQueries({
        queryKey: ['incidents', 'list'],
        exact: false,
      })
    },
    [updateIncident, queryClient]
  )

  // Debounced metrics invalidation - wait 1 second to batch updates
  const invalidateMetrics = useMemo(
    () =>
      debounce(() => {
        queryClient.invalidateQueries({ queryKey: ['metrics'] })
      }, 1000),
    [queryClient]
  )

  // Stable callback for incident acknowledgment
  const handleIncidentAcknowledged = useCallback(
    (data: { incident: Incident; userId: number }) => {
      updateIncident(data.incident)
      queryClient.setQueryData(['incident', data.incident.id], data.incident)
      queryClient.invalidateQueries({
        queryKey: ['incidents', 'list'],
        exact: false,
      })
      // Debounced metrics update
      invalidateMetrics()
    },
    [updateIncident, queryClient, invalidateMetrics]
  )

  // Stable callback for incident resolution
  const handleIncidentResolved = useCallback(
    (data: { incident: Incident; userId: number }) => {
      updateIncident(data.incident)
      queryClient.setQueryData(['incident', data.incident.id], data.incident)
      queryClient.invalidateQueries({
        queryKey: ['incidents', 'list'],
        exact: false,
      })
      // Debounced metrics update
      invalidateMetrics()
    },
    [updateIncident, queryClient, invalidateMetrics]
  )

  // Stable callback for alert creation
  const handleAlertCreated = useCallback(
    (alert: Alert) => {
      addAlert(alert)
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      // Only invalidate related incident if present
      if (alert.incidentId) {
        queryClient.invalidateQueries({
          queryKey: ['incident', alert.incidentId],
        })
      }
    },
    [addAlert, queryClient]
  )

  useEffect(() => {
    // Prevent duplicate connections
    if (isConnectedRef.current) {
      return
    }

    socketClient.connect()
    isConnectedRef.current = true

    // Register all event handlers with stable callbacks
    socketClient.onIncidentCreated(handleIncidentCreated)
    socketClient.onIncidentUpdated(handleIncidentUpdated)
    socketClient.onIncidentAcknowledged(handleIncidentAcknowledged)
    socketClient.onIncidentResolved(handleIncidentResolved)
    socketClient.onAlertCreated(handleAlertCreated)

    return () => {
      socketClient.disconnect()
      isConnectedRef.current = false
    }
    // Dependencies are stable callbacks that won't cause re-renders
  }, [
    handleIncidentCreated,
    handleIncidentUpdated,
    handleIncidentAcknowledged,
    handleIncidentResolved,
    handleAlertCreated,
  ])

  return {
    isConnected: socketClient.isConnected,
    subscribeToIncident: socketClient.subscribeToIncident.bind(socketClient),
    unsubscribeFromIncident: socketClient.unsubscribeFromIncident.bind(socketClient),
  }
}
