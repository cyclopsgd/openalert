# OpenAlert Implementation Guide for Claude Code

## Executive Summary

**OpenAlert** is an open-source incident management platform targeting organizations migrating from Opsgenie (EOL April 2027) and Grafana OnCall OSS (archive March 2026). This guide provides step-by-step implementation instructions.

**Tech Stack (Non-negotiable):**
- **Runtime**: Node.js 20+ with TypeScript
- **Framework**: NestJS with Fastify adapter
- **Database**: PostgreSQL 15+ with Drizzle ORM
- **Cache/Queue**: Redis 7+ with BullMQ
- **Real-time**: Socket.IO with Redis adapter
- **Auth**: Azure Entra ID via MSAL
- **Container**: Docker + Docker Compose

**Reference Documents** (consult for deep details):
- `competitor-analysis.md` - Feature priorities and market context
- `Entra_ID___SSO_for_Node_js.md` - Authentication patterns
- `Node_js_Backend_Architecture.md` - Architecture patterns and code examples
- `Integration_Webhook_Specifications.md` - Webhook payload formats
- `PagerDuty_Event_Orchestration_Deep_Dive.md` - Routing/escalation logic

---

## Phase 1: MVP Foundation (Weeks 1-4)

### Week 1: Project Scaffold & Core Infrastructure

#### Day 1-2: Initialize Project Structure

```bash
# Create monorepo structure
mkdir openalert && cd openalert
npm init -y

# Initialize with required structure
mkdir -p apps/api/src/{modules,common,config}
mkdir -p apps/api/src/modules/{alerts,incidents,escalations,teams,users,auth}
mkdir -p apps/api/src/common/{decorators,filters,guards,interceptors,pipes}
mkdir -p packages/{shared-types,logger}
mkdir -p docker
mkdir -p scripts
```

**Target folder structure:**
```
openalert/
├── apps/
│   └── api/
│       ├── src/
│       │   ├── modules/
│       │   │   ├── alerts/
│       │   │   │   ├── alerts.controller.ts
│       │   │   │   ├── alerts.service.ts
│       │   │   │   ├── alerts.module.ts
│       │   │   │   ├── dto/
│       │   │   │   └── entities/
│       │   │   ├── incidents/
│       │   │   ├── escalations/
│       │   │   ├── schedules/
│       │   │   ├── teams/
│       │   │   ├── users/
│       │   │   └── auth/
│       │   ├── common/
│       │   │   ├── decorators/
│       │   │   ├── filters/
│       │   │   ├── guards/
│       │   │   └── interceptors/
│       │   ├── config/
│       │   ├── database/
│       │   │   ├── schema.ts
│       │   │   ├── migrations/
│       │   │   └── drizzle.config.ts
│       │   ├── queues/
│       │   ├── websocket/
│       │   ├── app.module.ts
│       │   └── main.ts
│       ├── test/
│       └── package.json
├── packages/
│   └── shared-types/
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
├── .env.example
├── package.json
└── turbo.json (optional, for monorepo)
```

#### Day 2-3: Docker Compose for Local Development

Create `docker/docker-compose.yml`:
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: openalert-postgres
    environment:
      POSTGRES_USER: openalert
      POSTGRES_PASSWORD: openalert_dev
      POSTGRES_DB: openalert
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U openalert"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: openalert-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  # Optional: Redis Commander for debugging
  redis-commander:
    image: rediscommander/redis-commander:latest
    container_name: openalert-redis-ui
    environment:
      REDIS_HOSTS: local:redis:6379
    ports:
      - "8081:8081"
    depends_on:
      - redis

volumes:
  postgres_data:
  redis_data:
```

#### Day 3-4: NestJS Application Bootstrap

Create `apps/api/package.json`:
```json
{
  "name": "@openalert/api",
  "version": "0.1.0",
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
  },
  "dependencies": {
    "@nestjs/common": "^10.3.0",
    "@nestjs/config": "^3.1.1",
    "@nestjs/core": "^10.3.0",
    "@nestjs/jwt": "^10.2.0",
    "@nestjs/passport": "^10.0.3",
    "@nestjs/platform-fastify": "^10.3.0",
    "@nestjs/platform-socket.io": "^10.3.0",
    "@nestjs/swagger": "^7.2.0",
    "@nestjs/websockets": "^10.3.0",
    "@socket.io/redis-adapter": "^8.2.1",
    "@azure/msal-node": "^2.6.0",
    "bullmq": "^5.1.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "drizzle-orm": "^0.29.3",
    "ioredis": "^5.3.2",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "pg": "^8.11.3",
    "reflect-metadata": "^0.2.1",
    "rxjs": "^7.8.1",
    "socket.io": "^4.7.4",
    "uuid": "^9.0.1",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.3.0",
    "@nestjs/schematics": "^10.1.0",
    "@nestjs/testing": "^10.3.0",
    "@types/jest": "^29.5.11",
    "@types/node": "^20.10.6",
    "@types/passport-jwt": "^4.0.0",
    "@types/pg": "^8.10.9",
    "@types/uuid": "^9.0.7",
    "drizzle-kit": "^0.20.10",
    "jest": "^29.7.0",
    "source-map-support": "^0.5.21",
    "supertest": "^6.3.4",
    "ts-jest": "^29.1.1",
    "ts-node": "^10.9.2",
    "typescript": "^5.3.3"
  }
}
```

Create `apps/api/src/main.ts`:
```typescript
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ 
      logger: true,
      bodyLimit: 1048576, // 1MB for alert payloads
    }),
  );

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // CORS configuration
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  });

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('OpenAlert API')
    .setDescription('Incident Management Platform API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 OpenAlert API running on http://localhost:${port}`);
  logger.log(`📚 Swagger docs at http://localhost:${port}/api/docs`);
}
bootstrap();
```

#### Day 4-5: Database Schema with Drizzle

Create `apps/api/src/database/schema.ts`:
```typescript
import { 
  pgTable, 
  serial, 
  varchar, 
  text, 
  timestamp, 
  integer, 
  boolean,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const severityEnum = pgEnum('severity', ['critical', 'high', 'medium', 'low', 'info']);
export const incidentStatusEnum = pgEnum('incident_status', ['triggered', 'acknowledged', 'resolved']);
export const alertStatusEnum = pgEnum('alert_status', ['firing', 'acknowledged', 'resolved', 'suppressed']);
export const notificationChannelEnum = pgEnum('notification_channel', ['email', 'sms', 'voice', 'push', 'slack', 'teams']);

// Teams
export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Users
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  externalId: varchar('external_id', { length: 255 }).notNull().unique(), // Entra ID oid
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  phoneNumber: varchar('phone_number', { length: 50 }),
  timezone: varchar('timezone', { length: 100 }).default('UTC'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  emailIdx: index('users_email_idx').on(table.email),
  externalIdIdx: index('users_external_id_idx').on(table.externalId),
}));

// Team memberships
export const teamMembers = pgTable('team_members', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 50 }).default('member').notNull(), // owner, admin, member
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  uniqueMembership: uniqueIndex('unique_team_member').on(table.teamId, table.userId),
}));

// Services (what we're monitoring)
export const services = pgTable('services', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull(),
  description: text('description'),
  teamId: integer('team_id').notNull().references(() => teams.id),
  escalationPolicyId: integer('escalation_policy_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  slugIdx: uniqueIndex('services_slug_idx').on(table.slug),
  teamIdx: index('services_team_idx').on(table.teamId),
}));

// Integration endpoints (webhook receivers)
export const integrations = pgTable('integrations', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 100 }).notNull(), // prometheus, grafana, azure_monitor, datadog, webhook
  serviceId: integer('service_id').notNull().references(() => services.id, { onDelete: 'cascade' }),
  integrationKey: varchar('integration_key', { length: 64 }).notNull().unique(),
  config: jsonb('config').$type<Record<string, unknown>>(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  keyIdx: uniqueIndex('integrations_key_idx').on(table.integrationKey),
}));

// Alerts (individual alert events)
export const alerts = pgTable('alerts', {
  id: serial('id').primaryKey(),
  fingerprint: varchar('fingerprint', { length: 255 }).notNull(),
  integrationId: integer('integration_id').notNull().references(() => integrations.id),
  incidentId: integer('incident_id').references(() => incidents.id),
  status: alertStatusEnum('status').default('firing').notNull(),
  severity: severityEnum('severity').notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  source: varchar('source', { length: 255 }),
  labels: jsonb('labels').$type<Record<string, string>>(),
  annotations: jsonb('annotations').$type<Record<string, string>>(),
  rawPayload: jsonb('raw_payload').$type<Record<string, unknown>>(),
  firedAt: timestamp('fired_at').defaultNow().notNull(),
  acknowledgedAt: timestamp('acknowledged_at'),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  fingerprintIdx: index('alerts_fingerprint_idx').on(table.fingerprint),
  statusIdx: index('alerts_status_idx').on(table.status),
  incidentIdx: index('alerts_incident_idx').on(table.incidentId),
  firedAtIdx: index('alerts_fired_at_idx').on(table.firedAt),
}));

// Incidents (grouped alerts)
export const incidents = pgTable('incidents', {
  id: serial('id').primaryKey(),
  incidentNumber: serial('incident_number').notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  status: incidentStatusEnum('status').default('triggered').notNull(),
  severity: severityEnum('severity').notNull(),
  serviceId: integer('service_id').notNull().references(() => services.id),
  assigneeId: integer('assignee_id').references(() => users.id),
  acknowledgedById: integer('acknowledged_by_id').references(() => users.id),
  resolvedById: integer('resolved_by_id').references(() => users.id),
  triggeredAt: timestamp('triggered_at').defaultNow().notNull(),
  acknowledgedAt: timestamp('acknowledged_at'),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  statusIdx: index('incidents_status_idx').on(table.status),
  serviceIdx: index('incidents_service_idx').on(table.serviceId),
  triggeredAtIdx: index('incidents_triggered_at_idx').on(table.triggeredAt),
}));

// Escalation Policies
export const escalationPolicies = pgTable('escalation_policies', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  teamId: integer('team_id').notNull().references(() => teams.id),
  repeatCount: integer('repeat_count').default(3).notNull(),
  repeatDelayMinutes: integer('repeat_delay_minutes').default(5).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Escalation Policy Levels
export const escalationLevels = pgTable('escalation_levels', {
  id: serial('id').primaryKey(),
  policyId: integer('policy_id').notNull().references(() => escalationPolicies.id, { onDelete: 'cascade' }),
  level: integer('level').notNull(), // 1, 2, 3...
  delayMinutes: integer('delay_minutes').default(5).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  policyLevelIdx: uniqueIndex('escalation_level_idx').on(table.policyId, table.level),
}));

// Escalation Level Targets (who gets notified at each level)
export const escalationTargets = pgTable('escalation_targets', {
  id: serial('id').primaryKey(),
  levelId: integer('level_id').notNull().references(() => escalationLevels.id, { onDelete: 'cascade' }),
  targetType: varchar('target_type', { length: 50 }).notNull(), // user, schedule, team
  targetId: integer('target_id').notNull(), // userId, scheduleId, or teamId
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// On-Call Schedules
export const schedules = pgTable('schedules', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  teamId: integer('team_id').notNull().references(() => teams.id),
  timezone: varchar('timezone', { length: 100 }).default('UTC').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Schedule Rotations
export const scheduleRotations = pgTable('schedule_rotations', {
  id: serial('id').primaryKey(),
  scheduleId: integer('schedule_id').notNull().references(() => schedules.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }),
  rotationType: varchar('rotation_type', { length: 50 }).notNull(), // daily, weekly, custom
  handoffTime: varchar('handoff_time', { length: 10 }).default('09:00').notNull(), // HH:MM
  handoffDay: integer('handoff_day'), // 0-6 for weekly (0 = Sunday)
  effectiveFrom: timestamp('effective_from').notNull(),
  effectiveUntil: timestamp('effective_until'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Schedule Rotation Members
export const rotationMembers = pgTable('rotation_members', {
  id: serial('id').primaryKey(),
  rotationId: integer('rotation_id').notNull().references(() => scheduleRotations.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id),
  position: integer('position').notNull(), // Order in rotation
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Schedule Overrides
export const scheduleOverrides = pgTable('schedule_overrides', {
  id: serial('id').primaryKey(),
  scheduleId: integer('schedule_id').notNull().references(() => schedules.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Notification Log
export const notificationLogs = pgTable('notification_logs', {
  id: serial('id').primaryKey(),
  incidentId: integer('incident_id').notNull().references(() => incidents.id),
  userId: integer('user_id').notNull().references(() => users.id),
  channel: notificationChannelEnum('channel').notNull(),
  status: varchar('status', { length: 50 }).notNull(), // pending, sent, delivered, failed
  sentAt: timestamp('sent_at'),
  deliveredAt: timestamp('delivered_at'),
  failureReason: text('failure_reason'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  incidentIdx: index('notification_logs_incident_idx').on(table.incidentId),
}));

// Incident Timeline
export const incidentTimeline = pgTable('incident_timeline', {
  id: serial('id').primaryKey(),
  incidentId: integer('incident_id').notNull().references(() => incidents.id, { onDelete: 'cascade' }),
  eventType: varchar('event_type', { length: 100 }).notNull(), // triggered, acknowledged, escalated, resolved, note_added
  userId: integer('user_id').references(() => users.id),
  description: text('description'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  incidentIdx: index('timeline_incident_idx').on(table.incidentId),
  createdAtIdx: index('timeline_created_at_idx').on(table.createdAt),
}));

// Relations
export const teamsRelations = relations(teams, ({ many }) => ({
  members: many(teamMembers),
  services: many(services),
  schedules: many(schedules),
  escalationPolicies: many(escalationPolicies),
}));

export const usersRelations = relations(users, ({ many }) => ({
  teamMemberships: many(teamMembers),
  incidents: many(incidents, { relationName: 'assignee' }),
}));

export const servicesRelations = relations(services, ({ one, many }) => ({
  team: one(teams, { fields: [services.teamId], references: [teams.id] }),
  integrations: many(integrations),
  incidents: many(incidents),
}));

export const incidentsRelations = relations(incidents, ({ one, many }) => ({
  service: one(services, { fields: [incidents.serviceId], references: [services.id] }),
  assignee: one(users, { fields: [incidents.assigneeId], references: [users.id], relationName: 'assignee' }),
  alerts: many(alerts),
  timeline: many(incidentTimeline),
  notifications: many(notificationLogs),
}));

export const alertsRelations = relations(alerts, ({ one }) => ({
  incident: one(incidents, { fields: [alerts.incidentId], references: [incidents.id] }),
  integration: one(integrations, { fields: [alerts.integrationId], references: [integrations.id] }),
}));

// Type exports
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Service = typeof services.$inferSelect;
export type NewService = typeof services.$inferInsert;
export type Alert = typeof alerts.$inferSelect;
export type NewAlert = typeof alerts.$inferInsert;
export type Incident = typeof incidents.$inferSelect;
export type NewIncident = typeof incidents.$inferInsert;
export type EscalationPolicy = typeof escalationPolicies.$inferSelect;
export type Schedule = typeof schedules.$inferSelect;
```

Create `apps/api/drizzle.config.ts`:
```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/database/schema.ts',
  out: './src/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://openalert:openalert_dev@localhost:5432/openalert',
  },
  verbose: true,
  strict: true,
});
```

### Week 2: Alert Ingestion & Incident Creation

#### Alert Ingestion Module

Create `apps/api/src/modules/alerts/alerts.service.ts`:
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { alerts, incidents, integrations, services } from '../../database/schema';
import { CreateAlertDto } from './dto/create-alert.dto';
import { IncidentsService } from '../incidents/incidents.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);
  
  constructor(
    private readonly db: DatabaseService,
    private readonly incidentsService: IncidentsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async ingestAlert(integrationKey: string, payload: CreateAlertDto) {
    // 1. Validate integration
    const integration = await this.db.query.integrations.findFirst({
      where: eq(integrations.integrationKey, integrationKey),
      with: { service: true },
    });

    if (!integration || !integration.isActive) {
      throw new Error('Invalid or inactive integration');
    }

    // 2. Generate fingerprint for deduplication
    const fingerprint = this.generateFingerprint(payload);

    // 3. Check for existing alert (deduplication)
    const existingAlert = await this.db.query.alerts.findFirst({
      where: and(
        eq(alerts.fingerprint, fingerprint),
        eq(alerts.status, 'firing'),
      ),
    });

    if (existingAlert) {
      this.logger.debug(`Deduplicated alert: ${fingerprint}`);
      return existingAlert;
    }

    // 4. Create or find incident
    let incidentId: number | null = null;
    
    if (payload.status !== 'resolved') {
      const incident = await this.incidentsService.findOrCreateForAlert({
        serviceId: integration.serviceId,
        severity: payload.severity,
        title: payload.title || payload.alertName || 'Unnamed Alert',
      });
      incidentId = incident.id;
    }

    // 5. Insert alert
    const [alert] = await this.db.db.insert(alerts).values({
      fingerprint,
      integrationId: integration.id,
      incidentId,
      status: payload.status === 'resolved' ? 'resolved' : 'firing',
      severity: payload.severity,
      title: payload.title || payload.alertName || 'Alert',
      description: payload.description,
      source: payload.source || integration.name,
      labels: payload.labels || {},
      annotations: payload.annotations || {},
      rawPayload: payload.rawPayload,
      firedAt: payload.startsAt ? new Date(payload.startsAt) : new Date(),
      resolvedAt: payload.status === 'resolved' ? new Date() : null,
    }).returning();

    // 6. Emit event for WebSocket broadcast
    this.eventEmitter.emit('alert.created', alert);

    // 7. If resolved, check if incident should auto-resolve
    if (payload.status === 'resolved' && incidentId) {
      await this.checkIncidentAutoResolve(incidentId);
    }

    return alert;
  }

  private generateFingerprint(payload: CreateAlertDto): string {
    // Use labels for fingerprinting (like Prometheus/Grafana)
    const parts = [
      payload.alertName || payload.title,
      payload.source,
      ...Object.entries(payload.labels || {}).map(([k, v]) => `${k}=${v}`).sort(),
    ].filter(Boolean);
    
    return Buffer.from(parts.join('|')).toString('base64').substring(0, 64);
  }

  private async checkIncidentAutoResolve(incidentId: number) {
    const openAlerts = await this.db.db
      .select({ count: sql<number>`count(*)` })
      .from(alerts)
      .where(and(
        eq(alerts.incidentId, incidentId),
        eq(alerts.status, 'firing'),
      ));

    if (openAlerts[0]?.count === 0) {
      await this.incidentsService.autoResolve(incidentId);
    }
  }
}
```

#### Webhook Controller for Multiple Formats

Create `apps/api/src/modules/alerts/alerts.controller.ts`:
```typescript
import { Controller, Post, Body, Param, Headers, HttpCode, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AlertsService } from './alerts.service';
import { WebhookTransformerService } from './webhook-transformer.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class AlertsController {
  private readonly logger = new Logger(AlertsController.name);

  constructor(
    private readonly alertsService: AlertsService,
    private readonly transformer: WebhookTransformerService,
  ) {}

  @Post('v1/:integrationKey')
  @HttpCode(202)
  @ApiOperation({ summary: 'Receive webhook from any monitoring system' })
  async receiveWebhook(
    @Param('integrationKey') integrationKey: string,
    @Body() payload: any,
    @Headers('content-type') contentType: string,
    @Headers('user-agent') userAgent: string,
  ) {
    this.logger.log(`Received webhook for integration: ${integrationKey}`);
    
    // Detect source and transform to standard format
    const alerts = this.transformer.transform(payload, userAgent);
    
    // Ingest each alert
    const results = await Promise.all(
      alerts.map(alert => this.alertsService.ingestAlert(integrationKey, alert))
    );

    return { 
      status: 'accepted', 
      alertsProcessed: results.length,
    };
  }

  // Prometheus Alertmanager-specific endpoint
  @Post('prometheus/:integrationKey')
  @HttpCode(202)
  async receivePrometheus(
    @Param('integrationKey') integrationKey: string,
    @Body() payload: any,
  ) {
    const alerts = this.transformer.transformPrometheus(payload);
    const results = await Promise.all(
      alerts.map(alert => this.alertsService.ingestAlert(integrationKey, alert))
    );
    return { status: 'accepted', alertsProcessed: results.length };
  }

  // Grafana Alerting-specific endpoint
  @Post('grafana/:integrationKey')
  @HttpCode(202)
  async receiveGrafana(
    @Param('integrationKey') integrationKey: string,
    @Body() payload: any,
  ) {
    const alerts = this.transformer.transformGrafana(payload);
    const results = await Promise.all(
      alerts.map(alert => this.alertsService.ingestAlert(integrationKey, alert))
    );
    return { status: 'accepted', alertsProcessed: results.length };
  }
}
```

### Week 3: Escalation Engine with BullMQ

#### Escalation Queue Setup

Create `apps/api/src/queues/escalation.queue.ts`:
```typescript
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';

export interface EscalationJobData {
  incidentId: number;
  escalationPolicyId: number;
  currentLevel: number;
  attempt: number;
}

@Injectable()
export class EscalationQueueService implements OnModuleInit {
  private readonly logger = new Logger(EscalationQueueService.name);
  private queue: Queue<EscalationJobData>;
  private worker: Worker<EscalationJobData>;
  private connection: IORedis;

  constructor(private readonly config: ConfigService) {
    this.connection = new IORedis({
      host: config.get('REDIS_HOST', 'localhost'),
      port: config.get('REDIS_PORT', 6379),
      maxRetriesPerRequest: null,
    });

    this.queue = new Queue('escalations', {
      connection: this.connection,
      defaultJobOptions: {
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
  }

  async onModuleInit() {
    // Worker is initialized in EscalationWorkerService
    this.logger.log('Escalation queue initialized');
  }

  async scheduleEscalation(
    incidentId: number,
    escalationPolicyId: number,
    level: number,
    delayMinutes: number,
  ): Promise<Job<EscalationJobData>> {
    const jobId = `escalation:${incidentId}:level-${level}`;
    
    // Remove existing job if any (prevents duplicates)
    const existing = await this.queue.getJob(jobId);
    if (existing) {
      await existing.remove();
    }

    return this.queue.add(
      'escalate',
      {
        incidentId,
        escalationPolicyId,
        currentLevel: level,
        attempt: 1,
      },
      {
        jobId,
        delay: delayMinutes * 60 * 1000,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );
  }

  async cancelEscalation(incidentId: number): Promise<void> {
    // Cancel all levels for this incident
    for (let level = 1; level <= 10; level++) {
      const jobId = `escalation:${incidentId}:level-${level}`;
      const job = await this.queue.getJob(jobId);
      if (job) {
        const state = await job.getState();
        if (['delayed', 'waiting'].includes(state)) {
          await job.remove();
          this.logger.log(`Cancelled escalation job: ${jobId}`);
        }
      }
    }
  }
}
```

#### Notification Queue

Create `apps/api/src/queues/notification.queue.ts`:
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Queue, Worker, Job, UnrecoverableError } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';

export interface NotificationJobData {
  incidentId: number;
  userId: number;
  channel: 'email' | 'sms' | 'voice' | 'push' | 'slack';
  priority: 'critical' | 'high' | 'medium' | 'low';
  payload: {
    subject?: string;
    message: string;
    incidentUrl?: string;
    phoneNumber?: string;
    email?: string;
  };
}

@Injectable()
export class NotificationQueueService {
  private readonly logger = new Logger(NotificationQueueService.name);
  public queue: Queue<NotificationJobData>;
  private connection: IORedis;

  constructor(private readonly config: ConfigService) {
    this.connection = new IORedis({
      host: config.get('REDIS_HOST', 'localhost'),
      port: config.get('REDIS_PORT', 6379),
      maxRetriesPerRequest: null,
    });

    this.queue = new Queue('notifications', {
      connection: this.connection,
      defaultJobOptions: {
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 86400, count: 5000 },
      },
    });
  }

  async queueNotification(data: NotificationJobData): Promise<Job> {
    const priorityMap = { critical: 1, high: 2, medium: 5, low: 10 };
    const attemptsByChannel = {
      email: 5,
      sms: 4,
      voice: 3,
      push: 4,
      slack: 5,
    };

    return this.queue.add(data.channel, data, {
      priority: priorityMap[data.priority],
      attempts: attemptsByChannel[data.channel],
      backoff: { type: 'exponential', delay: 2000 },
    });
  }

  async queueBulkNotifications(notifications: NotificationJobData[]): Promise<Job[]> {
    return Promise.all(notifications.map(n => this.queueNotification(n)));
  }
}
```

### Week 4: Authentication with Entra ID

See `Entra_ID___SSO_for_Node_js.md` for complete implementation details.

Create `apps/api/src/modules/auth/auth.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { MsalService } from './msal.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, MsalService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
```

---

## Phase 2: Advanced Features (Weeks 5-8)

### Week 5-6: On-Call Scheduling

**Key Components:**
1. Schedule with multiple rotations
2. Override management
3. "Who's on call now?" resolution
4. Calendar sync (Google/Outlook)

**Database tables already defined in schema.ts**

**Implementation priority:**
1. `SchedulesService` - CRUD for schedules
2. `RotationsService` - Rotation logic
3. `OnCallResolverService` - Determine current on-call
4. `ScheduleOverridesService` - Handle overrides

### Week 7: Real-time WebSocket Updates

Create `apps/api/src/websocket/incidents.gateway.ts`:
```typescript
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards, Logger } from '@nestjs/common';
import { WsJwtGuard } from '../common/guards/ws-jwt.guard';
import { OnEvent } from '@nestjs/event-emitter';

interface AuthenticatedSocket extends Socket {
  userId: number;
  teamIds: number[];
}

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: 'incidents',
})
export class IncidentsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(IncidentsGateway.name);

  @WebSocketServer()
  server: Server;

  async handleConnection(client: AuthenticatedSocket) {
    this.logger.log(`Client connected: ${client.id}`);
    
    // Auto-join user's team rooms
    if (client.teamIds) {
      for (const teamId of client.teamIds) {
        client.join(`team:${teamId}`);
      }
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('subscribe:incident')
  handleSubscribeIncident(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() incidentId: number,
  ) {
    client.join(`incident:${incidentId}`);
    return { event: 'subscribed', data: { incidentId } };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('unsubscribe:incident')
  handleUnsubscribeIncident(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() incidentId: number,
  ) {
    client.leave(`incident:${incidentId}`);
    return { event: 'unsubscribed', data: { incidentId } };
  }

  // Event handlers for broadcasting updates
  @OnEvent('incident.created')
  handleIncidentCreated(incident: any) {
    this.server.to(`team:${incident.teamId}`).emit('incident:created', incident);
  }

  @OnEvent('incident.updated')
  handleIncidentUpdated(incident: any) {
    this.server.to(`incident:${incident.id}`).emit('incident:updated', incident);
    this.server.to(`team:${incident.teamId}`).emit('incident:updated', incident);
  }

  @OnEvent('incident.acknowledged')
  handleIncidentAcknowledged(data: { incident: any; user: any }) {
    this.server.to(`incident:${data.incident.id}`).emit('incident:acknowledged', data);
  }

  @OnEvent('alert.created')
  handleAlertCreated(alert: any) {
    if (alert.incidentId) {
      this.server.to(`incident:${alert.incidentId}`).emit('alert:created', alert);
    }
  }
}
```

### Week 8: Status Pages (Basic)

**Components:**
1. `StatusPagesService` - Manage status pages
2. `ComponentsService` - Status page components
3. `StatusUpdatesService` - Post incident updates
4. Public API endpoints (no auth required)

---

## Phase 3: Production Hardening (Weeks 9-12)

### Week 9-10: Testing Infrastructure

**Required test coverage:**
1. Unit tests for services (Jest)
2. Integration tests for API endpoints (Supertest)
3. E2E tests for critical flows
4. Load testing for webhook ingestion (k6 or Artillery)

**Test file structure:**
```
apps/api/
├── src/
├── test/
│   ├── unit/
│   │   ├── alerts.service.spec.ts
│   │   ├── incidents.service.spec.ts
│   │   └── escalation.service.spec.ts
│   ├── integration/
│   │   ├── alerts.controller.spec.ts
│   │   └── webhooks.spec.ts
│   └── e2e/
│       ├── incident-lifecycle.e2e-spec.ts
│       └── escalation-flow.e2e-spec.ts
```

### Week 11: Monitoring & Observability

1. **Metrics**: Prometheus metrics endpoint
2. **Logging**: Structured JSON logging with correlation IDs
3. **Tracing**: OpenTelemetry integration
4. **Health checks**: Kubernetes-ready endpoints

### Week 12: Docker Production Build

Create `docker/Dockerfile`:
```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
RUN npm ci
COPY . .
RUN npm run build -w @openalert/api

# Production stage
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3001
USER node
CMD ["node", "dist/main.js"]
```

---

## Environment Variables Reference

Create `.env.example`:
```bash
# Application
NODE_ENV=development
PORT=3001
ALLOWED_ORIGINS=http://localhost:3000

# Database
DATABASE_URL=postgresql://openalert:openalert_dev@localhost:5432/openalert

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Azure Entra ID
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret

# JWT
JWT_SECRET=your-32-character-minimum-secret-key

# Notifications (Phase 2)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
SENDGRID_API_KEY=
```

---

## Commands Reference

```bash
# Start development environment
docker-compose -f docker/docker-compose.yml up -d
cd apps/api && npm run start:dev

# Database operations
npm run db:generate  # Generate migrations from schema changes
npm run db:migrate   # Apply migrations
npm run db:studio    # Open Drizzle Studio

# Testing
npm test             # Unit tests
npm run test:e2e     # E2E tests
npm run test:cov     # Coverage report

# Build
npm run build        # TypeScript compilation
docker build -f docker/Dockerfile -t openalert-api .
```

---

## Success Criteria for Each Phase

### Phase 1 Complete When:
- [ ] Docker Compose starts PostgreSQL and Redis
- [ ] API starts and Swagger docs accessible
- [ ] Webhook endpoint accepts Prometheus/Grafana alerts
- [ ] Alerts create incidents automatically
- [ ] Incidents can be acknowledged/resolved via API
- [ ] Basic escalation triggers notifications (console log OK)
- [ ] Entra ID login works

### Phase 2 Complete When:
- [ ] On-call schedules can be created with rotations
- [ ] "Who's on call" returns correct user
- [ ] WebSocket updates work for incident changes
- [ ] Basic status page serves public endpoint

### Phase 3 Complete When:
- [ ] 80%+ test coverage on critical paths
- [ ] Production Docker image builds
- [ ] Health check endpoints respond
- [ ] Metrics endpoint serves Prometheus format
- [ ] Load test handles 1000 alerts/minute
