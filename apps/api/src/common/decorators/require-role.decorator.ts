import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY, UserRole } from '../guards/roles.guard';

/**
 * Decorator to require specific global roles for an endpoint
 * Used with RolesGuard
 *
 * @example
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @RequireRole('admin', 'superadmin')
 * async createUser() { ... }
 */
export const RequireRole = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
