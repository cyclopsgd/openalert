import { SetMetadata } from '@nestjs/common';
import { TEAM_ROLES_KEY, TeamRole } from '../guards/team-member.guard';

/**
 * Decorator to require specific team roles for an endpoint
 * Used with TeamMemberGuard
 *
 * @example
 * @UseGuards(JwtAuthGuard, TeamMemberGuard)
 * @TeamResource('service')
 * @RequireTeamRoles(['admin', 'owner'])
 * async deleteService(@Param('id') id: string) { ... }
 */
export const RequireTeamRoles = (roles: TeamRole[]) =>
  SetMetadata(TEAM_ROLES_KEY, roles);
