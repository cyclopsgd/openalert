import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, Search, AlertCircle, AlertTriangle, CheckCircle, Wrench } from 'lucide-react'
import apiClient from '@/lib/api/client'

interface Service {
  id: number
  name: string
  slug: string
  description: string | null
  teamId: number
  status: 'operational' | 'degraded' | 'outage' | 'maintenance'
  activeIncidentCount: number
  dependencyCount: number
  createdAt: string
}

const statusConfig = {
  operational: {
    icon: CheckCircle,
    label: 'Operational',
    className: 'bg-green-500/10 text-green-400 border-green-500/20',
  },
  degraded: {
    icon: AlertTriangle,
    label: 'Degraded',
    className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  },
  outage: {
    icon: AlertCircle,
    label: 'Outage',
    className: 'bg-red-500/10 text-red-400 border-red-500/20',
  },
  maintenance: {
    icon: Wrench,
    label: 'Maintenance',
    className: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
}

export function Services() {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const { data: services = [], isLoading } = useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: async () => {
      const response = await apiClient.get('/services')
      return response.data
    },
  })

  const filteredServices = services.filter((service) => {
    const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.description?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === 'all' || service.status === statusFilter

    return matchesSearch && matchesStatus
  })

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-dark-700 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-48 bg-dark-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Services</h1>
          <p className="text-sm sm:text-base text-dark-400 mt-1">Manage your monitored services and dependencies</p>
        </div>
        <Link
          to="/services/new"
          className="flex items-center gap-2 px-4 py-2 bg-accent-primary hover:bg-accent-primary/80 text-white rounded-lg transition-colors min-h-[44px] w-full sm:w-auto justify-center"
        >
          <Plus className="h-4 w-4" />
          <span>Create Service</span>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-400" />
          <input
            type="text"
            placeholder="Search services..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 sm:py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:outline-none focus:border-accent-primary text-base sm:text-sm min-h-[44px]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-3 sm:py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-accent-primary text-base sm:text-sm min-h-[44px]"
        >
          <option value="all">All Status</option>
          <option value="operational">Operational</option>
          <option value="degraded">Degraded</option>
          <option value="outage">Outage</option>
          <option value="maintenance">Maintenance</option>
        </select>
      </div>

      {filteredServices.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-dark-400 mb-4">
            {searchQuery || statusFilter !== 'all' ? 'No services match your filters' : 'No services yet'}
          </div>
          {!searchQuery && statusFilter === 'all' && (
            <Link
              to="/services/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-accent-primary hover:bg-accent-primary/80 text-white rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create your first service
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filteredServices.map((service) => {
            const StatusIcon = statusConfig[service.status].icon
            return (
              <Link
                key={service.id}
                to={`/services/${service.id}`}
                className="block p-4 sm:p-6 bg-dark-800 border border-dark-700 rounded-lg hover:border-accent-primary transition-colors touch-manipulation"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-0 mb-3">
                  <h3 className="text-base sm:text-lg font-semibold text-white break-words">{service.name}</h3>
                  <span
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border self-start ${
                      statusConfig[service.status].className
                    }`}
                  >
                    <StatusIcon className="h-3 w-3" />
                    <span className="whitespace-nowrap">{statusConfig[service.status].label}</span>
                  </span>
                </div>

                {service.description && (
                  <p className="text-dark-400 text-xs sm:text-sm mb-4 line-clamp-2">{service.description}</p>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-dark-400 pt-4 border-t border-dark-700">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>
                      {service.activeIncidentCount}{' '}
                      {service.activeIncidentCount === 1 ? 'incident' : 'incidents'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-4 w-4 flex items-center justify-center text-xs flex-shrink-0">🔗</div>
                    <span>
                      {service.dependencyCount}{' '}
                      {service.dependencyCount === 1 ? 'dependency' : 'dependencies'}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
