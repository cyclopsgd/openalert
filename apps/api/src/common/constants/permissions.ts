import { UserRole } from '../guards/roles.guard';

/**
 * Permission definitions for RBAC
 * Maps permissions to roles that have access
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
  'teams.edit': ['superadmin', 'admin'], // or team_admin for own team
  'teams.delete': ['superadmin'],
  'teams.manage_members': ['superadmin', 'admin'], // or team_admin for own team

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
} as const;

export type Permission = keyof typeof PERMISSIONS;

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const allowedRoles = PERMISSIONS[permission] as readonly string[];
  return allowedRoles ? (allowedRoles as readonly string[]).includes(role) : false;
}

/**
 * Check if a role can perform an action on a resource
 */
export function canPerformAction(
  role: UserRole,
  action: 'view' | 'create' | 'edit' | 'delete',
  resource: string,
): boolean {
  const permission = `${resource}.${action}` as Permission;
  return hasPermission(role, permission);
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: UserRole): Permission[] {
  const permissions: Permission[] = [];
  for (const [permission, roles] of Object.entries(PERMISSIONS)) {
    if ((roles as readonly string[]).includes(role)) {
      permissions.push(permission as Permission);
    }
  }
  return permissions;
}

/**
 * Role hierarchy levels (higher number = more permissions)
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  observer: 1,
  responder: 2,
  admin: 3,
  superadmin: 4,
};

/**
 * Check if one role is higher in hierarchy than another
 */
export function isRoleHigherOrEqual(role: UserRole, compareRole: UserRole): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[compareRole];
}
