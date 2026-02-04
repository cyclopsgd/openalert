import { Test, TestingModule } from '@nestjs/testing';
import { AlertRoutingService } from './alert-routing.service';
import { DatabaseService } from '../../database/database.service';
import { CacheService } from '../cache/cache.service';

/**
 * Integration tests for Alert Routing Engine
 * These tests validate complex routing scenarios
 */
describe('AlertRoutingService Integration Tests', () => {
  let service: AlertRoutingService;

  const mockInsert = jest.fn().mockReturnThis();
  const mockValues = jest.fn();
  const mockReturning = jest.fn();
  const mockUpdate = jest.fn().mockReturnThis();
  const mockSet = jest.fn().mockReturnThis();
  const mockWhere = jest.fn().mockReturnThis();
  const mockDelete = jest.fn().mockReturnThis();

  const mockDb = {
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    query: {
      alertRoutingRules: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      alertRoutingMatches: {
        findMany: jest.fn(),
      },
    },
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    delPattern: jest.fn(),
    buildKey: jest.fn((...parts) => parts.join(':')),
  };

  // Helper to create mock alerts
  const createMockAlert = (overrides: Record<string, any> = {}): any => ({
    id: 1,
    integrationId: 1,
    severity: 'medium',
    title: 'Test Alert',
    description: '',
    source: 'prometheus',
    status: 'firing',
    labels: {},
    annotations: {},
    fingerprint: 'fp1',
    firedAt: new Date(),
    createdAt: new Date(),
    resolvedAt: null,
    acknowledgedAt: null,
    incidentId: null,
    rawPayload: null,
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertRoutingService,
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

    service = module.get<AlertRoutingService>(AlertRoutingService);

    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ returning: mockReturning });
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ returning: mockReturning });
    mockDelete.mockReturnValue({ where: mockWhere });
  });

  describe('Severity-based routing', () => {
    it('should route critical alerts to on-call team', async () => {
      const alert = createMockAlert({
        severity: 'critical',
        title: 'Production Database Down',
        description: 'Primary database is unreachable',
      });

      const rules = [
        {
          id: 1,
          name: 'Critical Alerts to On-Call',
          priority: 100,
          enabled: true,
          teamId: 1,
          conditions: { severity: ['critical'] },
          actions: {
            routeToServiceId: 5,
            escalationPolicyId: 1,
            addTags: ['urgent', 'on-call'],
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockCacheService.get.mockResolvedValue(null);
      mockDb.query.alertRoutingRules.findMany.mockResolvedValue(rules);
      mockValues.mockResolvedValue(undefined);

      const result = await service.evaluateRules(alert, 1);

      expect(result.matched).toBe(true);
      expect(result.matchedRules).toHaveLength(1);
      expect(result.actions[0]).toMatchObject({
        routeToServiceId: 5,
        escalationPolicyId: 1,
        addTags: ['urgent', 'on-call'],
      });
    });

    it('should route multiple severity levels to different services', async () => {
      const alert = createMockAlert({
        severity: 'high',
        title: 'High CPU Usage',
      });

      const rules = [
        {
          id: 2,
          name: 'High and Critical to DevOps',
          priority: 100,
          enabled: true,
          teamId: 1,
          conditions: { severity: ['critical', 'high'] },
          actions: { routeToServiceId: 10 },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockCacheService.get.mockResolvedValue(null);
      mockDb.query.alertRoutingRules.findMany.mockResolvedValue(rules);
      mockValues.mockResolvedValue(undefined);

      const result = await service.evaluateRules(alert, 1);

      expect(result.matched).toBe(true);
      expect(result.actions[0].routeToServiceId).toBe(10);
    });
  });

  describe('Label-based routing', () => {
    it('should route alerts based on environment labels', async () => {
      const alert = createMockAlert({
        title: 'API Error Rate High',
        labels: {
          env: 'production',
          service: 'api',
          region: 'us-east-1',
        },
      });

      const rules = [
        {
          id: 3,
          name: 'Production API Alerts',
          priority: 100,
          enabled: true,
          teamId: 1,
          conditions: {
            labels: {
              env: 'production',
              service: 'api',
            },
          },
          actions: {
            routeToServiceId: 15,
            setSeverity: 'high',
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockCacheService.get.mockResolvedValue(null);
      mockDb.query.alertRoutingRules.findMany.mockResolvedValue(rules);
      mockValues.mockResolvedValue(undefined);

      const result = await service.evaluateRules(alert, 1);

      expect(result.matched).toBe(true);
      expect(result.actions[0]).toMatchObject({
        routeToServiceId: 15,
        setSeverity: 'high',
      });
    });

    it('should not match when labels do not match exactly', async () => {
      const alert = createMockAlert({
        labels: {
          env: 'staging',
          service: 'api',
        },
      });

      const rules = [
        {
          id: 4,
          name: 'Production Only',
          priority: 100,
          enabled: true,
          teamId: 1,
          conditions: {
            labels: {
              env: 'production',
            },
          },
          actions: { routeToServiceId: 20 },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockCacheService.get.mockResolvedValue(null);
      mockDb.query.alertRoutingRules.findMany.mockResolvedValue(rules);

      const result = await service.evaluateRules(alert, 1);

      expect(result.matched).toBe(false);
    });
  });

  describe('Pattern matching', () => {
    it('should match alerts using titleContains', async () => {
      const alert = createMockAlert({
        title: 'Disk space running low on server-01',
      });

      const rules = [
        {
          id: 5,
          name: 'Disk Space Alerts',
          priority: 100,
          enabled: true,
          teamId: 1,
          conditions: {
            titleContains: 'disk space',
          },
          actions: { routeToServiceId: 25 },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockCacheService.get.mockResolvedValue(null);
      mockDb.query.alertRoutingRules.findMany.mockResolvedValue(rules);
      mockValues.mockResolvedValue(undefined);

      const result = await service.evaluateRules(alert, 1);

      expect(result.matched).toBe(true);
    });

    it('should match alerts using regex in description', async () => {
      const alert = createMockAlert({
        title: 'Error',
        description: 'Connection timeout error: failed to connect to database at 192.168.1.100',
      });

      const rules = [
        {
          id: 6,
          name: 'Database Connection Errors',
          priority: 100,
          enabled: true,
          teamId: 1,
          conditions: {
            descriptionMatches: 'timeout.*database',
          },
          actions: { routeToServiceId: 30 },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockCacheService.get.mockResolvedValue(null);
      mockDb.query.alertRoutingRules.findMany.mockResolvedValue(rules);
      mockValues.mockResolvedValue(undefined);

      const result = await service.evaluateRules(alert, 1);

      expect(result.matched).toBe(true);
    });

    it('should handle invalid regex gracefully', async () => {
      const alert = createMockAlert({
        description: 'Test description',
      });

      const rules = [
        {
          id: 7,
          name: 'Invalid Regex',
          priority: 100,
          enabled: true,
          teamId: 1,
          conditions: {
            descriptionMatches: '[invalid(regex',
          },
          actions: { routeToServiceId: 35 },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockCacheService.get.mockResolvedValue(null);
      mockDb.query.alertRoutingRules.findMany.mockResolvedValue(rules);

      const result = await service.evaluateRules(alert, 1);

      expect(result.matched).toBe(false);
    });
  });

  describe('Priority ordering', () => {
    it('should evaluate rules in priority order', async () => {
      const alert = createMockAlert({
        severity: 'critical',
        title: 'Production Database Down',
        labels: { env: 'production' },
      });

      const rules = [
        {
          id: 9,
          name: 'Low Priority Rule',
          priority: 10,
          enabled: true,
          teamId: 1,
          conditions: { severity: ['critical'] },
          actions: { routeToServiceId: 100 },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 8,
          name: 'High Priority Rule',
          priority: 100,
          enabled: true,
          teamId: 1,
          conditions: { severity: ['critical'], labels: { env: 'production' } },
          actions: { routeToServiceId: 200 },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Rules should be returned in priority order (high to low)
      const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

      mockCacheService.get.mockResolvedValue(null);
      mockDb.query.alertRoutingRules.findMany.mockResolvedValue(sortedRules);
      mockValues.mockResolvedValue(undefined);

      const result = await service.evaluateRules(alert, 1);

      expect(result.matched).toBe(true);
      expect(result.matchedRules[0].id).toBe(8); // Higher priority rule
      expect(result.actions[0].routeToServiceId).toBe(200);
    });

    it('should stop at first match', async () => {
      const alert = createMockAlert({
        severity: 'high',
      });

      const rules = [
        {
          id: 10,
          name: 'First Match',
          priority: 100,
          enabled: true,
          teamId: 1,
          conditions: { severity: ['high'] },
          actions: { routeToServiceId: 300 },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 11,
          name: 'Second Match',
          priority: 50,
          enabled: true,
          teamId: 1,
          conditions: { severity: ['high'] },
          actions: { routeToServiceId: 400 },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockCacheService.get.mockResolvedValue(null);
      mockDb.query.alertRoutingRules.findMany.mockResolvedValue(rules);
      mockValues.mockResolvedValue(undefined);

      const result = await service.evaluateRules(alert, 1);

      expect(result.matched).toBe(true);
      expect(result.matchedRules).toHaveLength(1);
      expect(result.matchedRules[0].id).toBe(10);
    });
  });

  describe('Default routes', () => {
    it('should match rule with no conditions (catch-all)', async () => {
      const alert = createMockAlert({
        severity: 'low',
        title: 'Random Alert',
        source: 'custom',
      });

      const rules = [
        {
          id: 12,
          name: 'Default Route',
          priority: 0,
          enabled: true,
          teamId: 1,
          conditions: {},
          actions: { routeToServiceId: 999 },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockCacheService.get.mockResolvedValue(null);
      mockDb.query.alertRoutingRules.findMany.mockResolvedValue(rules);
      mockValues.mockResolvedValue(undefined);

      const result = await service.evaluateRules(alert, 1);

      expect(result.matched).toBe(true);
      expect(result.actions[0].routeToServiceId).toBe(999);
    });
  });

  describe('Source-based routing', () => {
    it('should route Grafana alerts differently from Prometheus', async () => {
      const alert = createMockAlert({
        title: 'Alert from Grafana',
        source: 'grafana',
      });

      const rules = [
        {
          id: 13,
          name: 'Grafana Alerts',
          priority: 100,
          enabled: true,
          teamId: 1,
          conditions: { source: 'grafana' },
          actions: { routeToServiceId: 50, addTags: ['grafana-alert'] },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockCacheService.get.mockResolvedValue(null);
      mockDb.query.alertRoutingRules.findMany.mockResolvedValue(rules);
      mockValues.mockResolvedValue(undefined);

      const result = await service.evaluateRules(alert, 1);

      expect(result.matched).toBe(true);
      expect(result.actions[0]).toMatchObject({
        routeToServiceId: 50,
        addTags: ['grafana-alert'],
      });
    });
  });

  describe('Combined conditions', () => {
    it('should match only when all conditions are met', async () => {
      const alert = createMockAlert({
        severity: 'critical',
        title: 'Database connection lost',
        source: 'prometheus',
        labels: {
          env: 'production',
          service: 'database',
        },
      });

      const rules = [
        {
          id: 14,
          name: 'Production DB Critical',
          priority: 100,
          enabled: true,
          teamId: 1,
          conditions: {
            severity: ['critical'],
            source: 'prometheus',
            labels: {
              env: 'production',
              service: 'database',
            },
            titleContains: 'database',
          },
          actions: {
            routeToServiceId: 60,
            escalationPolicyId: 2,
            setSeverity: 'critical',
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockCacheService.get.mockResolvedValue(null);
      mockDb.query.alertRoutingRules.findMany.mockResolvedValue(rules);
      mockValues.mockResolvedValue(undefined);

      const result = await service.evaluateRules(alert, 1);

      expect(result.matched).toBe(true);
      expect(result.actions[0]).toMatchObject({
        routeToServiceId: 60,
        escalationPolicyId: 2,
        setSeverity: 'critical',
      });
    });

    it('should not match when any condition fails', async () => {
      const alert = createMockAlert({
        severity: 'critical',
        title: 'Database connection lost',
        labels: {
          env: 'staging', // Wrong environment
          service: 'database',
        },
      });

      const rules = [
        {
          id: 15,
          name: 'Production DB Critical',
          priority: 100,
          enabled: true,
          teamId: 1,
          conditions: {
            severity: ['critical'],
            labels: {
              env: 'production',
            },
          },
          actions: { routeToServiceId: 70 },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockCacheService.get.mockResolvedValue(null);
      mockDb.query.alertRoutingRules.findMany.mockResolvedValue(rules);

      const result = await service.evaluateRules(alert, 1);

      expect(result.matched).toBe(false);
    });
  });

  describe('Suppression actions', () => {
    it('should suppress matching alerts', async () => {
      const alert = createMockAlert({
        severity: 'low',
        title: 'Noisy test alert',
        source: 'test',
        labels: { type: 'test' },
      });

      const rules = [
        {
          id: 16,
          name: 'Suppress Test Alerts',
          priority: 100,
          enabled: true,
          teamId: 1,
          conditions: {
            labels: { type: 'test' },
          },
          actions: { suppress: true },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockCacheService.get.mockResolvedValue(null);
      mockDb.query.alertRoutingRules.findMany.mockResolvedValue(rules);
      mockValues.mockResolvedValue(undefined);

      const result = await service.evaluateRules(alert, 1);

      expect(result.matched).toBe(true);
      expect(result.actions[0].suppress).toBe(true);
    });
  });
});
