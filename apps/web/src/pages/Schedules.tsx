import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Calendar, Plus, Clock, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { apiClient } from '@/lib/api/client'

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
    members: Array<{
      user: {
        id: number
        name: string
        email: string
      }
    }>
  }>
  createdAt: string
}

export function Schedules() {
  const navigate = useNavigate()

  const { data: schedules, isLoading } = useQuery<Schedule[]>({
    queryKey: ['schedules'],
    queryFn: async () => {
      const response = await apiClient.get('/schedules')
      return response.data
    },
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getMemberCount = (schedule: Schedule) => {
    const uniqueMembers = new Set()
    schedule.rotations?.forEach(rotation => {
      rotation.members?.forEach(member => {
        uniqueMembers.add(member.user.id)
      })
    })
    return uniqueMembers.size
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
          <h1 className="text-3xl font-heading font-bold text-dark-50">On-Call Schedules</h1>
          <p className="text-dark-400 mt-1">
            Manage on-call rotations and schedules
          </p>
        </div>
        <Button
          onClick={() => navigate('/schedules/new')}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Create Schedule
        </Button>
      </div>

      {!schedules || schedules.length === 0 ? (
        <Card className="p-12 text-center">
          <Calendar className="h-12 w-12 text-dark-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-dark-200 mb-2">
            No schedules yet
          </h3>
          <p className="text-dark-400 mb-6">
            Create your first on-call schedule to get started
          </p>
          <Button
            onClick={() => navigate('/schedules/new')}
            className="mx-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Schedule
          </Button>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {schedules.map((schedule) => (
            <Card
              key={schedule.id}
              className="p-6 hover:border-accent-primary/50 transition-colors cursor-pointer"
              onClick={() => navigate(`/schedules/${schedule.id}`)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-accent-primary/10 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-accent-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-dark-50">
                      {schedule.name}
                    </h3>
                    <p className="text-sm text-dark-400">
                      {schedule.team?.name || 'No Team'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-dark-300">
                  <Clock className="h-4 w-4 text-dark-500" />
                  <span>{schedule.timezone}</span>
                </div>

                <div className="flex items-center gap-2 text-sm text-dark-300">
                  <Users className="h-4 w-4 text-dark-500" />
                  <span>
                    {getMemberCount(schedule)} member{getMemberCount(schedule) !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="pt-3 border-t border-dark-700">
                  <p className="text-xs text-dark-500">
                    Created {formatDate(schedule.createdAt)}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
