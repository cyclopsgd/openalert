import { Injectable, Logger, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq, and, sql } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import {
  incidents,
  alerts,
  incidentTimeline,
  Incident,
  services,
  escalationLevels,
} from '../../database/schema';
import { EscalationQueueService } from '../../queues/escalation.queue';
import { CacheService, CACHE_PREFIX, CACHE_TTL } from '../cache/cache.service';

interface CreateIncidentParams {
  serviceId: number;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
}

@Injectable()
export class IncidentsService {
  private readonly logger = new Logger(IncidentsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(forwardRef(() => EscalationQueueService))
    private readonly escalationQueue: EscalationQueueService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Find existing triggered incident or create a new one
   */
  async findOrCreateForAlert(params: CreateIncidentParams): Promise<Incident> {
    // Check for existing triggered incident for this service
    const existingIncident = await this.db.query.incidents.findFirst({
      where: and(
        eq(incidents.serviceId, params.serviceId),
        eq(incidents.status, 'triggered'),
        eq(incidents.severity, params.severity),
      ),
      orderBy: (incidents, { desc }) => [desc(incidents.triggeredAt)],
    });

    if (existingIncident) {
      this.logger.debug(`Reusing existing incident #${existingIncident.incidentNumber}`);
      return existingIncident;
    }

    // Create new incident
    const [newIncident] = await this.db.db
      .insert(incidents)
      .values({
        title: params.title,
        serviceId: params.serviceId,
        severity: params.severity,
        status: 'triggered',
        triggeredAt: new Date(),
      })
      .returning();

    // Add timeline entry
    await this.db.db.insert(incidentTimeline).values({
      incidentId: newIncident.id,
      eventType: 'triggered',
      description: `Incident #${newIncident.incidentNumber} triggered`,
      createdAt: new Date(),
    });

    this.logger.log(`Created incident #${newIncident.incidentNumber}`);
    this.eventEmitter.emit('incident.created', newIncident);

    // Invalidate incidents cache
    await this.invalidateIncidentsCache();

    // Trigger escalation if service has an escalation policy
    const service = await this.db.query.services.findFirst({
      where: eq(services.id, params.serviceId),
    });

    if (service?.escalationPolicyId) {
      await this.triggerEscalation(newIncident.id, service.escalationPolicyId);
    }

    return newIncident;
  }

  /**
   * Trigger escalation for an incident
   */
  private async triggerEscalation(incidentId: number, escalationPolicyId: number): Promise<void> {
    // Get the first escalation level
    const firstLevel = await this.db.query.escalationLevels.findFirst({
      where: and(eq(escalationLevels.policyId, escalationPolicyId), eq(escalationLevels.level, 1)),
    });

    if (!firstLevel) {
      this.logger.warn(`No escalation levels found for policy ${escalationPolicyId}`);
      return;
    }

    await this.escalationQueue.scheduleEscalation(
      incidentId,
      escalationPolicyId,
      1,
      firstLevel.delayMinutes,
    );

    this.logger.log(
      `Triggered escalation for incident ${incidentId} with policy ${escalationPolicyId}`,
    );
  }

  /**
   * Acknowledge an incident
   */
  async acknowledge(incidentId: number, userId: number): Promise<Incident> {
    const incident = await this.db.query.incidents.findFirst({
      where: eq(incidents.id, incidentId),
    });

    if (!incident) {
      throw new NotFoundException(`Incident ${incidentId} not found`);
    }

    if (incident.status !== 'triggered') {
      this.logger.warn(`Cannot acknowledge incident ${incidentId} with status ${incident.status}`);
      return incident;
    }

    const [updated] = await this.db.db
      .update(incidents)
      .set({
        status: 'acknowledged',
        acknowledgedAt: new Date(),
        acknowledgedById: userId,
        updatedAt: new Date(),
      })
      .where(eq(incidents.id, incidentId))
      .returning();

    // Add timeline entry
    await this.db.db.insert(incidentTimeline).values({
      incidentId: incidentId,
      eventType: 'acknowledged',
      userId: userId,
      description: `Incident acknowledged`,
      createdAt: new Date(),
    });

    // Cancel pending escalations
    await this.escalationQueue.cancelEscalation(incidentId);

    this.logger.log(`Incident #${incident.incidentNumber} acknowledged by user ${userId}`);
    this.eventEmitter.emit('incident.acknowledged', { incident: updated, userId });

    // Invalidate incidents and metrics cache
    await this.invalidateIncidentsCache();
    await this.cacheService.delPattern(`${CACHE_PREFIX.METRICS}:*`);

    return updated;
  }

  /**
   * Resolve an incident
   */
  async resolve(incidentId: number, userId: number): Promise<Incident> {
    const incident = await this.db.query.incidents.findFirst({
      where: eq(incidents.id, incidentId),
    });

    if (!incident) {
      throw new NotFoundException(`Incident ${incidentId} not found`);
    }

    if (incident.status === 'resolved') {
      this.logger.warn(`Incident ${incidentId} already resolved`);
      return incident;
    }

    const [updated] = await this.db.db
      .update(incidents)
      .set({
        status: 'resolved',
        resolvedAt: new Date(),
        resolvedById: userId,
        updatedAt: new Date(),
      })
      .where(eq(incidents.id, incidentId))
      .returning();

    // Add timeline entry
    await this.db.db.insert(incidentTimeline).values({
      incidentId: incidentId,
      eventType: 'resolved',
      userId: userId,
      description: `Incident resolved`,
      createdAt: new Date(),
    });

    // Cancel pending escalations
    await this.escalationQueue.cancelEscalation(incidentId);

    this.logger.log(`Incident #${incident.incidentNumber} resolved by user ${userId}`);
    this.eventEmitter.emit('incident.resolved', { incident: updated, userId });

    // Invalidate incidents and metrics cache
    await this.invalidateIncidentsCache();
    await this.cacheService.delPattern(`${CACHE_PREFIX.METRICS}:*`);

    return updated;
  }

  /**
   * Auto-resolve incident when all alerts are resolved
   */
  async autoResolve(incidentId: number): Promise<void> {
    const incident = await this.db.query.incidents.findFirst({
      where: eq(incidents.id, incidentId),
    });

    if (!incident || incident.status === 'resolved') {
      return;
    }

    // Check if all alerts are resolved
    const openAlertsCount = await this.db.db
      .select({ count: sql<number>`count(*)::int` })
      .from(alerts)
      .where(and(eq(alerts.incidentId, incidentId), eq(alerts.status, 'firing')));

    if (openAlertsCount[0]?.count === 0) {
      await this.db.db
        .update(incidents)
        .set({
          status: 'resolved',
          resolvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(incidents.id, incidentId));

      // Add timeline entry
      await this.db.db.insert(incidentTimeline).values({
        incidentId: incidentId,
        eventType: 'resolved',
        description: `Incident auto-resolved (all alerts resolved)`,
        createdAt: new Date(),
      });

      this.logger.log(`Incident #${incident.incidentNumber} auto-resolved`);
      this.eventEmitter.emit('incident.auto_resolved', incident);

      // Invalidate incidents and metrics cache
      await this.invalidateIncidentsCache();
      await this.cacheService.delPattern(`${CACHE_PREFIX.METRICS}:*`);
    }
  }

  /**
   * Invalidate incidents cache
   */
  private async invalidateIncidentsCache(): Promise<void> {
    await this.cacheService.delPattern(`${CACHE_PREFIX.INCIDENTS}:*`);
  }

  /**
   * Get incident by ID with full related data
   */
  async findById(id: number): Promise<any> {
    const incident = await this.db.query.incidents.findFirst({
      where: eq(incidents.id, id),
      with: {
        service: true,
        alerts: {
          orderBy: (alerts, { desc }) => [desc(alerts.firedAt)],
        },
        timeline: {
          orderBy: (timeline, { desc }) => [desc(timeline.createdAt)],
          with: {
            user: {
              columns: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!incident) {
      return undefined;
    }

    // Fetch user info for acknowledged and resolved by
    const acknowledgedByUser = incident.acknowledgedById
      ? await this.db.query.users.findFirst({
          where: eq(sql`id`, incident.acknowledgedById),
          columns: {
            id: true,
            name: true,
            email: true,
          },
        })
      : null;

    const resolvedByUser = incident.resolvedById
      ? await this.db.query.users.findFirst({
          where: eq(sql`id`, incident.resolvedById),
          columns: {
            id: true,
            name: true,
            email: true,
          },
        })
      : null;

    return {
      ...incident,
      acknowledgedBy: acknowledgedByUser,
      resolvedBy: resolvedByUser,
    };
  }

  /**
   * List incidents with pagination and advanced filtering
   */
  async list(params: {
    status?: string | string[];
    severity?: string | string[];
    serviceId?: number;
    assigneeId?: number;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: string;
    limit?: number;
    offset?: number;
  }) {
    // Try to get from cache
    const cacheKey = this.cacheService.buildKey(
      CACHE_PREFIX.INCIDENTS,
      'list',
      JSON.stringify(params),
    );
    const cached = await this.cacheService.get<any[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const conditions = [];

    // Status filter (can be array)
    if (params.status) {
      const statuses = Array.isArray(params.status) ? params.status : [params.status];
      if (statuses.length === 1) {
        conditions.push(eq(incidents.status, statuses[0] as any));
      } else if (statuses.length > 1) {
        conditions.push(
          sql`${incidents.status} IN (${sql.join(
            statuses.map((s) => sql.raw(`'${s}'`)),
            sql`, `,
          )})`,
        );
      }
    }

    // Severity filter (can be array)
    if (params.severity) {
      const severities = Array.isArray(params.severity) ? params.severity : [params.severity];
      if (severities.length === 1) {
        conditions.push(eq(incidents.severity, severities[0] as any));
      } else if (severities.length > 1) {
        conditions.push(
          sql`${incidents.severity} IN (${sql.join(
            severities.map((s) => sql.raw(`'${s}'`)),
            sql`, `,
          )})`,
        );
      }
    }

    if (params.serviceId) {
      conditions.push(eq(incidents.serviceId, params.serviceId));
    }

    if (params.assigneeId) {
      conditions.push(eq(incidents.assigneeId, params.assigneeId));
    }

    // Search in title (and description if available)
    if (params.search) {
      conditions.push(sql`${incidents.title} ILIKE ${`%${params.search}%`}`);
    }

    // Date range filters
    if (params.dateFrom) {
      conditions.push(sql`${incidents.triggeredAt} >= ${params.dateFrom}`);
    }
    if (params.dateTo) {
      conditions.push(sql`${incidents.triggeredAt} <= ${params.dateTo}`);
    }

    // Determine sort order
    let orderByClause;
    switch (params.sortBy) {
      case 'oldest':
        orderByClause = sql`${incidents.triggeredAt} ASC`;
        break;
      case 'severity':
        // Sort by severity: critical, high, medium, low, info
        orderByClause = sql`
          CASE ${incidents.severity}
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            WHEN 'low' THEN 4
            WHEN 'info' THEN 5
          END ASC,
          ${incidents.triggeredAt} DESC
        `;
        break;
      case 'status':
        // Sort by status: triggered, acknowledged, resolved
        orderByClause = sql`
          CASE ${incidents.status}
            WHEN 'triggered' THEN 1
            WHEN 'acknowledged' THEN 2
            WHEN 'resolved' THEN 3
          END ASC,
          ${incidents.triggeredAt} DESC
        `;
        break;
      case 'newest':
      default:
        orderByClause = sql`${incidents.triggeredAt} DESC`;
        break;
    }

    const query = this.db.db
      .select()
      .from(incidents)
      .limit(params.limit || 50)
      .offset(params.offset || 0)
      .orderBy(orderByClause);

    let result;
    if (conditions.length > 0) {
      result = await query.where(and(...conditions));
    } else {
      result = await query;
    }

    // Cache the result
    await this.cacheService.set(cacheKey, result, CACHE_TTL.INCIDENTS_LIST);

    return result;
  }

  /**
   * Bulk acknowledge incidents
   */
  async bulkAcknowledge(
    incidentIds: number[],
    userId: number,
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const incidentId of incidentIds) {
      try {
        await this.acknowledge(incidentId, userId);
        success++;
      } catch (error) {
        this.logger.error(`Failed to acknowledge incident ${incidentId}:`, error);
        failed++;
      }
    }

    this.logger.log(`Bulk acknowledge: ${success} succeeded, ${failed} failed`);
    return { success, failed };
  }

  /**
   * Bulk resolve incidents
   */
  async bulkResolve(
    incidentIds: number[],
    userId: number,
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const incidentId of incidentIds) {
      try {
        await this.resolve(incidentId, userId);
        success++;
      } catch (error) {
        this.logger.error(`Failed to resolve incident ${incidentId}:`, error);
        failed++;
      }
    }

    this.logger.log(`Bulk resolve: ${success} succeeded, ${failed} failed`);
    return { success, failed };
  }
}
