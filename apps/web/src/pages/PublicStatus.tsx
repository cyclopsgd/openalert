import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle, AlertTriangle, AlertCircle, Wrench, RefreshCw } from 'lucide-react'
import { usePublicStatusPage } from '@/hooks/usePublicStatusPage'
import { Badge } from '@/components/ui/Badge'

const overallStatusConfig = {
  operational: {
    icon: CheckCircle,
    label: 'All Systems Operational',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20',
  },
  partial_outage: {
    icon: AlertTriangle,
    label: 'Partial Outage',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/20',
  },
  major_outage: {
    icon: AlertCircle,
    label: 'Major Outage',
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
  },
  maintenance: {
    icon: Wrench,
    label: 'Under Maintenance',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
  },
}

const serviceStatusConfig = {
  operational: {
    icon: '✓',
    label: 'Operational',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
  },
  degraded: {
    icon: '⚠',
    label: 'Degraded',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
  },
  outage: {
    icon: '✕',
    label: 'Outage',
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
  },
  maintenance: {
    icon: '🔧',
    label: 'Maintenance',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
}

const severityColors: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
  info: 'bg-gray-500',
}

export function PublicStatus() {
  const { slug } = useParams<{ slug: string }>()
  const { data, isLoading, error, refetch } = usePublicStatusPage(slug || '')

  useEffect(() => {
    if (data?.themeColor) {
      document.documentElement.style.setProperty('--status-accent', data.themeColor)
    }

    return () => {
      document.documentElement.style.removeProperty('--status-accent')
    }
  }, [data?.themeColor])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 mx-auto mb-4 text-red-500" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Status Page Not Found
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            The status page you're looking for doesn't exist or is not publicly accessible.
          </p>
        </div>
      </div>
    )
  }

  const overallConfig = overallStatusConfig[data.overallStatus]
  const OverallIcon = overallConfig.icon

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 sm:space-y-8"
        >
          <div className="text-center space-y-3 sm:space-y-4">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white px-2">
              {data.name}
            </h1>
            {data.description && (
              <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 px-2">
                {data.description}
              </p>
            )}

            <div className="flex items-center justify-center px-2">
              <div
                className={`inline-flex items-center gap-2 sm:gap-3 px-4 py-3 sm:px-6 sm:py-4 rounded-xl border-2 ${overallConfig.bgColor} ${overallConfig.borderColor} max-w-full`}
              >
                <OverallIcon className={`h-6 w-6 sm:h-8 sm:w-8 ${overallConfig.color} flex-shrink-0`} />
                <span className={`text-base sm:text-xl font-semibold ${overallConfig.color} break-words`}>
                  {overallConfig.label}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                Services
              </h2>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {data.services.length === 0 ? (
                <div className="px-4 sm:px-6 py-6 sm:py-8 text-center text-sm sm:text-base text-gray-500 dark:text-gray-400">
                  No services configured
                </div>
              ) : (
                data.services
                  .sort((a, b) => a.displayOrder - b.displayOrder)
                  .map((service) => {
                    const statusConfig = serviceStatusConfig[service.status]
                    return (
                      <motion.div
                        key={service.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={`px-4 sm:px-6 py-4 sm:py-5 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors ${statusConfig.bgColor} border-l-4 ${statusConfig.borderColor}`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start sm:items-center gap-2 sm:gap-3">
                              <span className={`text-xl sm:text-2xl ${statusConfig.color} flex-shrink-0 leading-none pt-0.5 sm:pt-0`}>
                                {statusConfig.icon}
                              </span>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white break-words">
                                  {service.name}
                                </h3>
                                {service.description && (
                                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-0.5 break-words">
                                    {service.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex-shrink-0 self-start sm:self-auto sm:ml-4">
                            <span
                              className={`inline-flex items-center px-2.5 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${statusConfig.color} ${statusConfig.bgColor} border ${statusConfig.borderColor} whitespace-nowrap`}
                            >
                              {statusConfig.label}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })
              )}
            </div>
          </div>

          {data.recentIncidents.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                  Recent Incidents
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Last 30 days
                </p>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {data.recentIncidents.map((incident) => (
                  <motion.div
                    key={incident.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="px-4 sm:px-6 py-4 sm:py-5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 mb-2">
                          <div
                            className={`h-2 w-2 rounded-full flex-shrink-0 mt-1.5 ${
                              severityColors[incident.severity] || 'bg-gray-500'
                            }`}
                          />
                          <h3 className="text-sm sm:text-base font-medium text-gray-900 dark:text-white break-words">
                            {incident.title}
                          </h3>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1 sm:gap-3 text-xs sm:text-sm text-gray-600 dark:text-gray-400 ml-4">
                          <span>
                            Created: {new Date(incident.createdAt).toLocaleString()}
                          </span>
                          {incident.resolvedAt && (
                            <span className="text-green-600 dark:text-green-400">
                              Resolved: {new Date(incident.resolvedAt).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap self-start">
                        <Badge
                          variant={
                            incident.severity === 'critical'
                              ? 'critical'
                              : incident.severity === 'high'
                              ? 'high'
                              : incident.severity === 'medium'
                              ? 'medium'
                              : incident.severity === 'low'
                              ? 'low'
                              : 'default'
                          }
                        >
                          {incident.severity}
                        </Badge>
                        <Badge
                          variant={
                            incident.status === 'resolved'
                              ? 'success'
                              : incident.status === 'acknowledged'
                              ? 'acknowledged'
                              : incident.status === 'triggered'
                              ? 'triggered'
                              : 'default'
                          }
                        >
                          {incident.status}
                        </Badge>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs sm:text-sm">
              <div className="text-gray-600 dark:text-gray-400">
                <span className="font-medium">Last updated:</span>{' '}
                <span className="block sm:inline mt-1 sm:mt-0">
                  {new Date(data.lastUpdated).toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => refetch()}
                className="flex items-center justify-center gap-2 px-4 py-2 sm:px-3 sm:py-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors min-h-[44px] sm:min-h-0 touch-manipulation border border-gray-300 dark:border-gray-600 rounded-lg sm:border-none"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          <div className="text-center text-sm text-gray-500 dark:text-gray-400">
            Powered by{' '}
            <span className="font-semibold text-gray-700 dark:text-gray-300">
              OpenAlert
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
