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
import { createTestTeam, addUserToTeam } from './helpers/database.helper';
import { testUsers } from './helpers/fixtures';

describe('Teams Integration Tests', () => {
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

  describe('POST /teams', () => {
    it('should create team as admin', async () => {
      const response = await authenticatedPost(app, '/teams', superadminUser.token, {
        name: 'Engineering',
        slug: 'engineering',
        description: 'Engineering team',
      }).expect(201);

      expect(response.body).toMatchObject({
        name: 'Engineering',
        slug: 'engineering',
      });
    });

    it('should reject duplicate slug', async () => {
      await authenticatedPost(app, '/teams', superadminUser.token, {
        name: 'Team 1',
        slug: 'engineering',
      }).expect(201);

      const response = await authenticatedPost(app, '/teams', superadminUser.token, {
        name: 'Team 2',
        slug: 'engineering',
      }).expect(409);

      expect(response.body.message).toContain('slug');
    });

    it('should not allow observer to create team', async () => {
      await authenticatedPost(app, '/teams', observerUser.token, {
        name: 'Test Team',
        slug: 'test',
      }).expect(403);
    });
  });

  describe('GET /teams', () => {
    it('should list all teams', async () => {
      await createTestTeam(app, { name: 'Team 1', slug: 'team-1' });
      await createTestTeam(app, { name: 'Team 2', slug: 'team-2' });

      const response = await authenticatedGet(app, '/teams', superadminUser.token).expect(200);

      expect(response.body).toHaveLength(2);
    });
  });

  describe('GET /teams/:id', () => {
    it('should get team details', async () => {
      const team = await createTestTeam(app, { name: 'Engineering', slug: 'eng' });

      const response = await authenticatedGet(
        app,
        `/teams/${team.id}`,
        superadminUser.token,
      ).expect(200);

      expect(response.body.id).toBe(team.id);
    });
  });

  describe('PATCH /teams/:id', () => {
    it('should update team', async () => {
      const team = await createTestTeam(app, { name: 'Old Name', slug: 'old' });

      const response = await authenticatedPatch(app, `/teams/${team.id}`, superadminUser.token, {
        name: 'New Name',
      }).expect(200);

      expect(response.body.name).toBe('New Name');
    });

    it('should allow team admin to update', async () => {
      const team = await createTestTeam(app, { name: 'Test Team', slug: 'test' });
      await addUserToTeam(app, team.id, responderUser.id, 'team_admin');

      await authenticatedPatch(app, `/teams/${team.id}`, responderUser.token, {
        description: 'Updated by team admin',
      }).expect(200);
    });

    it('should not allow team member to update', async () => {
      const team = await createTestTeam(app, { name: 'Test Team', slug: 'test' });
      await addUserToTeam(app, team.id, responderUser.id, 'member');

      await authenticatedPatch(app, `/teams/${team.id}`, responderUser.token, {
        name: 'Should Fail',
      }).expect(403);
    });
  });

  describe('DELETE /teams/:id', () => {
    it('should delete team', async () => {
      const team = await createTestTeam(app, { name: 'To Delete', slug: 'delete' });

      await authenticatedDelete(app, `/teams/${team.id}`, superadminUser.token).expect(200);
      await authenticatedGet(app, `/teams/${team.id}`, superadminUser.token).expect(404);
    });
  });

  describe('POST /teams/:id/members', () => {
    it('should add team member', async () => {
      const team = await createTestTeam(app, { name: 'Test Team', slug: 'test' });

      const response = await authenticatedPost(
        app,
        `/teams/${team.id}/members`,
        superadminUser.token,
        {
          userId: responderUser.id,
          role: 'member',
        },
      ).expect(201);

      expect(response.body).toMatchObject({
        teamId: team.id,
        userId: responderUser.id,
        role: 'member',
      });
    });

    it('should prevent duplicate membership', async () => {
      const team = await createTestTeam(app, { name: 'Test Team', slug: 'test' });
      await addUserToTeam(app, team.id, responderUser.id);

      const response = await authenticatedPost(
        app,
        `/teams/${team.id}/members`,
        superadminUser.token,
        {
          userId: responderUser.id,
          role: 'member',
        },
      ).expect(409);

      expect(response.body.message).toContain('already a member');
    });

    it('should validate role values', async () => {
      const team = await createTestTeam(app, { name: 'Test Team', slug: 'test' });

      const response = await authenticatedPost(
        app,
        `/teams/${team.id}/members`,
        superadminUser.token,
        {
          userId: responderUser.id,
          role: 'invalid_role',
        },
      ).expect(400);

      expect(response.body.message).toContain('role');
    });
  });

  describe('GET /teams/:id/members', () => {
    it('should list team members', async () => {
      const team = await createTestTeam(app, { name: 'Test Team', slug: 'test' });
      await addUserToTeam(app, team.id, responderUser.id, 'member');
      await addUserToTeam(app, team.id, observerUser.id, 'observer');

      const response = await authenticatedGet(
        app,
        `/teams/${team.id}/members`,
        superadminUser.token,
      ).expect(200);

      expect(response.body).toHaveLength(2);
    });
  });

  describe('PATCH /teams/:id/members/:userId', () => {
    it('should update member role', async () => {
      const team = await createTestTeam(app, { name: 'Test Team', slug: 'test' });
      await addUserToTeam(app, team.id, responderUser.id, 'member');

      const response = await authenticatedPatch(
        app,
        `/teams/${team.id}/members/${responderUser.id}`,
        superadminUser.token,
        {
          role: 'team_admin',
        },
      ).expect(200);

      expect(response.body.role).toBe('team_admin');
    });

    it('should allow team admin to update roles', async () => {
      const team = await createTestTeam(app, { name: 'Test Team', slug: 'test' });
      await addUserToTeam(app, team.id, responderUser.id, 'team_admin');
      await addUserToTeam(app, team.id, observerUser.id, 'member');

      await authenticatedPatch(
        app,
        `/teams/${team.id}/members/${observerUser.id}`,
        responderUser.token,
        {
          role: 'observer',
        },
      ).expect(200);
    });
  });

  describe('DELETE /teams/:id/members/:userId', () => {
    it('should remove team member', async () => {
      const team = await createTestTeam(app, { name: 'Test Team', slug: 'test' });
      await addUserToTeam(app, team.id, responderUser.id);

      await authenticatedDelete(
        app,
        `/teams/${team.id}/members/${responderUser.id}`,
        superadminUser.token,
      ).expect(200);

      const response = await authenticatedGet(
        app,
        `/teams/${team.id}/members`,
        superadminUser.token,
      ).expect(200);

      expect(response.body.every((m: any) => m.userId !== responderUser.id)).toBe(true);
    });
  });

  describe('Team Permissions Isolation', () => {
    it('should isolate team resources', async () => {
      const team1 = await createTestTeam(app, { name: 'Team 1', slug: 'team-1' });
      const team2 = await createTestTeam(app, { name: 'Team 2', slug: 'team-2' });

      await addUserToTeam(app, team1.id, responderUser.id, 'team_admin');

      // Should be able to access own team
      await authenticatedGet(app, `/teams/${team1.id}`, responderUser.token).expect(200);

      // Should not be able to manage other team
      await authenticatedPatch(app, `/teams/${team2.id}`, responderUser.token, {
        name: 'Should Fail',
      }).expect(403);
    });
  });
});
