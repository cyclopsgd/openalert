import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  User,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import {
  SeverityBadge,
  IncidentStatusBadge,
  AlertStatusBadge,
} from '@/components/ui/Badge'
import {
  useIncident,
  useAcknowledgeIncident,
  useResolveIncident,
} from '@/hooks/useIncidents'
import { useAlerts } from '@/hooks/useAlerts'
import { useRealtime } from '@/hooks/useRealtime'
import { formatDateTime, formatTimeAgo } from '@/lib/utils/format'

export function IncidentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const incidentId = parseInt(id || '0', 10)

  const { data: incident, isLoading } = useIncident(incidentId)
  const { data: allAlerts } = useAlerts()
  const { subscribeToIncident, unsubscribeFromIncident } = useRealtime()

  const acknowledgeMutation = useAcknowledgeIncident()
  const resolveMutation = useResolveIncident()

  const alerts = allAlerts?.filter((a) => a.incidentId === incidentId) || []

  useEffect(() => {
    if (incidentId) {
      subscribeToIncident(incidentId)
      return () => {
        unsubscribeFromIncident(incidentId)
      }
    }
  }, [incidentId, subscribeToIncident, unsubscribeFromIncident])

  const handleAcknowledge = () => {
    acknowledgeMutation.mutate(incidentId)
  }

  const handleResolve = () => {
    resolveMutation.mutate(incidentId)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-accent-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!incident) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 text-dark-600 mx-auto mb-3" />
        <p className="text-dark-400">Incident not found</p>
        <Button className="mt-4" onClick={() => navigate('/incidents')}>
          Back to Incidents
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Button
          variant="ghost"
          onClick={() => navigate('/incidents')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Incidents
        </Button>

        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-dark-400">
                #{incident.incidentNumber}
              </span>
              <SeverityBadge severity={incident.severity} />
              <IncidentStatusBadge status={incident.status} />
            </div>
            <h1 className="text-3xl font-heading font-bold text-dark-50">
              {incident.title}
            </h1>
            {incident.service && (
              <p className="text-dark-400">{incident.service.name}</p>
            )}
          </div>

          <div className="flex gap-2">
            {incident.status === 'triggered' && (
              <Button
                variant="secondary"
                onClick={handleAcknowledge}
                isLoading={acknowledgeMutation.isPending}
              >
                <CheckCircle className="h-4 w-4" />
                Acknowledge
              </Button>
            )}
            {incident.status !== 'resolved' && (
              <Button
                variant="success"
                onClick={handleResolve}
                isLoading={resolveMutation.isPending}
              >
                <CheckCircle className="h-4 w-4" />
                Resolve
              </Button>
            )}
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {incident.resolvedAt && (
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="h-8 w-8 rounded-full bg-status-success/10 flex items-center justify-center">
                        <CheckCircle className="h-4 w-4 text-status-success" />
                      </div>
                      <div className="flex-1 w-0.5 bg-dark-700 min-h-[20px]" />
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="text-sm font-medium text-dark-100">
                        Incident Resolved
                      </p>
                      <p className="text-xs text-dark-400">
                        {formatDateTime(incident.resolvedAt)}
                      </p>
                    </div>
                  </div>
                )}

                {incident.acknowledgedAt && (
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="h-8 w-8 rounded-full bg-status-warning/10 flex items-center justify-center">
                        <User className="h-4 w-4 text-status-warning" />
                      </div>
                      <div className="flex-1 w-0.5 bg-dark-700 min-h-[20px]" />
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="text-sm font-medium text-dark-100">
                        Incident Acknowledged
                      </p>
                      <p className="text-xs text-dark-400">
                        {formatDateTime(incident.acknowledgedAt)}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="h-8 w-8 rounded-full bg-status-critical/10 flex items-center justify-center">
                      <AlertTriangle className="h-4 w-4 text-status-critical" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-dark-100">
                      Incident Triggered
                    </p>
                    <p className="text-xs text-dark-400">
                      {formatDateTime(incident.triggeredAt)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Alerts ({alerts.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {alerts.length > 0 ? (
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="p-3 bg-dark-750 rounded-lg border border-dark-700"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-medium text-dark-100">
                            {alert.title || alert.alertName}
                          </p>
                          {alert.description && (
                            <p className="text-sm text-dark-400 mt-1">
                              {alert.description}
                            </p>
                          )}
                          {alert.startsAt && (
                            <p className="text-xs text-dark-500 mt-2">
                              {formatTimeAgo(alert.startsAt)}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <SeverityBadge severity={alert.severity} />
                          <AlertStatusBadge status={alert.status} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-dark-400">No alerts</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-dark-400">Status</p>
                <p className="text-sm font-medium text-dark-100 mt-1">
                  <IncidentStatusBadge status={incident.status} />
                </p>
              </div>
              <div>
                <p className="text-xs text-dark-400">Severity</p>
                <p className="text-sm font-medium text-dark-100 mt-1">
                  <SeverityBadge severity={incident.severity} />
                </p>
              </div>
              <div>
                <p className="text-xs text-dark-400">Service</p>
                <p className="text-sm font-medium text-dark-100 mt-1">
                  {incident.service?.name || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-dark-400">Triggered</p>
                <p className="text-sm font-medium text-dark-100 mt-1">
                  {formatTimeAgo(incident.triggeredAt)}
                </p>
              </div>
              {incident.acknowledgedAt && (
                <div>
                  <p className="text-xs text-dark-400">Acknowledged</p>
                  <p className="text-sm font-medium text-dark-100 mt-1">
                    {formatTimeAgo(incident.acknowledgedAt)}
                  </p>
                </div>
              )}
              {incident.resolvedAt && (
                <div>
                  <p className="text-xs text-dark-400">Resolved</p>
                  <p className="text-sm font-medium text-dark-100 mt-1">
                    {formatTimeAgo(incident.resolvedAt)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
