import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { statusPageComponents } from '../../database/schema';

export interface CreateComponentDto {
  statusPageId: number;
  name: string;
  description?: string;
  status?: 'operational' | 'degraded_performance' | 'partial_outage' | 'major_outage' | 'under_maintenance';
  position?: number;
}

export interface UpdateComponentDto {
  name?: string;
  description?: string;
  status?: 'operational' | 'degraded_performance' | 'partial_outage' | 'major_outage' | 'under_maintenance';
  position?: number;
}

@Injectable()
export class ComponentsService {
  private readonly logger = new Logger(ComponentsService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Create a new component
   */
  async create(data: CreateComponentDto) {
    this.logger.log(`Creating component: ${data.name} on status page ${data.statusPageId}`);

    // Get next position if not specified
    if (data.position === undefined) {
      const existing = await this.db.db.query.statusPageComponents.findMany({
        where: eq(statusPageComponents.statusPageId, data.statusPageId),
        orderBy: (components, { desc }) => [desc(components.position)],
        limit: 1,
      });

      data.position = existing.length > 0 ? existing[0].position + 1 : 0;
    }

    const [component] = await this.db.db
      .insert(statusPageComponents)
      .values({
        statusPageId: data.statusPageId,
        name: data.name,
        description: data.description,
        status: data.status || 'operational',
        position: data.position,
      })
      .returning();

    return component;
  }

  /**
   * Find component by ID
   */
  async findById(id: number) {
    const component = await this.db.db.query.statusPageComponents.findFirst({
      where: eq(statusPageComponents.id, id),
      with: {
        statusPage: true,
      },
    });

    if (!component) {
      throw new NotFoundException(`Component with ID ${id} not found`);
    }

    return component;
  }

  /**
   * List components for a status page
   */
  async findByStatusPage(statusPageId: number) {
    return this.db.db.query.statusPageComponents.findMany({
      where: eq(statusPageComponents.statusPageId, statusPageId),
      orderBy: (components, { asc }) => [asc(components.position)],
    });
  }

  /**
   * Update component
   */
  async update(id: number, data: UpdateComponentDto) {
    this.logger.log(`Updating component ${id}`);

    const [updated] = await this.db.db
      .update(statusPageComponents)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(statusPageComponents.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Component with ID ${id} not found`);
    }

    return updated;
  }

  /**
   * Update component status
   */
  async updateStatus(id: number, status: string) {
    this.logger.log(`Updating component ${id} status to: ${status}`);

    return this.update(id, { status: status as any });
  }

  /**
   * Delete component
   */
  async delete(id: number) {
    this.logger.log(`Deleting component ${id}`);

    const result = await this.db.db
      .delete(statusPageComponents)
      .where(eq(statusPageComponents.id, id))
      .returning();

    if (result.length === 0) {
      throw new NotFoundException(`Component with ID ${id} not found`);
    }

    return { success: true };
  }

  /**
   * Reorder components
   */
  async reorder(statusPageId: number, componentIds: number[]) {
    this.logger.log(`Reordering components for status page ${statusPageId}`);

    // Update each component's position
    for (let i = 0; i < componentIds.length; i++) {
      await this.db.db
        .update(statusPageComponents)
        .set({ position: i })
        .where(eq(statusPageComponents.id, componentIds[i]));
    }

    return this.findByStatusPage(statusPageId);
  }
}
