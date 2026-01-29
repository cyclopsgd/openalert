# OpenAlert

> Open-source incident management platform for modern DevOps teams

OpenAlert is a production-ready incident management and on-call scheduling platform, designed as an open-source alternative to PagerDuty and Opsgenie. Built with Node.js, TypeScript, NestJS, and PostgreSQL.

## Features

### Core Incident Management
- **Alert Ingestion**: Receive alerts from Prometheus, Grafana, Azure Monitor, Datadog, and custom sources
- **Automatic Deduplication**: SHA-256 fingerprinting prevents duplicate alerts
- **Incident Creation**: Auto-create incidents from firing alerts
- **Multi-channel Notifications**: Email, SMS, voice, push, Slack, Microsoft Teams

### Escalation & On-Call
- **Escalation Policies**: Multi-level escalation with configurable delays
- **On-Call Scheduling**: Daily and weekly rotations with timezone support
- **Schedule Overrides**: Vacation coverage and temporary assignments
- **"Who's on call?"**: Real-time on-call resolution

### Real-time Updates
- **WebSocket Support**: Live incident and alert updates
- **JWT Authentication**: Secure WebSocket connections
- **Room-based Broadcasting**: Team and incident-specific updates

### Public Status Pages
- **Custom Branding**: Logos, custom domains, HTML customization
- **Component Status**: Track operational status of services
- **Incident Updates**: Public incident timeline with updates
- **Scheduled Maintenance**: Plan and communicate maintenance windows

### Production Ready
- **Health Checks**: Kubernetes liveness and readiness probes
- **Prometheus Metrics**: MTTA, MTTR, active incidents, and system metrics
- **Docker Support**: Production-optimized multi-stage builds
- **Authentication**: Azure Entra ID (Azure AD) via OAuth 2.0 + JWT

## Tech Stack

- **Runtime**: Node.js 20+ with TypeScript (strict mode)
- **Framework**: NestJS with Fastify adapter
- **Database**: PostgreSQL 15+ with Drizzle ORM
- **Cache/Queue**: Redis 7+ with BullMQ
- **Real-time**: Socket.IO with Redis adapter
- **Authentication**: Azure Entra ID (MSAL) + JWT
- **Containerization**: Docker + Docker Compose

## Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 15+ (or use Docker)
- Redis 7+ (or use Docker)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/openalert.git
   cd openalert
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start dependencies with Docker**
   ```bash
   docker-compose -f docker/docker-compose.yml up -d
   ```

4. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Run database migrations**
   ```bash
   cd apps/api
   npm run db:push
   ```

6. **Seed initial data** (optional)
   ```bash
   cat src/database/seeds/seed-initial-data.sql | docker exec -i openalert-postgres psql -U openalert -d openalert
   cat src/database/seeds/seed-escalation-policy.sql | docker exec -i openalert-postgres psql -U openalert -d openalert
   cat src/database/seeds/seed-schedules.sql | docker exec -i openalert-postgres psql -U openalert -d openalert
   cat src/database/seeds/seed-status-page.sql | docker exec -i openalert-postgres psql -U openalert -d openalert
   ```

7. **Start the development server**
   ```bash
   npm run start:dev
   ```

8. **Access the API**
   - API: http://localhost:3001
   - Swagger Docs: http://localhost:3001/api/docs
   - Health Check: http://localhost:3001/health
   - Metrics: http://localhost:3001/metrics

## Development

### Available Commands

```bash
# Development
npm run start:dev          # Start with hot reload

# Database
npm run db:generate        # Generate migrations
npm run db:push            # Push schema changes
npm run db:studio          # Open Drizzle Studio

# Testing
npm test                   # Run unit tests
npm run test:e2e           # Run e2e tests
npm run test:cov           # Coverage report

# Build
npm run build              # TypeScript compilation
npm run lint               # ESLint
npm run lint:fix           # Auto-fix linting issues
```

### Project Structure

```
openalert/
├── apps/
│   └── api/
│       ├── src/
│       │   ├── modules/          # Feature modules
│       │   │   ├── alerts/       # Alert ingestion
│       │   │   ├── incidents/    # Incident management
│       │   │   ├── schedules/    # On-call scheduling
│       │   │   ├── auth/         # Authentication
│       │   │   ├── users/        # User management
│       │   │   ├── status-pages/ # Public status pages
│       │   │   └── health/       # Health & metrics
│       │   ├── queues/           # BullMQ workers
│       │   ├── websocket/        # Socket.IO gateway
│       │   ├── database/         # Drizzle schema
│       │   ├── common/           # Shared utilities
│       │   └── main.ts           # Application entry
│       └── test/
│           ├── unit/             # Unit tests
│           ├── integration/      # Integration tests
│           └── e2e/              # E2E tests
├── docker/
│   ├── docker-compose.yml        # Development services
│   └── Dockerfile.production     # Production image
└── docs/                         # Documentation
```

## API Endpoints

### Webhooks (No Auth)
- `POST /webhooks/prometheus/:key` - Prometheus Alertmanager
- `POST /webhooks/grafana/:key` - Grafana Alerting
- `POST /webhooks/azure/:key` - Azure Monitor
- `POST /webhooks/datadog/:key` - Datadog
- `POST /webhooks/v1/:key` - Generic webhook

### Incidents (Auth Required)
- `GET /incidents` - List incidents
- `GET /incidents/:id` - Get incident
- `PATCH /incidents/:id/acknowledge` - Acknowledge
- `PATCH /incidents/:id/resolve` - Resolve

### Alerts (Auth Required)
- `GET /alerts` - List alerts
- `PATCH /alerts/:id/acknowledge` - Acknowledge alert
- `PATCH /alerts/:id/resolve` - Resolve alert

### Schedules (Auth Required)
- `GET /schedules/:id` - Get schedule
- `GET /schedules/:id/oncall` - Get current on-call user
- `POST /schedules` - Create schedule
- `POST /schedules/:id/rotations` - Add rotation

### Public Status Pages (No Auth)
- `GET /public/status/:slug` - Get status page
- `GET /public/status/:slug/incidents` - List incidents
- `GET /public/status/:slug/components` - List components

### Health & Metrics (No Auth)
- `GET /health` - Health check
- `GET /health/live` - Liveness probe
- `GET /health/ready` - Readiness probe
- `GET /metrics` - Prometheus metrics

### Authentication
- `GET /auth/login` - Azure AD OAuth login
- `GET /auth/callback` - OAuth callback
- `GET /auth/profile` - Get user profile
- `GET /auth/dev-token/:userId` - Dev token (non-production)

## Authentication

OpenAlert uses Azure Entra ID (Azure AD) for authentication via OAuth 2.0 / OpenID Connect.

### Setup Azure AD

1. Register an application in Azure Portal
2. Configure redirect URI: `http://localhost:3001/auth/callback`
3. Add Microsoft Graph permissions: `User.Read`, `openid`, `profile`, `email`
4. Create a client secret
5. Update `.env` with credentials

See [docs/auth-setup.md](docs/auth-setup.md) for detailed instructions.

### Development Mode

For local development without Azure AD:

```bash
# Get a development token
curl http://localhost:3001/auth/dev-token/1

# Use the token in requests
curl -H "Authorization: Bearer <token>" http://localhost:3001/incidents
```

**Note**: Dev tokens are only available in development mode.

## Production Deployment

### Docker

Build and run the production image:

```bash
# Build image
docker build -f docker/Dockerfile.production -t openalert-api:latest .

# Run container
docker run -d \
  -p 3001:3001 \
  --env-file .env \
  --name openalert-api \
  openalert-api:latest
```

### Environment Variables

Required for production:

```bash
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/openalert
REDIS_HOST=redis-host
REDIS_PORT=6379
JWT_SECRET=your-secure-random-secret
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
```

See [.env.example](.env.example) for all available options.

### Kubernetes

Health check endpoints for Kubernetes:

```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 3001
  initialDelaySeconds: 5
  periodSeconds: 30

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3001
  initialDelaySeconds: 5
  periodSeconds: 10
```

### Monitoring

Prometheus metrics available at `/metrics`:

- `openalert_incidents_total` - Incidents by status
- `openalert_active_incidents` - Active incidents count
- `openalert_critical_incidents` - Critical incidents
- `openalert_mtta_seconds` - Mean time to acknowledge
- `openalert_mttr_seconds` - Mean time to resolve

## Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- alerts.service.spec
npm test -- webhooks.spec
npm test -- incident-lifecycle.e2e-spec

# Generate coverage report
npm run test:cov
```

## Architecture

### Alert Flow
1. Monitoring system sends webhook → OpenAlert
2. Webhook transformer converts to standard format
3. Alert fingerprinted for deduplication
4. Incident created or updated
5. Escalation triggered if needed
6. Notifications queued via BullMQ
7. Real-time updates via WebSocket

### Escalation Flow
1. Incident created → Check escalation policy
2. Schedule escalation levels with delays
3. Resolve on-call users per level
4. Queue notifications for each target
5. Cancel escalation on acknowledge/resolve

### On-Call Resolution
1. Check for active overrides (highest priority)
2. Find active rotation for schedule
3. Calculate current on-call based on rotation type
4. Return on-call user with context

## Documentation

For comprehensive backend documentation:

- **[BACKEND-API.md](docs/BACKEND-API.md)** - Complete API reference with request/response examples
- **[BACKEND-DEEP-DIVE.md](docs/BACKEND-DEEP-DIVE.md)** - In-depth architecture, modules, database schema, and implementation details

## License

MIT License - see [LICENSE](LICENSE) for details

## Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting PRs.

## Support

- Documentation: [docs/](docs/)
- Issues: [GitHub Issues](https://github.com/yourusername/openalert/issues)
- Discussions: [GitHub Discussions](https://github.com/yourusername/openalert/discussions)

---

Built with ❤️ by the OpenAlert team
