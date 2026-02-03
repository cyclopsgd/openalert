import { Injectable, NotFoundException, Logger, ConflictException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { statusPages } from '../../database/schema';

export interface CreateStatusPageDto {
  name: string;
  slug: string;
  teamId: number;
  description?: string;
  isPublic?: boolean;
  customDomain?: string;
  themeColor?: string;
  logoUrl?: string;
  headerHtml?: string;
  footerHtml?: string;
}

export interface UpdateStatusPageDto {
  name?: string;
  slug?: string;
  description?: string;
  isPublic?: boolean;
  customDomain?: string;
  themeColor?: string;
  logoUrl?: string;
  headerHtml?: string;
  footerHtml?: string;
}

@Injectable()
export class StatusPagesService {
  private readonly logger = new Logger(StatusPagesService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Create a new status page
   */
  async create(data: CreateStatusPageDto) {
    this.logger.log(`Creating status page: ${data.name} (${data.slug})`);

    // Check if slug is already taken
    const existing = await this.findBySlug(data.slug);
    if (existing) {
      throw new ConflictException(`Status page with slug '${data.slug}' already exists`);
    }

    const [statusPage] = await this.db.db
      .insert(statusPages)
      .values({
        name: data.name,
        slug: data.slug,
        teamId: data.teamId,
        description: data.description,
        isPublic: data.isPublic ?? true,
        customDomain: data.customDomain,
        themeColor: data.themeColor || '#6366f1',
        logoUrl: data.logoUrl,
        headerHtml: data.headerHtml,
        footerHtml: data.footerHtml,
      })
      .returning();

    return statusPage;
  }

  /**
   * Find status page by ID
   */
  async findById(id: number) {
    const statusPage = await this.db.db.query.statusPages.findFirst({
      where: eq(statusPages.id, id),
      with: {
        components: {
          orderBy: (components, { asc }) => [asc(components.position)],
        },
        incidents: {
          with: {
            updates: {
              orderBy: (updates, { desc }) => [desc(updates.createdAt)],
            },
          },
          orderBy: (incidents, { desc }) => [desc(incidents.createdAt)],
          limit: 10, // Latest 10 incidents
        },
      },
    });

    if (!statusPage) {
      throw new NotFoundException(`Status page with ID ${id} not found`);
    }

    return statusPage;
  }

  /**
   * Find status page by slug (public endpoint)
   */
  async findBySlug(slug: string) {
    return this.db.db.query.statusPages.findFirst({
      where: eq(statusPages.slug, slug),
      with: {
        components: {
          orderBy: (components, { asc }) => [asc(components.position)],
        },
        incidents: {
          with: {
            updates: {
              orderBy: (updates, { desc }) => [desc(updates.createdAt)],
            },
          },
          orderBy: (incidents, { desc }) => [desc(incidents.createdAt)],
          limit: 10,
        },
      },
    });
  }

  /**
   * List status pages for a team
   */
  async findByTeam(teamId: number) {
    return this.db.db.query.statusPages.findMany({
      where: eq(statusPages.teamId, teamId),
      with: {
        components: true,
      },
    });
  }

  /**
   * Update status page
   */
  async update(id: number, data: UpdateStatusPageDto) {
    this.logger.log(`Updating status page ${id}`);

    // If slug is being changed, check for conflicts
    if (data.slug) {
      const existing = await this.findBySlug(data.slug);
      if (existing && existing.id !== id) {
        throw new ConflictException(`Status page with slug '${data.slug}' already exists`);
      }
    }

    const [updated] = await this.db.db
      .update(statusPages)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(statusPages.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Status page with ID ${id} not found`);
    }

    return updated;
  }

  /**
   * Delete status page
   */
  async delete(id: number) {
    this.logger.log(`Deleting status page ${id}`);

    const result = await this.db.db.delete(statusPages).where(eq(statusPages.id, id)).returning();

    if (result.length === 0) {
      throw new NotFoundException(`Status page with ID ${id} not found`);
    }

    return { success: true };
  }

  /**
   * Get overall status for a status page
   */
  async getOverallStatus(statusPageId: number): Promise<string> {
    const statusPage = await this.db.db.query.statusPages.findFirst({
      where: eq(statusPages.id, statusPageId),
      with: {
        components: true,
        incidents: {
          where: (incidents, { isNull }) => isNull(incidents.resolvedAt),
        },
      },
    });

    if (!statusPage) {
      throw new NotFoundException(`Status page with ID ${statusPageId} not found`);
    }

    // Check if there are any active incidents
    if (statusPage.incidents && statusPage.incidents.length > 0) {
      const hasCritical = statusPage.incidents.some((inc) => inc.impact === 'critical');
      const hasMajor = statusPage.incidents.some((inc) => inc.impact === 'major');

      if (hasCritical) return 'major_outage';
      if (hasMajor) return 'partial_outage';
      return 'degraded_performance';
    }

    // Check component statuses
    const components = statusPage.components || [];
    const hasMajorOutage = components.some((c) => c.status === 'major_outage');
    const hasPartialOutage = components.some((c) => c.status === 'partial_outage');
    const hasDegraded = components.some((c) => c.status === 'degraded_performance');
    const hasMaintenance = components.some((c) => c.status === 'under_maintenance');

    if (hasMajorOutage) return 'major_outage';
    if (hasPartialOutage) return 'partial_outage';
    if (hasDegraded) return 'degraded_performance';
    if (hasMaintenance) return 'under_maintenance';

    return 'operational';
  }
}
