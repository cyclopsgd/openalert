import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, UserPlus, X, Crown, User, Eye } from 'lucide-react'
import apiClient from '@/lib/api/client'
import { toast } from '@/components/ui/Toast'

interface Team {
  id: number
  name: string
  slug: string
  description: string | null
  memberCount: number
  serviceCount: number
}

interface TeamDetail {
  id: number
  name: string
  slug: string
  description: string | null
  members: Array<{
    id: number
    userId: number
    role: string
    user: {
      id: number
      name: string
      email: string
    }
  }>
  services: Array<{
    id: number
    name: string
  }>
}

interface UserOption {
  id: number
  name: string
  email: string
}

export function TeamManagement() {
  const queryClient = useQueryClient()
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAddMemberModal, setShowAddMemberModal] = useState(false)
  const [createFormData, setCreateFormData] = useState({
    name: '',
    slug: '',
    description: '',
  })
  const [addMemberFormData, setAddMemberFormData] = useState({
    userId: '',
    role: 'member',
  })

  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: async () => {
      const response = await apiClient.get('/teams')
      return response.data
    },
  })

  const { data: teamDetail } = useQuery<TeamDetail>({
    queryKey: ['team', selectedTeam],
    queryFn: async () => {
      const response = await apiClient.get(`/teams/${selectedTeam}`)
      return response.data
    },
    enabled: !!selectedTeam,
  })

  const { data: users = [] } = useQuery<UserOption[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await apiClient.get('/users')
      return response.data
    },
  })

  const createMutation = useMutation({
    mutationFn: async (data: typeof createFormData) => {
      const response = await apiClient.post('/teams', data)
      return response.data
    },
    onSuccess: () => {
      toast.success('Team created successfully')
      queryClient.invalidateQueries({ queryKey: ['teams'] })
      setShowCreateModal(false)
      setCreateFormData({ name: '', slug: '', description: '' })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create team')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/teams/${id}`)
    },
    onSuccess: () => {
      toast.success('Team deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['teams'] })
      setSelectedTeam(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete team')
    },
  })

  const addMemberMutation = useMutation({
    mutationFn: async (data: { teamId: number; userId: number; role: string }) => {
      const response = await apiClient.post(`/teams/${data.teamId}/members`, {
        userId: data.userId,
        role: data.role,
      })
      return response.data
    },
    onSuccess: () => {
      toast.success('Member added successfully')
      queryClient.invalidateQueries({ queryKey: ['team', selectedTeam] })
      setShowAddMemberModal(false)
      setAddMemberFormData({ userId: '', role: 'member' })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to add member')
    },
  })

  const removeMemberMutation = useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: number; userId: number }) => {
      await apiClient.delete(`/teams/${teamId}/members/${userId}`)
    },
    onSuccess: () => {
      toast.success('Member removed successfully')
      queryClient.invalidateQueries({ queryKey: ['team', selectedTeam] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to remove member')
    },
  })

  const updateRoleMutation = useMutation({
    mutationFn: async ({ teamId, userId, role }: { teamId: number; userId: number; role: string }) => {
      await apiClient.put(`/teams/${teamId}/members/${userId}/role`, { role })
    },
    onSuccess: () => {
      toast.success('Member role updated successfully')
      queryClient.invalidateQueries({ queryKey: ['team', selectedTeam] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update member role')
    },
  })

  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault()
    if (!createFormData.name) {
      toast.error('Please enter a team name')
      return
    }
    createMutation.mutate(createFormData)
  }

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault()
    if (!addMemberFormData.userId || !selectedTeam) {
      toast.error('Please select a user')
      return
    }
    addMemberMutation.mutate({
      teamId: selectedTeam,
      userId: parseInt(addMemberFormData.userId),
      role: addMemberFormData.role,
    })
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'team_admin':
        return <Crown className="h-4 w-4 text-yellow-400" />
      case 'member':
        return <User className="h-4 w-4 text-blue-400" />
      case 'observer':
        return <Eye className="h-4 w-4 text-dark-400" />
      default:
        return null
    }
  }

  const availableUsers = users.filter(
    (user) => !teamDetail?.members.some((m) => m.userId === user.id)
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Team Management</h2>
          <p className="text-dark-400 mt-1">Manage teams and their members</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent-primary hover:bg-accent-primary/80 text-white rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create Team
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-2">
          <h3 className="text-lg font-semibold text-white mb-3">Teams</h3>
          {teams.length === 0 ? (
            <p className="text-dark-400 text-sm">No teams yet</p>
          ) : (
            teams.map((team) => (
              <button
                key={team.id}
                onClick={() => setSelectedTeam(team.id)}
                className={`w-full text-left p-4 rounded-lg border transition-colors ${
                  selectedTeam === team.id
                    ? 'bg-dark-700 border-accent-primary'
                    : 'bg-dark-800 border-dark-700 hover:border-dark-600'
                }`}
              >
                <div className="font-medium text-white">{team.name}</div>
                <div className="text-sm text-dark-400 mt-1">
                  {team.memberCount} {team.memberCount === 1 ? 'member' : 'members'} •{' '}
                  {team.serviceCount} {team.serviceCount === 1 ? 'service' : 'services'}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="lg:col-span-2">
          {!selectedTeam ? (
            <div className="bg-dark-800 border border-dark-700 rounded-lg p-8 text-center">
              <p className="text-dark-400">Select a team to view details</p>
            </div>
          ) : teamDetail ? (
            <div className="space-y-6">
              <div className="bg-dark-800 border border-dark-700 rounded-lg p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-white">{teamDetail.name}</h3>
                    {teamDetail.description && (
                      <p className="text-dark-400 mt-1">{teamDetail.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => deleteMutation.mutate(teamDetail.id)}
                    className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded text-sm transition-colors"
                  >
                    Delete Team
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-dark-700">
                  <div>
                    <div className="text-sm text-dark-400">Members</div>
                    <div className="text-2xl font-bold text-white">{teamDetail.members.length}</div>
                  </div>
                  <div>
                    <div className="text-sm text-dark-400">Services</div>
                    <div className="text-2xl font-bold text-white">{teamDetail.services.length}</div>
                  </div>
                </div>
              </div>

              <div className="bg-dark-800 border border-dark-700 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-white">Members</h4>
                  <button
                    onClick={() => setShowAddMemberModal(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-accent-primary hover:bg-accent-primary/80 text-white rounded text-sm transition-colors"
                  >
                    <UserPlus className="h-4 w-4" />
                    Add Member
                  </button>
                </div>

                {teamDetail.members.length === 0 ? (
                  <p className="text-dark-400 text-sm">No members yet</p>
                ) : (
                  <div className="space-y-2">
                    {teamDetail.members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 bg-dark-700 border border-dark-600 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-white">{member.user.name}</div>
                          <div className="text-sm text-dark-400">{member.user.email}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={member.role}
                            onChange={(e) =>
                              updateRoleMutation.mutate({
                                teamId: teamDetail.id,
                                userId: member.userId,
                                role: e.target.value,
                              })
                            }
                            className="px-3 py-1.5 bg-dark-600 border border-dark-500 rounded text-white text-sm focus:outline-none focus:border-accent-primary"
                          >
                            <option value="team_admin">Team Admin</option>
                            <option value="member">Member</option>
                            <option value="observer">Observer</option>
                          </select>
                          {getRoleIcon(member.role)}
                          <button
                            onClick={() =>
                              removeMemberMutation.mutate({
                                teamId: teamDetail.id,
                                userId: member.userId,
                              })
                            }
                            className="p-1.5 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {teamDetail.services.length > 0 && (
                <div className="bg-dark-800 border border-dark-700 rounded-lg p-6">
                  <h4 className="text-lg font-semibold text-white mb-4">Services</h4>
                  <div className="space-y-2">
                    {teamDetail.services.map((service) => (
                      <div
                        key={service.id}
                        className="p-3 bg-dark-700 border border-dark-600 rounded-lg"
                      >
                        <div className="font-medium text-white">{service.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-dark-800 border border-dark-700 rounded-lg p-8">
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-dark-700 rounded w-1/3"></div>
                <div className="h-4 bg-dark-700 rounded w-2/3"></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-800 border border-dark-700 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Create Team</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-dark-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-400 mb-2">
                  Team Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={createFormData.name}
                  onChange={(e) =>
                    setCreateFormData({
                      ...createFormData,
                      name: e.target.value,
                      slug: e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-+|-+$/g, ''),
                    })
                  }
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:outline-none focus:border-accent-primary"
                  placeholder="Engineering Team"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-400 mb-2">Description</label>
                <textarea
                  value={createFormData.description}
                  onChange={(e) =>
                    setCreateFormData({ ...createFormData, description: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:outline-none focus:border-accent-primary"
                  placeholder="Describe this team..."
                  rows={3}
                />
              </div>
              <div className="flex items-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 px-4 py-2 bg-accent-primary hover:bg-accent-primary/80 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddMemberModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-800 border border-dark-700 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Add Member</h3>
              <button
                onClick={() => setShowAddMemberModal(false)}
                className="text-dark-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-400 mb-2">
                  User <span className="text-red-400">*</span>
                </label>
                <select
                  value={addMemberFormData.userId}
                  onChange={(e) =>
                    setAddMemberFormData({ ...addMemberFormData, userId: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-accent-primary"
                  required
                >
                  <option value="">Select a user</option>
                  {availableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-400 mb-2">Role</label>
                <select
                  value={addMemberFormData.role}
                  onChange={(e) =>
                    setAddMemberFormData({ ...addMemberFormData, role: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-accent-primary"
                >
                  <option value="member">Member</option>
                  <option value="team_admin">Team Admin</option>
                  <option value="observer">Observer</option>
                </select>
              </div>
              <div className="flex items-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="flex-1 px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addMemberMutation.isPending}
                  className="flex-1 px-4 py-2 bg-accent-primary hover:bg-accent-primary/80 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {addMemberMutation.isPending ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
