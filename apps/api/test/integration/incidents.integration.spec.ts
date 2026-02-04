import { INestApplication } from '@nestjs/common';
import { initializeTestApp, closeTestApp, cleanupDatabase } from './setup';
import {
  createAuthenticatedUser,
  authenticatedGet,
  authenticatedPost,
  authenticatedPatch,
  TestUser,
} from './helpers/auth.helper';
import {
  createTestTeam,
  createTestService,
  createTestIncident,
  createTestAlert,
  addUserToTeam,
} from './helpers/database.helper';
import { testUsers } from './helpers/fixtures';

describe('Incidents Integration Tests', () => {
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

  describe('GET /incidents', () => {
    it('should list all incidents', async () => {
      // Create test incidents
      const service = await createTestService(app, { name: 'Test Service' });
      await createTestIncident(app, {
        title: 'Test Incident 1',
        severity: 'critical',
        serviceId: service.id,
      });
      await createTestIncident(app, {
        title: 'Test Incident 2',
        severity: 'high',
        serviceId: service.id,
      });

      const response = await authenticatedGet(app, '/incidents', superadminUser.token).expect(200);

      expect(response.body.incidents).toHaveLength(2);
      expect(response.body.total).toBe(2);
    });

    it('should filter incidents by status', async () => {
      const service = await createTestService(app, { name: 'Test Service' });
      await createTestIncident(app, {
        title: 'Triggered Incident',
        severity: 'high',
        serviceId: service.id,
        status: 'triggered',
      });
      await createTestIncident(app, {
        title: 'Resolved Incident',
        severity: 'high',
        serviceId: service.id,
        status: 'resolved',
      });

      const response = await authenticatedGet(
        app,
        '/incidents?status=triggered',
        superadminUser.token,
      ).expect(200);

      expect(response.body.incidents).toHaveLength(1);
      expect(response.body.incidents[0].title).toBe('Triggered Incident');
    });

    it('should filter incidents by severity', async () => {
      const service = await createTestService(app, { name: 'Test Service' });
      await createTestIncident(app, {
        title: 'Critical Incident',
        severity: 'critical',
        serviceId: service.id,
      });
      await createTestIncident(app, {
        title: 'Low Incident',
        severity: 'low',
        serviceId: service.id,
      });

      const response = await authenticatedGet(
        app,
        '/incidents?severity=critical',
        superadminUser.token,
      ).expect(200);

      expect(response.body.incidents).toHaveLength(1);
      expect(response.body.incidents[0].severity).toBe('critical');
    });

    it('should filter incidents by service', async () => {
      const service1 = await createTestService(app, { name: 'Service 1' });
      const service2 = await createTestService(app, { name: 'Service 2' });

      await createTestIncident(app, {
        title: 'Service 1 Incident',
        severity: 'high',
        serviceId: service1.id,
      });
      await createTestIncident(app, {
        title: 'Service 2 Incident',
        severity: 'high',
        serviceId: service2.id,
      });

      const response = await authenticatedGet(
        app,
        `/incidents?serviceId=${service1.id}`,
        superadminUser.token,
      ).expect(200);

      expect(response.body.incidents).toHaveLength(1);
      expect(response.body.incidents[0].serviceId).toBe(service1.id);
    });

    it('should paginate results', async () => {
      const service = await createTestService(app, { name: 'Test Service' });

      // Create multiple incidents
      for (let i = 0; i < 15; i++) {
        await createTestIncident(app, {
          title: `Incident ${i}`,
          severity: 'high',
          serviceId: service.id,
        });
      }

      const response = await authenticatedGet(
        app,
        '/incidents?limit=10&offset=0',
        superadminUser.token,
      ).expect(200);

      expect(response.body.incidents).toHaveLength(10);
      expect(response.body.total).toBe(15);
    });

    it('should search incidents by title', async () => {
      const service = await createTestService(app, { name: 'Test Service' });
      await createTestIncident(app, {
        title: 'Database Connection Error',
        severity: 'critical',
        serviceId: service.id,
      });
      await createTestIncident(app, {
        title: 'API Timeout',
        severity: 'high',
        serviceId: service.id,
      });

      const response = await authenticatedGet(
        app,
        '/incidents?search=Database',
        superadminUser.token,
      ).expect(200);

      expect(response.body.incidents).toHaveLength(1);
      expect(response.body.incidents[0].title).toContain('Database');
    });

    it('should require authentication', async () => {
      await authenticatedGet(app, '/incidents', 'invalid-token').expect(401);
    });
  });

  describe('GET /incidents/:id', () => {
    it('should get incident details', async () => {
      const service = await createTestService(app, { name: 'Test Service' });
      const incident = await createTestIncident(app, {
        title: 'Test Incident',
        severity: 'critical',
        serviceId: service.id,
      });

      const response = await authenticatedGet(
        app,
        `/incidents/${incident.id}`,
        superadminUser.token,
      ).expect(200);

      expect(response.body).toMatchObject({
        id: incident.id,
        title: 'Test Incident',
        severity: 'critical',
      });
    });

    it('should return 404 for non-existent incident', async () => {
      await authenticatedGet(app, '/incidents/99999', superadminUser.token).expect(404);
    });

    it('should include related alerts', async () => {
      const service = await createTestService(app, { name: 'Test Service' });
      const incident = await createTestIncident(app, {
        title: 'Test Incident',
        severity: 'critical',
        serviceId: service.id,
      });

      await createTestAlert(app, {
        title: 'Alert 1',
        severity: 'critical',
        source: 'prometheus',
        serviceId: service.id,
        incidentId: incident.id,
      });

      const response = await authenticatedGet(
        app,
        `/incidents/${incident.id}`,
        superadminUser.token,
      ).expect(200);

      expect(response.body.alerts).toBeDefined();
      expect(Array.isArray(response.body.alerts)).toBe(true);
    });
  });

  describe('PATCH /incidents/:id/acknowledge', () => {
    it('should acknowledge an incident as responder', async () => {
      const service = await createTestService(app, { name: 'Test Service' });
      const incident = await createTestIncident(app, {
        title: 'Test Incident',
        severity: 'critical',
        serviceId: service.id,
        status: 'triggered',
      });

      const response = await authenticatedPatch(
        app,
        `/incidents/${incident.id}/acknowledge`,
        responderUser.token,
        {},
      ).expect(200);

      expect(response.body.status).toBe('acknowledged');
      expect(response.body.acknowledgedBy).toBe(responderUser.id);
      expect(response.body.acknowledgedAt).toBeDefined();
    });

    it('should not allow observer to acknowledge incident', async () => {
      const service = await createTestService(app, { name: 'Test Service' });
      const incident = await createTestIncident(app, {
        title: 'Test Incident',
        severity: 'critical',
        serviceId: service.id,
        status: 'triggered',
      });

      await authenticatedPatch(
        app,
        `/incidents/${incident.id}/acknowledge`,
        observerUser.token,
        {},
      ).expect(403);
    });

    it('should not acknowledge already acknowledged incident', async () => {
      const service = await createTestService(app, { name: 'Test Service' });
      const incident = await createTestIncident(app, {
        title: 'Test Incident',
        severity: 'critical',
        serviceId: service.id,
        status: 'acknowledged',
      });

      const response = await authenticatedPatch(
        app,
        `/incidents/${incident.id}/acknowledge`,
        responderUser.token,
        {},
      ).expect(400);

      expect(response.body.message).toContain('already acknowledged');
    });

    it('should create incident log on acknowledgement', async () => {
      const service = await createTestService(app, { name: 'Test Service' });
      const incident = await createTestIncident(app, {
        title: 'Test Incident',
        severity: 'critical',
        serviceId: service.id,
        status: 'triggered',
      });

      await authenticatedPatch(
        app,
        `/incidents/${incident.id}/acknowledge`,
        responderUser.token,
        {},
      ).expect(200);

      const detailResponse = await authenticatedGet(
        app,
        `/incidents/${incident.id}`,
        responderUser.token,
      ).expect(200);

      expect(detailResponse.body.logs).toBeDefined();
      expect(detailResponse.body.logs.some((log: any) => log.action === 'acknowledged')).toBe(true);
    });
  });

  describe('PATCH /incidents/:id/resolve', () => {
    it('should resolve an incident as responder', async () => {
      const service = await createTestService(app, { name: 'Test Service' });
      const incident = await createTestIncident(app, {
        title: 'Test Incident',
        severity: 'critical',
        serviceId: service.id,
        status: 'acknowledged',
      });

      const response = await authenticatedPatch(
        app,
        `/incidents/${incident.id}/resolve`,
        responderUser.token,
        {},
      ).expect(200);

      expect(response.body.status).toBe('resolved');
      expect(response.body.resolvedBy).toBe(responderUser.id);
      expect(response.body.resolvedAt).toBeDefined();
    });

    it('should allow resolving triggered incident directly', async () => {
      const service = await createTestService(app, { name: 'Test Service' });
      const incident = await createTestIncident(app, {
        title: 'Test Incident',
        severity: 'critical',
        serviceId: service.id,
        status: 'triggered',
      });

      const response = await authenticatedPatch(
        app,
        `/incidents/${incident.id}/resolve`,
        responderUser.token,
        {},
      ).expect(200);

      expect(response.body.status).toBe('resolved');
    });

    it('should not allow observer to resolve incident', async () => {
      const service = await createTestService(app, { name: 'Test Service' });
      const incident = await createTestIncident(app, {
        title: 'Test Incident',
        severity: 'critical',
        serviceId: service.id,
        status: 'acknowledged',
      });

      await authenticatedPatch(
        app,
        `/incidents/${incident.id}/resolve`,
        observerUser.token,
        {},
      ).expect(403);
    });

    it('should not resolve already resolved incident', async () => {
      const service = await createTestService(app, { name: 'Test Service' });
      const incident = await createTestIncident(app, {
        title: 'Test Incident',
        severity: 'critical',
        serviceId: service.id,
        status: 'resolved',
      });

      const response = await authenticatedPatch(
        app,
        `/incidents/${incident.id}/resolve`,
        responderUser.token,
        {},
      ).expect(400);

      expect(response.body.message).toContain('already resolved');
    });
  });

  describe('POST /incidents/bulk/acknowledge', () => {
    it('should bulk acknowledge multiple incidents', async () => {
      const service = await createTestService(app, { name: 'Test Service' });
      const incident1 = await createTestIncident(app, {
        title: 'Incident 1',
        severity: 'high',
        serviceId: service.id,
        status: 'triggered',
      });
      const incident2 = await createTestIncident(app, {
        title: 'Incident 2',
        severity: 'high',
        serviceId: service.id,
        status: 'triggered',
      });

      const response = await authenticatedPost(
        app,
        '/incidents/bulk/acknowledge',
        responderUser.token,
        {
          incidentIds: [incident1.id, incident2.id],
        },
      ).expect(200);

      expect(response.body.acknowledged).toBe(2);
      expect(response.body.failed).toBe(0);
    });

    it('should handle partial failures in bulk acknowledge', async () => {
      const service = await createTestService(app, { name: 'Test Service' });
      const incident1 = await createTestIncident(app, {
        title: 'Incident 1',
        severity: 'high',
        serviceId: service.id,
        status: 'triggered',
      });

      const response = await authenticatedPost(
        app,
        '/incidents/bulk/acknowledge',
        responderUser.token,
        {
          incidentIds: [incident1.id, 99999], // One valid, one invalid
        },
      ).expect(200);

      expect(response.body.acknowledged).toBeGreaterThan(0);
      expect(response.body.failed).toBeGreaterThan(0);
    });
  });

  describe('POST /incidents/bulk/resolve', () => {
    it('should bulk resolve multiple incidents', async () => {
      const service = await createTestService(app, { name: 'Test Service' });
      const incident1 = await createTestIncident(app, {
        title: 'Incident 1',
        severity: 'high',
        serviceId: service.id,
        status: 'acknowledged',
      });
      const incident2 = await createTestIncident(app, {
        title: 'Incident 2',
        severity: 'high',
        serviceId: service.id,
        status: 'acknowledged',
      });

      const response = await authenticatedPost(
        app,
        '/incidents/bulk/resolve',
        responderUser.token,
        {
          incidentIds: [incident1.id, incident2.id],
        },
      ).expect(200);

      expect(response.body.resolved).toBe(2);
      expect(response.body.failed).toBe(0);
    });
  });

  describe('Team-based Access Control', () => {
    it('should allow team member to view incident', async () => {
      const team = await createTestTeam(app, {
        name: 'Team A',
        slug: 'team-a',
      });
      await addUserToTeam(app, team.id, responderUser.id, 'member');

      const service = await createTestService(app, {
        name: 'Test Service',
        teamId: team.id,
      });
      const incident = await createTestIncident(app, {
        title: 'Test Incident',
        severity: 'high',
        serviceId: service.id,
      });

      await authenticatedGet(app, `/incidents/${incident.id}`, responderUser.token).expect(200);
    });

    it('should deny non-team member from viewing incident', async () => {
      const team = await createTestTeam(app, {
        name: 'Team A',
        slug: 'team-a',
      });
      // responderUser is NOT a member of team

      const service = await createTestService(app, {
        name: 'Test Service',
        teamId: team.id,
      });
      const incident = await createTestIncident(app, {
        title: 'Test Incident',
        severity: 'high',
        serviceId: service.id,
      });

      await authenticatedGet(app, `/incidents/${incident.id}`, responderUser.token).expect(403);
    });
  });
});
