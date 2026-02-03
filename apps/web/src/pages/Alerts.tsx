import { motion } from 'framer-motion'
import { Bell } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SeverityBadge, AlertStatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAlerts, useAcknowledgeAlert, useResolveAlert } from '@/hooks/useAlerts'
import { formatTimeAgo } from '@/lib/utils/format'

export function Alerts() {
  const { data: alerts, isLoading } = useAlerts()
  const acknowledgeMutation = useAcknowledgeAlert()
  const resolveMutation = useResolveAlert()

  const handleAcknowledge = (alertId: number) => {
    acknowledgeMutation.mutate(alertId)
  }

  const handleResolve = (alertId: number) => {
    resolveMutation.mutate(alertId)
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-heading font-bold text-dark-50 mb-2">
          Alerts
        </h1>
        <p className="text-dark-400">
          Monitor and manage all your alerts
        </p>
      </motion.div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-accent-primary border-t-transparent rounded-full" />
        </div>
      ) : alerts && alerts.length > 0 ? (
        <div className="space-y-3">
          {alerts.map((alert, index) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="p-4 hover:bg-dark-750 transition-all">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-dark-400" />
                      <h3 className="font-heading font-semibold text-dark-50">
                        {alert.title || alert.alertName}
                      </h3>
                    </div>
                    {alert.description && (
                      <p className="text-sm text-dark-400">{alert.description}</p>
                    )}
                    {alert.source && (
                      <p className="text-xs text-dark-500">
                        Source: {alert.source}
                      </p>
                    )}
                    {alert.startsAt && (
                      <p className="text-xs text-dark-500">
                        {formatTimeAgo(alert.startsAt)}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex gap-2">
                      <SeverityBadge severity={alert.severity} />
                      <AlertStatusBadge status={alert.status} />
                    </div>
                    {alert.status === 'firing' && (
                      <div className="flex gap-2 mt-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleAcknowledge(alert.id)}
                          isLoading={acknowledgeMutation.isPending}
                        >
                          Acknowledge
                        </Button>
                        <Button
                          size="sm"
                          variant="success"
                          onClick={() => handleResolve(alert.id)}
                          isLoading={resolveMutation.isPending}
                        >
                          Resolve
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Bell className="h-12 w-12 text-dark-600 mx-auto mb-3" />
          <p className="text-dark-400">No alerts found</p>
        </div>
      )}
    </div>
  )
}
