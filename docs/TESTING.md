# OpenAlert Testing Guide

**Last Updated:** 2026-02-03

This document covers testing strategies, procedures, and best practices for OpenAlert.

---

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Backend Testing](#backend-testing)
3. [Frontend Testing](#frontend-testing)
4. [Integration Testing](#integration-testing)
5. [E2E Testing](#e2e-testing)
6. [Manual Testing](#manual-testing)
7. [Performance Testing](#performance-testing)
8. [Security Testing](#security-testing)

---

## Testing Philosophy

### Testing Pyramid

```
    /\
   /E2E\        ← Few, high-value end-to-end tests
  /------\
 /  Int   \     ← Integration tests for API endpoints
/-----------\
|   Unit    |   ← Many unit tests for business logic
|-----------|
```

**Target Coverage:**
- Backend: 70%+ code coverage
- Frontend: 60%+ code coverage
- Critical paths: 90%+ coverage

**Principles:**
1. Write tests before or alongside implementation (TDD preferred)
2. Test behavior, not implementation details
3. Keep tests fast and deterministic
4. Mock external dependencies
5. Test edge cases and error conditions

---

## Backend Testing

### Unit Tests

**Location:** `apps/api/test/unit/`

**Command:**
```bash
cd apps/api
npm test
```

**Coverage Report:**
```bash
npm run test:cov
```

**Watch Mode:**
```bash
npm run test:watch
```

### Current Test Files

#### 1. `auth.service.spec.ts`
Tests for authentication service:
- User login with valid credentials
- User login with invalid password
- User login with non-existent email
- Token generation
- Password hashing

**Example:**
```typescript
describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
          },
        },
        // ... other providers
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should generate valid JWT token', async () => {
    const user = { id: 1, email: 'test@test.com', name: 'Test' };
    const token = await service.generateToken(user);
    expect(token).toBeDefined();
  });
});
```

#### 2. `team-member.guard.spec.ts`
Tests for authorization guard:
- Allow access for team members
- Deny access for non-members
- Handle missing team context
- Handle invalid incident IDs

### Writing New Unit Tests

**Template:**
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { YourService } from './your.service';

describe('YourService', () => {
  let service: YourService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [YourService],
    }).compile();

    service = module.get<YourService>(YourService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('yourMethod', () => {
    it('should return expected result', async () => {
      const result = await service.yourMethod();
      expect(result).toEqual(expectedValue);
    });

    it('should throw error on invalid input', async () => {
      await expect(service.yourMethod(null)).rejects.toThrow();
    });
  });
});
```

### Integration Tests

**Location:** `apps/api/test/integration/` (to be created)

**Command:**
```bash
npm run test:e2e
```

**Purpose:** Test complete request/response cycles through API endpoints

**Example:**
```typescript
describe('Incidents API', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Login to get token
    const response = await request(app.getHttpServer())
      .post('/auth/login/local')
      .send({ email: 'test@test.com', password: 'password123' });

    authToken = response.body.accessToken;
  });

  it('/incidents (GET) should return list', async () => {
    return request(app.getHttpServer())
      .get('/incidents')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });

  it('/incidents/:id (GET) should return incident', async () => {
    return request(app.getHttpServer())
      .get('/incidents/1')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);
  });

  it('/incidents/:id/acknowledge (PATCH) should acknowledge', async () => {
    return request(app.getHttpServer())
      .patch('/incidents/1/acknowledge')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });
});
```

### Test Database

**Setup:**
1. Create test database: `openalert_test`
2. Use `.env.test` for test configuration
3. Run migrations before tests
4. Clean up after each test

**Configuration:**
```typescript
// test/setup.ts
beforeAll(async () => {
  // Apply migrations
  await db.migrate.latest();
});

afterEach(async () => {
  // Clean up data
  await db.raw('TRUNCATE TABLE incidents CASCADE');
});

afterAll(async () => {
  await db.destroy();
});
```

---

## Frontend Testing

### Component Tests

**Location:** `apps/web/src/**/__tests__/`

**Framework:** React Testing Library + Jest

**Command:**
```bash
cd apps/web
npm test
```

**Example: Login Component**
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Login } from '../Login';

describe('Login Component', () => {
  it('renders login form', () => {
    render(<Login />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('submits form with valid credentials', async () => {
    const mockLogin = jest.fn();
    render(<Login onLogin={mockLogin} />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@test.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalled();
    });
  });

  it('shows error message on invalid credentials', async () => {
    render(<Login />);

    // Submit with empty fields
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/required/i)).toBeInTheDocument();
    });
  });

  it('toggles between login and registration', () => {
    render(<Login />);

    fireEvent.click(screen.getByText(/register/i));
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/sign in/i));
    expect(screen.queryByLabelText(/full name/i)).not.toBeInTheDocument();
  });
});
```

### Hook Tests

**Example: useIncidents Hook**
```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useIncidents } from '../useIncidents';

const createWrapper = () => {
  const queryClient = new QueryClient();
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useIncidents Hook', () => {
  it('fetches incidents on mount', async () => {
    const { result } = renderHook(() => useIncidents(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeDefined();
  });

  it('handles errors gracefully', async () => {
    // Mock API to return error
    jest.spyOn(apiClient, 'get').mockRejectedValue(new Error('API Error'));

    const { result } = renderHook(() => useIncidents(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.error).toBeDefined();
    });
  });
});
```

### Snapshot Tests

**Use sparingly** - only for stable, visual components

```typescript
import { render } from '@testing-library/react';
import { Badge } from '../Badge';

describe('Badge Snapshots', () => {
  it('matches snapshot for critical severity', () => {
    const { container } = render(<Badge severity="critical">Critical</Badge>);
    expect(container.firstChild).toMatchSnapshot();
  });
});
```

---

## E2E Testing

### Playwright Setup

**Location:** `apps/web/e2e/`

**Command:**
```bash
cd apps/web
npx playwright test
```

**Configuration:** `playwright.config.ts`
```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
```

### Example E2E Test

```typescript
import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('complete registration and login flow', async ({ page }) => {
    // Navigate to login
    await page.goto('/login');

    // Click register
    await page.click('text=Register');

    // Fill registration form
    await page.fill('input[name="name"]', 'E2E Test User');
    await page.fill('input[name="email"]', 'e2e@test.com');
    await page.fill('input[name="password"]', 'password123');

    // Submit
    await page.click('button:has-text("Create Account")');

    // Should redirect to dashboard
    await expect(page).toHaveURL('/');
    await expect(page.locator('text=Dashboard')).toBeVisible();

    // Logout
    await page.click('[data-testid="user-avatar"]');
    await page.click('text=Logout');

    // Should redirect to login
    await expect(page).toHaveURL('/login');

    // Login again
    await page.fill('input[name="email"]', 'e2e@test.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button:has-text("Sign In")');

    // Should be on dashboard
    await expect(page).toHaveURL('/');
  });

  test('handles invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[name="email"]', 'wrong@test.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button:has-text("Sign In")');

    // Should show error
    await expect(page.locator('text=Invalid email or password')).toBeVisible();
  });
});

test.describe('Incident Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@test.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button:has-text("Sign In")');
    await page.waitForURL('/');
  });

  test('view incidents list', async ({ page }) => {
    await page.click('text=Incidents');
    await expect(page).toHaveURL('/incidents');

    // Wait for incidents to load
    await page.waitForSelector('[data-testid="incident-card"]');
  });

  test('acknowledge incident', async ({ page }) => {
    await page.goto('/incidents');

    // Click first incident
    await page.click('[data-testid="incident-card"]:first-child');

    // Click acknowledge button
    await page.click('button:has-text("Acknowledge")');

    // Should show acknowledged status
    await expect(page.locator('text=Acknowledged')).toBeVisible();
  });
});
```

---

## Manual Testing

### Test Scenarios

#### 1. Authentication
- [ ] Register new user
- [ ] Login with valid credentials
- [ ] Login with invalid credentials
- [ ] Logout and verify session cleared
- [ ] Token expiry handling
- [ ] SSO authentication (if configured)

#### 2. Incidents
- [ ] View incidents list
- [ ] Filter incidents by status
- [ ] Filter incidents by severity
- [ ] Search incidents by keyword
- [ ] View incident details
- [ ] Acknowledge incident
- [ ] Resolve incident
- [ ] Real-time incident updates via WebSocket

#### 3. Alerts
- [ ] View alerts list
- [ ] Acknowledge alert
- [ ] Resolve alert
- [ ] View alert details
- [ ] Link alert to incident

#### 4. UI/UX
- [ ] Dark mode toggle
- [ ] Light mode readability
- [ ] Responsive design on mobile
- [ ] User dropdown menu
- [ ] Navigation between pages
- [ ] Loading states
- [ ] Error states
- [ ] Empty states

#### 5. Performance
- [ ] Page load time < 2s
- [ ] API response time < 500ms
- [ ] WebSocket reconnection
- [ ] Large list rendering (1000+ items)

---

## Performance Testing

### Load Testing with k6

**Script:** `test/load/scenarios.js`
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '1m', target: 50 },  // Ramp up
    { duration: '3m', target: 50 },  // Stay at 50 users
    { duration: '1m', target: 0 },   // Ramp down
  ],
};

export default function () {
  // Login
  let loginRes = http.post('http://localhost:3001/auth/login/local', {
    email: 'test@test.com',
    password: 'password123',
  });

  check(loginRes, {
    'login successful': (r) => r.status === 200,
  });

  let token = loginRes.json('accessToken');

  // List incidents
  let incidentsRes = http.get('http://localhost:3001/incidents', {
    headers: { Authorization: `Bearer ${token}` },
  });

  check(incidentsRes, {
    'incidents fetched': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

**Run:**
```bash
k6 run test/load/scenarios.js
```

---

## Security Testing

### Checklist

- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (input sanitization)
- [ ] CSRF protection
- [ ] Rate limiting on sensitive endpoints
- [ ] Password hashing (bcrypt)
- [ ] JWT token validation
- [ ] Authorization checks
- [ ] Secure headers (Helmet.js)
- [ ] Environment variable protection
- [ ] Dependency vulnerability scanning

### Tools

**npm audit:**
```bash
npm audit
npm audit fix
```

**Snyk:**
```bash
npx snyk test
```

**OWASP ZAP:**
- Run automated security scan against staging environment

---

## Continuous Integration

### GitHub Actions Workflow

```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run test:cov
      - run: npm run test:e2e

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run test
      - run: npx playwright test
```

---

## Test Data Management

### Database Seeding

**Location:** `apps/api/src/database/seeds/`

**Run seeds:**
```bash
npm run db:seed
```

**Example seed:**
```typescript
export async function seed(db: Database) {
  // Create test users
  await db.insert(users).values([
    {
      email: 'admin@test.com',
      name: 'Admin User',
      passwordHash: await bcrypt.hash('password123', 10),
    },
  ]);

  // Create test services
  await db.insert(services).values([
    { name: 'Web API', slug: 'web-api', teamId: 1 },
  ]);

  // Create test incidents
  await db.insert(incidents).values([
    {
      title: 'High CPU Usage',
      status: 'triggered',
      severity: 'high',
      serviceId: 1,
    },
  ]);
}
```

---

## Coverage Reports

### Viewing Coverage

**Backend:**
```bash
cd apps/api
npm run test:cov
open coverage/lcov-report/index.html
```

**Frontend:**
```bash
cd apps/web
npm run test:coverage
open coverage/lcov-report/index.html
```

### Coverage Goals

| Module | Target | Current |
|--------|--------|---------|
| Auth Services | 90% | 75% |
| Incident Services | 80% | 30% |
| API Controllers | 70% | 40% |
| Guards | 85% | 60% |
| Frontend Components | 60% | 0% |
| Frontend Hooks | 70% | 0% |

---

## Best Practices

1. **Test Naming:** Use descriptive names (should/it statements)
2. **Arrange-Act-Assert:** Structure tests clearly
3. **One Assertion Per Test:** Keep tests focused
4. **Mock External Dependencies:** Don't hit real APIs in tests
5. **Clean Up:** Reset state after each test
6. **Fast Tests:** Keep unit tests < 100ms
7. **Deterministic:** Tests should pass consistently
8. **Independent:** Tests shouldn't depend on each other
9. **Maintainable:** Update tests when requirements change
10. **Coverage ≠ Quality:** 100% coverage doesn't mean bug-free

---

## Resources

- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Docs](https://playwright.dev/)
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
- [k6 Load Testing](https://k6.io/docs/)
