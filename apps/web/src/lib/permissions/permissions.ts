import { UserRole } from '@/types/api'

/**
 * Permission definitions for RBAC (must match backend)
 */
export const PERMISSIONS = {
  // System Settings
  'settings.view': ['superadmin', 'admin'],
  'settings.edit': ['superadmin'],
  'settings.sso': ['superadmin'],

  // Users
  'users.view': ['superadmin', 'admin'],
  'users.create': ['superadmin', 'admin'],
  'users.edit': ['superadmin', 'admin'],
  'users.delete': ['superadmin'],
  'users.change_role': ['superadmin'],
  'users.deactivate': ['superadmin', 'admin'],

  // Teams
  'teams.view': ['superadmin', 'admin', 'responder', 'observer'],
  'teams.create': ['superadmin', 'admin'],
  'teams.edit': ['superadmin', 'admin'],
  'teams.delete': ['superadmin'],
  'teams.manage_members': ['superadmin', 'admin'],

  // Services
  'services.view': ['superadmin', 'admin', 'responder', 'observer'],
  'services.create': ['superadmin', 'admin'],
  'services.edit': ['superadmin', 'admin'],
  'services.delete': ['superadmin', 'admin'],

  // Incidents
  'incidents.view': ['superadmin', 'admin', 'responder', 'observer'],
  'incidents.acknowledge': ['superadmin', 'admin', 'responder'],
  'incidents.resolve': ['superadmin', 'admin', 'responder'],
  'incidents.reassign': ['superadmin', 'admin', 'responder'],
  'incidents.add_note': ['superadmin', 'admin', 'responder'],

  // Alerts
  'alerts.view': ['superadmin', 'admin', 'responder', 'observer'],
  'alerts.acknowledge': ['superadmin', 'admin', 'responder'],
  'alerts.resolve': ['superadmin', 'admin', 'responder'],

  // Schedules
  'schedules.view': ['superadmin', 'admin', 'responder', 'observer'],
  'schedules.create': ['superadmin', 'admin'],
  'schedules.edit': ['superadmin', 'admin', 'responder'],
  'schedules.delete': ['superadmin', 'admin'],

  // Escalation Policies
  'escalation.view': ['superadmin', 'admin', 'responder', 'observer'],
  'escalation.create': ['superadmin', 'admin'],
  'escalation.edit': ['superadmin', 'admin'],
  'escalation.delete': ['superadmin', 'admin'],

  // Integrations
  'integrations.view': ['superadmin', 'admin', 'responder', 'observer'],
  'integrations.create': ['superadmin', 'admin'],
  'integrations.edit': ['superadmin', 'admin'],
  'integrations.delete': ['superadmin', 'admin'],
  'integrations.regenerate_key': ['superadmin', 'admin'],

  // Status Pages
  'status_pages.view': ['superadmin', 'admin', 'responder', 'observer'],
  'status_pages.create': ['superadmin', 'admin'],
  'status_pages.edit': ['superadmin', 'admin'],
  'status_pages.delete': ['superadmin', 'admin'],

  // Notification Settings
  'notifications.view_own': ['superadmin', 'admin', 'responder', 'observer'],
  'notifications.edit_own': ['superadmin', 'admin', 'responder', 'observer'],

  // Audit Logs
  'audit_logs.view': ['superadmin', 'admin'],
} as const

export type Permission = keyof typeof PERMISSIONS

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole | undefined, permission: Permission): boolean {
  if (!role) return false
  const allowedRoles = PERMISSIONS[permission]
  return allowedRoles ? allowedRoles.includes(role) : false
}

/**
 * Check if a role can perform an action on a resource
 */
export function canPerformAction(
  role: UserRole | undefined,
  action: 'view' | 'create' | 'edit' | 'delete',
  resource: string
): boolean {
  const permission = `${resource}.${action}` as Permission
  return hasPermission(role, permission)
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: UserRole): Permission[] {
  const permissions: Permission[] = []
  for (const [permission, roles] of Object.entries(PERMISSIONS)) {
    if (roles.includes(role)) {
      permissions.push(permission as Permission)
    }
  }
  return permissions
}

/**
 * Role hierarchy levels (higher number = more permissions)
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  observer: 1,
  responder: 2,
  admin: 3,
  superadmin: 4,
}

/**
 * Check if one role is higher in hierarchy than another
 */
export function isRoleHigherOrEqual(role: UserRole, compareRole: UserRole): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[compareRole]
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: UserRole): string {
  const roleNames: Record<UserRole, string> = {
    superadmin: 'Super Admin',
    admin: 'Admin',
    responder: 'Responder',
    observer: 'Observer',
  }
  return roleNames[role] || role
}

/**
 * Get role description
 */
export function getRoleDescription(role: UserRole): string {
  const descriptions: Record<UserRole, string> = {
    superadmin: 'Full system access, manage all teams/users/settings',
    admin: 'Manage their teams, users in teams, configure settings',
    responder: 'Acknowledge/resolve incidents, view schedules',
    observer: 'Read-only access, view incidents/alerts',
  }
  return descriptions[role] || ''
}

/**
 * Get role color variant for badges
 */
export function getRoleColor(
  role: UserRole
): 'purple' | 'blue' | 'green' | 'gray' {
  const colors: Record<UserRole, 'purple' | 'blue' | 'green' | 'gray'> = {
    superadmin: 'purple',
    admin: 'blue',
    responder: 'green',
    observer: 'gray',
  }
  return colors[role] || 'gray'
}
