# Integration Tests - Pre-Flight Checklist

## Status: Tests Created ✅ | Ready to Run ⏳

The comprehensive integration test suite has been created with 200+ test cases covering all major API endpoints. Before running the tests, complete the following checklist.

## ✅ Completed Items

- [x] Created test infrastructure (setup.ts, helpers, fixtures)
- [x] Written 8 comprehensive test suites
- [x] Created authentication helper utilities
- [x] Created database seeding helper utilities
- [x] Added test fixtures and sample data
- [x] Created Jest configuration for integration tests
- [x] Added npm scripts for running tests
- [x] Created test environment configuration (.env.test)
- [x] Created test database setup script
- [x] Created comprehensive documentation (README, TESTING_GUIDE)
- [x] Tests can be discovered by Jest

## ⏳ Pending Items (To Run Tests)

### 1. Fix TypeScript Compilation Errors

**Priority**: HIGH
**Status**: ⏳ Required before tests can run

Current compilation errors prevent the test suite from running:
```bash
npm run build
# Shows 74 errors in various files
```

**Files with errors** (from build output):
- `src/modules/teams/teams.service.ts` - Property issues with database schema
- Other files TBD after initial fixes

**Action Items**:
1. Run `npm run build` to see all errors
2. Fix TypeScript errors in source files
3. Ensure database schema matches TypeScript types
4. Verify all imports are correct

**Fix Example**:
```typescript
// If schema has `teamRole` but code uses `role`:
// Update all references to match schema column name
.select({
  userId: teamMembers.userId,
  teamRole: teamMembers.teamRole,  // Changed from 'role'
})
```

### 2. Create Test Database

**Priority**: HIGH
**Status**: ⏳ Required

```bash
# Option 1: Use setup script (Linux/Mac)
cd apps/api/test/integration
./test-db-setup.sh

# Option 2: Manual setup (Windows/All platforms)
psql -U openalert -d postgres -c "DROP DATABASE IF EXISTS openalert_test;"
psql -U openalert -d postgres -c "CREATE DATABASE openalert_test;"

# Run migrations on test database
DATABASE_URL=postgresql://openalert:openalert_dev@localhost:5432/openalert_test npm run db:push -w @openalert/api
```

**Verify**:
```bash
# Connect to test database
psql postgresql://openalert:openalert_dev@localhost:5432/openalert_test

# List tables (should see all OpenAlert tables)
\dt

# Exit
\q
```

### 3. Verify Docker Services

**Priority**: HIGH
**Status**: ✅ Currently running (verified)

```bash
# Verify services are running
docker-compose -f docker/docker-compose.yml ps

# Should see:
# - openalert-postgres (healthy)
# - openalert-redis (healthy)
# - openalert-redis-ui (healthy)

# If not running:
docker-compose -f docker/docker-compose.yml up -d
```

### 4. Configure Environment Variables

**Priority**: MEDIUM
**Status**: ⚠️ File created, needs validation

The `.env.test` file has been created at `apps/api/.env.test`.

**Validate**:
```bash
# Check test environment file exists
cat apps/api/.env.test

# Ensure these variables are set:
# - DATABASE_URL=postgresql://openalert:openalert_dev@localhost:5432/openalert_test
# - REDIS_URL=redis://localhost:6379
# - JWT_SECRET=test-jwt-secret-key-do-not-use-in-production
```

**Test Connection**:
```bash
# Test PostgreSQL connection
psql postgresql://openalert:openalert_dev@localhost:5432/openalert_test -c "SELECT 1;"

# Test Redis connection
redis-cli ping
# Should return: PONG
```

### 5. Install Dependencies

**Priority**: LOW
**Status**: ✅ Assumed already installed

```bash
# Ensure all dependencies are installed
npm install

# Verify test dependencies
npm list supertest @nestjs/testing jest ts-jest
```

## 🚀 Running Tests (After Checklist Complete)

### Step 1: Run a Single Test File First

```bash
# Try authentication tests first (simplest)
npm run test:integration -- auth.integration.spec.ts
```

**Expected Output**:
- Tests should initialize app
- Database should be cleaned before each test
- Tests should execute and report results
- No compilation errors

**If Errors Occur**:
- Check error messages carefully
- Verify database connection
- Verify test database has all tables
- Check console for detailed error output

### Step 2: Run All Tests

```bash
# Run all integration tests
npm run test:integration

# Or with coverage
npm run test:integration:cov
```

**Expected Results**:
- All 8 test suites should run
- 200+ tests should execute
- Some tests may fail initially (expected)
- Coverage report should be generated

### Step 3: Fix Failing Tests

Review failing tests and fix:
1. **Database constraints** - Check foreign keys, unique constraints
2. **API changes** - Update tests if endpoints changed
3. **Timing issues** - Increase timeouts if needed
4. **Missing features** - Some features may not be implemented yet

### Step 4: Generate Coverage Report

```bash
npm run test:integration:cov

# View HTML report
open apps/api/coverage/integration/lcov-report/index.html
# Windows: start apps/api/coverage/integration/lcov-report/index.html
```

**Target Coverage**: 60%+ of critical API endpoints

## 📋 Troubleshooting Guide

### Issue: "Cannot find module" errors

**Solution**:
```bash
npm install
npm run build
```

### Issue: "Database connection refused"

**Solution**:
```bash
# Restart PostgreSQL
docker-compose -f docker/docker-compose.yml restart postgres

# Verify it's running
docker-compose -f docker/docker-compose.yml ps postgres
```

### Issue: "Table does not exist"

**Solution**:
```bash
# Run migrations on test database
DATABASE_URL=postgresql://openalert:openalert_dev@localhost:5432/openalert_test npm run db:push
```

### Issue: Tests timeout

**Solution**:
```typescript
// Increase timeout in jest-integration.json
{
  "testTimeout": 60000  // Increase from 30000 to 60000
}
```

### Issue: Random test failures

**Solution**:
- Tests already run serially (`--runInBand`)
- Check if `cleanupDatabase()` is called in `beforeEach`
- Verify no shared state between tests
- Check for race conditions in async code

## 📊 Success Metrics

After running tests, verify:

- [ ] All test suites execute without errors
- [ ] >80% of tests passing (some failures expected initially)
- [ ] Coverage report generated successfully
- [ ] Coverage >60% for critical endpoints
- [ ] No memory leaks (tests complete without hanging)
- [ ] Test execution time <2 minutes for full suite

## 📝 Post-Run Tasks

1. **Document Failures**: Create issues for failing tests
2. **Update Tests**: Fix tests that fail due to API changes
3. **Add Edge Cases**: Identify missing test scenarios
4. **Optimize Performance**: Reduce test execution time if needed
5. **Add CI/CD**: Integrate tests into GitHub Actions/CI pipeline

## 🔄 CI/CD Integration (Future)

Once tests are passing locally, add to CI/CD:

```yaml
# .github/workflows/integration-tests.yml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: openalert
          POSTGRES_PASSWORD: openalert_dev
          POSTGRES_DB: openalert_test
        ports:
          - 5432:5432
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run db:push
      - run: npm run test:integration:cov
      - uses: codecov/codecov-action@v3
```

## 📚 Documentation References

- **Quick Start**: `apps/api/test/integration/README.md`
- **Detailed Guide**: `apps/api/test/integration/TESTING_GUIDE.md`
- **Implementation Summary**: `INTEGRATION_TESTS_SUMMARY.md`
- **This Checklist**: `INTEGRATION_TESTS_CHECKLIST.md`

## ✅ Completion Checklist

Use this checklist to track progress:

```
Pre-Flight:
[ ] Fix TypeScript compilation errors
[ ] Create test database (openalert_test)
[ ] Verify Docker services running
[ ] Validate environment variables
[ ] Run database migrations on test DB

Initial Test Run:
[ ] Run single test file successfully
[ ] Run all test suites
[ ] Review and fix failing tests
[ ] Generate coverage report
[ ] Verify >60% coverage achieved

Post-Run:
[ ] Document any persistent failures
[ ] Update tests for API changes
[ ] Optimize test performance
[ ] Add CI/CD integration
[ ] Mark task #20 as completed ✅

Documentation:
[ ] Update README if needed
[ ] Add any new troubleshooting tips
[ ] Document test patterns used
[ ] Update coverage goals
```

---

**Current Status**: Tests are written and ready. Complete the pre-flight checklist to run them.

**Estimated Time to Run**: 30-60 minutes (including fixes)

**Next Action**: Fix TypeScript compilation errors, then create test database
