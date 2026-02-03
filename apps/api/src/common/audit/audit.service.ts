import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { auditLogs } from '../../database/schema';

export interface AuditLogData {
  userId?: number;
  teamId?: number;
  action: string;
  resourceType: string;
  resourceId?: number;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly db: DatabaseService) {}

  async log(data: AuditLogData): Promise<void> {
    try {
      await this.db.db.insert(auditLogs).values({
        userId: data.userId,
        teamId: data.teamId,
        action: data.action,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        oldValues: data.oldValues,
        newValues: data.newValues,
        metadata: data.metadata,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      });

      this.logger.log(
        `Audit log created: ${data.action} on ${data.resourceType}${data.resourceId ? `#${data.resourceId}` : ''} by user ${data.userId || 'system'}`
      );
    } catch (error) {
      this.logger.error(`Failed to create audit log: ${error.message}`, error.stack);
    }
  }

  async logIncidentAction(
    action: 'created' | 'acknowledged' | 'resolved',
    incidentId: number,
    userId: number,
    teamId: number,
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>
  ): Promise<void> {
    await this.log({
      userId,
      teamId,
      action: `incident.${action}`,
      resourceType: 'incident',
      resourceId: incidentId,
      oldValues,
      newValues,
    });
  }

  async logAlertAction(
    action: 'created' | 'acknowledged' | 'resolved',
    alertId: number,
    userId?: number,
    teamId?: number
  ): Promise<void> {
    await this.log({
      userId,
      teamId,
      action: `alert.${action}`,
      resourceType: 'alert',
      resourceId: alertId,
    });
  }

  async logTeamAction(
    action: 'member.added' | 'member.removed' | 'member.role_changed',
    teamId: number,
    userId: number,
    targetUserId: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      userId,
      teamId,
      action: `team.${action}`,
      resourceType: 'team',
      resourceId: teamId,
      metadata: {
        ...metadata,
        targetUserId,
      },
    });
  }
}
