# OpenAlert Backend - Deep Dive Documentation

**Version:** 0.1.0
**Last Updated:** January 29, 2026
**Architecture:** NestJS with PostgreSQL and Redis

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Database Architecture](#database-architecture)
6. [Module-by-Module Analysis](#module-by-module-analysis)
7. [Core Infrastructure](#core-infrastructure)
8. [Queue System](#queue-system)
9. [WebSocket Gateway](#websocket-gateway)
10. [Authentication & Authorization](#authentication--authorization)
11. [Deployment & Operations](#deployment--operations)
12. [Code Patterns & Practices](#code-patterns--practices)
13. [Integration Points](#integration-points)
14. [Security Considerations](#security-considerations)

---

## Executive Summary

OpenAlert is an enterprise-grade incident management platform built on NestJS, designed to compete with services like PagerDuty and Opsgenie. The backend is a pure API service (frontend removed) that handles:

- **Multi-source alert ingestion** via webhooks (Prometheus, Grafana, Azure Monitor, Datadog)
- **Intelligent incident grouping** and deduplication
- **Escalation policies** with multi-level notification chains
- **On-call schedule management** with rotations and overrides
- **Real-time updates** via WebSocket
- **Public status pages** for customer-facing incident communication
- **Azure AD SSO integration** for enterprise authentication

### Key Capabilities

- **Webhook Transformation**: Auto-detects and normalizes alerts from 5+ monitoring systems
- **Smart Deduplication**: Fingerprint-based alert grouping to prevent duplicate incidents
- **Escalation Engine**: BullMQ-powered job queue for time-delayed notifications
- **On-Call Resolution**: Complex algorithm for determining current on-call user based on rotations and overrides
- **Multi-tenant Ready**: Team-based isolation with role-based access control
- **WebSocket Real-time**: Incident updates pushed to clients in milliseconds

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    External Systems                          │
│  Prometheus │ Grafana │ Azure Monitor │ Datadog │ Custom    │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP Webhooks
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  NestJS API Server (Fastify)                │
├─────────────────────────────────────────────────────────────┤
│  Controllers (REST) │ WebSocket Gateway │ Guards & Pipes    │
├─────────────────────────────────────────────────────────────┤
│                     Business Logic Layer                     │
│  Alerts │ Incidents │ Schedules │ Users │ Status Pages      │
├─────────────────────────────────────────────────────────────┤
│                    Infrastructure Layer                      │
│  Database Service │ Queue System │ Event Emitter │ Auth     │
└─────────────────────────────────────────────────────────────┘
                       │                    │
                       ▼                    ▼
              ┌────────────────┐   ┌────────────────┐
              │   PostgreSQL   │   │     Redis      │
              │   (Drizzle)    │   │    (BullMQ)    │
              └────────────────┘   └────────────────┘
```

### Architectural Pattern

**Layered Architecture** with clear separation:

1. **Presentation Layer**: Controllers handle HTTP/WebSocket requests
2. **Business Logic Layer**: Services contain domain logic
3. **Data Access Layer**: Drizzle ORM abstracts database operations
4. **Infrastructure Layer**: Cross-cutting concerns (auth, queues, config)

### Key Design Decisions

- **Fastify over Express**: 2-3x faster HTTP performance
- **Drizzle ORM over TypeORM**: Type-safe SQL with minimal overhead
- **BullMQ over direct Redis**: Reliable job queue with retries and scheduling
- **Event-driven Architecture**: EventEmitter2 for decoupled module communication
- **Dependency Injection**: NestJS IoC container for testability and modularity

---

## Technology Stack

### Core Framework
- **NestJS 10.3.0**: Progressive Node.js framework
- **TypeScript 5.3.3**: Type-safe development
- **Fastify 7.0.4**: High-performance HTTP server

### Database & ORM
- **PostgreSQL**: Primary data store
- **Drizzle ORM 0.29.3**: Type-safe SQL query builder
- **pg 8.11.3**: PostgreSQL driver

### Queue & Caching
- **BullMQ 5.1.0**: Redis-backed job queue
- **ioredis 5.3.2**: Redis client
- **Redis**: Job queue and caching layer

### Authentication
- **@azure/msal-node 2.6.0**: Microsoft Authentication Library
- **@nestjs/jwt 10.2.0**: JWT token management
- **@nestjs/passport 10.0.3**: Authentication middleware
- **passport-jwt 4.0.1**: JWT strategy for Passport

### WebSocket
- **socket.io 4.7.4**: Real-time bidirectional communication
- **@socket.io/redis-adapter 8.2.1**: Redis adapter for scaling

### Validation & Documentation
- **class-validator 0.14.1**: DTO validation
- **class-transformer 0.5.1**: DTO transformation
- **@nestjs/swagger 7.2.0**: OpenAPI documentation generation

### Health & Monitoring
- **@nestjs/terminus 11.0.0**: Health check endpoints

### Development Tools
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **Jest**: Unit and integration testing
- **Drizzle Kit**: Database migration management

---

## Project Structure

```
apps/api/
├── src/
│   ├── main.ts                      # Application entry point
│   ├── app.module.ts                # Root module
│   ├── common/                      # Shared utilities
│   │   ├── decorators/
│   │   │   └── current-user.decorator.ts
│   │   └── guards/
│   │       ├── jwt-auth.guard.ts
│   │       └── ws-jwt.guard.ts
│   ├── database/                    # Database layer
│   │   ├── database.module.ts
│   │   ├── database.service.ts
│   │   ├── schema.ts                # Drizzle schema definitions
│   │   ├── migrations/              # SQL migrations
│   │   └── seeds/                   # Seed data
│   ├── modules/                     # Feature modules
│   │   ├── alerts/
│   │   │   ├── alerts.module.ts
│   │   │   ├── alerts.controller.ts
│   │   │   ├── alerts.service.ts
│   │   │   ├── webhook-transformer.service.ts
│   │   │   └── dto/
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── msal.service.ts
│   │   │   └── strategies/
│   │   │       └── jwt.strategy.ts
│   │   ├── health/
│   │   │   ├── health.module.ts
│   │   │   ├── health.controller.ts
│   │   │   └── metrics.controller.ts
│   │   ├── incidents/
│   │   │   ├── incidents.module.ts
│   │   │   ├── incidents.controller.ts
│   │   │   └── incidents.service.ts
│   │   ├── schedules/
│   │   │   ├── schedules.module.ts
│   │   │   ├── schedules.controller.ts
│   │   │   ├── schedules.service.ts
│   │   │   ├── rotations.service.ts
│   │   │   ├── overrides.service.ts
│   │   │   └── oncall-resolver.service.ts
│   │   ├── status-pages/
│   │   │   ├── status-pages.module.ts
│   │   │   ├── status-pages.controller.ts
│   │   │   ├── status-pages.service.ts
│   │   │   ├── components.service.ts
│   │   │   └── incidents.service.ts
│   │   └── users/
│   │       ├── users.module.ts
│   │       └── users.service.ts
│   ├── queues/                      # Job queue workers
│   │   ├── queues.module.ts
│   │   ├── notification.queue.ts
│   │   ├── notification.worker.ts
│   │   ├── escalation.queue.ts
│   │   └── escalation.worker.ts
│   └── websocket/                   # WebSocket gateway
│       ├── websocket.module.ts
│       └── incidents.gateway.ts
├── test/                            # E2E tests
├── drizzle.config.ts                # Drizzle configuration
├── nest-cli.json                    # NestJS CLI config
├── package.json
└── tsconfig.json
```

### Directory Organization Principles

1. **Feature-based modules**: Each domain concept is a self-contained module
2. **Common utilities**: Shared decorators, guards, pipes in `/common`
3. **Infrastructure separation**: Database, queues, WebSocket as separate layers
4. **DTOs with modules**: Each module owns its data transfer objects
5. **Dependency direction**: Modules depend on infrastructure, not vice versa

---

## Database Architecture

### Database Technology

**PostgreSQL 14+** with **Drizzle ORM**

**Why Drizzle?**
- Type-safe SQL queries with full IntelliSense
- Zero runtime overhead (compiles to SQL)
- Supports complex relational queries
- Built-in migration system
- Relations API for nested queries

### Entity Relationship Diagram

```
┌─────────────┐        ┌─────────────┐        ┌──────────────┐
│    Teams    │◄───────┤ TeamMembers ├───────►│    Users     │
└──────┬──────┘        └─────────────┘        └───────┬──────┘
       │                                               │
       │ 1:N                                          │ 1:N
       ▼                                              ▼
┌─────────────┐        ┌──────────────┐       ┌─────────────┐
│  Services   │◄───────┤ Integrations │       │  Schedules  │
└──────┬──────┘        └───────┬──────┘       └──────┬──────┘
       │                       │                      │
       │ 1:N                   │ 1:N                 │ 1:N
       ▼                       ▼                      ▼
┌─────────────┐        ┌──────────────┐    ┌──────────────────┐
│  Incidents  │◄───────┤    Alerts    │    │ ScheduleRotations│
└──────┬──────┘        └──────────────┘    └────────┬─────────┘
       │                                             │
       │ 1:N                                         │ 1:N
       ▼                                             ▼
┌─────────────┐                             ┌───────────────┐
│  Timeline   │                             │RotationMembers│
└─────────────┘                             └───────────────┘

┌─────────────┐        ┌──────────────────┐
│StatusPages  │◄───────┤   Components     │
└──────┬──────┘        └──────────────────┘
       │
       │ 1:N
       ▼
┌─────────────────┐    ┌──────────────────┐
│StatusPage       │◄───┤  StatusPage      │
│Incidents        │    │  Updates         │
└─────────────────┘    └──────────────────┘
```

### Complete Schema Overview

#### Core Entities

**1. Teams** (`teams`)
- Multi-tenant isolation boundary
- Each team owns services, schedules, escalation policies
- Fields: id, name, slug (unique), description, timestamps

**2. Users** (`users`)
- Provisioned via Azure AD SSO
- Fields: id, externalId (Azure OID), email (unique), name, phoneNumber, timezone, isActive, timestamps
- Indexes: email, externalId for fast lookups

**3. Team Members** (`team_members`)
- Join table: Users ↔ Teams
- Fields: id, teamId, userId, role (owner/admin/member), createdAt
- Unique constraint: (teamId, userId)

#### Alert & Incident Management

**4. Services** (`services`)
- Monitored systems/applications
- Fields: id, name, slug (unique), description, teamId, escalationPolicyId, timestamps
- Each service has multiple integrations

**5. Integrations** (`integrations`)
- Webhook endpoints for receiving alerts
- Fields: id, name, type (prometheus/grafana/azure_monitor/datadog/webhook), serviceId, integrationKey (unique), config (jsonb), isActive, timestamps
- Types: prometheus, grafana, azure_monitor, datadog, webhook

**6. Alerts** (`alerts`)
- Individual alert events from monitoring systems
- Fields: id, fingerprint, integrationId, incidentId, status (firing/acknowledged/resolved/suppressed), severity (critical/high/medium/low/info), title, description, source, labels (jsonb), annotations (jsonb), rawPayload (jsonb), firedAt, acknowledgedAt, resolvedAt, createdAt
- **Deduplication**: Alerts with same fingerprint are grouped
- **Fingerprint**: SHA-256 hash of alertName + source + sorted labels
- Indexes: fingerprint, status, incidentId, firedAt

**7. Incidents** (`incidents`)
- Grouped alerts representing a single problem
- Fields: id, incidentNumber (auto-increment display ID), title, status (triggered/acknowledged/resolved), severity, serviceId, assigneeId, acknowledgedById, resolvedById, triggeredAt, acknowledgedAt, resolvedAt, timestamps
- **Lifecycle**: triggered → acknowledged → resolved
- **Auto-resolve**: When all alerts are resolved
- Indexes: status, serviceId, triggeredAt

**8. Incident Timeline** (`incident_timeline`)
- Audit log of incident events
- Fields: id, incidentId, eventType (triggered/acknowledged/escalated/resolved/note_added), userId, description, metadata (jsonb), createdAt
- Used for incident history and debugging
- Indexes: incidentId, createdAt

#### Escalation System

**9. Escalation Policies** (`escalation_policies`)
- Define who gets notified and when
- Fields: id, name, teamId, repeatCount (how many times to repeat), repeatDelayMinutes, timestamps
- Example: "Level 1 → wait 5min → Level 2 → wait 10min → Level 3"

**10. Escalation Levels** (`escalation_levels`)
- Individual steps in an escalation policy
- Fields: id, policyId, level (1, 2, 3...), delayMinutes, createdAt
- Unique constraint: (policyId, level)

**11. Escalation Targets** (`escalation_targets`)
- Who to notify at each level
- Fields: id, levelId, targetType (user/schedule/team), targetId, createdAt
- **targetType = 'user'**: Notify specific user
- **targetType = 'team'**: Notify all team members
- **targetType = 'schedule'**: Notify whoever is on-call

**12. Notification Logs** (`notification_logs`)
- Track all notification attempts
- Fields: id, incidentId, userId, channel (email/sms/voice/push/slack/teams), status (pending/sent/delivered/failed), sentAt, deliveredAt, failureReason, metadata (jsonb), createdAt
- Used for delivery tracking and debugging
- Index: incidentId

#### On-Call Scheduling

**13. Schedules** (`schedules`)
- On-call schedule definitions
- Fields: id, name, teamId, timezone, timestamps
- Contains multiple rotations for follow-the-sun coverage

**14. Schedule Rotations** (`schedule_rotations`)
- Rotation patterns within a schedule
- Fields: id, scheduleId, name, rotationType (daily/weekly/custom), handoffTime (HH:MM), handoffDay (0-6 for weekly), effectiveFrom, effectiveUntil, createdAt
- **Daily**: Rotates every day at handoffTime
- **Weekly**: Rotates every week on handoffDay at handoffTime
- **Custom**: Reserved for future complex patterns

**15. Rotation Members** (`rotation_members`)
- Ordered list of users in rotation
- Fields: id, rotationId, userId, position (order in rotation), createdAt
- Position 0 is first on-call, position 1 is second, etc.

**16. Schedule Overrides** (`schedule_overrides`)
- Temporary on-call changes
- Fields: id, scheduleId, userId, startTime, endTime, reason, createdAt
- Highest priority when resolving on-call
- Use cases: vacation coverage, shift swaps, emergencies

#### Status Pages

**17. Status Pages** (`status_pages`)
- Public-facing incident communication
- Fields: id, name, slug (unique), teamId, description, isPublic, customDomain, logoUrl, headerHtml, footerHtml, timestamps
- Can be branded with custom HTML

**18. Status Page Components** (`status_page_components`)
- Services displayed on status page
- Fields: id, statusPageId, name, description, status (operational/degraded_performance/partial_outage/major_outage/under_maintenance), position (display order), timestamps

**19. Status Page Incidents** (`status_page_incidents`)
- Public incidents on status page
- Fields: id, statusPageId, internalIncidentId (optional link to internal incident), title, status (investigating/identified/monitoring/resolved), impact (minor/major/critical), componentIds (jsonb array), scheduledFor, scheduledUntil, resolvedAt, timestamps
- Can be manually created or linked to internal incidents

**20. Status Page Updates** (`status_page_updates`)
- Updates posted to incidents
- Fields: id, incidentId, status, message, createdAt
- Chronological updates: "Investigating" → "Identified" → "Monitoring" → "Resolved"
- Indexes: incidentId, createdAt

### Database Enums

```sql
-- Alert statuses
CREATE TYPE alert_status AS ENUM (
  'firing',        -- Alert is active
  'acknowledged',  -- Someone acknowledged it
  'resolved',      -- Alert cleared
  'suppressed'     -- Manually suppressed
);

-- Incident statuses
CREATE TYPE incident_status AS ENUM (
  'triggered',     -- New incident
  'acknowledged',  -- Someone is working on it
  'resolved'       -- Incident closed
);

-- Severity levels
CREATE TYPE severity AS ENUM (
  'critical',      -- SEV1 - service down
  'high',          -- SEV2 - major degradation
  'medium',        -- SEV3 - minor issues
  'low',           -- SEV4 - warnings
  'info'           -- Informational
);

-- Notification channels
CREATE TYPE notification_channel AS ENUM (
  'email',
  'sms',
  'voice',
  'push',
  'slack',
  'teams'
);
```

### Key Indexes

Performance-critical indexes:

```sql
-- Alert lookups
CREATE INDEX alerts_fingerprint_idx ON alerts(fingerprint);
CREATE INDEX alerts_status_idx ON alerts(status);
CREATE INDEX alerts_incident_idx ON alerts(incident_id);
CREATE INDEX alerts_fired_at_idx ON alerts(fired_at);

-- Incident queries
CREATE INDEX incidents_status_idx ON incidents(status);
CREATE INDEX incidents_service_idx ON incidents(service_id);
CREATE INDEX incidents_triggered_at_idx ON incidents(triggered_at);

-- User lookups
CREATE INDEX users_email_idx ON users(email);
CREATE INDEX users_external_id_idx ON users(external_id);

-- Timeline queries
CREATE INDEX timeline_incident_idx ON incident_timeline(incident_id);
CREATE INDEX timeline_created_at_idx ON incident_timeline(created_at);

-- Notification tracking
CREATE INDEX notification_logs_incident_idx ON notification_logs(incident_id);

-- Status page updates
CREATE INDEX status_updates_incident_idx ON status_page_updates(incident_id);
CREATE INDEX status_updates_created_at_idx ON status_page_updates(created_at);
```

### Database Connection Management

**Configuration** (`database.service.ts`):

```typescript
Pool Configuration:
- max: 20 connections
- idleTimeoutMillis: 30000 (30s)
- connectionTimeoutMillis: 2000 (2s)
```

**Connection Lifecycle**:
1. Pool initialized on module init
2. Connection tested with `SELECT 1`
3. Drizzle ORM wraps the pool
4. Pool closed on module destroy

**Query Interface**:
- `db.db`: Direct Drizzle database instance
- `db.query`: Relational query API (with relations)
- `db.db.execute(sql`...`)`: Raw SQL execution

### Migration Strategy

**Drizzle Kit** manages migrations:

```bash
# Generate migration from schema changes
npm run db:generate

# Push migration to database
npm run db:push

# Launch Drizzle Studio (GUI)
npm run db:studio
```

**Migration Files**:
- Stored in `src/database/migrations/`
- Naming: `0000_adjective_character.sql`
- Metadata in `meta/_journal.json`

**Current Migration**: `0000_normal_rhodey.sql`
- Creates all 20 tables
- Defines 4 enums
- Sets up all indexes
- Establishes foreign key constraints

### Seed Data

**Location**: `src/database/seeds/`

1. **seed-schedules.sql**: Sample on-call schedules
   - Teams, users, schedules
   - Daily and weekly rotations
   - Sample overrides

2. **seed-status-page.sql**: Sample status page
   - Status page with components
   - Sample incidents and updates

---

## Module-by-Module Analysis

### 1. Alerts Module

**Location**: `src/modules/alerts/`

**Responsibility**: Webhook ingestion and alert management

#### Controllers

**AlertsController** (webhook ingestion - no auth):
- `POST /webhooks/v1/:integrationKey` - Auto-detect webhook format
- `POST /webhooks/prometheus/:integrationKey` - Prometheus Alertmanager
- `POST /webhooks/grafana/:integrationKey` - Grafana Alerting
- `POST /webhooks/azure/:integrationKey` - Azure Monitor
- `POST /webhooks/datadog/:integrationKey` - Datadog

**AlertsManagementController** (authenticated):
- `GET /alerts` - List alerts (filterable by status, incidentId)
- `GET /alerts/:id` - Get alert details
- `PATCH /alerts/:id/acknowledge` - Acknowledge alert
- `PATCH /alerts/:id/resolve` - Resolve alert

#### Services

**AlertsService** (`alerts.service.ts`):

Core Methods:
```typescript
// Ingest alert from webhook
async ingestAlert(integrationKey: string, payload: CreateAlertDto): Promise<Alert>

// Generate fingerprint for deduplication
private generateFingerprint(payload: CreateAlertDto): string

// Acknowledge alert (also acknowledges incident)
async acknowledge(alertId: number, userId: number): Promise<Alert>

// Resolve alert (may auto-resolve incident)
async resolve(alertId: number): Promise<Alert>

// Get alert by ID with relations
async findById(id: number): Promise<Alert | undefined>

// List alerts with pagination and filters
async list(params: {
  status?: 'firing' | 'acknowledged' | 'resolved' | 'suppressed';
  incidentId?: number;
  limit?: number;
  offset?: number;
}): Promise<Alert[]>
```

**Ingestion Flow**:
1. Validate integration key (must exist and be active)
2. Generate fingerprint from alert payload
3. Check for existing firing alert with same fingerprint
   - If found: Update timestamp (heartbeat)
   - If not found: Create new alert
4. Find or create incident (unless alert is resolved)
5. Insert alert into database
6. Emit `alert.created` event for WebSocket broadcast
7. If resolved alert, trigger incident auto-resolve check

**Fingerprint Algorithm**:
```typescript
Parts: [alertName, source, ...sorted_labels]
Hash: SHA-256(parts.join('|'))
Result: First 64 characters of hash
```

Example:
```
Alert: "High CPU Usage"
Source: "prometheus"
Labels: {host: "web-01", severity: "warning"}

Fingerprint: SHA-256("High CPU Usage|prometheus|host=web-01|severity=warning")
```

**WebhookTransformerService** (`webhook-transformer.service.ts`):

Transforms external webhook formats to internal `CreateAlertDto`:

```typescript
// Auto-detect format and transform
transform(payload: any, userAgent?: string): CreateAlertDto[]

// Transform Prometheus Alertmanager webhook
transformPrometheus(payload: any): CreateAlertDto[]

// Transform Grafana Alerting webhook
transformGrafana(payload: any): CreateAlertDto[]

// Transform Azure Monitor webhook
transformAzureMonitor(payload: any): CreateAlertDto[]

// Transform Datadog webhook
transformDatadog(payload: any): CreateAlertDto[]

// Fallback for generic webhooks
transformGeneric(payload: any): CreateAlertDto[]
```

**Detection Logic**:
```typescript
// Prometheus: payload.alerts is array
if (payload.alerts && Array.isArray(payload.alerts))

// Grafana: payload.alerts exists and has orgId
if (payload.alerts && payload.orgId)

// Azure: nested data.essentials structure
if (payload.data && payload.data.essentials)

// Datadog: has alert_type or event_type
if (payload.alert_type || payload.event_type)

// Otherwise: generic webhook
```

**Severity Mapping**:

Each source system has different severity levels:

| Source System | Their Values | OpenAlert Mapping |
|--------------|--------------|-------------------|
| Prometheus | critical/warning/info | critical/high/info |
| Grafana | alerting/pending/ok | critical/high/info |
| Azure | Sev0/Sev1/Sev2/Sev3/Sev4 | critical/high/medium/low/info |
| Datadog | error/warning/info | critical/high/info |

#### DTOs

**CreateAlertDto** (`dto/create-alert.dto.ts`):

```typescript
class CreateAlertDto {
  alertName?: string;          // Alert identifier
  title?: string;              // Display title
  description?: string;        // Long description
  severity: AlertSeverity;     // critical/high/medium/low/info
  status?: AlertStatus;        // firing/resolved
  source?: string;             // Source system name
  labels?: Record<string, string>;        // Key-value labels
  annotations?: Record<string, string>;   // Additional metadata
  startsAt?: string;           // ISO 8601 timestamp
  endsAt?: string;             // ISO 8601 timestamp
  generatorURL?: string;       // Link to source system
  rawPayload?: Record<string, unknown>;  // Original payload
}

enum AlertSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info',
}

enum AlertStatus {
  FIRING = 'firing',
  RESOLVED = 'resolved',
}
```

#### Events Emitted

- `alert.created` - New alert ingested
- `alert.acknowledged` - Alert acknowledged
- `alert.resolved` - Alert resolved

#### Dependencies

- **IncidentsModule**: For creating/finding incidents
- **DatabaseModule**: For data persistence
- **EventEmitter2**: For broadcasting events

#### Example Webhook Flow

**Prometheus Alertmanager**:

1. Alert fires in Prometheus
2. Alertmanager sends webhook:
```json
{
  "alerts": [{
    "status": "firing",
    "labels": {
      "alertname": "HighMemoryUsage",
      "severity": "critical",
      "host": "web-01"
    },
    "annotations": {
      "summary": "Memory usage above 90%",
      "description": "Host web-01 memory at 94%"
    },
    "startsAt": "2026-01-29T10:00:00Z",
    "generatorURL": "http://prometheus:9090/graph?..."
  }]
}
```

3. OpenAlert receives at `/webhooks/prometheus/abc123`
4. Transforms to internal format
5. Generates fingerprint: `a1b2c3d4...`
6. Creates alert and incident
7. Triggers escalation policy
8. Queues notifications

---

### 2. Incidents Module

**Location**: `src/modules/incidents/`

**Responsibility**: Incident lifecycle management

#### Controllers

**IncidentsController** (all authenticated):
- `GET /incidents` - List incidents (filters: status, serviceId, pagination)
- `GET /incidents/:id` - Get incident details with alerts and timeline
- `PATCH /incidents/:id/acknowledge` - Acknowledge incident
- `PATCH /incidents/:id/resolve` - Resolve incident

#### Services

**IncidentsService** (`incidents.service.ts`):

Core Methods:
```typescript
// Find existing or create new incident for alert
async findOrCreateForAlert(params: CreateIncidentParams): Promise<Incident>

// Trigger escalation for new incident
private async triggerEscalation(
  incidentId: number,
  escalationPolicyId: number
): Promise<void>

// User acknowledges incident
async acknowledge(incidentId: number, userId: number): Promise<Incident>

// User resolves incident
async resolve(incidentId: number, userId: number): Promise<Incident>

// Auto-resolve when all alerts are resolved
async autoResolve(incidentId: number): Promise<void>

// Get incident with full relations
async findById(id: number): Promise<Incident | undefined>

// List incidents with filters and pagination
async list(params: {
  status?: 'triggered' | 'acknowledged' | 'resolved';
  serviceId?: number;
  limit?: number;
  offset?: number;
}): Promise<Incident[]>
```

**Incident Creation Logic** (`findOrCreateForAlert`):

```typescript
1. Check for existing triggered incident:
   - Same serviceId
   - Same severity
   - Status = 'triggered'
   - Order by triggeredAt DESC

2. If found:
   - Reuse existing incident
   - Add new alert to it
   - Log: "Reusing existing incident #123"

3. If not found:
   - Create new incident
   - Set status = 'triggered'
   - Generate incident number (auto-increment)
   - Add timeline entry: "Incident triggered"
   - Emit 'incident.created' event
   - Trigger escalation if service has policy

4. Return incident
```

**Escalation Trigger**:
```typescript
1. Load service to get escalationPolicyId
2. If no policy: skip escalation
3. Load first escalation level (level = 1)
4. Schedule job: EscalationQueue.scheduleEscalation(
     incidentId,
     policyId,
     level=1,
     delayMinutes
   )
5. Job will execute after delay
6. Log: "Triggered escalation for incident X with policy Y"
```

**Acknowledge Flow**:
```typescript
1. Load incident from database
2. Validate: status must be 'triggered'
   - If not triggered: warn and return
3. Update incident:
   - status = 'acknowledged'
   - acknowledgedAt = now
   - acknowledgedById = userId
4. Add timeline entry: "Incident acknowledged"
5. Cancel pending escalation jobs
6. Emit 'incident.acknowledged' event
7. WebSocket broadcasts to clients
```

**Resolve Flow**:
```typescript
1. Load incident from database
2. Validate: status must not be 'resolved'
   - If already resolved: warn and return
3. Update incident:
   - status = 'resolved'
   - resolvedAt = now
   - resolvedById = userId
4. Add timeline entry: "Incident resolved"
5. Cancel pending escalation jobs
6. Emit 'incident.resolved' event
7. WebSocket broadcasts to clients
```

**Auto-Resolve Logic**:
```typescript
1. Load incident
2. If already resolved: skip
3. Count firing alerts:
   SELECT COUNT(*) FROM alerts
   WHERE incident_id = X AND status = 'firing'
4. If count = 0:
   - Update incident status = 'resolved'
   - resolvedAt = now
   - Add timeline: "Auto-resolved (all alerts resolved)"
   - Emit 'incident.auto_resolved' event
5. Log: "Incident #X auto-resolved"
```

#### Events Emitted

- `incident.created` - New incident created
- `incident.acknowledged` - Incident acknowledged
- `incident.resolved` - Incident manually resolved
- `incident.auto_resolved` - Incident auto-resolved

#### Dependencies

- **EscalationQueueService**: For scheduling notifications (circular dependency handled with `forwardRef`)
- **DatabaseModule**: For data persistence
- **EventEmitter2**: For broadcasting events

#### Incident Lifecycle State Machine

```
                    ┌──────────────┐
                    │  (no alert)  │
                    └──────┬───────┘
                           │ Alert fires
                           ▼
                   ┌───────────────┐
             ┌─────┤   TRIGGERED   │◄──────┐
             │     └───────┬───────┘       │
             │             │                │
             │             │ User ACKs      │
             │             ▼                │
             │     ┌───────────────┐       │
             │     │ ACKNOWLEDGED  │       │
             │     └───────┬───────┘       │
             │             │                │
             │             │ User resolves  │
             │             │ OR             │
             │             │ Auto-resolve   │
             │             ▼                │
             │     ┌───────────────┐       │
             └────►│   RESOLVED    │       │
                   └───────────────┘       │
                           │               │
                           │ New alert     │
                           │ (reopen)      │
                           └───────────────┘
```

#### Timeline Events

Every state change adds a timeline entry:

| Event Type | Description | User ID | Metadata |
|-----------|-------------|---------|----------|
| triggered | Incident created | null | Initial alert info |
| acknowledged | User acknowledged | userId | Timestamp |
| escalated | Escalation level triggered | null | Level number |
| resolved | Manually resolved | userId | Resolution notes |
| auto_resolved | All alerts resolved | null | Alert count |
| note_added | User added note | userId | Note content |

---

### 3. Auth Module

**Location**: `src/modules/auth/`

**Responsibility**: Authentication and authorization

#### Controllers

**AuthController**:
- `GET /auth/login?redirect=` - Initiate Azure AD login
- `GET /auth/callback?code=&state=` - OAuth callback handler
- `GET /auth/profile` - Get current user (authenticated)
- `POST /auth/logout` - Logout (client-side token removal)
- `GET /auth/dev-token/:userId` - Generate dev token (development only)

#### Services

**AuthService** (`auth.service.ts`):

Core Methods:
```typescript
// Get Azure AD login URL
async getLoginUrl(redirectUri: string, state?: string): Promise<string>

// Handle OAuth callback
async handleCallback(code: string, redirectUri: string): Promise<{
  accessToken: string;
  user: { id, email, name };
}>

// Validate JWT token
async validateToken(token: string): Promise<UserData>

// Generate dev token (dev only)
async generateDevToken(userId: number): Promise<string>
```

**MsalService** (`msal.service.ts`):

Azure AD integration via MSAL (Microsoft Authentication Library):

```typescript
// Initialize MSAL client
constructor(configService: ConfigService) {
  const msalConfig = {
    auth: {
      clientId: env.AZURE_CLIENT_ID,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      clientSecret: env.AZURE_CLIENT_SECRET,
    }
  };
  this.msalClient = new ConfidentialClientApplication(msalConfig);
}

// Generate auth URL
async getAuthCodeUrl(redirectUri: string, state?: string): Promise<string> {
  return msalClient.getAuthCodeUrl({
    scopes: ['user.read', 'openid', 'profile', 'email'],
    redirectUri,
    state
  });
}

// Exchange code for token
async acquireTokenByCode(
  code: string,
  redirectUri: string
): Promise<AuthenticationResult>
```

**JwtStrategy** (`strategies/jwt.strategy.ts`):

Passport strategy for JWT validation:

```typescript
interface JwtPayload {
  sub: string;      // User ID
  email: string;
  name: string;
  oid?: string;     // Azure AD object ID
}

// Validate JWT token
async validate(payload: JwtPayload) {
  1. Extract user ID from payload.sub
  2. Load user from database
  3. Validate user exists and is active
  4. Return user object (attached to request.user)
}
```

#### Guards

**JwtAuthGuard** (`common/guards/jwt-auth.guard.ts`):

Protects HTTP routes:
```typescript
@UseGuards(JwtAuthGuard)
@Get('protected')
async protectedRoute(@CurrentUser() user: CurrentUserData) {
  // user is automatically injected
}
```

**WsJwtGuard** (`common/guards/ws-jwt.guard.ts`):

Protects WebSocket connections:
```typescript
async canActivate(context: ExecutionContext): Promise<boolean> {
  1. Extract token from:
     - client.handshake.auth.token
     - client.handshake.headers.authorization
     - client.handshake.query.token
  2. Verify JWT with JwtService
  3. Load user from database
  4. Attach to socket: client.userId, client.user
  5. Load user's team IDs
  6. Auto-join team rooms: client.join(`team:${teamId}`)
  7. Return true if valid, throw WsException if not
}
```

#### Decorators

**@CurrentUser()** (`common/decorators/current-user.decorator.ts`):

Extracts authenticated user from request:
```typescript
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CurrentUserData => {
    const request = ctx.switchToHttp().getRequest();
    return request.user; // Set by JwtStrategy
  }
);

// Usage
async someMethod(@CurrentUser() user: CurrentUserData) {
  console.log(user.id, user.email, user.name);
}
```

#### Authentication Flow

**Full OAuth Flow**:

```
1. User clicks "Login" in frontend
   ↓
2. Frontend redirects to /auth/login?redirect=/dashboard
   ↓
3. Backend generates Azure AD URL:
   https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize
   ?client_id=...
   &response_type=code
   &redirect_uri=http://api/auth/callback
   &scope=user.read openid profile email
   &state=base64(redirect_url)
   ↓
4. Backend redirects browser to Azure AD
   ↓
5. User logs in with Microsoft account
   ↓
6. Azure AD redirects to /auth/callback?code=abc123&state=xyz
   ↓
7. Backend exchanges code for token:
   POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
   {
     grant_type: 'authorization_code',
     code: 'abc123',
     client_id: '...',
     client_secret: '...',
     redirect_uri: 'http://api/auth/callback'
   }
   ↓
8. Azure AD returns:
   {
     access_token: '...',
     account: {
       localAccountId: '...',  // Azure OID
       username: 'user@domain.com',
       name: 'John Doe'
     }
   }
   ↓
9. Backend provisions/updates user:
   - Check if user exists by externalId
   - If not: INSERT INTO users
   - If yes: UPDATE email/name if changed
   ↓
10. Backend generates JWT:
    {
      sub: userId,
      email: 'user@domain.com',
      name: 'John Doe',
      oid: 'azure-oid',
      exp: now + 7 days
    }
    ↓
11. Backend redirects to frontend:
    http://frontend/dashboard?token=jwt_token
    ↓
12. Frontend stores token in localStorage
    ↓
13. Frontend makes API calls:
    Authorization: Bearer jwt_token
```

**Subsequent Request Flow**:

```
1. Client sends request:
   GET /incidents
   Authorization: Bearer eyJhbGc...
   ↓
2. JwtAuthGuard intercepts
   ↓
3. JwtStrategy.validate() called:
   - Verify token signature
   - Check expiration
   - Extract payload
   - Load user from DB
   - Attach to request.user
   ↓
4. Controller receives request with user:
   async list(@CurrentUser() user) { ... }
   ↓
5. Response sent
```

#### Development Mode

When Azure credentials not configured:

```typescript
// Skip MSAL initialization
if (clientId === 'dev-client-id') {
  logger.warn('Azure Entra ID not configured');
  return;
}

// Use dev token endpoint instead:
GET /auth/dev-token/1
→ { token: 'eyJhbGc...' }

// This bypasses Azure AD and generates JWT directly
```

#### Security Features

1. **JWT Expiration**: 7 days
2. **Token Verification**: Signature and expiration checked on every request
3. **User Active Check**: Validates user.isActive = true
4. **CORS Protection**: Configurable allowed origins
5. **State Parameter**: Prevents CSRF in OAuth flow
6. **HTTPS Required**: In production (Fastify config)

---

### 4. Schedules Module

**Location**: `src/modules/schedules/`

**Responsibility**: On-call schedule management and resolution

#### Controllers

**SchedulesController**:

Schedules:
- `POST /schedules` - Create schedule
- `GET /schedules/:id` - Get schedule
- `GET /schedules/team/:teamId` - List team schedules
- `PATCH /schedules/:id` - Update schedule
- `DELETE /schedules/:id` - Delete schedule
- `GET /schedules/:id/oncall?at=` - Get current on-call user

Rotations:
- `POST /schedules/:id/rotations` - Create rotation
- `GET /schedules/rotations/:rotationId` - Get rotation
- `PATCH /schedules/rotations/:rotationId` - Update rotation
- `DELETE /schedules/rotations/:rotationId` - Delete rotation
- `PATCH /schedules/rotations/:rotationId/members` - Update member order
- `POST /schedules/rotations/:rotationId/members` - Add member
- `DELETE /schedules/rotations/:rotationId/members/:userId` - Remove member

Overrides:
- `POST /schedules/:id/overrides` - Create override
- `GET /schedules/:id/overrides` - List overrides
- `GET /schedules/overrides/:overrideId` - Get override
- `PATCH /schedules/overrides/:overrideId` - Update override
- `DELETE /schedules/overrides/:overrideId` - Delete override

#### Services

**SchedulesService** (`schedules.service.ts`):

```typescript
// Create on-call schedule
async create(data: CreateScheduleDto): Promise<Schedule>

// Get schedule with rotations and members
async findById(id: number): Promise<Schedule>

// List schedules for team
async findByTeam(teamId: number): Promise<Schedule[]>

// Update schedule
async update(id: number, data: UpdateScheduleDto): Promise<Schedule>

// Delete schedule (cascades)
async delete(id: number): Promise<{ success: boolean }>

// Get active overrides at time
async getActiveOverrides(
  scheduleId: number,
  at: Date = new Date()
): Promise<Override[]>
```

**RotationsService** (`rotations.service.ts`):

```typescript
// Create rotation with members
async create(data: CreateRotationDto): Promise<Rotation>

// Get rotation with members
async findById(id: number): Promise<Rotation>

// Update rotation details
async update(id: number, data: UpdateRotationDto): Promise<Rotation>

// Replace all members (reordering)
async updateMembers(rotationId: number, userIds: number[]): Promise<Rotation>

// Add member to end
async addMember(rotationId: number, userId: number): Promise<Rotation>

// Remove member and reorder
async removeMember(rotationId: number, userId: number): Promise<Rotation>

// Delete rotation
async delete(id: number): Promise<{ success: boolean }>
```

**OverridesService** (`overrides.service.ts`):

```typescript
// Create temporary override
async create(data: CreateOverrideDto): Promise<Override>

// Get override by ID
async findById(id: number): Promise<Override>

// List overrides for schedule
async findBySchedule(
  scheduleId: number,
  options?: {
    includePast?: boolean;
    from?: Date;
    to?: Date;
  }
): Promise<Override[]>

// Update override
async update(id: number, data: UpdateOverrideDto): Promise<Override>

// Delete override
async delete(id: number): Promise<{ success: boolean }>
```

**OnCallResolverService** (`oncall-resolver.service.ts`):

The most complex service - calculates who is on-call:

```typescript
interface OnCallResult {
  scheduleId: number;
  scheduleName: string;
  userId: number;
  user: { id, name, email };
  source: 'override' | 'rotation';
  rotationId?: number;
  rotationName?: string;
  overrideId?: number;
  overrideReason?: string;
}

// Main resolution method
async resolveOnCall(
  scheduleId: number,
  at: Date = new Date()
): Promise<OnCallResult | null>

// Resolve multiple schedules
async resolveMultipleSchedules(
  scheduleIds: number[],
  at: Date = new Date()
): Promise<OnCallResult[]>

// Check for active override
private async getActiveOverride(
  scheduleId: number,
  at: Date
): Promise<Override | null>

// Find active rotation and calculate on-call user
private async getActiveRotationUser(
  scheduleId: number,
  at: Date
): Promise<OnCallResult | null>

// Calculate which member index is on-call
private calculateOnCallIndex(
  rotation: Rotation,
  at: Date
): number

// Daily rotation calculation
private calculateDailyRotation(
  effectiveFrom: Date,
  at: Date,
  handoffTime: string,
  memberCount: number
): number

// Weekly rotation calculation
private calculateWeeklyRotation(
  effectiveFrom: Date,
  at: Date,
  handoffTime: string,
  handoffDay: number,
  memberCount: number
): number
```

#### On-Call Resolution Algorithm

**Priority Order**:
1. **Override** (highest priority)
2. **Rotation** (fallback)
3. **None** (no one on-call)

**Resolution Flow**:

```typescript
1. Check for active override:
   SELECT * FROM schedule_overrides
   WHERE schedule_id = X
     AND start_time <= now
     AND end_time >= now
   LIMIT 1

   If found: return override user

2. Find active rotations:
   SELECT * FROM schedule_rotations
   WHERE schedule_id = X
     AND effective_from <= now
     AND (effective_until IS NULL OR effective_until >= now)

   If none: return null (no one on-call)

3. Calculate on-call user from rotation:
   - Get rotation.members (ordered by position)
   - Calculate which member is on-call based on:
     * rotationType (daily/weekly/custom)
     * effectiveFrom (when rotation started)
     * handoffTime (time of day for handoff)
     * handoffDay (day of week for weekly rotations)

4. Return result
```

#### Daily Rotation Algorithm

**Example**: 3 members rotate daily at 9:00 AM

```
Members: [Alice, Bob, Charlie] (positions 0, 1, 2)
Effective From: 2026-01-01 09:00 UTC
Handoff Time: 09:00

Query: Who is on-call at 2026-01-10 14:30 UTC?

Calculation:
1. Find most recent handoff before query time:
   - Today's handoff: 2026-01-10 09:00
   - Current time: 2026-01-10 14:30
   - Most recent: 2026-01-10 09:00 ✓

2. Find first handoff on or after effective from:
   - Effective from: 2026-01-01 09:00
   - First handoff: 2026-01-01 09:00 ✓

3. Calculate days between handoffs:
   - Days: (2026-01-10 09:00 - 2026-01-01 09:00) / 24h
   - Days: 9 days

4. Calculate position:
   - Index: 9 % 3 = 0
   - Member: Alice (position 0)

Result: Alice is on-call
```

**Timeline**:
```
2026-01-01 09:00 - Alice   (day 0, 0 % 3 = 0)
2026-01-02 09:00 - Bob     (day 1, 1 % 3 = 1)
2026-01-03 09:00 - Charlie (day 2, 2 % 3 = 2)
2026-01-04 09:00 - Alice   (day 3, 3 % 3 = 0)
...
2026-01-10 09:00 - Alice   (day 9, 9 % 3 = 0) ← Query time
```

#### Weekly Rotation Algorithm

**Example**: 3 members rotate weekly on Monday at 9:00 AM

```
Members: [Alice, Bob, Charlie]
Effective From: 2026-01-06 (Monday) 09:00 UTC
Handoff Day: 1 (Monday, where 0=Sunday)
Handoff Time: 09:00

Query: Who is on-call at 2026-01-20 14:30 UTC?

Calculation:
1. Find most recent Monday 09:00 before query:
   - Query time: 2026-01-20 14:30 (Monday)
   - Current day: 1 (Monday)
   - Most recent: 2026-01-20 09:00 ✓

2. Find first Monday 09:00 on or after effective from:
   - Effective from: 2026-01-06 09:00 (Monday)
   - First handoff: 2026-01-06 09:00 ✓

3. Calculate weeks between handoffs:
   - Weeks: (2026-01-20 09:00 - 2026-01-06 09:00) / 7d
   - Weeks: 2 weeks

4. Calculate position:
   - Index: 2 % 3 = 2
   - Member: Charlie (position 2)

Result: Charlie is on-call
```

**Timeline**:
```
2026-01-06 09:00 - Alice   (week 0, 0 % 3 = 0)
2026-01-13 09:00 - Bob     (week 1, 1 % 3 = 1)
2026-01-20 09:00 - Charlie (week 2, 2 % 3 = 2) ← Query time
2026-01-27 09:00 - Alice   (week 3, 3 % 3 = 0)
```

#### Override Examples

**Vacation Coverage**:
```json
{
  "scheduleId": 1,
  "userId": 2,  // Bob covers for Alice
  "startTime": "2026-01-15T00:00:00Z",
  "endTime": "2026-01-22T00:00:00Z",
  "reason": "Alice on vacation"
}
```

During this period, Bob is on-call regardless of rotation.

**Shift Swap**:
```json
{
  "scheduleId": 1,
  "userId": 3,  // Charlie takes Alice's shift
  "startTime": "2026-01-10T09:00:00Z",
  "endTime": "2026-01-11T09:00:00Z",
  "reason": "Shift swap"
}
```

**Emergency Coverage**:
```json
{
  "scheduleId": 1,
  "userId": 4,  // Manager jumps in
  "startTime": "2026-01-10T17:00:00Z",
  "endTime": "2026-01-10T21:00:00Z",
  "reason": "Emergency incident - manager on-call"
}
```

#### Timezone Handling

**Challenges**:
- Schedules have timezone (e.g., "America/New_York")
- Database stores UTC timestamps
- Handoff times are local (e.g., "09:00")
- DST transitions must be handled

**Current Implementation**:
```typescript
// Convert Date to schedule timezone
private toScheduleTimezone(date: Date, timezone: string): Date {
  // Simplified - uses toLocaleString
  // Production should use date-fns-tz or luxon
  return new Date(date.toLocaleString('en-US', { timeZone: timezone }));
}
```

**Recommended Production Approach**:
```typescript
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';

// Convert UTC to schedule timezone
const zonedDate = utcToZonedTime(utcDate, schedule.timezone);

// Convert schedule timezone to UTC
const utcDate = zonedTimeToUtc(localDate, schedule.timezone);
```

---

### 5. Status Pages Module

**Location**: `src/modules/status-pages/`

**Responsibility**: Public-facing incident communication (like Statuspage.io)

#### Controllers

**StatusPagesManagementController** (authenticated):

Status Pages:
- `POST /status-pages` - Create status page
- `GET /status-pages/:id` - Get status page
- `GET /status-pages/team/:teamId` - List team status pages
- `PATCH /status-pages/:id` - Update status page
- `DELETE /status-pages/:id` - Delete status page
- `GET /status-pages/:id/status` - Get overall status

Components:
- `POST /status-pages/:id/components` - Create component
- `GET /status-pages/components/:componentId` - Get component
- `PATCH /status-pages/components/:componentId` - Update component
- `DELETE /status-pages/components/:componentId` - Delete component
- `POST /status-pages/:id/components/reorder` - Reorder components

Incidents:
- `POST /status-pages/:id/incidents` - Create incident
- `GET /status-pages/incidents/:incidentId` - Get incident
- `PATCH /status-pages/incidents/:incidentId` - Update incident
- `DELETE /status-pages/incidents/:incidentId` - Delete incident
- `POST /status-pages/incidents/:incidentId/updates` - Post update
- `POST /status-pages/incidents/:incidentId/resolve` - Resolve incident

**PublicStatusController** (no auth):

- `GET /public/status/:slug` - Get public status page
- `GET /public/status/:slug/components` - Get components
- `GET /public/status/:slug/incidents` - Get incidents (with filters)
- `GET /public/status/:slug/incidents/:id` - Get incident details

#### Services

**StatusPagesService** (`status-pages.service.ts`):

```typescript
// Create status page
async create(data: CreateStatusPageDto): Promise<StatusPage>

// Get by ID with components and incidents
async findById(id: number): Promise<StatusPage>

// Get by slug (for public access)
async findBySlug(slug: string): Promise<StatusPage>

// List team's status pages
async findByTeam(teamId: number): Promise<StatusPage[]>

// Update status page
async update(id: number, data: UpdateStatusPageDto): Promise<StatusPage>

// Delete status page
async delete(id: number): Promise<{ success: boolean }>

// Calculate overall status
async getOverallStatus(id: number): Promise<{
  status: 'operational' | 'degraded' | 'outage' | 'maintenance';
  affectedComponents: number;
  activeIncidents: number;
}>
```

**ComponentsService** (`components.service.ts`):

```typescript
// Create component
async create(data: CreateComponentDto): Promise<Component>

// Get component by ID
async findById(id: number): Promise<Component>

// List components for status page
async findByStatusPage(statusPageId: number): Promise<Component[]>

// Update component
async update(id: number, data: UpdateComponentDto): Promise<Component>

// Delete component
async delete(id: number): Promise<{ success: boolean }>

// Reorder components
async reorder(statusPageId: number, componentIds: number[]): Promise<Component[]>
```

**StatusPageIncidentsService** (`incidents.service.ts`):

```typescript
// Create incident
async createIncident(data: CreateStatusPageIncidentDto): Promise<StatusPageIncident>

// Get incident with updates
async findIncidentById(id: number): Promise<StatusPageIncident>

// List incidents for status page
async findByStatusPage(
  statusPageId: number,
  options?: {
    includeResolved?: boolean;
    limit?: number;
  }
): Promise<StatusPageIncident[]>

// Update incident
async updateIncident(
  id: number,
  data: UpdateStatusPageIncidentDto
): Promise<StatusPageIncident>

// Delete incident
async deleteIncident(id: number): Promise<{ success: boolean }>

// Post update to incident
async postUpdate(data: CreateStatusUpdateDto): Promise<StatusPageUpdate>

// Resolve incident
async resolveIncident(
  id: number,
  message: string
): Promise<StatusPageIncident>
```

#### Status Page Workflow

**Setup**:
```
1. Admin creates status page:
   POST /status-pages
   {
     name: "Acme Platform Status",
     slug: "acme-platform",
     teamId: 1,
     description: "Service availability for Acme Platform",
     isPublic: true
   }

2. Add components:
   POST /status-pages/1/components
   {
     name: "API",
     status: "operational"
   }

   POST /status-pages/1/components
   {
     name: "Web Dashboard",
     status: "operational"
   }

   POST /status-pages/1/components
   {
     name: "Mobile App",
     status: "operational"
   }

3. Status page is now live at:
   https://status.acme.com (custom domain)
   OR
   https://api.openalert.com/public/status/acme-platform
```

**Incident Communication**:
```
1. Incident occurs internally:
   - Alerts fire
   - Internal incident created
   - Team investigates

2. Create public incident:
   POST /status-pages/1/incidents
   {
     title: "API Degradation",
     status: "investigating",
     impact: "major",
     componentIds: [1],  // API component
     internalIncidentId: 123  // Link to internal incident
   }

3. Post investigation update:
   POST /status-pages/incidents/1/updates
   {
     status: "identified",
     message: "We've identified the issue as a database connection problem."
   }

4. Post fix update:
   POST /status-pages/incidents/1/updates
   {
     status: "monitoring",
     message: "A fix has been deployed. We're monitoring for stability."
   }

5. Resolve incident:
   POST /status-pages/incidents/1/resolve
   {
     message: "The issue has been fully resolved. All systems operational."
   }
```

**Public Access**:
```
Customer visits: https://status.acme.com

GET /public/status/acme-platform
Response:
{
  id: 1,
  name: "Acme Platform Status",
  description: "...",
  overallStatus: {
    status: "degraded",
    affectedComponents: 1,
    activeIncidents: 1
  },
  components: [
    { name: "API", status: "degraded_performance" },
    { name: "Web Dashboard", status: "operational" },
    { name: "Mobile App", status: "operational" }
  ],
  incidents: [
    {
      id: 1,
      title: "API Degradation",
      status: "monitoring",
      impact: "major",
      updates: [
        { status: "investigating", message: "...", createdAt: "..." },
        { status: "identified", message: "...", createdAt: "..." },
        { status: "monitoring", message: "...", createdAt: "..." }
      ]
    }
  ]
}
```

#### Component Statuses

| Status | Color | Meaning |
|--------|-------|---------|
| operational | green | Fully functional |
| degraded_performance | yellow | Slower than normal |
| partial_outage | orange | Some features down |
| major_outage | red | Service completely down |
| under_maintenance | blue | Scheduled maintenance |

#### Incident Statuses

| Status | Meaning |
|--------|---------|
| investigating | We're aware and investigating |
| identified | Root cause found |
| monitoring | Fix deployed, monitoring stability |
| resolved | Issue fully resolved |

#### Overall Status Calculation

```typescript
async getOverallStatus(statusPageId: number) {
  1. Load all components
  2. Count by status:
     - major_outage count
     - partial_outage count
     - degraded_performance count
     - under_maintenance count

  3. Determine overall:
     - If any major_outage: return 'outage'
     - If any partial_outage: return 'outage'
     - If any degraded_performance: return 'degraded'
     - If all under_maintenance: return 'maintenance'
     - Otherwise: return 'operational'

  4. Count active incidents:
     - status != 'resolved'

  5. Return {
       status,
       affectedComponents: count(non-operational),
       activeIncidents: count(active)
     }
}
```

#### Customization Features

**Branding**:
```json
{
  "logoUrl": "https://cdn.acme.com/logo.png",
  "headerHtml": "<div class='custom-header'>...",
  "footerHtml": "<div class='custom-footer'>...",
  "customDomain": "status.acme.com"
}
```

**Custom Domain Setup**:
1. Customer creates CNAME: `status.acme.com` → `openalert.com`
2. Admin sets `customDomain` in status page
3. Application serves status page on custom domain
4. SSL certificate via Let's Encrypt (deployment config)

---

### 6. Users Module

**Location**: `src/modules/users/`

**Responsibility**: User management and provisioning

#### Services

**UsersService** (`users.service.ts`):

```typescript
// Find user by ID
async findById(id: number): Promise<User | undefined>

// Find user by email
async findByEmail(email: string): Promise<User | undefined>

// Find user by Azure AD object ID
async findByExternalId(externalId: string): Promise<User | undefined>

// SSO provisioning: find or create user
async findOrCreate(data: {
  externalId: string;
  email: string;
  name: string;
  phoneNumber?: string;
}): Promise<User>

// Create user
async create(data: NewUser): Promise<User>

// Update user
async update(id: number, data: Partial<NewUser>): Promise<User>

// Deactivate user
async deactivate(id: number): Promise<User>

// List users with pagination
async list(params?: {
  limit?: number;
  offset?: number;
}): Promise<User[]>

// Get user's team memberships
async getUserTeams(userId: number): Promise<TeamMembership[]>
```

**SSO Provisioning Logic** (`findOrCreate`):

```typescript
1. Search by externalId (Azure OID):
   SELECT * FROM users WHERE external_id = 'azure-oid-123'

2. If found:
   - Check if email or name changed
   - If changed: UPDATE users SET email, name, updated_at
   - Return user

3. If not found:
   - INSERT INTO users (external_id, email, name, is_active=true)
   - Log: "Created new user from SSO"
   - Return new user

4. This ensures:
   - Users auto-provisioned on first login
   - User info stays in sync with Azure AD
   - No duplicate accounts
```

**User Lifecycle**:

```
Azure AD Login
      ↓
findOrCreate()
      ↓
User in Database ← → Team Assignments
      ↓                      ↓
JWT Token            On-Call Schedules
      ↓                      ↓
API Access          Notifications
```

---

### 7. Health Module

**Location**: `src/modules/health/`

**Responsibility**: Health checks and monitoring

#### Controllers

**HealthController** (`health.controller.ts`):

```typescript
// Comprehensive health check
@Get('/health')
check() {
  return healthCheck([
    memoryHeapCheck(150MB),
    memoryRSSCheck(300MB),
    databaseCheck()
  ]);
}

// Kubernetes liveness probe
@Get('/health/live')
liveness() {
  return {
    status: 'ok',
    timestamp: ISO-8601
  };
}

// Kubernetes readiness probe
@Get('/health/ready')
async readiness() {
  - Check database connection
  - Return ready/not ready
}
```

**Health Check Response**:
```json
{
  "status": "ok",
  "info": {
    "memory_heap": {
      "status": "up"
    },
    "memory_rss": {
      "status": "up"
    },
    "database": {
      "status": "up"
    }
  },
  "error": {},
  "details": {
    "memory_heap": {
      "status": "up"
    },
    "memory_rss": {
      "status": "up"
    },
    "database": {
      "status": "up"
    }
  }
}
```

**Metrics Controller** (`metrics.controller.ts`):

Placeholder for future Prometheus metrics endpoint:
```typescript
@Get('/metrics')
metrics() {
  // TODO: Export Prometheus metrics
  // - Incident count by status
  // - Alert ingestion rate
  // - Notification success rate
  // - API response times
  // - Queue depths
}
```

---

## Core Infrastructure

### Database Service

**Location**: `src/database/database.service.ts`

**Global Service** - available to all modules via `@Global()` decorator

```typescript
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;
  public db: NodePgDatabase<typeof schema>;

  async onModuleInit() {
    // Initialize PostgreSQL connection pool
    this.pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 20,                      // Max connections
      idleTimeoutMillis: 30000,     // 30s idle timeout
      connectionTimeoutMillis: 2000 // 2s connection timeout
    });

    // Wrap pool with Drizzle
    this.db = drizzle(this.pool, { schema });

    // Test connection
    await this.pool.query('SELECT 1');
    logger.log('Database connection established');
  }

  async onModuleDestroy() {
    await this.pool.end();
    logger.log('Database connection closed');
  }

  get query() {
    return this.db.query; // Relational query API
  }
}
```

**Usage Patterns**:

```typescript
// Direct SQL
const results = await this.db.db
  .select()
  .from(incidents)
  .where(eq(incidents.status, 'triggered'))
  .limit(10);

// Relational queries
const incident = await this.db.query.incidents.findFirst({
  where: eq(incidents.id, incidentId),
  with: {
    service: true,
    alerts: true,
    timeline: {
      orderBy: (timeline, { desc }) => [desc(timeline.createdAt)]
    }
  }
});

// Raw SQL
await this.db.db.execute(sql`SELECT 1`);
```

### Event Emitter

**NestJS EventEmitter2** - application-wide event bus

**Configuration** (`app.module.ts`):
```typescript
EventEmitterModule.forRoot()
```

**Event Publishing**:
```typescript
@Injectable()
export class IncidentsService {
  constructor(private eventEmitter: EventEmitter2) {}

  async createIncident() {
    const incident = await this.db.insert(...)...;

    // Emit event
    this.eventEmitter.emit('incident.created', incident);
  }
}
```

**Event Listening**:
```typescript
@Injectable()
export class IncidentsGateway {
  @OnEvent('incident.created')
  handleIncidentCreated(incident: Incident) {
    // Broadcast to WebSocket clients
    this.server.emit('incident:created', incident);
  }
}
```

**Event Catalog**:

| Event | Payload | Listeners |
|-------|---------|-----------|
| alert.created | Alert | WebSocket Gateway |
| alert.acknowledged | { alert, userId } | WebSocket Gateway |
| alert.resolved | Alert | WebSocket Gateway |
| incident.created | Incident | WebSocket Gateway |
| incident.acknowledged | { incident, userId } | WebSocket Gateway |
| incident.resolved | { incident, userId } | WebSocket Gateway |
| incident.auto_resolved | Incident | WebSocket Gateway |

**Benefits**:
- Decoupled modules
- Easy to add new listeners
- No direct dependencies between features
- Event history for debugging (if logged)

### Configuration Management

**NestJS ConfigModule** with environment variables

**Configuration** (`app.module.ts`):
```typescript
ConfigModule.forRoot({
  isGlobal: true,              // Available everywhere
  envFilePath: ['.env.local', '.env'], // Load order
})
```

**Environment Variables** (`.env.example`):

```bash
# Application
NODE_ENV=development
PORT=3001
ALLOWED_ORIGINS=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/openalert

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Azure AD
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret

# JWT
JWT_SECRET=at-least-32-characters-long

# Application URLs
API_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000

# Notification Providers (optional)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=
SLACK_WEBHOOK_URL=
TEAMS_WEBHOOK_URL=

# Logging
LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT=1000
```

**Usage**:
```typescript
@Injectable()
export class SomeService {
  constructor(private config: ConfigService) {}

  someMethod() {
    const dbUrl = this.config.get<string>('DATABASE_URL');
    const port = this.config.get<number>('PORT', 3001); // with default
  }
}
```

---

## Queue System

### Architecture

**BullMQ** - Redis-backed job queue with workers

```
┌─────────────────┐
│   Controller    │
│   or Service    │
└────────┬────────┘
         │ Queue Job
         ▼
┌─────────────────┐     ┌─────────────┐
│  Queue Service  │────►│    Redis    │
│   (Producer)    │     │  (Storage)  │
└─────────────────┘     └──────┬──────┘
                               │ Poll
                               ▼
                        ┌─────────────┐
                        │   Worker    │
                        │  (Consumer) │
                        └─────────────┘
```

### Notification Queue

**Location**: `src/queues/notification.queue.ts`

**Purpose**: Queue notifications to users via multiple channels

**Queue Service** (`notification.queue.ts`):

```typescript
export type NotificationChannel =
  'email' | 'sms' | 'voice' | 'push' | 'slack' | 'teams';

export type NotificationPriority =
  'critical' | 'high' | 'medium' | 'low';

export interface NotificationJobData {
  incidentId: number;
  userId: number;
  channel: NotificationChannel;
  priority: NotificationPriority;
  payload: {
    subject?: string;
    message: string;
    incidentUrl?: string;
    phoneNumber?: string;
    email?: string;
  };
}

class NotificationQueueService {
  public queue: Queue<NotificationJobData>;

  // Queue single notification
  async queueNotification(data: NotificationJobData): Promise<Job> {
    return this.queue.add(data.channel, data, {
      priority: priorityMap[data.priority],
      attempts: attemptsByChannel[data.channel],
      backoff: { type: 'exponential', delay: 2000 }
    });
  }

  // Queue multiple notifications
  async queueBulkNotifications(
    notifications: NotificationJobData[]
  ): Promise<Job[]>

  // Get queue stats
  async getStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }>
}
```

**Priority Mapping**:
```typescript
critical: 1  (highest priority)
high: 2
medium: 5
low: 10
```

**Retry Configuration**:
```typescript
Channel Attempts:
- email: 5
- sms: 4
- voice: 3
- push: 4
- slack: 5
- teams: 5

Backoff: exponential starting at 2s
(2s, 4s, 8s, 16s, 32s...)
```

**Worker** (`notification.worker.ts`):

```typescript
class NotificationWorkerService implements OnModuleInit {
  private worker: Worker<NotificationJobData>;

  async onModuleInit() {
    this.worker = new Worker(
      'notifications',
      async (job: Job<NotificationJobData>) => {
        return this.processNotification(job);
      },
      {
        connection: redis,
        concurrency: 10  // Process 10 jobs in parallel
      }
    );
  }

  private async processNotification(job: Job<NotificationJobData>) {
    const { incidentId, userId, channel, payload } = job.data;

    // 1. Create notification log entry
    const log = await db.insert(notificationLogs).values({
      incidentId,
      userId,
      channel,
      status: 'pending',
      metadata: { jobId: job.id }
    });

    try {
      // 2. Route to channel handler
      switch (channel) {
        case 'email': await this.sendEmail(payload); break;
        case 'sms': await this.sendSms(payload); break;
        case 'voice': await this.makeVoiceCall(payload); break;
        case 'push': await this.sendPushNotification(payload); break;
        case 'slack': await this.sendSlackMessage(payload); break;
        case 'teams': await this.sendTeamsMessage(payload); break;
      }

      // 3. Update log as sent
      await db.update(notificationLogs)
        .set({ status: 'sent', sentAt: new Date() })
        .where(eq(notificationLogs.id, log.id));

    } catch (error) {
      // 4. Update log as failed
      await db.update(notificationLogs)
        .set({
          status: 'failed',
          failureReason: error.message
        })
        .where(eq(notificationLogs.id, log.id));

      throw error; // BullMQ will retry
    }
  }

  // Channel handlers (currently stubs)
  private async sendEmail(payload) {
    logger.log(`[STUB] Sending email to ${payload.email}`);
    // TODO: Integrate SendGrid or AWS SES
  }

  private async sendSms(payload) {
    logger.log(`[STUB] Sending SMS to ${payload.phoneNumber}`);
    // TODO: Integrate Twilio
  }

  private async makeVoiceCall(payload) {
    logger.log(`[STUB] Calling ${payload.phoneNumber}`);
    // TODO: Integrate Twilio Voice
  }

  private async sendPushNotification(payload) {
    logger.log(`[STUB] Sending push notification`);
    // TODO: Integrate FCM/APNs
  }

  private async sendSlackMessage(payload) {
    logger.log(`[STUB] Sending Slack message`);
    // TODO: Integrate Slack API
  }

  private async sendTeamsMessage(payload) {
    logger.log(`[STUB] Sending Teams message`);
    // TODO: Integrate Microsoft Teams webhooks
  }
}
```

**Job Lifecycle**:
```
1. Job created (waiting)
2. Worker picks up job (active)
3. Worker processes job
   ├─ Success → completed (deleted after 1h)
   └─ Failure → failed, retry after backoff
4. After max attempts → failed (kept 24h)
```

### Escalation Queue

**Location**: `src/queues/escalation.queue.ts`

**Purpose**: Schedule time-delayed escalation of incidents

**Queue Service** (`escalation.queue.ts`):

```typescript
export interface EscalationJobData {
  incidentId: number;
  escalationPolicyId: number;
  currentLevel: number;
  attempt: number;
}

class EscalationQueueService {
  public queue: Queue<EscalationJobData>;

  // Schedule escalation for specific level
  async scheduleEscalation(
    incidentId: number,
    escalationPolicyId: number,
    level: number,
    delayMinutes: number
  ): Promise<Job> {
    const jobId = `escalation:${incidentId}:level-${level}`;

    // Remove existing job (prevents duplicates)
    const existing = await this.queue.getJob(jobId);
    if (existing) {
      await existing.remove();
    }

    // Schedule new job
    return this.queue.add('escalate', {
      incidentId,
      escalationPolicyId,
      currentLevel: level,
      attempt: 1
    }, {
      jobId,
      delay: delayMinutes * 60 * 1000,  // Convert to ms
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 }
    });
  }

  // Cancel all escalations for incident
  async cancelEscalation(incidentId: number): Promise<void> {
    // Try to remove jobs for levels 1-10
    for (let level = 1; level <= 10; level++) {
      const jobId = `escalation:${incidentId}:level-${level}`;
      const job = await this.queue.getJob(jobId);
      if (job) {
        const state = await job.getState();
        if (['delayed', 'waiting', 'active'].includes(state)) {
          await job.remove();
          logger.log(`Cancelled escalation: ${jobId}`);
        }
      }
    }
  }

  // Get pending escalations
  async getPendingEscalations(
    incidentId: number
  ): Promise<Job<EscalationJobData>[]>
}
```

**Worker** (`escalation.worker.ts`):

```typescript
class EscalationWorkerService implements OnModuleInit {
  private worker: Worker<EscalationJobData>;

  async onModuleInit() {
    this.worker = new Worker(
      'escalations',
      async (job: Job<EscalationJobData>) => {
        return this.processEscalation(job);
      },
      {
        connection: redis,
        concurrency: 5
      }
    );
  }

  private async processEscalation(job: Job<EscalationJobData>) {
    const { incidentId, escalationPolicyId, currentLevel } = job.data;

    // 1. Check if incident is still active
    const incident = await db.query.incidents.findFirst({
      where: eq(incidents.id, incidentId)
    });

    if (!incident) {
      logger.warn(`Incident ${incidentId} not found, skipping`);
      return;
    }

    if (incident.status !== 'triggered') {
      logger.log(`Incident ${incidentId} is ${incident.status}, skipping`);
      return;
    }

    // 2. Load escalation policy and level
    const policy = await db.query.escalationPolicies.findFirst({
      where: eq(escalationPolicies.id, escalationPolicyId)
    });

    const level = await db.query.escalationLevels.findFirst({
      where: and(
        eq(escalationLevels.policyId, escalationPolicyId),
        eq(escalationLevels.level, currentLevel)
      )
    });

    // 3. Load targets for this level
    const targets = await db.select()
      .from(escalationTargets)
      .where(eq(escalationTargets.levelId, level.id));

    // 4. Notify each target
    for (const target of targets) {
      if (target.targetType === 'user') {
        await this.notifyUser(incidentId, target.targetId, incident.severity);
      } else if (target.targetType === 'team') {
        await this.notifyTeam(incidentId, target.targetId, incident.severity);
      } else if (target.targetType === 'schedule') {
        await this.notifySchedule(incidentId, target.targetId, incident.severity);
      }
    }

    // 5. Schedule next level if exists
    const nextLevel = await db.query.escalationLevels.findFirst({
      where: and(
        eq(escalationLevels.policyId, escalationPolicyId),
        eq(escalationLevels.level, currentLevel + 1)
      )
    });

    if (nextLevel) {
      await escalationQueue.scheduleEscalation(
        incidentId,
        escalationPolicyId,
        currentLevel + 1,
        nextLevel.delayMinutes
      );
    }
  }

  private async notifyUser(
    incidentId: number,
    userId: number,
    severity: string
  ) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId)
    });

    const incident = await db.query.incidents.findFirst({
      where: eq(incidents.id, incidentId),
      with: { service: true }
    });

    const priority = (severity === 'critical' || severity === 'high')
      ? 'critical'
      : 'high';

    // Queue email notification
    await notificationQueue.queueNotification({
      incidentId,
      userId,
      channel: 'email',
      priority,
      payload: {
        subject: `[${severity.toUpperCase()}] Incident #${incident.incidentNumber}`,
        message: `Service: ${incident.service.name}\n${incident.title}`,
        email: user.email,
        incidentUrl: `${env.APP_URL}/incidents/${incidentId}`
      }
    });

    // Queue SMS for critical incidents
    if (severity === 'critical' && user.phoneNumber) {
      await notificationQueue.queueNotification({
        incidentId,
        userId,
        channel: 'sms',
        priority,
        payload: {
          message: `CRITICAL: Incident #${incident.incidentNumber} - ${incident.title}`,
          phoneNumber: user.phoneNumber
        }
      });
    }
  }

  private async notifyTeam(incidentId, teamId, severity) {
    // Get all active team members
    const members = await db.select()
      .from(teamMembers)
      .innerJoin(users, eq(teamMembers.userId, users.id))
      .where(and(
        eq(teamMembers.teamId, teamId),
        eq(users.isActive, true)
      ));

    // Notify each member
    for (const member of members) {
      await this.notifyUser(incidentId, member.userId, severity);
    }
  }

  private async notifySchedule(incidentId, scheduleId, severity) {
    // TODO: Implement on-call schedule resolution
    // 1. Use OnCallResolverService to find who's on-call
    // 2. Notify that user
    logger.log(`Schedule notification not yet implemented`);
  }
}
```

**Escalation Flow Example**:

```
Incident created at 10:00
Escalation Policy: "Critical Escalation"
  - Level 1: Delay 0min → Notify on-call engineer
  - Level 2: Delay 5min → Notify team lead
  - Level 3: Delay 10min → Notify manager

Timeline:
10:00 - Incident triggered
10:00 - Level 1 job scheduled (0min delay)
10:00 - Level 1 executes → Email/SMS to engineer
10:05 - Level 2 job scheduled (5min delay)
10:05 - Level 2 executes → Email to team lead
10:10 - Level 3 job scheduled (10min delay)
10:10 - Level 3 executes → Email to manager

If incident acknowledged at 10:03:
10:03 - All pending escalation jobs cancelled
10:05 - Level 2 job doesn't execute
10:10 - Level 3 job doesn't execute
```

### Redis Configuration

**Connection Settings**:
```typescript
new IORedis({
  host: env.REDIS_HOST || 'localhost',
  port: env.REDIS_PORT || 6379,
  maxRetriesPerRequest: null,  // Required for BullMQ
});
```

**Job Retention**:
```typescript
defaultJobOptions: {
  removeOnComplete: {
    age: 3600,    // 1 hour
    count: 1000   // Keep last 1000
  },
  removeOnFail: {
    age: 86400,   // 24 hours
    count: 5000   // Keep last 5000
  },
}
```

---

## WebSocket Gateway

**Location**: `src/websocket/incidents.gateway.ts`

**Purpose**: Real-time incident and alert updates

### Gateway Configuration

```typescript
@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: 'incidents',
})
export class IncidentsGateway
  implements OnGatewayConnection, OnGatewayDisconnect {

  @WebSocketServer()
  server: Server;

  // Connection handling
  async handleConnection(client: AuthenticatedSocket) {
    logger.log(`Client connected: ${client.id}`);

    // Auto-join user's team rooms
    if (client.teamIds) {
      for (const teamId of client.teamIds) {
        client.join(`team:${teamId}`);
      }
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    logger.log(`Client disconnected: ${client.id}`);
  }
}
```

### Client-to-Server Messages

```typescript
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
```

### Server-to-Client Broadcasts

```typescript
// Event listeners for broadcasting

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

@OnEvent('incident.resolved')
handleIncidentResolved(data: { incident: any; user: any }) {
  this.server.to(`incident:${data.incident.id}`).emit('incident:resolved', data);
}

@OnEvent('alert.created')
handleAlertCreated(alert: any) {
  if (alert.incidentId) {
    this.server.to(`incident:${alert.incidentId}`).emit('alert:created', alert);
  }
}

@OnEvent('alert.acknowledged')
handleAlertAcknowledged(data: { alert: any; user: any }) {
  if (data.alert.incidentId) {
    this.server.to(`incident:${data.alert.incidentId}`).emit('alert:acknowledged', data);
  }
}

@OnEvent('alert.resolved')
handleAlertResolved(alert: any) {
  if (alert.incidentId) {
    this.server.to(`incident:${alert.incidentId}`).emit('alert:resolved', alert);
  }
}
```

### Room Structure

**Team Rooms**: `team:${teamId}`
- All team members auto-joined on connection
- Receives all incidents for the team
- Use case: Dashboard showing all team incidents

**Incident Rooms**: `incident:${incidentId}`
- Users manually subscribe to specific incidents
- Receives updates for that incident only
- Use case: Incident detail page

### Client Usage Example

**Frontend Connection**:
```typescript
import io from 'socket.io-client';

const socket = io('http://localhost:3001/incidents', {
  auth: {
    token: 'jwt_token_here'
  }
});

// Connection events
socket.on('connect', () => {
  console.log('Connected to WebSocket');
});

socket.on('disconnect', () => {
  console.log('Disconnected from WebSocket');
});

// Subscribe to specific incident
socket.emit('subscribe:incident', 123);

// Listen for incident updates
socket.on('incident:updated', (incident) => {
  console.log('Incident updated:', incident);
  updateUI(incident);
});

socket.on('incident:acknowledged', ({ incident, user }) => {
  console.log(`Incident #${incident.incidentNumber} acknowledged by ${user.name}`);
  showNotification(`${user.name} acknowledged incident`);
});

socket.on('alert:created', (alert) => {
  console.log('New alert:', alert);
  incrementAlertCount();
});

// Unsubscribe when leaving page
socket.emit('unsubscribe:incident', 123);
```

### Authentication

**WsJwtGuard** validates connections:

```typescript
1. Extract token from:
   - handshake.auth.token
   - handshake.headers.authorization
   - handshake.query.token

2. Verify JWT signature

3. Load user from database

4. Attach to socket:
   - socket.userId
   - socket.user
   - socket.teamIds

5. Auto-join team rooms

6. If invalid: throw WsException('Unauthorized')
```

### Scaling Considerations

**Redis Adapter** (`@socket.io/redis-adapter`):

Allows multiple API servers to share WebSocket state:

```typescript
// Future implementation for horizontal scaling
import { createAdapter } from '@socket.io/redis-adapter';

const io = new Server(httpServer, {
  adapter: createAdapter(redisClient, redisSubscriber)
});
```

With this:
- Multiple API servers can run in parallel
- Client connected to Server A receives events from Server B
- Load balancer can distribute WebSocket connections

---

## Authentication & Authorization

### Authentication Flow

**OAuth 2.0 Authorization Code Flow with Azure AD**

```
┌────────┐                               ┌────────────┐
│ Client │                               │ Azure AD   │
└───┬────┘                               └─────┬──────┘
    │                                          │
    │ 1. GET /auth/login                       │
    ├─────────────────────►                    │
    │                      API                 │
    │ 2. Redirect to Azure AD login URL        │
    │◄─────────────────────                    │
    │                                           │
    │ 3. Redirect to Azure AD                  │
    ├──────────────────────────────────────────►
    │                                           │
    │ 4. User logs in with Microsoft account   │
    │◄──────────────────────────────────────────┤
    │                                           │
    │ 5. Redirect to /auth/callback?code=...   │
    ├─────────────────────►                    │
    │                      API                 │
    │                       │                  │
    │                       │ 6. Exchange code │
    │                       ├──────────────────►
    │                       │                  │
    │                       │ 7. Return tokens │
    │                       │◄─────────────────┤
    │                       │                  │
    │                       │ 8. Provision user│
    │                       │ (findOrCreate)   │
    │                       │                  │
    │                       │ 9. Generate JWT  │
    │                       │                  │
    │ 10. Redirect with JWT                    │
    │◄─────────────────────                    │
    │                                           │
    │ 11. Store JWT, make API calls            │
    │                                           │
```

### Authorization Strategy

**Role-Based Access Control (RBAC)** - prepared but not fully implemented

**Roles** (in `team_members.role`):
- `owner` - Full control over team
- `admin` - Manage team resources
- `member` - Basic access

**Future Guards**:
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'owner')
@Delete('services/:id')
async deleteService() {
  // Only admins and owners can delete services
}
```

**Current State**:
- All authenticated users have full access
- Team isolation via data filtering (not enforced at route level)
- Ready for RBAC implementation

### Security Best Practices

1. **JWT Expiration**: 7 days (configurable)
2. **Password Not Stored**: Azure AD manages authentication
3. **HTTPS Only**: In production (reverse proxy handles SSL)
4. **CORS Whitelist**: Configurable allowed origins
5. **Rate Limiting**: Planned (not yet implemented)
6. **SQL Injection Protection**: Drizzle ORM parameterizes queries
7. **XSS Protection**: Fastify default headers
8. **CSRF Protection**: State parameter in OAuth flow

---

## Deployment & Operations

### Build Process

**TypeScript Compilation**:
```bash
npm run build
# Runs: nest build
# Output: dist/ directory
```

**Build Output Structure**:
```
dist/
├── app.module.js
├── main.js
├── common/
├── database/
├── modules/
├── queues/
└── websocket/
```

### Running the Application

**Development**:
```bash
npm run start:dev
# Runs: nest start --watch
# Hot reload enabled
# Port: 3001 (default)
```

**Production**:
```bash
npm run start:prod
# Runs: node dist/main
# No hot reload
# Set NODE_ENV=production
```

### Environment Variables

**Required**:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_HOST` - Redis host
- `REDIS_PORT` - Redis port
- `JWT_SECRET` - Secret for JWT signing (32+ chars)

**Optional**:
- `NODE_ENV` - Environment (development/production)
- `PORT` - API server port (default: 3001)
- `ALLOWED_ORIGINS` - CORS whitelist (comma-separated)
- `AZURE_TENANT_ID` - Azure AD tenant
- `AZURE_CLIENT_ID` - Azure AD app ID
- `AZURE_CLIENT_SECRET` - Azure AD secret
- `API_URL` - API base URL for callbacks
- `FRONTEND_URL` - Frontend URL for redirects

### Docker Deployment

**Dockerfile** (example):
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "dist/main"]
```

**Docker Compose** (example):
```yaml
version: '3.8'
services:
  api:
    build: ./apps/api
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://user:pass@postgres:5432/openalert
      REDIS_HOST: redis
      REDIS_PORT: 6379
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: openalert
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### Kubernetes Deployment

**Deployment YAML** (example):
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: openalert-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: openalert-api
  template:
    metadata:
      labels:
        app: openalert-api
    spec:
      containers:
      - name: api
        image: openalert/api:latest
        ports:
        - containerPort: 3001
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: openalert-secrets
              key: database-url
        - name: REDIS_HOST
          value: redis-service
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: openalert-secrets
              key: jwt-secret
        livenessProbe:
          httpGet:
            path: /health/live
            port: 3001
          initialDelaySeconds: 10
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

### Health Checks

**Liveness Probe**: `/health/live`
- Always returns 200 OK if process is alive
- Kubernetes restarts pod if this fails

**Readiness Probe**: `/health/ready`
- Returns 200 OK if database is accessible
- Kubernetes removes from load balancer if not ready

**Health Check**: `/health`
- Comprehensive check (memory, database, etc.)
- For monitoring systems (Datadog, New Relic, etc.)

### Monitoring

**Logs**:
```typescript
Logger.log('Info message');
Logger.warn('Warning message');
Logger.error('Error message', stackTrace);
Logger.debug('Debug message');
```

**Recommended Logging Setup**:
- JSON structured logs (use Winston or Pino)
- Log aggregation (ELK stack, Datadog, CloudWatch)
- Correlation IDs for request tracing

**Metrics** (planned):
- Prometheus `/metrics` endpoint
- Alert ingestion rate
- Incident count by status
- Notification success rate
- API response times
- Queue depths
- WebSocket connection count

### Database Migrations

**Generate Migration**:
```bash
npm run db:generate
# Creates migration SQL in src/database/migrations/
```

**Apply Migrations**:
```bash
npm run db:push
# Executes migrations against database
```

**Rollback** (manual):
```sql
-- Manually write rollback SQL
-- Drizzle doesn't have automatic rollback
```

**Production Strategy**:
1. Generate migration locally
2. Review SQL file
3. Test in staging environment
4. Apply to production during maintenance window
5. Keep backups before major schema changes

---

## Code Patterns & Practices

### Dependency Injection

**NestJS IoC Container** - all dependencies injected via constructor

```typescript
@Injectable()
export class IncidentsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(forwardRef(() => EscalationQueueService))
    private readonly escalationQueue: EscalationQueueService,
  ) {}
}
```

**Benefits**:
- Testable (mock dependencies)
- Loose coupling
- Automatic lifecycle management

**Circular Dependencies**:
```typescript
// Use forwardRef for circular imports
imports: [forwardRef(() => IncidentsModule)],

// Inject with forwardRef
@Inject(forwardRef(() => SomeService))
private readonly someService: SomeService
```

### Error Handling

**HTTP Exceptions**:
```typescript
import { NotFoundException, BadRequestException } from '@nestjs/common';

throw new NotFoundException(`Incident ${id} not found`);
throw new BadRequestException('Invalid incident ID');
```

**Exception Filter** (global):
```typescript
// NestJS automatically formats exceptions:
{
  "statusCode": 404,
  "message": "Incident 123 not found",
  "error": "Not Found"
}
```

**Async Error Handling**:
```typescript
// Errors automatically caught by NestJS
async someMethod() {
  const result = await this.db.query.incidents.findFirst(...);
  if (!result) {
    throw new NotFoundException('Not found');
  }
  return result;
}
```

### Validation

**Class Validator** - DTOs validated automatically

```typescript
import { IsString, IsEnum, IsOptional } from 'class-validator';

export class CreateAlertDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsEnum(AlertSeverity)
  severity: AlertSeverity;
}
```

**Validation Pipe** (global):
```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,              // Strip unknown properties
    transform: true,              // Auto-transform types
    forbidNonWhitelisted: true,   // Throw error on unknown props
  })
);
```

### Logging

**NestJS Logger**:
```typescript
private readonly logger = new Logger(ClassName.name);

this.logger.log('Info message');
this.logger.warn('Warning message');
this.logger.error('Error message', stackTrace);
this.logger.debug('Debug message');
```

**Log Levels**:
- `log` - General info
- `warn` - Warnings
- `error` - Errors with stack traces
- `debug` - Verbose debugging (disabled in production)

### Testing

**Unit Tests** (example):
```typescript
import { Test } from '@nestjs/testing';

describe('IncidentsService', () => {
  let service: IncidentsService;
  let db: DatabaseService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        IncidentsService,
        {
          provide: DatabaseService,
          useValue: mockDatabase, // Mock
        },
      ],
    }).compile();

    service = module.get<IncidentsService>(IncidentsService);
  });

  it('should create incident', async () => {
    const result = await service.create(...);
    expect(result).toBeDefined();
  });
});
```

**E2E Tests** (example):
```typescript
import * as request from 'supertest';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';

describe('Incidents (e2e)', () => {
  let app;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/incidents (GET)', () => {
    return request(app.getHttpServer())
      .get('/incidents')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });
});
```

### Type Safety

**Drizzle Type Inference**:
```typescript
// Types automatically inferred
export type Incident = typeof incidents.$inferSelect;
export type NewIncident = typeof incidents.$inferInsert;

// Usage
const incident: Incident = await db.query.incidents.findFirst(...);
const newIncident: NewIncident = {
  title: 'test',
  severity: 'critical',
  // TypeScript ensures all required fields present
};
```

**DTO to Entity Mapping**:
```typescript
// DTO
export class CreateIncidentDto {
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

// Service
async create(dto: CreateIncidentDto): Promise<Incident> {
  const [incident] = await this.db.insert(incidents)
    .values({
      ...dto,
      status: 'triggered',
      // TypeScript validates structure
    })
    .returning();
  return incident;
}
```

---

## Integration Points

### External Monitoring Systems

**Prometheus Alertmanager**:
- Webhook format: Prometheus v4 alert format
- Supports: firing/resolved states, labels, annotations
- Example: `POST /webhooks/prometheus/:key`

**Grafana Alerting**:
- Webhook format: Grafana Unified Alerting
- Supports: Legacy (pre-v8) and modern formats
- Example: `POST /webhooks/grafana/:key`

**Azure Monitor**:
- Webhook format: Azure common alert schema
- Supports: Metric, log, and activity log alerts
- Example: `POST /webhooks/azure/:key`

**Datadog**:
- Webhook format: Datadog webhook integration
- Supports: Alert triggers and recoveries
- Example: `POST /webhooks/datadog/:key`

**Generic Webhooks**:
- Auto-detection fallback
- Flexible field mapping
- Example: `POST /webhooks/v1/:key`

### Azure AD Integration

**Setup**:
1. Register app in Azure AD portal
2. Configure redirect URI: `http://api/auth/callback`
3. Add API permissions: `User.Read`, `openid`, `profile`, `email`
4. Generate client secret
5. Set environment variables:
   - `AZURE_TENANT_ID`
   - `AZURE_CLIENT_ID`
   - `AZURE_CLIENT_SECRET`

**User Provisioning**:
- Automatic on first login
- User data synced from Azure AD
- External ID stored for future lookups

### Notification Providers

**Planned Integrations** (stubs in place):

1. **Email** (SendGrid or AWS SES)
   - SMTP-based delivery
   - HTML templates
   - Delivery tracking

2. **SMS** (Twilio)
   - International delivery
   - Delivery receipts
   - Fallback to voice

3. **Voice** (Twilio)
   - Text-to-speech
   - Escalation for critical incidents
   - Call recording

4. **Push** (Firebase Cloud Messaging / APNs)
   - Mobile app notifications
   - Rich media support
   - Deep linking

5. **Slack**
   - Channel messages
   - Direct messages
   - Interactive buttons

6. **Microsoft Teams**
   - Webhook-based
   - Adaptive cards
   - Action buttons

---

## Security Considerations

### Authentication Security

1. **OAuth 2.0 Flow**: Industry-standard authorization
2. **JWT Tokens**: Signed with HS256, 7-day expiration
3. **State Parameter**: CSRF protection in OAuth flow
4. **Token Validation**: Signature + expiration checked on every request

### Database Security

1. **Parameterized Queries**: Drizzle prevents SQL injection
2. **Connection Pooling**: Limited connections (max 20)
3. **Password Not Stored**: Azure AD manages credentials
4. **Encryption at Rest**: Database-level (PostgreSQL config)

### API Security

1. **CORS Whitelist**: Configurable allowed origins
2. **Rate Limiting**: Planned (not yet implemented)
3. **Request Size Limits**: 1MB body limit (Fastify config)
4. **HTTPS Only**: In production (reverse proxy handles)
5. **Security Headers**: Fastify defaults (Helmet equivalent)

### WebSocket Security

1. **JWT Authentication**: Required for connection
2. **Room Isolation**: Users only access their team's data
3. **Message Validation**: Guards on all message handlers

### Secrets Management

**Current Approach**:
- Environment variables
- `.env` file (not committed)
- `.env.example` template

**Production Recommendations**:
- AWS Secrets Manager
- Azure Key Vault
- HashiCorp Vault
- Kubernetes Secrets

### Vulnerability Scanning

**Recommended Tools**:
```bash
# Check for known vulnerabilities
npm audit

# Fix auto-fixable issues
npm audit fix

# Check for outdated packages
npm outdated
```

**Dependencies**:
- Keep NestJS updated for security patches
- Monitor @nestjs/security advisories
- Regular Drizzle ORM updates

---

## Future Enhancements

### Planned Features

1. **Notification Provider Integration**
   - Complete Twilio SMS/Voice
   - SendGrid email templates
   - Slack/Teams interactive messages

2. **Advanced Scheduling**
   - Multi-layer rotations
   - Follow-the-sun coverage
   - Custom recurrence rules
   - Holiday calendars

3. **Escalation Improvements**
   - Conditional escalation (if not acknowledged)
   - Escalation policies per severity
   - Notification preferences per user

4. **Status Page Enhancements**
   - Subscriber notifications (email/SMS)
   - RSS feed
   - Historical uptime metrics
   - Maintenance scheduling

5. **Reporting & Analytics**
   - MTTR (Mean Time To Resolve)
   - MTTA (Mean Time To Acknowledge)
   - Incident trends
   - On-call load balancing

6. **Rate Limiting**
   - Per-IP limits
   - Per-user limits
   - Webhook rate limits

7. **Audit Logging**
   - User action tracking
   - Compliance reports
   - Export to SIEM

8. **RBAC Implementation**
   - Role-based permissions
   - Custom roles
   - Resource-level access control

9. **Metrics & Monitoring**
   - Prometheus `/metrics` endpoint
   - Custom Grafana dashboards
   - Alert on queue depth

10. **API Versioning**
    - v2 API with breaking changes
    - Deprecation warnings
    - Version negotiation

---

## Appendix

### Glossary

- **Alert**: Individual event from monitoring system
- **Incident**: Grouped alerts representing a problem
- **Integration**: Webhook endpoint for receiving alerts
- **Escalation Policy**: Rules for notifying people
- **Schedule**: On-call rotation configuration
- **Override**: Temporary on-call assignment
- **Status Page**: Public incident communication page
- **Fingerprint**: Hash for alert deduplication
- **Timeline**: Audit log of incident events

### Useful Commands

```bash
# Development
npm run start:dev           # Start with hot reload
npm run build              # Compile TypeScript
npm run test               # Run unit tests
npm run test:e2e           # Run E2E tests
npm run lint               # Lint code
npm run lint:fix           # Fix linting issues

# Database
npm run db:generate        # Generate migration
npm run db:push            # Apply migrations
npm run db:studio          # Open Drizzle Studio

# Production
npm run start:prod         # Start production server
NODE_ENV=production npm start
```

### API Documentation

Once server is running, visit:
- **Swagger UI**: http://localhost:3001/api/docs
- **OpenAPI JSON**: http://localhost:3001/api/docs-json

### Key Files Reference

| File | Purpose |
|------|---------|
| `src/main.ts` | Application entry point |
| `src/app.module.ts` | Root module |
| `src/database/schema.ts` | Database schema |
| `src/database/database.service.ts` | Database connection |
| `src/modules/alerts/alerts.service.ts` | Alert ingestion logic |
| `src/modules/incidents/incidents.service.ts` | Incident lifecycle |
| `src/queues/escalation.worker.ts` | Escalation processing |
| `src/websocket/incidents.gateway.ts` | Real-time updates |
| `.env.example` | Environment variable template |
| `drizzle.config.ts` | Database migration config |

---

**End of Deep Dive Documentation**

*This document provides a comprehensive overview of the OpenAlert backend architecture. For specific implementation details, refer to the source code and inline comments.*
