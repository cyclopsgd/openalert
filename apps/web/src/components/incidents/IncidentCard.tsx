import { motion } from 'framer-motion'
import { AlertTriangle, Clock, User } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SeverityBadge, IncidentStatusBadge } from '@/components/ui/Badge'
import type { Incident } from '@/types/api'
import { formatTimeAgo } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'

interface IncidentCardProps {
  incident: Incident
  onClick?: () => void
  index?: number
}

export function IncidentCard({ incident, onClick, index = 0 }: IncidentCardProps) {
  const severityColors = {
    critical: 'border-l-status-critical',
    high: 'border-l-status-warning',
    medium: 'border-l-accent-secondary',
    low: 'border-l-accent-tertiary',
    info: 'border-l-accent-primary',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card
        className={cn(
          'border-l-4 hover:bg-dark-750 transition-all cursor-pointer group',
          severityColors[incident.severity]
        )}
        onClick={onClick}
      >
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-dark-400">
                  #{incident.incidentNumber}
                </span>
                {incident.status === 'triggered' && (
                  <AlertTriangle className="h-4 w-4 text-status-critical animate-pulse" />
                )}
              </div>
              <h3 className="font-heading font-semibold text-dark-50 group-hover:text-accent-primary transition-colors">
                {incident.title}
              </h3>
              {incident.service && (
                <p className="text-sm text-dark-400">{incident.service.name}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <SeverityBadge severity={incident.severity} />
              <IncidentStatusBadge status={incident.status} />
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-dark-400">
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>{formatTimeAgo(incident.triggeredAt)}</span>
            </div>
            {incident.acknowledgedById && (
              <div className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                <span>Acknowledged</span>
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
