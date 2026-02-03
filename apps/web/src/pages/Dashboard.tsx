import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MetricsBar } from '@/components/dashboard/MetricsBar'
import { IncidentCard } from '@/components/incidents/IncidentCard'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useIncidents } from '@/hooks/useIncidents'
import { useMetrics } from '@/hooks/useMetrics'
import { useRealtime } from '@/hooks/useRealtime'
import { AlertTriangle, ArrowRight } from 'lucide-react'

export function Dashboard() {
  const navigate = useNavigate()
  const { data: incidents, isLoading: incidentsLoading } = useIncidents()
  const { data: metrics, isLoading: metricsLoading } = useMetrics()
  useRealtime()

  const activeIncidents = incidents?.filter(
    (i) => i.status !== 'resolved'
  ) || []
  const recentIncidents = activeIncidents.slice(0, 5)

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-heading font-bold text-dark-50 mb-2">
          Dashboard
        </h1>
        <p className="text-dark-400">
          Monitor and manage your incidents in real-time
        </p>
      </motion.div>

      {metricsLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin h-8 w-8 border-4 border-accent-primary border-t-transparent rounded-full" />
        </div>
      ) : metrics ? (
        <MetricsBar metrics={metrics} />
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-status-critical" />
              <CardTitle>Active Incidents</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/incidents')}
            >
              View All
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {incidentsLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin h-8 w-8 border-4 border-accent-primary border-t-transparent rounded-full" />
            </div>
          ) : recentIncidents.length > 0 ? (
            <div className="space-y-3">
              {recentIncidents.map((incident, index) => (
                <IncidentCard
                  key={incident.id}
                  incident={incident}
                  index={index}
                  onClick={() => navigate(`/incidents/${incident.id}`)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <AlertTriangle className="h-12 w-12 text-dark-600 mx-auto mb-3" />
              <p className="text-dark-400">No active incidents</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
