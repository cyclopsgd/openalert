import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { eq, isNull, desc, and } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { statusPageIncidents, statusPageUpdates } from '../../database/schema';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface CreateStatusPageIncidentDto {
  statusPageId: number;
  title: string;
  status?: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  impact?: 'minor' | 'major' | 'critical';
  componentIds?: number[];
  internalIncidentId?: number;
  scheduledFor?: Date;
  scheduledUntil?: Date;
}

export interface UpdateStatusPageIncidentDto {
  title?: string;
  status?: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  impact?: 'minor' | 'major' | 'critical';
  componentIds?: number[];
  scheduledFor?: Date;
  scheduledUntil?: Date;
}

export interface CreateStatusUpdateDto {
  incidentId: number;
  status: string;
  message: string;
}

@Injectable()
export class StatusPageIncidentsService {
  private readonly logger = new Logger(StatusPageIncidentsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a new status page incident
   */
  async createIncident(data: CreateStatusPageIncidentDto) {
    this.logger.log(`Creating status page incident: ${data.title}`);

    const [incident] = await this.db.db
      .insert(statusPageIncidents)
      .values({
        statusPageId: data.statusPageId,
        internalIncidentId: data.internalIncidentId,
        title: data.title,
        status: data.status || 'investigating',
        impact: data.impact || 'minor',
        componentIds: data.componentIds || [],
        scheduledFor: data.scheduledFor,
        scheduledUntil: data.scheduledUntil,
      })
      .returning();

    this.eventEmitter.emit('statuspage.incident.created', incident);

    return this.findIncidentById(incident.id);
  }

  /**
   * Find incident by ID
   */
  async findIncidentById(id: number) {
    const incident = await this.db.db.query.statusPageIncidents.findFirst({
      where: eq(statusPageIncidents.id, id),
      with: {
        statusPage: true,
        updates: {
          orderBy: desc(statusPageUpdates.createdAt),
        },
      },
    });

    if (!incident) {
      throw new NotFoundException(`Status page incident with ID ${id} not found`);
    }

    return incident;
  }

  /**
   * List incidents for a status page
   */
  async findByStatusPage(
    statusPageId: number,
    options?: {
      includeResolved?: boolean;
      limit?: number;
    },
  ) {
    let whereClause = eq(statusPageIncidents.statusPageId, statusPageId);

    if (!options?.includeResolved) {
      whereClause = and(
        eq(statusPageIncidents.statusPageId, statusPageId),
        isNull(statusPageIncidents.resolvedAt),
      ) as any;
    }

    return this.db.db.query.statusPageIncidents.findMany({
      where: whereClause,
      with: {
        updates: {
          orderBy: desc(statusPageUpdates.createdAt),
          limit: 1, // Just the latest update
        },
      },
      orderBy: desc(statusPageIncidents.createdAt),
      limit: options?.limit || 50,
    });
  }

  /**
   * Update incident
   */
  async updateIncident(id: number, data: UpdateStatusPageIncidentDto) {
    this.logger.log(`Updating status page incident ${id}`);

    // If status is being set to resolved, set resolvedAt
    const updateData: any = { ...data, updatedAt: new Date() };
    if (data.status === 'resolved') {
      updateData.resolvedAt = new Date();
    }

    const [updated] = await this.db.db
      .update(statusPageIncidents)
      .set(updateData)
      .where(eq(statusPageIncidents.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Status page incident with ID ${id} not found`);
    }

    this.eventEmitter.emit('statuspage.incident.updated', updated);

    return this.findIncidentById(id);
  }

  /**
   * Delete incident
   */
  async deleteIncident(id: number) {
    this.logger.log(`Deleting status page incident ${id}`);

    const result = await this.db.db
      .delete(statusPageIncidents)
      .where(eq(statusPageIncidents.id, id))
      .returning();

    if (result.length === 0) {
      throw new NotFoundException(`Status page incident with ID ${id} not found`);
    }

    return { success: true };
  }

  /**
   * Post an update to an incident
   */
  async postUpdate(data: CreateStatusUpdateDto) {
    this.logger.log(`Posting update to status page incident ${data.incidentId}`);

    // Create the update
    const [update] = await this.db.db
      .insert(statusPageUpdates)
      .values({
        incidentId: data.incidentId,
        status: data.status,
        message: data.message,
      })
      .returning();

    // Update the incident's status
    await this.db.db
      .update(statusPageIncidents)
      .set({
        status: data.status as any,
        updatedAt: new Date(),
      })
      .where(eq(statusPageIncidents.id, data.incidentId));

    this.eventEmitter.emit('statuspage.update.posted', update);

    return update;
  }

  /**
   * List updates for an incident
   */
  async findUpdatesByIncident(incidentId: number) {
    return this.db.db.query.statusPageUpdates.findMany({
      where: eq(statusPageUpdates.incidentId, incidentId),
      orderBy: desc(statusPageUpdates.createdAt),
    });
  }

  /**
   * Resolve an incident
   */
  async resolveIncident(id: number, message: string) {
    this.logger.log(`Resolving status page incident ${id}`);

    // Post a resolved update
    await this.postUpdate({
      incidentId: id,
      status: 'resolved',
      message,
    });

    // Update the incident
    return this.updateIncident(id, {
      status: 'resolved',
    });
  }
}
