import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheService } from './cache.service';

/**
 * Cache Module - Provides Redis caching services globally
 *
 * Features:
 * - Generic caching methods (get, set, del, clear)
 * - TTL configuration per data type
 * - Key prefixing for namespacing
 * - Graceful fallback if Redis unavailable
 * - Cache hit/miss logging
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
