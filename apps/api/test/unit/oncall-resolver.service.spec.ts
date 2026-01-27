import { Test, TestingModule } from '@nestjs/testing';
import { OnCallResolverService } from '../../src/modules/schedules/oncall-resolver.service';
import { DatabaseService } from '../../src/database/database.service';

describe('OnCallResolverService', () => {
  let service: OnCallResolverService;
  let dbService: DatabaseService;

  const mockDb = {
    db: {
      query: {
        scheduleOverrides: {
          findFirst: jest.fn(),
        },
        scheduleRotations: {
          findMany: jest.fn(),
        },
      },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnCallResolverService,
        {
          provide: DatabaseService,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<OnCallResolverService>(OnCallResolverService);
    dbService = module.get<DatabaseService>(DatabaseService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('resolveOnCall', () => {
    it('should return override user if active override exists', async () => {
      const override = {
        id: 1,
        userId: 2,
        user: {
          id: 2,
          name: 'Bob Johnson',
          email: 'bob@example.com',
        },
        schedule: {
          name: 'Primary Schedule',
        },
        reason: 'Vacation coverage',
      };

      mockDb.db.query.scheduleOverrides.findFirst.mockResolvedValue(override);

      const result = await service.resolveOnCall(1);

      expect(result).toEqual({
        scheduleId: 1,
        scheduleName: 'Primary Schedule',
        userId: 2,
        user: {
          id: 2,
          name: 'Bob Johnson',
          email: 'bob@example.com',
        },
        source: 'override',
        overrideId: 1,
        overrideReason: 'Vacation coverage',
      });
    });

    it('should return rotation user if no override exists', async () => {
      const rotation = {
        id: 1,
        scheduleId: 1,
        name: 'Weekly Rotation',
        rotationType: 'daily',
        handoffTime: '09:00',
        effectiveFrom: new Date('2026-01-20'),
        schedule: {
          name: 'Primary Schedule',
          timezone: 'UTC',
        },
        members: [
          {
            userId: 1,
            position: 0,
            user: {
              id: 1,
              name: 'Alice Smith',
              email: 'alice@example.com',
            },
          },
          {
            userId: 2,
            position: 1,
            user: {
              id: 2,
              name: 'Bob Johnson',
              email: 'bob@example.com',
            },
          },
        ],
      };

      mockDb.db.query.scheduleOverrides.findFirst.mockResolvedValue(null);
      mockDb.db.query.scheduleRotations.findMany.mockResolvedValue([rotation]);

      const result = await service.resolveOnCall(1, new Date('2026-01-27T10:00:00Z'));

      expect(result).toBeTruthy();
      expect(result?.source).toBe('rotation');
      expect(result?.rotationId).toBe(1);
      expect([1, 2]).toContain(result?.userId);
    });

    it('should return null if no override or rotation exists', async () => {
      mockDb.db.query.scheduleOverrides.findFirst.mockResolvedValue(null);
      mockDb.db.query.scheduleRotations.findMany.mockResolvedValue([]);

      const result = await service.resolveOnCall(1);

      expect(result).toBeNull();
    });
  });

  describe('calculateDailyRotation', () => {
    it('should calculate correct on-call index for daily rotation', () => {
      const effectiveFrom = new Date('2026-01-20T09:00:00Z');
      const at = new Date('2026-01-27T10:00:00Z'); // 7 days later
      const handoffTime = '09:00';
      const memberCount = 3;

      const index = (service as any).calculateDailyRotation(
        effectiveFrom,
        at,
        handoffTime,
        memberCount,
      );

      // 7 days later, should be index 7 % 3 = 1
      expect(index).toBe(1);
    });

    it('should handle handoff time correctly', () => {
      const effectiveFrom = new Date('2026-01-20T09:00:00Z');
      const beforeHandoff = new Date('2026-01-21T08:00:00Z'); // Before 9am
      const afterHandoff = new Date('2026-01-21T10:00:00Z'); // After 9am
      const handoffTime = '09:00';
      const memberCount = 2;

      const indexBefore = (service as any).calculateDailyRotation(
        effectiveFrom,
        beforeHandoff,
        handoffTime,
        memberCount,
      );

      const indexAfter = (service as any).calculateDailyRotation(
        effectiveFrom,
        afterHandoff,
        handoffTime,
        memberCount,
      );

      // Before handoff should be previous day's on-call
      // After handoff should be current day's on-call
      expect(indexBefore).not.toBe(indexAfter);
    });
  });

  describe('calculateWeeklyRotation', () => {
    it('should calculate correct on-call index for weekly rotation', () => {
      const effectiveFrom = new Date('2026-01-05T09:00:00Z'); // Monday
      const at = new Date('2026-01-19T10:00:00Z'); // Two weeks later
      const handoffTime = '09:00';
      const handoffDay = 1; // Monday
      const memberCount = 3;

      const index = (service as any).calculateWeeklyRotation(
        effectiveFrom,
        at,
        handoffTime,
        handoffDay,
        memberCount,
      );

      // 2 weeks later, should be index 2 % 3 = 2
      expect(index).toBe(2);
    });
  });

  describe('resolveMultipleSchedules', () => {
    it('should resolve on-call for multiple schedules', async () => {
      const override = {
        userId: 1,
        user: {
          id: 1,
          name: 'Alice Smith',
          email: 'alice@example.com',
        },
        schedule: {
          name: 'Schedule 1',
        },
      };

      const rotation = {
        scheduleId: 2,
        name: 'Rotation',
        rotationType: 'daily',
        handoffTime: '09:00',
        effectiveFrom: new Date('2026-01-20'),
        schedule: {
          name: 'Schedule 2',
          timezone: 'UTC',
        },
        members: [
          {
            userId: 2,
            position: 0,
            user: {
              id: 2,
              name: 'Bob Johnson',
              email: 'bob@example.com',
            },
          },
        ],
      };

      mockDb.db.query.scheduleOverrides.findFirst
        .mockResolvedValueOnce(override)
        .mockResolvedValueOnce(null);

      mockDb.db.query.scheduleRotations.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([rotation]);

      const results = await service.resolveMultipleSchedules([1, 2]);

      expect(results).toHaveLength(2);
      expect(results[0].scheduleId).toBe(1);
      expect(results[1].scheduleId).toBe(2);
    });
  });
});
