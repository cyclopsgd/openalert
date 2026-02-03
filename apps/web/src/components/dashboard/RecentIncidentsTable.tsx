import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { Incident } from '@/types/api'

interface RecentIncidentsTableProps {
  incidents: Incident[]
}

const severityColors = {
  critical: 'text-status-critical',
  high: 'text-status-warning',
  medium: 'text-status-warning',
  low: 'text-status-success',
  info: 'text-dark-400',
}

const statusColors = {
  triggered: 'bg-status-critical/10 text-status-critical',
  acknowledged: 'bg-status-warning/10 text-status-warning',
  resolved: 'bg-status-success/10 text-status-success',
}

export function RecentIncidentsTable({ incidents }: RecentIncidentsTableProps) {
  const navigate = useNavigate()

  if (incidents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-status-critical" />
              <CardTitle>Recent Incidents</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/incidents')}>
              View All
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 text-dark-600 mx-auto mb-3" />
            <p className="text-dark-400">No recent incidents</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-status-critical" />
            <CardTitle>Recent Incidents</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/incidents')}>
            View All
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto -mx-6 sm:mx-0">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-dark-700">
                <th className="text-left py-3 px-4 text-xs sm:text-sm font-medium text-dark-400">ID</th>
                <th className="text-left py-3 px-4 text-xs sm:text-sm font-medium text-dark-400">Title</th>
                <th className="text-left py-3 px-4 text-xs sm:text-sm font-medium text-dark-400">Severity</th>
                <th className="text-left py-3 px-4 text-xs sm:text-sm font-medium text-dark-400">Status</th>
                <th className="text-left py-3 px-4 text-xs sm:text-sm font-medium text-dark-400">Time</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((incident) => (
                <tr
                  key={incident.id}
                  className="border-b border-dark-800 hover:bg-dark-800/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/incidents/${incident.id}`)}
                >
                  <td className="py-3 px-4 text-xs sm:text-sm text-dark-300 whitespace-nowrap">
                    #{incident.incidentNumber}
                  </td>
                  <td className="py-3 px-4 text-xs sm:text-sm text-dark-200 max-w-[200px] sm:max-w-md truncate">
                    {incident.title}
                  </td>
                  <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                    <span className={`capitalize ${severityColors[incident.severity]}`}>
                      {incident.severity}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                    <span
                      className={`px-2 py-1 rounded-md text-xs capitalize ${
                        statusColors[incident.status]
                      }`}
                    >
                      {incident.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs sm:text-sm text-dark-400 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span className="hidden sm:inline">
                        {formatDistanceToNow(new Date(incident.triggeredAt), { addSuffix: true })}
                      </span>
                      <span className="sm:hidden">
                        {formatDistanceToNow(new Date(incident.triggeredAt))}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
