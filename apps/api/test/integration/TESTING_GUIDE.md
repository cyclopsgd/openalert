# Integration Testing Guide

## Quick Start

### 1. Ensure Dependencies are Running

```bash
# Start PostgreSQL and Redis
docker-compose -f docker/docker-compose.yml up -d

# Verify they're healthy
docker-compose -f docker/docker-compose.yml ps
```

### 2. Create Test Database

```bash
# Option 1: Use the setup script (Linux/Mac)
./apps/api/test/integration/test-db-setup.sh

# Option 2: Manual setup
psql -U openalert -d postgres -c "CREATE DATABASE openalert_test;"
DATABASE_URL=postgresql://openalert:openalert_dev@localhost:5432/openalert_test npm run db:push -w @openalert/api
```

### 3. Run Tests

```bash
# Run all integration tests
npm run test:integration

# Run specific test suite
npm run test:integration -- auth.integration.spec.ts

# Run with coverage
npm run test:integration:cov

# Run in watch mode (for development)
npm run test:integration:watch
```

## Test Coverage

### Current Test Suites

1. **Authentication** (`auth.integration.spec.ts`)
   - User registration (local auth)
   - User login (local auth)
   - JWT token validation
   - Profile retrieval
   - Logout functionality
   - Rate limiting

2. **Incidents** (`incidents.integration.spec.ts`)
   - List incidents with filters
   - Get incident details
   - Acknowledge incidents
   - Resolve incidents
   - Bulk operations
   - RBAC permission checks
   - Team-based access control

3. **Alerts** (`alerts.integration.spec.ts`)
   - Webhook ingestion (Prometheus, Grafana, Datadog, Generic)
   - Alert deduplication
   - Alert routing
   - Alert to incident linking
   - Alert filtering
   - Webhook validation

4. **Schedules** (`schedules.integration.spec.ts`)
   - Create/update/delete schedules
   - Add rotations
   - Get current on-call user
   - Schedule overrides
   - Team-based access

5. **Services** (`services.integration.spec.ts`)
   - Service CRUD operations
   - Service dependencies
   - Circular dependency prevention
   - Status tracking
   - RBAC checks

6. **Teams** (`teams.integration.spec.ts`)
   - Team CRUD operations
   - Add/remove team members
   - Member role management
   - Team permissions isolation

7. **Escalation Policies** (`escalation.integration.spec.ts`)
   - Create policies
   - Add escalation levels
   - Add targets (users, schedules, teams)
   - Multi-level escalation flow

8. **Status Pages** (`status-pages.integration.spec.ts`)
   - Create status pages
   - Public/private access
   - Add services to status page
   - Post incident updates
   - Custom branding

## Test Architecture

### Setup Flow

```
beforeAll() → Initialize NestJS app (once per suite)
beforeEach() → Clean database + Create test users
Test execution → Make API calls, verify responses
afterAll() → Close app and connections
```

### Helper Functions

**Authentication Helpers** (`helpers/auth.helper.ts`):
- `createTestUser()` - Create user in database
- `createAuthenticatedUser()` - Create user with JWT token
- `authenticatedGet/Post/Patch/Delete()` - Make authenticated requests
- `registerUser()` - Register via API endpoint
- `loginUser()` - Login via API endpoint

**Database Helpers** (`helpers/database.helper.ts`):
- `createTestTeam()` - Create team
- `createTestService()` - Create service
- `createTestSchedule()` - Create schedule
- `createTestIncident()` - Create incident
- `createTestAlert()` - Create alert
- `createTestEscalationPolicy()` - Create escalation policy
- `addUserToTeam()` - Add user to team

**Fixtures** (`helpers/fixtures.ts`):
- Predefined test users with different roles
- Sample webhook payloads
- Test data templates

## Best Practices

### 1. Database Isolation

Each test starts with a clean database:
```typescript
beforeEach(async () => {
  await cleanupDatabase(); // Truncates all tables
  user = await createAuthenticatedUser(app, testUsers.responder);
});
```

### 2. Test User Roles

Use predefined test users from fixtures:
```typescript
import { testUsers } from './helpers/fixtures';

// Test as superadmin
superadminUser = await createAuthenticatedUser(app, testUsers.superadmin);

// Test as responder
responderUser = await createAuthenticatedUser(app, testUsers.responder);

// Test as observer
observerUser = await createAuthenticatedUser(app, testUsers.observer);
```

### 3. Testing Permissions

Always test both success and failure cases:
```typescript
it('should allow admin to create service', async () => {
  await authenticatedPost(app, '/services', adminUser.token, data).expect(201);
});

it('should deny observer from creating service', async () => {
  await authenticatedPost(app, '/services', observerUser.token, data).expect(403);
});
```

### 4. Webhook Testing

Test webhooks without authentication:
```typescript
it('should ingest Prometheus alert', async () => {
  const integration = await createTestIntegration(app, { ... });

  const response = await request(app.getHttpServer())
    .post(`/webhooks/prometheus/${integration.integrationKey}`)
    .send(prometheusAlertPayload)
    .expect(202);
});
```

### 5. Async Operations

Handle async operations properly:
```typescript
it('should create incident from critical alert', async () => {
  await request(app.getHttpServer())
    .post(`/webhooks/prometheus/${key}`)
    .send(criticalAlert)
    .expect(202);

  // Wait for async processing
  await new Promise(resolve => setTimeout(resolve, 500));

  // Verify incident was created
  const incidents = await authenticatedGet(app, '/incidents', token);
  expect(incidents.body.incidents.length).toBeGreaterThan(0);
});
```

## Debugging Tests

### Enable Detailed Logging

```typescript
// In your test file
beforeAll(async () => {
  app = await initializeTestApp();
  app.useLogger(console); // Enable NestJS logging
});
```

### Inspect Database State

```bash
# Connect to test database
psql postgresql://openalert:openalert_dev@localhost:5432/openalert_test

# Query tables
SELECT * FROM users;
SELECT * FROM incidents;
SELECT * FROM alerts;
```

### Run Single Test

```bash
# Run specific test by name
npm run test:integration -- -t "should register a new user"

# Run specific file
npm run test:integration -- auth.integration.spec.ts
```

### Check Test Timeout

If tests timeout, increase in `jest-integration.json`:
```json
{
  "testTimeout": 60000
}
```

## Common Issues

### Issue: Tests fail with "ECONNREFUSED"

**Cause**: PostgreSQL or Redis not running

**Solution**:
```bash
docker-compose -f docker/docker-compose.yml up -d
```

### Issue: "Database connection refused"

**Cause**: Wrong database credentials

**Solution**: Check `.env.test` file matches Docker credentials

### Issue: "Foreign key constraint violation"

**Cause**: Cleanup script not running or wrong order

**Solution**: Check `setup.ts` cleanup order, ensure CASCADE is used

### Issue: Tests pass individually but fail together

**Cause**: Shared state or missing cleanup

**Solution**:
- Ensure `cleanupDatabase()` in `beforeEach`
- Check for race conditions
- Tests run serially with `--runInBand`

### Issue: "Table does not exist"

**Cause**: Migrations not run on test database

**Solution**:
```bash
DATABASE_URL=postgresql://openalert:openalert_dev@localhost:5432/openalert_test npm run db:push
```

## Performance Tips

1. **Use Connection Pooling**: Configured in database module
2. **Run Tests Serially**: Already configured with `--runInBand`
3. **Optimize Cleanup**: Truncate tables instead of deleting rows
4. **Minimize External Calls**: Mock email/SMS services
5. **Use Transactions**: For faster rollback (future enhancement)

## CI/CD Integration

### GitHub Actions Example

```yaml
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
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run migrations
        run: npm run db:push
        env:
          DATABASE_URL: postgresql://openalert:openalert_dev@localhost:5432/openalert_test

      - name: Run integration tests
        run: npm run test:integration:cov
        env:
          DATABASE_URL: postgresql://openalert:openalert_dev@localhost:5432/openalert_test
          REDIS_URL: redis://localhost:6379
          JWT_SECRET: test-secret

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./apps/api/coverage/integration/lcov.info
```

## Next Steps

1. Fix any TypeScript compilation errors
2. Run full integration test suite
3. Review and address failing tests
4. Check coverage report
5. Add missing test cases for edge cases
6. Document any test-specific configuration
7. Set up CI/CD integration

## Resources

- [NestJS Testing Guide](https://docs.nestjs.com/fundamentals/testing)
- [Jest Documentation](https://jestjs.io/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Drizzle ORM Docs](https://orm.drizzle.team/)
