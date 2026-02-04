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
  createTestSchedule,
  createTestRotation,
  addUserToTeam,
} from './helpers/database.helper';
import { testUsers } from './helpers/fixtures';

describe('Schedules Integration Tests', () => {
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

  describe('POST /schedules', () => {
    it('should create a schedule as admin', async () => {
      const team = await createTestTeam(app, {
        name: 'Engineering',
        slug: 'engineering',
      });

      const response = await authenticatedPost(app, '/schedules', superadminUser.token, {
        name: 'Primary On-Call',
        teamId: team.id,
        timezone: 'America/New_York',
        description: 'Primary on-call rotation',
      }).expect(201);

      expect(response.body).toMatchObject({
        name: 'Primary On-Call',
        teamId: team.id,
        timezone: 'America/New_York',
      });
    });

    it('should reject schedule creation by observer', async () => {
      const team = await createTestTeam(app, {
        name: 'Engineering',
        slug: 'engineering',
      });

      await authenticatedPost(app, '/schedules', observerUser.token, {
        name: 'Test Schedule',
        teamId: team.id,
        timezone: 'UTC',
      }).expect(403);
    });

    it('should validate timezone format', async () => {
      const team = await createTestTeam(app, {
        name: 'Engineering',
        slug: 'engineering',
      });

      const response = await authenticatedPost(app, '/schedules', superadminUser.token, {
        name: 'Test Schedule',
        teamId: team.id,
        timezone: 'InvalidTimezone',
      }).expect(400);

      expect(response.body.message).toContain('timezone');
    });

    it('should create schedule without team', async () => {
      const response = await authenticatedPost(app, '/schedules', superadminUser.token, {
        name: 'Global Schedule',
        timezone: 'UTC',
      }).expect(201);

      expect(response.body.teamId).toBeNull();
    });
  });

  describe('GET /schedules', () => {
    it('should list all schedules', async () => {
      const team = await createTestTeam(app, {
        name: 'Engineering',
        slug: 'engineering',
      });

      await createTestSchedule(app, {
        name: 'Schedule 1',
        teamId: team.id,
      });
      await createTestSchedule(app, {
        name: 'Schedule 2',
        teamId: team.id,
      });

      const response = await authenticatedGet(app, '/schedules', superadminUser.token).expect(200);

      expect(response.body).toHaveLength(2);
    });

    it('should filter schedules by team', async () => {
      const team1 = await createTestTeam(app, {
        name: 'Team 1',
        slug: 'team-1',
      });
      const team2 = await createTestTeam(app, {
        name: 'Team 2',
        slug: 'team-2',
      });

      await createTestSchedule(app, {
        name: 'Team 1 Schedule',
        teamId: team1.id,
      });
      await createTestSchedule(app, {
        name: 'Team 2 Schedule',
        teamId: team2.id,
      });

      const response = await authenticatedGet(
        app,
        `/schedules?teamId=${team1.id}`,
        superadminUser.token,
      ).expect(200);

      expect(response.body.every((s: any) => s.teamId === team1.id)).toBe(true);
    });
  });

  describe('GET /schedules/:id', () => {
    it('should get schedule details', async () => {
      const schedule = await createTestSchedule(app, {
        name: 'Test Schedule',
        timezone: 'America/New_York',
      });

      const response = await authenticatedGet(
        app,
        `/schedules/${schedule.id}`,
        superadminUser.token,
      ).expect(200);

      expect(response.body).toMatchObject({
        id: schedule.id,
        name: 'Test Schedule',
        timezone: 'America/New_York',
      });
    });

    it('should return 404 for non-existent schedule', async () => {
      await authenticatedGet(app, '/schedules/99999', superadminUser.token).expect(404);
    });

    it('should include rotations in schedule details', async () => {
      const schedule = await createTestSchedule(app, {
        name: 'Test Schedule',
      });

      await createTestRotation(app, {
        scheduleId: schedule.id,
        name: 'Daily Rotation',
        rotationType: 'daily',
        startTime: new Date(),
        userIds: [responderUser.id],
      });

      const response = await authenticatedGet(
        app,
        `/schedules/${schedule.id}`,
        superadminUser.token,
      ).expect(200);

      expect(response.body.rotations).toBeDefined();
      expect(Array.isArray(response.body.rotations)).toBe(true);
    });
  });

  describe('PATCH /schedules/:id', () => {
    it('should update schedule as admin', async () => {
      const schedule = await createTestSchedule(app, {
        name: 'Original Name',
        timezone: 'UTC',
      });

      const response = await authenticatedPatch(
        app,
        `/schedules/${schedule.id}`,
        superadminUser.token,
        {
          name: 'Updated Name',
          timezone: 'America/Los_Angeles',
        },
      ).expect(200);

      expect(response.body).toMatchObject({
        name: 'Updated Name',
        timezone: 'America/Los_Angeles',
      });
    });

    it('should not allow observer to update schedule', async () => {
      const schedule = await createTestSchedule(app, {
        name: 'Test Schedule',
      });

      await authenticatedPatch(app, `/schedules/${schedule.id}`, observerUser.token, {
        name: 'New Name',
      }).expect(403);
    });
  });

  describe('DELETE /schedules/:id', () => {
    it('should delete schedule as superadmin', async () => {
      const schedule = await createTestSchedule(app, {
        name: 'To Delete',
      });

      await authenticatedDelete(
        app,
        `/schedules/${schedule.id}`,
        superadminUser.token,
      ).expect(200);

      await authenticatedGet(app, `/schedules/${schedule.id}`, superadminUser.token).expect(404);
    });

    it('should not allow non-superadmin to delete schedule', async () => {
      const schedule = await createTestSchedule(app, {
        name: 'Test Schedule',
      });

      await authenticatedDelete(app, `/schedules/${schedule.id}`, responderUser.token).expect(403);
    });
  });

  describe('POST /schedules/:id/rotations', () => {
    it('should add rotation to schedule', async () => {
      const schedule = await createTestSchedule(app, {
        name: 'Test Schedule',
      });

      const response = await authenticatedPost(
        app,
        `/schedules/${schedule.id}/rotations`,
        superadminUser.token,
        {
          name: 'Daily Rotation',
          rotationType: 'daily',
          startTime: new Date().toISOString(),
          userIds: [responderUser.id],
        },
      ).expect(201);

      expect(response.body).toMatchObject({
        scheduleId: schedule.id,
        name: 'Daily Rotation',
        rotationType: 'daily',
      });
    });

    it('should validate rotation type', async () => {
      const schedule = await createTestSchedule(app, {
        name: 'Test Schedule',
      });

      const response = await authenticatedPost(
        app,
        `/schedules/${schedule.id}/rotations`,
        superadminUser.token,
        {
          name: 'Invalid Rotation',
          rotationType: 'invalid-type',
          startTime: new Date().toISOString(),
          userIds: [responderUser.id],
        },
      ).expect(400);

      expect(response.body.message).toContain('rotationType');
    });

    it('should require at least one user in rotation', async () => {
      const schedule = await createTestSchedule(app, {
        name: 'Test Schedule',
      });

      const response = await authenticatedPost(
        app,
        `/schedules/${schedule.id}/rotations`,
        superadminUser.token,
        {
          name: 'Empty Rotation',
          rotationType: 'daily',
          startTime: new Date().toISOString(),
          userIds: [],
        },
      ).expect(400);

      expect(response.body.message).toContain('user');
    });
  });

  describe('GET /schedules/:id/current', () => {
    it('should get current on-call user', async () => {
      const schedule = await createTestSchedule(app, {
        name: 'Test Schedule',
      });

      await createTestRotation(app, {
        scheduleId: schedule.id,
        name: 'Daily Rotation',
        rotationType: 'daily',
        startTime: new Date(),
        userIds: [responderUser.id],
      });

      const response = await authenticatedGet(
        app,
        `/schedules/${schedule.id}/current`,
        superadminUser.token,
      ).expect(200);

      expect(response.body).toHaveProperty('currentUser');
    });

    it('should return null if no active rotation', async () => {
      const schedule = await createTestSchedule(app, {
        name: 'Test Schedule',
      });

      const response = await authenticatedGet(
        app,
        `/schedules/${schedule.id}/current`,
        superadminUser.token,
      ).expect(200);

      expect(response.body.currentUser).toBeNull();
    });
  });

  describe('POST /schedules/:id/overrides', () => {
    it('should create schedule override', async () => {
      const schedule = await createTestSchedule(app, {
        name: 'Test Schedule',
      });

      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 24 * 60 * 60 * 1000); // +1 day

      const response = await authenticatedPost(
        app,
        `/schedules/${schedule.id}/overrides`,
        superadminUser.token,
        {
          userId: responderUser.id,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          reason: 'Vacation coverage',
        },
      ).expect(201);

      expect(response.body).toMatchObject({
        scheduleId: schedule.id,
        userId: responderUser.id,
        reason: 'Vacation coverage',
      });
    });

    it('should validate override time range', async () => {
      const schedule = await createTestSchedule(app, {
        name: 'Test Schedule',
      });

      const startTime = new Date();
      const endTime = new Date(startTime.getTime() - 1000); // End before start

      const response = await authenticatedPost(
        app,
        `/schedules/${schedule.id}/overrides`,
        superadminUser.token,
        {
          userId: responderUser.id,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        },
      ).expect(400);

      expect(response.body.message).toContain('time');
    });
  });

  describe('GET /schedules/:id/overrides', () => {
    it('should list schedule overrides', async () => {
      const schedule = await createTestSchedule(app, {
        name: 'Test Schedule',
      });

      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 24 * 60 * 60 * 1000);

      await authenticatedPost(app, `/schedules/${schedule.id}/overrides`, superadminUser.token, {
        userId: responderUser.id,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        reason: 'Override 1',
      }).expect(201);

      const response = await authenticatedGet(
        app,
        `/schedules/${schedule.id}/overrides`,
        superadminUser.token,
      ).expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('Team-based Access Control', () => {
    it('should allow team admin to manage team schedule', async () => {
      const team = await createTestTeam(app, {
        name: 'Test Team',
        slug: 'test-team',
      });
      await addUserToTeam(app, team.id, responderUser.id, 'team_admin');

      const schedule = await createTestSchedule(app, {
        name: 'Team Schedule',
        teamId: team.id,
      });

      await authenticatedPatch(app, `/schedules/${schedule.id}`, responderUser.token, {
        name: 'Updated by Team Admin',
      }).expect(200);
    });

    it('should deny non-team-member from modifying team schedule', async () => {
      const team = await createTestTeam(app, {
        name: 'Test Team',
        slug: 'test-team',
      });
      // responderUser is NOT a team member

      const schedule = await createTestSchedule(app, {
        name: 'Team Schedule',
        teamId: team.id,
      });

      await authenticatedPatch(app, `/schedules/${schedule.id}`, responderUser.token, {
        name: 'Should Fail',
      }).expect(403);
    });
  });
});
