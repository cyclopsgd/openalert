import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit, Trash2, ArrowRight, Users, Calendar, Building } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { apiClient } from '@/lib/api/client'

interface EscalationPolicy {
  id: number
  name: string
  teamId: number
  team?: {
    id: number
    name: string
  }
  repeatCount: number
  repeatDelayMinutes: number
  levels: Array<{
    id: number
    level: number
    delayMinutes: number
    targets: Array<{
      id: number
      targetType: 'user' | 'schedule' | 'team'
      targetId: number
    }>
  }>
  createdAt: string
}

const getTargetIcon = (type: string) => {
  switch (type) {
    case 'user':
      return <Users className="h-4 w-4" />
    case 'schedule':
      return <Calendar className="h-4 w-4" />
    case 'team':
      return <Building className="h-4 w-4" />
    default:
      return null
  }
}

export function EscalationPolicies() {
  const queryClient = useQueryClient()
  const [selectedPolicy, setSelectedPolicy] = useState<EscalationPolicy | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const { data: policies, isLoading } = useQuery<EscalationPolicy[]>({
    queryKey: ['escalation-policies'],
    queryFn: async () => {
      const response = await apiClient.get('/escalation-policies')
      return response.data
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/escalation-policies/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['escalation-policies'] })
      setShowDeleteModal(false)
      setSelectedPolicy(null)
    },
  })

  const handleDelete = () => {
    if (selectedPolicy) {
      deleteMutation.mutate(selectedPolicy.id)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-accent-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-dark-50">
            Escalation Policies
          </h1>
          <p className="text-dark-400 mt-1">
            Define how incidents are escalated to different teams and users
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Policy
        </Button>
      </div>

      {!policies || policies.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="h-12 w-12 rounded-full bg-accent-primary/10 flex items-center justify-center mx-auto mb-4">
            <ArrowRight className="h-6 w-6 text-accent-primary" />
          </div>
          <h3 className="text-lg font-semibold text-dark-200 mb-2">
            No escalation policies yet
          </h3>
          <p className="text-dark-400 mb-6">
            Create your first escalation policy to define how incidents are handled
          </p>
          <Button onClick={() => setShowCreateModal(true)} className="mx-auto">
            <Plus className="h-4 w-4 mr-2" />
            Create Policy
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {policies.map((policy) => (
            <Card key={policy.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-dark-50">
                    {policy.name}
                  </h3>
                  <p className="text-sm text-dark-400">
                    {policy.team?.name || 'No Team'} • {policy.levels.length} level
                    {policy.levels.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSelectedPolicy(policy)
                      setShowCreateModal(true)
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      setSelectedPolicy(policy)
                      setShowDeleteModal(true)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {policy.levels.map((level, index) => (
                  <div key={level.id} className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-accent-primary/20 flex items-center justify-center">
                        <span className="text-sm font-semibold text-accent-primary">
                          {level.level}
                        </span>
                      </div>
                      <span className="text-sm text-dark-400">
                        {level.delayMinutes} min
                      </span>
                    </div>

                    {index < policy.levels.length - 1 && (
                      <ArrowRight className="h-4 w-4 text-dark-600" />
                    )}

                    <div className="flex flex-wrap gap-2">
                      {level.targets.map((target) => (
                        <div
                          key={target.id}
                          className="flex items-center gap-2 px-3 py-1 rounded-full bg-dark-800 border border-dark-700 text-sm"
                        >
                          {getTargetIcon(target.targetType)}
                          <span className="text-dark-200 capitalize">
                            {target.targetType}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-dark-700 flex items-center justify-between">
                <p className="text-xs text-dark-500">
                  Created {formatDate(policy.createdAt)}
                </p>
                <p className="text-sm text-dark-400">
                  Repeat {policy.repeatCount} times every {policy.repeatDelayMinutes} min
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showCreateModal && (
        <EscalationPolicyModal
          policy={selectedPolicy}
          onClose={() => {
            setShowCreateModal(false)
            setSelectedPolicy(null)
          }}
        />
      )}

      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false)
          setSelectedPolicy(null)
        }}
        title="Delete Escalation Policy"
      >
        <div className="space-y-4">
          <p className="text-dark-300">
            Are you sure you want to delete <strong>{selectedPolicy?.name}</strong>?
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowDeleteModal(false)
                setSelectedPolicy(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Policy'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

interface EscalationPolicyModalProps {
  policy: EscalationPolicy | null
  onClose: () => void
}

function EscalationPolicyModal({ policy, onClose }: EscalationPolicyModalProps) {
  const queryClient = useQueryClient()
  const isEdit = !!policy

  const [formData, setFormData] = useState({
    name: policy?.name || '',
    teamId: policy?.teamId?.toString() || '',
    repeatCount: policy?.repeatCount || 3,
    repeatDelayMinutes: policy?.repeatDelayMinutes || 5,
  })

  const [levels, setLevels] = useState<
    Array<{
      level: number
      delayMinutes: number
      targets: Array<{ targetType: 'user' | 'schedule' | 'team'; targetId: number }>
    }>
  >(
    policy?.levels.map((l) => ({
      level: l.level,
      delayMinutes: l.delayMinutes,
      targets: l.targets.map((t) => ({
        targetType: t.targetType,
        targetId: t.targetId,
      })),
    })) || [{ level: 1, delayMinutes: 5, targets: [] }]
  )

  const { data: teams } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const response = await apiClient.get('/teams')
      return response.data
    },
  })

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await apiClient.get('/users')
      return response.data
    },
  })

  const { data: schedules } = useQuery({
    queryKey: ['schedules'],
    queryFn: async () => {
      const response = await apiClient.get('/schedules')
      return response.data
    },
  })

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      if (isEdit) {
        await apiClient.patch(`/escalation-policies/${policy.id}`, data)
      } else {
        await apiClient.post('/escalation-policies', data)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['escalation-policies'] })
      onClose()
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name || !formData.teamId) {
      alert('Please fill in all required fields')
      return
    }

    createMutation.mutate({
      name: formData.name,
      teamId: Number(formData.teamId),
      repeatCount: formData.repeatCount,
      repeatDelayMinutes: formData.repeatDelayMinutes,
      levels: levels,
    })
  }

  const addLevel = () => {
    setLevels([...levels, { level: levels.length + 1, delayMinutes: 5, targets: [] }])
  }

  const removeLevel = (index: number) => {
    setLevels(levels.filter((_, i) => i !== index))
  }

  const updateLevel = (
    index: number,
    updates: Partial<(typeof levels)[0]>
  ) => {
    setLevels(levels.map((l, i) => (i === index ? { ...l, ...updates } : l)))
  }

  const addTarget = (levelIndex: number, targetType: 'user' | 'schedule' | 'team', targetId: number) => {
    const level = levels[levelIndex]
    updateLevel(levelIndex, {
      targets: [...level.targets, { targetType, targetId }],
    })
  }

  const removeTarget = (levelIndex: number, targetIndex: number) => {
    const level = levels[levelIndex]
    updateLevel(levelIndex, {
      targets: level.targets.filter((_, i) => i !== targetIndex),
    })
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isEdit ? 'Edit Escalation Policy' : 'Create Escalation Policy'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Policy Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-100 focus:outline-none focus:ring-2 focus:ring-accent-primary"
              placeholder="e.g., Primary Escalation"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Team *
            </label>
            <select
              value={formData.teamId}
              onChange={(e) => setFormData({ ...formData, teamId: e.target.value })}
              className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-100 focus:outline-none focus:ring-2 focus:ring-accent-primary"
              required
            >
              <option value="">Select a team</option>
              {teams?.map((team: any) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Repeat Count
              </label>
              <input
                type="number"
                min="0"
                value={formData.repeatCount}
                onChange={(e) =>
                  setFormData({ ...formData, repeatCount: Number(e.target.value) })
                }
                className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-100 focus:outline-none focus:ring-2 focus:ring-accent-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Repeat Delay (minutes)
              </label>
              <input
                type="number"
                min="0"
                value={formData.repeatDelayMinutes}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    repeatDelayMinutes: Number(e.target.value),
                  })
                }
                className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-100 focus:outline-none focus:ring-2 focus:ring-accent-primary"
              />
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-dark-50">Escalation Levels</h3>
            <Button type="button" variant="secondary" size="sm" onClick={addLevel}>
              <Plus className="h-4 w-4 mr-2" />
              Add Level
            </Button>
          </div>

          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {levels.map((level, levelIndex) => (
              <div key={levelIndex} className="p-4 bg-dark-900 rounded-lg border border-dark-700">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-dark-200">Level {level.level}</h4>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeLevel(levelIndex)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="mb-3">
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Timeout (minutes)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={level.delayMinutes}
                    onChange={(e) =>
                      updateLevel(levelIndex, { delayMinutes: Number(e.target.value) })
                    }
                    className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-100 focus:outline-none focus:ring-2 focus:ring-accent-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Targets
                  </label>

                  <div className="flex gap-2 mb-2">
                    <select
                      className="flex-1 px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-100 focus:outline-none focus:ring-2 focus:ring-accent-primary"
                      onChange={(e) => {
                        const [type, id] = e.target.value.split(':')
                        if (type && id) {
                          addTarget(levelIndex, type as any, Number(id))
                          e.target.value = ''
                        }
                      }}
                    >
                      <option value="">Add target...</option>
                      <optgroup label="Users">
                        {users?.map((user: any) => (
                          <option key={`user:${user.id}`} value={`user:${user.id}`}>
                            {user.name}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Schedules">
                        {schedules?.map((schedule: any) => (
                          <option key={`schedule:${schedule.id}`} value={`schedule:${schedule.id}`}>
                            {schedule.name}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Teams">
                        {teams?.map((team: any) => (
                          <option key={`team:${team.id}`} value={`team:${team.id}`}>
                            {team.name}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {level.targets.map((target, targetIndex) => (
                      <div
                        key={targetIndex}
                        className="flex items-center gap-2 px-3 py-1 rounded-full bg-dark-800 border border-dark-700 text-sm"
                      >
                        {getTargetIcon(target.targetType)}
                        <span className="text-dark-200 capitalize">{target.targetType}</span>
                        <button
                          type="button"
                          onClick={() => removeTarget(levelIndex, targetIndex)}
                          className="text-dark-500 hover:text-dark-300"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-dark-700">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending
              ? 'Saving...'
              : isEdit
                ? 'Save Changes'
                : 'Create Policy'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
