import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Cache TTL configurations (in seconds)
 */
export const CACHE_TTL = {
  INCIDENTS_LIST: 30,
  DASHBOARD_METRICS: 60,
  ON_CALL_SCHEDULE: 300, // 5 minutes
  SERVICES_LIST: 120, // 2 minutes
  USER_PERMISSIONS: 300, // 5 minutes
  ALERT_ROUTING_RULES: 120, // 2 minutes
  STATUS_PAGES: 60, // 1 minute
  DEFAULT: 60,
} as const;

/**
 * Cache key prefixes for namespacing
 */
export const CACHE_PREFIX = {
  INCIDENTS: 'openalert:incidents',
  METRICS: 'openalert:metrics',
  SCHEDULES: 'openalert:schedules',
  SERVICES: 'openalert:services',
  USERS: 'openalert:users',
  ROUTING: 'openalert:routing',
  STATUS_PAGES: 'openalert:status-pages',
} as const;

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly redis: Redis | null;
  private readonly enabled: boolean;
  private readonly defaultTTL: number;

  constructor(private readonly configService: ConfigService) {
    this.enabled = this.configService.get<string>('CACHE_ENABLED', 'true') === 'true';
    this.defaultTTL = this.configService.get<number>('REDIS_CACHE_TTL_DEFAULT', CACHE_TTL.DEFAULT);

    if (this.enabled) {
      try {
        const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
        this.redis = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          retryStrategy: (times: number) => {
            if (times > 3) {
              this.logger.warn('Redis connection failed after 3 retries. Caching disabled.');
              return null; // Stop retrying
            }
            return Math.min(times * 100, 3000); // Exponential backoff
          },
          lazyConnect: true,
        });

        this.redis.on('connect', () => {
          this.logger.log('Redis cache connected successfully');
        });

        this.redis.on('error', (error) => {
          this.logger.error('Redis cache error:', error.message);
        });

        this.redis.on('close', () => {
          this.logger.warn('Redis cache connection closed');
        });

        // Connect asynchronously
        this.redis.connect().catch((error) => {
          this.logger.error('Failed to connect to Redis:', error.message);
        });
      } catch (error) {
        this.logger.error('Failed to initialize Redis cache:', error);
        this.redis = null;
      }
    } else {
      this.logger.log('Caching is disabled');
      this.redis = null;
    }
  }

  /**
   * Get value from cache
   * @param key Cache key
   * @returns Parsed value or null
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.redis || !this.enabled) {
      return null;
    }

    try {
      const value = await this.redis.get(key);
      if (value) {
        this.logger.debug(`Cache HIT: ${key}`);
        return JSON.parse(value) as T;
      }
      this.logger.debug(`Cache MISS: ${key}`);
      return null;
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   * @param key Cache key
   * @param value Value to cache (will be JSON stringified)
   * @param ttl Time to live in seconds (optional, uses default if not provided)
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.redis || !this.enabled) {
      return;
    }

    try {
      const ttlSeconds = ttl || this.defaultTTL;
      const serialized = JSON.stringify(value);
      await this.redis.setex(key, ttlSeconds, serialized);
      this.logger.debug(`Cache SET: ${key} (TTL: ${ttlSeconds}s)`);
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}:`, error);
    }
  }

  /**
   * Delete a specific key from cache
   * @param key Cache key
   */
  async del(key: string): Promise<void> {
    if (!this.redis || !this.enabled) {
      return;
    }

    try {
      await this.redis.del(key);
      this.logger.debug(`Cache DEL: ${key}`);
    } catch (error) {
      this.logger.error(`Cache delete error for key ${key}:`, error);
    }
  }

  /**
   * Delete multiple keys matching a pattern
   * @param pattern Pattern to match (e.g., "openalert:incidents:*")
   */
  async delPattern(pattern: string): Promise<void> {
    if (!this.redis || !this.enabled) {
      return;
    }

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.debug(`Cache DEL pattern: ${pattern} (${keys.length} keys)`);
      }
    } catch (error) {
      this.logger.error(`Cache delete pattern error for ${pattern}:`, error);
    }
  }

  /**
   * Clear all cache keys with openalert prefix
   */
  async clear(): Promise<void> {
    if (!this.redis || !this.enabled) {
      return;
    }

    try {
      const keys = await this.redis.keys('openalert:*');
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.log(`Cache cleared: ${keys.length} keys deleted`);
      }
    } catch (error) {
      this.logger.error('Cache clear error:', error);
    }
  }

  /**
   * Check if cache is available and connected
   */
  async isAvailable(): Promise<boolean> {
    if (!this.redis || !this.enabled) {
      return false;
    }

    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    enabled: boolean;
    connected: boolean;
    keyCount: number;
    memoryUsed: string;
  }> {
    const stats = {
      enabled: this.enabled,
      connected: false,
      keyCount: 0,
      memoryUsed: '0',
    };

    if (!this.redis || !this.enabled) {
      return stats;
    }

    try {
      const info = await this.redis.info('memory');
      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
      if (memoryMatch) {
        stats.memoryUsed = memoryMatch[1];
      }

      const keys = await this.redis.keys('openalert:*');
      stats.keyCount = keys.length;
      stats.connected = true;
    } catch (error) {
      this.logger.error('Failed to get cache stats:', error);
    }

    return stats;
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
      this.logger.log('Redis cache connection closed');
    }
  }

  /**
   * Build cache key with prefix and parameters
   * @param prefix Key prefix from CACHE_PREFIX
   * @param params Parameters to append to key
   * @returns Formatted cache key
   */
  buildKey(prefix: string, ...params: (string | number)[]): string {
    return `${prefix}:${params.join(':')}`;
  }
}
