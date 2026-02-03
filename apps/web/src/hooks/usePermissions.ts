import { useAuthStore } from '@/stores/authStore'
import {
  hasPermission as checkPermission,
  canPerformAction as checkAction,
  Permission,
  getRolePermissions,
  isRoleHigherOrEqual,
} from '@/lib/permissions/permissions'
import { UserRole } from '@/types/api'

/**
 * Hook for checking user permissions in components
 */
export function usePermissions() {
  const { user } = useAuthStore()

  /**
   * Check if current user has a specific permission
   */
  const hasPermission = (permission: Permission): boolean => {
    return checkPermission(user?.role, permission)
  }

  /**
   * Check if current user can perform an action on a resource
   */
  const canPerformAction = (
    action: 'view' | 'create' | 'edit' | 'delete',
    resource: string
  ): boolean => {
    return checkAction(user?.role, action, resource)
  }

  /**
   * Get all permissions for current user's role
   */
  const getPermissions = (): Permission[] => {
    if (!user?.role) return []
    return getRolePermissions(user.role)
  }

  /**
   * Check if current user role is higher or equal to another role
   */
  const isRoleHigherOrEqualTo = (compareRole: UserRole): boolean => {
    if (!user?.role) return false
    return isRoleHigherOrEqual(user.role, compareRole)
  }

  /**
   * Check if current user is superadmin
   */
  const isSuperadmin = (): boolean => {
    return user?.role === 'superadmin'
  }

  /**
   * Check if current user is admin or higher
   */
  const isAdmin = (): boolean => {
    return user?.role === 'admin' || user?.role === 'superadmin'
  }

  /**
   * Check if current user is responder or higher
   */
  const isResponder = (): boolean => {
    return (
      user?.role === 'responder' ||
      user?.role === 'admin' ||
      user?.role === 'superadmin'
    )
  }

  /**
   * Check if current user is observer (read-only)
   */
  const isObserver = (): boolean => {
    return user?.role === 'observer'
  }

  return {
    hasPermission,
    canPerformAction,
    getPermissions,
    isRoleHigherOrEqualTo,
    isSuperadmin,
    isAdmin,
    isResponder,
    isObserver,
    userRole: user?.role,
  }
}
