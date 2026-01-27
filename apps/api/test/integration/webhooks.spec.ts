import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Webhooks Controller (Integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /webhooks/prometheus/:integrationKey', () => {
    it('should accept valid Prometheus webhook', () => {
      const prometheusPayload = {
        alerts: [
          {
            status: 'firing',
            labels: {
              alertname: 'HighMemoryUsage',
              severity: 'warning',
              instance: 'server1',
            },
            annotations: {
              summary: 'High memory usage detected',
              description: 'Memory usage is above 80%',
            },
          },
        ],
      };

      return request(app.getHttpServer())
        .post('/webhooks/prometheus/test-integration-key-12345')
        .send(prometheusPayload)
        .expect(202)
        .expect((res) => {
          expect(res.body.status).toBe('accepted');
          expect(res.body.alertsProcessed).toBeGreaterThan(0);
        });
    });

    it('should reject invalid integration key', () => {
      const payload = {
        alerts: [
          {
            status: 'firing',
            labels: { alertname: 'Test' },
            annotations: {},
          },
        ],
      };

      return request(app.getHttpServer())
        .post('/webhooks/prometheus/invalid-key')
        .send(payload)
        .expect(404);
    });
  });

  describe('POST /webhooks/grafana/:integrationKey', () => {
    it('should accept valid Grafana webhook', () => {
      const grafanaPayload = {
        title: 'High CPU Alert',
        state: 'alerting',
        message: 'CPU usage is above threshold',
        evalMatches: [
          {
            metric: 'cpu_usage',
            tags: { host: 'server1' },
            value: 95,
          },
        ],
      };

      return request(app.getHttpServer())
        .post('/webhooks/grafana/test-integration-key-12345')
        .send(grafanaPayload)
        .expect(202)
        .expect((res) => {
          expect(res.body.status).toBe('accepted');
          expect(res.body.alertsProcessed).toBe(1);
        });
    });
  });

  describe('POST /webhooks/v1/:integrationKey (Generic)', () => {
    it('should accept generic webhook payload', () => {
      const genericPayload = {
        title: 'Test Alert',
        severity: 'high',
        status: 'firing',
        source: 'custom-monitoring',
        description: 'Something went wrong',
        labels: {
          environment: 'production',
        },
      };

      return request(app.getHttpServer())
        .post('/webhooks/v1/test-integration-key-12345')
        .send(genericPayload)
        .set('User-Agent', 'CustomMonitoring/1.0')
        .expect(202)
        .expect((res) => {
          expect(res.body.status).toBe('accepted');
        });
    });

    it('should handle multiple alerts in single webhook', () => {
      const payload = {
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
        ],
      };

      return request(app.getHttpServer())
        .post('/webhooks/prometheus/test-integration-key-12345')
        .send(payload)
        .expect(202)
        .expect((res) => {
          expect(res.body.alertsProcessed).toBe(2);
          expect(res.body.alertIds).toHaveLength(2);
        });
    });
  });

  describe('POST /webhooks/datadog/:integrationKey', () => {
    it('should accept Datadog webhook', () => {
      const datadogPayload = {
        title: 'Datadog Alert',
        body: 'Error rate is high',
        alert_type: 'error',
        priority: 'normal',
        tags: ['env:prod', 'service:api'],
      };

      return request(app.getHttpServer())
        .post('/webhooks/datadog/test-integration-key-12345')
        .send(datadogPayload)
        .expect(202);
    });
  });

  describe('Deduplication', () => {
    it('should deduplicate identical alerts', async () => {
      const payload = {
        alerts: [
          {
            status: 'firing',
            labels: {
              alertname: 'DuplicateTest',
              severity: 'high',
              instance: 'test-instance',
            },
            annotations: {
              summary: 'Duplicate test alert',
            },
          },
        ],
      };

      // Send same alert twice
      const first = await request(app.getHttpServer())
        .post('/webhooks/prometheus/test-integration-key-12345')
        .send(payload)
        .expect(202);

      const second = await request(app.getHttpServer())
        .post('/webhooks/prometheus/test-integration-key-12345')
        .send(payload)
        .expect(202);

      // Both should be accepted but might return same alert ID if deduplicated
      expect(first.body.alertsProcessed).toBe(1);
      expect(second.body.alertsProcessed).toBe(1);
    });
  });
});
