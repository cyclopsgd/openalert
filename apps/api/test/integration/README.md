# Integration Tests

This directory contains comprehensive integration tests for the OpenAlert API endpoints. These tests verify that all services work together correctly with real database interactions.

## Overview

Integration tests cover:
- **Authentication**: Registration, login, JWT validation, token refresh
- **Incidents**: CRUD operations, acknowledgment, resolution, filtering, RBAC
- **Alerts**: Webhook ingestion, deduplication, routing, linking to incidents
- **Schedules**: On-call rotations, overrides, timezone handling
- **Services**: Service management, dependencies, circular dependency prevention
- **Teams**: Team management, member roles, access control
- **Escalation Policies**: Multi-level escalation, target types, flow simulation
- **Status Pages**: Public access, service tracking, incident updates, custom branding

## Prerequisites

Before running integration tests, ensure you have:

1. **PostgreSQL database** running (via Docker or local installation)
2. **Redis** running (for caching and queues)
3. **Environment variables** configured (`.env` file)

### Quick Setup with Docker

```bash
# Start PostgreSQL and Redis
docker-compose -f docker/docker-compose.yml up -d

# Verify services are running
docker-compose -f docker/docker-compose.yml ps
```

### Environment Configuration

Create or update your `.env` file:

```bash
# Test Database (use separate DB from development)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/openalert_test

# Redis
REDIS_URL=redis://localhost:6379

# JWT Secret (for test tokens)
JWT_SECRET=test-jwt-secret-key

# Other required variables
NODE_ENV=test
PORT=3001
API_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000
```

## Running Tests

### Run All Integration Tests
```bash
npm run test:integration
```

### Run Specific Test File
```bash
npm run test:integration -- auth.integration.spec.ts
```

### Run Tests in Watch Mode
```bash
npm run test:integration:watch
```

### Run Tests with Coverage
```bash
npm run test:integration:cov
```

## Test Structure

### Test Files
- `auth.integration.spec.ts` - Authentication flows
- `incidents.integration.spec.ts` - Incident management
- `alerts.integration.spec.ts` - Alert ingestion and processing
- `schedules.integration.spec.ts` - On-call scheduling
- `services.integration.spec.ts` - Service catalog
- `teams.integration.spec.ts` - Team management
- `escalation.integration.spec.ts` - Escalation policies
- `status-pages.integration.spec.ts` - Public status pages

### Helper Files
- `setup.ts` - Test app initialization and cleanup
- `helpers/auth.helper.ts` - Authentication utilities
- `helpers/database.helper.ts` - Database seeding utilities
- `helpers/fixtures.ts` - Test data fixtures

## Writing New Tests

### Basic Test Structure

```typescript
import { INestApplication } from '@nestjs/common';
import { initializeTestApp, closeTestApp, cleanupDatabase } from './setup';
import { createAuthenticatedUser, authenticatedGet } from './helpers/auth.helper';
import { testUsers } from './helpers/fixtures';

describe('Feature Integration Tests', () => {
  let app: INestApplication;
  let adminUser: TestUser;

  beforeAll(async () => {
    app = await initializeTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  beforeEach(async () => {
    await cleanupDatabase();
    adminUser = await createAuthenticatedUser(app, testUsers.superadmin);
  });

  it('should perform action', async () => {
    const response = await authenticatedGet(
      app,
      '/api/endpoint',
      adminUser.token
    ).expect(200);

    expect(response.body).toMatchObject({
      // assertions
    });
  });
});
```

### Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Use `cleanupDatabase()` in `beforeEach`
3. **Fixtures**: Use predefined test data from `fixtures.ts`
4. **Assertions**: Test both success and error cases
5. **RBAC**: Test permission checks for different user roles
6. **Real DB**: Tests use real database, not mocks
7. **Async Operations**: Use proper async/await and timeouts

## Database Cleanup

The test suite automatically cleans the database between tests:

```typescript
beforeEach(async () => {
  await cleanupDatabase(); // Truncates all tables
});
```

This ensures each test starts with a clean slate.

## Troubleshooting

### Tests Failing with Connection Errors

**Problem**: `ECONNREFUSED` or database connection errors

**Solution**:
```bash
# Ensure Docker services are running
docker-compose -f docker/docker-compose.yml up -d

# Check if PostgreSQL is accessible
psql postgresql://postgres:postgres@localhost:5432/openalert_test
```

### Tests Timing Out

**Problem**: Tests exceed 30-second timeout

**Solution**:
- Check if Redis and PostgreSQL are responding
- Increase timeout in `jest-integration.json`:
  ```json
  {
    "testTimeout": 60000
  }
  ```

### Random Test Failures

**Problem**: Tests pass individually but fail when run together

**Solution**:
- Tests run with `--runInBand` (serial execution) by default
- Ensure `cleanupDatabase()` is called in `beforeEach`
- Check for shared state or race conditions

### Foreign Key Constraint Errors

**Problem**: Cannot delete records due to foreign key constraints

**Solution**:
- The cleanup script uses `TRUNCATE CASCADE`
- Ensure proper table deletion order in `setup.ts`
- May need to temporarily disable foreign key checks

## Performance

Integration tests are slower than unit tests because they:
- Use real database connections
- Run transactions and queries
- Initialize the full NestJS application

Typical execution time:
- Single test file: 5-15 seconds
- Full suite: 60-120 seconds

To speed up tests:
- Use connection pooling (configured in database module)
- Run tests serially (`--runInBand`)
- Optimize database cleanup queries

## Coverage Goals

Target coverage for integration tests:
- **Critical endpoints**: 100% coverage
- **Business logic flows**: 90%+ coverage
- **Error handling**: 80%+ coverage
- **Overall**: 60%+ coverage

Run coverage report:
```bash
npm run test:integration:cov
```

## CI/CD Integration

Add to your CI pipeline:

```yaml
# Example GitHub Actions
- name: Run Integration Tests
  env:
    DATABASE_URL: postgresql://postgres:postgres@localhost:5432/openalert_test
    REDIS_URL: redis://localhost:6379
  run: npm run test:integration:cov

- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./apps/api/coverage/integration/lcov.info
```

## Additional Resources

- [NestJS Testing Documentation](https://docs.nestjs.com/fundamentals/testing)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [OpenAlert Implementation Guide](../../docs/specs/OpenAlert-Implementation-Guide.md)
