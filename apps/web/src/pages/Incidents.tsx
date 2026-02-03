import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, Filter } from 'lucide-react'
import { IncidentCard } from '@/components/incidents/IncidentCard'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useIncidents } from '@/hooks/useIncidents'
import { useIncidentsStore } from '@/stores/incidentsStore'

export function Incidents() {
  const navigate = useNavigate()
  const { data: incidents, isLoading } = useIncidents()
  const { filters, setFilters, clearFilters } = useIncidentsStore()
  const [showFilters, setShowFilters] = useState(false)

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ search: e.target.value })
  }

  const toggleStatusFilter = (status: string) => {
    const newStatuses = filters.status.includes(status)
      ? filters.status.filter((s) => s !== status)
      : [...filters.status, status]
    setFilters({ status: newStatuses })
  }

  const toggleSeverityFilter = (severity: string) => {
    const newSeverities = filters.severity.includes(severity)
      ? filters.severity.filter((s) => s !== severity)
      : [...filters.severity, severity]
    setFilters({ severity: newSeverities })
  }

  const hasActiveFilters =
    filters.status.length > 0 ||
    filters.severity.length > 0 ||
    filters.search !== ''

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-heading font-bold text-dark-50 mb-2">
          Incidents
        </h1>
        <p className="text-dark-400">
          Manage and track all your incidents
        </p>
      </motion.div>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-400" />
            <Input
              placeholder="Search incidents..."
              value={filters.search}
              onChange={handleSearchChange}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <Badge className="ml-2">
                {filters.status.length + filters.severity.length}
              </Badge>
            )}
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" onClick={clearFilters}>
              Clear
            </Button>
          )}
        </div>

        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 bg-dark-800 border border-dark-700 rounded-lg space-y-4"
          >
            <div>
              <label className="text-sm font-medium text-dark-300 mb-2 block">
                Status
              </label>
              <div className="flex flex-wrap gap-2">
                {['triggered', 'acknowledged', 'resolved'].map((status) => (
                  <Button
                    key={status}
                    variant={
                      filters.status.includes(status) ? 'primary' : 'outline'
                    }
                    size="sm"
                    onClick={() => toggleStatusFilter(status)}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-dark-300 mb-2 block">
                Severity
              </label>
              <div className="flex flex-wrap gap-2">
                {['critical', 'high', 'medium', 'low', 'info'].map((severity) => (
                  <Button
                    key={severity}
                    variant={
                      filters.severity.includes(severity) ? 'primary' : 'outline'
                    }
                    size="sm"
                    onClick={() => toggleSeverityFilter(severity)}
                  >
                    {severity.charAt(0).toUpperCase() + severity.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-accent-primary border-t-transparent rounded-full" />
        </div>
      ) : incidents && incidents.length > 0 ? (
        <div className="space-y-3">
          {incidents.map((incident, index) => (
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
          <p className="text-dark-400">No incidents found</p>
        </div>
      )}
    </div>
  )
}
