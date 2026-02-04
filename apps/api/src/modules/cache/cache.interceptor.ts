import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CacheService } from './cache.service';
import { CACHE_KEY_METADATA, CACHE_TTL_METADATA } from './cache.decorator';

/**
 * Interceptor for automatic caching based on @Cacheable decorator
 *
 * Usage:
 * 1. Apply @UseInterceptors(CacheInterceptor) at controller or method level
 * 2. Mark methods with @Cacheable(keyPattern, ttl)
 */
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInterceptor.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const keyPattern = this.reflector.get<string>(CACHE_KEY_METADATA, context.getHandler());
    const ttl = this.reflector.get<number>(CACHE_TTL_METADATA, context.getHandler());

    // If no cache metadata, proceed without caching
    if (!keyPattern || !ttl) {
      return next.handle();
    }

    // Build cache key from pattern and method arguments
    const args = context.getArgByIndex(0); // Get method arguments
    const cacheKey = this.buildCacheKey(keyPattern, args);

    // Try to get from cache
    const cachedValue = await this.cacheService.get(cacheKey);
    if (cachedValue !== null) {
      this.logger.debug(`Serving from cache: ${cacheKey}`);
      return of(cachedValue);
    }

    // Execute method and cache result
    return next.handle().pipe(
      tap(async (data) => {
        if (data !== null && data !== undefined) {
          await this.cacheService.set(cacheKey, data, ttl);
        }
      }),
    );
  }

  /**
   * Build cache key by replacing placeholders in pattern
   * @param pattern Key pattern with {0}, {1}, etc. placeholders
   * @param args Method arguments
   */
  private buildCacheKey(pattern: string, args: any): string {
    if (!args) {
      return pattern;
    }

    let key = pattern;

    // Handle object arguments
    if (typeof args === 'object' && !Array.isArray(args)) {
      Object.keys(args).forEach((prop) => {
        key = key.replace(`{${prop}}`, String(args[prop]));
      });
    }

    return key;
  }
}
