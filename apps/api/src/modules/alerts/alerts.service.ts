import { Injectable, Logger, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq, and } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { alerts, integrations, Alert } from '../../database/schema';
import { CreateAlertDto } from './dto/create-alert.dto';
import { IncidentsService } from '../incidents/incidents.service';
import { AlertRoutingService } from '../alert-routing/alert-routing.service';
import { createHash } from 'crypto';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly incidentsService: IncidentsService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(forwardRef(() => AlertRoutingService))
    private readonly alertRoutingService: AlertRoutingService,
  ) {}

  /**
   * Ingest an alert from a webhook
   */
  async ingestAlert(integrationKey: string, payload: CreateAlertDto): Promise<Alert> {
    // 1. Validate integration
    const integration = await this.db.query.integrations.findFirst({
      where: eq(integrations.integrationKey, integrationKey),
      with: { service: true },
    });

    if (!integration || !integration.isActive) {
      throw new NotFoundException('Invalid or inactive integration');
    }

    // 2. Generate fingerprint for deduplication
    const fingerprint = this.generateFingerprint(payload);

    // 3. Check for existing alert (deduplication)
    const existingAlert = await this.db.query.alerts.findFirst({
      where: and(eq(alerts.fingerprint, fingerprint), eq(alerts.status, 'firing')),
    });

    if (existingAlert) {
      this.logger.debug(`Deduplicated alert: ${fingerprint}`);
      // Update existing alert's last seen time
      const [updated] = await this.db.db
        .update(alerts)
        .set({ createdAt: new Date() })
        .where(eq(alerts.id, existingAlert.id))
        .returning();
      return updated;
    }

    // 4. Evaluate routing rules (if team has any)
    let targetServiceId = integration.serviceId;
    let effectiveSeverity = payload.severity;
    let shouldSuppress = false;
    const additionalTags: string[] = [];

    try {
      if (integration.service && integration.service.teamId) {
        // Create a temporary alert object for routing evaluation
        const tempAlert = {
          id: 0,
          fingerprint,
          integrationId: integration.id,
          incidentId: null,
          status: payload.status === 'resolved' ? 'resolved' : 'firing',
          severity: payload.severity,
          title: payload.title || payload.alertName || 'Alert',
          description: payload.description,
          source: payload.source || integration.name,
          labels: payload.labels || {},
          annotations: payload.annotations || {},
          rawPayload: (payload.rawPayload || payload) as Record<string, unknown>,
          firedAt: payload.startsAt ? new Date(payload.startsAt) : new Date(),
          acknowledgedAt: null,
          resolvedAt: null,
          createdAt: new Date(),
        } as Alert;

        const routingResult = await this.alertRoutingService.evaluateRules(
          tempAlert,
          integration.service.teamId,
        );

        if (routingResult.matched && routingResult.actions.length > 0) {
          const action = routingResult.actions[0]; // Apply first matching action

          if (action.routeToServiceId) {
            targetServiceId = action.routeToServiceId;
            this.logger.log(
              `Routing rule matched: routing alert to service ${targetServiceId}`,
            );
          }

          if (action.setSeverity) {
            effectiveSeverity = action.setSeverity as CreateAlertDto['severity'];
            this.logger.log(`Routing rule matched: setting severity to ${effectiveSeverity}`);
          }

          if (action.suppress === true) {
            shouldSuppress = true;
            this.logger.log('Routing rule matched: suppressing alert');
          }

          if (action.addTags && Array.isArray(action.addTags)) {
            additionalTags.push(...action.addTags);
          }
        }
      }
    } catch (error) {
      this.logger.error('Error evaluating routing rules:', error);
      // Continue with default behavior if routing fails
    }

    // If alert is suppressed, mark it as suppressed status
    if (shouldSuppress) {
      const [suppressedAlert] = await this.db.db
        .insert(alerts)
        .values({
          fingerprint,
          integrationId: integration.id,
          incidentId: null,
          status: 'suppressed',
          severity: effectiveSeverity,
          title: payload.title || payload.alertName || 'Alert',
          description: payload.description,
          source: payload.source || integration.name,
          labels: payload.labels || {},
          annotations: payload.annotations || {},
          rawPayload: (payload.rawPayload || payload) as Record<string, unknown>,
          firedAt: payload.startsAt ? new Date(payload.startsAt) : new Date(),
          resolvedAt: null,
        })
        .returning();

      this.logger.log(`Alert suppressed by routing rule: ${suppressedAlert.title}`);
      return suppressedAlert;
    }

    // 5. Create or find incident
    let incidentId: number | null = null;

    if (payload.status !== 'resolved') {
      const incident = await this.incidentsService.findOrCreateForAlert({
        serviceId: targetServiceId, // Use routed service ID
        severity: effectiveSeverity, // Use effective severity
        title: payload.title || payload.alertName || 'Unnamed Alert',
      });
      incidentId = incident.id;
    }

    // 6. Insert alert
    const [alert] = await this.db.db
      .insert(alerts)
      .values({
        fingerprint,
        integrationId: integration.id,
        incidentId,
        status: payload.status === 'resolved' ? 'resolved' : 'firing',
        severity: effectiveSeverity, // Use effective severity from routing
        title: payload.title || payload.alertName || 'Alert',
        description: payload.description,
        source: payload.source || integration.name,
        labels: payload.labels || {},
        annotations: payload.annotations || {},
        rawPayload: (payload.rawPayload || payload) as Record<string, unknown>,
        firedAt: payload.startsAt ? new Date(payload.startsAt) : new Date(),
        resolvedAt: payload.status === 'resolved' ? new Date() : null,
      })
      .returning();

    this.logger.log(
      `Ingested alert: ${alert.title} (${alert.severity}) for integration ${integration.name}`,
    );

    // 7. Emit event for WebSocket broadcast
    this.eventEmitter.emit('alert.created', alert);

    // 8. If resolved, check if incident should auto-resolve
    if (payload.status === 'resolved' && incidentId) {
      await this.incidentsService.autoResolve(incidentId);
    }

    return alert;
  }

  /**
   * Generate fingerprint for alert deduplication
   * Uses alertName/title, source, and sorted labels
   */
  private generateFingerprint(payload: CreateAlertDto): string {
    const parts = [
      payload.alertName || payload.title || 'unknown',
      payload.source || 'unknown',
      ...Object.entries(payload.labels || {})
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`),
    ];

    const hash = createHash('sha256').update(parts.join('|')).digest('hex');

    return hash.substring(0, 64);
  }

  /**
   * Acknowledge an alert
   */
  async acknowledge(alertId: number, userId: number): Promise<Alert> {
    const alert = await this.db.query.alerts.findFirst({
      where: eq(alerts.id, alertId),
    });

    if (!alert) {
      throw new NotFoundException(`Alert ${alertId} not found`);
    }

    const [updated] = await this.db.db
      .update(alerts)
      .set({
        status: 'acknowledged',
        acknowledgedAt: new Date(),
      })
      .where(eq(alerts.id, alertId))
      .returning();

    // Also acknowledge the incident if it exists
    if (alert.incidentId) {
      await this.incidentsService.acknowledge(alert.incidentId, userId);
    }

    this.logger.log(`Alert ${alertId} acknowledged`);
    this.eventEmitter.emit('alert.acknowledged', updated);

    return updated;
  }

  /**
   * Resolve an alert
   */
  async resolve(alertId: number): Promise<Alert> {
    const alert = await this.db.query.alerts.findFirst({
      where: eq(alerts.id, alertId),
    });

    if (!alert) {
      throw new NotFoundException(`Alert ${alertId} not found`);
    }

    const [updated] = await this.db.db
      .update(alerts)
      .set({
        status: 'resolved',
        resolvedAt: new Date(),
      })
      .where(eq(alerts.id, alertId))
      .returning();

    // Check if incident should auto-resolve
    if (alert.incidentId) {
      await this.incidentsService.autoResolve(alert.incidentId);
    }

    this.logger.log(`Alert ${alertId} resolved`);
    this.eventEmitter.emit('alert.resolved', updated);

    return updated;
  }

  /**
   * Get alert by ID
   */
  async findById(id: number): Promise<Alert | undefined> {
    return this.db.query.alerts.findFirst({
      where: eq(alerts.id, id),
      with: {
        incident: true,
        integration: true,
      },
    });
  }

  /**
   * List alerts with pagination
   */
  async list(params: {
    status?: 'firing' | 'acknowledged' | 'resolved' | 'suppressed';
    incidentId?: number;
    limit?: number;
    offset?: number;
  }) {
    const conditions = [];
    if (params.status) {
      conditions.push(eq(alerts.status, params.status));
    }
    if (params.incidentId) {
      conditions.push(eq(alerts.incidentId, params.incidentId));
    }

    const query = this.db.db
      .select()
      .from(alerts)
      .limit(params.limit || 50)
      .offset(params.offset || 0)
      .orderBy(alerts.firedAt);

    if (conditions.length > 0) {
      return query.where(and(...conditions));
    }

    return query;
  }
}
