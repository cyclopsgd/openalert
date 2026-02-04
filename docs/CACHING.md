# Redis Caching Strategy

## Overview

OpenAlert implements a comprehensive Redis caching layer to improve performance and reduce database load. The caching system is designed with graceful fallback - if Redis is unavailable, the application continues to function by querying the database directly.

## Architecture

### Cache Service

The `CacheService` (located in `apps/api/src/modules/cache/`) provides a centralized caching interface:

- **Generic Methods**: `get()`, `set()`, `del()`, `delPattern()`, `clear()`
- **TTL Configuration**: Configurable time-to-live for different data types
- **Key Namespacing**: Consistent key prefixing pattern
- **Error Handling**: Graceful fallback if Redis is unavailable
- **Logging**: Cache hit/miss metrics for monitoring

### Key Naming Convention

All cache keys follow this pattern:
```
openalert:<module>:<operation>:<identifier>
```

Examples:
- `openalert:incidents:list:{"status":"triggered"}`
- `openalert:metrics:dashboard`
- `openalert:services:list:all`
- `openalert:routing:enabled:1`
- `openalert:status-pages:slug:example-status`

## Cached Data Types

### 1. Incidents List (TTL: 30 seconds)
- **Key Pattern**: `openalert:incidents:list:*`
- **Cached Data**: Paginated incident lists with filters
- **Invalidation**: On incident create, update, acknowledge, resolve

### 2. Dashboard Metrics (TTL: 60 seconds)
- **Key Pattern**: `openalert:metrics:dashboard`
- **Cached Data**: MTTA, MTTR, active count, severity/status breakdowns
- **Invalidation**: On any incident status change

### 3. Services List (TTL: 2 minutes)
- **Key Pattern**: `openalert:services:list:*`
- **Cached Data**: Service catalog with incident counts
- **Invalidation**: On service create, update, delete

### 4. Alert Routing Rules (TTL: 2 minutes)
- **Key Pattern**: `openalert:routing:enabled:<teamId>`
- **Cached Data**: Enabled routing rules for a team
- **Invalidation**: On rule create, update, delete, enable/disable

### 5. Status Pages (TTL: 1 minute)
- **Key Pattern**: `openalert:status-pages:slug:<slug>`
- **Cached Data**: Public status page content
- **Invalidation**: On status page update

### 6. On-Call Schedules (TTL: 5 minutes)
- **Key Pattern**: `openalert:schedules:*:<scheduleId>`
- **Cached Data**: Current on-call user, upcoming shifts
- **Invalidation**: On schedule update, rotation change, override add/remove

### 7. User Permissions (TTL: 5 minutes)
- **Key Pattern**: `openalert:users:permissions:<userId>`
- **Cached Data**: RBAC permissions for a user
- **Invalidation**: On role change, team membership change

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# Cache Configuration
CACHE_ENABLED=true
REDIS_CACHE_TTL_DEFAULT=60
```

### TTL Configuration

Default TTL values are defined in `cache.service.ts`:

```typescript
export const CACHE_TTL = {
  INCIDENTS_LIST: 30,        // 30 seconds
  DASHBOARD_METRICS: 60,     // 1 minute
  ON_CALL_SCHEDULE: 300,     // 5 minutes
  SERVICES_LIST: 120,        // 2 minutes
  USER_PERMISSIONS: 300,     // 5 minutes
  ALERT_ROUTING_RULES: 120,  // 2 minutes
  STATUS_PAGES: 60,          // 1 minute
  DEFAULT: 60,               // 1 minute
};
```

## Cache Invalidation Strategy

### Automatic Invalidation

Cache invalidation is triggered automatically on data changes:

#### Incidents
- **Create**: Invalidates `incidents:*` and `metrics:*`
- **Acknowledge**: Invalidates `incidents:*` and `metrics:*`
- **Resolve**: Invalidates `incidents:*` and `metrics:*`

#### Services
- **Create/Update/Delete**: Invalidates `services:*`

#### Alert Routing Rules
- **Create/Update/Delete**: Invalidates `routing:*:<teamId>`

#### Status Pages
- **Update**: Invalidates specific `status-pages:slug:<slug>`

#### Schedules
- **Update**: Invalidates `schedules:*:<scheduleId>`

### Manual Cache Clearing

You can manually clear the cache using:

```typescript
// Clear all cache
await cacheService.clear();

// Clear specific pattern
await cacheService.delPattern('openalert:incidents:*');

// Clear specific key
await cacheService.del('openalert:metrics:dashboard');
```

## Usage Examples

### Basic Usage in Services

```typescript
import { CacheService, CACHE_PREFIX, CACHE_TTL } from '../cache/cache.service';

@Injectable()
export class MyService {
  constructor(private readonly cacheService: CacheService) {}

  async getData(id: number) {
    // Build cache key
    const cacheKey = this.cacheService.buildKey(CACHE_PREFIX.SERVICES, 'detail', id);

    // Try to get from cache
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const data = await this.db.query(...);

    // Cache the result
    await this.cacheService.set(cacheKey, data, CACHE_TTL.SERVICES_LIST);

    return data;
  }

  async updateData(id: number, updates: any) {
    // Update database
    await this.db.update(...);

    // Invalidate cache
    await this.cacheService.delPattern(`${CACHE_PREFIX.SERVICES}:*`);
  }
}
```

### Using the @Cacheable Decorator (Optional)

```typescript
import { Cacheable } from '../cache/cache.decorator';
import { UseInterceptors } from '@nestjs/common';
import { CacheInterceptor } from '../cache/cache.interceptor';

@Injectable()
@UseInterceptors(CacheInterceptor)
export class MyService {
  @Cacheable('openalert:mydata:{id}', 60)
  async getData(id: number) {
    // This method's result will be automatically cached
    return this.db.query(...);
  }
}
```

## Monitoring

### Health Checks

Cache health is included in the application health check:

```bash
GET /health
```

Response includes Redis cache status:
```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis_cache": { "status": "up" }
  }
}
```

### Cache Statistics

Get detailed cache statistics:

```bash
GET /health/cache/stats
```

Response:
```json
{
  "enabled": true,
  "connected": true,
  "keyCount": 42,
  "memoryUsed": "2.3M"
}
```

### Log Monitoring

The CacheService logs all cache operations:

- `Cache HIT: <key>` - Successful cache retrieval
- `Cache MISS: <key>` - Cache miss, fetching from database
- `Cache SET: <key> (TTL: 60s)` - Value cached
- `Cache DEL: <key>` - Key deleted
- `Cache cleared: 42 keys deleted` - Bulk deletion

## Performance Considerations

### Cache Hit Rate

Monitor cache hit/miss logs to optimize TTL values:

- **High miss rate**: Consider increasing TTL
- **Stale data concerns**: Decrease TTL or improve invalidation
- **Memory usage**: Decrease TTL or use pattern-based expiration

### Memory Usage

Redis stores all cached data in memory. Monitor with:

```bash
# Via Redis CLI
redis-cli INFO memory

# Via OpenAlert health endpoint
curl http://localhost:3001/health/cache/stats
```

### TTL Selection Guidelines

- **Frequently changing data**: 30-60 seconds (incidents, alerts)
- **Moderate change rate**: 2-5 minutes (services, routing rules)
- **Relatively static data**: 5-15 minutes (schedules, permissions)
- **Public-facing data**: 1-2 minutes (status pages)

## Troubleshooting

### Cache Not Working

1. **Check Redis Connection**:
   ```bash
   docker-compose -f docker/docker-compose.yml ps
   redis-cli ping
   ```

2. **Check Environment Variables**:
   ```bash
   # Verify CACHE_ENABLED=true in .env
   # Verify REDIS_URL is correct
   ```

3. **Check Application Logs**:
   ```bash
   # Look for Redis connection errors
   npm run start:dev
   ```

### High Memory Usage

1. **Reduce TTL values** in `cache.service.ts`
2. **Implement more aggressive cache invalidation**
3. **Clear cache manually**:
   ```bash
   redis-cli FLUSHDB
   ```

### Stale Data

1. **Verify cache invalidation** is triggered on data changes
2. **Reduce TTL** for affected data types
3. **Check invalidation patterns** match cache keys

## Testing

### Unit Tests

Run cache service tests:
```bash
npm test cache.service
```

### Integration Tests

Test with Redis disabled:
```bash
CACHE_ENABLED=false npm run start:dev
```

Test with Redis enabled:
```bash
CACHE_ENABLED=true npm run start:dev
```

### Manual Testing

1. **Test Cache Hit**:
   ```bash
   # First request (cache miss)
   curl http://localhost:3001/api/incidents

   # Second request (cache hit - check logs)
   curl http://localhost:3001/api/incidents
   ```

2. **Test Invalidation**:
   ```bash
   # Create incident
   curl -X POST http://localhost:3001/api/incidents -d '...'

   # Verify cache cleared (next request should be cache miss)
   curl http://localhost:3001/api/incidents
   ```

## Production Deployment

### Redis Configuration

For production, consider:

1. **Persistent Storage**: Configure Redis persistence (RDB/AOF)
2. **High Availability**: Use Redis Sentinel or Redis Cluster
3. **Memory Limits**: Set `maxmemory` and eviction policies
4. **Monitoring**: Use Redis monitoring tools (RedisInsight, Prometheus)

Example Redis configuration:
```conf
maxmemory 256mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

### Horizontal Scaling

When running multiple API instances:

1. **Shared Redis Instance**: All instances connect to the same Redis
2. **Cache Invalidation**: Invalidation works across all instances
3. **Connection Pooling**: ioredis handles connection pooling automatically

### Monitoring Metrics

Track these metrics in production:

- Cache hit rate
- Cache miss rate
- Average response time (with/without cache)
- Redis memory usage
- Redis connection count
- Cache invalidation frequency

## Future Enhancements

Potential improvements for the caching layer:

1. **Cache Warming**: Pre-populate cache on application startup
2. **Smart TTL**: Dynamic TTL based on data access patterns
3. **Compression**: Compress large cached values
4. **Multi-layer Cache**: Add in-memory cache (LRU) before Redis
5. **Cache Tags**: Tag-based invalidation for related data
6. **Partial Cache**: Cache query results at different granularities

## References

- [Redis Documentation](https://redis.io/documentation)
- [ioredis Client](https://github.com/luin/ioredis)
- [Cache Invalidation Strategies](https://martinfowler.com/bliki/TwoHardThings.html)
