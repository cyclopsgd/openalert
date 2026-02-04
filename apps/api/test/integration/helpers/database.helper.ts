import { INestApplication } from '@nestjs/common';
import { DatabaseService } from '../../../src/database/database.service';
import {
  teams,
  services,
  schedules,
  scheduleRotations,
  escalationPolicies,
  escalationLevels,
  integrations,
  alerts,
  incidents,
  statusPages,
  teamMembers,
} from '../../../src/database/schema';

/**
 * Create a test team
 */
export async function createTestTeam(
  app: INestApplication,
  data: { name: string; slug: string; description?: string },
) {
  const db = app.get(DatabaseService);
  const database = db.getDatabase();

  const [team] = await database.insert(teams).values(data).returning();
  return team;
}

/**
 * Add a user to a team
 */
export async function addUserToTeam(
  app: INestApplication,
  teamId: number,
  userId: number,
  role: 'team_admin' | 'member' | 'observer' = 'member',
) {
  const db = app.get(DatabaseService);
  const database = db.getDatabase();

  const [membership] = await database
    .insert(teamMembers)
    .values({ teamId, userId, role })
    .returning();
  return membership;
}

/**
 * Create a test service
 */
export async function createTestService(
  app: INestApplication,
  data: {
    name: string;
    description?: string;
    teamId?: number;
    escalationPolicyId?: number;
    status?: 'operational' | 'degraded' | 'outage' | 'maintenance';
  },
) {
  const db = app.get(DatabaseService);
  const database = db.getDatabase();

  const [service] = await database
    .insert(services)
    .values({
      name: data.name,
      description: data.description || null,
      teamId: data.teamId || null,
      escalationPolicyId: data.escalationPolicyId || null,
      status: data.status || 'operational',
    })
    .returning();
  return service;
}

/**
 * Create a test schedule
 */
export async function createTestSchedule(
  app: INestApplication,
  data: {
    name: string;
    teamId?: number;
    timezone?: string;
  },
) {
  const db = app.get(DatabaseService);
  const database = db.getDatabase();

  const [schedule] = await database
    .insert(schedules)
    .values({
      name: data.name,
      teamId: data.teamId || null,
      timezone: data.timezone || 'UTC',
    })
    .returning();
  return schedule;
}

/**
 * Create a test rotation for a schedule
 */
export async function createTestRotation(
  app: INestApplication,
  data: {
    scheduleId: number;
    name: string;
    rotationType: 'daily' | 'weekly' | 'custom';
    startTime: Date;
    userIds: number[];
  },
) {
  const db = app.get(DatabaseService);
  const database = db.getDatabase();

  const [rotation] = await database
    .insert(scheduleRotations)
    .values({
      scheduleId: data.scheduleId,
      name: data.name,
      rotationType: data.rotationType,
      startTime: data.startTime,
      rotationConfig: {
        userIds: data.userIds,
      },
    })
    .returning();
  return rotation;
}

/**
 * Create a test escalation policy
 */
export async function createTestEscalationPolicy(
  app: INestApplication,
  data: {
    name: string;
    teamId?: number;
    description?: string;
  },
) {
  const db = app.get(DatabaseService);
  const database = db.getDatabase();

  const [policy] = await database
    .insert(escalationPolicies)
    .values({
      name: data.name,
      teamId: data.teamId || null,
      description: data.description || null,
    })
    .returning();
  return policy;
}

/**
 * Create a test escalation level
 */
export async function createTestEscalationLevel(
  app: INestApplication,
  data: {
    policyId: number;
    levelNumber: number;
    delayMinutes: number;
  },
) {
  const db = app.get(DatabaseService);
  const database = db.getDatabase();

  const [level] = await database
    .insert(escalationLevels)
    .values({
      policyId: data.policyId,
      levelNumber: data.levelNumber,
      delayMinutes: data.delayMinutes,
    })
    .returning();
  return level;
}

/**
 * Create a test integration
 */
export async function createTestIntegration(
  app: INestApplication,
  data: {
    name: string;
    type: string;
    serviceId?: number;
    integrationKey?: string;
  },
) {
  const db = app.get(DatabaseService);
  const database = db.getDatabase();

  const [integration] = await database
    .insert(integrations)
    .values({
      name: data.name,
      type: data.type,
      serviceId: data.serviceId || null,
      integrationKey: data.integrationKey || `test-key-${Date.now()}`,
      isActive: true,
      config: {},
    })
    .returning();
  return integration;
}

/**
 * Create a test alert
 */
export async function createTestAlert(
  app: INestApplication,
  data: {
    title: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    source: string;
    fingerprint?: string;
    serviceId?: number;
    incidentId?: number;
    status?: 'firing' | 'acknowledged' | 'resolved' | 'suppressed';
  },
) {
  const db = app.get(DatabaseService);
  const database = db.getDatabase();

  const [alert] = await database
    .insert(alerts)
    .values({
      title: data.title,
      description: `Test alert: ${data.title}`,
      severity: data.severity,
      source: data.source,
      fingerprint: data.fingerprint || `fp-${Date.now()}`,
      serviceId: data.serviceId || null,
      incidentId: data.incidentId || null,
      status: data.status || 'firing',
      rawPayload: {},
      labels: {},
    })
    .returning();
  return alert;
}

/**
 * Create a test incident
 */
export async function createTestIncident(
  app: INestApplication,
  data: {
    title: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    serviceId?: number;
    status?: 'triggered' | 'acknowledged' | 'resolved';
  },
) {
  const db = app.get(DatabaseService);
  const database = db.getDatabase();

  const [incident] = await database
    .insert(incidents)
    .values({
      title: data.title,
      description: `Test incident: ${data.title}`,
      severity: data.severity,
      serviceId: data.serviceId || null,
      status: data.status || 'triggered',
    })
    .returning();
  return incident;
}

/**
 * Create a test status page
 */
export async function createTestStatusPage(
  app: INestApplication,
  data: {
    name: string;
    slug: string;
    description?: string;
    isPublic?: boolean;
  },
) {
  const db = app.get(DatabaseService);
  const database = db.getDatabase();

  const [statusPage] = await database
    .insert(statusPages)
    .values({
      name: data.name,
      slug: data.slug,
      description: data.description || null,
      isPublic: data.isPublic ?? true,
      customDomain: null,
      branding: {},
    })
    .returning();
  return statusPage;
}
