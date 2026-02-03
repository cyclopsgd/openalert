import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  User,
  CheckCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  FileText,
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
import { useRealtime } from '@/hooks/useRealtime'
import { formatDateTime, formatTimeAgo } from '@/lib/utils/format'

const eventTypeIcons: Record<string, any> = {
  triggered: AlertTriangle,
  acknowledged: User,
  resolved: CheckCircle,
  escalated: TrendingUp,
  note_added: FileText,
}

const eventTypeColors: Record<string, string> = {
  triggered: 'bg-status-critical/10 text-status-critical',
  acknowledged: 'bg-status-warning/10 text-status-warning',
  resolved: 'bg-status-success/10 text-status-success',
  escalated: 'bg-accent-secondary/10 text-accent-secondary',
  note_added: 'bg-accent-primary/10 text-accent-primary',
}

export function IncidentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const incidentId = parseInt(id || '0', 10)

  const { data: incident, isLoading } = useIncident(incidentId)
  const { subscribeToIncident, unsubscribeFromIncident } = useRealtime()

  const acknowledgeMutation = useAcknowledgeIncident()
  const resolveMutation = useResolveIncident()

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

  const alerts = incident.alerts || []
  const timeline = incident.timeline || []

  // Group alerts by source/integration
  const alertsBySource = alerts.reduce((acc, alert) => {
    const source = alert.source || 'Unknown'
    if (!acc[source]) {
      acc[source] = []
    }
    acc[source].push(alert)
    return acc
  }, {} as Record<string, typeof alerts>)

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

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-mono text-dark-400">
                #{incident.incidentNumber}
              </span>
              <SeverityBadge severity={incident.severity} />
              <IncidentStatusBadge status={incident.status} />
            </div>
            <h1 className="text-3xl font-heading font-bold text-dark-50 break-words">
              {incident.title}
            </h1>
            {incident.service && (
              <p className="text-dark-400">{incident.service.name}</p>
            )}
          </div>

          <div className="flex gap-2 flex-shrink-0">
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
              {timeline.length > 0 ? (
                <div className="space-y-4">
                  {timeline.map((event, index) => {
                    const Icon = eventTypeIcons[event.eventType] || Clock
                    const colorClass = eventTypeColors[event.eventType] || 'bg-dark-700 text-dark-300'
                    const isLast = index === timeline.length - 1

                    return (
                      <div key={event.id} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center ${colorClass}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          {!isLast && (
                            <div className="flex-1 w-0.5 bg-dark-700 min-h-[20px]" />
                          )}
                        </div>
                        <div className="flex-1 pb-4">
                          <p className="text-sm font-medium text-dark-100">
                            {event.description}
                          </p>
                          {event.user && (
                            <p className="text-xs text-dark-400 mt-1">
                              by {event.user.name}
                            </p>
                          )}
                          <p className="text-xs text-dark-500 mt-1">
                            {formatDateTime(event.createdAt)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-dark-400">No timeline events</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Related Alerts ({alerts.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {alerts.length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(alertsBySource).map(([source, sourceAlerts]) => (
                    <div key={source}>
                      <h3 className="text-sm font-medium text-dark-300 mb-2">
                        {source} ({sourceAlerts.length})
                      </h3>
                      <div className="space-y-3">
                        {sourceAlerts.map((alert) => (
                          <div
                            key={alert.id}
                            className="p-3 bg-dark-750 rounded-lg border border-dark-700"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-dark-100 break-words">
                                  {alert.title || alert.alertName}
                                </p>
                                {alert.description && (
                                  <p className="text-sm text-dark-400 mt-1 break-words">
                                    {alert.description}
                                  </p>
                                )}
                                {alert.startsAt && (
                                  <p className="text-xs text-dark-500 mt-2">
                                    Started {formatTimeAgo(alert.startsAt)}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                <SeverityBadge severity={alert.severity} />
                                <AlertStatusBadge status={alert.status} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-dark-400">No alerts</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Metrics & Graphs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-dark-400 text-sm">
                  Grafana integration coming soon
                </p>
                <p className="text-dark-500 text-xs mt-2">
                  This will show related metrics and graphs for this incident
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-dark-400 mb-1">Status</p>
                <IncidentStatusBadge status={incident.status} />
              </div>
              <div>
                <p className="text-xs text-dark-400 mb-1">Severity</p>
                <SeverityBadge severity={incident.severity} />
              </div>
              <div>
                <p className="text-xs text-dark-400 mb-1">Service</p>
                <p className="text-sm font-medium text-dark-100">
                  {incident.service?.name || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-dark-400 mb-1">Triggered</p>
                <p className="text-sm font-medium text-dark-100">
                  {formatDateTime(incident.triggeredAt)}
                </p>
                <p className="text-xs text-dark-500 mt-1">
                  {formatTimeAgo(incident.triggeredAt)}
                </p>
              </div>
              {incident.acknowledgedAt && (
                <div>
                  <p className="text-xs text-dark-400 mb-1">Acknowledged</p>
                  {incident.acknowledgedBy && (
                    <p className="text-sm font-medium text-dark-100">
                      {incident.acknowledgedBy.name}
                    </p>
                  )}
                  <p className="text-xs text-dark-500 mt-1">
                    {formatDateTime(incident.acknowledgedAt)}
                  </p>
                </div>
              )}
              {incident.resolvedAt && (
                <div>
                  <p className="text-xs text-dark-400 mb-1">Resolved</p>
                  {incident.resolvedBy && (
                    <p className="text-sm font-medium text-dark-100">
                      {incident.resolvedBy.name}
                    </p>
                  )}
                  <p className="text-xs text-dark-500 mt-1">
                    {formatDateTime(incident.resolvedAt)}
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
