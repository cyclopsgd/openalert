# Task #81: Alert Routing and Status Pages - Usage Examples

## Alert Routing Engine Usage

### Basic Routing Rule Creation

```typescript
// Create a rule to route critical production alerts
const criticalProductionRule = {
  name: 'Critical Production Alerts',
  priority: 100,
  enabled: true,
  teamId: 1,
  conditions: {
    severity: ['critical'],
    labels: {
      env: 'production'
    }
  },
  actions: {
    routeToServiceId: 5,
    escalationPolicyId: 1,
    addTags: ['urgent', 'production']
  }
};

const rule = await alertRoutingService.create(criticalProductionRule);
```

### Pattern-Based Routing

```typescript
// Route database alerts using title matching
const dbAlertRule = {
  name: 'Database Alerts',
  priority: 90,
  enabled: true,
  teamId: 1,
  conditions: {
    titleContains: 'database',
    source: 'prometheus'
  },
  actions: {
    routeToServiceId: 10,
    setSeverity: 'high'
  }
};

// Route using regex in description
const timeoutRule = {
  name: 'Timeout Errors',
  priority: 80,
  enabled: true,
  teamId: 1,
  conditions: {
    descriptionMatches: 'timeout.*connection'
  },
  actions: {
    routeToServiceId: 15
  }
};
```

### Evaluate Alert Against Rules

```typescript
const alert = {
  id: 1,
  severity: 'critical',
  title: 'Production Database Connection Lost',
  source: 'prometheus',
  labels: {
    env: 'production',
    service: 'database'
  },
  // ... other fields
};

const result = await alertRoutingService.evaluateRules(alert, teamId);

if (result.matched) {
  console.log('Matched rules:', result.matchedRules);
  console.log('Actions to take:', result.actions);

  // Apply actions
  for (const action of result.actions) {
    if (action.routeToServiceId) {
      // Route to service
    }
    if (action.escalationPolicyId) {
      // Start escalation
    }
    if (action.suppress) {
      // Suppress alert
    }
  }
}
```

### Test Rule Before Creating

```typescript
// Test a rule against sample alert
const testResult = alertRoutingService.testRule(
  {
    severity: ['critical'],
    labels: { env: 'production' }
  },
  {
    severity: 'critical',
    labels: { env: 'production' },
    title: 'Test Alert'
  }
);

console.log(testResult.matches); // true or false
console.log(testResult.reason); // Explanation
```

### Priority Management

```typescript
// Higher priority rules are evaluated first
const rules = [
  { priority: 100, name: 'Critical Production' },
  { priority: 90, name: 'High Alerts' },
  { priority: 80, name: 'Medium Alerts' },
  { priority: 0, name: 'Default Catch-All' }
];

// Update priority
await alertRoutingService.updatePriority(ruleId, 150);
```

### View Match History

```typescript
// See which alerts matched this rule
const matches = await alertRoutingService.getMatchesByRule(ruleId, 50);

matches.forEach(match => {
  console.log(`Alert ${match.alertId} matched at ${match.matchedAt}`);
  console.log(`Alert details:`, match.alert);
});
```

### Suppression Example

```typescript
// Suppress test/development alerts
const suppressRule = {
  name: 'Suppress Test Alerts',
  priority: 150, // High priority to catch early
  enabled: true,
  teamId: 1,
  conditions: {
    labels: { type: 'test' }
  },
  actions: {
    suppress: true
  }
};
```

---

## Status Pages Usage

### Create Status Page

```typescript
const statusPage = await statusPagesService.create({
  name: 'API Status',
  slug: 'api-status',
  teamId: 1,
  description: 'Monitor the health of our API services',
  isPublic: true,
  themeColor: '#6366f1',
  logoUrl: 'https://example.com/logo.png'
});
```

### Add Components

```typescript
// Add components in order
const apiComponent = await componentsService.create({
  statusPageId: statusPage.id,
  name: 'API Server',
  description: 'Main API endpoint',
  status: 'operational'
});

const dbComponent = await componentsService.create({
  statusPageId: statusPage.id,
  name: 'Database',
  description: 'PostgreSQL database',
  status: 'operational'
});

const cacheComponent = await componentsService.create({
  statusPageId: statusPage.id,
  name: 'Redis Cache',
  status: 'operational'
});
```

### Update Component Status

```typescript
// When an issue is detected
await componentsService.updateStatus(apiComponent.id, 'degraded_performance');

// When fixed
await componentsService.updateStatus(apiComponent.id, 'operational');
```

### Reorder Components

```typescript
// Change display order
await componentsService.reorder(statusPage.id, [
  dbComponent.id,      // Show first
  apiComponent.id,     // Show second
  cacheComponent.id    // Show third
]);
```

### Create and Manage Incident

```typescript
// Create incident
const incident = await incidentsService.createIncident({
  statusPageId: statusPage.id,
  title: 'API Response Time Degraded',
  status: 'investigating',
  impact: 'minor',
  componentIds: [apiComponent.id]
});

// Post update
await incidentsService.postUpdate({
  incidentId: incident.id,
  status: 'identified',
  message: 'We have identified a database query issue causing slow responses.'
});

// Another update
await incidentsService.postUpdate({
  incidentId: incident.id,
  status: 'monitoring',
  message: 'Fix has been deployed. Monitoring for stability.'
});

// Resolve incident
await incidentsService.resolveIncident(
  incident.id,
  'All systems are now operating normally. Response times have returned to baseline.'
);
```

### Get Overall Status

```typescript
const overallStatus = await statusPagesService.getOverallStatus(statusPage.id);

// Returns one of:
// - 'operational'
// - 'degraded_performance'
// - 'partial_outage'
// - 'major_outage'
// - 'under_maintenance'

console.log(`Current status: ${overallStatus}`);
```

### Public Status Page Access

```typescript
// Public endpoint - no authentication required
const publicPage = await statusPagesService.findBySlug('api-status');

if (publicPage && publicPage.isPublic) {
  console.log('Status Page:', publicPage.name);
  console.log('Components:', publicPage.components);
  console.log('Recent Incidents:', publicPage.incidents);
}
```

### List Incidents

```typescript
// Get only active incidents
const activeIncidents = await incidentsService.findByStatusPage(
  statusPage.id,
  { includeResolved: false }
);

// Get all incidents including resolved
const allIncidents = await incidentsService.findByStatusPage(
  statusPage.id,
  { includeResolved: true, limit: 100 }
);
```

---

## Real-World Scenarios

### Scenario 1: Database Outage

```typescript
// 1. Alert is received
const alert = {
  severity: 'critical',
  title: 'Database connection pool exhausted',
  source: 'prometheus',
  labels: { env: 'production', service: 'database' }
};

// 2. Route to on-call engineer
const routing = await alertRoutingService.evaluateRules(alert, teamId);

// 3. Update status page component
await componentsService.updateStatus(dbComponentId, 'major_outage');

// 4. Create incident
const incident = await incidentsService.createIncident({
  statusPageId: statusPageId,
  title: 'Database Connectivity Issues',
  status: 'investigating',
  impact: 'major',
  componentIds: [dbComponentId]
});

// 5. Post updates as you investigate
await incidentsService.postUpdate({
  incidentId: incident.id,
  status: 'identified',
  message: 'Connection pool misconfiguration identified.'
});

// 6. Deploy fix and monitor
await incidentsService.postUpdate({
  incidentId: incident.id,
  status: 'monitoring',
  message: 'Fix deployed. Connection pool size increased.'
});

// 7. Resolve
await componentsService.updateStatus(dbComponentId, 'operational');
await incidentsService.resolveIncident(
  incident.id,
  'Database connectivity fully restored.'
);
```

### Scenario 2: Planned Maintenance

```typescript
// 1. Update component status
await componentsService.updateStatus(apiComponentId, 'under_maintenance');

// 2. Create scheduled maintenance incident
const maintenance = await incidentsService.createIncident({
  statusPageId: statusPageId,
  title: 'Scheduled Database Maintenance',
  status: 'monitoring',
  impact: 'minor',
  componentIds: [dbComponentId],
  scheduledFor: new Date('2026-02-10T02:00:00Z'),
  scheduledUntil: new Date('2026-02-10T04:00:00Z')
});

// 3. During maintenance, post updates
await incidentsService.postUpdate({
  incidentId: maintenance.id,
  status: 'monitoring',
  message: 'Maintenance in progress. Database read replicas available.'
});

// 4. Complete maintenance
await componentsService.updateStatus(dbComponentId, 'operational');
await incidentsService.resolveIncident(
  maintenance.id,
  'Maintenance completed successfully.'
);
```

### Scenario 3: Cascading Failure

```typescript
// Alert routing catches multiple related alerts
const alerts = [
  { title: 'API high error rate', service: 'api' },
  { title: 'Database slow queries', service: 'database' },
  { title: 'Cache eviction rate high', service: 'cache' }
];

// All route to same team due to label matching
for (const alert of alerts) {
  const routing = await alertRoutingService.evaluateRules(alert, teamId);
  // routing.actions[0].routeToServiceId === 5 (DevOps team)
}

// Update multiple components
await componentsService.updateStatus(apiComponentId, 'degraded_performance');
await componentsService.updateStatus(dbComponentId, 'degraded_performance');
await componentsService.updateStatus(cacheComponentId, 'degraded_performance');

// Single incident tracking the cascading issue
const incident = await incidentsService.createIncident({
  statusPageId: statusPageId,
  title: 'Performance Degradation Across Services',
  status: 'investigating',
  impact: 'major',
  componentIds: [apiComponentId, dbComponentId, cacheComponentId]
});
```

---

## Best Practices

### Alert Routing

1. **Use Priority Wisely**
   - Critical production rules: 100+
   - Service-specific rules: 50-99
   - Default catch-all: 0

2. **Label Conventions**
   ```typescript
   labels: {
     env: 'production' | 'staging' | 'development',
     service: 'api' | 'database' | 'cache',
     severity: 'critical' | 'high' | 'medium' | 'low',
     team: 'backend' | 'frontend' | 'devops'
   }
   ```

3. **Test Before Enabling**
   ```typescript
   const test = alertRoutingService.testRule(conditions, sampleAlert);
   if (test.matches) {
     // Enable the rule
     rule.enabled = true;
   }
   ```

### Status Pages

1. **Component Naming**
   - Use clear, customer-facing names
   - Group related services
   - Order by importance

2. **Incident Communication**
   - Post regular updates (every 30-60 minutes during active incidents)
   - Be transparent about impact
   - Include ETAs when possible
   - Post resolution confirmation

3. **Status Colors**
   - Operational: Green (#22c55e)
   - Degraded: Yellow (#eab308)
   - Partial Outage: Orange (#f97316)
   - Major Outage: Red (#ef4444)
   - Maintenance: Blue (#3b82f6)

---

## Testing Your Implementation

```typescript
// Test routing logic
describe('Custom Routing Rules', () => {
  it('should route production database alerts correctly', async () => {
    const alert = createProductionDatabaseAlert();
    const result = await alertRoutingService.evaluateRules(alert, teamId);

    expect(result.matched).toBe(true);
    expect(result.actions[0].routeToServiceId).toBe(expectedServiceId);
  });
});

// Test status page updates
describe('Incident Management', () => {
  it('should update overall status when component fails', async () => {
    await componentsService.updateStatus(componentId, 'major_outage');
    const status = await statusPagesService.getOverallStatus(pageId);

    expect(status).toBe('major_outage');
  });
});
```

---

## Monitoring and Metrics

```typescript
// Track routing effectiveness
const matches = await alertRoutingService.getMatchesByRule(ruleId, 1000);
console.log(`Rule matched ${matches.length} alerts in last period`);

// Monitor incident resolution time
const incidents = await incidentsService.findByStatusPage(pageId, {
  includeResolved: true
});

incidents.forEach(incident => {
  if (incident.resolvedAt) {
    const duration = incident.resolvedAt - incident.createdAt;
    console.log(`Incident resolved in ${duration}ms`);
  }
});
```

---

## API Endpoints

### Alert Routing
- `POST /alert-routing/rules` - Create routing rule
- `GET /alert-routing/rules/team/:teamId` - List team's rules
- `GET /alert-routing/rules/:id` - Get rule details
- `PUT /alert-routing/rules/:id` - Update rule
- `DELETE /alert-routing/rules/:id` - Delete rule
- `PUT /alert-routing/rules/:id/priority` - Update priority
- `POST /alert-routing/rules/test` - Test rule
- `GET /alert-routing/rules/:id/matches` - Get match history

### Status Pages (Authenticated)
- `POST /status-pages` - Create status page
- `GET /status-pages/:id` - Get status page
- `GET /status-pages/team/:teamId` - List team's pages
- `PATCH /status-pages/:id` - Update status page
- `DELETE /status-pages/:id` - Delete status page
- `GET /status-pages/:id/status` - Get overall status

### Status Pages (Public)
- `GET /public/status/:slug` - View public status page
- `GET /public/status/:slug/components` - List components
- `GET /public/status/:slug/incidents` - List incidents
- `GET /public/status/:slug/incidents/:id` - Get incident details

### Components
- `POST /status-pages/:id/components` - Create component
- `GET /status-pages/components/:id` - Get component
- `PATCH /status-pages/components/:id` - Update component
- `DELETE /status-pages/components/:id` - Delete component
- `POST /status-pages/:id/components/reorder` - Reorder components

### Incidents
- `POST /status-pages/:id/incidents` - Create incident
- `GET /status-pages/incidents/:id` - Get incident
- `PATCH /status-pages/incidents/:id` - Update incident
- `DELETE /status-pages/incidents/:id` - Delete incident
- `POST /status-pages/incidents/:id/updates` - Post update
- `POST /status-pages/incidents/:id/resolve` - Resolve incident

---

## Troubleshooting

### Alert Not Routing

1. Check rule is enabled: `rule.enabled === true`
2. Verify conditions match exactly
3. Check priority order (higher priority rules evaluated first)
4. Test rule: `alertRoutingService.testRule(conditions, alert)`

### Status Page Not Showing

1. Verify slug is correct
2. Check `isPublic === true` for public access
3. Confirm components are added
4. Check cache (may need to wait for TTL)

### Incident Not Updating

1. Verify incident exists and is not resolved
2. Check permissions (team membership)
3. Ensure status is valid enum value
4. Check event emissions in logs
