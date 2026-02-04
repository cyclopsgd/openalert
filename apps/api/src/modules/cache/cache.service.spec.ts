import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CacheService, CACHE_TTL, CACHE_PREFIX } from './cache.service';

describe('CacheService', () => {
  let service: CacheService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                CACHE_ENABLED: 'false', // Disable Redis for unit tests
                REDIS_CACHE_TTL_DEFAULT: 60,
                REDIS_URL: 'redis://localhost:6379',
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('buildKey', () => {
    it('should build cache key with prefix and parameters', () => {
      const key = service.buildKey(CACHE_PREFIX.INCIDENTS, 'list', 'triggered');
      expect(key).toBe('openalert:incidents:list:triggered');
    });

    it('should handle multiple parameters', () => {
      const key = service.buildKey(CACHE_PREFIX.SERVICES, 'detail', 123, 'active');
      expect(key).toBe('openalert:services:detail:123:active');
    });
  });

  describe('get/set operations', () => {
    it('should return null when cache is disabled', async () => {
      const result = await service.get('test-key');
      expect(result).toBeNull();
    });

    it('should not throw when setting value with cache disabled', async () => {
      await expect(service.set('test-key', { data: 'value' }, 60)).resolves.not.toThrow();
    });

    it('should not throw when deleting key with cache disabled', async () => {
      await expect(service.del('test-key')).resolves.not.toThrow();
    });
  });

  describe('isAvailable', () => {
    it('should return false when cache is disabled', async () => {
      const available = await service.isAvailable();
      expect(available).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return stats with enabled=false when cache is disabled', async () => {
      const stats = await service.getStats();
      expect(stats).toEqual({
        enabled: false,
        connected: false,
        keyCount: 0,
        memoryUsed: '0',
      });
    });
  });

  describe('clear', () => {
    it('should not throw when clearing cache with cache disabled', async () => {
      await expect(service.clear()).resolves.not.toThrow();
    });
  });

  describe('delPattern', () => {
    it('should not throw when deleting pattern with cache disabled', async () => {
      await expect(service.delPattern('openalert:*')).resolves.not.toThrow();
    });
  });
});
