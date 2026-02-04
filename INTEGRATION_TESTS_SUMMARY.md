# Integration Tests - Implementation Summary

## Overview

Comprehensive integration test suite created for OpenAlert API with 8 test suites covering all major endpoints and flows.

## What Was Created

### Test Infrastructure

#### Core Setup Files
- `apps/api/test/integration/setup.ts` - Test app initialization, database cleanup, teardown
- `apps/api/test/jest-integration.json` - Jest configuration for integration tests
- `apps/api/test/integration/.env.test` - Test environment configuration

#### Helper Modules
- `apps/api/test/integration/helpers/auth.helper.ts` - Authentication utilities
  - Create test users with JWT tokens
  - Make authenticated HTTP requests
  - Register/login via API

- `apps/api/test/integration/helpers/database.helper.ts` - Database seeding utilities
  - Create test teams, services, schedules
  - Create test incidents, alerts
  - Create test escalation policies, status pages

- `apps/api/test/integration/helpers/fixtures.ts` - Test data fixtures
  - Predefined test users (superadmin, admin, responder, observer)
  - Sample webhook payloads (Prometheus, Grafana, Datadog)
  - Test data templates

### Integration Test Suites

#### 1. Authentication Tests (`auth.integration.spec.ts`)
**Coverage**: 25+ test cases
- User registration with validation
- Local authentication (email/password)
- JWT token validation and extraction
- Profile retrieval
- Logout functionality
- Rate limiting tests
- Error handling (invalid credentials, duplicate users)

**Key Tests**:
- ✅ Register new user with valid credentials
- ✅ Reject weak passwords and invalid emails
- ✅ Prevent duplicate email registration
- ✅ Login with correct credentials
- ✅ Reject incorrect password
- ✅ Validate JWT tokens
- ✅ Rate limit registration and login attempts

#### 2. Incidents Tests (`incidents.integration.spec.ts`)
**Coverage**: 30+ test cases
- List incidents with advanced filtering
- Get incident details with related data
- Acknowledge incidents
- Resolve incidents
- Bulk operations (acknowledge/resolve)
- RBAC permission checks
- Team-based access control

**Key Tests**:
- ✅ List all incidents with pagination
- ✅ Filter by status, severity, service, date range
- ✅ Search incidents by title
- ✅ Acknowledge incident (role-based)
- ✅ Resolve incident (role-based)
- ✅ Bulk acknowledge/resolve multiple incidents
- ✅ Deny observer from modifying incidents
- ✅ Team member access control

#### 3. Alerts Tests (`alerts.integration.spec.ts`)
**Coverage**: 30+ test cases
- Webhook ingestion (Prometheus, Grafana, Datadog, Generic)
- Alert deduplication by fingerprint
- Alert routing to services
- Alert to incident linking
- Alert filtering and pagination
- Webhook validation
- Alert suppression

**Key Tests**:
- ✅ Ingest Prometheus alerts
- ✅ Ingest Grafana alerts
- ✅ Ingest Datadog alerts
- ✅ Process generic webhooks
- ✅ Deduplicate alerts with same fingerprint
- ✅ Create separate alerts for different fingerprints
- ✅ Route alerts to correct service
- ✅ Create incidents for critical alerts
- ✅ Reject invalid integration keys
- ✅ Validate webhook payloads

#### 4. Schedules Tests (`schedules.integration.spec.ts`)
**Coverage**: 25+ test cases
- Create/update/delete schedules
- Add rotations (daily, weekly, custom)
- Get current on-call user
- Schedule overrides
- Timezone handling
- Team-based access control

**Key Tests**:
- ✅ Create schedule with team and timezone
- ✅ Add daily/weekly rotations
- ✅ Get current on-call user
- ✅ Create schedule overrides
- ✅ Validate timezone formats
- ✅ Filter schedules by team
- ✅ Team admin can manage team schedules
- ✅ Deny non-team-member modifications

#### 5. Services Tests (`services.integration.spec.ts`)
**Coverage**: 20+ test cases
- Service CRUD operations
- Service dependencies
- Circular dependency prevention
- Service status tracking
- RBAC permission checks

**Key Tests**:
- ✅ Create service with team
- ✅ Update service status
- ✅ Delete service
- ✅ Add service dependencies
- ✅ Prevent circular dependencies
- ✅ Filter services by status
- ✅ Deny observer from modifying services

#### 6. Teams Tests (`teams.integration.spec.ts`)
**Coverage**: 25+ test cases
- Team CRUD operations
- Add/remove team members
- Member role management (team_admin, member, observer)
- Team permissions isolation
- Duplicate prevention

**Key Tests**:
- ✅ Create team with slug
- ✅ Reject duplicate team slug
- ✅ Add members to team
- ✅ Update member roles
- ✅ Remove team members
- ✅ Prevent duplicate membership
- ✅ Validate role values
- ✅ Team admin can manage team
- ✅ Isolate team resources

#### 7. Escalation Policies Tests (`escalation.integration.spec.ts`)
**Coverage**: 20+ test cases
- Create escalation policies
- Add escalation levels
- Add targets (users, schedules, teams)
- Multi-level escalation flow
- Validation and ordering

**Key Tests**:
- ✅ Create escalation policy
- ✅ Add escalation levels with delays
- ✅ Add user targets
- ✅ Add schedule targets
- ✅ Add team targets
- ✅ Enforce level ordering
- ✅ Validate target types
- ✅ Multi-level escalation simulation

#### 8. Status Pages Tests (`status-pages.integration.spec.ts`)
**Coverage**: 20+ test cases
- Create/update/delete status pages
- Public/private access control
- Add services to status page
- Post incident updates
- Custom branding
- Service status tracking

**Key Tests**:
- ✅ Create public status page
- ✅ Create private status page
- ✅ Allow public access without auth
- ✅ Deny private page access without auth
- ✅ Add services to status page
- ✅ Prevent duplicate services
- ✅ Post incident updates
- ✅ Update incident status
- ✅ List incidents publicly
- ✅ Set custom branding

## Test Statistics

- **Total Test Suites**: 8
- **Total Test Cases**: 200+
- **Test Files**: 8 integration specs + 3 helpers + 1 fixtures
- **Lines of Code**: ~4,500 lines
- **Coverage Target**: 60%+ of critical API endpoints

## Running Tests

### Prerequisites
```bash
# Ensure Docker services are running
docker-compose -f docker/docker-compose.yml up -d

# Create test database
psql -U openalert -d postgres -c "CREATE DATABASE openalert_test;"
DATABASE_URL=postgresql://openalert:openalert_dev@localhost:5432/openalert_test npm run db:push
```

### Run Commands
```bash
# Run all integration tests
npm run test:integration

# Run specific test suite
npm run test:integration -- auth.integration.spec.ts

# Run with coverage
npm run test:integration:cov

# Run in watch mode
npm run test:integration:watch
```

### Package.json Scripts Added

**Root package.json**:
```json
{
  "test:integration": "npm run test:integration -w @openalert/api",
  "test:integration:cov": "npm run test:integration:cov -w @openalert/api"
}
```

**apps/api/package.json**:
```json
{
  "test:integration": "jest --config ./test/jest-integration.json --runInBand",
  "test:integration:watch": "jest --config ./test/jest-integration.json --watch --runInBand",
  "test:integration:cov": "jest --config ./test/jest-integration.json --coverage --runInBand"
}
```

## File Structure

```
apps/api/
├── test/
│   ├── integration/
│   │   ├── setup.ts                         # Test initialization & cleanup
│   │   ├── helpers/
│   │   │   ├── auth.helper.ts              # Auth utilities
│   │   │   ├── database.helper.ts          # DB seeding
│   │   │   └── fixtures.ts                 # Test data
│   │   ├── auth.integration.spec.ts        # Auth tests
│   │   ├── incidents.integration.spec.ts   # Incident tests
│   │   ├── alerts.integration.spec.ts      # Alert tests
│   │   ├── schedules.integration.spec.ts   # Schedule tests
│   │   ├── services.integration.spec.ts    # Service tests
│   │   ├── teams.integration.spec.ts       # Team tests
│   │   ├── escalation.integration.spec.ts  # Escalation tests
│   │   ├── status-pages.integration.spec.ts # Status page tests
│   │   ├── README.md                       # Test documentation
│   │   ├── TESTING_GUIDE.md               # Detailed guide
│   │   └── test-db-setup.sh               # DB setup script
│   └── jest-integration.json               # Jest config
└── .env.test                                # Test environment
```

## Key Features

### 1. Real Database Testing
- Uses actual PostgreSQL database (separate test DB)
- Tests real SQL queries and transactions
- Validates database constraints and relations

### 2. Automatic Cleanup
- Truncates all tables between tests
- Ensures test isolation
- Prevents test interdependencies

### 3. Authentication Testing
- Tests JWT generation and validation
- Tests rate limiting
- Tests RBAC permissions for all roles

### 4. Webhook Testing
- Tests all webhook integrations (Prometheus, Grafana, Datadog)
- Validates payload formats
- Tests deduplication logic

### 5. RBAC Testing
- Tests permissions for superadmin, admin, responder, observer
- Validates team-based access control
- Ensures proper authorization checks

### 6. Error Testing
- Tests validation errors
- Tests authorization errors (403)
- Tests not found errors (404)
- Tests conflict errors (409)

## Test Patterns Used

### 1. Setup Pattern
```typescript
beforeAll(async () => {
  app = await initializeTestApp();
});

beforeEach(async () => {
  await cleanupDatabase();
  user = await createAuthenticatedUser(app, testUsers.superadmin);
});

afterAll(async () => {
  await closeTestApp();
});
```

### 2. Authentication Pattern
```typescript
const response = await authenticatedGet(
  app,
  '/api/endpoint',
  user.token
).expect(200);
```

### 3. Database Seeding Pattern
```typescript
const team = await createTestTeam(app, { name: 'Engineering', slug: 'eng' });
const service = await createTestService(app, { name: 'API', teamId: team.id });
```

### 4. Permission Testing Pattern
```typescript
it('should allow admin to create', async () => {
  await authenticatedPost(app, '/endpoint', adminUser.token, data).expect(201);
});

it('should deny observer from creating', async () => {
  await authenticatedPost(app, '/endpoint', observerUser.token, data).expect(403);
});
```

## Known Issues & Next Steps

### Current Status
⚠️ **Tests are written but not yet executed** due to TypeScript compilation errors in the main codebase.

### Before Running Tests
1. Fix TypeScript compilation errors in `teams.service.ts` and other files
2. Ensure database schema is up to date with migrations
3. Create test database: `openalert_test`
4. Verify Docker services are running

### Next Steps
1. ✅ Integration tests written (COMPLETED)
2. ⏳ Fix TypeScript compilation errors
3. ⏳ Run integration test suite
4. ⏳ Fix any failing tests
5. ⏳ Achieve 60%+ test coverage
6. ⏳ Add CI/CD integration
7. ⏳ Document any remaining edge cases

## Documentation

- `apps/api/test/integration/README.md` - Quick start guide
- `apps/api/test/integration/TESTING_GUIDE.md` - Comprehensive testing guide
- This file - Implementation summary

## Success Criteria

✅ All critical API flows covered
✅ Tests for both success and error cases
✅ RBAC/permissions tested
✅ Clear test output
✅ Documentation on running tests
⏳ All tests passing consistently (pending TS fixes)
⏳ 60%+ test coverage achieved (pending test execution)

## Maintenance

### Adding New Tests
1. Create new test file in `test/integration/`
2. Follow existing patterns from other test files
3. Use helpers from `helpers/` directory
4. Add database cleanup if new tables
5. Update this summary document

### Updating Helpers
- Add new helper functions to appropriate helper file
- Update fixtures for new test data patterns
- Document helper usage in TESTING_GUIDE.md

### Coverage Reports
```bash
# Generate coverage report
npm run test:integration:cov

# View report
open apps/api/coverage/integration/lcov-report/index.html
```

## Contact & Support

For questions or issues with integration tests:
- Check `TESTING_GUIDE.md` for troubleshooting
- Review test file comments for implementation details
- See NestJS testing documentation for framework questions
