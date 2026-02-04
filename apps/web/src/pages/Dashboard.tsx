import { lazy, Suspense } from 'react'
import { motion } from 'framer-motion'
import { MetricsBar } from '@/components/dashboard/MetricsBar'
import { RecentIncidentsTable } from '@/components/dashboard/RecentIncidentsTable'
import { useIncidents } from '@/hooks/useIncidents'
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics'
import { useIncidentTrends } from '@/hooks/useIncidentTrends'
import { useResponseTimes } from '@/hooks/useResponseTimes'
import { useRealtime } from '@/hooks/useRealtime'
import { RefreshCw } from 'lucide-react'

// Lazy load chart components (they include heavy recharts library)
const IncidentTrendsChart = lazy(() => import('@/components/dashboard/IncidentTrendsChart').then(m => ({ default: m.IncidentTrendsChart })))
const StatusDistributionChart = lazy(() => import('@/components/dashboard/StatusDistributionChart').then(m => ({ default: m.StatusDistributionChart })))
const ResponseTimeChart = lazy(() => import('@/components/dashboard/ResponseTimeChart').then(m => ({ default: m.ResponseTimeChart })))

function LoadingSkeleton() {
  return (
    <div className="flex items-center justify-center h-32">
      <div className="animate-spin h-8 w-8 border-4 border-accent-primary border-t-transparent rounded-full" />
    </div>
  )
}

export function Dashboard() {
  const { data: incidents, isLoading: incidentsLoading } = useIncidents()
  const { data: metrics, isLoading: metricsLoading } = useDashboardMetrics()
  const { data: trends, isLoading: trendsLoading } = useIncidentTrends(30)
  const { data: responseTimes, isLoading: responseTimesLoading } = useResponseTimes()
  useRealtime()

  const recentIncidents = incidents?.slice(0, 10) || []

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-dark-50 mb-1 sm:mb-2">
            Dashboard
          </h1>
          <p className="text-sm sm:text-base text-dark-400">
            Monitor and manage your incidents in real-time
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-dark-500">
          <RefreshCw className="h-3 w-3" />
          <span className="hidden sm:inline">Updates every 30s</span>
          <span className="sm:hidden">Live</span>
        </div>
      </motion.div>

      {metricsLoading ? (
        <LoadingSkeleton />
      ) : metrics ? (
        <MetricsBar metrics={metrics} />
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {trendsLoading ? (
          <LoadingSkeleton />
        ) : trends ? (
          <Suspense fallback={<LoadingSkeleton />}>
            <IncidentTrendsChart data={trends} />
          </Suspense>
        ) : null}

        {metricsLoading ? (
          <LoadingSkeleton />
        ) : metrics ? (
          <Suspense fallback={<LoadingSkeleton />}>
            <StatusDistributionChart data={metrics.statusBreakdown} />
          </Suspense>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {responseTimesLoading ? (
          <LoadingSkeleton />
        ) : responseTimes ? (
          <Suspense fallback={<LoadingSkeleton />}>
            <ResponseTimeChart data={responseTimes} />
          </Suspense>
        ) : null}

        <div className="lg:col-span-1">
          {incidentsLoading ? (
            <LoadingSkeleton />
          ) : (
            <RecentIncidentsTable incidents={recentIncidents} />
          )}
        </div>
      </div>
    </div>
  )
}
