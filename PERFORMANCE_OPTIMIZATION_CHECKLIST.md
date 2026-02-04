# Performance Optimization Checklist

Quick reference for implementing performance optimizations from Task #41.

**Read Full Documentation:**
- 📄 `docs/PERFORMANCE_OPTIMIZATION_SUMMARY.md` - Overview
- 📄 `docs/PERFORMANCE_OPTIMIZATION_REPORT.md` - Detailed analysis
- 📄 `docs/PERFORMANCE_OPTIMIZATION_IMPLEMENTATION_GUIDE.md` - Step-by-step instructions

---

## Pre-Implementation Checklist

- [ ] Backup database before applying migrations
- [ ] Ensure Redis is running and accessible
- [ ] Ensure PostgreSQL is running with proper permissions
- [ ] Git commit all current changes
- [ ] Run current test suite to establish baseline
- [ ] Document current performance metrics

---

## Phase 1: High Priority (50 minutes)

### 1. Database Indexes (5 minutes)

```bash
psql -U postgres -d openalert -f apps/api/migrations/0001_performance_indexes.sql
```

**Verify:**
- [ ] 8 new indexes created
- [ ] No errors in PostgreSQL logs
- [ ] Run: `\di incidents*` to confirm

### 2. Frontend Code Splitting (10 minutes)

```bash
cd apps/web

# Backup files
cp src/App.tsx src/App.tsx.backup
cp vite.config.ts vite.config.ts.backup

# Apply optimizations
cp src/App.optimized.tsx src/App.tsx
cp vite.config.optimized.ts vite.config.ts

# Install dependencies
npm install --save-dev rollup-plugin-visualizer

# Build and test
npm run build
npm run preview
```

**Verify:**
- [ ] Build succeeds without errors
- [ ] Multiple chunk files in `dist/assets/js/`
- [ ] Initial bundle <200KB
- [ ] App loads and routes work

### 3. Fix N+1 Query (15 minutes)

**File:** `apps/api/src/modules/incidents/incidents.service.ts`

- [ ] Update `findById()` method to use relations
- [ ] Add `acknowledgedBy` and `resolvedBy` relations to schema
- [ ] Run tests: `npm test -- incidents.service.spec.ts`
- [ ] Verify no errors

### 4. Cache Warming (20 minutes)

```bash
cd apps/api

# Install dependency
npm install @nestjs/schedule

# Copy cache warmer service (already exists at)
# apps/api/src/modules/cache/cache-warmer.service.ts
```

**Manual edits required:**

1. Update `apps/api/src/app.module.ts`:
   - [ ] Import `ScheduleModule`
   - [ ] Add to imports array: `ScheduleModule.forRoot()`

2. Update `apps/api/src/modules/cache/cache.module.ts`:
   - [ ] Import `CacheWarmerService`
   - [ ] Add to providers array
   - [ ] Add to exports array
   - [ ] Import `MetricsModule` and `ServicesModule`

**Verify:**
- [ ] App starts without errors
- [ ] Logs show "Warming all critical caches..."
- [ ] Redis keys populated: `redis-cli KEYS openalert:*`

---

## Phase 2: Medium Priority (110 minutes)

### 5. Component Memoization (20 minutes)

```bash
cd apps/web

# Backup files
cp src/pages/Dashboard.tsx src/pages/Dashboard.tsx.backup
cp src/hooks/useRealtime.ts src/hooks/useRealtime.ts.backup

# Apply optimizations
cp src/pages/Dashboard.optimized.tsx src/pages/Dashboard.tsx
cp src/hooks/useRealtime.optimized.ts src/hooks/useRealtime.ts
```

**Wrap chart components with `memo()`:**
- [ ] `IncidentTrendsChart.tsx`
- [ ] `StatusDistributionChart.tsx`
- [ ] `ResponseTimeChart.tsx`
- [ ] `MetricsBar.tsx`
- [ ] `RecentIncidentsTable.tsx`

**Verify:**
- [ ] App compiles without errors
- [ ] Dashboard loads correctly
- [ ] Realtime updates work
- [ ] No console errors

### 6. Cache Routing Rules (15 minutes)

**File:** `apps/api/src/modules/alert-routing/alert-routing.service.ts`

- [ ] Add `getEnabledRules()` private method with caching
- [ ] Update `evaluateRules()` to use cached rules
- [ ] Update `create()`, `update()`, `delete()` to invalidate cache

**Verify:**
- [ ] Tests pass
- [ ] Routing evaluation still works
- [ ] Cache keys appear in Redis

### 7. Bulk Operations (30 minutes)

**File:** `apps/api/src/modules/incidents/incidents.service.ts`

- [ ] Rewrite `bulkAcknowledge()` to use single SQL update
- [ ] Rewrite `bulkResolve()` to use single SQL update
- [ ] Add bulk timeline inserts
- [ ] Test with multiple incidents

**Verify:**
- [ ] Tests pass
- [ ] Performance is >5x faster
- [ ] All incidents updated correctly
- [ ] Timeline entries created

### 8. Optimize Services Query (30 minutes)

**File:** `apps/api/src/modules/services/services.service.ts`

- [ ] Rewrite `findAll()` to use single query with LEFT JOINs
- [ ] Test with various team filters
- [ ] Verify caching still works

**Verify:**
- [ ] Tests pass
- [ ] Single query instead of 3
- [ ] Results match previous behavior
- [ ] Cache working correctly

### 9. Testing & Validation (25 minutes)

```bash
# Backend tests
cd apps/api
npm test

# Frontend tests
cd apps/web
npm test

# Cache performance test
cd ../..
bash scripts/test-cache.sh

# Lighthouse audit
cd apps/web
npm run build
npm run preview
# In another terminal:
npx lighthouse http://localhost:4173 --view
```

**Verify:**
- [ ] All tests pass
- [ ] Cache hit rate >80%
- [ ] Lighthouse Performance >90
- [ ] No errors in console
- [ ] No errors in server logs

---

## Validation Checklist

### Backend Performance

- [ ] Database indexes are being used (query `pg_stat_user_indexes`)
- [ ] Cache hit rate >80% (Redis INFO stats)
- [ ] Dashboard API responds <100ms (cached)
- [ ] Incident detail makes 2 fewer queries
- [ ] Bulk operations are >5x faster

### Frontend Performance

- [ ] Initial bundle <200KB gzipped
- [ ] First Contentful Paint <1.5s
- [ ] Time to Interactive <3.5s
- [ ] Lighthouse Performance score >90
- [ ] No console errors or warnings

### Functional Testing

- [ ] Login works
- [ ] Dashboard loads and displays data
- [ ] Incident list loads
- [ ] Incident detail loads
- [ ] Can acknowledge incident
- [ ] Can resolve incident
- [ ] Bulk operations work
- [ ] Realtime updates work
- [ ] All routes accessible
- [ ] Charts render correctly

---

## Monitoring Setup

### Database

```sql
-- Enable pg_stat_statements
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Create monitoring query
CREATE OR REPLACE VIEW slow_queries AS
SELECT
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 20;
```

- [ ] pg_stat_statements enabled
- [ ] Monitoring view created
- [ ] Baseline metrics recorded

### Cache

```bash
# Monitor cache hit rate
redis-cli INFO stats | grep -E "keyspace_hits|keyspace_misses"

# Count cache keys
redis-cli --scan --pattern "openalert:*" | wc -l

# Monitor memory
redis-cli INFO memory | grep used_memory_human
```

- [ ] Cache monitoring script created
- [ ] Baseline hit rate recorded
- [ ] Memory usage tracked

### Application

```bash
# Create performance log
mkdir -p logs
touch logs/performance.log

# Monitor API response times
# Add to crontab or monitoring system
```

- [ ] Performance logging configured
- [ ] Baseline response times recorded
- [ ] Error tracking enabled

---

## Rollback Plan

If issues occur, follow these steps:

### 1. Rollback Frontend

```bash
cd apps/web
cp src/App.tsx.backup src/App.tsx
cp vite.config.ts.backup vite.config.ts
cp src/pages/Dashboard.tsx.backup src/pages/Dashboard.tsx
cp src/hooks/useRealtime.ts.backup src/hooks/useRealtime.ts
npm run build
```

### 2. Rollback Backend Code

```bash
cd apps/api
git checkout HEAD -- src/modules/incidents/incidents.service.ts
git checkout HEAD -- src/modules/alert-routing/alert-routing.service.ts
git checkout HEAD -- src/modules/services/services.service.ts
rm src/modules/cache/cache-warmer.service.ts
```

### 3. Rollback Database Indexes

```sql
DROP INDEX IF EXISTS incidents_status_severity_idx;
DROP INDEX IF EXISTS incidents_acknowledged_by_idx;
DROP INDEX IF EXISTS incidents_resolved_by_idx;
DROP INDEX IF EXISTS alert_routing_rules_team_enabled_priority_idx;
DROP INDEX IF EXISTS schedule_overrides_schedule_time_idx;
DROP INDEX IF EXISTS alerts_fingerprint_status_idx;
DROP INDEX IF EXISTS incidents_assignee_status_idx;
DROP INDEX IF EXISTS services_team_status_idx;
```

### 4. Clear Cache and Restart

```bash
redis-cli FLUSHDB
npm run start:dev
```

---

## Post-Implementation

### Day 1: Monitor Closely

- [ ] Check application logs every 2 hours
- [ ] Monitor error rates
- [ ] Track response times
- [ ] Verify cache hit rates
- [ ] Check database query performance

### Week 1: Track Metrics

- [ ] Daily Lighthouse audits
- [ ] Database query analysis
- [ ] Cache performance review
- [ ] User feedback collection
- [ ] Error rate comparison

### Week 2: Optimize Further

- [ ] Analyze slow queries
- [ ] Fine-tune cache TTLs
- [ ] Adjust index strategies
- [ ] Review bundle analysis
- [ ] Plan Phase 3 optimizations

---

## Success Metrics

### Must Have ✅

- [ ] All tests pass
- [ ] No production errors
- [ ] Performance improved
- [ ] Faster than before

### Performance Targets

- [ ] Backend: API P95 <500ms
- [ ] Backend: Cache hit rate >80%
- [ ] Frontend: Bundle <200KB
- [ ] Frontend: FCP <1.5s
- [ ] Frontend: Lighthouse >90

### Business Impact

- [ ] User satisfaction improved
- [ ] Page load complaints reduced
- [ ] Server costs decreased
- [ ] Error rates stable or lower

---

## Quick Reference

**Start Services:**
```bash
docker-compose -f docker/docker-compose.yml up -d
npm run start:dev
```

**Run Tests:**
```bash
npm test
```

**Check Cache:**
```bash
bash scripts/test-cache.sh
redis-cli INFO stats
```

**Monitor Database:**
```sql
SELECT * FROM slow_queries;
```

**Build Frontend:**
```bash
cd apps/web
npm run build
npm run preview
```

**Lighthouse Audit:**
```bash
npx lighthouse http://localhost:4173 --view
```

---

## Support

**Documentation:**
- Full Report: `docs/PERFORMANCE_OPTIMIZATION_REPORT.md`
- Implementation Guide: `docs/PERFORMANCE_OPTIMIZATION_IMPLEMENTATION_GUIDE.md`
- Summary: `docs/PERFORMANCE_OPTIMIZATION_SUMMARY.md`

**Key Files:**
- Database: `apps/api/migrations/0001_performance_indexes.sql`
- Cache Warmer: `apps/api/src/modules/cache/cache-warmer.service.ts`
- App Component: `apps/web/src/App.optimized.tsx`
- Vite Config: `apps/web/vite.config.optimized.ts`

**Testing:**
- Cache Test: `scripts/test-cache.sh`
- Backend Tests: `npm test` in apps/api
- Frontend Tests: `npm test` in apps/web

---

**Last Updated:** February 4, 2026
**Task:** #41 Performance Optimization
