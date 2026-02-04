import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { initializeTestApp, closeTestApp, cleanupDatabase } from './setup';
import {
  createAuthenticatedUser,
  authenticatedGet,
  authenticatedPost,
  authenticatedPatch,
  authenticatedDelete,
  TestUser,
} from './helpers/auth.helper';
import { createTestStatusPage, createTestService } from './helpers/database.helper';
import { testUsers } from './helpers/fixtures';

describe('Status Pages Integration Tests', () => {
  let app: INestApplication;
  let superadminUser: TestUser;
  let observerUser: TestUser;

  beforeAll(async () => {
    app = await initializeTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  beforeEach(async () => {
    await cleanupDatabase();
    superadminUser = await createAuthenticatedUser(app, testUsers.superadmin);
    observerUser = await createAuthenticatedUser(app, testUsers.observer);
  });

  describe('POST /status-pages', () => {
    it('should create status page', async () => {
      const response = await authenticatedPost(app, '/status-pages', superadminUser.token, {
        name: 'Public Status',
        slug: 'status',
        description: 'System status page',
        isPublic: true,
      }).expect(201);

      expect(response.body).toMatchObject({
        name: 'Public Status',
        slug: 'status',
        isPublic: true,
      });
    });

    it('should reject duplicate slug', async () => {
      await createTestStatusPage(app, { name: 'Page 1', slug: 'status' });

      const response = await authenticatedPost(app, '/status-pages', superadminUser.token, {
        name: 'Page 2',
        slug: 'status',
      }).expect(409);

      expect(response.body.message).toContain('slug');
    });

    it('should not allow observer to create', async () => {
      await authenticatedPost(app, '/status-pages', observerUser.token, {
        name: 'Test',
        slug: 'test',
      }).expect(403);
    });
  });

  describe('GET /status-pages', () => {
    it('should list all status pages', async () => {
      await createTestStatusPage(app, { name: 'Page 1', slug: 'page-1' });
      await createTestStatusPage(app, { name: 'Page 2', slug: 'page-2' });

      const response = await authenticatedGet(
        app,
        '/status-pages',
        superadminUser.token,
      ).expect(200);

      expect(response.body).toHaveLength(2);
    });
  });

  describe('GET /status-pages/:slug (Public Access)', () => {
    it('should allow public access without authentication', async () => {
      const statusPage = await createTestStatusPage(app, {
        name: 'Public Status',
        slug: 'public',
        isPublic: true,
      });

      const response = await request(app.getHttpServer())
        .get(`/status-pages/${statusPage.slug}`)
        .expect(200);

      expect(response.body.name).toBe('Public Status');
    });

    it('should deny access to private status page without auth', async () => {
      const statusPage = await createTestStatusPage(app, {
        name: 'Private Status',
        slug: 'private',
        isPublic: false,
      });

      await request(app.getHttpServer()).get(`/status-pages/${statusPage.slug}`).expect(403);
    });

    it('should allow authenticated access to private status page', async () => {
      const statusPage = await createTestStatusPage(app, {
        name: 'Private Status',
        slug: 'private',
        isPublic: false,
      });

      const response = await authenticatedGet(
        app,
        `/status-pages/${statusPage.slug}`,
        superadminUser.token,
      ).expect(200);

      expect(response.body.name).toBe('Private Status');
    });
  });

  describe('PATCH /status-pages/:id', () => {
    it('should update status page', async () => {
      const statusPage = await createTestStatusPage(app, {
        name: 'Old Name',
        slug: 'old',
      });

      const response = await authenticatedPatch(
        app,
        `/status-pages/${statusPage.id}`,
        superadminUser.token,
        {
          name: 'New Name',
          description: 'Updated description',
        },
      ).expect(200);

      expect(response.body).toMatchObject({
        name: 'New Name',
        description: 'Updated description',
      });
    });
  });

  describe('DELETE /status-pages/:id', () => {
    it('should delete status page', async () => {
      const statusPage = await createTestStatusPage(app, {
        name: 'To Delete',
        slug: 'delete',
      });

      await authenticatedDelete(
        app,
        `/status-pages/${statusPage.id}`,
        superadminUser.token,
      ).expect(200);
    });
  });

  describe('POST /status-pages/:id/services', () => {
    it('should add service to status page', async () => {
      const statusPage = await createTestStatusPage(app, {
        name: 'Status',
        slug: 'status',
      });
      const service = await createTestService(app, { name: 'API' });

      const response = await authenticatedPost(
        app,
        `/status-pages/${statusPage.id}/services`,
        superadminUser.token,
        {
          serviceId: service.id,
        },
      ).expect(201);

      expect(response.body).toMatchObject({
        statusPageId: statusPage.id,
        serviceId: service.id,
      });
    });

    it('should prevent duplicate service', async () => {
      const statusPage = await createTestStatusPage(app, {
        name: 'Status',
        slug: 'status',
      });
      const service = await createTestService(app, { name: 'API' });

      await authenticatedPost(app, `/status-pages/${statusPage.id}/services`, superadminUser.token, {
        serviceId: service.id,
      }).expect(201);

      const response = await authenticatedPost(
        app,
        `/status-pages/${statusPage.id}/services`,
        superadminUser.token,
        {
          serviceId: service.id,
        },
      ).expect(409);

      expect(response.body.message).toContain('already added');
    });
  });

  describe('GET /status-pages/:slug/services', () => {
    it('should list services on status page', async () => {
      const statusPage = await createTestStatusPage(app, {
        name: 'Status',
        slug: 'status',
        isPublic: true,
      });
      const service1 = await createTestService(app, { name: 'API' });
      const service2 = await createTestService(app, { name: 'Database' });

      await authenticatedPost(app, `/status-pages/${statusPage.id}/services`, superadminUser.token, {
        serviceId: service1.id,
      });
      await authenticatedPost(app, `/status-pages/${statusPage.id}/services`, superadminUser.token, {
        serviceId: service2.id,
      });

      const response = await request(app.getHttpServer())
        .get(`/status-pages/${statusPage.slug}/services`)
        .expect(200);

      expect(response.body).toHaveLength(2);
    });

    it('should show service status on public page', async () => {
      const statusPage = await createTestStatusPage(app, {
        name: 'Status',
        slug: 'status',
        isPublic: true,
      });
      const service = await createTestService(app, {
        name: 'API',
        status: 'operational',
      });

      await authenticatedPost(app, `/status-pages/${statusPage.id}/services`, superadminUser.token, {
        serviceId: service.id,
      });

      const response = await request(app.getHttpServer())
        .get(`/status-pages/${statusPage.slug}/services`)
        .expect(200);

      expect(response.body[0].status).toBe('operational');
    });
  });

  describe('Custom Branding', () => {
    it('should set custom branding', async () => {
      const statusPage = await createTestStatusPage(app, {
        name: 'Status',
        slug: 'status',
      });

      const response = await authenticatedPatch(
        app,
        `/status-pages/${statusPage.id}`,
        superadminUser.token,
        {
          branding: {
            primaryColor: '#007bff',
            logo: 'https://example.com/logo.png',
            favicon: 'https://example.com/favicon.ico',
          },
        },
      ).expect(200);

      expect(response.body.branding).toMatchObject({
        primaryColor: '#007bff',
      });
    });
  });

  describe('Status Page Updates', () => {
    it('should post incident update to status page', async () => {
      const statusPage = await createTestStatusPage(app, {
        name: 'Status',
        slug: 'status',
        isPublic: true,
      });

      const response = await authenticatedPost(
        app,
        `/status-pages/${statusPage.id}/incidents`,
        superadminUser.token,
        {
          title: 'API Degradation',
          description: 'Experiencing slower response times',
          status: 'investigating',
          impact: 'minor',
        },
      ).expect(201);

      expect(response.body).toMatchObject({
        title: 'API Degradation',
        status: 'investigating',
      });
    });

    it('should update status page incident', async () => {
      const statusPage = await createTestStatusPage(app, {
        name: 'Status',
        slug: 'status',
        isPublic: true,
      });

      const incident = await authenticatedPost(
        app,
        `/status-pages/${statusPage.id}/incidents`,
        superadminUser.token,
        {
          title: 'Issue',
          description: 'Problem detected',
          status: 'investigating',
        },
      ).then((res) => res.body);

      const response = await authenticatedPatch(
        app,
        `/status-pages/${statusPage.id}/incidents/${incident.id}`,
        superadminUser.token,
        {
          status: 'resolved',
          description: 'Issue has been resolved',
        },
      ).expect(200);

      expect(response.body.status).toBe('resolved');
    });

    it('should list status page incidents publicly', async () => {
      const statusPage = await createTestStatusPage(app, {
        name: 'Status',
        slug: 'status',
        isPublic: true,
      });

      await authenticatedPost(app, `/status-pages/${statusPage.id}/incidents`, superadminUser.token, {
        title: 'Incident 1',
        description: 'First incident',
        status: 'investigating',
      });

      const response = await request(app.getHttpServer())
        .get(`/status-pages/${statusPage.slug}/incidents`)
        .expect(200);

      expect(response.body.length).toBeGreaterThan(0);
    });
  });
});
