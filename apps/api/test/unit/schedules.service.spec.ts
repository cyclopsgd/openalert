import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SchedulesService } from '../../src/modules/schedules/schedules.service';
import { DatabaseService } from '../../src/database/database.service';

describe('SchedulesService', () => {
  let service: SchedulesService;
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
      schedules: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      scheduleOverrides: {
        findMany: jest.fn(),
      },
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulesService,
        {
          provide: DatabaseService,
          useValue: { db: mockDb },
        },
      ],
    }).compile();

    service = module.get<SchedulesService>(SchedulesService);
    db = module.get<DatabaseService>(DatabaseService);

    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ returning: mockReturning });
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ returning: mockReturning });
    mockDelete.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ returning: mockReturning });
  });

  describe('create', () => {
    it('should create a new schedule', async () => {
      const createDto = {
        name: 'Primary On-Call',
        teamId: 1,
        timezone: 'America/New_York',
      };

      const mockSchedule = {
        id: 1,
        ...createDto,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockReturning.mockResolvedValue([mockSchedule]);

      const result = await service.create(createDto);

      expect(result).toEqual(mockSchedule);
      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith({
        name: createDto.name,
        teamId: createDto.teamId,
        timezone: createDto.timezone,
      });
    });

    it('should use UTC as default timezone', async () => {
      const createDto = {
        name: 'Test Schedule',
        teamId: 1,
      };

      mockReturning.mockResolvedValue([{ id: 1, ...createDto, timezone: 'UTC' }]);

      await service.create(createDto);

      expect(mockValues).toHaveBeenCalledWith({
        name: createDto.name,
        teamId: createDto.teamId,
        timezone: 'UTC',
      });
    });
  });

  describe('findById', () => {
    it('should return a schedule with rotations and members', async () => {
      const mockSchedule = {
        id: 1,
        name: 'Primary On-Call',
        teamId: 1,
        timezone: 'UTC',
        rotations: [
          {
            id: 1,
            members: [
              { id: 1, position: 0, user: { id: 1, name: 'User 1' } },
              { id: 2, position: 1, user: { id: 2, name: 'User 2' } },
            ],
          },
        ],
        overrides: [],
      };

      mockDb.query.schedules.findFirst.mockResolvedValue(mockSchedule);

      const result = await service.findById(1);

      expect(result).toEqual(mockSchedule);
      expect(mockDb.query.schedules.findFirst).toHaveBeenCalled();
    });

    it('should throw NotFoundException if schedule not found', async () => {
      mockDb.query.schedules.findFirst.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
      await expect(service.findById(999)).rejects.toThrow('Schedule with ID 999 not found');
    });
  });

  describe('findByTeam', () => {
    it('should return all schedules for a team', async () => {
      const mockSchedules = [
        { id: 1, name: 'Schedule 1', teamId: 1, rotations: [] },
        { id: 2, name: 'Schedule 2', teamId: 1, rotations: [] },
      ];

      mockDb.query.schedules.findMany.mockResolvedValue(mockSchedules);

      const result = await service.findByTeam(1);

      expect(result).toEqual(mockSchedules);
      expect(mockDb.query.schedules.findMany).toHaveBeenCalled();
    });

    it('should return empty array if no schedules found', async () => {
      mockDb.query.schedules.findMany.mockResolvedValue([]);

      const result = await service.findByTeam(999);

      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update a schedule', async () => {
      const updateDto = {
        name: 'Updated Schedule',
        timezone: 'America/Los_Angeles',
      };

      const mockUpdated = {
        id: 1,
        ...updateDto,
        teamId: 1,
        updatedAt: new Date(),
      };

      mockReturning.mockResolvedValue([mockUpdated]);

      const result = await service.update(1, updateDto);

      expect(result).toEqual(mockUpdated);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          name: updateDto.name,
          timezone: updateDto.timezone,
          updatedAt: expect.any(Date),
        })
      );
    });

    it('should throw NotFoundException if schedule not found', async () => {
      mockReturning.mockResolvedValue([]);

      await expect(service.update(999, { name: 'Test' })).rejects.toThrow(NotFoundException);
      await expect(service.update(999, { name: 'Test' })).rejects.toThrow('Schedule with ID 999 not found');
    });
  });

  describe('delete', () => {
    it('should delete a schedule', async () => {
      mockReturning.mockResolvedValue([{ id: 1 }]);

      const result = await service.delete(1);

      expect(result).toEqual({ success: true });
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should throw NotFoundException if schedule not found', async () => {
      mockReturning.mockResolvedValue([]);

      await expect(service.delete(999)).rejects.toThrow(NotFoundException);
      await expect(service.delete(999)).rejects.toThrow('Schedule with ID 999 not found');
    });
  });

  describe('getActiveOverrides', () => {
    it('should return active overrides for a schedule at current time', async () => {
      const now = new Date();
      const mockOverrides = [
        {
          id: 1,
          scheduleId: 1,
          userId: 1,
          startTime: new Date(now.getTime() - 3600000), // 1 hour ago
          endTime: new Date(now.getTime() + 3600000), // 1 hour from now
          user: { id: 1, name: 'Override User' },
        },
      ];

      mockDb.query.scheduleOverrides.findMany.mockResolvedValue(mockOverrides);

      const result = await service.getActiveOverrides(1, now);

      expect(result).toEqual(mockOverrides);
      expect(mockDb.query.scheduleOverrides.findMany).toHaveBeenCalled();
    });

    it('should use current time if no time provided', async () => {
      mockDb.query.scheduleOverrides.findMany.mockResolvedValue([]);

      await service.getActiveOverrides(1);

      expect(mockDb.query.scheduleOverrides.findMany).toHaveBeenCalled();
    });

    it('should return empty array if no active overrides', async () => {
      mockDb.query.scheduleOverrides.findMany.mockResolvedValue([]);

      const result = await service.getActiveOverrides(1);

      expect(result).toEqual([]);
    });
  });
});
