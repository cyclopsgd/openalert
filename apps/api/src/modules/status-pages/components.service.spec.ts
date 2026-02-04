import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ComponentsService } from './components.service';
import { DatabaseService } from '../../database/database.service';

describe('ComponentsService', () => {
  let service: ComponentsService;
  let db: DatabaseService;

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
      statusPageComponents: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComponentsService,
        {
          provide: DatabaseService,
          useValue: { db: mockDb },
        },
      ],
    }).compile();

    service = module.get<ComponentsService>(ComponentsService);
    db = module.get<DatabaseService>(DatabaseService);

    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ returning: mockReturning });
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ returning: mockReturning });
    mockDelete.mockReturnValue({ where: mockWhere });
  });

  describe('create', () => {
    it('should create a new component', async () => {
      const dto = {
        statusPageId: 1,
        name: 'API Server',
        description: 'Main API service',
        status: 'operational' as const,
      };

      const mockComponent = {
        id: 1,
        ...dto,
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.query.statusPageComponents.findMany.mockResolvedValue([]);
      mockReturning.mockResolvedValue([mockComponent]);

      const result = await service.create(dto);

      expect(result).toEqual(mockComponent);
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should auto-increment position if not provided', async () => {
      const dto = {
        statusPageId: 1,
        name: 'Database',
      };

      const existingComponents = [{ id: 1, position: 0 }, { id: 2, position: 1 }];

      mockDb.query.statusPageComponents.findMany.mockResolvedValue(existingComponents);
      mockReturning.mockResolvedValue([
        {
          id: 3,
          ...dto,
          position: 2,
        },
      ]);

      const result = await service.create(dto);

      expect(result.position).toBe(2);
    });

    it('should use provided position', async () => {
      const dto = {
        statusPageId: 1,
        name: 'Cache',
        position: 5,
      };

      mockDb.query.statusPageComponents.findMany.mockResolvedValue([]);
      mockReturning.mockResolvedValue([
        {
          id: 1,
          ...dto,
        },
      ]);

      const result = await service.create(dto);

      expect(result.position).toBe(5);
    });

    it('should default status to operational', async () => {
      const dto = {
        statusPageId: 1,
        name: 'New Service',
      };

      mockDb.query.statusPageComponents.findMany.mockResolvedValue([]);
      mockReturning.mockResolvedValue([
        {
          id: 1,
          ...dto,
          status: 'operational',
          position: 0,
        },
      ]);

      await service.create(dto);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'operational',
        }),
      );
    });
  });

  describe('findById', () => {
    it('should return component with status page', async () => {
      const mockComponent = {
        id: 1,
        name: 'API Server',
        status: 'operational',
        statusPage: {
          id: 1,
          name: 'Status Page',
        },
      };

      mockDb.query.statusPageComponents.findFirst.mockResolvedValue(mockComponent);

      const result = await service.findById(1);

      expect(result).toEqual(mockComponent);
    });

    it('should throw NotFoundException if component not found', async () => {
      mockDb.query.statusPageComponents.findFirst.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByStatusPage', () => {
    it('should return components ordered by position', async () => {
      const mockComponents = [
        { id: 1, name: 'API', position: 0 },
        { id: 2, name: 'Database', position: 1 },
        { id: 3, name: 'Cache', position: 2 },
      ];

      mockDb.query.statusPageComponents.findMany.mockResolvedValue(mockComponents);

      const result = await service.findByStatusPage(1);

      expect(result).toEqual(mockComponents);
      expect(result).toHaveLength(3);
    });
  });

  describe('update', () => {
    it('should update component', async () => {
      const dto = {
        name: 'Updated API Server',
        status: 'degraded_performance' as const,
      };

      const mockUpdated = {
        id: 1,
        ...dto,
        statusPageId: 1,
        updatedAt: new Date(),
      };

      mockReturning.mockResolvedValue([mockUpdated]);

      const result = await service.update(1, dto);

      expect(result).toEqual(mockUpdated);
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should throw NotFoundException if component not found', async () => {
      mockReturning.mockResolvedValue([]);

      await expect(service.update(999, { name: 'Test' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('should update only component status', async () => {
      const mockUpdated = {
        id: 1,
        name: 'API Server',
        status: 'major_outage',
      };

      mockReturning.mockResolvedValue([mockUpdated]);

      const result = await service.updateStatus(1, 'major_outage');

      expect(result.status).toBe('major_outage');
    });
  });

  describe('delete', () => {
    it('should delete component', async () => {
      mockReturning.mockResolvedValue([{ id: 1 }]);

      const result = await service.delete(1);

      expect(result).toEqual({ success: true });
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should throw NotFoundException if component not found', async () => {
      mockReturning.mockResolvedValue([]);

      await expect(service.delete(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('reorder', () => {
    it('should reorder components', async () => {
      const componentIds = [3, 1, 2];

      const updatedComponents = [
        { id: 3, position: 0 },
        { id: 1, position: 1 },
        { id: 2, position: 2 },
      ];

      mockDb.query.statusPageComponents.findMany.mockResolvedValue(updatedComponents);

      const result = await service.reorder(1, componentIds);

      expect(result).toEqual(updatedComponents);
      expect(mockUpdate).toHaveBeenCalledTimes(3);
    });
  });
});
