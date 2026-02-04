import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService, DashboardMetrics, IncidentTrend, ResponseTimeBucket } from './metrics.service';
import { DatabaseService } from '../../database/database.service';
import { CacheService, CACHE_PREFIX, CACHE_TTL } from '../cache/cache.service';

describe('MetricsService', () => {
  let service: MetricsService;
  let db: DatabaseService;
  let cacheService: CacheService;

  const mockSelect = jest.fn().mockReturnThis();
  const mockFrom = jest.fn().mockReturnThis();
  const mockWhere = jest.fn().mockReturnThis();
  const mockExecute = jest.fn();

  const mockDb = {
    select: mockSelect,
    from: mockFrom,
    execute: mockExecute,
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    buildKey: jest.fn((...parts) => parts.join(':')),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsService,
        {
          provide: DatabaseService,
          useValue: { db: mockDb },
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
    db = module.get<DatabaseService>(DatabaseService);
    cacheService = module.get<CacheService>(CacheService);

    // Reset mock chain
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockResolvedValue([]);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDashboardMetrics', () => {
    const mockMetrics: DashboardMetrics = {
      activeCount: 5,
      mtta: '15m',
      mttr: '45m',
      severityBreakdown: {
        critical: 2,
        high: 1,
        medium: 1,
        low: 1,
        info: 0,
      },
      statusBreakdown: {
        triggered: 3,
        acknowledged: 2,
        resolved: 10,
      },
      onCallEngineer: undefined,
    };

    it('should return cached metrics if available', async () => {
      mockCacheService.get.mockResolvedValue(mockMetrics);

      const result = await service.getDashboardMetrics();

      expect(result).toEqual(mockMetrics);
      expect(mockCacheService.get).toHaveBeenCalledWith(
        `${CACHE_PREFIX.METRICS}:dashboard`,
      );
      expect(mockCacheService.set).not.toHaveBeenCalled();
    });

    it('should calculate and cache metrics when cache is empty', async () => {
      mockCacheService.get.mockResolvedValue(null);

      // Mock getActiveIncidentsCount
      mockWhere.mockResolvedValueOnce([{ count: 5 }]);

      // Mock calculateMTTA
      mockExecute.mockResolvedValueOnce({
        rows: [{ avg: '15' }],
      });

      // Mock calculateMTTR
      mockExecute.mockResolvedValueOnce({
        rows: [{ avg: '45' }],
      });

      // Mock getSeverityBreakdown
      mockExecute.mockResolvedValueOnce({
        rows: [
          { severity: 'critical', count: '2' },
          { severity: 'high', count: '1' },
          { severity: 'medium', count: '1' },
          { severity: 'low', count: '1' },
        ],
      });

      // Mock getStatusBreakdown
      mockExecute.mockResolvedValueOnce({
        rows: [
          { status: 'triggered', count: '3' },
          { status: 'acknowledged', count: '2' },
          { status: 'resolved', count: '10' },
        ],
      });

      const result = await service.getDashboardMetrics();

      expect(result.activeCount).toBe(5);
      expect(result.mtta).toBe('15m');
      expect(result.mttr).toBe('45m');
      expect(result.severityBreakdown).toEqual({
        critical: 2,
        high: 1,
        medium: 1,
        low: 1,
        info: 0,
      });
      expect(result.statusBreakdown).toEqual({
        triggered: 3,
        acknowledged: 2,
        resolved: 10,
      });
      expect(result.onCallEngineer).toBeUndefined();

      expect(mockCacheService.set).toHaveBeenCalledWith(
        `${CACHE_PREFIX.METRICS}:dashboard`,
        expect.objectContaining({
          activeCount: 5,
          mtta: '15m',
          mttr: '45m',
        }),
        CACHE_TTL.DASHBOARD_METRICS,
      );
    });

    it('should handle zero active incidents', async () => {
      mockCacheService.get.mockResolvedValue(null);

      // Mock empty results
      mockWhere.mockResolvedValueOnce([{ count: 0 }]);
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: '0' }] });
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: '0' }] });
      mockExecute.mockResolvedValueOnce({ rows: [] });
      mockExecute.mockResolvedValueOnce({ rows: [] });

      const result = await service.getDashboardMetrics();

      expect(result.activeCount).toBe(0);
      expect(result.mtta).toBe('0m');
      expect(result.mttr).toBe('0m');
      expect(result.severityBreakdown).toEqual({
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
      });
    });

    it('should handle missing count in active incidents query', async () => {
      mockCacheService.get.mockResolvedValue(null);

      // Mock empty result array
      mockWhere.mockResolvedValueOnce([]);
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: '0' }] });
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: '0' }] });
      mockExecute.mockResolvedValueOnce({ rows: [] });
      mockExecute.mockResolvedValueOnce({ rows: [] });

      const result = await service.getDashboardMetrics();

      expect(result.activeCount).toBe(0);
    });
  });

  describe('getIncidentTrends', () => {
    it('should return incident trends for specified days', async () => {
      const mockDbResponse = {
        rows: [
          { date: '2025-01-01', severity: 'critical', count: '3' },
          { date: '2025-01-01', severity: 'high', count: '2' },
          { date: '2025-01-02', severity: 'medium', count: '1' },
        ],
      };

      mockExecute.mockResolvedValue(mockDbResponse);

      const result = await service.getIncidentTrends(7);

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(7); // Should fill missing dates
      expect(mockExecute).toHaveBeenCalled();
    });

    it('should aggregate incidents by severity for each date', async () => {
      const mockDbResponse = {
        rows: [
          { date: '2025-01-15', severity: 'critical', count: '5' },
          { date: '2025-01-15', severity: 'high', count: '3' },
          { date: '2025-01-15', severity: 'medium', count: '2' },
        ],
      };

      mockExecute.mockResolvedValue(mockDbResponse);

      const result = await service.getIncidentTrends(30);

      const jan15Trend = result.find((t) => t.date === '2025-01-15');
      if (jan15Trend) {
        expect(jan15Trend.critical).toBe(5);
        expect(jan15Trend.high).toBe(3);
        expect(jan15Trend.medium).toBe(2);
        expect(jan15Trend.low).toBe(0);
        expect(jan15Trend.info).toBe(0);
        expect(jan15Trend.total).toBe(10);
      }
    });

    it('should fill missing dates with zeros', async () => {
      const mockDbResponse = {
        rows: [
          { date: '2025-01-01', severity: 'critical', count: '1' },
        ],
      };

      mockExecute.mockResolvedValue(mockDbResponse);

      const result = await service.getIncidentTrends(5);

      expect(result.length).toBe(5);

      // Most dates should have zero incidents
      const zeroTrends = result.filter((t) => t.total === 0);
      expect(zeroTrends.length).toBeGreaterThan(0);

      // Each trend should have all severity fields
      result.forEach((trend) => {
        expect(trend).toHaveProperty('date');
        expect(trend).toHaveProperty('critical');
        expect(trend).toHaveProperty('high');
        expect(trend).toHaveProperty('medium');
        expect(trend).toHaveProperty('low');
        expect(trend).toHaveProperty('info');
        expect(trend).toHaveProperty('total');
      });
    });

    it('should handle empty database response', async () => {
      mockExecute.mockResolvedValue({ rows: [] });

      const result = await service.getIncidentTrends(7);

      expect(result.length).toBe(7);
      result.forEach((trend) => {
        expect(trend.total).toBe(0);
        expect(trend.critical).toBe(0);
        expect(trend.high).toBe(0);
        expect(trend.medium).toBe(0);
        expect(trend.low).toBe(0);
        expect(trend.info).toBe(0);
      });
    });

    it('should default to 30 days when no parameter provided', async () => {
      mockExecute.mockResolvedValue({ rows: [] });

      const result = await service.getIncidentTrends();

      expect(result.length).toBe(30);
    });

    it('should calculate total correctly across all severities', async () => {
      const mockDbResponse = {
        rows: [
          { date: '2025-01-10', severity: 'critical', count: '2' },
          { date: '2025-01-10', severity: 'high', count: '4' },
          { date: '2025-01-10', severity: 'medium', count: '6' },
          { date: '2025-01-10', severity: 'low', count: '8' },
          { date: '2025-01-10', severity: 'info', count: '10' },
        ],
      };

      mockExecute.mockResolvedValue(mockDbResponse);

      const result = await service.getIncidentTrends(30);

      const jan10Trend = result.find((t) => t.date === '2025-01-10');
      if (jan10Trend) {
        expect(jan10Trend.total).toBe(30); // 2+4+6+8+10
      }
    });
  });

  describe('getResponseTimes', () => {
    it('should return response time buckets', async () => {
      const mockDbResponse = {
        rows: [
          { bucket: '<5min', count: '10' },
          { bucket: '5-15min', count: '15' },
          { bucket: '15-60min', count: '8' },
          { bucket: '>60min', count: '3' },
        ],
      };

      mockExecute.mockResolvedValue(mockDbResponse);

      const result = await service.getResponseTimes();

      expect(result).toHaveLength(4);
      expect(result[0]).toEqual({ bucket: '<5min', count: 10 });
      expect(result[1]).toEqual({ bucket: '5-15min', count: 15 });
      expect(result[2]).toEqual({ bucket: '15-60min', count: 8 });
      expect(result[3]).toEqual({ bucket: '>60min', count: 3 });
    });

    it('should ensure all buckets are present even if some have zero counts', async () => {
      const mockDbResponse = {
        rows: [
          { bucket: '<5min', count: '5' },
          { bucket: '>60min', count: '2' },
        ],
      };

      mockExecute.mockResolvedValue(mockDbResponse);

      const result = await service.getResponseTimes();

      expect(result).toHaveLength(4);
      expect(result.find((b) => b.bucket === '<5min')?.count).toBe(5);
      expect(result.find((b) => b.bucket === '5-15min')?.count).toBe(0);
      expect(result.find((b) => b.bucket === '15-60min')?.count).toBe(0);
      expect(result.find((b) => b.bucket === '>60min')?.count).toBe(2);
    });

    it('should return all buckets with zero counts when no data', async () => {
      mockExecute.mockResolvedValue({ rows: [] });

      const result = await service.getResponseTimes();

      expect(result).toHaveLength(4);
      expect(result).toEqual([
        { bucket: '<5min', count: 0 },
        { bucket: '5-15min', count: 0 },
        { bucket: '15-60min', count: 0 },
        { bucket: '>60min', count: 0 },
      ]);
    });

    it('should maintain bucket order', async () => {
      const mockDbResponse = {
        rows: [
          { bucket: '>60min', count: '1' },
          { bucket: '<5min', count: '20' },
          { bucket: '15-60min', count: '5' },
          { bucket: '5-15min', count: '10' },
        ],
      };

      mockExecute.mockResolvedValue(mockDbResponse);

      const result = await service.getResponseTimes();

      expect(result[0].bucket).toBe('<5min');
      expect(result[1].bucket).toBe('5-15min');
      expect(result[2].bucket).toBe('15-60min');
      expect(result[3].bucket).toBe('>60min');
    });
  });

  describe('formatDuration', () => {
    it('should format zero minutes', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockWhere.mockResolvedValueOnce([{ count: 0 }]);
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: '0' }] });
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: '0' }] });
      mockExecute.mockResolvedValueOnce({ rows: [] });
      mockExecute.mockResolvedValueOnce({ rows: [] });

      const result = await service.getDashboardMetrics();

      expect(result.mtta).toBe('0m');
      expect(result.mttr).toBe('0m');
    });

    it('should format minutes only', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockWhere.mockResolvedValueOnce([{ count: 0 }]);
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: '45' }] });
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: '30' }] });
      mockExecute.mockResolvedValueOnce({ rows: [] });
      mockExecute.mockResolvedValueOnce({ rows: [] });

      const result = await service.getDashboardMetrics();

      expect(result.mtta).toBe('45m');
      expect(result.mttr).toBe('30m');
    });

    it('should format hours and minutes', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockWhere.mockResolvedValueOnce([{ count: 0 }]);
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: '125' }] }); // 2h 5m
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: '90' }] }); // 1h 30m
      mockExecute.mockResolvedValueOnce({ rows: [] });
      mockExecute.mockResolvedValueOnce({ rows: [] });

      const result = await service.getDashboardMetrics();

      expect(result.mtta).toBe('2h 5m');
      expect(result.mttr).toBe('1h 30m');
    });

    it('should format hours only when minutes are zero', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockWhere.mockResolvedValueOnce([{ count: 0 }]);
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: '120' }] }); // 2h
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: '180' }] }); // 3h
      mockExecute.mockResolvedValueOnce({ rows: [] });
      mockExecute.mockResolvedValueOnce({ rows: [] });

      const result = await service.getDashboardMetrics();

      expect(result.mtta).toBe('2h');
      expect(result.mttr).toBe('3h');
    });

    it('should format days and hours', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockWhere.mockResolvedValueOnce([{ count: 0 }]);
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: '1500' }] }); // 25h = 1d 1h
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: '2880' }] }); // 48h = 2d
      mockExecute.mockResolvedValueOnce({ rows: [] });
      mockExecute.mockResolvedValueOnce({ rows: [] });

      const result = await service.getDashboardMetrics();

      expect(result.mtta).toBe('1d 1h');
      expect(result.mttr).toBe('2d');
    });

    it('should format days only when hours are zero', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockWhere.mockResolvedValueOnce([{ count: 0 }]);
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: '2880' }] }); // 48h = 2d
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: '4320' }] }); // 72h = 3d
      mockExecute.mockResolvedValueOnce({ rows: [] });
      mockExecute.mockResolvedValueOnce({ rows: [] });

      const result = await service.getDashboardMetrics();

      expect(result.mtta).toBe('2d');
      expect(result.mttr).toBe('3d');
    });

    it('should round minutes correctly', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockWhere.mockResolvedValueOnce([{ count: 0 }]);
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: '12.4' }] }); // Should round to 12m
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: '12.6' }] }); // Should round to 13m
      mockExecute.mockResolvedValueOnce({ rows: [] });
      mockExecute.mockResolvedValueOnce({ rows: [] });

      const result = await service.getDashboardMetrics();

      expect(result.mtta).toBe('12m');
      expect(result.mttr).toBe('13m');
    });
  });

  describe('calculateMTTA', () => {
    it('should calculate mean time to acknowledge from last 30 days', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockWhere.mockResolvedValueOnce([{ count: 5 }]);
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: '25' }] });
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: '60' }] });
      mockExecute.mockResolvedValueOnce({ rows: [] });
      mockExecute.mockResolvedValueOnce({ rows: [] });

      const result = await service.getDashboardMetrics();

      expect(result.mtta).toBe('25m');
      expect(mockExecute).toHaveBeenCalled();
    });

    it('should handle null average', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockWhere.mockResolvedValueOnce([{ count: 0 }]);
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: null }] });
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: null }] });
      mockExecute.mockResolvedValueOnce({ rows: [] });
      mockExecute.mockResolvedValueOnce({ rows: [] });

      const result = await service.getDashboardMetrics();

      expect(result.mtta).toBe('0m');
    });

    it('should handle empty result rows', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockWhere.mockResolvedValueOnce([{ count: 0 }]);
      mockExecute.mockResolvedValueOnce({ rows: [] });
      mockExecute.mockResolvedValueOnce({ rows: [] });
      mockExecute.mockResolvedValueOnce({ rows: [] });
      mockExecute.mockResolvedValueOnce({ rows: [] });

      const result = await service.getDashboardMetrics();

      expect(result.mtta).toBe('0m');
    });
  });

  describe('calculateMTTR', () => {
    it('should calculate mean time to resolve from last 30 days', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockWhere.mockResolvedValueOnce([{ count: 5 }]);
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: '15' }] });
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: '75' }] });
      mockExecute.mockResolvedValueOnce({ rows: [] });
      mockExecute.mockResolvedValueOnce({ rows: [] });

      const result = await service.getDashboardMetrics();

      expect(result.mttr).toBe('1h 15m');
    });

    it('should handle null average', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockWhere.mockResolvedValueOnce([{ count: 0 }]);
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: '0' }] });
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: null }] });
      mockExecute.mockResolvedValueOnce({ rows: [] });
      mockExecute.mockResolvedValueOnce({ rows: [] });

      const result = await service.getDashboardMetrics();

      expect(result.mttr).toBe('0m');
    });

    it('should handle empty result rows', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockWhere.mockResolvedValueOnce([{ count: 0 }]);
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: '0' }] });
      mockExecute.mockResolvedValueOnce({ rows: [] });
      mockExecute.mockResolvedValueOnce({ rows: [] });
      mockExecute.mockResolvedValueOnce({ rows: [] });

      const result = await service.getDashboardMetrics();

      expect(result.mttr).toBe('0m');
    });
  });

  describe('getSeverityBreakdown', () => {
    it('should aggregate active incidents by severity', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockWhere.mockResolvedValueOnce([{ count: 7 }]);
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: '10' }] });
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: '30' }] });
      mockExecute.mockResolvedValueOnce({
        rows: [
          { severity: 'critical', count: '3' },
          { severity: 'high', count: '2' },
          { severity: 'medium', count: '1' },
          { severity: 'low', count: '1' },
        ],
      });
      mockExecute.mockResolvedValueOnce({ rows: [] });

      const result = await service.getDashboardMetrics();

      expect(result.severityBreakdown).toEqual({
        critical: 3,
        high: 2,
        medium: 1,
        low: 1,
        info: 0,
      });
    });

    it('should initialize all severity levels to zero', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockWhere.mockResolvedValueOnce([{ count: 0 }]);
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: '0' }] });
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: '0' }] });
      mockExecute.mockResolvedValueOnce({ rows: [] });
      mockExecute.mockResolvedValueOnce({ rows: [] });

      const result = await service.getDashboardMetrics();

      expect(result.severityBreakdown).toEqual({
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
      });
    });

    it('should handle all severity levels', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockWhere.mockResolvedValueOnce([{ count: 15 }]);
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: '5' }] });
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: '20' }] });
      mockExecute.mockResolvedValueOnce({
        rows: [
          { severity: 'critical', count: '5' },
          { severity: 'high', count: '4' },
          { severity: 'medium', count: '3' },
          { severity: 'low', count: '2' },
          { severity: 'info', count: '1' },
        ],
      });
      mockExecute.mockResolvedValueOnce({ rows: [] });

      const result = await service.getDashboardMetrics();

      expect(result.severityBreakdown).toEqual({
        critical: 5,
        high: 4,
        medium: 3,
        low: 2,
        info: 1,
      });
    });
  });

  describe('getStatusBreakdown', () => {
    it('should aggregate incidents by status', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockWhere.mockResolvedValueOnce([{ count: 5 }]);
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: '10' }] });
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: '30' }] });
      mockExecute.mockResolvedValueOnce({ rows: [] });
      mockExecute.mockResolvedValueOnce({
        rows: [
          { status: 'triggered', count: '2' },
          { status: 'acknowledged', count: '3' },
          { status: 'resolved', count: '20' },
        ],
      });

      const result = await service.getDashboardMetrics();

      expect(result.statusBreakdown).toEqual({
        triggered: 2,
        acknowledged: 3,
        resolved: 20,
      });
    });

    it('should initialize all status values to zero', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockWhere.mockResolvedValueOnce([{ count: 0 }]);
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: '0' }] });
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: '0' }] });
      mockExecute.mockResolvedValueOnce({ rows: [] });
      mockExecute.mockResolvedValueOnce({ rows: [] });

      const result = await service.getDashboardMetrics();

      expect(result.statusBreakdown).toEqual({
        triggered: 0,
        acknowledged: 0,
        resolved: 0,
      });
    });

    it('should handle partial status data', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockWhere.mockResolvedValueOnce([{ count: 10 }]);
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: '15' }] });
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: '45' }] });
      mockExecute.mockResolvedValueOnce({ rows: [] });
      mockExecute.mockResolvedValueOnce({
        rows: [
          { status: 'resolved', count: '10' },
        ],
      });

      const result = await service.getDashboardMetrics();

      expect(result.statusBreakdown).toEqual({
        triggered: 0,
        acknowledged: 0,
        resolved: 10,
      });
    });
  });

  describe('getActiveIncidentsCount', () => {
    it('should count triggered and acknowledged incidents', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockWhere.mockResolvedValueOnce([{ count: 12 }]);
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: '8' }] });
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: '25' }] });
      mockExecute.mockResolvedValueOnce({ rows: [] });
      mockExecute.mockResolvedValueOnce({ rows: [] });

      const result = await service.getDashboardMetrics();

      expect(result.activeCount).toBe(12);
    });

    it('should return zero when no active incidents', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockWhere.mockResolvedValueOnce([{ count: 0 }]);
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: '0' }] });
      mockExecute.mockResolvedValueOnce({ rows: [{ avg: '0' }] });
      mockExecute.mockResolvedValueOnce({ rows: [] });
      mockExecute.mockResolvedValueOnce({ rows: [] });

      const result = await service.getDashboardMetrics();

      expect(result.activeCount).toBe(0);
    });
  });
});
