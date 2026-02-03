// API Types
export type IncidentStatus = 'triggered' | 'acknowledged' | 'resolved'
export type AlertStatus = 'firing' | 'acknowledged' | 'resolved' | 'suppressed'
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export interface User {
  id: number
  email: string
  name: string
  externalId: string
}

export interface Service {
  id: number
  name: string
  slug: string
  description?: string
  teamId: number
}

export interface Incident {
  id: number
  incidentNumber: number
  title: string
  status: IncidentStatus
  severity: Severity
  serviceId: number
  service?: Service
  assigneeId?: number
  acknowledgedById?: number
  resolvedById?: number
  triggeredAt: string
  acknowledgedAt?: string
  resolvedAt?: string
  createdAt: string
  updatedAt: string
}

export interface Alert {
  id: number
  incidentId?: number
  integrationId: number
  alertName?: string
  title?: string
  description?: string
  severity: Severity
  status: AlertStatus
  source?: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
  startsAt?: string
  endsAt?: string
  acknowledgedAt?: string
  acknowledgedById?: number
  resolvedAt?: string
  createdAt: string
}

export interface Schedule {
  id: number
  name: string
  teamId: number
  timezone: string
  createdAt: string
}

export interface OnCallUser {
  user: User
  schedule: Schedule
  startsAt: string
  endsAt: string
}

export interface Metrics {
  critical: number
  high: number
  medium: number
  low: number
  active: number
  acknowledged: number
  resolved: number
  mttr: string
}

export interface StatusPage {
  id: number
  name: string
  slug: string
  teamId: number
  description?: string
  isPublic: boolean
  overallStatus: 'operational' | 'degraded' | 'partial_outage' | 'major_outage'
}

export interface ApiError {
  statusCode: number
  message: string
  errors?: string[]
  correlationId?: string
}
