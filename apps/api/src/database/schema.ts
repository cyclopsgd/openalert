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
export const incidentStatusEnum = pgEnum('incident_status', [
  'triggered',
  'acknowledged',
  'resolved',
]);
export const alertStatusEnum = pgEnum('alert_status', [
  'firing',
  'acknowledged',
  'resolved',
  'suppressed',
]);
export const notificationChannelEnum = pgEnum('notification_channel', [
  'email',
  'sms',
  'voice',
  'push',
  'slack',
  'teams',
]);

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
export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    externalId: varchar('external_id', { length: 255 }).notNull().unique(), // Entra ID oid
    email: varchar('email', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    phoneNumber: varchar('phone_number', { length: 50 }),
    timezone: varchar('timezone', { length: 100 }).default('UTC'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index('users_email_idx').on(table.email),
    externalIdIdx: index('users_external_id_idx').on(table.externalId),
  }),
);

// Team memberships
export const teamMembers = pgTable(
  'team_members',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 50 }).default('member').notNull(), // owner, admin, member
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    uniqueMembership: uniqueIndex('unique_team_member').on(table.teamId, table.userId),
  }),
);

// Services (what we're monitoring)
export const services = pgTable(
  'services',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    description: text('description'),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id),
    escalationPolicyId: integer('escalation_policy_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex('services_slug_idx').on(table.slug),
    teamIdx: index('services_team_idx').on(table.teamId),
  }),
);

// Integration endpoints (webhook receivers)
export const integrations = pgTable(
  'integrations',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    type: varchar('type', { length: 100 }).notNull(), // prometheus, grafana, azure_monitor, datadog, webhook
    serviceId: integer('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    integrationKey: varchar('integration_key', { length: 64 }).notNull().unique(),
    config: jsonb('config').$type<Record<string, unknown>>(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    keyIdx: uniqueIndex('integrations_key_idx').on(table.integrationKey),
  }),
);

// Alerts (individual alert events)
export const alerts = pgTable(
  'alerts',
  {
    id: serial('id').primaryKey(),
    fingerprint: varchar('fingerprint', { length: 255 }).notNull(),
    integrationId: integer('integration_id')
      .notNull()
      .references(() => integrations.id),
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
  },
  (table) => ({
    fingerprintIdx: index('alerts_fingerprint_idx').on(table.fingerprint),
    statusIdx: index('alerts_status_idx').on(table.status),
    incidentIdx: index('alerts_incident_idx').on(table.incidentId),
    firedAtIdx: index('alerts_fired_at_idx').on(table.firedAt),
  }),
);

// Incidents (grouped alerts)
export const incidents = pgTable(
  'incidents',
  {
    id: serial('id').primaryKey(),
    incidentNumber: serial('incident_number').notNull(),
    title: varchar('title', { length: 500 }).notNull(),
    status: incidentStatusEnum('status').default('triggered').notNull(),
    severity: severityEnum('severity').notNull(),
    serviceId: integer('service_id')
      .notNull()
      .references(() => services.id),
    assigneeId: integer('assignee_id').references(() => users.id),
    acknowledgedById: integer('acknowledged_by_id').references(() => users.id),
    resolvedById: integer('resolved_by_id').references(() => users.id),
    triggeredAt: timestamp('triggered_at').defaultNow().notNull(),
    acknowledgedAt: timestamp('acknowledged_at'),
    resolvedAt: timestamp('resolved_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    statusIdx: index('incidents_status_idx').on(table.status),
    serviceIdx: index('incidents_service_idx').on(table.serviceId),
    triggeredAtIdx: index('incidents_triggered_at_idx').on(table.triggeredAt),
  }),
);

// Escalation Policies
export const escalationPolicies = pgTable('escalation_policies', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  repeatCount: integer('repeat_count').default(3).notNull(),
  repeatDelayMinutes: integer('repeat_delay_minutes').default(5).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Escalation Policy Levels
export const escalationLevels = pgTable(
  'escalation_levels',
  {
    id: serial('id').primaryKey(),
    policyId: integer('policy_id')
      .notNull()
      .references(() => escalationPolicies.id, { onDelete: 'cascade' }),
    level: integer('level').notNull(), // 1, 2, 3...
    delayMinutes: integer('delay_minutes').default(5).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    policyLevelIdx: uniqueIndex('escalation_level_idx').on(table.policyId, table.level),
  }),
);

// Escalation Level Targets (who gets notified at each level)
export const escalationTargets = pgTable('escalation_targets', {
  id: serial('id').primaryKey(),
  levelId: integer('level_id')
    .notNull()
    .references(() => escalationLevels.id, { onDelete: 'cascade' }),
  targetType: varchar('target_type', { length: 50 }).notNull(), // user, schedule, team
  targetId: integer('target_id').notNull(), // userId, scheduleId, or teamId
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// On-Call Schedules
export const schedules = pgTable('schedules', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  timezone: varchar('timezone', { length: 100 }).default('UTC').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Schedule Rotations
export const scheduleRotations = pgTable('schedule_rotations', {
  id: serial('id').primaryKey(),
  scheduleId: integer('schedule_id')
    .notNull()
    .references(() => schedules.id, { onDelete: 'cascade' }),
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
  rotationId: integer('rotation_id')
    .notNull()
    .references(() => scheduleRotations.id, { onDelete: 'cascade' }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  position: integer('position').notNull(), // Order in rotation
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Schedule Overrides
export const scheduleOverrides = pgTable('schedule_overrides', {
  id: serial('id').primaryKey(),
  scheduleId: integer('schedule_id')
    .notNull()
    .references(() => schedules.id, { onDelete: 'cascade' }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Notification Log
export const notificationLogs = pgTable(
  'notification_logs',
  {
    id: serial('id').primaryKey(),
    incidentId: integer('incident_id')
      .notNull()
      .references(() => incidents.id),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    channel: notificationChannelEnum('channel').notNull(),
    status: varchar('status', { length: 50 }).notNull(), // pending, sent, delivered, failed
    sentAt: timestamp('sent_at'),
    deliveredAt: timestamp('delivered_at'),
    failureReason: text('failure_reason'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    incidentIdx: index('notification_logs_incident_idx').on(table.incidentId),
  }),
);

// Incident Timeline
export const incidentTimeline = pgTable(
  'incident_timeline',
  {
    id: serial('id').primaryKey(),
    incidentId: integer('incident_id')
      .notNull()
      .references(() => incidents.id, { onDelete: 'cascade' }),
    eventType: varchar('event_type', { length: 100 }).notNull(), // triggered, acknowledged, escalated, resolved, note_added
    userId: integer('user_id').references(() => users.id),
    description: text('description'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    incidentIdx: index('timeline_incident_idx').on(table.incidentId),
    createdAtIdx: index('timeline_created_at_idx').on(table.createdAt),
  }),
);

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
  assignee: one(users, {
    fields: [incidents.assigneeId],
    references: [users.id],
    relationName: 'assignee',
  }),
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
