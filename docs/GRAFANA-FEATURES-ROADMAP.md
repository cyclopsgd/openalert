# Grafana-Inspired Features Implementation Roadmap

**Branch:** `feature/grafana-enhancements`
**Created:** 2026-02-03
**Based on Analysis:** `docs/analysis/Grafana-Backend-Analysis-for-OpenAlert.md`

---

## Overview

This branch will implement selected features from Grafana's NGAlert system to enhance OpenAlert's alerting capabilities. Features are prioritized based on impact, effort, and alignment with OpenAlert's architecture.

---

## Selected Features for Implementation

### Phase 1: Core Alert Enhancements (Weeks 1-3)

#### 1. Multi-Dimensional Alert Instances ⭐⭐⭐⭐⭐
**Priority:** CRITICAL
**Effort:** Medium (2-3 weeks)
**Impact:** High - Transforms alert management

**What It Provides:**
- Track separate alert states for different label combinations
- Single alert rule generates multiple instances
- Better alert deduplication and grouping

**Implementation:**
- Add `alert_instances` table
- Modify alert fingerprinting to include label combinations
- Update AlertsService to manage instances
- Add API endpoints for instance queries

**Database Changes:**
```sql
CREATE TABLE alert_instances (
  id SERIAL PRIMARY KEY,
  alert_id INTEGER REFERENCES alerts(id) ON DELETE CASCADE,
  labels JSONB NOT NULL,
  state VARCHAR(50) NOT NULL, -- normal, pending, alerting, recovering
  state_reason TEXT,
  fired_at TIMESTAMP,
  resolved_at TIMESTAMP,
  last_evaluated_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_alert_instances_alert_id ON alert_instances(alert_id);
CREATE INDEX idx_alert_instances_state ON alert_instances(state);
CREATE INDEX idx_alert_instances_labels ON alert_instances USING GIN(labels);
```

---

#### 2. State Machine with Pending/Recovering States ⭐⭐⭐⭐⭐
**Priority:** CRITICAL
**Effort:** Medium (2-3 weeks)
**Impact:** High - Prevents alert flapping

**What It Provides:**
- Prevent false positives with pending state
- Prevent premature resolution with recovering state
- Configurable "for" duration and "keep firing for" period

**Implementation:**
- Extend `alert_status` enum: `pending`, `recovering`
- Add state transition logic to AlertsService
- Add configuration for grace periods
- Update incident creation to respect pending state

**New Enum:**
```sql
ALTER TYPE alert_status ADD VALUE 'pending';
ALTER TYPE alert_status ADD VALUE 'recovering';
```

**Configuration Fields:**
```typescript
interface AlertRule {
  forDuration: number; // Seconds alert must be firing before alerting
  keepFiringFor: number; // Seconds to keep alert firing after resolution
}
```

---

### Phase 2: Notification Improvements (Weeks 4-6)

#### 3. Go Template-Based Notifications ⭐⭐⭐⭐
**Priority:** HIGH
**Effort:** Medium (2 weeks)
**Impact:** High - Flexible notification formatting

**What It Provides:**
- Customizable notification templates per channel
- Rich template variables (incident, alert, service, user)
- Conditional logic in templates

**Implementation:**
- Add `notification_templates` table
- Integrate Handlebars.js for template rendering
- Create default templates for each channel
- Add template editor API endpoints

**Database Changes:**
```sql
CREATE TABLE notification_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  channel notification_channel NOT NULL,
  team_id INTEGER REFERENCES teams(id),
  subject_template TEXT,
  body_template TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Example Template:**
```handlebars
🚨 Incident #{{incidentNumber}}: {{title}}

Severity: {{severity}}
Service: {{service.name}}
Status: {{status}}

{{#each alerts}}
- {{this.title}} ({{this.severity}})
{{/each}}

View: {{incidentUrl}}
```

---

#### 4. Alert Grouping and Aggregation ⭐⭐⭐⭐
**Priority:** HIGH
**Effort:** Medium (2 weeks)
**Impact:** High - Reduce notification noise

**What It Provides:**
- Group similar alerts before notifying
- Configurable grouping keys (labels, service, severity)
- Batch notifications instead of individual ones

**Implementation:**
- Add grouping configuration to escalation policies
- Modify escalation worker to group alerts
- Add batching logic to notification queue
- Support "group wait" and "group interval" settings

**Configuration:**
```typescript
interface EscalationPolicy {
  groupBy: string[]; // ['service', 'severity']
  groupWait: number; // Seconds to wait before sending first notification
  groupInterval: number; // Seconds to wait before sending subsequent batches
}
```

---

#### 5. Silence Management ⭐⭐⭐⭐
**Priority:** HIGH
**Effort:** Low (1 week)
**Impact:** Medium - Essential for maintenance windows

**What It Provides:**
- Temporarily suppress alerts matching criteria
- Label-based matchers (service, severity, etc.)
- Time-based activation and expiry
- Comment/reason tracking

**Implementation:**
- Add `silences` table
- Add silence matching logic to AlertsService
- Add silence management API endpoints
- Integrate with notification worker to check silences

**Database Changes:**
```sql
CREATE TABLE silences (
  id SERIAL PRIMARY KEY,
  team_id INTEGER REFERENCES teams(id) NOT NULL,
  matchers JSONB NOT NULL, -- [{key: 'service', value: 'api', operator: '='}]
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP NOT NULL,
  created_by INTEGER REFERENCES users(id),
  comment TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_silences_team_id ON silences(team_id);
CREATE INDEX idx_silences_active ON silences(is_active);
```

---

### Phase 3: Advanced Features (Weeks 7-10)

#### 6. Jittered Evaluation Scheduler ⭐⭐⭐
**Priority:** MEDIUM
**Effort:** Medium (2 weeks)
**Impact:** Medium - Prevent thundering herd

**What It Provides:**
- Distribute alert evaluation across time
- Prevent all alerts evaluating simultaneously
- Better resource utilization

**Implementation:**
- Create evaluation scheduler service
- Add jitter calculation logic
- Schedule alert re-evaluation with BullMQ
- Add evaluation metrics

**Note:** Currently OpenAlert is webhook-driven (push), not evaluation-driven (pull). This feature is more relevant if we add scheduled alert rules.

---

#### 7. Provisioning API (Config-as-Code) ⭐⭐⭐
**Priority:** MEDIUM
**Effort:** High (3 weeks)
**Impact:** Medium - GitOps support

**What It Provides:**
- Define escalation policies, schedules, services in YAML
- Version control for alert configuration
- Provenance tracking (config source)
- Declarative API for bulk configuration

**Implementation:**
- Add provisioning endpoints (POST /api/provisioning/*)
- Add YAML parser and validator
- Add provenance field to tables
- Support idempotent updates (upsert by name)

**Example YAML:**
```yaml
apiVersion: v1
kind: EscalationPolicy
metadata:
  name: critical-alerts-policy
  team: platform
spec:
  levels:
    - level: 1
      delay: 0
      targets:
        - type: schedule
          name: platform-oncall
    - level: 2
      delay: 15
      targets:
        - type: user
          email: manager@company.com
```

---

#### 8. Historical State Tracking ⭐⭐⭐
**Priority:** MEDIUM
**Effort:** Low (1 week)
**Impact:** Medium - Complete audit trail

**What It Provides:**
- Track every alert state transition
- Query historical states for analysis
- Support incident post-mortems

**Implementation:**
- Add `alert_state_history` table
- Log state transitions in AlertsService
- Add API endpoints for history queries
- Add visualization support

**Database Changes:**
```sql
CREATE TABLE alert_state_history (
  id SERIAL PRIMARY KEY,
  alert_id INTEGER REFERENCES alerts(id) ON DELETE CASCADE,
  previous_state VARCHAR(50),
  new_state VARCHAR(50) NOT NULL,
  state_reason TEXT,
  changed_by INTEGER REFERENCES users(id),
  changed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_alert_state_history_alert_id ON alert_state_history(alert_id);
CREATE INDEX idx_alert_state_history_changed_at ON alert_state_history(changed_at);
```

---

### Phase 4: Enterprise Features (Future)

#### 9. Mute Timings ⭐⭐
**Priority:** LOW
**Effort:** Medium (2 weeks)
**Impact:** Low - Recurring suppression

**What It Provides:**
- Define recurring time windows for alert suppression
- Useful for known maintenance windows
- Cron-like scheduling

**Future Implementation:** Consider after Phase 3 completion.

---

#### 10. External Alertmanager Support ⭐
**Priority:** LOW
**Effort:** High (4 weeks)
**Impact:** Low - Enterprise HA feature

**What It Provides:**
- Forward alerts to external Prometheus Alertmanager
- High availability alert management
- Leverage Alertmanager's routing, grouping, silencing

**Future Implementation:** Consider for enterprise customers.

---

## Implementation Strategy

### Development Approach

1. **Feature Branches:** Each feature gets its own branch off `feature/grafana-enhancements`
2. **Incremental Merges:** Merge completed features back to `feature/grafana-enhancements`
3. **Testing:** Each feature must have 80%+ test coverage
4. **Documentation:** Update API docs and user guides for each feature

### Testing Requirements

Each feature must include:
- Unit tests for services (80%+ coverage)
- Integration tests for API endpoints
- E2E tests for critical workflows
- Database migration tests

### Review Checkpoints

- **After Phase 1:** Review with team, demo multi-dimensional alerts
- **After Phase 2:** Review notification improvements, test templates
- **After Phase 3:** Review advanced features, performance testing
- **Final Review:** Full regression testing before merge to main

---

## Database Migration Strategy

**Approach:** Additive migrations only (no breaking changes)

1. **Backward Compatible:** New tables and columns don't affect existing code
2. **Feature Flags:** Enable features gradually via configuration
3. **Data Migration:** Backfill historical data where needed
4. **Rollback Plan:** All migrations reversible

---

## API Design Principles

1. **RESTful:** Follow existing OpenAlert API patterns
2. **Versioned:** Use `/api/v1/` namespace
3. **Consistent:** Match existing response formats
4. **Documented:** OpenAPI/Swagger annotations for all endpoints

---

## Success Metrics

### Phase 1 Success Criteria
- [ ] Multi-dimensional alerts working with different label combinations
- [ ] State machine prevents alert flapping (metrics show reduction)
- [ ] 80%+ test coverage for new features
- [ ] No regressions in existing functionality

### Phase 2 Success Criteria
- [ ] Template-based notifications sending successfully
- [ ] Alert grouping reduces notification count by 50%+
- [ ] Silences prevent notifications during maintenance
- [ ] 80%+ test coverage maintained

### Phase 3 Success Criteria
- [ ] Provisioning API supports YAML import/export
- [ ] Historical state tracking provides audit trail
- [ ] All features documented
- [ ] Performance benchmarks met

---

## Risk Mitigation

### Risks & Mitigation

1. **Risk:** Breaking existing alert flows
   **Mitigation:** Comprehensive integration tests, feature flags

2. **Risk:** Performance degradation with additional tables
   **Mitigation:** Proper indexing, query optimization, load testing

3. **Risk:** Increased complexity
   **Mitigation:** Clear documentation, code reviews, gradual rollout

4. **Risk:** Database migration failures
   **Mitigation:** Test migrations on staging, rollback procedures

---

## Timeline

| Phase | Duration | Key Milestones |
|-------|----------|----------------|
| Phase 1 | Weeks 1-3 | Multi-dimensional alerts, state machine |
| Phase 2 | Weeks 4-6 | Templates, grouping, silences |
| Phase 3 | Weeks 7-10 | Provisioning, history tracking |
| Review & Polish | Week 11 | Testing, documentation, merge prep |
| **Total** | **11 weeks** | **Ready to merge to main** |

---

## Getting Started

### Setup Development Environment

```bash
# Ensure you're on the feature branch
git checkout feature/grafana-enhancements

# Install dependencies
npm install

# Start Docker services
docker-compose -f docker/docker-compose.yml up -d

# Generate and apply new migrations (as features are added)
npm run db:generate
npm run db:migrate

# Run tests
npm test
```

### Development Workflow

```bash
# Create feature branch
git checkout -b feature/multi-dimensional-alerts

# Develop feature with tests
# ...

# Merge back to grafana-enhancements
git checkout feature/grafana-enhancements
git merge feature/multi-dimensional-alerts

# Continue with next feature
```

---

## Related Documentation

- **Grafana Analysis:** `docs/analysis/Grafana-Backend-Analysis-for-OpenAlert.md`
- **Backend Assessment:** `docs/COMPREHENSIVE-BACKEND-ASSESSMENT.md`
- **API Reference:** `docs/BACKEND-API.md`
- **Database Schema:** `apps/api/src/database/schema.ts`

---

**Branch Status:** Created, ready for development
**Next Steps:** Begin Phase 1 - Multi-dimensional alerts implementation
**Review Date:** After Phase 1 completion (~3 weeks)
