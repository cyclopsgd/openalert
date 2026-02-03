# Grafana Backend Analysis for OpenAlert Enhancement

**Document Type**: Technical Analysis & Recommendations
**Date**: 2026-02-03
**Author**: Claude Code Analysis
**Target Audience**: OpenAlert Development Team

## Executive Summary

This analysis examines Grafana's open-source alerting backend (NGAlert) to identify features, patterns, and architectural decisions that could enhance OpenAlert's incident management platform. Grafana has invested significant engineering effort into their unified alerting system, which processes alerts at scale across multiple organizations with sophisticated state management, evaluation scheduling, and notification routing.

**Key Findings**:
- Grafana's state machine approach provides robust alert lifecycle management
- Multi-dimensional alerting enables single rules to generate multiple alert instances
- Plugin architecture allows extensible notification channels and data sources
- Provisioning system supports configuration-as-code workflows
- Expression-based evaluation pipeline enables complex alerting conditions

**Recommendations Priority**:
1. **Critical**: State machine for alert/incident lifecycle (80% complete in OpenAlert)
2. **High**: Multi-dimensional alert grouping and fingerprinting
3. **High**: Template-based notification system with Go templates
4. **Medium**: Alert rule evaluation scheduler with jitter
5. **Medium**: Provisioning API for configuration-as-code
6. **Low**: Plugin architecture for notification channels

---

## Table of Contents

1. [Grafana NGAlert Architecture Overview](#1-grafana-ngalert-architecture-overview)
2. [Feature Analysis: 10 Key Enhancements](#2-feature-analysis-10-key-enhancements)
3. [Data Model Comparison](#3-data-model-comparison)
4. [API Design Patterns](#4-api-design-patterns)
5. [Implementation Recommendations](#5-implementation-recommendations)
6. [Code Examples](#6-code-examples)
7. [Migration Path](#7-migration-path)
8. [References](#8-references)

---

## 1. Grafana NGAlert Architecture Overview

### 1.1 System Components

Grafana's unified alerting system (NGAlert) separates concerns across specialized subsystems:

```
┌─────────────────────────────────────────────────────────────┐
│                    NGAlert Architecture                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────┐    ┌──────────────┐    ┌────────────────┐ │
│  │  Scheduler  │───▶│  Evaluator   │───▶│ State Manager  │ │
│  │  (Tick)     │    │  (Pipeline)  │    │ (Transitions)  │ │
│  └─────────────┘    └──────────────┘    └────────┬───────┘ │
│                                                    │         │
│                                                    ▼         │
│  ┌─────────────┐    ┌──────────────┐    ┌────────────────┐ │
│  │   Notifier  │◀───│ Alertmanager │◀───│   State Store  │ │
│  │  (Sender)   │    │  (Routing)   │    │  (Persistence) │ │
│  └─────────────┘    └──────────────┘    └────────────────┘ │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Key Characteristics**:
- **Decoupled components**: Each subsystem has clear responsibilities
- **Multi-tenancy**: Isolated per-organization alertmanager instances
- **Scalability**: Goroutine-per-rule with jittered scheduling
- **Resilience**: Graceful handling of missing data and evaluation errors

### 1.2 Alert Lifecycle

```
Normal ────▶ Pending ────▶ Alerting ────▶ Recovering ────▶ Normal
   │            │             │              │                │
   └────────────┴─────────────┴──────────────┴────────────────┘
                  │             │
                  ▼             ▼
               NoData        Error
```

**State Definitions**:
- **Normal**: Condition evaluates to false
- **Pending**: Condition true but below "For" duration threshold
- **Alerting**: Condition true for longer than "For" duration
- **Recovering**: Was alerting, now normal, but within "KeepFiringFor" window
- **NoData**: Query returned no data (configurable behavior)
- **Error**: Evaluation failed (configurable behavior)

---

## 2. Feature Analysis: 10 Key Enhancements

### 2.1 Multi-Dimensional Alert Instances ⭐⭐⭐⭐⭐

**Priority**: HIGH
**Implementation Effort**: Medium (2-3 weeks)
**Impact**: Transforms single alerts into intelligent instance tracking

#### What It Is

Grafana's alert rules can generate **multiple alert instances** from a single evaluation. Each unique combination of label values creates a separate alert instance with its own state.

**Example**: A single rule "High CPU" monitoring 50 servers generates 50 independent alert instances, each tracking state separately.

```go
// Grafana's AlertInstance struct
type AlertInstance struct {
    AlertInstanceKey
    Labels              InstanceLabels          // Unique label combination
    Annotations         InstanceAnnotations
    CurrentState        InstanceStateType       // Per-instance state
    CurrentStateSince   time.Time
    LastEvalTime        time.Time
    ResultFingerprint   string                  // Unique instance identifier
    // ... more fields
}

type AlertInstanceKey struct {
    RuleOrgID    int64
    RuleUID      string
    LabelsHash   string  // Hash of label combination
}
```

#### Why OpenAlert Needs This

**Current OpenAlert Limitation**:
OpenAlert currently uses a simple fingerprint mechanism without tracking individual instances per label combination. This means:
- Cannot track separate states for different hosts/services from one alert rule
- Cannot route different instances to different escalation policies
- Cannot aggregate related instances intelligently

**Use Case Example**:
```
Alert Rule: "Database Connection Pool Exhausted"
Instances:
  - {database: "users-db", region: "us-east"} → Firing
  - {database: "orders-db", region: "us-east"} → Normal
  - {database: "users-db", region: "eu-west"} → Firing

Current OpenAlert: Creates single incident
Grafana Approach: Tracks 3 independent instances
```

#### Implementation in OpenAlert

**Schema Changes Needed**:

```typescript
// Add to schema.ts
export const alertInstances = pgTable('alert_instances', {
  id: serial('id').primaryKey(),
  alertId: integer('alert_id')
    .notNull()
    .references(() => alerts.id, { onDelete: 'cascade' }),
  labelsHash: varchar('labels_hash', { length: 64 }).notNull(),
  labels: jsonb('labels').$type<Record<string, string>>(),
  annotations: jsonb('annotations').$type<Record<string, string>>(),
  state: alertInstanceStateEnum('state').notNull(), // firing, normal, pending, etc.
  stateSince: timestamp('state_since').notNull(),
  lastEvaluatedAt: timestamp('last_evaluated_at').notNull(),
  resultFingerprint: varchar('result_fingerprint', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  alertLabelsIdx: uniqueIndex('alert_labels_unique').on(table.alertId, table.labelsHash),
  stateIdx: index('alert_instance_state_idx').on(table.state),
}));

export const alertInstanceStateEnum = pgEnum('alert_instance_state', [
  'normal',
  'pending',
  'firing',
  'recovering',
  'nodata',
  'error'
]);
```

**Service Implementation**:

```typescript
// apps/api/src/modules/alerts/alert-instances.service.ts
import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

@Injectable()
export class AlertInstancesService {

  /**
   * Calculate unique hash for label combination
   */
  private calculateLabelsHash(labels: Record<string, string>): string {
    // Sort keys for consistent hashing
    const sortedKeys = Object.keys(labels).sort();
    const labelString = sortedKeys
      .map(key => `${key}="${labels[key]}"`)
      .join(',');

    return createHash('sha256')
      .update(labelString)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Find or create alert instance for label combination
   */
  async findOrCreateInstance(
    alertId: number,
    labels: Record<string, string>,
    annotations: Record<string, string>,
  ) {
    const labelsHash = this.calculateLabelsHash(labels);

    const existing = await this.db.query.alertInstances.findFirst({
      where: and(
        eq(alertInstances.alertId, alertId),
        eq(alertInstances.labelsHash, labelsHash),
      ),
    });

    if (existing) {
      return existing;
    }

    // Create new instance
    const [instance] = await this.db.db
      .insert(alertInstances)
      .values({
        alertId,
        labelsHash,
        labels,
        annotations,
        state: 'firing',
        stateSince: new Date(),
        lastEvaluatedAt: new Date(),
      })
      .returning();

    return instance;
  }

  /**
   * Update instance state with transition logic
   */
  async updateInstanceState(
    instanceId: number,
    newState: 'normal' | 'pending' | 'firing' | 'recovering',
    resultFingerprint?: string,
  ) {
    const instance = await this.db.query.alertInstances.findFirst({
      where: eq(alertInstances.id, instanceId),
    });

    if (!instance) {
      throw new NotFoundException('Alert instance not found');
    }

    // Check if state actually changed
    const stateChanged = instance.state !== newState;

    const updates: any = {
      lastEvaluatedAt: new Date(),
    };

    if (stateChanged) {
      updates.state = newState;
      updates.stateSince = new Date();
    }

    if (resultFingerprint) {
      updates.resultFingerprint = resultFingerprint;
    }

    await this.db.db
      .update(alertInstances)
      .set(updates)
      .where(eq(alertInstances.id, instanceId));

    return { stateChanged, previousState: instance.state };
  }
}
```

**Integration with Webhook Transformer**:

```typescript
// In webhook-transformer.service.ts
transformPrometheus(payload: any): StandardAlert[] {
  return payload.alerts.map((alert: any) => {
    // Extract labels for multi-dimensional tracking
    const labels = alert.labels || {};

    return {
      fingerprint: alert.fingerprint,
      status: alert.status === 'firing' ? 'firing' : 'resolved',
      severity: this.mapSeverity(alert.labels?.severity),
      title: alert.labels?.alertname || 'Unknown Alert',
      description: alert.annotations?.description,
      source: 'prometheus',
      labels: labels,  // Pass full label set
      annotations: alert.annotations || {},
      firedAt: new Date(alert.startsAt),
      resolvedAt: alert.endsAt ? new Date(alert.endsAt) : undefined,
    };
  });
}
```

---

### 2.2 State Machine with Pending/Recovering States ⭐⭐⭐⭐⭐

**Priority**: CRITICAL
**Implementation Effort**: Medium (1-2 weeks)
**Impact**: Reduces alert fatigue and false positives

#### What It Is

Grafana implements a sophisticated state machine with intermediate states to prevent flapping and provide grace periods:

1. **Pending State**: Alert condition is true but hasn't persisted long enough
2. **Recovering State**: Alert was firing, now normal, but still within grace period

```go
// From Grafana's state.go
func (a *State) NeedsSending(resendDelay time.Duration) bool {
    // Logic determines if notification should be sent based on:
    // - State transitions
    // - Resend intervals
    // - Resolution status
}
```

#### Implementation in OpenAlert

**Add State Configuration to Alert Rules**:

```typescript
// Schema addition
export const alertRules = pgTable('alert_rules', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  query: text('query').notNull(),
  forDuration: integer('for_duration').default(0), // Seconds before pending→firing
  keepFiringFor: integer('keep_firing_for').default(0), // Seconds for recovering state
  evaluationInterval: integer('evaluation_interval').default(60), // Evaluation frequency
  // ... other fields
});
```

**State Transition Logic**:

```typescript
// apps/api/src/modules/alerts/state-manager.service.ts
export type AlertState = 'normal' | 'pending' | 'firing' | 'recovering' | 'nodata' | 'error';

export interface StateTransition {
  from: AlertState;
  to: AlertState;
  reason: string;
  timestamp: Date;
}

@Injectable()
export class AlertStateManager {

  /**
   * Process evaluation result and update instance state
   */
  async processEvaluationResult(
    instance: AlertInstance,
    evaluationResult: {
      conditionMet: boolean;
      hasData: boolean;
      error?: Error;
    },
    rule: AlertRule,
  ): Promise<StateTransition> {
    const now = new Date();
    const currentState = instance.state;
    const timeSinceStateChange = now.getTime() - instance.stateSince.getTime();

    let newState: AlertState;
    let reason: string;

    // Handle error states
    if (evaluationResult.error) {
      newState = 'error';
      reason = `Evaluation failed: ${evaluationResult.error.message}`;
      return this.transition(instance, newState, reason);
    }

    // Handle no-data states
    if (!evaluationResult.hasData) {
      newState = 'nodata';
      reason = 'Query returned no data';
      return this.transition(instance, newState, reason);
    }

    // Main state machine logic
    if (evaluationResult.conditionMet) {
      // Condition is TRUE (breach detected)

      if (currentState === 'normal' || currentState === 'recovering') {
        // Just started breaching - enter pending
        if (rule.forDuration > 0) {
          newState = 'pending';
          reason = `Condition met, waiting ${rule.forDuration}s before firing`;
        } else {
          // No delay configured, fire immediately
          newState = 'firing';
          reason = 'Condition met';
        }
      } else if (currentState === 'pending') {
        // Check if we've been pending long enough
        if (timeSinceStateChange >= rule.forDuration * 1000) {
          newState = 'firing';
          reason = `Condition met for ${rule.forDuration}s`;
        } else {
          // Stay in pending
          newState = 'pending';
          reason = `Still pending (${Math.floor(timeSinceStateChange / 1000)}/${rule.forDuration}s)`;
        }
      } else {
        // Already firing, stay firing
        newState = 'firing';
        reason = 'Condition still met';
      }

    } else {
      // Condition is FALSE (normal)

      if (currentState === 'firing') {
        // Was firing, now normal - enter recovering if configured
        if (rule.keepFiringFor > 0) {
          newState = 'recovering';
          reason = `Condition resolved, grace period ${rule.keepFiringFor}s`;
        } else {
          newState = 'normal';
          reason = 'Condition resolved';
        }
      } else if (currentState === 'recovering') {
        // Check if we've been recovering long enough
        if (timeSinceStateChange >= rule.keepFiringFor * 1000) {
          newState = 'normal';
          reason = `Grace period elapsed, fully resolved`;
        } else {
          // Stay in recovering
          newState = 'recovering';
          reason = `Still recovering (${Math.floor(timeSinceStateChange / 1000)}/${rule.keepFiringFor}s)`;
        }
      } else if (currentState === 'pending') {
        // Was pending, condition no longer met
        newState = 'normal';
        reason = 'Condition no longer met (flap prevented)';
      } else {
        // Already normal, stay normal
        newState = 'normal';
        reason = 'Condition not met';
      }
    }

    return this.transition(instance, newState, reason);
  }

  private async transition(
    instance: AlertInstance,
    newState: AlertState,
    reason: string,
  ): Promise<StateTransition> {
    const transition: StateTransition = {
      from: instance.state,
      to: newState,
      reason,
      timestamp: new Date(),
    };

    // Only update if state actually changed
    if (instance.state !== newState) {
      await this.db.db
        .update(alertInstances)
        .set({
          state: newState,
          stateSince: transition.timestamp,
          lastEvaluatedAt: transition.timestamp,
        })
        .where(eq(alertInstances.id, instance.id));

      // Emit event for notification system
      if (this.shouldNotify(transition)) {
        this.eventEmitter.emit('alert.state.changed', {
          instance,
          transition,
        });
      }
    }

    return transition;
  }

  private shouldNotify(transition: StateTransition): boolean {
    // Only notify on these transitions
    const notifiableTransitions = [
      'normal->firing',
      'pending->firing',
      'firing->normal',
      'recovering->normal',
      'normal->error',
      'firing->error',
    ];

    const transitionKey = `${transition.from}->${transition.to}`;
    return notifiableTransitions.includes(transitionKey);
  }
}
```

**Benefits**:
- ✅ Prevents notification spam from flapping alerts
- ✅ Configurable grace periods per alert rule
- ✅ Clear state transition tracking for debugging
- ✅ Reduces alert fatigue for operators

---

### 2.3 Go Template-Based Notification System ⭐⭐⭐⭐

**Priority**: HIGH
**Implementation Effort**: Medium (2 weeks)
**Impact**: Flexible, powerful notification formatting

#### What It Is

Grafana uses Go templates (via `text/template` package) for notification formatting, allowing users to customize messages with:
- Conditional logic
- Loops over alert instances
- Variable substitution
- Custom formatting functions

**Example Grafana Template**:

```go
{{ define "alert.title" }}
[{{ .Status | toUpper }}] {{ .GroupLabels.alertname }}
{{ end }}

{{ define "alert.message" }}
{{ if gt (len .Alerts.Firing) 0 }}
Firing Alerts ({{ len .Alerts.Firing }}):
{{ range .Alerts.Firing }}
  - {{ .Labels.instance }}: {{ .Annotations.summary }}
{{ end }}
{{ end }}

{{ if gt (len .Alerts.Resolved) 0 }}
Resolved Alerts ({{ len .Alerts.Resolved }}):
{{ range .Alerts.Resolved }}
  - {{ .Labels.instance }}: Resolved at {{ .EndsAt }}
{{ end }}
{{ end }}
{{ end }}
```

#### Why Not Just Use JavaScript/TypeScript Templates?

While Node.js has many template engines (Handlebars, EJS, Pug), Go templates offer:
- **Security**: Automatically escapes output
- **Simplicity**: Limited feature set prevents abuse
- **Compatibility**: Can import Grafana community templates
- **Performance**: Compiled templates with caching

#### Implementation in OpenAlert with Handlebars

Since OpenAlert uses Node.js, we'll use **Handlebars** (similar syntax to Go templates):

```typescript
// apps/api/src/modules/notifications/template.service.ts
import Handlebars from 'handlebars';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NotificationTemplateService {
  private readonly logger = new Logger(NotificationTemplateService.name);
  private templates: Map<string, HandlebarsTemplateDelegate> = new Map();

  constructor() {
    this.registerHelpers();
    this.registerDefaultTemplates();
  }

  /**
   * Register custom Handlebars helpers
   */
  private registerHelpers() {
    // Format timestamp
    Handlebars.registerHelper('formatDate', (date: Date, format: string) => {
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      });
    });

    // Duration formatting
    Handlebars.registerHelper('duration', (seconds: number) => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      if (hours > 0) return `${hours}h ${minutes}m`;
      if (minutes > 0) return `${minutes}m`;
      return `${seconds}s`;
    });

    // Severity color/emoji
    Handlebars.registerHelper('severityEmoji', (severity: string) => {
      const map: Record<string, string> = {
        critical: '🔴',
        high: '🟠',
        medium: '🟡',
        low: '🔵',
        info: '⚪',
      };
      return map[severity] || '❓';
    });

    // Uppercase
    Handlebars.registerHelper('upper', (str: string) => str.toUpperCase());
  }

  /**
   * Register default notification templates
   */
  private registerDefaultTemplates() {
    // Default title template
    this.registerTemplate('default.title', `
[{{ upper status }}] {{ incident.title }}
    `.trim());

    // Default Slack message
    this.registerTemplate('slack.default', `
{{ severityEmoji incident.severity }} *{{ incident.title }}*

*Status:* {{ upper incident.status }}
*Severity:* {{ incident.severity }}
*Service:* {{ service.name }}
*Triggered:* {{ formatDate incident.triggeredAt }}

{{#if alerts}}
*Firing Alerts ({{ alerts.length }}):*
{{#each alerts}}
  • {{ this.title }}
    {{#if this.labels.instance}}Instance: {{ this.labels.instance }}{{/if}}
{{/each}}
{{/if}}

{{#if incident.description}}
*Description:*
{{ incident.description }}
{{/if}}

<{{ incidentUrl }}|View Incident #{{ incident.incidentNumber }}>
    `.trim());

    // Default email subject
    this.registerTemplate('email.subject', `
[OpenAlert] [{{ upper incident.severity }}] {{ incident.title }}
    `.trim());

    // Default email body
    this.registerTemplate('email.body', `
<h2>Incident #{{ incident.incidentNumber }}: {{ incident.title }}</h2>

<p><strong>Status:</strong> {{ upper incident.status }}</p>
<p><strong>Severity:</strong> {{ incident.severity }}</p>
<p><strong>Service:</strong> {{ service.name }}</p>
<p><strong>Triggered:</strong> {{ formatDate incident.triggeredAt }}</p>

{{#if alerts}}
<h3>Firing Alerts ({{ alerts.length }})</h3>
<ul>
{{#each alerts}}
  <li>
    <strong>{{ this.title }}</strong><br>
    {{#if this.description}}{{ this.description }}<br>{{/if}}
    {{#if this.labels.instance}}Instance: {{ this.labels.instance }}<br>{{/if}}
    Fired at: {{ formatDate this.firedAt }}
  </li>
{{/each}}
</ul>
{{/if}}

{{#if incident.description}}
<h3>Description</h3>
<p>{{ incident.description }}</p>
{{/if}}

<p><a href="{{ incidentUrl }}">View Incident Details</a></p>
    `.trim());
  }

  /**
   * Register a template by name
   */
  registerTemplate(name: string, source: string): void {
    try {
      const compiled = Handlebars.compile(source);
      this.templates.set(name, compiled);
      this.logger.debug(`Registered template: ${name}`);
    } catch (error) {
      this.logger.error(`Failed to compile template ${name}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Render a template with context data
   */
  render(templateName: string, context: any): string {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    try {
      return template(context);
    } catch (error) {
      this.logger.error(`Failed to render template ${templateName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Allow users to customize templates via database
   */
  async renderCustom(
    customTemplate: string,
    context: any,
  ): Promise<string> {
    try {
      const compiled = Handlebars.compile(customTemplate);
      return compiled(context);
    } catch (error) {
      this.logger.error(`Failed to render custom template: ${error.message}`);
      // Fallback to default
      return this.render('default.title', context);
    }
  }
}
```

**Usage in Notification Service**:

```typescript
// In notifications.service.ts
async sendSlackNotification(incident: Incident, channel: string) {
  const context = {
    incident,
    service: await this.getService(incident.serviceId),
    alerts: await this.getIncidentAlerts(incident.id),
    incidentUrl: `${process.env.APP_URL}/incidents/${incident.id}`,
    status: incident.status,
  };

  const message = this.templateService.render('slack.default', context);

  await this.slackClient.sendMessage(channel, message);
}
```

**Schema for Custom Templates**:

```typescript
export const notificationTemplates = pgTable('notification_templates', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  channel: varchar('channel', { length: 50 }).notNull(), // email, slack, teams, etc.
  type: varchar('type', { length: 50 }).notNull(), // subject, body, message
  template: text('template').notNull(),
  isDefault: boolean('is_default').default(false),
  teamId: integer('team_id').references(() => teams.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

---

### 2.4 Jittered Evaluation Scheduler ⭐⭐⭐

**Priority**: MEDIUM
**Implementation Effort**: Low (2-3 days)
**Impact**: Prevents thundering herd, improves performance

#### What It Is

Grafana's scheduler prevents all alert rules from evaluating simultaneously by:
1. Grouping rules by evaluation interval (1m, 5m, 10m, etc.)
2. Adding jitter to spread evaluations across the interval
3. Using a tick-based system to trigger evaluations

From Grafana's code:
```go
// Jitter offset prevents thundering herd
jitterOffsetInTicks := rule.uid.Hash() % interval
staggeredTime := baseTime + (jitterOffset * tickDuration)
```

#### Current OpenAlert Approach

OpenAlert likely uses BullMQ with fixed intervals, which can cause:
- All alerts evaluating at the same time
- Database connection spikes
- Network congestion to external systems

#### Implementation in OpenAlert

```typescript
// apps/api/src/modules/alerts/evaluation-scheduler.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { createHash } from 'crypto';

@Injectable()
export class AlertEvaluationScheduler {
  private readonly logger = new Logger(AlertEvaluationScheduler.name);
  private readonly baseTickInterval = 10000; // 10 seconds base tick

  /**
   * Main scheduler tick - runs every 10 seconds
   */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async tick() {
    const tickTime = Date.now();
    const tickNumber = Math.floor(tickTime / this.baseTickInterval);

    this.logger.debug(`Scheduler tick #${tickNumber}`);

    // Get all active alert rules
    const rules = await this.getActiveRules();

    // Determine which rules should evaluate this tick
    const rulesToEvaluate = rules.filter(rule =>
      this.shouldEvaluate(rule, tickNumber)
    );

    this.logger.debug(
      `Evaluating ${rulesToEvaluate.length} of ${rules.length} rules`
    );

    // Stagger rule evaluations across the tick interval
    const staggerDelay = this.baseTickInterval / rulesToEvaluate.length;

    rulesToEvaluate.forEach((rule, index) => {
      const delay = Math.floor(index * staggerDelay);

      setTimeout(() => {
        this.evaluateRule(rule).catch(err => {
          this.logger.error(
            `Failed to evaluate rule ${rule.id}: ${err.message}`
          );
        });
      }, delay);
    });
  }

  /**
   * Determine if a rule should evaluate on this tick
   */
  private shouldEvaluate(rule: AlertRule, tickNumber: number): boolean {
    const intervalTicks = Math.floor(
      rule.evaluationInterval / (this.baseTickInterval / 1000)
    );

    if (intervalTicks <= 0) return true;

    // Calculate jitter based on rule ID hash
    const jitter = this.calculateJitter(rule.id, intervalTicks);

    // Rule evaluates when (tickNumber + jitter) % intervalTicks === 0
    return (tickNumber + jitter) % intervalTicks === 0;
  }

  /**
   * Calculate consistent jitter for a rule
   */
  private calculateJitter(ruleId: number, intervalTicks: number): number {
    const hash = createHash('sha256')
      .update(ruleId.toString())
      .digest('hex');

    // Use first 8 characters of hash to generate jitter
    const hashValue = parseInt(hash.substring(0, 8), 16);

    return hashValue % intervalTicks;
  }

  private async evaluateRule(rule: AlertRule) {
    // Add to evaluation queue
    await this.evaluationQueue.add('evaluate', {
      ruleId: rule.id,
      scheduledAt: new Date(),
    });
  }
}
```

**Benefits**:
- ✅ Spreads load evenly across time
- ✅ Prevents database connection spikes
- ✅ Consistent jitter based on rule ID
- ✅ Scalable to thousands of rules

---

### 2.5 Provisioning API for Configuration-as-Code ⭐⭐⭐

**Priority**: MEDIUM
**Implementation Effort**: Medium (1-2 weeks)
**Impact**: Enterprise feature, enables GitOps workflows

#### What It Is

Grafana tracks the **provenance** (source) of every configuration:
- `ProvenanceAPI`: Created via UI/API
- `ProvenanceFile`: Created from YAML/JSON files
- `ProvenanceNone`: No tracking

This prevents:
- Manual UI changes from being overwritten by provisioning
- Provisioned configs from being edited in UI
- Configuration drift

```go
// From Grafana's provisioning.go
type Provenance string

const (
    ProvenanceNone                Provenance = ""
    ProvenanceAPI                 Provenance = "api"
    ProvenanceFile                Provenance = "file"
)

type Provisionable interface {
    ResourceType() string
    ResourceID() string
}
```

#### Implementation in OpenAlert

**Schema Changes**:

```typescript
// Add provenance to key tables
export const services = pgTable('services', {
  // ... existing fields
  provenance: varchar('provenance', { length: 50 }).default('none'),
  provenanceMetadata: jsonb('provenance_metadata').$type<{
    source?: string;
    syncedAt?: string;
    checksum?: string;
  }>(),
});

export const escalationPolicies = pgTable('escalation_policies', {
  // ... existing fields
  provenance: varchar('provenance', { length: 50 }).default('none'),
  provenanceMetadata: jsonb('provenance_metadata'),
});
```

**Provisioning Service**:

```typescript
// apps/api/src/modules/provisioning/provisioning.service.ts
import * as yaml from 'js-yaml';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Injectable, Logger } from '@nestjs/common';

export type Provenance = 'none' | 'api' | 'file' | 'git';

export interface ProvisioningConfig {
  version: string;
  services?: ServiceConfig[];
  escalationPolicies?: EscalationPolicyConfig[];
  schedules?: ScheduleConfig[];
}

@Injectable()
export class ProvisioningService {
  private readonly logger = new Logger(ProvisioningService.name);
  private readonly configDir = process.env.PROVISIONING_DIR || '/etc/openalert/provisioning';

  /**
   * Load and sync provisioning files
   */
  async syncFromFiles(): Promise<void> {
    this.logger.log('Starting provisioning sync from files');

    try {
      const files = await this.findProvisioningFiles();

      for (const file of files) {
        await this.processFile(file);
      }

      this.logger.log(`Provisioned ${files.length} configuration files`);
    } catch (error) {
      this.logger.error(`Provisioning failed: ${error.message}`);
      throw error;
    }
  }

  private async processFile(filePath: string): Promise<void> {
    const content = await fs.readFile(filePath, 'utf-8');
    const config = yaml.load(content) as ProvisioningConfig;

    // Validate version
    if (config.version !== 'v1') {
      throw new Error(`Unsupported config version: ${config.version}`);
    }

    // Provision services
    if (config.services) {
      for (const serviceConfig of config.services) {
        await this.provisionService(serviceConfig, filePath);
      }
    }

    // Provision escalation policies
    if (config.escalationPolicies) {
      for (const policyConfig of config.escalationPolicies) {
        await this.provisionEscalationPolicy(policyConfig, filePath);
      }
    }
  }

  /**
   * Provision a service with provenance tracking
   */
  private async provisionService(
    config: ServiceConfig,
    sourceFile: string,
  ): Promise<void> {
    const existing = await this.db.query.services.findFirst({
      where: eq(services.slug, config.slug),
    });

    if (existing) {
      // Check if it's safe to update
      if (existing.provenance === 'api') {
        this.logger.warn(
          `Service ${config.slug} was created via API, skipping file update`
        );
        return;
      }

      // Check if content changed
      const currentChecksum = this.calculateChecksum(existing);
      const newChecksum = this.calculateChecksum(config);

      if (currentChecksum === newChecksum) {
        this.logger.debug(`Service ${config.slug} unchanged`);
        return;
      }

      // Update with provenance
      await this.db.db
        .update(services)
        .set({
          name: config.name,
          description: config.description,
          provenance: 'file',
          provenanceMetadata: {
            source: sourceFile,
            syncedAt: new Date().toISOString(),
            checksum: newChecksum,
          },
          updatedAt: new Date(),
        })
        .where(eq(services.id, existing.id));

      this.logger.log(`Updated service: ${config.slug} (from file)`);
    } else {
      // Create new with provenance
      await this.db.db.insert(services).values({
        name: config.name,
        slug: config.slug,
        description: config.description,
        teamId: await this.resolveTeamId(config.team),
        provenance: 'file',
        provenanceMetadata: {
          source: sourceFile,
          syncedAt: new Date().toISOString(),
          checksum: this.calculateChecksum(config),
        },
      });

      this.logger.log(`Created service: ${config.slug} (from file)`);
    }
  }

  /**
   * Prevent API updates to provisioned resources
   */
  async validateUpdateAllowed(
    resourceType: string,
    resourceId: number,
    requestSource: 'api' | 'file',
  ): Promise<void> {
    const resource = await this.getResource(resourceType, resourceId);

    if (resource.provenance === 'file' && requestSource === 'api') {
      throw new Error(
        `Cannot update ${resourceType} via API: resource is provisioned from file. ` +
        `Update the provisioning file and re-sync instead.`
      );
    }
  }
}
```

**Example Provisioning File**:

```yaml
# /etc/openalert/provisioning/production.yaml
version: v1

services:
  - name: "API Gateway"
    slug: "api-gateway"
    description: "Production API Gateway"
    team: "platform"
    escalationPolicy: "critical-services"

  - name: "User Database"
    slug: "user-db"
    description: "PostgreSQL Primary"
    team: "database"
    escalationPolicy: "database-team"

escalationPolicies:
  - name: "Critical Services"
    slug: "critical-services"
    description: "For production critical services"
    repeatAfter: 300
    levels:
      - level: 1
        delayMinutes: 0
        targets:
          - type: "user"
            email: "oncall@company.com"
      - level: 2
        delayMinutes: 5
        targets:
          - type: "schedule"
            name: "platform-oncall"
      - level: 3
        delayMinutes: 15
        targets:
          - type: "user"
            email: "cto@company.com"
```

---

### 2.6 Alert Grouping and Aggregation ⭐⭐⭐⭐

**Priority**: HIGH
**Implementation Effort**: Medium (1 week)
**Impact**: Reduces notification noise significantly

#### What It Is

Grafana's Alertmanager can group multiple alert instances into a single notification based on label matching:

```yaml
# Grafana notification policy
route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 12h
```

**Example**:
```
Instead of:
  - Notification: "High CPU on server-1"
  - Notification: "High CPU on server-2"
  - Notification: "High CPU on server-3"

Grouped:
  - Notification: "High CPU on 3 servers (server-1, server-2, server-3)"
```

#### Implementation in OpenAlert

```typescript
// apps/api/src/modules/notifications/grouping.service.ts
import { Injectable } from '@nestjs/common';

export interface GroupingRule {
  groupBy: string[]; // Label keys to group on
  groupWait: number; // Seconds to wait before sending first notification
  groupInterval: number; // Seconds to wait before sending additional notifications
}

@Injectable()
export class AlertGroupingService {

  /**
   * Group alert instances by specified labels
   */
  groupInstances(
    instances: AlertInstance[],
    groupBy: string[],
  ): Map<string, AlertInstance[]> {
    const groups = new Map<string, AlertInstance[]>();

    for (const instance of instances) {
      const groupKey = this.calculateGroupKey(instance.labels, groupBy);

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }

      groups.get(groupKey)!.push(instance);
    }

    return groups;
  }

  /**
   * Calculate group key from labels
   */
  private calculateGroupKey(
    labels: Record<string, string>,
    groupBy: string[],
  ): string {
    const values = groupBy
      .map(key => `${key}="${labels[key] || ''}"`)
      .sort()
      .join(',');

    return createHash('sha256').update(values).digest('hex').substring(0, 16);
  }

  /**
   * Format grouped notification message
   */
  formatGroupedNotification(
    groupKey: string,
    instances: AlertInstance[],
  ): string {
    const alertName = instances[0].labels.alertname;
    const count = instances.length;

    if (count === 1) {
      return `${alertName}: ${instances[0].annotations.summary}`;
    }

    const instanceList = instances
      .map(i => i.labels.instance || 'unknown')
      .slice(0, 5)
      .join(', ');

    const more = count > 5 ? ` and ${count - 5} more` : '';

    return `${alertName} on ${count} instances: ${instanceList}${more}`;
  }
}
```

---

### 2.7 Historical State Tracking and Annotations ⭐⭐⭐

**Priority**: MEDIUM
**Implementation Effort**: Low (2-3 days)
**Impact**: Improved debugging and audit trail

#### What It Is

Grafana tracks:
- Every state transition with timestamp and reason
- Annotations explaining unexpected state changes
- Historical evaluation results

The `grafana_state_reason` annotation explains why an alert is in a specific state.

#### Implementation in OpenAlert

```typescript
// Schema for state history
export const alertStateHistory = pgTable('alert_state_history', {
  id: serial('id').primaryKey(),
  instanceId: integer('instance_id')
    .notNull()
    .references(() => alertInstances.id, { onDelete: 'cascade' }),
  previousState: alertInstanceStateEnum('previous_state').notNull(),
  newState: alertInstanceStateEnum('new_state').notNull(),
  reason: text('reason'),
  evaluationResult: jsonb('evaluation_result'),
  transitionedAt: timestamp('transitioned_at').defaultNow().notNull(),
}, (table) => ({
  instanceIdx: index('state_history_instance_idx').on(table.instanceId),
  timeIdx: index('state_history_time_idx').on(table.transitionedAt),
}));
```

---

### 2.8 External Alertmanager Support ⭐⭐

**Priority**: LOW
**Implementation Effort**: High (3-4 weeks)
**Impact**: Enterprise feature for large deployments

#### What It Is

Grafana can send alerts to external Alertmanager instances (Prometheus Alertmanager) for:
- Advanced routing and silencing
- Integration with existing alerting infrastructure
- High-availability setups

**Not recommended for OpenAlert MVP** but worth noting for future enterprise features.

---

### 2.9 Silence and Mute Timings ⭐⭐⭐⭐

**Priority**: HIGH
**Implementation Effort**: Medium (1-2 weeks)
**Impact**: Essential for maintenance windows

#### What It Is

Grafana supports two notification suppression mechanisms:

1. **Silences**: Temporary suppression with label matching
   ```json
   {
     "matchers": [
       {"name": "alertname", "value": "HighCPU", "isRegex": false},
       {"name": "cluster", "value": "prod", "isRegex": false}
     ],
     "startsAt": "2026-02-03T10:00:00Z",
     "endsAt": "2026-02-03T12:00:00Z",
     "comment": "Planned maintenance"
   }
   ```

2. **Mute Timings**: Recurring time windows (e.g., nights, weekends)
   ```yaml
   mute_timings:
     - name: "business-hours-only"
       time_intervals:
         - weekdays: ['monday:friday']
           times:
             - start_time: '09:00'
               end_time: '17:00'
   ```

#### Implementation in OpenAlert

```typescript
// Schema
export const silences = pgTable('silences', {
  id: serial('id').primaryKey(),
  matchers: jsonb('matchers').$type<LabelMatcher[]>(),
  startsAt: timestamp('starts_at').notNull(),
  endsAt: timestamp('ends_at').notNull(),
  comment: text('comment'),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const muteTimings = pgTable('mute_timings', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  timeIntervals: jsonb('time_intervals').$type<TimeInterval[]>(),
  teamId: integer('team_id').references(() => teams.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

interface LabelMatcher {
  name: string;
  value: string;
  isRegex: boolean;
}

interface TimeInterval {
  weekdays?: string[]; // ['monday', 'tuesday']
  daysOfMonth?: number[]; // [1, 15, -1]
  months?: string[]; // ['january', 'december']
  times?: { start: string; end: string }[]; // [{start: '09:00', end: '17:00'}]
}
```

**Silence Matching Service**:

```typescript
@Injectable()
export class SilenceService {

  /**
   * Check if alert instance is silenced
   */
  async isSilenced(instance: AlertInstance): Promise<boolean> {
    const now = new Date();

    // Get active silences
    const activeSilences = await this.db.query.silences.findMany({
      where: and(
        lte(silences.startsAt, now),
        gte(silences.endsAt, now),
      ),
    });

    // Check if any silence matches this instance
    for (const silence of activeSilences) {
      if (this.matchesLabels(instance.labels, silence.matchers)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if labels match silence matchers
   */
  private matchesLabels(
    labels: Record<string, string>,
    matchers: LabelMatcher[],
  ): boolean {
    return matchers.every(matcher => {
      const labelValue = labels[matcher.name];
      if (!labelValue) return false;

      if (matcher.isRegex) {
        const regex = new RegExp(matcher.value);
        return regex.test(labelValue);
      }

      return labelValue === matcher.value;
    });
  }
}
```

---

### 2.10 Recording Rules (Metrics Aggregation) ⭐⭐

**Priority**: LOW
**Implementation Effort**: High (3-4 weeks)
**Impact**: Performance optimization for complex queries

#### What It Is

Grafana's **recording rules** pre-compute expensive queries and store results as new metrics:

```yaml
# Example recording rule
name: "High CPU Aggregation"
interval: 1m
expr: "avg(cpu_usage) by (cluster, service)"
record: "cluster:cpu_usage:avg"
```

This is useful for:
- Dashboard performance
- Complex aggregations across time series
- Reducing load on data sources

**Not recommended for OpenAlert MVP** as it's primarily for metrics visualization, not incident management.

---

## 3. Data Model Comparison

### 3.1 Alert Rule Structure

| Field | Grafana | OpenAlert (Current) | Recommendation |
|-------|---------|---------------------|----------------|
| **Unique ID** | UID (string) | id (serial) | ✅ Keep current |
| **Organization** | OrgID | teamId | ✅ Keep current |
| **Name/Title** | Title | name | ✅ Keep current |
| **Condition** | Condition (expression) | query | ⚠️ Expand to support expressions |
| **Evaluation Interval** | IntervalSeconds | ❌ Missing | ➕ Add |
| **For Duration** | For (time.Duration) | ❌ Missing | ➕ Add for pending state |
| **Keep Firing For** | KeepFiringFor | ❌ Missing | ➕ Add for recovering state |
| **No Data Behavior** | NoDataState enum | ❌ Missing | ➕ Add configuration |
| **Error Behavior** | ExecErrState enum | ❌ Missing | ➕ Add configuration |
| **Labels** | Labels map | labels (jsonb) | ✅ Keep current |
| **Annotations** | Annotations map | annotations (jsonb) | ✅ Keep current |
| **Pause** | IsPaused | ❌ Missing | ➕ Add for temporary disable |

### 3.2 Alert Instance Structure

| Field | Grafana | OpenAlert (Current) | Recommendation |
|-------|---------|---------------------|----------------|
| **Instance Key** | RuleUID + LabelsHash | fingerprint | ⚠️ Change to composite key |
| **State** | 6 states (Normal, Pending, Firing, Recovering, NoData, Error) | 4 states (firing, acknowledged, resolved, suppressed) | ➕ Add pending, recovering, nodata, error |
| **State Since** | CurrentStateSince | ❌ Missing | ➕ Add |
| **Last Evaluated** | LastEvalTime | ❌ Missing | ➕ Add |
| **Result Fingerprint** | ResultFingerprint | fingerprint | ✅ Keep but clarify purpose |
| **Labels** | InstanceLabels | labels | ✅ Keep current |
| **Annotations** | InstanceAnnotations | annotations | ✅ Keep current |

---

## 4. API Design Patterns

### 4.1 Grafana's RESTful Structure

Grafana's alerting API follows these patterns:

```
# Alert Rules (Ruler API)
GET    /api/ruler/grafana/api/v1/rules
GET    /api/ruler/grafana/api/v1/rules/{namespace}/{group}
POST   /api/ruler/grafana/api/v1/rules/{namespace}
DELETE /api/ruler/grafana/api/v1/rules/{namespace}/{group}

# Alertmanager Configuration
GET    /api/alertmanager/grafana/config/api/v1/alerts
POST   /api/alertmanager/grafana/config/api/v1/alerts
DELETE /api/alertmanager/grafana/config/api/v1/alerts

# Silences
GET    /api/alertmanager/grafana/api/v2/silences
POST   /api/alertmanager/grafana/api/v2/silences
DELETE /api/alertmanager/grafana/api/v2/silence/{id}

# Provisioning API (separate namespace)
GET    /api/v1/provisioning/alert-rules
POST   /api/v1/provisioning/alert-rules
PUT    /api/v1/provisioning/alert-rules/{uid}
```

**Key Observations**:
1. Separate `/api/alertmanager` and `/api/ruler` namespaces
2. Provisioning APIs use different path from regular APIs
3. Versioned APIs (`/v1`, `/v2`)
4. Resource-oriented design

### 4.2 OpenAlert's Current Structure

```
# Webhook Ingestion
POST /webhooks/v1/:integrationKey
POST /webhooks/prometheus/:integrationKey
POST /webhooks/grafana/:integrationKey

# Alert Management
GET  /alerts
GET  /alerts/:id
PATCH /alerts/:id/acknowledge
PATCH /alerts/:id/resolve

# Incident Management
GET  /incidents
GET  /incidents/:id
PATCH /incidents/:id/acknowledge
PATCH /incidents/:id/resolve
```

**Recommendations**:
1. ✅ Current structure is clean and follows REST principles
2. ➕ Add `/api/v1` prefix for versioning
3. ➕ Add provisioning namespace: `/api/v1/provisioning`
4. ➕ Add configuration endpoints: `/api/v1/config`
5. ➕ Add silences endpoints: `/api/v1/silences`

---

## 5. Implementation Recommendations

### Priority Matrix

| Feature | Priority | Effort | Impact | Recommended Timeline |
|---------|----------|--------|--------|---------------------|
| Multi-dimensional alert instances | HIGH | Medium | High | Phase 2 (Weeks 5-8) |
| State machine (pending/recovering) | CRITICAL | Medium | High | Phase 1 (Weeks 1-4) |
| Template-based notifications | HIGH | Medium | High | Phase 2 (Weeks 5-8) |
| Jittered evaluation scheduler | MEDIUM | Low | Medium | Phase 2 (Weeks 5-8) |
| Alert grouping/aggregation | HIGH | Medium | High | Phase 2 (Weeks 5-8) |
| Silence management | HIGH | Medium | High | Phase 2 (Weeks 5-8) |
| Mute timings | MEDIUM | Medium | Medium | Phase 3 (Weeks 9-12) |
| Provisioning API | MEDIUM | Medium | Medium | Phase 3 (Weeks 9-12) |
| Historical state tracking | MEDIUM | Low | Medium | Phase 2 (Weeks 5-8) |
| External Alertmanager | LOW | High | Low | Phase 4 (Future) |

### Implementation Order

**Phase 1 (Weeks 1-4): MVP Foundation** ✅ MOSTLY COMPLETE
- ✅ Basic alert ingestion
- ✅ Incident creation
- ✅ Escalation policies
- ➕ Add state machine with pending/recovering states
- ➕ Add historical state tracking

**Phase 2 (Weeks 5-8): Enhanced Alert Management**
- Multi-dimensional alert instances
- Template-based notifications
- Alert grouping and aggregation
- Jittered evaluation scheduler
- Silence management

**Phase 3 (Weeks 9-12): Enterprise Features**
- Provisioning API
- Mute timings
- Advanced routing
- API versioning

**Phase 4 (Future): Advanced Features**
- Plugin architecture for integrations
- External Alertmanager support
- Recording rules
- Custom data sources

---

## 6. Code Examples

### 6.1 Complete Alert Instance Flow

```typescript
// 1. Webhook receives alert
@Post('prometheus/:integrationKey')
async receivePrometheus(
  @Param('integrationKey') integrationKey: string,
  @Body() payload: PrometheusWebhook,
) {
  const alerts = this.transformer.transformPrometheus(payload);

  for (const alert of alerts) {
    // 2. Create or update alert instance
    const instance = await this.instanceService.findOrCreateInstance(
      alert.alertId,
      alert.labels,
      alert.annotations,
    );

    // 3. Evaluate state transition
    const transition = await this.stateManager.processEvaluationResult(
      instance,
      {
        conditionMet: alert.status === 'firing',
        hasData: true,
      },
      alertRule,
    );

    // 4. Check if notification needed
    if (this.shouldNotify(transition)) {
      // 5. Check silences
      const isSilenced = await this.silenceService.isSilenced(instance);

      if (!isSilenced) {
        // 6. Group with similar alerts
        const group = await this.groupingService.groupInstances([instance]);

        // 7. Render notification template
        const message = await this.templateService.render(
          'slack.default',
          { instance, group },
        );

        // 8. Send notification
        await this.notificationService.send(message);
      }
    }
  }

  return { status: 'accepted' };
}
```

### 6.2 State Transition Event Handler

```typescript
// Listen for state changes
@OnEvent('alert.state.changed')
async handleStateChange(event: {
  instance: AlertInstance;
  transition: StateTransition;
}) {
  const { instance, transition } = event;

  // Log transition
  await this.db.db.insert(alertStateHistory).values({
    instanceId: instance.id,
    previousState: transition.from,
    newState: transition.to,
    reason: transition.reason,
    transitionedAt: transition.timestamp,
  });

  // Create or update incident
  if (transition.to === 'firing' && transition.from !== 'pending') {
    await this.incidentService.findOrCreateForAlert({
      serviceId: instance.serviceId,
      severity: instance.severity,
      title: instance.annotations.summary,
    });
  }

  // Resolve incident if all instances normal
  if (transition.to === 'normal') {
    await this.checkAndResolveIncident(instance.incidentId);
  }
}
```

---

## 7. Migration Path

### 7.1 Backward Compatibility

To maintain compatibility with existing OpenAlert deployments:

1. **Keep existing `alerts` table** for now
2. **Add new `alert_instances` table** alongside
3. **Migrate data gradually**:
   ```typescript
   async migrateAlertsToInstances() {
     const alerts = await this.db.query.alerts.findMany();

     for (const alert of alerts) {
       await this.db.db.insert(alertInstances).values({
         alertId: alert.id,
         labelsHash: this.calculateLabelsHash(alert.labels),
         labels: alert.labels,
         annotations: alert.annotations,
         state: this.mapStatusToState(alert.status),
         stateSince: alert.firedAt,
         lastEvaluatedAt: alert.updatedAt,
       });
     }
   }
   ```

4. **Feature flag for new behavior**:
   ```typescript
   const useMultiDimensionalInstances =
     process.env.FEATURE_MULTI_DIMENSIONAL_ALERTS === 'true';
   ```

### 7.2 Database Migrations

```typescript
// Migration 001: Add alert_instances table
export async function up(db: Db) {
  await db.schema
    .createTable('alert_instances')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('alert_id', 'integer', (col) =>
      col.references('alerts.id').onDelete('cascade').notNull()
    )
    .addColumn('labels_hash', 'varchar(64)', (col) => col.notNull())
    .addColumn('labels', 'jsonb')
    .addColumn('state', 'alert_instance_state', (col) => col.notNull())
    .addColumn('state_since', 'timestamp', (col) => col.notNull())
    .execute();
}

// Migration 002: Add state machine fields to alert rules
export async function up(db: Db) {
  await db.schema
    .alterTable('alert_rules')
    .addColumn('for_duration', 'integer', (col) => col.defaultTo(0))
    .addColumn('keep_firing_for', 'integer', (col) => col.defaultTo(0))
    .addColumn('evaluation_interval', 'integer', (col) => col.defaultTo(60))
    .execute();
}
```

---

## 8. References

### Grafana Source Code
- **Main Repository**: https://github.com/grafana/grafana
- **NGAlert Package**: `pkg/services/ngalert/`
- **State Manager**: `pkg/services/ngalert/state/manager.go`
- **Scheduler**: `pkg/services/ngalert/schedule/schedule.go`
- **Models**: `pkg/services/ngalert/models/`

### Grafana Documentation
- **Alerting Fundamentals**: https://grafana.com/docs/grafana/latest/alerting/fundamentals/
- **Alert Rules**: https://grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rules/
- **State and Health**: https://grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rule-evaluation/state-and-health/
- **Notification Templates**: https://grafana.com/docs/grafana/latest/alerting/configure-notifications/template-notifications/

### OpenAlert Current Code
- **Incidents Service**: `C:\Projects\openalert\apps\api\src\modules\incidents\incidents.service.ts`
- **Alerts Controller**: `C:\Projects\openalert\apps\api\src\modules\alerts\alerts.controller.ts`
- **Database Schema**: `C:\Projects\openalert\apps\api\src\database\schema.ts`

---

## Summary of Key Takeaways

### What OpenAlert Should Adopt Immediately

1. **State Machine with Pending/Recovering** (Critical)
   - Prevents flapping alerts
   - Reduces false positives
   - Industry standard pattern

2. **Multi-Dimensional Alert Instances** (High Priority)
   - Essential for modern monitoring
   - Enables per-instance state tracking
   - Better routing and grouping

3. **Template-Based Notifications** (High Priority)
   - User customization without code changes
   - Consistent with enterprise tools
   - Community template sharing

4. **Alert Grouping** (High Priority)
   - Reduces notification fatigue
   - Critical for high-volume environments
   - Improves operator experience

5. **Silence Management** (High Priority)
   - Essential for maintenance windows
   - Expected enterprise feature
   - Prevents alert fatigue

### What OpenAlert Can Skip (For Now)

1. **External Alertmanager** - Complex, limited use case
2. **Recording Rules** - More for metrics visualization
3. **Plugin Architecture** - Over-engineering for MVP
4. **Multi-Org Support** - Can add later if needed

### Architectural Principles to Follow

1. **Separation of Concerns**: Keep scheduling, evaluation, state management, and notification as separate services
2. **Event-Driven**: Use events for state transitions to decouple components
3. **Idempotency**: All operations should be safe to retry
4. **Auditability**: Track all state changes with timestamps and reasons
5. **Performance**: Use jitter, batching, and caching to handle scale

---

**End of Report**
