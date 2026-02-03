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
export const serviceStatusEnum = pgEnum('service_status', [
  'operational',
  'degraded',
  'outage',
  'maintenance',
]);
export const userRoleEnum = pgEnum('user_role', ['superadmin', 'admin', 'responder', 'observer']);
export const teamRoleEnum = pgEnum('team_role', ['team_admin', 'member', 'observer']);

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
    externalId: varchar('external_id', { length: 255 }).unique(), // Entra ID oid (nullable for local users)
    email: varchar('email', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }), // For local auth
    authProvider: varchar('auth_provider', { length: 50 }).default('local'), // local, azure_ad, google, etc.
    role: varchar('role', { length: 50 }).default('responder').notNull(), // Global role: superadmin, admin, responder, observer
    phoneNumber: varchar('phone_number', { length: 50 }),
    timezone: varchar('timezone', { length: 100 }).default('UTC'),
    isActive: boolean('is_active').default(true).notNull(),
    lastLoginAt: timestamp('last_login_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index('users_email_idx').on(table.email),
    externalIdIdx: index('users_external_id_idx').on(table.externalId),
    roleIdx: index('users_role_idx').on(table.role),
  }),
);

// System Settings
export const systemSettings = pgTable('system_settings', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 255 }).notNull().unique(),
  value: jsonb('value'),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

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
    teamRole: varchar('team_role', { length: 50 }).default('member').notNull(), // team_admin, member, observer
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
    status: serviceStatusEnum('status').default('operational').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex('services_slug_idx').on(table.slug),
    teamIdx: index('services_team_idx').on(table.teamId),
  }),
);

// Service Dependencies (tracks which services depend on others)
export const serviceDependencies = pgTable(
  'service_dependencies',
  {
    id: serial('id').primaryKey(),
    serviceId: integer('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    dependsOnServiceId: integer('depends_on_service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    uniqueDependency: uniqueIndex('unique_service_dependency').on(
      table.serviceId,
      table.dependsOnServiceId,
    ),
    serviceIdx: index('service_dependencies_service_idx').on(table.serviceId),
    dependsOnIdx: index('service_dependencies_depends_on_idx').on(table.dependsOnServiceId),
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

// User Notification Preferences
export const userNotificationPreferences = pgTable('user_notification_preferences', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  emailEnabled: boolean('email_enabled').default(true).notNull(),
  smsEnabled: boolean('sms_enabled').default(false).notNull(),
  pushEnabled: boolean('push_enabled').default(true).notNull(),
  slackEnabled: boolean('slack_enabled').default(false).notNull(),
  quietHoursStart: varchar('quiet_hours_start', { length: 10 }), // HH:MM format
  quietHoursEnd: varchar('quiet_hours_end', { length: 10 }), // HH:MM format
  notificationDelay: integer('notification_delay').default(0).notNull(), // Minutes
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
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

// Alert Routing Rules
export const alertRoutingRules = pgTable(
  'alert_routing_rules',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    priority: integer('priority').default(0).notNull(), // Higher = evaluated first
    enabled: boolean('enabled').default(true).notNull(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    // Conditions (JSONB for flexibility)
    // Example: { labels: {key: value}, source: "grafana", severity: ["critical", "high"] }
    conditions: jsonb('conditions').$type<Record<string, unknown>>(),
    // Actions (JSONB)
    // Example: { route_to_service_id: 1, set_severity: "critical", suppress: false, add_tags: ["tag1"] }
    actions: jsonb('actions').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    teamIdx: index('alert_routing_rules_team_idx').on(table.teamId),
    priorityIdx: index('alert_routing_rules_priority_idx').on(table.priority),
  }),
);

// Alert Routing Matches (tracks which rules matched alerts)
export const alertRoutingMatches = pgTable(
  'alert_routing_matches',
  {
    id: serial('id').primaryKey(),
    alertId: integer('alert_id')
      .notNull()
      .references(() => alerts.id, { onDelete: 'cascade' }),
    ruleId: integer('rule_id')
      .notNull()
      .references(() => alertRoutingRules.id, { onDelete: 'cascade' }),
    matchedAt: timestamp('matched_at').defaultNow().notNull(),
  },
  (table) => ({
    alertIdx: index('alert_routing_matches_alert_idx').on(table.alertId),
    ruleIdx: index('alert_routing_matches_rule_idx').on(table.ruleId),
  }),
);

// Status Pages (Public-facing incident status)
export const statusPages = pgTable('status_pages', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  description: text('description'),
  isPublic: boolean('is_public').default(true).notNull(),
  customDomain: varchar('custom_domain', { length: 255 }),
  themeColor: varchar('theme_color', { length: 7 }).default('#6366f1'),
  logoUrl: varchar('logo_url', { length: 500 }),
  headerHtml: text('header_html'),
  footerHtml: text('footer_html'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Status Page Components
export const statusPageComponents = pgTable('status_page_components', {
  id: serial('id').primaryKey(),
  statusPageId: integer('status_page_id')
    .notNull()
    .references(() => statusPages.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 50 }).default('operational').notNull(), // operational, degraded_performance, partial_outage, major_outage, under_maintenance
  position: integer('position').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Status Page Services (linking services to status pages)
export const statusPageServices = pgTable('status_page_services', {
  id: serial('id').primaryKey(),
  statusPageId: integer('status_page_id')
    .notNull()
    .references(() => statusPages.id, { onDelete: 'cascade' }),
  serviceId: integer('service_id')
    .notNull()
    .references(() => services.id, { onDelete: 'cascade' }),
  displayOrder: integer('display_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Status Page Incidents
export const statusPageIncidents = pgTable('status_page_incidents', {
  id: serial('id').primaryKey(),
  statusPageId: integer('status_page_id')
    .notNull()
    .references(() => statusPages.id, { onDelete: 'cascade' }),
  internalIncidentId: integer('internal_incident_id').references(() => incidents.id),
  title: varchar('title', { length: 500 }).notNull(),
  status: varchar('status', { length: 50 }).default('investigating').notNull(), // investigating, identified, monitoring, resolved
  impact: varchar('impact', { length: 50 }).default('minor').notNull(), // minor, major, critical
  componentIds: jsonb('component_ids').$type<number[]>(), // Affected components
  scheduledFor: timestamp('scheduled_for'), // For scheduled maintenance
  scheduledUntil: timestamp('scheduled_until'),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Status Page Incident Updates
export const statusPageUpdates = pgTable(
  'status_page_updates',
  {
    id: serial('id').primaryKey(),
    incidentId: integer('incident_id')
      .notNull()
      .references(() => statusPageIncidents.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 50 }).notNull(),
    message: text('message').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    incidentIdx: index('status_updates_incident_idx').on(table.incidentId),
    createdAtIdx: index('status_updates_created_at_idx').on(table.createdAt),
  }),
);

// Relations
export const teamsRelations = relations(teams, ({ many }) => ({
  members: many(teamMembers),
  services: many(services),
  schedules: many(schedules),
  escalationPolicies: many(escalationPolicies),
  statusPages: many(statusPages),
  alertRoutingRules: many(alertRoutingRules),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  teamMemberships: many(teamMembers),
  incidents: many(incidents, { relationName: 'assignee' }),
  notificationPreferences: one(userNotificationPreferences, {
    fields: [users.id],
    references: [userNotificationPreferences.userId],
  }),
}));

export const servicesRelations = relations(services, ({ one, many }) => ({
  team: one(teams, { fields: [services.teamId], references: [teams.id] }),
  integrations: many(integrations),
  incidents: many(incidents),
  dependencies: many(serviceDependencies, { relationName: 'serviceDependencies' }),
  dependents: many(serviceDependencies, { relationName: 'dependentServices' }),
}));

export const serviceDependenciesRelations = relations(serviceDependencies, ({ one }) => ({
  service: one(services, {
    fields: [serviceDependencies.serviceId],
    references: [services.id],
    relationName: 'serviceDependencies',
  }),
  dependsOnService: one(services, {
    fields: [serviceDependencies.dependsOnServiceId],
    references: [services.id],
    relationName: 'dependentServices',
  }),
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

export const integrationsRelations = relations(integrations, ({ one }) => ({
  service: one(services, { fields: [integrations.serviceId], references: [services.id] }),
}));

export const alertsRelations = relations(alerts, ({ one, many }) => ({
  incident: one(incidents, { fields: [alerts.incidentId], references: [incidents.id] }),
  integration: one(integrations, { fields: [alerts.integrationId], references: [integrations.id] }),
  routingMatches: many(alertRoutingMatches),
}));

export const schedulesRelations = relations(schedules, ({ one, many }) => ({
  team: one(teams, { fields: [schedules.teamId], references: [teams.id] }),
  rotations: many(scheduleRotations),
  overrides: many(scheduleOverrides),
}));

export const scheduleRotationsRelations = relations(scheduleRotations, ({ one, many }) => ({
  schedule: one(schedules, { fields: [scheduleRotations.scheduleId], references: [schedules.id] }),
  members: many(rotationMembers),
}));

export const rotationMembersRelations = relations(rotationMembers, ({ one }) => ({
  rotation: one(scheduleRotations, {
    fields: [rotationMembers.rotationId],
    references: [scheduleRotations.id],
  }),
  user: one(users, { fields: [rotationMembers.userId], references: [users.id] }),
}));

export const scheduleOverridesRelations = relations(scheduleOverrides, ({ one }) => ({
  schedule: one(schedules, { fields: [scheduleOverrides.scheduleId], references: [schedules.id] }),
  user: one(users, { fields: [scheduleOverrides.userId], references: [users.id] }),
}));

export const statusPagesRelations = relations(statusPages, ({ one, many }) => ({
  team: one(teams, { fields: [statusPages.teamId], references: [teams.id] }),
  components: many(statusPageComponents),
  services: many(statusPageServices),
  incidents: many(statusPageIncidents),
}));

export const statusPageComponentsRelations = relations(statusPageComponents, ({ one }) => ({
  statusPage: one(statusPages, {
    fields: [statusPageComponents.statusPageId],
    references: [statusPages.id],
  }),
}));

export const statusPageIncidentsRelations = relations(statusPageIncidents, ({ one, many }) => ({
  statusPage: one(statusPages, {
    fields: [statusPageIncidents.statusPageId],
    references: [statusPages.id],
  }),
  internalIncident: one(incidents, {
    fields: [statusPageIncidents.internalIncidentId],
    references: [incidents.id],
  }),
  updates: many(statusPageUpdates),
}));

export const statusPageUpdatesRelations = relations(statusPageUpdates, ({ one }) => ({
  incident: one(statusPageIncidents, {
    fields: [statusPageUpdates.incidentId],
    references: [statusPageIncidents.id],
  }),
}));

export const statusPageServicesRelations = relations(statusPageServices, ({ one }) => ({
  statusPage: one(statusPages, {
    fields: [statusPageServices.statusPageId],
    references: [statusPages.id],
  }),
  service: one(services, {
    fields: [statusPageServices.serviceId],
    references: [services.id],
  }),
}));

export const alertRoutingRulesRelations = relations(alertRoutingRules, ({ one, many }) => ({
  team: one(teams, { fields: [alertRoutingRules.teamId], references: [teams.id] }),
  matches: many(alertRoutingMatches),
}));

export const alertRoutingMatchesRelations = relations(alertRoutingMatches, ({ one }) => ({
  alert: one(alerts, {
    fields: [alertRoutingMatches.alertId],
    references: [alerts.id],
  }),
  rule: one(alertRoutingRules, {
    fields: [alertRoutingMatches.ruleId],
    references: [alertRoutingRules.id],
  }),
}));

export const incidentTimelineRelations = relations(incidentTimeline, ({ one }) => ({
  incident: one(incidents, { fields: [incidentTimeline.incidentId], references: [incidents.id] }),
  user: one(users, { fields: [incidentTimeline.userId], references: [users.id] }),
}));

export const notificationLogsRelations = relations(notificationLogs, ({ one }) => ({
  incident: one(incidents, { fields: [notificationLogs.incidentId], references: [incidents.id] }),
  user: one(users, { fields: [notificationLogs.userId], references: [users.id] }),
}));

export const escalationPoliciesRelations = relations(escalationPolicies, ({ one, many }) => ({
  team: one(teams, { fields: [escalationPolicies.teamId], references: [teams.id] }),
  levels: many(escalationLevels),
}));

export const escalationLevelsRelations = relations(escalationLevels, ({ one, many }) => ({
  policy: one(escalationPolicies, {
    fields: [escalationLevels.policyId],
    references: [escalationPolicies.id],
  }),
  targets: many(escalationTargets),
}));

export const escalationTargetsRelations = relations(escalationTargets, ({ one }) => ({
  level: one(escalationLevels, {
    fields: [escalationTargets.levelId],
    references: [escalationLevels.id],
  }),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, { fields: [teamMembers.teamId], references: [teams.id] }),
  user: one(users, { fields: [teamMembers.userId], references: [users.id] }),
}));

// Audit Logs
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  teamId: integer('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  action: varchar('action', { length: 100 }).notNull(),
  resourceType: varchar('resource_type', { length: 50 }).notNull(),
  resourceId: integer('resource_id'),
  oldValues: jsonb('old_values'),
  newValues: jsonb('new_values'),
  metadata: jsonb('metadata'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
  team: one(teams, { fields: [auditLogs.teamId], references: [teams.id] }),
}));

// Webhook Logs (for debugging integrations)
export const webhookLogs = pgTable(
  'webhook_logs',
  {
    id: serial('id').primaryKey(),
    integrationKey: varchar('integration_key', { length: 64 }).notNull(),
    method: varchar('method', { length: 10 }).notNull(),
    path: varchar('path', { length: 500 }).notNull(),
    statusCode: integer('status_code').notNull(),
    requestHeaders: jsonb('request_headers').$type<Record<string, string>>(),
    requestBody: jsonb('request_body').$type<Record<string, unknown>>(),
    responseBody: jsonb('response_body').$type<Record<string, unknown>>(),
    userAgent: text('user_agent'),
    ipAddress: varchar('ip_address', { length: 45 }),
    processingTimeMs: integer('processing_time_ms'),
    error: text('error'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    integrationKeyIdx: index('webhook_logs_integration_key_idx').on(table.integrationKey),
    createdAtIdx: index('webhook_logs_created_at_idx').on(table.createdAt),
  }),
);

// Type exports
export type SystemSetting = typeof systemSettings.$inferSelect;
export type NewSystemSetting = typeof systemSettings.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Service = typeof services.$inferSelect;
export type NewService = typeof services.$inferInsert;
export type ServiceDependency = typeof serviceDependencies.$inferSelect;
export type NewServiceDependency = typeof serviceDependencies.$inferInsert;
export type Alert = typeof alerts.$inferSelect;
export type NewAlert = typeof alerts.$inferInsert;
export type Incident = typeof incidents.$inferSelect;
export type NewIncident = typeof incidents.$inferInsert;
export type EscalationPolicy = typeof escalationPolicies.$inferSelect;
export type Schedule = typeof schedules.$inferSelect;
export type StatusPage = typeof statusPages.$inferSelect;
export type NewStatusPage = typeof statusPages.$inferInsert;
export type StatusPageComponent = typeof statusPageComponents.$inferSelect;
export type NewStatusPageComponent = typeof statusPageComponents.$inferInsert;
export type StatusPageIncident = typeof statusPageIncidents.$inferSelect;
export type NewStatusPageIncident = typeof statusPageIncidents.$inferInsert;
export type StatusPageUpdate = typeof statusPageUpdates.$inferSelect;
export type NewStatusPageUpdate = typeof statusPageUpdates.$inferInsert;
export type Integration = typeof integrations.$inferSelect;
export type NewIntegration = typeof integrations.$inferInsert;
export type WebhookLog = typeof webhookLogs.$inferSelect;
export type NewWebhookLog = typeof webhookLogs.$inferInsert;
export type AlertRoutingRule = typeof alertRoutingRules.$inferSelect;
export type NewAlertRoutingRule = typeof alertRoutingRules.$inferInsert;
export type AlertRoutingMatch = typeof alertRoutingMatches.$inferSelect;
export type NewAlertRoutingMatch = typeof alertRoutingMatches.$inferInsert;
export type StatusPageService = typeof statusPageServices.$inferSelect;
export type NewStatusPageService = typeof statusPageServices.$inferInsert;
