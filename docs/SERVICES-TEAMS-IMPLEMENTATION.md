# Services Management and Team Management Implementation

## Overview
This document details the implementation of Services Management with dependency tracking and Team Management features for OpenAlert.

## Part 1: Services Catalog with Dependencies

### Database Schema Enhancements

#### New Enum: `service_status`
```sql
CREATE TYPE service_status AS ENUM ('operational', 'degraded', 'outage', 'maintenance');
```

#### Enhanced Services Table
Added `status` column to track service health:
```sql
ALTER TABLE services ADD COLUMN status service_status DEFAULT 'operational' NOT NULL;
```

#### New Table: `service_dependencies`
Tracks which services depend on others:
```sql
CREATE TABLE service_dependencies (
  id SERIAL PRIMARY KEY,
  service_id INT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  depends_on_service_id INT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(service_id, depends_on_service_id)
);
```

### Backend Implementation

#### Services Module (`apps/api/src/modules/services/`)

**DTOs:**
- `CreateServiceDto` - Validates service creation with dependency IDs
- `UpdateServiceDto` - Validates service updates
- `AddDependencyDto` - Validates adding individual dependencies

**Service Layer Features:**
- Full CRUD operations for services
- Dependency management with circular dependency prevention
- Service health calculation based on:
  - Active incidents (critical, high severity)
  - Dependency status
  - Service status
- Dependency graph generation for visualization
- Automatic slug generation from service name
- Cascade delete handling

**Controller Endpoints:**
```
POST   /services                        - Create service
GET    /services                        - List all services (with ?teamId filter)
GET    /services/:id                    - Get service with dependencies and incidents
PUT    /services/:id                    - Update service
DELETE /services/:id                    - Delete service
POST   /services/:id/dependencies       - Add dependency
DELETE /services/:id/dependencies/:id   - Remove dependency
GET    /services/:id/health             - Get service health metrics
GET    /services/:id/dependency-graph   - Get dependency visualization data
```

### Frontend Implementation

#### Services Catalog Page (`/services`)
**File:** `apps/web/src/pages/Services.tsx`

Features:
- Grid view of all services with status badges
- Real-time status indicators (Operational, Degraded, Outage, Maintenance)
- Active incident count per service
- Dependency count per service
- Search by service name or description
- Filter by status
- Create service button
- Mobile responsive design

#### Service Detail Page (`/services/:id`)
**File:** `apps/web/src/pages/ServiceDetail.tsx`

Features:
- Service header with name, description, and status badge
- Edit and Delete buttons
- Tabbed interface:
  - **Overview Tab:**
    - Active incidents list
    - Quick navigation to incidents
  - **Dependencies Tab:**
    - List of services this service depends on
    - List of services that depend on this service (dependents)
    - Remove dependency functionality
    - Visual status of each dependency
  - **Incidents Tab:**
    - Link to filtered incidents view
  - **Settings Tab:**
    - Service metadata (ID, slug, team, escalation policy)
- Delete confirmation modal
- Mobile responsive

#### Service Form Page (`/services/new` and `/services/:id/edit`)
**File:** `apps/web/src/pages/ServiceForm.tsx`

Features:
- Service name with auto-slug generation
- Custom slug override option
- Description textarea
- Team selector (required)
- Escalation policy selector (optional)
- Status selector (4 options)
- Multi-select dependency picker
- Validation:
  - Prevents self-dependency
  - Client-side circular dependency warning
  - Required field validation
- Mobile responsive form

### Key Features

#### Circular Dependency Prevention
The backend implements a breadth-first search algorithm to detect circular dependencies:
```typescript
private async wouldCreateCircularDependency(
  serviceId: number,
  dependsOnServiceId: number,
): Promise<boolean> {
  // BFS to check if dependsOnServiceId eventually depends on serviceId
}
```

#### Service Health Calculation
Health is calculated based on:
1. Service status (outage = critical health)
2. Active incidents (critical/high severity)
3. Dependency health (if dependencies are down)

Returns:
- Health level: 'healthy', 'warning', 'degraded', 'critical', 'maintenance'
- Health score: 0-100
- Detailed metrics

## Part 2: Team Management

### Backend Implementation

#### Teams Module (`apps/api/src/modules/teams/`)

**DTOs:**
- `CreateTeamDto` - Validates team creation
- `UpdateTeamDto` - Validates team updates
- `AddMemberDto` - Validates adding members with role
- `UpdateMemberRoleDto` - Validates role changes

**Service Layer Features:**
- Full CRUD operations for teams
- Member management (add, remove, change role)
- Member and service count aggregation
- Validation:
  - Prevents deletion of teams with active services
  - Prevents removing the last admin from a team
  - Prevents demoting the last admin
- Automatic slug generation

**Controller Endpoints:**
```
POST   /teams                           - Create team
GET    /teams                           - List all teams with counts
GET    /teams/:id                       - Get team with members and services
PUT    /teams/:id                       - Update team
DELETE /teams/:id                       - Delete team
POST   /teams/:id/members               - Add member to team
DELETE /teams/:id/members/:userId       - Remove member from team
PUT    /teams/:id/members/:userId/role  - Change member role
```

### Frontend Implementation

#### Team Management Page (`/settings/teams`)
**File:** `apps/web/src/pages/settings/TeamManagement.tsx`

Features:
- **Two-panel layout:**
  - Left panel: Team list with member/service counts
  - Right panel: Team detail view

- **Team List:**
  - Shows all teams
  - Displays member count and service count
  - Click to select and view details

- **Team Detail View:**
  - Team name and description
  - Member count and service count metrics
  - Delete team button

- **Member Management:**
  - List of all team members
  - User name and email
  - Role selector (Team Admin, Member, Observer)
  - Role icons (Crown for admin, User for member, Eye for observer)
  - Add member button
  - Remove member button

- **Associated Services:**
  - List of services owned by the team

- **Create Team Modal:**
  - Team name (required, auto-generates slug)
  - Description (optional)
  - Form validation

- **Add Member Modal:**
  - User selector (shows only users not in team)
  - Role selector
  - Form validation

### Navigation Updates

#### Sidebar Navigation
Added Services link to the main sidebar:
```typescript
{
  name: 'Services',
  href: '/services',
  icon: Server,
  permission: 'services.view',
}
```

#### Settings Navigation
Team Management is now accessible at `/settings/teams` (previously showed "Teams coming soon").

### Routing

**Added Routes in App.tsx:**
```typescript
// Services routes
<Route path="services" element={<Services />} />
<Route path="services/new" element={<ServiceForm />} />
<Route path="services/:id" element={<ServiceDetail />} />
<Route path="services/:id/edit" element={<ServiceForm />} />

// Teams route
<Route path="settings/teams" element={<TeamManagement />} />
```

## Permissions

All new features respect the existing RBAC system:

**Services Permissions:**
- `services.view` - View services (all roles)
- `services.create` - Create services (superadmin, admin)
- `services.edit` - Edit services (superadmin, admin)
- `services.delete` - Delete services (superadmin, admin)

**Teams Permissions:**
- `teams.view` - View teams (all roles)
- `teams.create` - Create teams (superadmin, admin)
- `teams.edit` - Edit teams (superadmin, admin)
- `teams.delete` - Delete teams (superadmin)
- `teams.manage_members` - Add/remove members (superadmin, admin)

## Database Migration

Migration file: `apps/api/src/database/migrations/0004_premium_barracuda.sql`

Includes:
- service_status enum creation
- services.status column addition
- service_dependencies table creation
- Indexes for performance

## Testing Recommendations

### Backend Tests (Task #64 - Pending)
```typescript
// Services module
- Test CRUD operations
- Test circular dependency detection
- Test dependency graph generation
- Test service health calculation
- Test cascade delete behavior

// Teams module
- Test CRUD operations
- Test member management
- Test role change validation
- Test last admin protection
- Test team with services deletion prevention
```

### Frontend Tests
```typescript
// Services pages
- Test service catalog rendering
- Test service detail tabs
- Test dependency visualization
- Test service form validation
- Test dependency selection

// Team Management page
- Test team list rendering
- Test member management
- Test role changes
- Test create team modal
- Test add member modal
```

### Integration Tests
```typescript
// End-to-end scenarios
- Create service → add dependencies → verify graph
- Create team → add members → create service for team
- Delete service with dependencies
- Delete team with services (should fail)
- Change member roles → verify permissions
```

## Files Created

### Backend
```
apps/api/src/modules/services/
├── dto/
│   ├── create-service.dto.ts
│   ├── update-service.dto.ts
│   └── add-dependency.dto.ts
├── services.controller.ts
├── services.service.ts
└── services.module.ts

apps/api/src/modules/teams/
├── dto/
│   ├── create-team.dto.ts
│   ├── update-team.dto.ts
│   ├── add-member.dto.ts
│   └── update-member-role.dto.ts
├── teams.controller.ts
├── teams.service.ts
└── teams.module.ts
```

### Frontend
```
apps/web/src/pages/
├── Services.tsx
├── ServiceDetail.tsx
├── ServiceForm.tsx
└── settings/
    └── TeamManagement.tsx
```

### Database
```
apps/api/src/database/
├── schema.ts (enhanced)
└── migrations/
    └── 0004_premium_barracuda.sql
```

## Usage Examples

### Creating a Service with Dependencies
1. Navigate to `/services`
2. Click "Create Service"
3. Fill in name, description, team
4. Select dependencies from the list
5. System validates no circular dependencies
6. Service is created

### Managing Team Members
1. Navigate to `/settings/teams`
2. Select a team from the list
3. Click "Add Member"
4. Select user and assign role
5. Member is added to team
6. Change role using dropdown
7. Remove member with trash icon

### Viewing Service Dependencies
1. Navigate to `/services/:id`
2. Click "Dependencies" tab
3. View services this service depends on
4. View services that depend on this service
5. Remove dependencies if needed

## Future Enhancements

1. **Dependency Graph Visualization:**
   - Implement React Flow or similar library
   - Visual graph of service dependencies
   - Interactive node navigation

2. **Service Health Dashboard:**
   - Real-time health monitoring
   - Historical health metrics
   - Alerts on dependency failures

3. **Team Hierarchy:**
   - Parent/child team relationships
   - Inherited permissions
   - Cross-team service sharing

4. **Service Templates:**
   - Pre-configured service templates
   - Bulk service creation
   - Template marketplace

5. **Advanced Filtering:**
   - Filter by team in service catalog
   - Filter by health status
   - Save filter presets

## Related Documentation

- `docs/reference/Node_js_Backend_Architecture.md` - Architecture patterns used
- `docs/RBAC-Implementation.md` - Role-based access control details
- `apps/api/src/database/schema.ts` - Complete database schema

## Commit
```
feat: implement Services Management and Team Management

Part 1: Services Catalog with Dependencies
Part 2: Team Management

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```
