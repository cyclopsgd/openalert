import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils/cn'
import type { Severity, IncidentStatus, AlertStatus } from '@/types/api'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-dark-700 text-dark-200',
        critical: 'bg-status-critical/10 text-status-critical border border-status-critical/30',
        high: 'bg-status-warning/10 text-status-warning border border-status-warning/30',
        medium: 'bg-accent-secondary/10 text-accent-secondary border border-accent-secondary/30',
        low: 'bg-accent-tertiary/10 text-accent-tertiary border border-accent-tertiary/30',
        info: 'bg-accent-primary/10 text-accent-primary border border-accent-primary/30',
        success: 'bg-status-success/10 text-status-success border border-status-success/30',
        triggered: 'bg-status-critical/10 text-status-critical border border-status-critical/30',
        acknowledged: 'bg-status-warning/10 text-status-warning border border-status-warning/30',
        resolved: 'bg-status-success/10 text-status-success border border-status-success/30',
        firing: 'bg-status-critical/10 text-status-critical border border-status-critical/30',
        suppressed: 'bg-dark-600 text-dark-300 border border-dark-500',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  pulse?: boolean
}

const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, pulse, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(badgeVariants({ variant }), className)}
        {...props}
      >
        {pulse && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
          </span>
        )}
        {children}
      </div>
    )
  }
)
Badge.displayName = 'Badge'

export function SeverityBadge({ severity }: { severity: Severity }) {
  const labels = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    info: 'Info',
  }

  return (
    <Badge variant={severity} pulse={severity === 'critical'}>
      {labels[severity]}
    </Badge>
  )
}

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  const labels = {
    triggered: 'Triggered',
    acknowledged: 'Acknowledged',
    resolved: 'Resolved',
  }

  return (
    <Badge variant={status} pulse={status === 'triggered'}>
      {labels[status]}
    </Badge>
  )
}

export function AlertStatusBadge({ status }: { status: AlertStatus }) {
  const labels = {
    firing: 'Firing',
    acknowledged: 'Acknowledged',
    resolved: 'Resolved',
    suppressed: 'Suppressed',
  }

  return (
    <Badge variant={status} pulse={status === 'firing'}>
      {labels[status]}
    </Badge>
  )
}

export { Badge, badgeVariants }
