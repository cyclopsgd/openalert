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
**Phase 3: Production Hardening** (Complete)
**Next Phase: Critical Fixes & Security Hardening**

## 🚨 CRITICAL ISSUES (Fix Before Production)

**Assessment Date:** 2026-02-03 (7 Parallel Agents)
**Full Report:** `docs/COMPREHENSIVE-BACKEND-ASSESSMENT.md`

### P0 - Production Blockers

1. **Status Page Tables Missing from Migration**
   - Migration has 15 tables, schema defines 19
   - Run: `npm run db:generate && npm run db:migrate`
   - Status: ❌ BLOCKS DEPLOYMENT

2. **No Authorization Enforcement**
   - ANY authenticated user can access ANY team's data
   - No team membership checks in controllers
   - Roles defined but never enforced
   - Status: ❌ CRITICAL SECURITY ISSUE

3. **JWT Token Exposed in URL**
   - Token sent in query parameter (visible in logs/history)
   - Must use HTTP-only cookies instead
   - Status: ❌ CRITICAL SECURITY ISSUE

4. **Test Coverage: 15% (Target: 80%)**
   - Only 5 test files for 44 source files
   - 18 critical services untested
   - Estimated: 115 hours to reach 80%
   - Status: ❌ QUALITY GATE

5. **Redis Adapter Not Configured for WebSocket**
   - Socket.IO using in-memory adapter
   - Cannot scale horizontally
   - Status: ❌ SCALABILITY BLOCKER

### P1 - High Priority

6. **All Notification Channels Are Stubs**
   - Email, SMS, voice, push, Slack, Teams = all TODO
   - Status: ⚠️ FEATURE INCOMPLETE

7. **Missing FK Constraint**
   - `services.escalation_policy_id` has no FK
   - Data integrity risk

8. **Only 1 DTO File**
   - Need ~20 for proper input validation
   - Security/validation gap

## Assessment Summary

**Overall Health Score: 6.5/10**

✅ **Strengths:**
- Clean NestJS architecture
- Comprehensive database design (24 tables)
- Modern tech stack properly implemented
- Real-time capabilities (Socket.IO)
- Multi-platform webhooks (Prometheus, Grafana, Azure, Datadog)

❌ **Critical Gaps:**
- Security vulnerabilities (no authorization, token exposure)
- Database migration out of sync
- Test coverage far below target
- Scalability blockers (Redis adapter)
- Incomplete notification system

**Verdict:** NOT production-ready. Needs 3 months of hardening.

## New Documentation

### Assessment Reports
- **`docs/COMPREHENSIVE-BACKEND-ASSESSMENT.md`** - Complete findings (all 7 agents)
- **`docs/analysis/Grafana-Backend-Analysis-for-OpenAlert.md`** - 10 features to adopt
- **`docs/GRAFANA-FEATURES-ROADMAP.md`** - Implementation plan

### Feature Branch
- **`feature/grafana-enhancements`** - Grafana-inspired features
  - Multi-dimensional alert instances
  - State machine (pending/recovering states)
  - Template-based notifications
  - Alert grouping and silencing
  - Provisioning API (config-as-code)

## Prometheus Alertmanager Integration

**Status:** Recommended for adoption (open source, Apache 2.0)

OpenAlert already has Prometheus webhook support. Consider adopting:
- Alert routing and grouping logic
- Silencing and inhibition rules
- High availability patterns

See Grafana analysis for implementation details.
---

## Current Development Status (2026-02-04)

### Phase: Final Polish & Testing  
**Branch:** `feature/frontend-improvements`

### Recent Completions
- ✅ All core features implemented (82/90 tasks)
- ✅ Fixed 122+ TypeScript compilation errors
- ✅ Backend compiles with 0 errors
- ✅ Frontend compiles with 0 errors
- ✅ Production deployment configs (Docker + K8s)
- ✅ Comprehensive documentation

### Active Work (Autonomous Session)
12 parallel agents currently working on:
- Unit tests for services, teams, metrics
- Integration test suite execution
- Frontend component tests
- Notification Preferences page
- Global search (Cmd+K)
- Keyboard shortcuts system
- Performance optimizations
- Bundle size optimization
- Mobile responsive improvements
- Alert routing tests

### Progress Tracking
- See `AUTONOMOUS-SESSION-STATUS.md` for real-time updates
- See `AUTONOMOUS-WORK-LOG.md` for session log
- See `SESSION-SUMMARY.md` for historical progress

### Login Credentials (Development)
- Email: `test@openalert.com`
- Password: `password123`
- Role: Superadmin

### Services Status
- Backend: http://localhost:3001 ✅
- Frontend: http://localhost:5175 ✅
- PostgreSQL: Running via Docker ✅
- Redis: Running via Docker ✅

### Target: 90/90 Tasks (100% Complete)
**Estimated:** End of current session
