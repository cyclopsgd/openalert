import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import apiClient from '@/lib/api/client'
import { toast } from '@/components/ui/Toast'

interface Team {
  id: number
  name: string
}

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
    }
  }>
}

interface ServiceOption {
  id: number
  name: string
}

export function ServiceForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEditing = !!id

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    teamId: '',
    escalationPolicyId: '',
    status: 'operational' as 'operational' | 'degraded' | 'outage' | 'maintenance',
    dependencyIds: [] as number[],
  })

  const { data: service } = useQuery<Service>({
    queryKey: ['service', id],
    queryFn: async () => {
      const response = await apiClient.get(`/services/${id}`)
      return response.data
    },
    enabled: isEditing,
  })

  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: async () => {
      const response = await apiClient.get('/teams')
      return response.data
    },
  })

  const { data: services = [] } = useQuery<ServiceOption[]>({
    queryKey: ['services-options'],
    queryFn: async () => {
      const response = await apiClient.get('/services')
      return response.data
    },
  })

  useEffect(() => {
    if (service) {
      setFormData({
        name: service.name,
        slug: service.slug,
        description: service.description || '',
        teamId: service.teamId.toString(),
        escalationPolicyId: service.escalationPolicyId?.toString() || '',
        status: service.status,
        dependencyIds: service.dependencies.map((d) => d.service.id),
      })
    }
  }, [service])

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        ...data,
        teamId: parseInt(data.teamId),
        escalationPolicyId: data.escalationPolicyId ? parseInt(data.escalationPolicyId) : undefined,
      }
      const response = await apiClient.post('/services', payload)
      return response.data
    },
    onSuccess: () => {
      toast.success('Service created successfully')
      queryClient.invalidateQueries({ queryKey: ['services'] })
      navigate('/services')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create service')
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        ...data,
        teamId: parseInt(data.teamId),
        escalationPolicyId: data.escalationPolicyId ? parseInt(data.escalationPolicyId) : undefined,
      }
      const response = await apiClient.put(`/services/${id}`, payload)
      return response.data
    },
    onSuccess: () => {
      toast.success('Service updated successfully')
      queryClient.invalidateQueries({ queryKey: ['services'] })
      queryClient.invalidateQueries({ queryKey: ['service', id] })
      navigate(`/services/${id}`)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update service')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name || !formData.teamId) {
      toast.error('Please fill in all required fields')
      return
    }

    // Validate circular dependencies
    if (isEditing && formData.dependencyIds.includes(parseInt(id!))) {
      toast.error('A service cannot depend on itself')
      return
    }

    if (isEditing) {
      updateMutation.mutate(formData)
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleNameChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      name: value,
      slug: !isEditing && !prev.slug ? generateSlug(value) : prev.slug,
    }))
  }

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  const toggleDependency = (serviceId: number) => {
    setFormData((prev) => ({
      ...prev,
      dependencyIds: prev.dependencyIds.includes(serviceId)
        ? prev.dependencyIds.filter((id) => id !== serviceId)
        : [...prev.dependencyIds, serviceId],
    }))
  }

  const availableServices = services.filter((s) => !isEditing || s.id !== parseInt(id!))

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(isEditing ? `/services/${id}` : '/services')}
          className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-dark-400" />
        </button>
        <h1 className="text-2xl font-bold text-white">
          {isEditing ? 'Edit Service' : 'Create Service'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-dark-800 border border-dark-700 rounded-lg p-6 space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-dark-400 mb-2">
            Service Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            id="name"
            value={formData.name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:outline-none focus:border-accent-primary"
            placeholder="e.g., API Gateway"
            required
          />
        </div>

        <div>
          <label htmlFor="slug" className="block text-sm font-medium text-dark-400 mb-2">
            Slug
          </label>
          <input
            type="text"
            id="slug"
            value={formData.slug}
            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
            className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:outline-none focus:border-accent-primary"
            placeholder="Auto-generated from name"
          />
          <p className="text-xs text-dark-400 mt-1">Leave blank to auto-generate from name</p>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-dark-400 mb-2">
            Description
          </label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:outline-none focus:border-accent-primary"
            placeholder="Describe this service..."
            rows={3}
          />
        </div>

        <div>
          <label htmlFor="teamId" className="block text-sm font-medium text-dark-400 mb-2">
            Team <span className="text-red-400">*</span>
          </label>
          <select
            id="teamId"
            value={formData.teamId}
            onChange={(e) => setFormData({ ...formData, teamId: e.target.value })}
            className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-accent-primary"
            required
          >
            <option value="">Select a team</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="status" className="block text-sm font-medium text-dark-400 mb-2">
            Status
          </label>
          <select
            id="status"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
            className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-accent-primary"
          >
            <option value="operational">Operational</option>
            <option value="degraded">Degraded</option>
            <option value="outage">Outage</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-400 mb-2">
            Dependencies
          </label>
          <p className="text-xs text-dark-400 mb-3">
            Select services that this service depends on
          </p>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {availableServices.length === 0 ? (
              <p className="text-dark-400 text-sm">No other services available</p>
            ) : (
              availableServices.map((svc) => (
                <label
                  key={svc.id}
                  className="flex items-center gap-3 p-3 bg-dark-700 border border-dark-600 rounded-lg cursor-pointer hover:border-accent-primary transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={formData.dependencyIds.includes(svc.id)}
                    onChange={() => toggleDependency(svc.id)}
                    className="w-4 h-4 rounded border-dark-600 bg-dark-700 text-accent-primary focus:ring-accent-primary focus:ring-offset-0"
                  />
                  <span className="text-white">{svc.name}</span>
                </label>
              ))
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-dark-700">
          <button
            type="button"
            onClick={() => navigate(isEditing ? `/services/${id}` : '/services')}
            className="flex-1 px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-accent-primary hover:bg-accent-primary/80 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            {createMutation.isPending || updateMutation.isPending
              ? 'Saving...'
              : isEditing
              ? 'Update Service'
              : 'Create Service'}
          </button>
        </div>
      </form>
    </div>
  )
}
