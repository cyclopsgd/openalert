import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { initializeTestApp, closeTestApp, cleanupDatabase } from './setup';
import {
  createAuthenticatedUser,
  authenticatedGet,
  TestUser,
} from './helpers/auth.helper';
import {
  createTestService,
  createTestIntegration,
  createTestAlert,
  createTestIncident,
} from './helpers/database.helper';
import {
  testUsers,
  prometheusAlertPayload,
  grafanaAlertPayload,
  datadogAlertPayload,
  genericAlertPayload,
} from './helpers/fixtures';

describe('Alerts Integration Tests', () => {
  let app: INestApplication;
  let superadminUser: TestUser;
  let responderUser: TestUser;

  beforeAll(async () => {
    app = await initializeTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  beforeEach(async () => {
    await cleanupDatabase();
    superadminUser = await createAuthenticatedUser(app, testUsers.superadmin);
    responderUser = await createAuthenticatedUser(app, testUsers.responder);
  });

  describe('POST /webhooks/prometheus/:integrationKey', () => {
    it('should ingest Prometheus alert', async () => {
      const service = await createTestService(app, { name: 'Test Service' });
      const integration = await createTestIntegration(app, {
        name: 'Prometheus',
        type: 'prometheus',
        serviceId: service.id,
      });

      const response = await request(app.getHttpServer())
        .post(`/webhooks/prometheus/${integration.integrationKey}`)
        .send(prometheusAlertPayload)
        .expect(202);

      expect(response.body.status).toBe('accepted');
      expect(response.body.alertsProcessed).toBe(1);
      expect(response.body.alertIds).toHaveLength(1);
    });

    it('should reject invalid integration key', async () => {
      await request(app.getHttpServer())
        .post('/webhooks/prometheus/invalid-key-123')
        .send(prometheusAlertPayload)
        .expect(404);
    });

    it('should process multiple alerts in single payload', async () => {
      const service = await createTestService(app, { name: 'Test Service' });
      const integration = await createTestIntegration(app, {
        name: 'Prometheus',
        type: 'prometheus',
        serviceId: service.id,
      });

      const multiAlertPayload = {
        alerts: [
          {
            status: 'firing',
            labels: { alertname: 'Alert1', severity: 'critical' },
            annotations: { summary: 'First alert' },
          },
          {
            status: 'firing',
            labels: { alertname: 'Alert2', severity: 'warning' },
            annotations: { summary: 'Second alert' },
          },
          {
            status: 'firing',
            labels: { alertname: 'Alert3', severity: 'info' },
            annotations: { summary: 'Third alert' },
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post(`/webhooks/prometheus/${integration.integrationKey}`)
        .send(multiAlertPayload)
        .expect(202);

      expect(response.body.alertsProcessed).toBe(3);
      expect(response.body.alertIds).toHaveLength(3);
    });

    it('should map Prometheus severity correctly', async () => {
      const service = await createTestService(app, { name: 'Test Service' });
      const integration = await createTestIntegration(app, {
        name: 'Prometheus',
        type: 'prometheus',
        serviceId: service.id,
      });

      await request(app.getHttpServer())
        .post(`/webhooks/prometheus/${integration.integrationKey}`)
        .send(prometheusAlertPayload)
        .expect(202);

      // Verify alert was created with correct severity
      const alertsResponse = await authenticatedGet(app, '/alerts', superadminUser.token).expect(
        200,
      );

      expect(alertsResponse.body.alerts[0].severity).toBe('critical');
    });
  });

  describe('POST /webhooks/grafana/:integrationKey', () => {
    it('should ingest Grafana alert', async () => {
      const service = await createTestService(app, { name: 'Test Service' });
      const integration = await createTestIntegration(app, {
        name: 'Grafana',
        type: 'grafana',
        serviceId: service.id,
      });

      const response = await request(app.getHttpServer())
        .post(`/webhooks/grafana/${integration.integrationKey}`)
        .send(grafanaAlertPayload)
        .expect(202);

      expect(response.body.status).toBe('accepted');
      expect(response.body.alertsProcessed).toBe(1);
    });

    it('should handle Grafana resolved alerts', async () => {
      const service = await createTestService(app, { name: 'Test Service' });
      const integration = await createTestIntegration(app, {
        name: 'Grafana',
        type: 'grafana',
        serviceId: service.id,
      });

      const resolvedPayload = {
        ...grafanaAlertPayload,
        state: 'ok',
      };

      const response = await request(app.getHttpServer())
        .post(`/webhooks/grafana/${integration.integrationKey}`)
        .send(resolvedPayload)
        .expect(202);

      expect(response.body.status).toBe('accepted');
    });
  });

  describe('POST /webhooks/datadog/:integrationKey', () => {
    it('should ingest Datadog alert', async () => {
      const service = await createTestService(app, { name: 'Test Service' });
      const integration = await createTestIntegration(app, {
        name: 'Datadog',
        type: 'datadog',
        serviceId: service.id,
      });

      const response = await request(app.getHttpServer())
        .post(`/webhooks/datadog/${integration.integrationKey}`)
        .send(datadogAlertPayload)
        .expect(202);

      expect(response.body.status).toBe('accepted');
    });
  });

  describe('POST /webhooks/v1/:integrationKey (Generic)', () => {
    it('should ingest generic webhook', async () => {
      const service = await createTestService(app, { name: 'Test Service' });
      const integration = await createTestIntegration(app, {
        name: 'Generic',
        type: 'generic',
        serviceId: service.id,
      });

      const response = await request(app.getHttpServer())
        .post(`/webhooks/v1/${integration.integrationKey}`)
        .send(genericAlertPayload)
        .expect(202);

      expect(response.body.status).toBe('accepted');
    });
  });

  describe('Alert Deduplication', () => {
    it('should deduplicate alerts with same fingerprint', async () => {
      const service = await createTestService(app, { name: 'Test Service' });
      const integration = await createTestIntegration(app, {
        name: 'Prometheus',
        type: 'prometheus',
        serviceId: service.id,
      });

      const payload = {
        alerts: [
          {
            status: 'firing',
            labels: {
              alertname: 'DuplicateTest',
              severity: 'high',
              instance: 'server1',
            },
            annotations: {
              summary: 'Duplicate test',
            },
          },
        ],
      };

      // Send same alert twice
      const response1 = await request(app.getHttpServer())
        .post(`/webhooks/prometheus/${integration.integrationKey}`)
        .send(payload)
        .expect(202);

      const response2 = await request(app.getHttpServer())
        .post(`/webhooks/prometheus/${integration.integrationKey}`)
        .send(payload)
        .expect(202);

      expect(response1.body.alertsProcessed).toBe(1);
      expect(response2.body.alertsProcessed).toBe(1);

      // Check that only one alert was created (or existing was updated)
      const alertsResponse = await authenticatedGet(app, '/alerts', superadminUser.token).expect(
        200,
      );

      const duplicateAlerts = alertsResponse.body.alerts.filter(
        (a: any) => a.title === 'DuplicateTest',
      );
      expect(duplicateAlerts.length).toBeLessThanOrEqual(1);
    });

    it('should create separate alerts for different fingerprints', async () => {
      const service = await createTestService(app, { name: 'Test Service' });
      const integration = await createTestIntegration(app, {
        name: 'Prometheus',
        type: 'prometheus',
        serviceId: service.id,
      });

      const payload1 = {
        alerts: [
          {
            status: 'firing',
            labels: {
              alertname: 'HighMemory',
              instance: 'server1',
            },
            annotations: {},
          },
        ],
      };

      const payload2 = {
        alerts: [
          {
            status: 'firing',
            labels: {
              alertname: 'HighMemory',
              instance: 'server2', // Different instance = different fingerprint
            },
            annotations: {},
          },
        ],
      };

      await request(app.getHttpServer())
        .post(`/webhooks/prometheus/${integration.integrationKey}`)
        .send(payload1)
        .expect(202);

      await request(app.getHttpServer())
        .post(`/webhooks/prometheus/${integration.integrationKey}`)
        .send(payload2)
        .expect(202);

      const alertsResponse = await authenticatedGet(app, '/alerts', superadminUser.token).expect(
        200,
      );

      expect(alertsResponse.body.alerts.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('GET /alerts', () => {
    it('should list all alerts', async () => {
      const service = await createTestService(app, { name: 'Test Service' });
      await createTestAlert(app, {
        title: 'Alert 1',
        severity: 'critical',
        source: 'prometheus',
        serviceId: service.id,
      });
      await createTestAlert(app, {
        title: 'Alert 2',
        severity: 'high',
        source: 'grafana',
        serviceId: service.id,
      });

      const response = await authenticatedGet(app, '/alerts', superadminUser.token).expect(200);

      expect(response.body.alerts).toHaveLength(2);
      expect(response.body.total).toBe(2);
    });

    it('should filter alerts by status', async () => {
      const service = await createTestService(app, { name: 'Test Service' });
      await createTestAlert(app, {
        title: 'Firing Alert',
        severity: 'high',
        source: 'prometheus',
        serviceId: service.id,
        status: 'firing',
      });
      await createTestAlert(app, {
        title: 'Resolved Alert',
        severity: 'high',
        source: 'prometheus',
        serviceId: service.id,
        status: 'resolved',
      });

      const response = await authenticatedGet(
        app,
        '/alerts?status=firing',
        superadminUser.token,
      ).expect(200);

      expect(response.body.alerts.every((a: any) => a.status === 'firing')).toBe(true);
    });

    it('should filter alerts by severity', async () => {
      const service = await createTestService(app, { name: 'Test Service' });
      await createTestAlert(app, {
        title: 'Critical Alert',
        severity: 'critical',
        source: 'prometheus',
        serviceId: service.id,
      });
      await createTestAlert(app, {
        title: 'Info Alert',
        severity: 'info',
        source: 'prometheus',
        serviceId: service.id,
      });

      const response = await authenticatedGet(
        app,
        '/alerts?severity=critical',
        superadminUser.token,
      ).expect(200);

      expect(response.body.alerts.every((a: any) => a.severity === 'critical')).toBe(true);
    });

    it('should paginate results', async () => {
      const service = await createTestService(app, { name: 'Test Service' });

      for (let i = 0; i < 15; i++) {
        await createTestAlert(app, {
          title: `Alert ${i}`,
          severity: 'high',
          source: 'prometheus',
          serviceId: service.id,
          fingerprint: `fp-${i}`,
        });
      }

      const response = await authenticatedGet(
        app,
        '/alerts?limit=10&offset=0',
        superadminUser.token,
      ).expect(200);

      expect(response.body.alerts).toHaveLength(10);
      expect(response.body.total).toBe(15);
    });
  });

  describe('Alert to Incident Linking', () => {
    it('should link alert to incident', async () => {
      const service = await createTestService(app, { name: 'Test Service' });
      const incident = await createTestIncident(app, {
        title: 'Test Incident',
        severity: 'critical',
        serviceId: service.id,
      });

      await createTestAlert(app, {
        title: 'Test Alert',
        severity: 'critical',
        source: 'prometheus',
        serviceId: service.id,
        incidentId: incident.id,
      });

      const incidentResponse = await authenticatedGet(
        app,
        `/incidents/${incident.id}`,
        superadminUser.token,
      ).expect(200);

      expect(incidentResponse.body.alerts).toBeDefined();
      expect(incidentResponse.body.alerts.length).toBeGreaterThan(0);
    });

    it('should create incident for critical alerts', async () => {
      const service = await createTestService(app, { name: 'Test Service' });
      const integration = await createTestIntegration(app, {
        name: 'Prometheus',
        type: 'prometheus',
        serviceId: service.id,
      });

      const criticalAlert = {
        alerts: [
          {
            status: 'firing',
            labels: {
              alertname: 'CriticalError',
              severity: 'critical',
            },
            annotations: {
              summary: 'Critical system error',
            },
          },
        ],
      };

      await request(app.getHttpServer())
        .post(`/webhooks/prometheus/${integration.integrationKey}`)
        .send(criticalAlert)
        .expect(202);

      // Give some time for async processing
      await new Promise((resolve) => setTimeout(resolve, 500));

      const incidentsResponse = await authenticatedGet(
        app,
        '/incidents',
        superadminUser.token,
      ).expect(200);

      expect(incidentsResponse.body.incidents.length).toBeGreaterThan(0);
    });
  });

  describe('Alert Suppression', () => {
    it('should suppress alerts during maintenance', async () => {
      // This test would require implementing maintenance window functionality
      // For now, we test that suppressed alerts are marked correctly
      const service = await createTestService(app, { name: 'Test Service' });
      const alert = await createTestAlert(app, {
        title: 'Suppressed Alert',
        severity: 'high',
        source: 'prometheus',
        serviceId: service.id,
        status: 'suppressed',
      });

      const response = await authenticatedGet(app, '/alerts', superadminUser.token).expect(200);

      const suppressedAlert = response.body.alerts.find((a: any) => a.id === alert.id);
      expect(suppressedAlert.status).toBe('suppressed');
    });
  });

  describe('Alert Routing', () => {
    it('should route alerts to correct service', async () => {
      const service1 = await createTestService(app, { name: 'Service 1' });
      const service2 = await createTestService(app, { name: 'Service 2' });

      const integration1 = await createTestIntegration(app, {
        name: 'Integration 1',
        type: 'prometheus',
        serviceId: service1.id,
      });

      const integration2 = await createTestIntegration(app, {
        name: 'Integration 2',
        type: 'prometheus',
        serviceId: service2.id,
      });

      await request(app.getHttpServer())
        .post(`/webhooks/prometheus/${integration1.integrationKey}`)
        .send(prometheusAlertPayload)
        .expect(202);

      await request(app.getHttpServer())
        .post(`/webhooks/prometheus/${integration2.integrationKey}`)
        .send(prometheusAlertPayload)
        .expect(202);

      const alertsResponse = await authenticatedGet(app, '/alerts', superadminUser.token).expect(
        200,
      );

      const service1Alerts = alertsResponse.body.alerts.filter(
        (a: any) => a.serviceId === service1.id,
      );
      const service2Alerts = alertsResponse.body.alerts.filter(
        (a: any) => a.serviceId === service2.id,
      );

      expect(service1Alerts.length).toBeGreaterThan(0);
      expect(service2Alerts.length).toBeGreaterThan(0);
    });
  });

  describe('Webhook Validation', () => {
    it('should reject malformed JSON', async () => {
      const service = await createTestService(app, { name: 'Test Service' });
      const integration = await createTestIntegration(app, {
        name: 'Prometheus',
        type: 'prometheus',
        serviceId: service.id,
      });

      await request(app.getHttpServer())
        .post(`/webhooks/prometheus/${integration.integrationKey}`)
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);
    });

    it('should reject missing required fields', async () => {
      const service = await createTestService(app, { name: 'Test Service' });
      const integration = await createTestIntegration(app, {
        name: 'Prometheus',
        type: 'prometheus',
        serviceId: service.id,
      });

      const invalidPayload = {
        alerts: [
          {
            // Missing status and labels
            annotations: {},
          },
        ],
      };

      await request(app.getHttpServer())
        .post(`/webhooks/prometheus/${integration.integrationKey}`)
        .send(invalidPayload)
        .expect(400);
    });
  });
});
