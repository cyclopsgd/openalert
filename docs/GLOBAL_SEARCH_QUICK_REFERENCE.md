# Global Search - Developer Quick Reference

## API Endpoint

```http
GET /search?q=<query>&limit=<limit>
Authorization: Bearer <jwt-token>
```

**Parameters:**
- `q` (string, required): Search query (min 2 chars)
- `limit` (number, optional): Results per category (default: 10)

**Response Structure:**
```typescript
{
  incidents: Array<{
    id: number
    incidentNumber: number
    title: string
    status: 'triggered' | 'acknowledged' | 'resolved'
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
    serviceId: number
    triggeredAt: string
  }>
  alerts: Array<{
    id: number
    title: string
    description: string | null
    status: 'firing' | 'acknowledged' | 'resolved' | 'suppressed'
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
    firedAt: string
  }>
  services: Array<{
    id: number
    name: string
    slug: string
    description: string | null
    teamId: number
  }>
  teams: Array<{
    id: number
    name: string
    slug: string
    description: string | null
  }>
  users: Array<{
    id: number
    name: string
    email: string
    role: string
  }>
}
```

## Frontend Integration

### Import Component
```tsx
import { GlobalSearch, useGlobalSearchShortcut } from '@/components/GlobalSearch'
```

### Basic Usage
```tsx
function MyComponent() {
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  // Register Cmd/Ctrl + K shortcut
  useGlobalSearchShortcut(() => setIsSearchOpen(true))

  return (
    <>
      <button onClick={() => setIsSearchOpen(true)}>Search</button>
      <GlobalSearch
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </>
  )
}
```

## Backend Service Methods

### SearchService

```typescript
// Main search method
async search(query: string, limit: number = 10): Promise<SearchResult>

// Individual entity searches
private async searchIncidents(query: string, limit: number)
private async searchAlerts(query: string, limit: number)
private async searchServices(query: string, limit: number)
private async searchTeams(query: string, limit: number)
private async searchUsers(query: string, limit: number)
```

## File Locations

```
Backend:
├── apps/api/src/modules/search/
│   ├── search.service.ts          # Core search logic
│   ├── search.controller.ts       # REST endpoint
│   ├── search.module.ts           # Module definition
│   └── search.service.spec.ts     # Unit tests

Frontend:
├── apps/web/src/components/
│   ├── GlobalSearch.tsx           # Main component
│   └── __tests__/
│       └── GlobalSearch.test.tsx  # Component tests

Documentation:
├── docs/
│   ├── GLOBAL_SEARCH_DOCUMENTATION.md    # Full docs
│   ├── GLOBAL_SEARCH_USAGE_GUIDE.md      # User guide
│   └── GLOBAL_SEARCH_QUICK_REFERENCE.md  # This file
└── TASK_88_IMPLEMENTATION_SUMMARY.md     # Implementation summary
```

## Key Features

- ✅ Keyboard shortcut: `Cmd/Ctrl + K`
- ✅ Debounced search: 300ms delay
- ✅ Keyboard navigation: Arrow keys, Enter, ESC
- ✅ Parallel backend queries
- ✅ Case-insensitive search
- ✅ Incident number exact match
- ✅ Categorized results
- ✅ JWT authentication required
- ✅ TypeScript strict mode
- ✅ Full test coverage

## Testing

### Run Backend Tests
```bash
cd apps/api
npm test search.service.spec.ts
```

### Run Frontend Tests
```bash
cd apps/web
npm test GlobalSearch.test.tsx
```

## Common Customizations

### Change Debounce Delay
```tsx
// In GlobalSearch.tsx, line ~118
setTimeout(() => {
  performSearch(query)
}, 300) // Change to desired delay in ms
```

### Change Results Limit
```tsx
// In GlobalSearch.tsx, line ~111
const response = await apiClient.get<SearchResults>('/search', {
  params: { q: searchQuery.trim(), limit: 5 }, // Change limit here
})
```

### Add New Search Entity

1. **Backend** (`search.service.ts`):
```typescript
// 1. Add to SearchResult interface
export interface SearchResult {
  // ... existing
  projects: Array<{ id: number, name: string, ... }>
}

// 2. Add search method
private async searchProjects(query: string, limit: number) {
  const result = await this.db.db
    .select({ ... })
    .from(projects)
    .where(sql`${projects.name} ILIKE ${`%${query}%`}`)
    .limit(limit)
  return result
}

// 3. Add to Promise.all
const [incidents, alerts, services, teams, users, projects] =
  await Promise.all([
    // ... existing
    this.searchProjects(searchTerm, limit),
  ])
```

2. **Frontend** (`GlobalSearch.tsx`):
```tsx
// 1. Add to SearchResults interface
interface SearchResults {
  // ... existing
  projects: Array<{ id: number, name: string, ... }>
}

// 2. Add to flatResults
const flatResults = [
  // ... existing
  ...results.projects.map(item => ({ type: 'project', data: item })),
]

// 3. Add navigation case
case 'project':
  navigate(`/projects/${result.data.id}`)
  break

// 4. Add results section
{results.projects.length > 0 && (
  <div className="mb-2">
    <div className="px-4 py-2 text-xs font-semibold text-dark-400">
      PROJECTS
    </div>
    {results.projects.map((project, idx) => (
      // ... render project item
    ))}
  </div>
)}
```

## Performance Tips

1. Add database indexes on searchable columns
2. Adjust result limits based on traffic
3. Consider caching for frequently searched terms
4. Monitor API response times
5. Use connection pooling for database

## Security Considerations

- Always require authentication
- Validate and sanitize input
- Use parameterized queries (done via Drizzle)
- Implement rate limiting
- Respect team-based permissions

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Search not opening | Check keyboard event listeners |
| No results | Verify API endpoint and auth |
| Slow search | Check database indexes |
| Wrong results | Review search query logic |

## Related Commands

```bash
# Start development
npm run start:dev

# Run all tests
npm test

# Build for production
npm run build

# Check types
npm run type-check

# Lint code
npm run lint
```

## Dependencies

**Backend:**
- @nestjs/common
- @nestjs/swagger
- drizzle-orm

**Frontend:**
- react
- react-router-dom
- framer-motion
- lucide-react
- axios

## Keyboard Shortcuts Summary

| Key | Action |
|-----|--------|
| `Cmd/Ctrl + K` | Open search |
| `↓` | Next result |
| `↑` | Previous result |
| `Enter` | Select result |
| `ESC` | Close search |

## API Examples

### cURL
```bash
curl -X GET "http://localhost:3001/search?q=api&limit=5" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### JavaScript/Axios
```javascript
import axios from 'axios'

const response = await axios.get('/search', {
  params: { q: 'api', limit: 5 },
  headers: { Authorization: `Bearer ${token}` }
})
```

### TypeScript
```typescript
import apiClient from '@/lib/api/client'

const { data } = await apiClient.get<SearchResults>('/search', {
  params: { q: 'api', limit: 5 }
})
```

## Important Notes

- Minimum query length: 2 characters
- Default result limit: 10 per category
- Debounce delay: 300ms
- Authentication: JWT required
- Rate limit: 60 requests/minute

## Resources

- Full Documentation: `/docs/GLOBAL_SEARCH_DOCUMENTATION.md`
- User Guide: `/docs/GLOBAL_SEARCH_USAGE_GUIDE.md`
- Implementation: `/TASK_88_IMPLEMENTATION_SUMMARY.md`
- Swagger API: `http://localhost:3001/api/docs`

---

**Last Updated:** February 4, 2026
**Version:** 1.0.0
