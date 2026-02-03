import { SetMetadata } from '@nestjs/common';
import { TEAM_RESOURCE_KEY, TeamResource } from '../guards/team-member.guard';

/**
 * Decorator to specify the type of resource being accessed
 * Used with TeamMemberGuard to verify team membership
 *
 * @example
 * @UseGuards(JwtAuthGuard, TeamMemberGuard)
 * @TeamResource('incident')
 * async getIncident(@Param('id') id: string) { ... }
 */
export const TeamResourceDecorator = (resourceType: TeamResource) =>
  SetMetadata(TEAM_RESOURCE_KEY, resourceType);
