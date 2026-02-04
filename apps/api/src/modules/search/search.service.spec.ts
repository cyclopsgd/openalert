import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { DatabaseService } from '../../database/database.service';

describe('SearchService', () => {
  let service: SearchService;
  let mockDb: any;

  beforeEach(async () => {
    // Mock DatabaseService
    mockDb = {
      db: {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      },
      query: {},
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: DatabaseService,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return empty results for empty query', async () => {
    const result = await service.search('', 10);
    expect(result).toEqual({
      incidents: [],
      alerts: [],
      services: [],
      teams: [],
      users: [],
    });
  });

  it('should return empty results for single character query', async () => {
    const result = await service.search('a', 10);
    expect(result).toEqual({
      incidents: [],
      alerts: [],
      services: [],
      teams: [],
      users: [],
    });
  });

  it('should execute search for valid query', async () => {
    const result = await service.search('test', 5);
    expect(result).toHaveProperty('incidents');
    expect(result).toHaveProperty('alerts');
    expect(result).toHaveProperty('services');
    expect(result).toHaveProperty('teams');
    expect(result).toHaveProperty('users');
  });

  it('should handle numeric incident number search', async () => {
    mockDb.db.limit.mockResolvedValueOnce([
      {
        id: 1,
        incidentNumber: 123,
        title: 'Test Incident',
        status: 'triggered',
        severity: 'critical',
        serviceId: 1,
        triggeredAt: new Date(),
      },
    ]);

    const result = await service.search('123', 10);
    expect(result.incidents).toHaveLength(1);
  });

  it('should handle errors gracefully', async () => {
    mockDb.db.limit.mockRejectedValue(new Error('Database error'));

    const result = await service.search('test', 10);
    // Should return empty arrays instead of throwing
    expect(result).toEqual({
      incidents: [],
      alerts: [],
      services: [],
      teams: [],
      users: [],
    });
  });
});
