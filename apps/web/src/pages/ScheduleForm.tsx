import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, Save, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { apiClient } from '@/lib/api/client'

interface Team {
  id: number
  name: string
}

interface User {
  id: number
  name: string
  email: string
}

interface RotationFormData {
  name: string
  rotationType: 'daily' | 'weekly' | 'custom'
  effectiveFrom: string
  effectiveUntil: string
  handoffTime: string
  handoffDay: number
  userIds: number[]
}

export function ScheduleForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEdit = !!id

  const [formData, setFormData] = useState({
    name: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    teamId: '',
  })

  const [rotations, setRotations] = useState<RotationFormData[]>([])

  const { data: teams } = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: async () => {
      const response = await apiClient.get('/teams')
      return response.data
    },
  })

  const { data: users } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await apiClient.get('/users')
      return response.data
    },
  })

  const { data: schedule } = useQuery({
    queryKey: ['schedule', id],
    queryFn: async () => {
      const response = await apiClient.get(`/schedules/${id}`)
      return response.data
    },
    enabled: isEdit,
  })

  useEffect(() => {
    if (schedule) {
      setFormData({
        name: schedule.name,
        timezone: schedule.timezone,
        teamId: schedule.teamId.toString(),
      })
    }
  }, [schedule])

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiClient.post('/schedules', {
        name: data.name,
        timezone: data.timezone,
        teamId: Number(data.teamId),
      })
      return response.data
    },
    onSuccess: async (data) => {
      // Create rotations
      for (const rotation of rotations) {
        await apiClient.post(`/schedules/${data.id}/rotations`, {
          name: rotation.name,
          rotationType: rotation.rotationType,
          effectiveFrom: new Date(rotation.effectiveFrom).toISOString(),
          effectiveUntil: rotation.effectiveUntil
            ? new Date(rotation.effectiveUntil).toISOString()
            : null,
          handoffTime: rotation.handoffTime,
          handoffDay: rotation.handoffDay,
        }).then(async (rotationRes) => {
          // Add members
          for (let i = 0; i < rotation.userIds.length; i++) {
            await apiClient.post(`/schedules/rotations/${rotationRes.data.id}/members`, {
              userId: rotation.userIds[i],
            })
          }
        })
      }

      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      navigate(`/schedules/${data.id}`)
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiClient.patch(`/schedules/${id}`, {
        name: data.name,
        timezone: data.timezone,
        teamId: Number(data.teamId),
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule', id] })
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      navigate(`/schedules/${id}`)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name || !formData.teamId) {
      alert('Please fill in all required fields')
      return
    }

    if (isEdit) {
      updateMutation.mutate(formData)
    } else {
      createMutation.mutate(formData)
    }
  }

  const addRotation = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(9, 0, 0, 0)

    setRotations([
      ...rotations,
      {
        name: '',
        rotationType: 'daily',
        effectiveFrom: tomorrow.toISOString().slice(0, 16),
        effectiveUntil: '',
        handoffTime: '09:00',
        handoffDay: 1,
        userIds: [],
      },
    ])
  }

  const removeRotation = (index: number) => {
    setRotations(rotations.filter((_, i) => i !== index))
  }

  const updateRotation = (index: number, updates: Partial<RotationFormData>) => {
    setRotations(
      rotations.map((rot, i) => (i === index ? { ...rot, ...updates } : rot))
    )
  }

  const timezones = Intl.supportedValuesOf('timeZone')

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate('/schedules')}
            className="mb-2 -ml-2"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Schedules
          </Button>
          <h1 className="text-3xl font-heading font-bold text-dark-50">
            {isEdit ? 'Edit Schedule' : 'Create Schedule'}
          </h1>
        </div>
        <Button
          type="submit"
          disabled={createMutation.isPending || updateMutation.isPending}
        >
          <Save className="h-4 w-4 mr-2" />
          {isEdit ? 'Save Changes' : 'Create Schedule'}
        </Button>
      </div>

      <Card className="p-6">
        <h2 className="text-xl font-semibold text-dark-50 mb-6">
          Basic Information
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Schedule Name *
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Primary On-Call"
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
              {teams?.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Timezone *
            </label>
            <select
              value={formData.timezone}
              onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
              className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-100 focus:outline-none focus:ring-2 focus:ring-accent-primary"
              required
            >
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {!isEdit && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-dark-50">Rotations</h2>
            <Button type="button" variant="secondary" onClick={addRotation}>
              <Plus className="h-4 w-4 mr-2" />
              Add Rotation
            </Button>
          </div>

          {rotations.length === 0 ? (
            <div className="text-center py-8 text-dark-500">
              No rotations added yet. Add a rotation to configure on-call schedule.
            </div>
          ) : (
            <div className="space-y-6">
              {rotations.map((rotation, index) => (
                <div
                  key={index}
                  className="p-4 rounded-lg bg-dark-800 border border-dark-700 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-dark-200">
                      Rotation {index + 1}
                    </h3>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRotation(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-dark-200 mb-2">
                        Rotation Name
                      </label>
                      <Input
                        value={rotation.name}
                        onChange={(e) =>
                          updateRotation(index, { name: e.target.value })
                        }
                        placeholder="e.g., Primary Rotation"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-dark-200 mb-2">
                        Type
                      </label>
                      <select
                        value={rotation.rotationType}
                        onChange={(e) =>
                          updateRotation(index, {
                            rotationType: e.target.value as any,
                          })
                        }
                        className="w-full px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-dark-100 focus:outline-none focus:ring-2 focus:ring-accent-primary"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-dark-200 mb-2">
                        Start Date & Time
                      </label>
                      <Input
                        type="datetime-local"
                        value={rotation.effectiveFrom}
                        onChange={(e) =>
                          updateRotation(index, { effectiveFrom: e.target.value })
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-dark-200 mb-2">
                        End Date (Optional)
                      </label>
                      <Input
                        type="datetime-local"
                        value={rotation.effectiveUntil}
                        onChange={(e) =>
                          updateRotation(index, { effectiveUntil: e.target.value })
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-dark-200 mb-2">
                        Handoff Time
                      </label>
                      <Input
                        type="time"
                        value={rotation.handoffTime}
                        onChange={(e) =>
                          updateRotation(index, { handoffTime: e.target.value })
                        }
                      />
                    </div>

                    {rotation.rotationType === 'weekly' && (
                      <div>
                        <label className="block text-sm font-medium text-dark-200 mb-2">
                          Handoff Day
                        </label>
                        <select
                          value={rotation.handoffDay}
                          onChange={(e) =>
                            updateRotation(index, {
                              handoffDay: Number(e.target.value),
                            })
                          }
                          className="w-full px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-dark-100 focus:outline-none focus:ring-2 focus:ring-accent-primary"
                        >
                          <option value={0}>Sunday</option>
                          <option value={1}>Monday</option>
                          <option value={2}>Tuesday</option>
                          <option value={3}>Wednesday</option>
                          <option value={4}>Thursday</option>
                          <option value={5}>Friday</option>
                          <option value={6}>Saturday</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-dark-200 mb-2">
                      Users in Rotation
                    </label>
                    <select
                      multiple
                      value={rotation.userIds.map(String)}
                      onChange={(e) => {
                        const selected = Array.from(
                          e.target.selectedOptions,
                          (option) => Number(option.value)
                        )
                        updateRotation(index, { userIds: selected })
                      }}
                      className="w-full px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-dark-100 focus:outline-none focus:ring-2 focus:ring-accent-primary min-h-[120px]"
                    >
                      {users?.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} ({user.email})
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-dark-500 mt-1">
                      Hold Ctrl/Cmd to select multiple users
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </form>
  )
}
