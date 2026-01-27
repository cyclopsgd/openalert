# OpenAlert - Claude Code Instructions

## Project Overview
OpenAlert is an open-source incident management platform (like PagerDuty/Opsgenie).

## Primary Documentation
**Read this first**: `docs/specs/OpenAlert-Implementation-Guide.md`

This contains the complete implementation plan with code examples, folder structure, and phase-by-phase instructions.

## Reference Documentation
Consult these for detailed specifications:
- `docs/reference/Node_js_Backend_Architecture.md` - Architecture patterns
- `docs/reference/Entra_ID___SSO_for_Node_js.md` - Authentication details
- `docs/reference/Integration_Webhook_Specifications.md` - Webhook formats
- `docs/reference/PagerDuty_Event_Orchestration_Deep_Dive.md` - Routing logic

## Tech Stack (Non-negotiable)
- Node.js 20+ with TypeScript (strict mode)
- NestJS with Fastify adapter
- PostgreSQL 15+ with Drizzle ORM
- Redis 7+ with BullMQ
- Socket.IO with Redis adapter
- Docker Compose for local development

## Development Workflow

### Before Starting Any Task
1. Ensure Docker containers are running: `docker-compose -f docker/docker-compose.yml up -d`
2. Run existing tests to confirm nothing is broken: `npm test`

### After Making Changes
1. Run linting: `npm run lint`
2. Run tests: `npm test`
3. If tests fail, fix them before moving on
4. Commit working code with descriptive messages

### Testing Requirements
- Write unit tests for all services
- Write integration tests for all API endpoints
- Aim for 80%+ coverage on critical paths
- Run tests after every significant change

## Code Style
- Use TypeScript strict mode
- Use async/await (no callbacks)
- Use dependency injection via NestJS
- Follow NestJS module structure
- Use Drizzle ORM for all database operations
- Use class-validator for DTO validation

## Error Handling
- Use NestJS exception filters
- Log errors with context (correlation IDs)
- Return consistent error response format

## Commands
```bash
# Start dependencies
docker-compose -f docker/docker-compose.yml up -d

# Development
npm run start:dev

# Database
npm run db:generate   # Generate migrations
npm run db:migrate    # Apply migrations
npm run db:studio     # Visual database browser

# Testing
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:cov      # Coverage report
npm run test:e2e      # End-to-end tests

# Linting
npm run lint          # Check for issues
npm run lint:fix      # Auto-fix issues
```

## Current Phase
**Phase 1: MVP Foundation**
Follow the implementation guide section by section.