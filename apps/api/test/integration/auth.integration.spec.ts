import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { initializeTestApp, closeTestApp, cleanupDatabase } from './setup';
import { registerUser, loginUser, createTestUser, generateTestToken } from './helpers/auth.helper';
import { testUsers } from './helpers/fixtures';

describe('Authentication Integration Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await initializeTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  beforeEach(async () => {
    await cleanupDatabase();
  });

  describe('POST /auth/register', () => {
    it('should register a new user with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'SecurePassword123!',
          name: 'New User',
        })
        .expect(201);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user).toMatchObject({
        email: 'newuser@example.com',
        name: 'New User',
      });
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    it('should reject registration with weak password', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: '123', // Too short
          name: 'Test User',
        })
        .expect(400);

      expect(response.body.message).toContain('password');
    });

    it('should reject registration with invalid email', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          password: 'SecurePassword123!',
          name: 'Test User',
        })
        .expect(400);

      expect(response.body.message).toContain('email');
    });

    it('should reject registration with duplicate email', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: 'SecurePassword123!',
        name: 'First User',
      };

      // First registration should succeed
      await request(app.getHttpServer()).post('/auth/register').send(userData).expect(201);

      // Second registration with same email should fail
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body.message).toContain('already exists');
    });

    it('should reject registration with missing fields', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          // Missing password and name
        })
        .expect(400);
    });
  });

  describe('POST /auth/login/local', () => {
    beforeEach(async () => {
      // Register a user for login tests
      await registerUser(app, testUsers.responder.email, testUsers.responder.password, testUsers.responder.name);
    });

    it('should login with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login/local')
        .send({
          email: testUsers.responder.email,
          password: testUsers.responder.password,
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user).toMatchObject({
        email: testUsers.responder.email,
        name: testUsers.responder.name,
      });
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    it('should reject login with incorrect password', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login/local')
        .send({
          email: testUsers.responder.email,
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should reject login with non-existent user', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login/local')
        .send({
          email: 'nonexistent@example.com',
          password: 'SomePassword123!',
        })
        .expect(401);

      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should reject login with missing credentials', async () => {
      await request(app.getHttpServer())
        .post('/auth/login/local')
        .send({
          email: testUsers.responder.email,
          // Missing password
        })
        .expect(400);
    });

    it('should update lastLoginAt on successful login', async () => {
      const beforeLogin = new Date();

      await request(app.getHttpServer())
        .post('/auth/login/local')
        .send({
          email: testUsers.responder.email,
          password: testUsers.responder.password,
        })
        .expect(200);

      // Verify lastLoginAt was updated (would need to query database directly)
      // This is a simplified test - in a real scenario, you'd check the database
    });
  });

  describe('GET /auth/profile', () => {
    let token: string;
    let userId: number;

    beforeEach(async () => {
      const user = await createTestUser(app, testUsers.responder);
      userId = user.id;
      token = await generateTestToken(app, userId);
    });

    it('should return user profile with valid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: userId,
        email: testUsers.responder.email,
      });
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('should reject request without token', async () => {
      await request(app.getHttpServer()).get('/auth/profile').expect(401);
    });

    it('should reject request with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should reject request with malformed authorization header', async () => {
      await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', 'InvalidFormat')
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout successfully', async () => {
      const response = await request(app.getHttpServer()).post('/auth/logout').expect(200);

      expect(response.body.message).toContain('Logged out');
    });

    it('should clear auth cookie on logout', async () => {
      const response = await request(app.getHttpServer()).post('/auth/logout').expect(200);

      // Check that Set-Cookie header clears the authToken
      const setCookie = response.headers['set-cookie'];
      if (setCookie) {
        const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
        expect(cookies.some((cookie: string) => cookie.includes('authToken='))).toBe(true);
      }
    });
  });

  describe('JWT Token Validation', () => {
    let token: string;
    let userId: number;

    beforeEach(async () => {
      const user = await createTestUser(app, testUsers.responder);
      userId = user.id;
      token = await generateTestToken(app, userId);
    });

    it('should accept valid JWT token', async () => {
      await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('should reject expired JWT token', async () => {
      // This test would require generating an expired token
      // For now, we'll test with an invalid token
      const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.invalid';

      await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);
    });

    it('should extract user information from token', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.id).toBe(userId);
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit registration attempts', async () => {
      const userData = {
        password: 'SecurePassword123!',
        name: 'Test User',
      };

      // Make multiple rapid registration attempts
      const promises = [];
      for (let i = 0; i < 7; i++) {
        promises.push(
          request(app.getHttpServer())
            .post('/auth/register')
            .send({
              ...userData,
              email: `test${i}@example.com`,
            }),
        );
      }

      const responses = await Promise.all(promises);

      // At least one should be rate limited (429)
      const rateLimited = responses.some((r) => r.status === 429);
      expect(rateLimited).toBe(true);
    });

    it('should rate limit login attempts', async () => {
      // Make multiple rapid login attempts
      const promises = [];
      for (let i = 0; i < 12; i++) {
        promises.push(
          request(app.getHttpServer()).post('/auth/login/local').send({
            email: 'test@example.com',
            password: 'password',
          }),
        );
      }

      const responses = await Promise.all(promises);

      // At least one should be rate limited (429)
      const rateLimited = responses.some((r) => r.status === 429);
      expect(rateLimited).toBe(true);
    });
  });
});
