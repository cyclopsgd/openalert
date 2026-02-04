import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { ServicesService } from './services.service';
import { DatabaseService } from '../../database/database.service';
import { CacheService, CACHE_PREFIX, CACHE_TTL } from '../cache/cache.service';
import { ServiceStatus } from './dto/create-service.dto';

describe('ServicesService', () => {
  let service: ServicesService;
  let mockDb: any;
  let mockCacheService: any;

  beforeEach(async () => {
    // Create fresh mocks for each test
    mockDb = {
      db: {
        select: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delPattern: jest.fn(),
      buildKey: jest.fn((...parts) => parts.join(':')),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicesService,
        {
          provide: DatabaseService,
          useValue: mockDb,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<ServicesService>(ServicesService);
  });

  // Helper to create a query chain mock
  const createQueryChain = (result: any) => ({
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue(result),
        innerJoin: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(result),
        }),
        groupBy: jest.fn().mockResolvedValue(result),
        orderBy: jest.fn().mockResolvedValue(result),
      }),
      limit: jest.fn().mockResolvedValue(result),
      innerJoin: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(result),
        innerJoin: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(result),
        }),
      }),
      groupBy: jest.fn().mockResolvedValue(result),
      orderBy: jest.fn().mockResolvedValue(result),
    }),
  });

  describe('create', () => {
    const createDto = {
      name: 'API Service',
      description: 'Main API service',
      teamId: 1,
      escalationPolicyId: 1,
      status: ServiceStatus.OPERATIONAL,
    };

    it('should create a service with auto-generated slug', async () => {
      const mockService = {
        id: 1,
        name: createDto.name,
        slug: 'api-service',
        description: createDto.description,
        teamId: createDto.teamId,
        escalationPolicyId: createDto.escalationPolicyId,
        status: createDto.status,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Check slug doesn't exist
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));

      // Verify team exists
      mockDb.db.select.mockReturnValueOnce(createQueryChain([{ id: 1, name: 'Team 1' }]));

      // Create service
      mockDb.db.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockService]),
        }),
      });

      // Mock findOne response
      mockDb.db.select.mockReturnValueOnce(createQueryChain([mockService]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([])); // dependencies
      mockDb.db.select.mockReturnValueOnce(createQueryChain([])); // dependents
      mockDb.db.select.mockReturnValueOnce(createQueryChain([])); // activeIncidents

      mockCacheService.delPattern.mockResolvedValue(undefined);

      const result = await service.create(createDto);

      expect(result).toMatchObject({
        id: 1,
        name: createDto.name,
        slug: 'api-service',
      });
      expect(mockDb.db.insert).toHaveBeenCalled();
      expect(mockCacheService.delPattern).toHaveBeenCalledWith(`${CACHE_PREFIX.SERVICES}:*`);
    });

    it('should create a service with custom slug', async () => {
      const dtoWithSlug = {
        ...createDto,
        slug: 'custom-api',
      };

      const mockService = {
        id: 2,
        ...dtoWithSlug,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Check slug doesn't exist
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));

      // Verify team exists
      mockDb.db.select.mockReturnValueOnce(createQueryChain([{ id: 1, name: 'Team 1' }]));

      // Create service
      mockDb.db.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockService]),
        }),
      });

      // Mock findOne
      mockDb.db.select.mockReturnValueOnce(createQueryChain([mockService]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));

      mockCacheService.delPattern.mockResolvedValue(undefined);

      const result = await service.create(dtoWithSlug);

      expect(result.slug).toBe('custom-api');
    });

    it('should throw ConflictException if slug already exists', async () => {
      // Slug already exists - need two calls for the two expect statements
      mockDb.db.select.mockReturnValue(createQueryChain([{ id: 999, slug: 'api-service' }]));

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);

      // Reset mock for second expect
      mockDb.db.select.mockReturnValue(createQueryChain([{ id: 999, slug: 'api-service' }]));
      await expect(service.create(createDto)).rejects.toThrow(
        'Service with slug "api-service" already exists',
      );
    });

    it('should throw NotFoundException if team does not exist', async () => {
      // Check slug doesn't exist
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));

      // Team doesn't exist
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);

      // Reset mocks for second expect
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      await expect(service.create(createDto)).rejects.toThrow(
        `Team with ID ${createDto.teamId} not found`,
      );
    });

    it('should create a service with dependencies', async () => {
      const dtoWithDeps = {
        ...createDto,
        dependencyIds: [2, 3],
      };

      const mockService = {
        id: 1,
        name: dtoWithDeps.name,
        slug: 'api-service',
        teamId: dtoWithDeps.teamId,
        status: dtoWithDeps.status,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Check slug doesn't exist
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));

      // Verify team exists
      mockDb.db.select.mockReturnValueOnce(createQueryChain([{ id: 1 }]));

      // Create service
      mockDb.db.insert.mockReturnValueOnce({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockService]),
        }),
      });

      // Mock addDependencies - verify dependency services exist
      mockDb.db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([
            { id: 2, name: 'Service 2' },
            { id: 3, name: 'Service 3' },
          ]),
        }),
      });

      // Check for circular dependencies (will traverse dependency graph)
      mockDb.db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });
      mockDb.db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      // Add dependencies
      mockDb.db.insert.mockReturnValueOnce({
        values: jest.fn().mockResolvedValue(undefined),
      });

      // Mock findOne
      mockDb.db.select.mockReturnValueOnce(createQueryChain([mockService]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([
        { id: 1, dependsOnService: { id: 2, name: 'Service 2' } },
        { id: 2, dependsOnService: { id: 3, name: 'Service 3' } },
      ]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));

      mockCacheService.delPattern.mockResolvedValue(undefined);

      const result = await service.create(dtoWithDeps);

      expect(result.id).toBe(1);
      expect(mockDb.db.insert).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all services with incident and dependency counts', async () => {
      const mockServices = [
        {
          id: 1,
          name: 'Service 1',
          slug: 'service-1',
          teamId: 1,
          status: 'operational',
        },
        {
          id: 2,
          name: 'Service 2',
          slug: 'service-2',
          teamId: 1,
          status: 'degraded',
        },
      ];

      const mockIncidentCounts = [
        { serviceId: 1, count: 2 },
        { serviceId: 2, count: 5 },
      ];

      const mockDependencyCounts = [
        { serviceId: 1, count: 1 },
        { serviceId: 2, count: 0 },
      ];

      mockCacheService.get.mockResolvedValue(null);

      // Return services
      mockDb.db.select.mockReturnValueOnce({
        from: jest.fn().mockResolvedValue(mockServices),
      });

      // Return incident counts
      mockDb.db.select.mockReturnValueOnce(createQueryChain(mockIncidentCounts));

      // Return dependency counts
      mockDb.db.select.mockReturnValueOnce(createQueryChain(mockDependencyCounts));

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 1,
        name: 'Service 1',
        activeIncidentCount: 2,
        dependencyCount: 1,
      });
      expect(result[1]).toMatchObject({
        id: 2,
        name: 'Service 2',
        activeIncidentCount: 5,
        dependencyCount: 0,
      });
      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.any(String),
        result,
        CACHE_TTL.SERVICES_LIST,
      );
    });

    it('should return cached services if available', async () => {
      const cachedServices = [
        { id: 1, name: 'Cached Service', activeIncidentCount: 1, dependencyCount: 0 },
      ];

      mockCacheService.get.mockResolvedValue(cachedServices);

      const result = await service.findAll();

      expect(result).toEqual(cachedServices);
      expect(mockDb.db.select).not.toHaveBeenCalled();
      expect(mockCacheService.set).not.toHaveBeenCalled();
    });

    it('should filter by teamId when provided', async () => {
      const mockServices = [
        { id: 1, name: 'Service 1', teamId: 1 },
      ];

      mockCacheService.get.mockResolvedValue(null);

      // Create a query object that is thenable (can be awaited) and has a where method
      const queryObject = {
        where: jest.fn().mockReturnThis(),
        then: (resolve: any) => resolve(mockServices), // Make it thenable
      };

      mockDb.db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue(queryObject),
      });

      // Incident and dependency counts
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));

      const result = await service.findAll(1);

      expect(result).toHaveLength(1);
      expect(queryObject.where).toHaveBeenCalled();
    });

    it('should return empty array if no services found', async () => {
      mockCacheService.get.mockResolvedValue(null);

      mockDb.db.select.mockReturnValueOnce({
        from: jest.fn().mockResolvedValue([]),
      });

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a service with dependencies, dependents, and active incidents', async () => {
      const mockService = {
        id: 1,
        name: 'API Service',
        slug: 'api-service',
        teamId: 1,
        status: 'operational',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockDependencies = [
        {
          id: 1,
          serviceId: 1,
          dependsOnServiceId: 2,
          dependsOnService: { id: 2, name: 'Database Service', status: 'operational' },
        },
      ];

      const mockDependents = [
        {
          id: 2,
          serviceId: 3,
          dependsOnServiceId: 1,
          dependentService: { id: 3, name: 'Frontend Service', status: 'operational' },
        },
      ];

      const mockActiveIncidents = [
        {
          id: 10,
          serviceId: 1,
          title: 'High latency',
          status: 'triggered',
          severity: 'high',
        },
      ];

      mockDb.db.select.mockReturnValueOnce(createQueryChain([mockService]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain(mockDependencies));
      mockDb.db.select.mockReturnValueOnce(createQueryChain(mockDependents));
      mockDb.db.select.mockReturnValueOnce(createQueryChain(mockActiveIncidents));

      const result = await service.findOne(1);

      expect(result).toMatchObject({
        id: 1,
        name: 'API Service',
      });
      expect(result.dependencies).toHaveLength(1);
      expect(result.dependencies[0].service.name).toBe('Database Service');
      expect(result.dependents).toHaveLength(1);
      expect(result.dependents[0].service.name).toBe('Frontend Service');
      expect(result.activeIncidents).toHaveLength(1);
    });

    it('should throw NotFoundException if service not found', async () => {
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);

      // Reset for second expect
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      await expect(service.findOne(999)).rejects.toThrow(
        'Service with ID 999 not found',
      );
    });
  });

  describe('update', () => {
    const mockExistingService = {
      id: 1,
      name: 'Old Service',
      slug: 'old-service',
      teamId: 1,
      status: 'operational',
      dependencies: [],
      dependents: [],
      activeIncidents: [],
    };

    it('should update service basic fields', async () => {
      const updateDto = {
        name: 'Updated Service',
        description: 'Updated description',
      };

      // Mock findOne for existing service
      mockDb.db.select.mockReturnValueOnce(createQueryChain([mockExistingService]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));

      // Mock update
      mockDb.db.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined),
        }),
      });

      // Mock final findOne
      const updatedService = { ...mockExistingService, ...updateDto };
      mockDb.db.select.mockReturnValueOnce(createQueryChain([updatedService]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));

      mockCacheService.delPattern.mockResolvedValue(undefined);

      const result = await service.update(1, updateDto);

      expect(mockDb.db.update).toHaveBeenCalled();
      expect(mockCacheService.delPattern).toHaveBeenCalled();
    });

    it('should throw ConflictException if new slug already exists', async () => {
      const updateDto = {
        slug: 'existing-slug',
      };

      // First findOne
      mockDb.db.select.mockReturnValueOnce(createQueryChain([mockExistingService]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));

      // Slug conflict found
      mockDb.db.select.mockReturnValueOnce(createQueryChain([{ id: 999, slug: 'existing-slug' }]));

      await expect(service.update(1, updateDto)).rejects.toThrow(ConflictException);

      // Reset mocks for second expect
      mockDb.db.select.mockReturnValueOnce(createQueryChain([mockExistingService]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([{ id: 999, slug: 'existing-slug' }]));
      await expect(service.update(1, updateDto)).rejects.toThrow(
        'Service with slug "existing-slug" already exists',
      );
    });

    it('should update dependencies when provided', async () => {
      const updateDto = {
        dependencyIds: [2, 3],
      };

      // First findOne
      mockDb.db.select.mockReturnValueOnce(createQueryChain([mockExistingService]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));

      // Delete existing dependencies
      mockDb.db.delete.mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      });

      // Verify dependency services exist
      mockDb.db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ id: 2 }, { id: 3 }]),
        }),
      });

      // Check for circular dependencies
      mockDb.db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });
      mockDb.db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      // Insert new dependencies
      mockDb.db.insert.mockReturnValue({
        values: jest.fn().mockResolvedValue(undefined),
      });

      // Final findOne
      mockDb.db.select.mockReturnValueOnce(createQueryChain([mockExistingService]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([
        { id: 1, dependsOnService: { id: 2, name: 'Service 2' } },
        { id: 2, dependsOnService: { id: 3, name: 'Service 3' } },
      ]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));

      mockCacheService.delPattern.mockResolvedValue(undefined);

      const result = await service.update(1, updateDto);

      expect(mockDb.db.delete).toHaveBeenCalled();
      expect(mockDb.db.insert).toHaveBeenCalled();
    });

    it('should clear dependencies when empty array provided', async () => {
      const updateDto = {
        dependencyIds: [],
      };

      // First findOne
      mockDb.db.select.mockReturnValueOnce(createQueryChain([mockExistingService]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));

      // Delete existing dependencies
      mockDb.db.delete.mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      });

      // Final findOne
      mockDb.db.select.mockReturnValueOnce(createQueryChain([mockExistingService]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));

      mockCacheService.delPattern.mockResolvedValue(undefined);

      await service.update(1, updateDto);

      expect(mockDb.db.delete).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should delete a service', async () => {
      const mockService = {
        id: 1,
        name: 'Service to Delete',
        dependencies: [],
        dependents: [],
        activeIncidents: [],
      };

      // Mock findOne
      mockDb.db.select.mockReturnValueOnce(createQueryChain([mockService]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));

      // Mock delete
      mockDb.db.delete.mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      });

      mockCacheService.delPattern.mockResolvedValue(undefined);

      const result = await service.remove(1);

      expect(result).toEqual({
        deleted: true,
        service: mockService,
      });
      expect(mockDb.db.delete).toHaveBeenCalled();
      expect(mockCacheService.delPattern).toHaveBeenCalled();
    });

    it('should throw NotFoundException if service not found', async () => {
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('addDependency', () => {
    it('should add a dependency between two services', async () => {
      const mockService1 = { id: 1, name: 'Service 1', dependencies: [], dependents: [], activeIncidents: [] };
      const mockService2 = { id: 2, name: 'Service 2', dependencies: [], dependents: [], activeIncidents: [] };

      // Verify both services exist
      mockDb.db.select.mockReturnValueOnce(createQueryChain([mockService1]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));

      mockDb.db.select.mockReturnValueOnce(createQueryChain([mockService2]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));

      // Check if dependency already exists
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));

      // Check for circular dependencies
      mockDb.db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      // Add dependency
      const mockDependency = { id: 1, serviceId: 1, dependsOnServiceId: 2 };
      mockDb.db.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockDependency]),
        }),
      });

      const result = await service.addDependency(1, 2);

      expect(result).toEqual(mockDependency);
      expect(mockDb.db.insert).toHaveBeenCalled();
    });

    it('should throw BadRequestException for self-dependency', async () => {
      const mockService = { id: 1, dependencies: [], dependents: [], activeIncidents: [] };

      // findOne is called twice (for serviceId and dependsOnServiceId)
      mockDb.db.select.mockReturnValueOnce(createQueryChain([mockService]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));

      mockDb.db.select.mockReturnValueOnce(createQueryChain([mockService]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));

      await expect(service.addDependency(1, 1)).rejects.toThrow('A service cannot depend on itself');
    });

    it('should throw ConflictException if dependency already exists', async () => {
      const mockService = { id: 1, dependencies: [], dependents: [], activeIncidents: [] };

      // Verify both services exist
      mockDb.db.select.mockReturnValueOnce(createQueryChain([mockService]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));

      mockDb.db.select.mockReturnValueOnce(createQueryChain([mockService]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));

      // Dependency already exists
      mockDb.db.select.mockReturnValueOnce(createQueryChain([{ id: 1, serviceId: 1, dependsOnServiceId: 2 }]));

      await expect(service.addDependency(1, 2)).rejects.toThrow(ConflictException);

      // Reset for second expect
      mockDb.db.select.mockReturnValueOnce(createQueryChain([mockService]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([mockService]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([{ id: 1, serviceId: 1, dependsOnServiceId: 2 }]));
      await expect(service.addDependency(1, 2)).rejects.toThrow(
        'This dependency already exists',
      );
    });

    it('should throw BadRequestException if circular dependency would be created', async () => {
      const mockService1 = { id: 1, name: 'Service 1', dependencies: [], dependents: [], activeIncidents: [] };
      const mockService2 = { id: 2, name: 'Service 2', dependencies: [], dependents: [], activeIncidents: [] };

      // Verify both services exist
      mockDb.db.select.mockReturnValueOnce(createQueryChain([mockService1]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));

      mockDb.db.select.mockReturnValueOnce(createQueryChain([mockService2]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));

      // Check if dependency already exists
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));

      // Check for circular dependencies - service 2 depends on service 1
      mockDb.db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ serviceId: 2, dependsOnServiceId: 1 }]),
        }),
      });

      await expect(service.addDependency(1, 2)).rejects.toThrow(BadRequestException);

      // Reset for second expect
      mockDb.db.select.mockReturnValueOnce(createQueryChain([mockService1]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([mockService2]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ serviceId: 2, dependsOnServiceId: 1 }]),
        }),
      });
      await expect(service.addDependency(1, 2)).rejects.toThrow(
        'This dependency would create a circular reference',
      );
    });
  });

  describe('removeDependency', () => {
    it('should remove a dependency', async () => {
      const mockDependency = { id: 1, serviceId: 1, dependsOnServiceId: 2 };

      mockDb.db.select.mockReturnValueOnce(createQueryChain([mockDependency]));

      mockDb.db.delete.mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      });

      const result = await service.removeDependency(1, 1);

      expect(result).toEqual({
        deleted: true,
        dependency: mockDependency,
      });
      expect(mockDb.db.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException if dependency not found', async () => {
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));

      await expect(service.removeDependency(1, 999)).rejects.toThrow(NotFoundException);

      // Reset for second expect
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      await expect(service.removeDependency(1, 999)).rejects.toThrow(
        'Dependency not found',
      );
    });
  });

  describe('getHealth', () => {
    it('should return healthy status for operational service with no incidents', async () => {
      const mockService = {
        id: 1,
        name: 'Healthy Service',
        slug: 'healthy-service',
        status: 'operational',
        dependencies: [],
        dependents: [],
        activeIncidents: [],
      };

      mockDb.db.select.mockReturnValueOnce(createQueryChain([mockService]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));

      const result = await service.getHealth(1);

      expect(result.health).toBe('healthy');
      expect(result.score).toBe(100);
      expect(result.metrics.activeIncidents).toBe(0);
      expect(result.metrics.criticalIncidents).toBe(0);
    });

    it('should return critical status for service with outage', async () => {
      const mockService = {
        id: 1,
        name: 'Service',
        status: 'outage',
        dependencies: [],
        activeIncidents: [],
      };

      mockDb.db.select.mockReturnValueOnce(createQueryChain([mockService]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));

      const result = await service.getHealth(1);

      expect(result.health).toBe('critical');
      expect(result.score).toBe(0);
    });

    it('should return critical status for service with critical incidents', async () => {
      const mockService = {
        id: 1,
        name: 'Service',
        status: 'operational',
        dependencies: [],
        activeIncidents: [
          { id: 1, severity: 'critical', status: 'triggered' },
        ],
      };

      mockDb.db.select.mockReturnValueOnce(createQueryChain([mockService]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([{ id: 1, severity: 'critical', status: 'triggered' }]));

      const result = await service.getHealth(1);

      expect(result.health).toBe('critical');
      expect(result.score).toBe(0);
      expect(result.metrics.criticalIncidents).toBe(1);
    });

    it('should return degraded status for service with high severity incidents', async () => {
      const mockService = {
        id: 1,
        name: 'Service',
        status: 'operational',
        dependencies: [],
        activeIncidents: [
          { id: 1, severity: 'high', status: 'triggered' },
        ],
      };

      mockDb.db.select.mockReturnValueOnce(createQueryChain([mockService]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([{ id: 1, severity: 'high', status: 'triggered' }]));

      const result = await service.getHealth(1);

      expect(result.health).toBe('degraded');
      expect(result.score).toBe(50);
      expect(result.metrics.highIncidents).toBe(1);
    });

    it('should return degraded status when dependencies have issues', async () => {
      const mockService = {
        id: 1,
        name: 'Service',
        status: 'operational',
        dependencies: [
          { id: 1, service: { id: 2, name: 'Dep Service', status: 'degraded' } },
        ],
        activeIncidents: [],
      };

      mockDb.db.select.mockReturnValueOnce(createQueryChain([mockService]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([
        { id: 1, dependsOnService: { id: 2, name: 'Dep Service', status: 'degraded' } }
      ]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));

      const result = await service.getHealth(1);

      expect(result.health).toBe('degraded');
      expect(result.score).toBe(50);
      expect(result.metrics.dependencyIssues).toBe(1);
    });

    it('should return maintenance status for service in maintenance', async () => {
      const mockService = {
        id: 1,
        name: 'Service',
        status: 'maintenance',
        dependencies: [],
        activeIncidents: [],
      };

      mockDb.db.select.mockReturnValueOnce(createQueryChain([mockService]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));

      const result = await service.getHealth(1);

      expect(result.health).toBe('maintenance');
      expect(result.score).toBe(75);
    });

    it('should return warning status for service with low severity incidents', async () => {
      const mockService = {
        id: 1,
        name: 'Service',
        status: 'operational',
        dependencies: [],
        activeIncidents: [
          { id: 1, severity: 'low', status: 'triggered' },
        ],
      };

      mockDb.db.select.mockReturnValueOnce(createQueryChain([mockService]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([{ id: 1, severity: 'low', status: 'triggered' }]));

      const result = await service.getHealth(1);

      expect(result.health).toBe('warning');
      expect(result.score).toBe(85);
      expect(result.metrics.activeIncidents).toBe(1);
    });
  });

  describe('getDependencyGraph', () => {
    it('should return dependency graph for a service', async () => {
      const mockService = {
        id: 1,
        name: 'Service 1',
        status: 'operational',
        dependencies: [],
        dependents: [],
        activeIncidents: [],
      };

      // Verify service exists
      mockDb.db.select.mockReturnValueOnce(createQueryChain([mockService]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));

      // Build graph - service 1
      mockDb.db.select.mockReturnValueOnce(createQueryChain([mockService]));

      // Get dependencies of service 1
      mockDb.db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([
            { id: 1, serviceId: 1, dependsOnServiceId: 2 },
          ]),
        }),
      });

      // Build graph for service 2
      mockDb.db.select.mockReturnValueOnce(createQueryChain([{ id: 2, name: 'Service 2', status: 'operational' }]));
      mockDb.db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      const result = await service.getDependencyGraph(1);

      expect(result.serviceId).toBe(1);
      expect(result.graph).toBeDefined();
      expect(result.graph.id).toBe(1);
      expect(result.graph.name).toBe('Service 1');
      expect(result.graph.dependencies).toHaveLength(1);
    });

    it('should handle circular dependencies in graph', async () => {
      const mockService = {
        id: 1,
        name: 'Service 1',
        dependencies: [],
        dependents: [],
        activeIncidents: [],
      };

      // Verify service exists
      mockDb.db.select.mockReturnValueOnce(createQueryChain([mockService]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));
      mockDb.db.select.mockReturnValueOnce(createQueryChain([]));

      // Build graph - service 1
      mockDb.db.select.mockReturnValueOnce(createQueryChain([mockService]));

      // Service 1 depends on service 2
      mockDb.db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([
            { id: 1, serviceId: 1, dependsOnServiceId: 2 },
          ]),
        }),
      });

      // Build graph for service 2
      mockDb.db.select.mockReturnValueOnce(createQueryChain([{ id: 2, name: 'Service 2', status: 'operational' }]));

      // Service 2 depends on service 1 (circular)
      mockDb.db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([
            { id: 2, serviceId: 2, dependsOnServiceId: 1 },
          ]),
        }),
      });

      const result = await service.getDependencyGraph(1);

      expect(result.serviceId).toBe(1);
      expect(result.graph.dependencies[0]).toMatchObject({
        id: 2,
        name: 'Service 2',
        dependencies: expect.arrayContaining([
          expect.objectContaining({ circular: true }),
        ]),
      });
    });
  });

  describe('wouldCreateCircularDependency', () => {
    it('should return false if no circular dependency would be created', async () => {
      // Service 2 has no dependencies - need to return a promise-like object that resolves to array
      const mockQueryResult = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]), // Return empty array for no dependencies
        }),
      };
      mockDb.db.select.mockReturnValueOnce(mockQueryResult);

      const result = await (service as any).wouldCreateCircularDependency(1, 2);

      expect(result).toBe(false);
    });

    it('should return true if circular dependency would be created', async () => {
      // Service 2 depends on service 3
      mockDb.db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ serviceId: 2, dependsOnServiceId: 3 }]),
        }),
      });

      // Service 3 depends on service 1 (circular)
      mockDb.db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ serviceId: 3, dependsOnServiceId: 1 }]),
        }),
      });

      const result = await (service as any).wouldCreateCircularDependency(1, 2);

      expect(result).toBe(true);
    });

    it('should handle complex dependency chains', async () => {
      // Service 2 depends on service 3
      mockDb.db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ serviceId: 2, dependsOnServiceId: 3 }]),
        }),
      });

      // Service 3 depends on service 4
      mockDb.db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ serviceId: 3, dependsOnServiceId: 4 }]),
        }),
      });

      // Service 4 depends on service 5
      mockDb.db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ serviceId: 4, dependsOnServiceId: 5 }]),
        }),
      });

      // Service 5 has no dependencies
      mockDb.db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      const result = await (service as any).wouldCreateCircularDependency(1, 2);

      expect(result).toBe(false);
    });

    it('should detect immediate circular dependency', async () => {
      // Service 2 depends directly on service 1
      mockDb.db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ serviceId: 2, dependsOnServiceId: 1 }]),
        }),
      });

      const result = await (service as any).wouldCreateCircularDependency(1, 2);

      expect(result).toBe(true);
    });
  });

  describe('generateSlug', () => {
    it('should generate slug from service name', () => {
      const slug = (service as any).generateSlug('API Service');
      expect(slug).toBe('api-service');
    });

    it('should handle special characters', () => {
      const slug = (service as any).generateSlug('My Service (Production)!');
      expect(slug).toBe('my-service-production');
    });

    it('should handle multiple spaces', () => {
      const slug = (service as any).generateSlug('Service   With   Spaces');
      expect(slug).toBe('service-with-spaces');
    });

    it('should remove leading and trailing dashes', () => {
      const slug = (service as any).generateSlug('---Service---');
      expect(slug).toBe('service');
    });

    it('should handle numbers', () => {
      const slug = (service as any).generateSlug('Service 123');
      expect(slug).toBe('service-123');
    });
  });
});
