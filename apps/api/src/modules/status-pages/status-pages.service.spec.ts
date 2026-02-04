import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { StatusPagesService } from './status-pages.service';
import { DatabaseService } from '../../database/database.service';
import { CacheService } from '../cache/cache.service';

describe('StatusPagesService', () => {
  let service: StatusPagesService;
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
      statusPages: {
        findFirst: jest.fn(),
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
        StatusPagesService,
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

    service = module.get<StatusPagesService>(StatusPagesService);
    db = module.get<DatabaseService>(DatabaseService);
    cacheService = module.get<CacheService>(CacheService);

    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ returning: mockReturning });
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ returning: mockReturning });
    mockDelete.mockReturnValue({ where: mockWhere });
  });

  describe('create', () => {
    it('should create a new status page', async () => {
      const dto = {
        name: 'API Status',
        slug: 'api-status',
        teamId: 1,
        description: 'API service status',
        isPublic: true,
        themeColor: '#6366f1',
      };

      const mockStatusPage = {
        id: 1,
        ...dto,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.query.statusPages.findFirst.mockResolvedValue(null);
      mockReturning.mockResolvedValue([mockStatusPage]);

      const result = await service.create(dto);

      expect(result).toEqual(mockStatusPage);
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should throw ConflictException if slug already exists', async () => {
      const dto = {
        name: 'API Status',
        slug: 'existing-slug',
        teamId: 1,
      };

      mockDb.query.statusPages.findFirst.mockResolvedValue({
        id: 2,
        slug: 'existing-slug',
      });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('should use default theme color if not provided', async () => {
      const dto = {
        name: 'Test Status',
        slug: 'test-status',
        teamId: 1,
      };

      mockDb.query.statusPages.findFirst.mockResolvedValue(null);
      mockReturning.mockResolvedValue([
        {
          id: 1,
          ...dto,
          themeColor: '#6366f1',
        },
      ]);

      await service.create(dto);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          themeColor: '#6366f1',
        }),
      );
    });
  });

  describe('findById', () => {
    it('should return status page with components and incidents', async () => {
      const mockStatusPage = {
        id: 1,
        name: 'API Status',
        slug: 'api-status',
        teamId: 1,
        components: [
          { id: 1, name: 'API', status: 'operational' },
          { id: 2, name: 'Database', status: 'operational' },
        ],
        incidents: [
          {
            id: 1,
            title: 'Database Issue',
            status: 'investigating',
            updates: [{ id: 1, message: 'Investigating' }],
          },
        ],
      };

      mockDb.query.statusPages.findFirst.mockResolvedValue(mockStatusPage);

      const result = await service.findById(1);

      expect(result).toEqual(mockStatusPage);
      expect(result.components).toHaveLength(2);
      expect(result.incidents).toHaveLength(1);
    });

    it('should throw NotFoundException if status page not found', async () => {
      mockDb.query.statusPages.findFirst.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findBySlug', () => {
    it('should return cached status page if available', async () => {
      const mockStatusPage = {
        id: 1,
        slug: 'api-status',
        name: 'API Status',
      };

      mockCacheService.get.mockResolvedValue(mockStatusPage);

      const result = await service.findBySlug('api-status');

      expect(result).toEqual(mockStatusPage);
      expect(mockDb.query.statusPages.findFirst).not.toHaveBeenCalled();
    });

    it('should fetch from database and cache if not in cache', async () => {
      const mockStatusPage = {
        id: 1,
        slug: 'api-status',
        name: 'API Status',
      };

      mockCacheService.get.mockResolvedValue(null);
      mockDb.query.statusPages.findFirst.mockResolvedValue(mockStatusPage);

      const result = await service.findBySlug('api-status');

      expect(result).toEqual(mockStatusPage);
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it('should return null if status page not found', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockDb.query.statusPages.findFirst.mockResolvedValue(null);

      const result = await service.findBySlug('non-existent');

      expect(result).toBeNull();
      expect(mockCacheService.set).not.toHaveBeenCalled();
    });
  });

  describe('findByTeam', () => {
    it('should return all status pages for a team', async () => {
      const mockStatusPages = [
        { id: 1, name: 'Status 1', teamId: 1 },
        { id: 2, name: 'Status 2', teamId: 1 },
      ];

      mockDb.query.statusPages.findMany.mockResolvedValue(mockStatusPages);

      const result = await service.findByTeam(1);

      expect(result).toEqual(mockStatusPages);
      expect(result).toHaveLength(2);
    });
  });

  describe('update', () => {
    it('should update status page', async () => {
      const dto = {
        name: 'Updated Name',
        description: 'New description',
      };

      const mockUpdated = {
        id: 1,
        slug: 'test-status',
        ...dto,
        teamId: 1,
        updatedAt: new Date(),
      };

      mockDb.query.statusPages.findFirst.mockResolvedValue(null);
      mockReturning.mockResolvedValue([mockUpdated]);

      const result = await service.update(1, dto);

      expect(result).toEqual(mockUpdated);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockCacheService.del).toHaveBeenCalled();
    });

    it('should throw ConflictException if new slug already exists', async () => {
      const dto = {
        slug: 'existing-slug',
      };

      mockDb.query.statusPages.findFirst.mockResolvedValue({
        id: 2,
        slug: 'existing-slug',
      });

      await expect(service.update(1, dto)).rejects.toThrow(ConflictException);
    });

    it('should allow updating to same slug', async () => {
      const dto = {
        slug: 'same-slug',
        name: 'Updated Name',
      };

      mockDb.query.statusPages.findFirst.mockResolvedValue({
        id: 1,
        slug: 'same-slug',
      });
      mockReturning.mockResolvedValue([
        {
          id: 1,
          slug: 'same-slug',
          name: 'Updated Name',
        },
      ]);

      const result = await service.update(1, dto);

      expect(result.slug).toBe('same-slug');
    });

    it('should throw NotFoundException if status page not found', async () => {
      mockDb.query.statusPages.findFirst.mockResolvedValue(null);
      mockReturning.mockResolvedValue([]);

      await expect(service.update(999, { name: 'Test' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete status page', async () => {
      mockReturning.mockResolvedValue([{ id: 1 }]);

      const result = await service.delete(1);

      expect(result).toEqual({ success: true });
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should throw NotFoundException if status page not found', async () => {
      mockReturning.mockResolvedValue([]);

      await expect(service.delete(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getOverallStatus', () => {
    it('should return major_outage if critical incidents exist', async () => {
      const mockStatusPage = {
        id: 1,
        components: [],
        incidents: [{ id: 1, impact: 'critical', resolvedAt: null }],
      };

      mockDb.query.statusPages.findFirst.mockResolvedValue(mockStatusPage);

      const result = await service.getOverallStatus(1);

      expect(result).toBe('major_outage');
    });

    it('should return partial_outage if major incidents exist', async () => {
      const mockStatusPage = {
        id: 1,
        components: [],
        incidents: [{ id: 1, impact: 'major', resolvedAt: null }],
      };

      mockDb.query.statusPages.findFirst.mockResolvedValue(mockStatusPage);

      const result = await service.getOverallStatus(1);

      expect(result).toBe('partial_outage');
    });

    it('should return degraded_performance if minor incidents exist', async () => {
      const mockStatusPage = {
        id: 1,
        components: [],
        incidents: [{ id: 1, impact: 'minor', resolvedAt: null }],
      };

      mockDb.query.statusPages.findFirst.mockResolvedValue(mockStatusPage);

      const result = await service.getOverallStatus(1);

      expect(result).toBe('degraded_performance');
    });

    it('should check component statuses if no incidents', async () => {
      const mockStatusPage = {
        id: 1,
        components: [
          { id: 1, status: 'operational' },
          { id: 2, status: 'major_outage' },
        ],
        incidents: [],
      };

      mockDb.query.statusPages.findFirst.mockResolvedValue(mockStatusPage);

      const result = await service.getOverallStatus(1);

      expect(result).toBe('major_outage');
    });

    it('should return operational if all systems are operational', async () => {
      const mockStatusPage = {
        id: 1,
        components: [
          { id: 1, status: 'operational' },
          { id: 2, status: 'operational' },
        ],
        incidents: [],
      };

      mockDb.query.statusPages.findFirst.mockResolvedValue(mockStatusPage);

      const result = await service.getOverallStatus(1);

      expect(result).toBe('operational');
    });

    it('should return under_maintenance if any component is under maintenance', async () => {
      const mockStatusPage = {
        id: 1,
        components: [
          { id: 1, status: 'operational' },
          { id: 2, status: 'under_maintenance' },
        ],
        incidents: [],
      };

      mockDb.query.statusPages.findFirst.mockResolvedValue(mockStatusPage);

      const result = await service.getOverallStatus(1);

      expect(result).toBe('under_maintenance');
    });

    it('should throw NotFoundException if status page not found', async () => {
      mockDb.query.statusPages.findFirst.mockResolvedValue(null);

      await expect(service.getOverallStatus(999)).rejects.toThrow(NotFoundException);
    });
  });
});
