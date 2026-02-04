import { INestApplication } from '@nestjs/common';
import { initializeTestApp, closeTestApp, cleanupDatabase } from './setup';
import {
  createAuthenticatedUser,
  authenticatedGet,
  authenticatedPost,
  authenticatedPatch,
  authenticatedDelete,
  TestUser,
} from './helpers/auth.helper';
import { createTestTeam, createTestService, addUserToTeam } from './helpers/database.helper';
import { testUsers } from './helpers/fixtures';

describe('Services Integration Tests', () => {
  let app: INestApplication;
  let superadminUser: TestUser;
  let responderUser: TestUser;
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
    responderUser = await createAuthenticatedUser(app, testUsers.responder);
    observerUser = await createAuthenticatedUser(app, testUsers.observer);
  });

  describe('POST /services', () => {
    it('should create service as admin', async () => {
      const team = await createTestTeam(app, { name: 'Engineering', slug: 'engineering' });

      const response = await authenticatedPost(app, '/services', superadminUser.token, {
        name: 'API Service',
        description: 'Main API',
        teamId: team.id,
      }).expect(201);

      expect(response.body).toMatchObject({
        name: 'API Service',
        description: 'Main API',
        teamId: team.id,
      });
    });

    it('should reject service creation by observer', async () => {
      await authenticatedPost(app, '/services', observerUser.token, {
        name: 'Test Service',
      }).expect(403);
    });

    it('should set default status to operational', async () => {
      const response = await authenticatedPost(app, '/services', superadminUser.token, {
        name: 'Test Service',
      }).expect(201);

      expect(response.body.status).toBe('operational');
    });
  });

  describe('GET /services', () => {
    it('should list all services', async () => {
      await createTestService(app, { name: 'Service 1' });
      await createTestService(app, { name: 'Service 2' });

      const response = await authenticatedGet(app, '/services', superadminUser.token).expect(200);

      expect(response.body).toHaveLength(2);
    });

    it('should filter by status', async () => {
      await createTestService(app, { name: 'Healthy', status: 'operational' });
      await createTestService(app, { name: 'Down', status: 'outage' });

      const response = await authenticatedGet(
        app,
        '/services?status=operational',
        superadminUser.token,
      ).expect(200);

      expect(response.body.every((s: any) => s.status === 'operational')).toBe(true);
    });
  });

  describe('GET /services/:id', () => {
    it('should get service details', async () => {
      const service = await createTestService(app, { name: 'Test Service' });

      const response = await authenticatedGet(
        app,
        `/services/${service.id}`,
        superadminUser.token,
      ).expect(200);

      expect(response.body.id).toBe(service.id);
    });

    it('should return 404 for non-existent service', async () => {
      await authenticatedGet(app, '/services/99999', superadminUser.token).expect(404);
    });
  });

  describe('PATCH /services/:id', () => {
    it('should update service', async () => {
      const service = await createTestService(app, { name: 'Old Name' });

      const response = await authenticatedPatch(
        app,
        `/services/${service.id}`,
        superadminUser.token,
        {
          name: 'New Name',
          status: 'degraded',
        },
      ).expect(200);

      expect(response.body).toMatchObject({
        name: 'New Name',
        status: 'degraded',
      });
    });

    it('should not allow observer to update', async () => {
      const service = await createTestService(app, { name: 'Test' });

      await authenticatedPatch(app, `/services/${service.id}`, observerUser.token, {
        name: 'Should Fail',
      }).expect(403);
    });
  });

  describe('DELETE /services/:id', () => {
    it('should delete service', async () => {
      const service = await createTestService(app, { name: 'To Delete' });

      await authenticatedDelete(app, `/services/${service.id}`, superadminUser.token).expect(200);
      await authenticatedGet(app, `/services/${service.id}`, superadminUser.token).expect(404);
    });
  });

  describe('Service Dependencies', () => {
    it('should add service dependency', async () => {
      const service1 = await createTestService(app, { name: 'API' });
      const service2 = await createTestService(app, { name: 'Database' });

      const response = await authenticatedPost(
        app,
        `/services/${service1.id}/dependencies`,
        superadminUser.token,
        {
          dependsOnServiceId: service2.id,
        },
      ).expect(201);

      expect(response.body).toMatchObject({
        serviceId: service1.id,
        dependsOnServiceId: service2.id,
      });
    });

    it('should prevent circular dependencies', async () => {
      const service1 = await createTestService(app, { name: 'Service 1' });
      const service2 = await createTestService(app, { name: 'Service 2' });

      // Create dependency: service1 -> service2
      await authenticatedPost(
        app,
        `/services/${service1.id}/dependencies`,
        superadminUser.token,
        { dependsOnServiceId: service2.id },
      ).expect(201);

      // Try to create circular dependency: service2 -> service1
      const response = await authenticatedPost(
        app,
        `/services/${service2.id}/dependencies`,
        superadminUser.token,
        { dependsOnServiceId: service1.id },
      ).expect(400);

      expect(response.body.message).toContain('circular');
    });
  });
});
