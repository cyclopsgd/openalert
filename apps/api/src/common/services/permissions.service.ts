import { Injectable, ForbiddenException } from '@nestjs/common';
import { UserRole } from '../guards/roles.guard';
import { TeamRole } from '../guards/team-member.guard';
import {
  Permission,
  hasPermission as checkPermission,
  canPerformAction as checkAction,
  getRolePermissions,
  isRoleHigherOrEqual,
} from '../constants/permissions';

/**
 * Service for centralized permission checking logic
 */
@Injectable()
export class PermissionsService {
  /**
   * Check if a user has a specific permission
   */
  hasPermission(role: UserRole, permission: Permission): boolean {
    return checkPermission(role, permission);
  }

  /**
   * Check if a user can perform an action on a resource
   */
  canPerformAction(
    role: UserRole,
    action: 'view' | 'create' | 'edit' | 'delete',
    resource: string,
  ): boolean {
    return checkAction(role, action, resource);
  }

  /**
   * Get all permissions for a role
   */
  getRolePermissions(role: UserRole): Permission[] {
    return getRolePermissions(role);
  }

  /**
   * Check if user role is sufficient
   */
  isRoleHigherOrEqual(role: UserRole, compareRole: UserRole): boolean {
    return isRoleHigherOrEqual(role, compareRole);
  }

  /**
   * Ensure user has required permission or throw exception
   */
  requirePermission(role: UserRole, permission: Permission): void {
    if (!this.hasPermission(role, permission)) {
      throw new ForbiddenException(`You do not have permission: ${permission}`);
    }
  }

  /**
   * Check if user has team-level permission
   */
  hasTeamPermission(
    teamRole: TeamRole,
    action: 'view' | 'edit' | 'manage_members',
  ): boolean {
    switch (action) {
      case 'view':
        // All team members can view
        return ['team_admin', 'member', 'observer'].includes(teamRole);
      case 'edit':
        // Only team admins can edit
        return teamRole === 'team_admin';
      case 'manage_members':
        // Only team admins can manage members
        return teamRole === 'team_admin';
      default:
        return false;
    }
  }

  /**
   * Check if user can modify another user
   * Rules:
   * - Superadmin can modify anyone except themselves (for safety)
   * - Admin can modify responders and observers
   * - No one can modify users with higher or equal role
   */
  canModifyUser(actorRole: UserRole, targetRole: UserRole): boolean {
    const roleHierarchy: Record<UserRole, number> = {
      observer: 1,
      responder: 2,
      admin: 3,
      superadmin: 4,
    };

    // Actor must have higher role than target
    return roleHierarchy[actorRole] > roleHierarchy[targetRole];
  }

  /**
   * Check if user can change role
   */
  canChangeRole(actorRole: UserRole, currentRole: UserRole, newRole: UserRole): boolean {
    // Only superadmin can change roles
    if (actorRole !== 'superadmin') {
      return false;
    }

    // Can't change superadmin to something else (must be done carefully)
    if (currentRole === 'superadmin') {
      return false;
    }

    return true;
  }
}
