import { useMemo, memo } from 'react'
import { motion } from 'framer-motion'
import { MetricsBar } from '@/components/dashboard/MetricsBar'
import { IncidentTrendsChart } from '@/components/dashboard/IncidentTrendsChart'
import { StatusDistributionChart } from '@/components/dashboard/StatusDistributionChart'
import { ResponseTimeChart } from '@/components/dashboard/ResponseTimeChart'
import { RecentIncidentsTable } from '@/components/dashboard/RecentIncidentsTable'
import { useIncidents } from '@/hooks/useIncidents'
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics'
import { useIncidentTrends } from '@/hooks/useIncidentTrends'
import { useResponseTimes } from '@/hooks/useResponseTimes'
import { useRealtime } from '@/hooks/useRealtime'
import { RefreshCw } from 'lucide-react'

// Memoized loading skeleton to prevent re-renders
const LoadingSkeleton = memo(() => {
  return (
    <div className="flex items-center justify-center h-32">
      <div className="animate-spin h-8 w-8 border-4 border-accent-primary border-t-transparent rounded-full" />
    </div>
  )
})
LoadingSkeleton.displayName = 'LoadingSkeleton'

// Memoized header to prevent re-renders
const DashboardHeader = memo(() => {
  return (
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
  )
})
DashboardHeader.displayName = 'DashboardHeader'

export function Dashboard() {
  const { data: incidents, isLoading: incidentsLoading } = useIncidents()
  const { data: metrics, isLoading: metricsLoading } = useDashboardMetrics()
  const { data: trends, isLoading: trendsLoading } = useIncidentTrends(30)
  const { data: responseTimes, isLoading: responseTimesLoading } = useResponseTimes()
  useRealtime()

  // Memoize expensive calculations to prevent re-computation on every render
  const recentIncidents = useMemo(
    () => incidents?.slice(0, 10) || [],
    [incidents]
  )

  // Memoize loading state to prevent unnecessary re-renders
  const isAnyLoading = useMemo(
    () => incidentsLoading || metricsLoading || trendsLoading || responseTimesLoading,
    [incidentsLoading, metricsLoading, trendsLoading, responseTimesLoading]
  )

  return (
    <div className="space-y-6">
      <DashboardHeader />

      {metricsLoading ? (
        <LoadingSkeleton />
      ) : metrics ? (
        <MetricsBar metrics={metrics} />
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {trendsLoading ? (
          <LoadingSkeleton />
        ) : trends ? (
          <IncidentTrendsChart data={trends} />
        ) : null}

        {metricsLoading ? (
          <LoadingSkeleton />
        ) : metrics ? (
          <StatusDistributionChart data={metrics.statusBreakdown} />
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {responseTimesLoading ? (
          <LoadingSkeleton />
        ) : responseTimes ? (
          <ResponseTimeChart data={responseTimes} />
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

// Export memoized version by default
export default memo(Dashboard)
