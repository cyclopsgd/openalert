import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Users, Filter, RefreshCw, AlertCircle, Shield } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { RoleBadge } from '@/components/ui/RoleBadge'
import { apiClient } from '@/lib/api/client'
import { format } from 'date-fns'
import type { User as UserType, UserRole } from '@/types/api'
import { usePermissions } from '@/hooks/usePermissions'
import { getRoleDescription } from '@/lib/permissions/permissions'
import { useAuthStore } from '@/stores/authStore'

interface User extends UserType {}

export function UserManagement() {
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuthStore()
  const { isSuperadmin } = usePermissions()
  const [authProviderFilter, setAuthProviderFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [isChangingRole, setIsChangingRole] = useState(false)
  const [newRole, setNewRole] = useState<UserRole | ''>('')

  const { data: users, isLoading, error } = useQuery({
    queryKey: ['users', authProviderFilter, statusFilter, roleFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (authProviderFilter !== 'all') params.append('authProvider', authProviderFilter)
      if (statusFilter === 'active') params.append('isActive', 'true')
      if (statusFilter === 'inactive') params.append('isActive', 'false')
      if (roleFilter !== 'all') params.append('role', roleFilter)

      const response = await apiClient.get<User[]>(`/users?${params.toString()}`)
      return response.data
    },
  })

  const activateMutation = useMutation({
    mutationFn: async (userId: number) => {
      await apiClient.patch(`/users/${userId}/activate`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: async (userId: number) => {
      await apiClient.patch(`/users/${userId}/deactivate`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiClient.post(`/users/${userId}/reset-password`)
      return response.data
    },
  })

  const changeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: UserRole }) => {
      const response = await apiClient.patch(`/users/${userId}/role`, { role })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setIsChangingRole(false)
      setNewRole('')
    },
  })

  const handleToggleStatus = async (user: User) => {
    if (user.isActive) {
      await deactivateMutation.mutateAsync(user.id)
    } else {
      await activateMutation.mutateAsync(user.id)
    }
  }

  const handleResetPassword = async (user: User) => {
    if (confirm(`Send password reset email to ${user.email}?`)) {
      await resetPasswordMutation.mutateAsync(user.id)
      alert('Password reset email sent (placeholder)')
    }
  }

  const handleChangeRole = async (user: User) => {
    if (!newRole) return

    if (confirm(`Change ${user.name}'s role to ${newRole}?`)) {
      await changeRoleMutation.mutateAsync({ userId: user.id, role: newRole })
    }
  }

  const hasActiveFilters = authProviderFilter !== 'all' || statusFilter !== 'all' || roleFilter !== 'all'

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-heading font-bold text-dark-50 mb-2 flex items-center gap-3">
          <Users className="h-8 w-8" />
          User Management
        </h1>
        <p className="text-dark-400">
          Manage user accounts, permissions, and authentication settings
        </p>
      </motion.div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-dark-400" />
          <span className="text-sm text-dark-400">Filters:</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-dark-500">Auth Provider:</span>
          <div className="flex gap-1">
            {['all', 'local', 'azure_ad'].map((provider) => (
              <Button
                key={provider}
                variant={authProviderFilter === provider ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setAuthProviderFilter(provider)}
              >
                {provider === 'all' ? 'All' : provider === 'local' ? 'Local' : 'SSO'}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-dark-500">Status:</span>
          <div className="flex gap-1">
            {['all', 'active', 'inactive'].map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(status)}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-dark-500">Role:</span>
          <div className="flex gap-1">
            {['all', 'superadmin', 'admin', 'responder', 'observer'].map((role) => (
              <Button
                key={role}
                variant={roleFilter === role ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setRoleFilter(role)}
              >
                {role === 'all' ? 'All' : role.charAt(0).toUpperCase() + role.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setAuthProviderFilter('all')
              setStatusFilter('all')
              setRoleFilter('all')
            }}
          >
            Clear Filters
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['users'] })}
          className="ml-auto"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-accent-primary border-t-transparent rounded-full" />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-status-critical mx-auto mb-4" />
          <p className="text-status-critical mb-4">Failed to load users</p>
          <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['users'] })}>
            Retry
          </Button>
        </div>
      ) : users && users.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>
              Users ({users.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-dark-700">
                  <tr className="text-left text-xs text-dark-400">
                    <th className="p-4 font-medium">Name</th>
                    <th className="p-4 font-medium">Email</th>
                    <th className="p-4 font-medium">Role</th>
                    <th className="p-4 font-medium">Auth Provider</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium">Last Login</th>
                    <th className="p-4 font-medium">Created</th>
                    <th className="p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700">
                  {users.map((user) => (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-dark-750 cursor-pointer transition-colors"
                      onClick={() => setSelectedUser(user)}
                    >
                      <td className="p-4">
                        <p className="font-medium text-dark-100">{user.name}</p>
                      </td>
                      <td className="p-4">
                        <p className="text-sm text-dark-300">{user.email}</p>
                      </td>
                      <td className="p-4">
                        <RoleBadge role={user.role} />
                      </td>
                      <td className="p-4">
                        <Badge variant={user.authProvider === 'local' ? 'default' : 'info'}>
                          {user.authProvider === 'local' ? 'Local' : 'SSO'}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <Badge variant={user.isActive ? 'success' : 'default'}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <p className="text-sm text-dark-400">
                          {user.lastLoginAt
                            ? format(new Date(user.lastLoginAt), 'MMM d, yyyy HH:mm')
                            : 'Never'}
                        </p>
                      </td>
                      <td className="p-4">
                        <p className="text-sm text-dark-400">
                          {user.createdAt ? format(new Date(user.createdAt), 'MMM d, yyyy') : 'N/A'}
                        </p>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant={user.isActive ? 'outline' : 'success'}
                            size="sm"
                            onClick={() => handleToggleStatus(user)}
                            disabled={
                              activateMutation.isPending || deactivateMutation.isPending
                            }
                          >
                            {user.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                          {user.authProvider === 'local' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResetPassword(user)}
                              disabled={resetPasswordMutation.isPending}
                            >
                              Reset Password
                            </Button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-dark-500 mx-auto mb-4" />
          <p className="text-dark-400 mb-2">No users found</p>
          {hasActiveFilters && (
            <p className="text-sm text-dark-500">
              Try clearing your filters to see more results
            </p>
          )}
        </div>
      )}

      {selectedUser && (
        <Card>
          <CardHeader>
            <CardTitle>User Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-dark-500 mb-1">ID</p>
                <p className="text-sm text-dark-200">{selectedUser.id}</p>
              </div>
              <div>
                <p className="text-xs text-dark-500 mb-1">Name</p>
                <p className="text-sm text-dark-200">{selectedUser.name}</p>
              </div>
              <div>
                <p className="text-xs text-dark-500 mb-1">Email</p>
                <p className="text-sm text-dark-200">{selectedUser.email}</p>
              </div>
              <div>
                <p className="text-xs text-dark-500 mb-1">Auth Provider</p>
                <Badge variant={selectedUser.authProvider === 'local' ? 'default' : 'info'}>
                  {selectedUser.authProvider === 'local' ? 'Local' : 'SSO'}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-dark-500 mb-1">Status</p>
                <Badge variant={selectedUser.isActive ? 'success' : 'default'}>
                  {selectedUser.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-dark-500 mb-1">Last Login</p>
                <p className="text-sm text-dark-200">
                  {selectedUser.lastLoginAt
                    ? format(new Date(selectedUser.lastLoginAt), 'MMM d, yyyy HH:mm')
                    : 'Never'}
                </p>
              </div>
              <div>
                <p className="text-xs text-dark-500 mb-1">Created At</p>
                <p className="text-sm text-dark-200">
                  {selectedUser.createdAt ? format(new Date(selectedUser.createdAt), 'MMM d, yyyy HH:mm') : 'N/A'}
                </p>
              </div>
            </div>

            {isSuperadmin() && selectedUser.id !== currentUser?.id && (
              <div className="pt-4 border-t border-dark-700 space-y-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-accent-primary" />
                  <h3 className="text-sm font-medium text-dark-200">Role Management</h3>
                </div>

                <div>
                  <p className="text-xs text-dark-500 mb-2">Current Role</p>
                  <div className="flex items-center gap-3 mb-3">
                    <RoleBadge role={selectedUser.role} />
                    <p className="text-xs text-dark-400">{getRoleDescription(selectedUser.role)}</p>
                  </div>
                </div>

                {!isChangingRole ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsChangingRole(true)
                      setNewRole(selectedUser.role)
                    }}
                  >
                    Change Role
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-dark-500">Select New Role</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(['superadmin', 'admin', 'responder', 'observer'] as UserRole[]).map((role) => (
                        <button
                          key={role}
                          onClick={() => setNewRole(role)}
                          className={`p-3 rounded-lg border text-left transition-colors ${
                            newRole === role
                              ? 'border-accent-primary bg-accent-primary/10'
                              : 'border-dark-700 hover:border-dark-600'
                          }`}
                        >
                          <RoleBadge role={role} className="mb-1" />
                          <p className="text-xs text-dark-400 mt-1">{getRoleDescription(role)}</p>
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleChangeRole(selectedUser)}
                        disabled={!newRole || newRole === selectedUser.role || changeRoleMutation.isPending}
                      >
                        Save
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsChangingRole(false)
                          setNewRole('')
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="pt-4 border-t border-dark-700">
              <Button variant="outline" onClick={() => {
                setSelectedUser(null)
                setIsChangingRole(false)
                setNewRole('')
              }}>
                Close
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {resetPasswordMutation.isSuccess && (
        <div className="p-4 bg-status-success/10 border border-status-success/30 rounded-lg">
          <p className="text-status-success text-sm">
            {resetPasswordMutation.data?.message}
          </p>
        </div>
      )}
    </div>
  )
}
