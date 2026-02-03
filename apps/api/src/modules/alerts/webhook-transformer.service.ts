import { Injectable, Logger } from '@nestjs/common';
import { CreateAlertDto, AlertSeverity, AlertStatus } from './dto/create-alert.dto';

@Injectable()
export class WebhookTransformerService {
  private readonly logger = new Logger(WebhookTransformerService.name);

  /**
   * Auto-detect webhook format and transform to standard format
   */
  transform(payload: any, userAgent?: string): CreateAlertDto[] {
    // Detect format based on payload structure
    if (payload.alerts && Array.isArray(payload.alerts)) {
      // Prometheus Alertmanager format
      return this.transformPrometheus(payload);
    } else if (payload.alerts && payload.orgId) {
      // Grafana format
      return this.transformGrafana(payload);
    } else if (payload.data && payload.data.essentials) {
      // Azure Monitor format
      return this.transformAzureMonitor(payload);
    } else if (payload.alert_type || payload.event_type) {
      // Datadog format
      return this.transformDatadog(payload);
    } else {
      // Generic webhook format
      return this.transformGeneric(payload);
    }
  }

  /**
   * Transform Prometheus Alertmanager webhook
   * https://prometheus.io/docs/alerting/latest/configuration/#webhook_config
   */
  transformPrometheus(payload: any): CreateAlertDto[] {
    const alerts: CreateAlertDto[] = [];

    for (const alert of payload.alerts || []) {
      const severity = this.mapPrometheuseSeverity(alert.labels?.severity);
      const status = alert.status === 'resolved' ? AlertStatus.RESOLVED : AlertStatus.FIRING;

      alerts.push({
        alertName: alert.labels?.alertname || 'Prometheus Alert',
        title: alert.annotations?.summary || alert.labels?.alertname || 'Alert',
        description: alert.annotations?.description || alert.annotations?.message,
        severity,
        status,
        source: 'prometheus',
        labels: alert.labels || {},
        annotations: alert.annotations || {},
        startsAt: alert.startsAt,
        endsAt: alert.endsAt,
        generatorURL: alert.generatorURL,
        rawPayload: alert,
      });
    }

    return alerts;
  }

  /**
   * Transform Grafana Alerting webhook
   * https://grafana.com/docs/grafana/latest/alerting/manage-notifications/webhook-notifier/
   */
  transformGrafana(payload: any): CreateAlertDto[] {
    const alerts: CreateAlertDto[] = [];
    const status = payload.state === 'ok' ? AlertStatus.RESOLVED : AlertStatus.FIRING;

    if (payload.alerts && Array.isArray(payload.alerts)) {
      // Grafana Unified Alerting (v8+)
      for (const alert of payload.alerts) {
        alerts.push({
          alertName: alert.labels?.alertname || payload.title || 'Grafana Alert',
          title: payload.title || alert.labels?.alertname || 'Alert',
          description: payload.message || alert.annotations?.description,
          severity: this.mapGrafanaSeverity(alert.labels?.severity || payload.ruleName),
          status,
          source: 'grafana',
          labels: { ...alert.labels, ...payload.commonLabels },
          annotations: alert.annotations || {},
          startsAt: alert.startsAt,
          endsAt: alert.endsAt,
          generatorURL: alert.generatorURL,
          rawPayload: alert,
        });
      }
    } else {
      // Legacy Grafana alerting (pre-v8)
      alerts.push({
        alertName: payload.ruleName || payload.title || 'Grafana Alert',
        title: payload.title || payload.ruleName || 'Alert',
        description: payload.message,
        severity: this.mapGrafanaSeverity(payload.state),
        status,
        source: 'grafana',
        labels: payload.tags || {},
        annotations: {},
        startsAt: payload.time ? new Date(payload.time).toISOString() : undefined,
        generatorURL: payload.ruleUrl,
        rawPayload: payload,
      });
    }

    return alerts;
  }

  /**
   * Transform Azure Monitor webhook
   * https://learn.microsoft.com/en-us/azure/azure-monitor/alerts/alerts-webhook
   */
  transformAzureMonitor(payload: any): CreateAlertDto[] {
    const data = payload.data;
    const essentials = data.essentials;
    const status =
      essentials.monitorCondition === 'Resolved' ? AlertStatus.RESOLVED : AlertStatus.FIRING;

    return [
      {
        alertName: essentials.alertRule || 'Azure Monitor Alert',
        title: essentials.alertRule || 'Alert',
        description: essentials.description || data.alertContext?.condition?.allOf?.[0]?.metricName,
        severity: this.mapAzureSeverity(essentials.severity),
        status,
        source: 'azure_monitor',
        labels: {
          subscriptionId: essentials.subscriptionId,
          resourceGroup: essentials.resourceGroup,
          resourceName: essentials.resourceName,
          resourceType: essentials.resourceType,
          ...essentials.configurationItems,
        },
        annotations: {
          monitoringService: essentials.monitoringService,
          signalType: essentials.signalType,
          firedDateTime: essentials.firedDateTime,
        },
        startsAt: essentials.firedDateTime,
        generatorURL: essentials.alertTargetIDs?.[0],
        rawPayload: payload,
      },
    ];
  }

  /**
   * Transform Datadog webhook
   * https://docs.datadoghq.com/integrations/webhooks/
   */
  transformDatadog(payload: any): CreateAlertDto[] {
    const isResolved = payload.alert_type === 'info' || payload.event_type === 'resolved';
    const status = isResolved ? AlertStatus.RESOLVED : AlertStatus.FIRING;

    return [
      {
        alertName: payload.title || 'Datadog Alert',
        title: payload.title || 'Alert',
        description: payload.body || payload.text,
        severity: this.mapDatadogSeverity(payload.alert_type || payload.priority),
        status,
        source: 'datadog',
        labels:
          payload.tags?.reduce((acc: any, tag: string) => {
            const [key, value] = tag.split(':');
            acc[key] = value || '';
            return acc;
          }, {}) || {},
        annotations: {
          hostname: payload.hostname,
          org_id: payload.org?.id,
          org_name: payload.org?.name,
        },
        startsAt: payload.date ? new Date(payload.date * 1000).toISOString() : undefined,
        generatorURL: payload.link,
        rawPayload: payload,
      },
    ];
  }

  /**
   * Transform generic webhook (fallback)
   */
  transformGeneric(payload: any): CreateAlertDto[] {
    return [
      {
        alertName: payload.name || payload.alert || payload.event || 'Generic Alert',
        title: payload.title || payload.subject || payload.name || 'Alert',
        description: payload.description || payload.message || payload.body,
        severity: this.mapGenericSeverity(payload.severity || payload.priority || payload.level),
        status:
          payload.status === 'resolved' || payload.state === 'ok'
            ? AlertStatus.RESOLVED
            : AlertStatus.FIRING,
        source: payload.source || 'webhook',
        labels: payload.labels || payload.tags || {},
        annotations: payload.annotations || {},
        startsAt: payload.timestamp || payload.time || payload.startsAt,
        generatorURL: payload.url || payload.link,
        rawPayload: payload,
      },
    ];
  }

  // Severity mapping helpers
  private mapPrometheuseSeverity(severity?: string): AlertSeverity {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return AlertSeverity.CRITICAL;
      case 'warning':
        return AlertSeverity.HIGH;
      case 'info':
        return AlertSeverity.INFO;
      default:
        return AlertSeverity.MEDIUM;
    }
  }

  private mapGrafanaSeverity(state?: string): AlertSeverity {
    switch (state?.toLowerCase()) {
      case 'alerting':
      case 'critical':
        return AlertSeverity.CRITICAL;
      case 'pending':
      case 'warning':
        return AlertSeverity.HIGH;
      case 'ok':
      case 'normal':
        return AlertSeverity.INFO;
      default:
        return AlertSeverity.MEDIUM;
    }
  }

  private mapAzureSeverity(severity?: string): AlertSeverity {
    switch (severity?.toLowerCase()) {
      case 'sev0':
      case 'critical':
        return AlertSeverity.CRITICAL;
      case 'sev1':
      case 'error':
        return AlertSeverity.HIGH;
      case 'sev2':
      case 'warning':
        return AlertSeverity.MEDIUM;
      case 'sev3':
      case 'informational':
        return AlertSeverity.LOW;
      case 'sev4':
      case 'verbose':
        return AlertSeverity.INFO;
      default:
        return AlertSeverity.MEDIUM;
    }
  }

  private mapDatadogSeverity(alertType?: string): AlertSeverity {
    switch (alertType?.toLowerCase()) {
      case 'error':
        return AlertSeverity.CRITICAL;
      case 'warning':
        return AlertSeverity.HIGH;
      case 'info':
        return AlertSeverity.INFO;
      default:
        return AlertSeverity.MEDIUM;
    }
  }

  private mapGenericSeverity(severity?: string): AlertSeverity {
    if (!severity) return AlertSeverity.MEDIUM;

    const s = severity.toLowerCase();
    if (s.includes('crit') || s.includes('sev0') || s === 'p0') {
      return AlertSeverity.CRITICAL;
    }
    if (s.includes('high') || s.includes('error') || s.includes('sev1') || s === 'p1') {
      return AlertSeverity.HIGH;
    }
    if (s.includes('low') || s.includes('sev3')) {
      return AlertSeverity.LOW;
    }
    if (s.includes('info') || s.includes('sev4')) {
      return AlertSeverity.INFO;
    }
    return AlertSeverity.MEDIUM;
  }
}
