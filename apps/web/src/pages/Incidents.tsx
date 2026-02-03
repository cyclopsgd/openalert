import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, Filter, CheckSquare, Square, X } from 'lucide-react'
import { IncidentCard } from '@/components/incidents/IncidentCard'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  useIncidents,
  useBulkAcknowledgeIncidents,
  useBulkResolveIncidents,
} from '@/hooks/useIncidents'
import { useIncidentsStore } from '@/stores/incidentsStore'
import type { DateRangeOption } from '@/stores/incidentsStore'

export function Incidents() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: incidents, isLoading, error, refetch } = useIncidents()
  const {
    filters,
    setFilters,
    clearFilters,
    selectedIncidentIds,
    toggleIncidentSelection,
    clearSelection,
    selectAll,
  } = useIncidentsStore()
  const [showFilters, setShowFilters] = useState(false)

  const bulkAcknowledgeMutation = useBulkAcknowledgeIncidents()
  const bulkResolveMutation = useBulkResolveIncidents()

  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams()
    if (filters.status.length > 0) {
      filters.status.forEach((s) => params.append('status', s))
    }
    if (filters.severity.length > 0) {
      filters.severity.forEach((s) => params.append('severity', s))
    }
    if (filters.search) params.set('search', filters.search)
    if (filters.dateRange !== 'all') params.set('dateRange', filters.dateRange)
    if (filters.sortBy !== 'newest') params.set('sortBy', filters.sortBy)
    if (filters.serviceId) params.set('serviceId', filters.serviceId.toString())
    if (filters.assigneeId) params.set('assigneeId', filters.assigneeId.toString())
    setSearchParams(params, { replace: true })
  }, [filters, setSearchParams])

  // Load filters from URL on mount
  useEffect(() => {
    const status = searchParams.getAll('status')
    const severity = searchParams.getAll('severity')
    const search = searchParams.get('search') || ''
    const dateRange = (searchParams.get('dateRange') || 'all') as DateRangeOption
    const sortBy = (searchParams.get('sortBy') || 'newest') as any
    const serviceId = searchParams.get('serviceId')
    const assigneeId = searchParams.get('assigneeId')

    if (status.length > 0 || severity.length > 0 || search || dateRange !== 'all' || sortBy !== 'newest') {
      setFilters({
        status,
        severity,
        search,
        dateRange,
        sortBy,
        serviceId: serviceId ? parseInt(serviceId, 10) : undefined,
        assigneeId: assigneeId ? parseInt(assigneeId, 10) : undefined,
      })
    }
  }, [])

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

  const setDateRange = (range: DateRangeOption) => {
    setFilters({ dateRange: range })
  }

  const setSortBy = (sortBy: string) => {
    setFilters({ sortBy: sortBy as any })
  }

  const handleBulkAcknowledge = async () => {
    if (selectedIncidentIds.length === 0) return
    await bulkAcknowledgeMutation.mutateAsync(selectedIncidentIds)
    clearSelection()
  }

  const handleBulkResolve = async () => {
    if (selectedIncidentIds.length === 0) return
    await bulkResolveMutation.mutateAsync(selectedIncidentIds)
    clearSelection()
  }

  const hasActiveFilters =
    filters.status.length > 0 ||
    filters.severity.length > 0 ||
    filters.search !== '' ||
    filters.dateRange !== 'all' ||
    filters.sortBy !== 'newest'

  const activeFilterCount =
    filters.status.length +
    filters.severity.length +
    (filters.search ? 1 : 0) +
    (filters.dateRange !== 'all' ? 1 : 0) +
    (filters.sortBy !== 'newest' ? 1 : 0)

  const allSelected = incidents && incidents.length > 0 && selectedIncidentIds.length === incidents.length

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
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
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
            {activeFilterCount > 0 && (
              <Badge className="ml-2 bg-accent-primary text-dark-900">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" onClick={() => { clearFilters(); clearSelection(); }}>
              <X className="h-4 w-4" />
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

            <div>
              <label className="text-sm font-medium text-dark-300 mb-2 block">
                Date Range
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'all', label: 'All Time' },
                  { value: '24h', label: 'Last 24h' },
                  { value: '7d', label: 'Last 7 days' },
                  { value: '30d', label: 'Last 30 days' },
                ].map((range) => (
                  <Button
                    key={range.value}
                    variant={
                      filters.dateRange === range.value ? 'primary' : 'outline'
                    }
                    size="sm"
                    onClick={() => setDateRange(range.value as DateRangeOption)}
                  >
                    {range.label}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-dark-300 mb-2 block">
                Sort By
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'newest', label: 'Newest First' },
                  { value: 'oldest', label: 'Oldest First' },
                  { value: 'severity', label: 'Severity' },
                  { value: 'status', label: 'Status' },
                ].map((sort) => (
                  <Button
                    key={sort.value}
                    variant={
                      filters.sortBy === sort.value ? 'primary' : 'outline'
                    }
                    size="sm"
                    onClick={() => setSortBy(sort.value)}
                  >
                    {sort.label}
                  </Button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {selectedIncidentIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-accent-primary/10 border border-accent-primary rounded-lg flex items-center justify-between flex-wrap gap-3"
          >
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
              >
                <X className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium text-dark-100">
                {selectedIncidentIds.length} selected
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleBulkAcknowledge}
                isLoading={bulkAcknowledgeMutation.isPending}
              >
                Acknowledge Selected
              </Button>
              <Button
                variant="success"
                size="sm"
                onClick={handleBulkResolve}
                isLoading={bulkResolveMutation.isPending}
              >
                Resolve Selected
              </Button>
            </div>
          </motion.div>
        )}

        {incidents && incidents.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (allSelected) {
                  clearSelection()
                } else {
                  selectAll(incidents)
                }
              }}
            >
              {allSelected ? (
                <CheckSquare className="h-4 w-4" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              <span className="ml-2">
                {allSelected ? 'Deselect All' : 'Select All'}
              </span>
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-accent-primary border-t-transparent rounded-full" />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-status-critical mb-4">
            Failed to load incidents: {(error as any)?.message || 'Unknown error'}
          </p>
          <Button onClick={() => refetch()}>Retry</Button>
        </div>
      ) : incidents && incidents.length > 0 ? (
        <div className="space-y-3">
          {incidents.map((incident, index) => (
            <div key={incident.id} className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleIncidentSelection(incident.id)
                  }}
                  className="text-dark-400 hover:text-dark-100 transition-colors"
                >
                  {selectedIncidentIds.includes(incident.id) ? (
                    <CheckSquare className="h-5 w-5 text-accent-primary" />
                  ) : (
                    <Square className="h-5 w-5" />
                  )}
                </button>
              </div>
              <div className="pl-10">
                <IncidentCard
                  incident={incident}
                  index={index}
                  onClick={() => navigate(`/incidents/${incident.id}`)}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-dark-400 mb-2">No incidents found</p>
          {hasActiveFilters && (
            <p className="text-sm text-dark-500 mb-4">
              Try clearing your filters to see more results
            </p>
          )}
          {hasActiveFilters && (
            <Button onClick={() => { clearFilters(); clearSelection(); }}>
              Clear Filters
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
