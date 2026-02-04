import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EscalationPoliciesService } from './escalation-policies.service';
import { DatabaseService } from '../../database/database.service';

describe('EscalationPoliciesService', () => {
  let service: EscalationPoliciesService;
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
      escalationPolicies: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscalationPoliciesService,
        {
          provide: DatabaseService,
          useValue: { db: mockDb },
        },
      ],
    }).compile();

    service = module.get<EscalationPoliciesService>(EscalationPoliciesService);
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
    it('should create an escalation policy with levels and targets', async () => {
      const dto = {
        name: 'On-Call Escalation',
        teamId: 1,
        repeatCount: 3,
        repeatDelayMinutes: 5,
        levels: [
          {
            level: 1,
            delayMinutes: 0,
            targets: [
              { targetType: 'user' as const, targetId: 101 },
              { targetType: 'user' as const, targetId: 102 },
            ],
          },
          {
            level: 2,
            delayMinutes: 15,
            targets: [{ targetType: 'schedule' as const, targetId: 201 }],
          },
        ],
      };

      const mockPolicy = {
        id: 1,
        name: dto.name,
        teamId: dto.teamId,
        repeatCount: dto.repeatCount,
        repeatDelayMinutes: dto.repeatDelayMinutes,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockLevel1 = {
        id: 1,
        policyId: 1,
        level: 1,
        delayMinutes: 0,
      };

      const mockLevel2 = {
        id: 2,
        policyId: 1,
        level: 2,
        delayMinutes: 15,
      };

      const mockCompletePolicy = {
        ...mockPolicy,
        team: { id: 1, name: 'Test Team' },
        levels: [
          {
            ...mockLevel1,
            targets: [
              { id: 1, levelId: 1, targetType: 'user', targetId: 101 },
              { id: 2, levelId: 1, targetType: 'user', targetId: 102 },
            ],
          },
          {
            ...mockLevel2,
            targets: [{ id: 3, levelId: 2, targetType: 'schedule', targetId: 201 }],
          },
        ],
      };

      // Mock policy creation
      mockReturning.mockResolvedValueOnce([mockPolicy]);

      // Mock level creations
      mockReturning.mockResolvedValueOnce([mockLevel1]);
      mockReturning.mockResolvedValueOnce([mockLevel2]);

      // Mock findById at the end
      mockDb.query.escalationPolicies.findFirst.mockResolvedValue(mockCompletePolicy);

      const result = await service.create(dto);

      expect(result).toEqual(mockCompletePolicy);
      expect(mockInsert).toHaveBeenCalledTimes(5); // 1 policy + 2 levels + 2 targets inserts (one per level)
      expect(result.levels).toHaveLength(2);
    });

    it('should use default values for repeat settings', async () => {
      const dto = {
        name: 'Simple Policy',
        teamId: 1,
        levels: [
          {
            level: 1,
            delayMinutes: 0,
            targets: [],
          },
        ],
      };

      const mockPolicy = {
        id: 2,
        name: dto.name,
        teamId: dto.teamId,
        repeatCount: 3,
        repeatDelayMinutes: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
        team: { id: 1, name: 'Test Team' },
        levels: [],
      };

      mockReturning.mockResolvedValueOnce([mockPolicy]);
      mockReturning.mockResolvedValueOnce([{ id: 1, policyId: 2, level: 1, delayMinutes: 0 }]);
      mockDb.query.escalationPolicies.findFirst.mockResolvedValue(mockPolicy);

      await service.create(dto);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          repeatCount: 3,
          repeatDelayMinutes: 5,
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return all escalation policies with levels', async () => {
      const mockPolicies = [
        {
          id: 1,
          name: 'Policy 1',
          teamId: 1,
          team: { id: 1, name: 'Team 1' },
          levels: [
            {
              id: 1,
              level: 1,
              delayMinutes: 0,
              targets: [],
            },
          ],
        },
        {
          id: 2,
          name: 'Policy 2',
          teamId: 2,
          team: { id: 2, name: 'Team 2' },
          levels: [],
        },
      ];

      mockDb.query.escalationPolicies.findMany.mockResolvedValue(mockPolicies);

      const result = await service.findAll();

      expect(result).toEqual(mockPolicies);
      expect(result).toHaveLength(2);
    });
  });

  describe('findByTeam', () => {
    it('should return policies for a specific team', async () => {
      const mockPolicies = [
        {
          id: 1,
          name: 'Team 1 Policy',
          teamId: 1,
          levels: [],
        },
      ];

      mockDb.query.escalationPolicies.findMany.mockResolvedValue(mockPolicies);

      const result = await service.findByTeam(1);

      expect(result).toEqual(mockPolicies);
      expect(mockDb.query.escalationPolicies.findMany).toHaveBeenCalled();
    });

    it('should return empty array if team has no policies', async () => {
      mockDb.query.escalationPolicies.findMany.mockResolvedValue([]);

      const result = await service.findByTeam(999);

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return a policy with full details', async () => {
      const mockPolicy = {
        id: 1,
        name: 'Test Policy',
        teamId: 1,
        repeatCount: 3,
        repeatDelayMinutes: 5,
        team: { id: 1, name: 'Test Team' },
        levels: [
          {
            id: 1,
            level: 1,
            delayMinutes: 0,
            targets: [
              { id: 1, targetType: 'user', targetId: 101 },
            ],
          },
        ],
      };

      mockDb.query.escalationPolicies.findFirst.mockResolvedValue(mockPolicy);

      const result = await service.findById(1);

      expect(result).toEqual(mockPolicy);
    });

    it('should throw NotFoundException if policy not found', async () => {
      mockDb.query.escalationPolicies.findFirst.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
      await expect(service.findById(999)).rejects.toThrow(
        'Escalation policy with ID 999 not found',
      );
    });
  });

  describe('update', () => {
    it('should update policy name and repeat settings', async () => {
      const dto = {
        name: 'Updated Policy',
        repeatCount: 5,
        repeatDelayMinutes: 10,
      };

      const mockPolicy = {
        id: 1,
        name: dto.name,
        teamId: 1,
        repeatCount: dto.repeatCount,
        repeatDelayMinutes: dto.repeatDelayMinutes,
        team: { id: 1, name: 'Test Team' },
        levels: [],
      };

      mockDb.query.escalationPolicies.findFirst.mockResolvedValue(mockPolicy);

      const result = await service.update(1, dto);

      expect(result.name).toBe(dto.name);
      expect(result.repeatCount).toBe(dto.repeatCount);
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should update levels when provided', async () => {
      const existingPolicy = {
        id: 1,
        name: 'Test Policy',
        teamId: 1,
        levels: [
          {
            id: 10,
            level: 1,
            delayMinutes: 0,
            targets: [],
          },
        ],
      };

      const dto = {
        levels: [
          {
            level: 1,
            delayMinutes: 5,
            targets: [{ targetType: 'user' as const, targetId: 201 }],
          },
        ],
      };

      const updatedPolicy = {
        ...existingPolicy,
        levels: [
          {
            id: 20,
            level: 1,
            delayMinutes: 5,
            targets: [{ id: 1, levelId: 20, targetType: 'user', targetId: 201 }],
          },
        ],
      };

      // First call for checking existing levels, second call for returning updated policy
      mockDb.query.escalationPolicies.findFirst
        .mockResolvedValueOnce(existingPolicy)
        .mockResolvedValueOnce(updatedPolicy);

      mockReturning.mockResolvedValueOnce([{ id: 20, policyId: 1, level: 1, delayMinutes: 5 }]);

      const result = await service.update(1, dto);

      expect(mockDelete).toHaveBeenCalled(); // Old level deleted
      expect(mockInsert).toHaveBeenCalledTimes(2); // New level + targets inserted
      expect(result.levels).toHaveLength(1);
    });
  });

  describe('delete', () => {
    it('should delete an escalation policy', async () => {
      mockReturning.mockResolvedValue([{ id: 1 }]);

      const result = await service.delete(1);

      expect(result).toEqual({ success: true });
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should throw NotFoundException if policy not found', async () => {
      mockReturning.mockResolvedValue([]);

      await expect(service.delete(999)).rejects.toThrow(NotFoundException);
      await expect(service.delete(999)).rejects.toThrow(
        'Escalation policy with ID 999 not found',
      );
    });
  });

  describe('getEscalationPath', () => {
    it('should return the escalation path for a policy', async () => {
      const mockPolicy = {
        id: 1,
        name: 'Test Policy',
        teamId: 1,
        repeatCount: 3,
        repeatDelayMinutes: 5,
        team: { id: 1, name: 'Test Team' },
        levels: [
          {
            id: 1,
            level: 1,
            delayMinutes: 0,
            targets: [
              { id: 1, levelId: 1, targetType: 'user', targetId: 101 },
              { id: 2, levelId: 1, targetType: 'user', targetId: 102 },
            ],
          },
          {
            id: 2,
            level: 2,
            delayMinutes: 15,
            targets: [{ id: 3, levelId: 2, targetType: 'schedule', targetId: 201 }],
          },
        ],
      };

      mockDb.query.escalationPolicies.findFirst.mockResolvedValue(mockPolicy);

      const result = await service.getEscalationPath(1);

      expect(result.policyId).toBe(1);
      expect(result.policyName).toBe('Test Policy');
      expect(result.repeatCount).toBe(3);
      expect(result.repeatDelayMinutes).toBe(5);
      expect(result.path).toHaveLength(2);
      expect(result.path[0].level).toBe(1);
      expect(result.path[0].delayMinutes).toBe(0);
      expect(result.path[0].targets).toHaveLength(2);
      expect(result.path[1].level).toBe(2);
      expect(result.path[1].targets).toHaveLength(1);
    });

    it('should throw NotFoundException if policy not found', async () => {
      mockDb.query.escalationPolicies.findFirst.mockResolvedValue(null);

      await expect(service.getEscalationPath(999)).rejects.toThrow(NotFoundException);
    });
  });
});
