import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AlertRoutingService } from './alert-routing.service';
import { DatabaseService } from '../../database/database.service';
import { CacheService } from '../cache/cache.service';

describe('AlertRoutingService', () => {
  let service: AlertRoutingService;
  let db: DatabaseService;
  let cacheService: CacheService;

  const mockInsert = jest.fn().mockReturnThis();
  const mockValues = jest.fn().mockReturnThis();
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
    db = module.get<DatabaseService>(DatabaseService);
    cacheService = module.get<CacheService>(CacheService);

    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ returning: mockReturning });
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ returning: mockReturning });
    mockDelete.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ returning: mockReturning });
  });

  describe('create', () => {
    it('should create a new routing rule', async () => {
      const dto = {
        name: 'Route Critical Alerts',
        priority: 100,
        enabled: true,
        teamId: 1,
        conditions: { severity: ['critical'] },
        actions: { routeToServiceId: 5 },
      };

      const mockRule = {
        id: 1,
        ...dto,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockReturning.mockResolvedValue([mockRule]);

      const result = await service.create(dto);

      expect(result).toEqual(mockRule);
      expect(mockInsert).toHaveBeenCalled();
      expect(mockCacheService.delPattern).toHaveBeenCalledWith('openalert:routing:*:1');
    });
  });

  describe('findByTeam', () => {
    it('should return all routing rules for a team', async () => {
      const mockRules = [
        {
          id: 1,
          name: 'Rule 1',
          teamId: 1,
          priority: 100,
          enabled: true,
        },
        {
          id: 2,
          name: 'Rule 2',
          teamId: 1,
          priority: 50,
          enabled: true,
        },
      ];

      mockDb.query.alertRoutingRules.findMany.mockResolvedValue(mockRules);

      const result = await service.findByTeam(1);

      expect(result).toEqual(mockRules);
      expect(mockDb.query.alertRoutingRules.findMany).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return a routing rule by ID', async () => {
      const mockRule = {
        id: 1,
        name: 'Test Rule',
        teamId: 1,
        priority: 100,
        enabled: true,
      };

      mockDb.query.alertRoutingRules.findFirst.mockResolvedValue(mockRule);

      const result = await service.findById(1);

      expect(result).toEqual(mockRule);
    });

    it('should throw NotFoundException if rule not found', async () => {
      mockDb.query.alertRoutingRules.findFirst.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a routing rule', async () => {
      const dto = {
        name: 'Updated Rule',
        priority: 200,
      };

      const mockUpdated = {
        id: 1,
        ...dto,
        teamId: 1,
        enabled: true,
        updatedAt: new Date(),
      };

      mockReturning.mockResolvedValue([mockUpdated]);

      const result = await service.update(1, dto);

      expect(result).toEqual(mockUpdated);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockCacheService.delPattern).toHaveBeenCalled();
    });

    it('should throw NotFoundException if rule not found', async () => {
      mockReturning.mockResolvedValue([]);

      await expect(service.update(999, { name: 'Test' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete a routing rule', async () => {
      mockReturning.mockResolvedValue([{ id: 1, teamId: 1 }]);

      await service.delete(1);

      expect(mockDelete).toHaveBeenCalled();
      expect(mockCacheService.delPattern).toHaveBeenCalled();
    });

    it('should throw NotFoundException if rule not found', async () => {
      mockReturning.mockResolvedValue([]);

      await expect(service.delete(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('evaluateRules', () => {
    it('should match alert with severity condition', async () => {
      const alert: any = {
        id: 1,
        severity: 'critical',
        title: 'Test Alert',
        source: 'prometheus',
        labels: {},
      };

      const mockRules = [
        {
          id: 1,
          name: 'Critical Alerts',
          priority: 100,
          enabled: true,
          teamId: 1,
          conditions: { severity: ['critical'] },
          actions: { routeToServiceId: 5 },
        },
      ];

      mockCacheService.get.mockResolvedValue(null);
      mockDb.query.alertRoutingRules.findMany.mockResolvedValue(mockRules);
      mockInsert.mockReturnValue({
        values: jest.fn().mockResolvedValue(undefined),
      });

      const result = await service.evaluateRules(alert, 1);

      expect(result.matched).toBe(true);
      expect(result.matchedRules).toHaveLength(1);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].routeToServiceId).toBe(5);
    });

    it('should match alert with label conditions', async () => {
      const alert: any = {
        id: 2,
        severity: 'high',
        title: 'Database Alert',
        source: 'prometheus',
        labels: { env: 'production', service: 'database' },
      };

      const mockRules = [
        {
          id: 2,
          name: 'Production Database Alerts',
          priority: 100,
          enabled: true,
          teamId: 1,
          conditions: {
            labels: { env: 'production', service: 'database' },
          },
          actions: { setSeverity: 'critical' },
        },
      ];

      mockCacheService.get.mockResolvedValue(null);
      mockDb.query.alertRoutingRules.findMany.mockResolvedValue(mockRules);
      mockInsert.mockReturnValue({
        values: jest.fn().mockResolvedValue(undefined),
      });

      const result = await service.evaluateRules(alert, 1);

      expect(result.matched).toBe(true);
      expect(result.actions[0].setSeverity).toBe('critical');
    });

    it('should match alert with source condition', async () => {
      const alert: any = {
        id: 3,
        severity: 'medium',
        title: 'Test Alert',
        source: 'grafana',
        labels: {},
      };

      const mockRules = [
        {
          id: 3,
          name: 'Grafana Alerts',
          priority: 100,
          enabled: true,
          teamId: 1,
          conditions: { source: 'grafana' },
          actions: { addTags: ['grafana'] },
        },
      ];

      mockCacheService.get.mockResolvedValue(null);
      mockDb.query.alertRoutingRules.findMany.mockResolvedValue(mockRules);
      mockInsert.mockReturnValue({
        values: jest.fn().mockResolvedValue(undefined),
      });

      const result = await service.evaluateRules(alert, 1);

      expect(result.matched).toBe(true);
      expect(result.actions[0].addTags).toContain('grafana');
    });

    it('should match alert with titleContains condition', async () => {
      const alert: any = {
        id: 4,
        severity: 'low',
        title: 'Disk Space Warning',
        source: 'prometheus',
        labels: {},
      };

      const mockRules = [
        {
          id: 4,
          name: 'Disk Space Alerts',
          priority: 100,
          enabled: true,
          teamId: 1,
          conditions: { titleContains: 'disk space' },
          actions: { routeToServiceId: 10 },
        },
      ];

      mockCacheService.get.mockResolvedValue(null);
      mockDb.query.alertRoutingRules.findMany.mockResolvedValue(mockRules);
      mockInsert.mockReturnValue({
        values: jest.fn().mockResolvedValue(undefined),
      });

      const result = await service.evaluateRules(alert, 1);

      expect(result.matched).toBe(true);
    });

    it('should not match when conditions do not match', async () => {
      const alert: any = {
        id: 5,
        severity: 'info',
        title: 'Test Alert',
        source: 'prometheus',
        labels: {},
      };

      const mockRules = [
        {
          id: 5,
          name: 'Critical Only',
          priority: 100,
          enabled: true,
          teamId: 1,
          conditions: { severity: ['critical'] },
          actions: { routeToServiceId: 5 },
        },
      ];

      mockCacheService.get.mockResolvedValue(null);
      mockDb.query.alertRoutingRules.findMany.mockResolvedValue(mockRules);

      const result = await service.evaluateRules(alert, 1);

      expect(result.matched).toBe(false);
      expect(result.matchedRules).toHaveLength(0);
      expect(result.actions).toHaveLength(0);
    });

    it('should return matched when no conditions specified', async () => {
      const alert: any = {
        id: 6,
        severity: 'medium',
        title: 'Test Alert',
        source: 'prometheus',
        labels: {},
      };

      const mockRules = [
        {
          id: 6,
          name: 'Match All',
          priority: 100,
          enabled: true,
          teamId: 1,
          conditions: {},
          actions: { suppress: true },
        },
      ];

      mockCacheService.get.mockResolvedValue(null);
      mockDb.query.alertRoutingRules.findMany.mockResolvedValue(mockRules);
      mockInsert.mockReturnValue({
        values: jest.fn().mockResolvedValue(undefined),
      });

      const result = await service.evaluateRules(alert, 1);

      expect(result.matched).toBe(true);
      expect(result.actions[0].suppress).toBe(true);
    });
  });

  describe('testRule', () => {
    it('should test rule conditions against sample alert', () => {
      const conditions = {
        severity: ['critical', 'high'],
        source: 'prometheus',
      };

      const sampleAlert = {
        severity: 'critical',
        source: 'prometheus',
        title: 'Test',
      };

      const result = service.testRule(conditions, sampleAlert);

      expect(result.matches).toBe(true);
      expect(result.reason).toContain('matched');
    });

    it('should return no match when conditions fail', () => {
      const conditions = {
        severity: ['critical'],
      };

      const sampleAlert = {
        severity: 'low',
        source: 'prometheus',
        title: 'Test',
      };

      const result = service.testRule(conditions, sampleAlert);

      expect(result.matches).toBe(false);
      expect(result.reason).toContain('did not match');
    });
  });

  describe('getMatchesByRule', () => {
    it('should return alerts matched by a rule', async () => {
      const mockMatches = [
        {
          id: 1,
          ruleId: 1,
          alertId: 10,
          matchedAt: new Date(),
          alert: { id: 10, title: 'Test Alert 1' },
        },
        {
          id: 2,
          ruleId: 1,
          alertId: 11,
          matchedAt: new Date(),
          alert: { id: 11, title: 'Test Alert 2' },
        },
      ];

      mockDb.query.alertRoutingMatches.findMany.mockResolvedValue(mockMatches);

      const result = await service.getMatchesByRule(1);

      expect(result).toEqual(mockMatches);
      expect(result).toHaveLength(2);
    });

    it('should apply limit parameter', async () => {
      mockDb.query.alertRoutingMatches.findMany.mockResolvedValue([]);

      await service.getMatchesByRule(1, 10);

      expect(mockDb.query.alertRoutingMatches.findMany).toHaveBeenCalled();
    });
  });

  describe('updatePriority', () => {
    it('should update rule priority', async () => {
      const mockUpdated = {
        id: 1,
        priority: 500,
        teamId: 1,
      };

      mockReturning.mockResolvedValue([mockUpdated]);

      const result = await service.updatePriority(1, 500);

      expect(result.priority).toBe(500);
      expect(mockUpdate).toHaveBeenCalled();
    });
  });
});
