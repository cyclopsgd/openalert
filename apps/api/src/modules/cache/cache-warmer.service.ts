import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { CacheService, CACHE_PREFIX, CACHE_TTL } from './cache.service';
import { MetricsService } from '../metrics/metrics.service';
import { ServicesService } from '../services/services.service';

/**
 * Background service to warm frequently accessed caches
 * Prevents cold cache latency for critical endpoints
 */
@Injectable()
export class CacheWarmerService implements OnModuleInit {
  private readonly logger = new Logger(CacheWarmerService.name);
  private isWarming = false;

  constructor(
    private readonly cacheService: CacheService,
    private readonly metricsService: MetricsService,
    private readonly servicesService: ServicesService,
  ) {}

  async onModuleInit() {
    // Warm cache on startup
    await this.warmCriticalCaches();
  }

  /**
   * Warm dashboard metrics cache every 30 seconds
   * Runs slightly before cache expiry (60s TTL) to ensure fresh data
   */
  @Interval(30000) // 30 seconds
  async warmDashboardMetrics() {
    if (this.isWarming) {
      this.logger.debug('Cache warming already in progress, skipping');
      return;
    }

    this.isWarming = true;

    try {
      this.logger.debug('Warming dashboard metrics cache');

      // Pre-fetch dashboard metrics
      await this.metricsService.getDashboardMetrics();

      // Pre-fetch incident trends (30 days)
      await this.metricsService.getIncidentTrends(30);

      // Pre-fetch response times
      await this.metricsService.getResponseTimes();

      this.logger.debug('Dashboard metrics cache warmed successfully');
    } catch (error) {
      this.logger.error('Failed to warm dashboard metrics cache:', error);
    } finally {
      this.isWarming = false;
    }
  }

  /**
   * Warm services list cache every 2 minutes
   */
  @Interval(120000) // 2 minutes
  async warmServicesCache() {
    try {
      this.logger.debug('Warming services cache');

      // Pre-fetch all services (no team filter)
      await this.servicesService.findAll();

      this.logger.debug('Services cache warmed successfully');
    } catch (error) {
      this.logger.error('Failed to warm services cache:', error);
    }
  }

  /**
   * Warm all critical caches on startup or manual trigger
   */
  async warmCriticalCaches(): Promise<void> {
    this.logger.log('Warming all critical caches...');

    try {
      await Promise.all([
        this.warmDashboardMetrics(),
        this.warmServicesCache(),
      ]);

      this.logger.log('All critical caches warmed successfully');
    } catch (error) {
      this.logger.error('Failed to warm critical caches:', error);
    }
  }

  /**
   * Clear all caches and re-warm
   * Useful after bulk data imports or migrations
   */
  async clearAndWarm(): Promise<void> {
    this.logger.log('Clearing and re-warming all caches...');

    try {
      await this.cacheService.clear();
      await this.warmCriticalCaches();

      this.logger.log('Caches cleared and re-warmed successfully');
    } catch (error) {
      this.logger.error('Failed to clear and warm caches:', error);
    }
  }

  /**
   * Get cache warming status
   */
  getStatus(): {
    isWarming: boolean;
    lastWarmTime: Date | null;
  } {
    return {
      isWarming: this.isWarming,
      lastWarmTime: null, // TODO: Track last warm time
    };
  }
}
