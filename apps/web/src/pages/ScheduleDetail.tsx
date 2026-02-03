import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Calendar,
  Clock,
  Edit,
  Trash2,
  Plus,
  ChevronLeft,
  ChevronRight,
  User,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { api } from '@/lib/api'

interface Schedule {
  id: number
  name: string
  timezone: string
  teamId: number
  team?: {
    id: number
    name: string
  }
  rotations: Array<{
    id: number
    name: string
    rotationType: string
    effectiveFrom: string
    effectiveUntil: string | null
    members: Array<{
      user: {
        id: number
        name: string
        email: string
      }
      position: number
    }>
  }>
  createdAt: string
}

interface UpcomingShift {
  date: string
  user: {
    id: number
    name: string
    email: string
  } | null
  rotation: string | null
}

export function ScheduleDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0)

  const { data: schedule, isLoading } = useQuery<Schedule>({
    queryKey: ['schedule', id],
    queryFn: async () => {
      const response = await api.get(`/schedules/${id}`)
      return response.data
    },
    enabled: !!id,
  })

  const { data: upcomingShifts } = useQuery<UpcomingShift[]>({
    queryKey: ['schedule-upcoming', id],
    queryFn: async () => {
      const response = await api.get(`/schedules/${id}/upcoming?days=7`)
      return response.data
    },
    enabled: !!id,
  })

  const { data: currentOnCall } = useQuery({
    queryKey: ['schedule-oncall', id],
    queryFn: async () => {
      const response = await api.get(`/schedules/${id}/current`)
      return response.data
    },
    enabled: !!id,
    refetchInterval: 60000, // Refresh every minute
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/schedules/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      navigate('/schedules')
    },
  })

  const handleDelete = () => {
    deleteMutation.mutate()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-accent-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!schedule) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-dark-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-dark-200 mb-2">
          Schedule not found
        </h3>
        <Button onClick={() => navigate('/schedules')}>
          Back to Schedules
        </Button>
      </div>
    )
  }

  const getWeekDates = () => {
    const dates = []
    const today = new Date()
    const startDate = new Date(today)
    startDate.setDate(today.getDate() + currentWeekOffset * 7)

    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + i)
      dates.push(date)
    }
    return dates
  }

  const weekDates = getWeekDates()
  const isCurrentWeek = currentWeekOffset === 0

  const getShiftForDate = (date: Date) => {
    if (!upcomingShifts) return null
    const dateStr = date.toISOString().split('T')[0]
    return upcomingShifts.find(shift => shift.date === dateStr)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            onClick={() => navigate('/schedules')}
            className="mb-2 -ml-2"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Schedules
          </Button>
          <h1 className="text-3xl font-heading font-bold text-dark-50">
            {schedule.name}
          </h1>
          <p className="text-dark-400 mt-1">
            {schedule.team?.name || 'No Team'} • {schedule.timezone}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => navigate(`/schedules/${id}/edit`)}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button
            variant="danger"
            onClick={() => setShowDeleteModal(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {currentOnCall && (
        <Card className="p-6 bg-gradient-to-br from-accent-primary/10 to-accent-secondary/10 border-accent-primary/20">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center">
              <User className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-dark-400 mb-1">Currently On-Call</p>
              <h3 className="text-xl font-semibold text-dark-50">
                {currentOnCall.user?.name || 'No one on call'}
              </h3>
              {currentOnCall.user && (
                <p className="text-sm text-dark-400">{currentOnCall.user.email}</p>
              )}
            </div>
          </div>
        </Card>
      )}

      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-dark-50 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-accent-primary" />
            On-Call Calendar
          </h2>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentWeekOffset(prev => prev - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {!isCurrentWeek && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentWeekOffset(0)}
              >
                Today
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentWeekOffset(prev => prev + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-4">
          {weekDates.map((date, index) => {
            const shift = getShiftForDate(date)
            const isToday = date.toDateString() === new Date().toDateString()

            return (
              <div
                key={index}
                className={`p-4 rounded-lg border ${
                  isToday
                    ? 'border-accent-primary bg-accent-primary/5'
                    : 'border-dark-700 bg-dark-800'
                }`}
              >
                <div className="text-center mb-3">
                  <p className="text-xs text-dark-500 uppercase">
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </p>
                  <p className={`text-lg font-semibold ${
                    isToday ? 'text-accent-primary' : 'text-dark-200'
                  }`}>
                    {date.getDate()}
                  </p>
                </div>

                {shift?.user ? (
                  <div className="space-y-2">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center mx-auto">
                      <span className="text-white text-xs font-semibold">
                        {shift.user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-dark-300 text-center truncate">
                      {shift.user.name}
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-xs text-dark-500">No coverage</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-dark-50 flex items-center gap-2">
            <Clock className="h-5 w-5 text-accent-primary" />
            Rotations
          </h2>
          <Button
            size="sm"
            onClick={() => navigate(`/schedules/${id}/rotations/new`)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Rotation
          </Button>
        </div>

        {schedule.rotations && schedule.rotations.length > 0 ? (
          <div className="space-y-4">
            {schedule.rotations.map((rotation) => (
              <div
                key={rotation.id}
                className="p-4 rounded-lg bg-dark-800 border border-dark-700"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-dark-50">
                      {rotation.name || 'Rotation'}
                    </h3>
                    <p className="text-sm text-dark-400 capitalize">
                      {rotation.rotationType} rotation
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/schedules/rotations/${rotation.id}/edit`)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {rotation.members.map((member) => (
                    <div
                      key={member.user.id}
                      className="flex items-center gap-2 px-3 py-1 rounded-full bg-dark-700 text-sm"
                    >
                      <div className="h-6 w-6 rounded-full bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center">
                        <span className="text-white text-xs font-semibold">
                          {member.user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-dark-200">{member.user.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-dark-500">
            No rotations configured yet
          </div>
        )}
      </Card>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Schedule"
      >
        <div className="space-y-4">
          <p className="text-dark-300">
            Are you sure you want to delete this schedule? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowDeleteModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Schedule'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
