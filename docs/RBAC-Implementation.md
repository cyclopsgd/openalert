# Role-Based Access Control (RBAC) Implementation

## Overview

OpenAlert now implements comprehensive Role-Based Access Control (RBAC) with both global user roles and team-specific roles.

## Role Hierarchy

### Global Roles

1. **Superadmin** (Purple Badge)
   - Full system access
   - Manage all teams, users, and settings
   - Change user roles
   - Cannot be changed or deleted (must have at least one)

2. **Admin** (Blue Badge)
   - Manage their teams
   - Add/remove users from teams
   - Configure team settings, services, and integrations
   - Cannot change user roles

3. **Responder** (Green Badge)
   - Acknowledge and resolve incidents
   - View schedules and on-call information
   - Modify schedules they're part of
   - Cannot configure system settings

4. **Observer** (Gray Badge)
   - Read-only access
   - View incidents, alerts, and schedules
   - Cannot acknowledge incidents or modify anything

### Team Roles

1. **Team Admin**
   - Manage team settings
   - Add/remove team members
   - Configure services and escalation policies

2. **Member**
   - Work on incidents
   - Modify schedules
   - Standard team access

3. **Observer**
   - View team data only
   - No modification permissions

## Database Schema

### Users Table
```sql
ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'responder' NOT NULL;
CREATE INDEX users_role_idx ON users(role);
```

### Team Members Table
```sql
ALTER TABLE team_members RENAME COLUMN role TO team_role;
-- team_role values: team_admin, member, observer
```

## Backend Implementation

### Guards

1. **RolesGuard** (`apps/api/src/common/guards/roles.guard.ts`)
   - Checks global user role
   - Used with `@RequireRole()` decorator

2. **TeamMemberGuard** (`apps/api/src/common/guards/team-member.guard.ts`)
   - Verifies team membership
   - Checks team-specific roles
   - Used with `@RequireTeamRoles()` and `@TeamResource()` decorators

### Decorators

1. **@RequireRole(...roles)** - Require specific global roles
2. **@RequireTeamRoles([...roles])** - Require specific team roles
3. **@TeamResource(type)** - Specify resource type for team access

### Permission Matrix

Located in `apps/api/src/common/constants/permissions.ts`

Key permissions:
- `settings.view` - View system settings (admin+)
- `settings.edit` - Edit system settings (superadmin only)
- `users.view` - View users (admin+)
- `users.change_role` - Change user roles (superadmin only)
- `incidents.acknowledge` - Acknowledge incidents (responder+)
- `incidents.resolve` - Resolve incidents (responder+)
- `escalation.edit` - Edit escalation policies (admin+)

## Frontend Implementation

### Permission Hook

```typescript
import { usePermissions } from '@/hooks/usePermissions'

function MyComponent() {
  const { hasPermission, isAdmin, isResponder } = usePermissions()

  return (
    <>
      {hasPermission('settings.edit') && (
        <Button>Edit Settings</Button>
      )}

      {isResponder() && (
        <Button>Acknowledge Incident</Button>
      )}
    </>
  )
}
```

### Role Badge Component

```typescript
import { RoleBadge } from '@/components/ui/RoleBadge'

<RoleBadge role={user.role} />
```

### Navigation Protection

The Sidebar component automatically filters navigation items based on user permissions. Users only see menu items they have access to.

## Setup

### 1. Run Migration

```bash
cd apps/api
npm run db:push
```

Or manually run the migration:
```bash
psql -d openalert -f apps/api/src/database/migrations/0006_add_rbac.sql
```

### 2. Create Initial Superadmin

The migration automatically promotes the first user to superadmin. To manually ensure a superadmin exists:

```bash
npm run db:ensure-superadmin
```

### 3. Assign Roles

Use the User Management page in the UI:
1. Navigate to Settings > User Management
2. Click on a user
3. Click "Change Role"
4. Select new role and save

Or via API:
```bash
curl -X PATCH http://localhost:3000/api/users/1/role \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}'
```

## User Experience

### Role Badges
- Color-coded badges indicate user roles throughout the UI
- Hover over role badges to see role descriptions

### Permission Errors
When a user attempts an unauthorized action:
- Backend returns 403 Forbidden with descriptive message
- Frontend shows toast notification
- Buttons for unauthorized actions are hidden

### Conditional UI
- Navigation items hide based on permissions
- Action buttons disappear if user lacks permission
- Settings pages only visible to admins

## Security Considerations

1. **Backend Enforcement**: All permission checks happen on the backend. Frontend hiding is for UX only.

2. **Superadmin Protection**: Cannot delete or demote the last superadmin.

3. **Self-Modification Prevention**: Users cannot change their own role.

4. **Team Context**: Team-specific permissions are checked on every resource access.

5. **Role Hierarchy**: Higher roles include all lower role permissions.

## API Endpoints

### Get Users (Admin+)
```
GET /api/users?role=admin&isActive=true
```

### Change User Role (Superadmin only)
```
PATCH /api/users/:id/role
Body: { "role": "admin" }
```

### Get User Teams (Admin+)
```
GET /api/users/:id/teams
```

## Testing

### Unit Tests
Test role guards and permission checking:
```bash
npm test -- roles.guard.spec.ts
npm test -- permissions.service.spec.ts
```

### Integration Tests
Test protected endpoints:
```bash
npm test -- users.controller.e2e.spec.ts
```

### Manual Testing Scenarios

1. **Observer cannot acknowledge incidents**
   - Login as observer
   - Try to acknowledge incident
   - Should see error message

2. **Admin cannot change roles**
   - Login as admin
   - Try to change another user's role
   - Should not see role change option

3. **Superadmin can do everything**
   - Login as superadmin
   - Verify all features accessible

## Troubleshooting

### Issue: No superadmin exists
**Solution**: Run `npm run db:ensure-superadmin`

### Issue: User sees 403 errors
**Solution**: Check user role in database and ensure they have required permissions

### Issue: Role changes not taking effect
**Solution**: User needs to log out and log back in to refresh token with new role

### Issue: Migration fails
**Solution**: Check if columns already exist. The migration includes IF NOT EXISTS checks.

## Future Enhancements

1. **Custom Roles**: Allow defining custom roles with specific permission sets
2. **Role Inheritance**: More complex role hierarchies
3. **Temporary Role Elevation**: Time-limited permission grants
4. **Audit Logging**: Track all role changes and permission checks
5. **Team-Specific Permissions**: More granular team-level permissions
