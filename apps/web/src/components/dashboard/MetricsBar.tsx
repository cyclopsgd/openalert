import { motion } from 'framer-motion'
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import type { Metrics } from '@/types/api'

interface MetricCardProps {
  icon: React.ReactNode
  label: string
  value: number | string
  color: string
  index: number
}

function MetricCard({ icon, label, value, color, index }: MetricCardProps) {
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
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

interface MetricsBarProps {
  metrics: Metrics
}

export function MetricsBar({ metrics }: MetricsBarProps) {
  const metricCards = [
    {
      icon: <AlertTriangle className="h-5 w-5 text-status-critical" />,
      label: 'Critical',
      value: metrics.critical,
      color: 'bg-status-critical/10',
    },
    {
      icon: <Activity className="h-5 w-5 text-status-warning" />,
      label: 'Active',
      value: metrics.active,
      color: 'bg-status-warning/10',
    },
    {
      icon: <Clock className="h-5 w-5 text-accent-secondary" />,
      label: 'Acknowledged',
      value: metrics.acknowledged,
      color: 'bg-accent-secondary/10',
    },
    {
      icon: <CheckCircle className="h-5 w-5 text-status-success" />,
      label: 'Resolved',
      value: metrics.resolved,
      color: 'bg-status-success/10',
    },
    {
      icon: <Clock className="h-5 w-5 text-accent-primary" />,
      label: 'MTTR',
      value: metrics.mttr,
      color: 'bg-accent-primary/10',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {metricCards.map((metric, index) => (
        <MetricCard key={metric.label} {...metric} index={index} />
      ))}
    </div>
  )
}
