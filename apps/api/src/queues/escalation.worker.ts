import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { DatabaseService } from '../database/database.service';
import {
  NotificationQueueService,
  NotificationPriority,
  NotificationJobData,
} from './notification.queue';
import { EscalationJobData } from './escalation.queue';
import { eq, and } from 'drizzle-orm';
import {
  incidents,
  escalationPolicies,
  escalationLevels,
  escalationTargets,
  users,
  teamMembers,
} from '../database/schema';

@Injectable()
export class EscalationWorkerService implements OnModuleInit {
  private readonly logger = new Logger(EscalationWorkerService.name);
  private worker: Worker<EscalationJobData>;
  private connection: IORedis;

  constructor(
    private readonly config: ConfigService,
    private readonly db: DatabaseService,
    private readonly notificationQueue: NotificationQueueService,
  ) {
    this.connection = new IORedis({
      host: config.get('REDIS_HOST', 'localhost'),
      port: config.get('REDIS_PORT', 6379),
      maxRetriesPerRequest: null,
    });
  }

  async onModuleInit() {
    this.worker = new Worker<EscalationJobData>(
      'escalations',
      async (job: Job<EscalationJobData>) => {
        return this.processEscalation(job);
      },
      {
        connection: this.connection,
        concurrency: 5,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Escalation job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Escalation job ${job?.id} failed: ${err.message}`);
    });

    this.logger.log('Escalation worker started');
  }

  private async processEscalation(job: Job<EscalationJobData>): Promise<void> {
    const { incidentId, escalationPolicyId, currentLevel } = job.data;

    this.logger.log(
      `Processing escalation for incident ${incidentId}, level ${currentLevel}`,
    );

    // 1. Check if incident is still active
    const incident = await this.db.query.incidents.findFirst({
      where: eq(incidents.id, incidentId),
    });

    if (!incident) {
      this.logger.warn(`Incident ${incidentId} not found, skipping escalation`);
      return;
    }

    if (incident.status !== 'triggered') {
      this.logger.log(
        `Incident ${incidentId} is ${incident.status}, skipping escalation`,
      );
      return;
    }

    // 2. Load escalation policy and level
    const policy = await this.db.query.escalationPolicies.findFirst({
      where: eq(escalationPolicies.id, escalationPolicyId),
    });

    if (!policy) {
      this.logger.error(`Escalation policy ${escalationPolicyId} not found`);
      return;
    }

    const level = await this.db.query.escalationLevels.findFirst({
      where: and(
        eq(escalationLevels.policyId, escalationPolicyId),
        eq(escalationLevels.level, currentLevel),
      ),
    });

    if (!level) {
      this.logger.warn(`Level ${currentLevel} not found in policy ${escalationPolicyId}`);
      return;
    }

    // 3. Load targets for this level
    const targets = await this.db.db
      .select()
      .from(escalationTargets)
      .where(eq(escalationTargets.levelId, level.id));

    if (targets.length === 0) {
      this.logger.warn(`No targets found for level ${currentLevel}`);
      return;
    }

    // 4. Resolve targets and queue notifications
    for (const target of targets) {
      if (target.targetType === 'user') {
        await this.notifyUser(incidentId, target.targetId, incident.severity);
      } else if (target.targetType === 'team') {
        await this.notifyTeam(incidentId, target.targetId, incident.severity);
      } else if (target.targetType === 'schedule') {
        await this.notifySchedule(incidentId, target.targetId, incident.severity);
      }
    }

    // 5. Schedule next level if exists
    const nextLevel = await this.db.query.escalationLevels.findFirst({
      where: and(
        eq(escalationLevels.policyId, escalationPolicyId),
        eq(escalationLevels.level, currentLevel + 1),
      ),
    });

    if (nextLevel) {
      const { EscalationQueueService } = await import('./escalation.queue');
      const escalationQueue = new EscalationQueueService(this.config);
      await escalationQueue.scheduleEscalation(
        incidentId,
        escalationPolicyId,
        currentLevel + 1,
        nextLevel.delayMinutes,
      );
    }
  }

  private async notifyUser(
    incidentId: number,
    userId: number,
    severity: string,
  ): Promise<void> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user || !user.isActive) {
      this.logger.warn(`User ${userId} not found or inactive`);
      return;
    }

    const incident = await this.db.query.incidents.findFirst({
      where: eq(incidents.id, incidentId),
      with: { service: true },
    });

    if (!incident) return;

    const priority: NotificationPriority =
      severity === 'critical' || severity === 'high' ? 'critical' : 'high';

    // Queue notifications via multiple channels based on severity
    const notifications: NotificationJobData[] = [
      {
        incidentId,
        userId,
        channel: 'email',
        priority,
        payload: {
          subject: `[${severity.toUpperCase()}] Incident #${incident.incidentNumber}: ${incident.title}`,
          message: `You have been notified about incident #${incident.incidentNumber}.\n\nService: ${incident.service?.name}\nSeverity: ${severity}\nTitle: ${incident.title}`,
          email: user.email,
          incidentUrl: `${this.config.get('APP_URL', 'http://localhost:3000')}/incidents/${incidentId}`,
        },
      },
    ];

    // Add SMS for critical incidents if phone number is available
    if (severity === 'critical' && user.phoneNumber) {
      notifications.push({
        incidentId,
        userId,
        channel: 'sms',
        priority,
        payload: {
          message: `CRITICAL: Incident #${incident.incidentNumber} - ${incident.title}`,
          phoneNumber: user.phoneNumber,
        },
      });
    }

    await this.notificationQueue.queueBulkNotifications(notifications);
  }

  private async notifyTeam(
    incidentId: number,
    teamId: number,
    severity: string,
  ): Promise<void> {
    // Get all active team members
    const members = await this.db.db
      .select({ userId: teamMembers.userId })
      .from(teamMembers)
      .innerJoin(users, eq(teamMembers.userId, users.id))
      .where(and(eq(teamMembers.teamId, teamId), eq(users.isActive, true)));

    for (const member of members) {
      await this.notifyUser(incidentId, member.userId, severity);
    }
  }

  private async notifySchedule(
    incidentId: number,
    scheduleId: number,
    severity: string,
  ): Promise<void> {
    // TODO: Implement on-call schedule resolution
    // For now, this is a stub that will be implemented in Week 5-6
    this.logger.log(`Schedule notification not yet implemented for schedule ${scheduleId}`);
  }

  async close(): Promise<void> {
    await this.worker.close();
    this.logger.log('Escalation worker closed');
  }
}
