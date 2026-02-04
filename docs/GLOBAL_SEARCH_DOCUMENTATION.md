# Global Search Feature Documentation

## Overview

The Global Search feature (Task #88) provides a unified search experience across all major entities in OpenAlert. Users can quickly find incidents, alerts, services, teams, and users through a modal search interface accessible via keyboard shortcut or header icon.

## Features

### Frontend (React)

**Component Location**: `apps/web/src/components/GlobalSearch.tsx`

#### Key Features:
1. **Keyboard Shortcut**: `Cmd/Ctrl + K` to open search modal
2. **Click to Search**: Search icon in header navigation
3. **Real-time Search**: Debounced search with 300ms delay
4. **Keyboard Navigation**:
   - Arrow keys (↑/↓) to navigate results
   - Enter to select a result
   - ESC to close the modal
5. **Categorized Results**: Results grouped by type (Incidents, Alerts, Services, Teams, Users)
6. **Visual Feedback**: Loading states, empty states, and no results states
7. **Responsive Design**: Modal overlay with clean, focused UI

#### Search Scope:
- **Incidents**: Search by incident number (exact match) or title (partial match)
- **Alerts**: Search by title or description
- **Services**: Search by name or description
- **Teams**: Search by name or description
- **Users**: Search by name or email

#### Navigation:
- **Incidents**: Navigates to `/incidents/:id`
- **Alerts**: Navigates to `/alerts` (list view)
- **Services**: Navigates to `/services/:id`
- **Teams**: Navigates to `/settings/teams`
- **Users**: Navigates to `/settings/users`

### Backend (NestJS)

**Module Location**: `apps/api/src/modules/search/`

#### Files:
- `search.service.ts`: Core search logic with database queries
- `search.controller.ts`: REST API endpoint
- `search.module.ts`: NestJS module definition

#### API Endpoint:

```
GET /search?q=<query>&limit=<limit>
```

**Query Parameters**:
- `q` (required): Search query string (minimum 2 characters)
- `limit` (optional): Maximum results per category (default: 10)

**Response Format**:
```json
{
  "incidents": [
    {
      "id": 1,
      "incidentNumber": 123,
      "title": "API Gateway Error",
      "status": "triggered",
      "severity": "critical",
      "serviceId": 5,
      "triggeredAt": "2025-01-01T10:00:00Z"
    }
  ],
  "alerts": [
    {
      "id": 1,
      "title": "High CPU Usage",
      "description": "CPU usage above 90%",
      "status": "firing",
      "severity": "high",
      "firedAt": "2025-01-01T10:00:00Z"
    }
  ],
  "services": [
    {
      "id": 1,
      "name": "API Gateway",
      "slug": "api-gateway",
      "description": "Main API Gateway",
      "teamId": 1
    }
  ],
  "teams": [
    {
      "id": 1,
      "name": "Platform Team",
      "slug": "platform-team",
      "description": "Infrastructure and platform services"
    }
  ],
  "users": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john.doe@example.com",
      "role": "admin"
    }
  ]
}
```

#### Search Implementation Details:

1. **Parallel Execution**: All searches run in parallel using `Promise.all()` for optimal performance
2. **Case-Insensitive**: Uses PostgreSQL `ILIKE` for case-insensitive matching
3. **Incident Number Search**: Exact match when query is numeric
4. **Partial Matching**: Supports partial matching on text fields (title, description, name, email)
5. **Result Limiting**: Configurable limit per category to prevent overwhelming results
6. **Error Handling**: Graceful error handling with empty arrays on failure

## Usage

### For End Users:

1. **Open Search**:
   - Press `Cmd + K` (Mac) or `Ctrl + K` (Windows/Linux)
   - Or click the search icon in the header

2. **Search**:
   - Type at least 2 characters
   - Results appear automatically (300ms debounce)

3. **Navigate Results**:
   - Use arrow keys (↑/↓) to move through results
   - Press Enter to open selected result
   - Or click any result with mouse

4. **Close Search**:
   - Press ESC
   - Or click outside the modal

### For Developers:

#### Adding the Search to a New Component:

```tsx
import { GlobalSearch, useGlobalSearchShortcut } from '@/components/GlobalSearch'
import { useState } from 'react'

function MyComponent() {
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  // Register keyboard shortcut
  useGlobalSearchShortcut(() => setIsSearchOpen(true))

  return (
    <>
      <button onClick={() => setIsSearchOpen(true)}>
        Search
      </button>

      <GlobalSearch
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </>
  )
}
```

#### Extending the Search Backend:

To add a new entity type to search:

1. Add the entity interface to `SearchResult` in `search.service.ts`
2. Create a new `searchEntityName()` method
3. Add the method to the `Promise.all()` array in `search()`
4. Update the response type in the controller

Example:
```typescript
// In search.service.ts
private async searchProjects(query: string, limit: number) {
  try {
    const result = await this.db.db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
      })
      .from(projects)
      .where(sql`${projects.name} ILIKE ${`%${query}%`}`)
      .limit(limit);
    return result;
  } catch (error) {
    this.logger.error('Error searching projects:', error);
    return [];
  }
}
```

## Security

- **Authentication Required**: All search endpoints require JWT authentication
- **Authorization**: Users can only search within their accessible scope (team-based access control can be added if needed)
- **Rate Limiting**: Global API rate limiting applies (60 requests/minute)
- **SQL Injection Protection**: Uses parameterized queries via Drizzle ORM

## Performance Considerations

1. **Debouncing**: Frontend debounces input by 300ms to reduce API calls
2. **Parallel Queries**: Backend executes all searches in parallel
3. **Result Limiting**: Default limit of 5-10 results per category
4. **Database Indexes**: Ensure proper indexes on searchable columns:
   - `users.name`, `users.email`
   - `teams.name`
   - `services.name`
   - `incidents.title`, `incidents.incidentNumber`
   - `alerts.title`, `alerts.description`

## Testing

### Manual Testing Steps:

1. **Test Keyboard Shortcut**:
   - Press `Cmd/Ctrl + K`
   - Verify modal opens
   - Press ESC, verify modal closes

2. **Test Search Icon**:
   - Click search icon in header
   - Verify modal opens

3. **Test Search Functionality**:
   - Type "test" - verify results appear
   - Type single character - verify "Type at least 2 characters" message
   - Type gibberish - verify "No results" message

4. **Test Keyboard Navigation**:
   - Search for something with multiple results
   - Press ↓ arrow - verify selection moves down
   - Press ↑ arrow - verify selection moves up
   - Press Enter - verify navigation to selected result

5. **Test Each Entity Type**:
   - Search for incident by number: "123"
   - Search for incident by title: "api error"
   - Search for alert: "cpu"
   - Search for service: "gateway"
   - Search for team: "platform"
   - Search for user: "john"

6. **Test Edge Cases**:
   - Empty search
   - Very long search query
   - Special characters in search
   - Search with no results

### Automated Testing:

```bash
# Backend (add to apps/api/src/modules/search/search.service.spec.ts)
npm test search.service

# Frontend (add to apps/web/src/components/__tests__/GlobalSearch.test.tsx)
npm test GlobalSearch
```

## Future Enhancements

1. **Search Highlights**: Highlight matching text in results
2. **Recent Searches**: Store and show recent search queries
3. **Search Filters**: Filter by entity type before searching
4. **Advanced Search**: Support for complex queries (e.g., "status:triggered severity:critical")
5. **Fuzzy Search**: Implement fuzzy matching for typo tolerance
6. **Search Analytics**: Track popular searches to improve relevance
7. **Keyboard Shortcuts**: Add shortcuts for quick navigation (e.g., `Cmd+1` for first result)
8. **Team Scoping**: Limit search results based on user's team membership
9. **Elasticsearch Integration**: For larger deployments, consider Elasticsearch for better performance

## Troubleshooting

### Search Modal Doesn't Open:
- Check if keyboard shortcut is conflicting with browser/OS shortcuts
- Verify `GlobalSearch` component is included in the component tree
- Check browser console for JavaScript errors

### No Search Results:
- Verify backend API is running
- Check network tab for API errors
- Verify database contains searchable data
- Check authentication token is valid

### Slow Search Performance:
- Verify database indexes exist
- Check database query performance
- Consider reducing the limit parameter
- Monitor API response times

## Migration Notes

- No database migrations required (uses existing tables)
- No breaking changes to existing APIs
- Can be deployed independently

## Related Files

### Backend:
- `apps/api/src/modules/search/search.service.ts`
- `apps/api/src/modules/search/search.controller.ts`
- `apps/api/src/modules/search/search.module.ts`
- `apps/api/src/app.module.ts` (module registration)

### Frontend:
- `apps/web/src/components/GlobalSearch.tsx`
- `apps/web/src/components/layout/Header.tsx`

## Dependencies

### Backend:
- NestJS decorators (@nestjs/common, @nestjs/swagger)
- Drizzle ORM for database queries
- JWT authentication guard

### Frontend:
- React hooks (useState, useEffect, useRef, useCallback)
- React Router for navigation
- Framer Motion for animations
- Lucide React for icons
- Axios for API calls

## Changelog

### Version 1.0.0 (2025-02-04)
- Initial implementation of global search
- Support for incidents, alerts, services, teams, and users
- Keyboard shortcuts (Cmd/Ctrl + K)
- Keyboard navigation with arrow keys
- Debounced search with 300ms delay
- Modal UI with categorized results
- Backend API endpoint with parallel search execution
