import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Edit,
  Trash2,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Wrench,
  Settings as SettingsIcon,
} from 'lucide-react'
import apiClient from '@/lib/api/client'
import { toast } from '@/components/ui/Toast'

interface Service {
  id: number
  name: string
  slug: string
  description: string | null
  teamId: number
  escalationPolicyId: number | null
  status: 'operational' | 'degraded' | 'outage' | 'maintenance'
  dependencies: Array<{
    id: number
    service: {
      id: number
      name: string
      status: string
    }
  }>
  dependents: Array<{
    id: number
    service: {
      id: number
      name: string
      status: string
    }
  }>
  activeIncidents: Array<{
    id: number
    incidentNumber: number
    title: string
    severity: string
    status: string
    triggeredAt: string
  }>
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

export function ServiceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'overview' | 'dependencies' | 'incidents' | 'settings'>('overview')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const { data: service, isLoading } = useQuery<Service>({
    queryKey: ['service', id],
    queryFn: async () => {
      const response = await apiClient.get(`/services/${id}`)
      return response.data
    },
    enabled: !!id,
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiClient.delete(`/services/${id}`)
    },
    onSuccess: () => {
      toast.success('Service deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['services'] })
      navigate('/services')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete service')
    },
  })

  const removeDependencyMutation = useMutation({
    mutationFn: async (dependencyId: number) => {
      await apiClient.delete(`/services/${id}/dependencies/${dependencyId}`)
    },
    onSuccess: () => {
      toast.success('Dependency removed')
      queryClient.invalidateQueries({ queryKey: ['service', id] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to remove dependency')
    },
  })

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-dark-700 rounded w-1/4"></div>
          <div className="h-64 bg-dark-700 rounded"></div>
        </div>
      </div>
    )
  }

  if (!service) {
    return (
      <div className="p-6 text-center">
        <p className="text-dark-400">Service not found</p>
      </div>
    )
  }

  const StatusIcon = statusConfig[service.status].icon

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/services')}
          className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-dark-400" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{service.name}</h1>
            <span
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${
                statusConfig[service.status].className
              }`}
            >
              <StatusIcon className="h-4 w-4" />
              {statusConfig[service.status].label}
            </span>
          </div>
          {service.description && <p className="text-dark-400 mt-1">{service.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/services/${service.id}/edit`}
            className="flex items-center gap-2 px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition-colors"
          >
            <Edit className="h-4 w-4" />
            Edit
          </Link>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>

      <div className="border-b border-dark-700">
        <div className="flex gap-6">
          {['overview', 'dependencies', 'incidents', 'settings'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-3 font-medium capitalize transition-colors relative ${
                activeTab === tab
                  ? 'text-accent-primary'
                  : 'text-dark-400 hover:text-white'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-primary"></div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-dark-800 border border-dark-700 rounded-lg p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Active Incidents</h3>
              {service.activeIncidents.length === 0 ? (
                <p className="text-dark-400">No active incidents</p>
              ) : (
                <div className="space-y-2">
                  {service.activeIncidents.map((incident) => (
                    <Link
                      key={incident.id}
                      to={`/incidents/${incident.id}`}
                      className="block p-4 bg-dark-700 hover:bg-dark-600 border border-dark-600 rounded-lg transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-white font-medium">#{incident.incidentNumber} - {incident.title}</div>
                          <div className="text-sm text-dark-400 mt-1">
                            {new Date(incident.triggeredAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            incident.severity === 'critical' ? 'bg-red-500/10 text-red-400' :
                            incident.severity === 'high' ? 'bg-orange-500/10 text-orange-400' :
                            incident.severity === 'medium' ? 'bg-yellow-500/10 text-yellow-400' :
                            'bg-blue-500/10 text-blue-400'
                          }`}>
                            {incident.severity}
                          </span>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            incident.status === 'triggered' ? 'bg-red-500/10 text-red-400' :
                            incident.status === 'acknowledged' ? 'bg-yellow-500/10 text-yellow-400' :
                            'bg-green-500/10 text-green-400'
                          }`}>
                            {incident.status}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'dependencies' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Dependencies</h3>
              <p className="text-dark-400 mb-4">Services that {service.name} depends on</p>
              {service.dependencies.length === 0 ? (
                <p className="text-dark-400">No dependencies</p>
              ) : (
                <div className="space-y-2">
                  {service.dependencies.map((dep) => (
                    <div
                      key={dep.id}
                      className="flex items-center justify-between p-4 bg-dark-700 border border-dark-600 rounded-lg"
                    >
                      <Link to={`/services/${dep.service.id}`} className="flex-1 hover:text-accent-primary">
                        <div className="text-white font-medium">{dep.service.name}</div>
                        <div className="text-sm text-dark-400 mt-1">Status: {dep.service.status}</div>
                      </Link>
                      <button
                        onClick={() => removeDependencyMutation.mutate(dep.id)}
                        className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded text-sm transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Dependents</h3>
              <p className="text-dark-400 mb-4">Services that depend on {service.name}</p>
              {service.dependents.length === 0 ? (
                <p className="text-dark-400">No dependents</p>
              ) : (
                <div className="space-y-2">
                  {service.dependents.map((dep) => (
                    <Link
                      key={dep.id}
                      to={`/services/${dep.service.id}`}
                      className="block p-4 bg-dark-700 hover:bg-dark-600 border border-dark-600 rounded-lg transition-colors"
                    >
                      <div className="text-white font-medium">{dep.service.name}</div>
                      <div className="text-sm text-dark-400 mt-1">Status: {dep.service.status}</div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'incidents' && (
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">All Incidents</h3>
            <Link
              to={`/incidents?service=${service.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-accent-primary hover:bg-accent-primary/80 text-white rounded-lg transition-colors"
            >
              View All Incidents
            </Link>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark-400 mb-2">Service ID</label>
              <div className="text-white">{service.id}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-400 mb-2">Slug</label>
              <div className="text-white">{service.slug}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-400 mb-2">Team ID</label>
              <div className="text-white">{service.teamId}</div>
            </div>
            {service.escalationPolicyId && (
              <div>
                <label className="block text-sm font-medium text-dark-400 mb-2">Escalation Policy ID</label>
                <div className="text-white">{service.escalationPolicyId}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-800 border border-dark-700 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-2">Delete Service</h3>
            <p className="text-dark-400 mb-6">
              Are you sure you want to delete {service.name}? This action cannot be undone.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteMutation.mutate()
                  setShowDeleteConfirm(false)
                }}
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
