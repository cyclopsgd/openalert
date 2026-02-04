import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { sql } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { CacheService } from '../cache/cache.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private memory: MemoryHealthIndicator,
    private db: DatabaseService,
    private cache: CacheService,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Health check endpoint' })
  check() {
    return this.health.check([
      // Check memory heap doesn't exceed 150MB
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
      // Check memory RSS doesn't exceed 300MB
      () => this.memory.checkRSS('memory_rss', 300 * 1024 * 1024),
      // Check database connection
      async () => {
        try {
          await this.db.db.execute(sql`SELECT 1`);
          return {
            database: {
              status: 'up',
            },
          };
        } catch (error) {
          return {
            database: {
              status: 'down',
              error: error.message,
            },
          };
        }
      },
      // Check Redis cache connection
      async () => {
        const isAvailable = await this.cache.isAvailable();
        return {
          redis_cache: {
            status: isAvailable ? 'up' : 'down',
          },
        };
      },
    ]);
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe for Kubernetes' })
  liveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe for Kubernetes' })
  async readiness() {
    try {
      // Check database is accessible
      await this.db.db.execute(sql`SELECT 1`);

      // Check cache (optional, won't fail readiness if unavailable)
      const cacheAvailable = await this.cache.isAvailable();

      return {
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'ok',
          cache: cacheAvailable ? 'ok' : 'degraded',
        },
      };
    } catch (error) {
      return {
        status: 'not ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'error',
        },
        error: error.message,
      };
    }
  }

  @Get('cache/stats')
  @ApiOperation({ summary: 'Get cache statistics' })
  async cacheStats() {
    return this.cache.getStats();
  }
}
