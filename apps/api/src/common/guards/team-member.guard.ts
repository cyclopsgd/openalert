import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DatabaseService } from '../../database/database.service';
import { eq, and } from 'drizzle-orm';
import {
  teamMembers,
  services,
  incidents,
  schedules,
  escalationPolicies,
  statusPages,
} from '../../database/schema';

export const TEAM_ROLES_KEY = 'teamRoles';
export const TEAM_RESOURCE_KEY = 'teamResource';

export type TeamRole = 'team_admin' | 'member' | 'observer';
export type TeamResource =
  | 'service'
  | 'incident'
  | 'schedule'
  | 'escalation-policy'
  | 'status-page'
  | 'team';

/**
 * Guard to verify user is a member of the team that owns the requested resource
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, TeamMemberGuard)
 * @TeamResource('incident')
 * @RequireTeamRoles(['admin', 'owner']) // Optional - defaults to any team member
 * async method(@Param('id') id: string) { ... }
 */
@Injectable()
export class TeamMemberGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private db: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.get<TeamRole[]>(TEAM_ROLES_KEY, context.getHandler());
    const resourceType = this.reflector.get<TeamResource>(TEAM_RESOURCE_KEY, context.getHandler());

    // If no resource type specified, allow access (not a team-protected endpoint)
    if (!resourceType) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Extract resource ID from route params
    const resourceId = Number(
      request.params.id || request.params.teamId || request.params.serviceId,
    );

    if (!resourceId || isNaN(resourceId)) {
      throw new ForbiddenException('Resource ID not found in request');
    }

    // Get team ID for the resource
    const teamId = await this.getTeamIdForResource(resourceType, resourceId);

    if (!teamId) {
      throw new NotFoundException(`Resource not found`);
    }

    // Check if user is a member of the team
    const membership = await this.db.query.teamMembers.findFirst({
      where: and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, user.id)),
    });

    if (!membership) {
      throw new ForbiddenException('You do not have access to this resource');
    }

    // Check role requirements if specified
    if (requiredRoles && requiredRoles.length > 0) {
      if (!requiredRoles.includes(membership.teamRole as TeamRole)) {
        throw new ForbiddenException(
          `This action requires one of the following roles: ${requiredRoles.join(', ')}`,
        );
      }
    }

    // Attach team context to request for use in controllers
    request.teamId = teamId;
    request.userRole = membership.teamRole;

    return true;
  }

  /**
   * Get the team ID that owns a given resource
   */
  private async getTeamIdForResource(
    resourceType: TeamResource,
    resourceId: number,
  ): Promise<number | null> {
    switch (resourceType) {
      case 'team':
        // Direct team access
        return resourceId;

      case 'service':
        const service = await this.db.query.services.findFirst({
          where: eq(services.id, resourceId),
        });
        return service?.teamId || null;

      case 'incident':
        // Incident -> Service -> Team
        const incident = await this.db.query.incidents.findFirst({
          where: eq(incidents.id, resourceId),
          with: {
            service: true,
          },
        });
        return incident?.service?.teamId || null;

      case 'schedule':
        const schedule = await this.db.query.schedules.findFirst({
          where: eq(schedules.id, resourceId),
        });
        return schedule?.teamId || null;

      case 'escalation-policy':
        const policy = await this.db.query.escalationPolicies.findFirst({
          where: eq(escalationPolicies.id, resourceId),
        });
        return policy?.teamId || null;

      case 'status-page':
        const statusPage = await this.db.query.statusPages.findFirst({
          where: eq(statusPages.id, resourceId),
        });
        return statusPage?.teamId || null;

      default:
        return null;
    }
  }
}
