# Performance Optimization Implementation Guide

## Overview

This guide provides step-by-step instructions to implement the performance optimizations identified in the comprehensive audit (Task #41).

**Related Documents:**
- `docs/PERFORMANCE_OPTIMIZATION_REPORT.md` - Full analysis and findings
- `apps/api/migrations/0001_performance_indexes.sql` - Database index migration
- `apps/web/src/App.optimized.tsx` - Code-split App component
- `apps/web/vite.config.optimized.ts` - Optimized build configuration
- `apps/api/src/modules/cache/cache-warmer.service.ts` - Cache warming implementation

---

## Phase 1: Database Optimizations (HIGH PRIORITY)

### Step 1: Apply Performance Indexes

**Estimated Time:** 5 minutes
**Impact:** 30-50% query time reduction

```bash
# Connect to PostgreSQL
psql -U postgres -d openalert

# Apply the migration
\i apps/api/migrations/0001_performance_indexes.sql

# Verify indexes were created
\di incidents*
\di alerts*
\di services*
\di alert_routing_rules*
\di schedule_overrides*
```

**Expected Indexes:**
- `incidents_status_severity_idx` - Composite for common filters
- `incidents_acknowledged_by_idx` - User lookup optimization
- `incidents_resolved_by_idx` - User lookup optimization
- `alert_routing_rules_team_enabled_priority_idx` - Rule evaluation
- `schedule_overrides_schedule_time_idx` - Time range queries
- `alerts_fingerprint_status_idx` - Deduplication optimization
- `incidents_assignee_status_idx` - Assignment queries
- `services_team_status_idx` - Service listing

**Validation:**
```sql
-- Check index usage after a few hours
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE indexname LIKE '%_idx'
ORDER BY idx_scan DESC;

-- Look for indexes with idx_scan = 0 after 24 hours (candidates for removal)
```

### Step 2: Fix N+1 Query in Incident Detail

**Estimated Time:** 15 minutes
**Impact:** 2 fewer queries per incident detail page load

**File:** `apps/api/src/modules/incidents/incidents.service.ts`

**Replace lines 273-327 with:**

```typescript
/**
 * Get incident by ID with full related data
 */
async findById(id: number): Promise<any> {
  const incident = await this.db.query.incidents.findFirst({
    where: eq(incidents.id, id),
    with: {
      service: true,
      alerts: {
        orderBy: (alerts, { desc }) => [desc(alerts.firedAt)],
      },
      timeline: {
        orderBy: (timeline, { desc }) => [desc(timeline.createdAt)],
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      // NEW: Load acknowledged and resolved users via relations
      acknowledgedBy: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
      resolvedBy: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!incident) {
    return undefined;
  }

  return incident;
}
```

**Add relations to schema (if not already present):**

**File:** `apps/api/src/database/schema.ts` (around line 560)

```typescript
export const incidentsRelations = relations(incidents, ({ one, many }) => ({
  service: one(services, { fields: [incidents.serviceId], references: [services.id] }),
  assignee: one(users, {
    fields: [incidents.assigneeId],
    references: [users.id],
    relationName: 'assignee',
  }),
  acknowledgedBy: one(users, {
    fields: [incidents.acknowledgedById],
    references: [users.id],
    relationName: 'acknowledgedBy',
  }),
  resolvedBy: one(users, {
    fields: [incidents.resolvedById],
    references: [users.id],
    relationName: 'resolvedBy',
  }),
  alerts: many(alerts),
  timeline: many(incidentTimeline),
  notifications: many(notificationLogs),
}));
```

**Test the changes:**
```bash
npm test -- incidents.service.spec.ts
```

---

## Phase 2: Cache Optimizations (HIGH PRIORITY)

### Step 3: Implement Cache Warming

**Estimated Time:** 20 minutes
**Impact:** Eliminates cold cache latency for dashboard

**1. Add ScheduleModule to app dependencies:**

**File:** `apps/api/package.json`

```json
{
  "dependencies": {
    "@nestjs/schedule": "^4.0.0"
  }
}
```

```bash
npm install
```

**2. Import ScheduleModule in app module:**

**File:** `apps/api/src/app.module.ts`

```typescript
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(), // ADD THIS
    DatabaseModule,
    CacheModule,
    // ... other modules
  ],
})
export class AppModule {}
```

**3. Update CacheModule to export CacheWarmerService:**

**File:** `apps/api/src/modules/cache/cache.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheWarmerService } from './cache-warmer.service';
import { MetricsModule } from '../metrics/metrics.module';
import { ServicesModule } from '../services/services.module';

@Module({
  imports: [MetricsModule, ServicesModule],
  providers: [CacheService, CacheWarmerService],
  exports: [CacheService, CacheWarmerService],
})
export class CacheModule {}
```

**4. Copy the cache warmer service:**

The file `apps/api/src/modules/cache/cache-warmer.service.ts` has already been created.

**5. Test cache warming:**

```bash
# Start the application
npm run start:dev

# Watch logs for cache warming
# You should see:
# [CacheWarmerService] Warming all critical caches...
# [CacheWarmerService] Warming dashboard metrics cache
# [CacheWarmerService] Dashboard metrics cache warmed successfully
```

**6. Verify cache is being used:**

```bash
# Connect to Redis
redis-cli

# Monitor cache operations
MONITOR

# Or check keys
KEYS openalert:metrics:*
KEYS openalert:services:*
```

### Step 4: Cache Alert Routing Rules

**Estimated Time:** 15 minutes
**Impact:** Reduces database queries on every alert ingestion

**File:** `apps/api/src/modules/alert-routing/alert-routing.service.ts`

**Add method to get enabled rules with caching:**

```typescript
/**
 * Get enabled routing rules for a team with caching
 */
private async getEnabledRules(teamId: number): Promise<AlertRoutingRule[]> {
  // Try cache first
  const cacheKey = this.cacheService.buildKey(
    CACHE_PREFIX.ROUTING,
    'rules',
    teamId.toString(),
  );
  const cached = await this.cacheService.get<AlertRoutingRule[]>(cacheKey);

  if (cached) {
    this.logger.debug(`Cache hit for routing rules (team ${teamId})`);
    return cached;
  }

  // Fetch from database
  const rules = await this.db.db.query.alertRoutingRules.findMany({
    where: and(
      eq(alertRoutingRules.teamId, teamId),
      eq(alertRoutingRules.enabled, true),
    ),
    orderBy: [desc(alertRoutingRules.priority)],
  });

  // Cache for 2 minutes
  await this.cacheService.set(cacheKey, rules, CACHE_TTL.ALERT_ROUTING_RULES);

  return rules;
}
```

**Update the evaluateRules method to use cached rules:**

```typescript
async evaluateRules(alert: Alert, teamId: number): Promise<EvaluationResult> {
  this.logger.debug(`Evaluating routing rules for alert ${alert.id}`);

  // Get cached enabled rules
  const rules = await this.getEnabledRules(teamId);

  // Rest of the evaluation logic...
}
```

---

## Phase 3: Frontend Optimizations (HIGH PRIORITY)

### Step 5: Implement Route-Based Code Splitting

**Estimated Time:** 10 minutes
**Impact:** 65% reduction in initial bundle size

**1. Replace App.tsx with optimized version:**

```bash
# Backup current App.tsx
cp apps/web/src/App.tsx apps/web/src/App.tsx.backup

# Use the optimized version
cp apps/web/src/App.optimized.tsx apps/web/src/App.tsx
```

**2. Update vite.config.ts with optimized build settings:**

```bash
# Backup current config
cp apps/web/vite.config.ts apps/web/vite.config.ts.backup

# Use optimized config
cp apps/web/vite.config.optimized.ts apps/web/vite.config.ts
```

**3. Install missing dependencies:**

```bash
cd apps/web
npm install --save-dev rollup-plugin-visualizer
```

**4. Build and analyze bundle:**

```bash
cd apps/web
npm run build

# Check output
ls -lh dist/assets/js/

# You should see multiple chunks:
# - react-vendor-[hash].js (~150KB)
# - query-vendor-[hash].js (~50KB)
# - chart-vendor-[hash].js (~180KB)
# - socket-vendor-[hash].js (~60KB)
# - ui-vendor-[hash].js (~75KB)
# - [route]-[hash].js (various sizes)
```

**5. Visualize bundle composition:**

Open `dist/bundle-analysis.html` in your browser to see the visual breakdown.

### Step 6: Optimize React Component Rendering

**Estimated Time:** 20 minutes
**Impact:** 20-30% render time reduction

**1. Replace Dashboard component:**

```bash
cp apps/web/src/pages/Dashboard.tsx apps/web/src/pages/Dashboard.tsx.backup
cp apps/web/src/pages/Dashboard.optimized.tsx apps/web/src/pages/Dashboard.tsx
```

**2. Replace useRealtime hook:**

```bash
cp apps/web/src/hooks/useRealtime.ts apps/web/src/hooks/useRealtime.ts.backup
cp apps/web/src/hooks/useRealtime.optimized.ts apps/web/src/hooks/useRealtime.ts
```

**3. Memoize chart components:**

**File:** `apps/web/src/components/dashboard/IncidentTrendsChart.tsx`

```typescript
import { memo } from 'react'

// At the end of file, wrap export:
export default memo(IncidentTrendsChart)
```

**Apply same pattern to:**
- `StatusDistributionChart.tsx`
- `ResponseTimeChart.tsx`
- `MetricsBar.tsx`
- `RecentIncidentsTable.tsx`

**4. Test the application:**

```bash
cd apps/web
npm run dev

# Open http://localhost:5173
# Test navigation between routes
# Verify lazy loading in Network tab (should see separate chunk requests)
```

---

## Phase 4: Testing & Validation

### Step 7: Run Tests

```bash
# Backend tests
cd apps/api
npm test

# Fix failing tests before proceeding
# - oncall-resolver.service.spec.ts
# - team-member.guard.spec.ts

# Frontend tests
cd apps/web
npm test
```

### Step 8: Performance Testing

**Backend Load Testing:**

```bash
# Start the application
npm run start:dev

# Run cache test script
bash scripts/test-cache.sh

# Expected results:
# - Cache hit rate: >80%
# - Cached response time: <50ms
# - Uncached response time: <500ms
```

**Frontend Performance:**

```bash
# Build production bundle
cd apps/web
npm run build

# Serve production build
npm run preview

# Run Lighthouse audit
npx lighthouse http://localhost:4173 --view

# Target metrics:
# - Performance score: >90
# - First Contentful Paint: <1.5s
# - Largest Contentful Paint: <2.5s
# - Time to Interactive: <3.5s
# - Total Blocking Time: <200ms
```

### Step 9: Monitor Performance in Production

**Database Query Performance:**

```sql
-- Enable query statistics (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- View slow queries after 24 hours
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

**Cache Performance:**

```bash
# Redis stats
redis-cli INFO stats

# Look for:
# - keyspace_hits
# - keyspace_misses
# - hit_rate = hits / (hits + misses)

# Monitor cache keys
redis-cli --scan --pattern "openalert:*" | wc -l

# Monitor memory usage
redis-cli INFO memory
```

**Application Performance:**

```bash
# Monitor API response times
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/api/metrics/dashboard

# curl-format.txt contents:
# time_namelookup:  %{time_namelookup}
# time_connect:  %{time_connect}
# time_appconnect:  %{time_appconnect}
# time_pretransfer:  %{time_pretransfer}
# time_redirect:  %{time_redirect}
# time_starttransfer:  %{time_starttransfer}
# time_total:  %{time_total}
```

---

## Phase 5: Additional Optimizations (Medium Priority)

### Step 10: Implement True Bulk Operations

**File:** `apps/api/src/modules/incidents/incidents.service.ts`

**Replace bulkAcknowledge method:**

```typescript
async bulkAcknowledge(
  incidentIds: number[],
  userId: number,
): Promise<{ success: number; failed: number }> {
  try {
    // Update all incidents in a single transaction
    const updated = await this.db.db
      .update(incidents)
      .set({
        status: 'acknowledged',
        acknowledgedAt: new Date(),
        acknowledgedById: userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          inArray(incidents.id, incidentIds),
          eq(incidents.status, 'triggered'),
        ),
      )
      .returning();

    // Add timeline entries in bulk
    if (updated.length > 0) {
      await this.db.db.insert(incidentTimeline).values(
        updated.map((incident) => ({
          incidentId: incident.id,
          eventType: 'acknowledged' as const,
          userId: userId,
          description: 'Incident acknowledged',
          createdAt: new Date(),
        })),
      );

      // Cancel escalations for all updated incidents
      await Promise.all(
        updated.map((incident) =>
          this.escalationQueue.cancelEscalation(incident.id),
        ),
      );
    }

    // Invalidate caches
    await this.invalidateIncidentsCache();
    await this.cacheService.delPattern(`${CACHE_PREFIX.METRICS}:*`);

    this.logger.log(
      `Bulk acknowledged ${updated.length} of ${incidentIds.length} incidents`,
    );

    return {
      success: updated.length,
      failed: incidentIds.length - updated.length,
    };
  } catch (error) {
    this.logger.error('Bulk acknowledge failed:', error);
    return { success: 0, failed: incidentIds.length };
  }
}
```

**Apply same pattern to `bulkResolve` method.**

### Step 11: Optimize Services List Query

**File:** `apps/api/src/modules/services/services.service.ts`

**Replace findAll method with single query approach:**

```typescript
async findAll(teamId?: number) {
  const cacheKey = this.cacheService.buildKey(CACHE_PREFIX.SERVICES, 'list', teamId || 'all');
  const cached = await this.cacheService.get<any[]>(cacheKey);
  if (cached) {
    return cached;
  }

  // Use single query with LEFT JOINs and aggregations
  const result = await this.db.db.execute<{
    id: number;
    name: string;
    slug: string;
    description: string;
    teamId: number;
    escalationPolicyId: number;
    status: string;
    createdAt: string;
    updatedAt: string;
    activeIncidentCount: string;
    dependencyCount: string;
  }>(sql`
    SELECT
      s.*,
      COALESCE(i.active_count, 0)::int as "activeIncidentCount",
      COALESCE(d.dep_count, 0)::int as "dependencyCount"
    FROM services s
    LEFT JOIN (
      SELECT service_id, COUNT(*)::int as active_count
      FROM incidents
      WHERE status IN ('triggered', 'acknowledged')
      GROUP BY service_id
    ) i ON s.id = i.service_id
    LEFT JOIN (
      SELECT service_id, COUNT(*)::int as dep_count
      FROM service_dependencies
      GROUP BY service_id
    ) d ON s.id = d.service_id
    ${teamId ? sql`WHERE s.team_id = ${teamId}` : sql``}
    ORDER BY s.name
  `);

  const services = result.rows.map((row) => ({
    ...row,
    activeIncidentCount: Number(row.activeIncidentCount),
    dependencyCount: Number(row.dependencyCount),
  }));

  await this.cacheService.set(cacheKey, services, CACHE_TTL.SERVICES_LIST);

  return services;
}
```

---

## Rollback Plan

If any optimization causes issues, follow these steps:

### Rollback Database Indexes

```sql
-- Remove performance indexes
DROP INDEX IF EXISTS incidents_status_severity_idx;
DROP INDEX IF EXISTS incidents_acknowledged_by_idx;
DROP INDEX IF EXISTS incidents_resolved_by_idx;
DROP INDEX IF EXISTS alert_routing_rules_team_enabled_priority_idx;
DROP INDEX IF EXISTS schedule_overrides_schedule_time_idx;
DROP INDEX IF EXISTS alerts_fingerprint_status_idx;
DROP INDEX IF EXISTS incidents_assignee_status_idx;
DROP INDEX IF EXISTS services_team_status_idx;
```

### Rollback Frontend Changes

```bash
cd apps/web

# Restore original files
cp src/App.tsx.backup src/App.tsx
cp vite.config.ts.backup vite.config.ts
cp src/pages/Dashboard.tsx.backup src/pages/Dashboard.tsx
cp src/hooks/useRealtime.ts.backup src/hooks/useRealtime.ts

# Rebuild
npm run build
```

### Rollback Backend Changes

```bash
cd apps/api

# Revert changes via git
git checkout HEAD -- src/modules/incidents/incidents.service.ts
git checkout HEAD -- src/modules/alert-routing/alert-routing.service.ts
git checkout HEAD -- src/modules/services/services.service.ts

# Remove cache warmer
rm src/modules/cache/cache-warmer.service.ts

# Restart application
npm run start:dev
```

---

## Success Criteria

After implementing all optimizations, validate these improvements:

### Backend
- [ ] All new indexes are being used (idx_scan > 0 after 1 day)
- [ ] Incident detail page makes 2 fewer queries
- [ ] Bulk operations complete 10x faster
- [ ] Cache hit rate is >80%
- [ ] Dashboard metrics endpoint responds in <100ms (cached)
- [ ] API response time P95 is <500ms

### Frontend
- [ ] Initial bundle size is <200KB (gzipped)
- [ ] First Contentful Paint is <1.5s
- [ ] Time to Interactive is <3.5s
- [ ] Lighthouse Performance score is >90
- [ ] React DevTools Profiler shows <16ms renders

### Tests
- [ ] All backend tests pass
- [ ] All frontend tests pass
- [ ] Cache test script shows >80% hit rate
- [ ] Load tests show sustained throughput

---

## Next Steps

After completing these optimizations:

1. **Monitor Production Metrics** for 1 week
2. **Collect User Feedback** on perceived performance
3. **Analyze Bundle** for further optimization opportunities
4. **Profile Database** for remaining slow queries
5. **Implement Medium Priority** optimizations if needed
6. **Document Lessons Learned** for future reference

---

## Support & Questions

If you encounter issues during implementation:

1. Check application logs for errors
2. Verify Redis and PostgreSQL are running
3. Review the full analysis in `PERFORMANCE_OPTIMIZATION_REPORT.md`
4. Test each optimization in isolation
5. Use the rollback plan if needed

**Key Files to Review:**
- `docs/PERFORMANCE_OPTIMIZATION_REPORT.md` - Detailed analysis
- `apps/api/migrations/0001_performance_indexes.sql` - Database changes
- `apps/web/src/App.optimized.tsx` - Code splitting example
- `apps/api/src/modules/cache/cache-warmer.service.ts` - Cache warming

Good luck with the optimization implementation!
