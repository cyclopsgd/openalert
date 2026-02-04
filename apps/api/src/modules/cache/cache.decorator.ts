import { SetMetadata } from '@nestjs/common';

export const CACHE_KEY_METADATA = 'cache:key';
export const CACHE_TTL_METADATA = 'cache:ttl';

/**
 * Decorator to mark a method for automatic caching
 *
 * @param keyPattern - Cache key pattern (can include placeholders like {0}, {1} for method arguments)
 * @param ttl - Time to live in seconds
 *
 * @example
 * ```typescript
 * @Cacheable('incidents:list:{0}:{1}', 30)
 * async list(status: string, limit: number) {
 *   // Method implementation
 * }
 * ```
 */
export const Cacheable = (keyPattern: string, ttl: number) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    SetMetadata(CACHE_KEY_METADATA, keyPattern)(target, propertyKey, descriptor);
    SetMetadata(CACHE_TTL_METADATA, ttl)(target, propertyKey, descriptor);
    return descriptor;
  };
};
