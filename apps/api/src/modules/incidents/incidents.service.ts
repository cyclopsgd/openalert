import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq, and, sql } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { incidents, alerts, incidentTimeline, Incident } from '../../database/schema';

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

    return newIncident;
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

    this.logger.log(`Incident #${incident.incidentNumber} acknowledged by user ${userId}`);
    this.eventEmitter.emit('incident.acknowledged', { incident: updated, userId });

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

    this.logger.log(`Incident #${incident.incidentNumber} resolved by user ${userId}`);
    this.eventEmitter.emit('incident.resolved', { incident: updated, userId });

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
    }
  }

  /**
   * Get incident by ID
   */
  async findById(id: number): Promise<Incident | undefined> {
    return this.db.query.incidents.findFirst({
      where: eq(incidents.id, id),
      with: {
        service: true,
        alerts: true,
        timeline: {
          orderBy: (timeline, { desc }) => [desc(timeline.createdAt)],
        },
      },
    });
  }

  /**
   * List incidents with pagination
   */
  async list(params: {
    status?: 'triggered' | 'acknowledged' | 'resolved';
    serviceId?: number;
    limit?: number;
    offset?: number;
  }) {
    const conditions = [];
    if (params.status) {
      conditions.push(eq(incidents.status, params.status));
    }
    if (params.serviceId) {
      conditions.push(eq(incidents.serviceId, params.serviceId));
    }

    const query = this.db.db
      .select()
      .from(incidents)
      .limit(params.limit || 50)
      .offset(params.offset || 0)
      .orderBy(sql`${incidents.triggeredAt} DESC`);

    if (conditions.length > 0) {
      return query.where(and(...conditions));
    }

    return query;
  }
}
