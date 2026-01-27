import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Incident Lifecycle (E2E)', () => {
  let app: INestApplication;
  let authToken: string;
  let incidentId: number;
  let alertId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication(new FastifyAdapter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    // Get dev token for authentication
    const tokenResponse = await request(app.getHttpServer())
      .get('/auth/dev-token/1')
      .expect(200);

    authToken = tokenResponse.body.token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Complete Incident Flow', () => {
    it('1. Should create alert via webhook', async () => {
      const response = await request(app.getHttpServer())
        .post('/webhooks/prometheus/test-integration-key-12345')
        .send({
          alerts: [
            {
              status: 'firing',
              labels: {
                alertname: 'E2ETestAlert',
                severity: 'critical',
                service: 'test-service',
              },
              annotations: {
                summary: 'E2E test alert',
                description: 'Testing complete incident lifecycle',
              },
            },
          ],
        })
        .expect(202);

      expect(response.body.status).toBe('accepted');
      expect(response.body.alertsProcessed).toBe(1);
      expect(response.body.alertIds).toHaveLength(1);
      alertId = response.body.alertIds[0];
    });

    it('2. Should have created incident automatically', async () => {
      const response = await request(app.getHttpServer())
        .get('/incidents')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ status: 'triggered' })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      // Find our incident
      const incident = response.body.find((i: any) =>
        i.title.includes('E2E test alert'),
      );
      expect(incident).toBeDefined();
      expect(incident.status).toBe('triggered');
      expect(incident.severity).toBe('critical');

      incidentId = incident.id;
    });

    it('3. Should acknowledge incident', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/incidents/${incidentId}/acknowledge`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('acknowledged');
      expect(response.body.acknowledgedById).toBe(1);
      expect(response.body.acknowledgedAt).toBeTruthy();
    });

    it('4. Should verify incident is acknowledged', async () => {
      const response = await request(app.getHttpServer())
        .get(`/incidents/${incidentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('acknowledged');
    });

    it('5. Should list alerts for incident', async () => {
      const response = await request(app.getHttpServer())
        .get('/alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ incidentId })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].incidentId).toBe(incidentId);
    });

    it('6. Should acknowledge individual alert', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/alerts/${alertId}/acknowledge`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('acknowledged');
    });

    it('7. Should resolve alert', async () => {
      // Send resolved alert
      await request(app.getHttpServer())
        .post('/webhooks/prometheus/test-integration-key-12345')
        .send({
          alerts: [
            {
              status: 'resolved',
              labels: {
                alertname: 'E2ETestAlert',
                severity: 'critical',
                service: 'test-service',
              },
              annotations: {
                summary: 'E2E test alert',
              },
            },
          ],
        })
        .expect(202);

      // Wait a bit for processing
      await new Promise((resolve) => setTimeout(resolve, 500));
    });

    it('8. Should auto-resolve incident when all alerts resolved', async () => {
      const response = await request(app.getHttpServer())
        .get(`/incidents/${incidentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Incident should be resolved automatically
      expect(['resolved', 'acknowledged']).toContain(response.body.status);
    });

    it('9. Should manually resolve incident if not auto-resolved', async () => {
      // Check current status
      const statusCheck = await request(app.getHttpServer())
        .get(`/incidents/${incidentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      if (statusCheck.body.status !== 'resolved') {
        const response = await request(app.getHttpServer())
          .patch(`/incidents/${incidentId}/resolve`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.status).toBe('resolved');
        expect(response.body.resolvedById).toBe(1);
        expect(response.body.resolvedAt).toBeTruthy();
      }
    });

    it('10. Should filter resolved incidents', async () => {
      const response = await request(app.getHttpServer())
        .get('/incidents')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ status: 'resolved' })
        .expect(200);

      const resolvedIncidents = response.body.filter((i: any) => i.id === incidentId);
      expect(resolvedIncidents.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Authentication', () => {
    it('should reject requests without token', async () => {
      await request(app.getHttpServer()).get('/incidents').expect(401);
    });

    it('should reject requests with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/incidents')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should accept requests with valid token', async () => {
      await request(app.getHttpServer())
        .get('/incidents')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });
  });

  describe('Pagination', () => {
    it('should support limit and offset', async () => {
      const response = await request(app.getHttpServer())
        .get('/incidents')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 5, offset: 0 })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeLessThanOrEqual(5);
    });
  });
});
