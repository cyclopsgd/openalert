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
import {
  createTestTeam,
  createTestEscalationPolicy,
  createTestEscalationLevel,
  createTestSchedule,
  addUserToTeam,
} from './helpers/database.helper';
import { testUsers } from './helpers/fixtures';

describe('Escalation Policies Integration Tests', () => {
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

  describe('POST /escalation-policies', () => {
    it('should create escalation policy', async () => {
      const team = await createTestTeam(app, { name: 'Engineering', slug: 'eng' });

      const response = await authenticatedPost(
        app,
        '/escalation-policies',
        superadminUser.token,
        {
          name: 'Primary Escalation',
          teamId: team.id,
          description: 'Standard escalation',
        },
      ).expect(201);

      expect(response.body).toMatchObject({
        name: 'Primary Escalation',
        teamId: team.id,
      });
    });

    it('should not allow observer to create policy', async () => {
      await authenticatedPost(app, '/escalation-policies', observerUser.token, {
        name: 'Test Policy',
      }).expect(403);
    });
  });

  describe('GET /escalation-policies', () => {
    it('should list all policies', async () => {
      await createTestEscalationPolicy(app, { name: 'Policy 1' });
      await createTestEscalationPolicy(app, { name: 'Policy 2' });

      const response = await authenticatedGet(
        app,
        '/escalation-policies',
        superadminUser.token,
      ).expect(200);

      expect(response.body).toHaveLength(2);
    });
  });

  describe('GET /escalation-policies/:id', () => {
    it('should get policy details with levels', async () => {
      const policy = await createTestEscalationPolicy(app, { name: 'Test Policy' });
      await createTestEscalationLevel(app, {
        policyId: policy.id,
        levelNumber: 1,
        delayMinutes: 5,
      });

      const response = await authenticatedGet(
        app,
        `/escalation-policies/${policy.id}`,
        superadminUser.token,
      ).expect(200);

      expect(response.body.id).toBe(policy.id);
      expect(response.body.levels).toBeDefined();
    });
  });

  describe('PATCH /escalation-policies/:id', () => {
    it('should update policy', async () => {
      const policy = await createTestEscalationPolicy(app, { name: 'Old Name' });

      const response = await authenticatedPatch(
        app,
        `/escalation-policies/${policy.id}`,
        superadminUser.token,
        {
          name: 'New Name',
        },
      ).expect(200);

      expect(response.body.name).toBe('New Name');
    });
  });

  describe('DELETE /escalation-policies/:id', () => {
    it('should delete policy', async () => {
      const policy = await createTestEscalationPolicy(app, { name: 'To Delete' });

      await authenticatedDelete(
        app,
        `/escalation-policies/${policy.id}`,
        superadminUser.token,
      ).expect(200);
    });
  });

  describe('POST /escalation-policies/:id/levels', () => {
    it('should add escalation level', async () => {
      const policy = await createTestEscalationPolicy(app, { name: 'Test Policy' });

      const response = await authenticatedPost(
        app,
        `/escalation-policies/${policy.id}/levels`,
        superadminUser.token,
        {
          levelNumber: 1,
          delayMinutes: 5,
        },
      ).expect(201);

      expect(response.body).toMatchObject({
        policyId: policy.id,
        levelNumber: 1,
        delayMinutes: 5,
      });
    });

    it('should validate delay minutes', async () => {
      const policy = await createTestEscalationPolicy(app, { name: 'Test Policy' });

      const response = await authenticatedPost(
        app,
        `/escalation-policies/${policy.id}/levels`,
        superadminUser.token,
        {
          levelNumber: 1,
          delayMinutes: -5, // Invalid
        },
      ).expect(400);

      expect(response.body.message).toContain('delay');
    });

    it('should enforce level ordering', async () => {
      const policy = await createTestEscalationPolicy(app, { name: 'Test Policy' });

      // Create level 1
      await authenticatedPost(app, `/escalation-policies/${policy.id}/levels`, superadminUser.token, {
        levelNumber: 1,
        delayMinutes: 5,
      }).expect(201);

      // Try to create level 3 without level 2
      const response = await authenticatedPost(
        app,
        `/escalation-policies/${policy.id}/levels`,
        superadminUser.token,
        {
          levelNumber: 3,
          delayMinutes: 15,
        },
      ).expect(400);

      expect(response.body.message).toContain('order');
    });
  });

  describe('POST /escalation-policies/:id/levels/:levelId/targets', () => {
    it('should add user target to level', async () => {
      const policy = await createTestEscalationPolicy(app, { name: 'Test Policy' });
      const level = await createTestEscalationLevel(app, {
        policyId: policy.id,
        levelNumber: 1,
        delayMinutes: 5,
      });

      const response = await authenticatedPost(
        app,
        `/escalation-policies/${policy.id}/levels/${level.id}/targets`,
        superadminUser.token,
        {
          targetType: 'user',
          targetId: responderUser.id,
        },
      ).expect(201);

      expect(response.body).toMatchObject({
        levelId: level.id,
        targetType: 'user',
        targetId: responderUser.id,
      });
    });

    it('should add schedule target to level', async () => {
      const policy = await createTestEscalationPolicy(app, { name: 'Test Policy' });
      const level = await createTestEscalationLevel(app, {
        policyId: policy.id,
        levelNumber: 1,
        delayMinutes: 5,
      });
      const schedule = await createTestSchedule(app, { name: 'On-Call' });

      const response = await authenticatedPost(
        app,
        `/escalation-policies/${policy.id}/levels/${level.id}/targets`,
        superadminUser.token,
        {
          targetType: 'schedule',
          targetId: schedule.id,
        },
      ).expect(201);

      expect(response.body.targetType).toBe('schedule');
    });

    it('should add team target to level', async () => {
      const team = await createTestTeam(app, { name: 'Engineering', slug: 'eng' });
      const policy = await createTestEscalationPolicy(app, { name: 'Test Policy' });
      const level = await createTestEscalationLevel(app, {
        policyId: policy.id,
        levelNumber: 1,
        delayMinutes: 5,
      });

      const response = await authenticatedPost(
        app,
        `/escalation-policies/${policy.id}/levels/${level.id}/targets`,
        superadminUser.token,
        {
          targetType: 'team',
          targetId: team.id,
        },
      ).expect(201);

      expect(response.body.targetType).toBe('team');
    });

    it('should validate target type', async () => {
      const policy = await createTestEscalationPolicy(app, { name: 'Test Policy' });
      const level = await createTestEscalationLevel(app, {
        policyId: policy.id,
        levelNumber: 1,
        delayMinutes: 5,
      });

      const response = await authenticatedPost(
        app,
        `/escalation-policies/${policy.id}/levels/${level.id}/targets`,
        superadminUser.token,
        {
          targetType: 'invalid',
          targetId: 1,
        },
      ).expect(400);

      expect(response.body.message).toContain('targetType');
    });
  });

  describe('Escalation Flow Simulation', () => {
    it('should escalate through multiple levels', async () => {
      const team = await createTestTeam(app, { name: 'Engineering', slug: 'eng' });
      const policy = await createTestEscalationPolicy(app, {
        name: 'Multi-Level Policy',
        teamId: team.id,
      });

      // Level 1: Individual responder (5 min delay)
      const level1 = await createTestEscalationLevel(app, {
        policyId: policy.id,
        levelNumber: 1,
        delayMinutes: 5,
      });

      // Level 2: Team (15 min delay)
      const level2 = await createTestEscalationLevel(app, {
        policyId: policy.id,
        levelNumber: 2,
        delayMinutes: 15,
      });

      // Add targets
      await authenticatedPost(
        app,
        `/escalation-policies/${policy.id}/levels/${level1.id}/targets`,
        superadminUser.token,
        {
          targetType: 'user',
          targetId: responderUser.id,
        },
      ).expect(201);

      await authenticatedPost(
        app,
        `/escalation-policies/${policy.id}/levels/${level2.id}/targets`,
        superadminUser.token,
        {
          targetType: 'team',
          targetId: team.id,
        },
      ).expect(201);

      // Verify policy structure
      const response = await authenticatedGet(
        app,
        `/escalation-policies/${policy.id}`,
        superadminUser.token,
      ).expect(200);

      expect(response.body.levels).toHaveLength(2);
      expect(response.body.levels[0].levelNumber).toBe(1);
      expect(response.body.levels[1].levelNumber).toBe(2);
    });
  });
});
