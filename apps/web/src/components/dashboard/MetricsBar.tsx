import { motion } from 'framer-motion'
import {
  AlertTriangle,
  Clock,
  Activity,
  User,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import type { DashboardMetrics } from '@/types/api'

interface MetricCardProps {
  icon: React.ReactNode
  label: string
  value: number | string
  color: string
  index: number
  subtitle?: string
}

function MetricCard({ icon, label, value, color, index, subtitle }: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className="p-4 hover:border-dark-600 transition-colors">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
          <div className="flex-1">
            <p className="text-2xl font-heading font-bold text-dark-50">
              {value}
            </p>
            <p className="text-sm text-dark-400">{label}</p>
            {subtitle && (
              <p className="text-xs text-dark-500 mt-1">{subtitle}</p>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

interface MetricsBarProps {
  metrics: DashboardMetrics
}

export function MetricsBar({ metrics }: MetricsBarProps) {
  const totalCriticalHigh = metrics.severityBreakdown.critical + metrics.severityBreakdown.high

  const metricCards = [
    {
      icon: <Activity className="h-5 w-5 text-accent-primary" />,
      label: 'Active Incidents',
      value: metrics.activeCount,
      color: 'bg-accent-primary/10',
      subtitle: metrics.activeCount > 0 ? `${totalCriticalHigh} critical/high` : undefined,
    },
    {
      icon: <AlertTriangle className="h-5 w-5 text-status-critical" />,
      label: 'Critical',
      value: metrics.severityBreakdown.critical,
      color: 'bg-status-critical/10',
    },
    {
      icon: <Clock className="h-5 w-5 text-accent-secondary" />,
      label: 'MTTA',
      value: metrics.mtta || '0m',
      color: 'bg-accent-secondary/10',
      subtitle: 'Mean Time To Acknowledge',
    },
    {
      icon: <Clock className="h-5 w-5 text-status-warning" />,
      label: 'MTTR',
      value: metrics.mttr || '0m',
      color: 'bg-status-warning/10',
      subtitle: 'Mean Time To Resolve',
    },
    {
      icon: metrics.onCallEngineer ? <User className="h-5 w-5 text-status-success" /> : <User className="h-5 w-5 text-dark-500" />,
      label: 'On Call',
      value: metrics.onCallEngineer?.name || 'N/A',
      color: metrics.onCallEngineer ? 'bg-status-success/10' : 'bg-dark-700/50',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {metricCards.map((metric, index) => (
        <MetricCard key={metric.label} {...metric} index={index} />
      ))}
    </div>
  )
}
