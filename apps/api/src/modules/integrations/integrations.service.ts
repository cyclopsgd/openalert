import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq, desc } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { integrations, webhookLogs, Integration, WebhookLog } from '../../database/schema';
import { CreateIntegrationDto } from './dto/create-integration.dto';
import { UpdateIntegrationDto } from './dto/update-integration.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Generate a secure integration key
   */
  private generateIntegrationKey(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * List all integrations
   */
  async list(): Promise<Integration[]> {
    return this.db.db.select().from(integrations).orderBy(integrations.name);
  }

  /**
   * Get integration by ID
   */
  async findById(id: number): Promise<Integration> {
    const integration = await this.db.query.integrations.findFirst({
      where: eq(integrations.id, id),
    });

    if (!integration) {
      throw new NotFoundException(`Integration with ID ${id} not found`);
    }

    return integration;
  }

  /**
   * Get integration by key
   */
  async findByKey(integrationKey: string): Promise<Integration | undefined> {
    return this.db.query.integrations.findFirst({
      where: eq(integrations.integrationKey, integrationKey),
    });
  }

  /**
   * Create a new integration
   */
  async create(dto: CreateIntegrationDto): Promise<Integration> {
    const integrationKey = this.generateIntegrationKey();

    const [integration] = await this.db.db
      .insert(integrations)
      .values({
        name: dto.name,
        type: dto.type,
        serviceId: dto.serviceId,
        integrationKey,
        config: dto.config || {},
        isActive: dto.isActive ?? true,
      })
      .returning();

    this.logger.log(`Created integration: ${integration.name} (${integration.id})`);
    return integration;
  }

  /**
   * Update an integration
   */
  async update(id: number, dto: UpdateIntegrationDto): Promise<Integration> {
    const existing = await this.findById(id);

    const [updated] = await this.db.db
      .update(integrations)
      .set({
        ...dto,
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, id))
      .returning();

    this.logger.log(`Updated integration: ${updated.name} (${id})`);
    return updated;
  }

  /**
   * Regenerate integration key
   */
  async regenerateKey(id: number): Promise<Integration> {
    const existing = await this.findById(id);
    const newKey = this.generateIntegrationKey();

    const [updated] = await this.db.db
      .update(integrations)
      .set({
        integrationKey: newKey,
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, id))
      .returning();

    this.logger.log(`Regenerated key for integration: ${updated.name} (${id})`);
    return updated;
  }

  /**
   * Delete an integration
   */
  async delete(id: number): Promise<void> {
    const existing = await this.findById(id);

    await this.db.db.delete(integrations).where(eq(integrations.id, id));

    this.logger.log(`Deleted integration: ${existing.name} (${id})`);
  }

  /**
   * Get recent webhook logs for an integration
   */
  async getWebhookLogs(integrationKey: string, limit: number = 50): Promise<WebhookLog[]> {
    return this.db.db
      .select()
      .from(webhookLogs)
      .where(eq(webhookLogs.integrationKey, integrationKey))
      .orderBy(desc(webhookLogs.createdAt))
      .limit(limit);
  }

  /**
   * Log a webhook call
   */
  async logWebhookCall(data: {
    integrationKey: string;
    method: string;
    path: string;
    statusCode: number;
    requestHeaders?: Record<string, string>;
    requestBody?: Record<string, unknown>;
    responseBody?: Record<string, unknown>;
    userAgent?: string;
    ipAddress?: string;
    processingTimeMs?: number;
    error?: string;
  }): Promise<void> {
    await this.db.db.insert(webhookLogs).values(data);
  }
}
