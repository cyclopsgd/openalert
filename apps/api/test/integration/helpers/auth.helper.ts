import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { users } from '../../../src/database/schema';
import { DatabaseService } from '../../../src/database/database.service';

export interface TestUser {
  id: number;
  email: string;
  name: string;
  role: string;
  token?: string;
}

/**
 * Create a test user in the database
 */
export async function createTestUser(
  app: INestApplication,
  userData: Partial<TestUser> = {},
): Promise<TestUser> {
  const db = app.get(DatabaseService);
  const database = db.db;

  const defaultUser = {
    email: `test-${Date.now()}@example.com`,
    name: 'Test User',
    role: 'responder',
    authProvider: 'local',
    isActive: true,
    ...userData,
  };

  const [user] = await database
    .insert(users)
    .values(defaultUser)
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
    });

  return user;
}

/**
 * Generate a JWT token for a test user
 */
export async function generateTestToken(app: INestApplication, userId: number): Promise<string> {
  const jwtService = app.get(JwtService);

  const payload = {
    sub: userId,
    email: `user-${userId}@example.com`,
    name: 'Test User',
  };

  return jwtService.sign(payload);
}

/**
 * Create a test user and generate a JWT token
 */
export async function createAuthenticatedUser(
  app: INestApplication,
  userData: Partial<TestUser> = {},
): Promise<TestUser> {
  const user = await createTestUser(app, userData);
  const token = await generateTestToken(app, user.id);

  return {
    ...user,
    token,
  };
}

/**
 * Make an authenticated GET request
 */
export function authenticatedGet(app: INestApplication, url: string, token: string | undefined) {
  if (!token) throw new Error('Token is required for authenticated requests');
  return request(app.getHttpServer()).get(url).set('Authorization', `Bearer ${token}`);
}

/**
 * Make an authenticated POST request
 */
export function authenticatedPost(app: INestApplication, url: string, token: string | undefined, body?: any) {
  if (!token) throw new Error('Token is required for authenticated requests');
  return request(app.getHttpServer())
    .post(url)
    .set('Authorization', `Bearer ${token}`)
    .send(body || {});
}

/**
 * Make an authenticated PATCH request
 */
export function authenticatedPatch(
  app: INestApplication,
  url: string,
  token: string | undefined,
  body?: any,
) {
  if (!token) throw new Error('Token is required for authenticated requests');
  return request(app.getHttpServer())
    .patch(url)
    .set('Authorization', `Bearer ${token}`)
    .send(body || {});
}

/**
 * Make an authenticated PUT request
 */
export function authenticatedPut(app: INestApplication, url: string, token: string | undefined, body?: any) {
  if (!token) throw new Error('Token is required for authenticated requests');
  return request(app.getHttpServer())
    .put(url)
    .set('Authorization', `Bearer ${token}`)
    .send(body || {});
}

/**
 * Make an authenticated DELETE request
 */
export function authenticatedDelete(app: INestApplication, url: string, token: string | undefined) {
  if (!token) throw new Error('Token is required for authenticated requests');
  return request(app.getHttpServer()).delete(url).set('Authorization', `Bearer ${token}`);
}

/**
 * Register a user via the API
 */
export async function registerUser(
  app: INestApplication,
  email: string,
  password: string,
  name: string,
) {
  const response = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email, password, name });

  return response.body;
}

/**
 * Login a user via the API
 */
export async function loginUser(app: INestApplication, email: string, password: string) {
  const response = await request(app.getHttpServer())
    .post('/auth/login/local')
    .send({ email, password });

  return response.body;
}
