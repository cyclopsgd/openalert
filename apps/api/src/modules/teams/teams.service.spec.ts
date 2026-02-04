import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { TeamsService } from './teams.service';
import { DatabaseService } from '../../database/database.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { AddMemberDto, TeamRole } from './dto/add-member.dto';

describe('TeamsService', () => {
  let service: TeamsService;
  let db: any;

  // Create mock query builder
  const createMockQueryBuilder = () => {
    const mockLimit = jest.fn();
    const mockWhere = jest.fn();
    const mockFrom = jest.fn();
    const mockSelect = jest.fn();
    const mockInnerJoin = jest.fn();
    const mockGroupBy = jest.fn();

    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere, groupBy: mockGroupBy });
    mockWhere.mockReturnValue({ limit: mockLimit, innerJoin: mockInnerJoin, groupBy: mockGroupBy });
    mockLimit.mockResolvedValue([]);
    mockInnerJoin.mockReturnValue({ where: mockWhere });
    mockGroupBy.mockResolvedValue([]);

    return { mockSelect, mockFrom, mockWhere, mockLimit, mockInnerJoin, mockGroupBy };
  };

  beforeEach(async () => {
    const mockDb = {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamsService,
        {
          provide: DatabaseService,
          useValue: { db: mockDb },
        },
      ],
    }).compile();

    service = module.get<TeamsService>(TeamsService);
    db = module.get<DatabaseService>(DatabaseService).db;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a team with auto-generated slug', async () => {
      const dto: CreateTeamDto = {
        name: 'Test Team',
        description: 'A test team',
      };

      const mockTeam = {
        id: 1,
        name: dto.name,
        slug: 'test-team',
        description: dto.description,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock slug check (no existing team)
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Mock team creation
      db.insert.mockReturnValueOnce({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockTeam]),
        }),
      });

      // Mock findOne call (team query)
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockTeam]),
          }),
        }),
      });

      // Mock findOne call (members query)
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Mock findOne call (services query)
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      const result = await service.create(dto);

      expect(result).toMatchObject({
        id: 1,
        name: dto.name,
        slug: 'test-team',
        description: dto.description,
        members: [],
        services: [],
      });
    });

    it('should create a team with custom slug', async () => {
      const dto: CreateTeamDto = {
        name: 'Test Team',
        slug: 'custom-slug',
        description: 'A test team',
      };

      const mockTeam = {
        id: 1,
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock slug check
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Mock team creation
      db.insert.mockReturnValueOnce({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockTeam]),
        }),
      });

      // Mock findOne queries
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockTeam]),
          }),
        }),
      });
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([]),
          }),
        }),
      });
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      const result = await service.create(dto);

      expect(result.slug).toBe('custom-slug');
    });

    it('should throw ConflictException if slug already exists', async () => {
      const dto: CreateTeamDto = {
        name: 'Test Team',
        slug: 'existing-slug',
      };

      const existingTeam = {
        id: 1,
        name: 'Existing Team',
        slug: 'existing-slug',
      };

      // Mock slug check (team exists)
      db.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([existingTeam]),
          }),
        }),
      });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      await expect(service.create(dto)).rejects.toThrow(
        'Team with slug "existing-slug" already exists',
      );
    });
  });

  describe('findAll', () => {
    it('should return all teams with member and service counts', async () => {
      const mockTeams = [
        {
          id: 1,
          name: 'Team 1',
          slug: 'team-1',
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          name: 'Team 2',
          slug: 'team-2',
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockMemberCounts = [
        { teamId: 1, count: 3 },
        { teamId: 2, count: 5 },
      ];

      const mockServiceCounts = [
        { teamId: 1, count: 2 },
        { teamId: 2, count: 1 },
      ];

      // Mock teams query
      db.select.mockReturnValueOnce({
        from: jest.fn().mockResolvedValue(mockTeams),
      });

      // Mock member counts query
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            groupBy: jest.fn().mockResolvedValue(mockMemberCounts),
          }),
        }),
      });

      // Mock service counts query
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            groupBy: jest.fn().mockResolvedValue(mockServiceCounts),
          }),
        }),
      });

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 1,
        name: 'Team 1',
        memberCount: 3,
        serviceCount: 2,
      });
      expect(result[1]).toMatchObject({
        id: 2,
        name: 'Team 2',
        memberCount: 5,
        serviceCount: 1,
      });
    });

    it('should return empty array when no teams exist', async () => {
      db.select.mockReturnValueOnce({
        from: jest.fn().mockResolvedValue([]),
      });

      const result = await service.findAll();

      expect(result).toEqual([]);
    });

    it('should return teams with zero counts when no members or services', async () => {
      const mockTeams = [
        {
          id: 1,
          name: 'Team 1',
          slug: 'team-1',
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      db.select.mockReturnValueOnce({
        from: jest.fn().mockResolvedValue(mockTeams),
      });
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            groupBy: jest.fn().mockResolvedValue([]),
          }),
        }),
      });
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            groupBy: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].memberCount).toBe(0);
      expect(result[0].serviceCount).toBe(0);
    });
  });

  describe('findOne', () => {
    it('should return a team with members and services', async () => {
      const mockTeam = {
        id: 1,
        name: 'Test Team',
        slug: 'test-team',
        description: 'Test description',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockMembers = [
        {
          id: 1,
          teamId: 1,
          userId: 101,
          role: 'team_admin',
          createdAt: new Date(),
          user: {
            id: 101,
            email: 'admin@test.com',
            name: 'Admin User',
            phoneNumber: null,
            timezone: 'UTC',
          },
        },
      ];

      const mockServices = [
        {
          id: 1,
          name: 'Service 1',
          teamId: 1,
          slug: 'service-1',
        },
      ];

      // Mock team query
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockTeam]),
          }),
        }),
      });

      // Mock members query
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(mockMembers),
          }),
        }),
      });

      // Mock services query
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockServices),
        }),
      });

      const result = await service.findOne(1);

      expect(result).toMatchObject({
        id: 1,
        name: 'Test Team',
      });
      expect(result.members).toHaveLength(1);
      expect(result.services).toHaveLength(1);
    });

    it('should throw NotFoundException if team not found', async () => {
      db.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(999)).rejects.toThrow(
        'Team with ID 999 not found',
      );
    });
  });

  describe('update', () => {
    it('should update team properties', async () => {
      const dto: UpdateTeamDto = {
        name: 'Updated Team',
        description: 'Updated description',
      };

      const existingTeam = {
        id: 1,
        name: 'Original Team',
        slug: 'original-team',
        description: 'Original description',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedTeam = {
        ...existingTeam,
        name: dto.name,
        description: dto.description,
      };

      // Mock findOne (verify team exists)
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([existingTeam]),
          }),
        }),
      });
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([]),
          }),
        }),
      });
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      // Mock update
      db.update.mockReturnValueOnce({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined),
        }),
      });

      // Mock findOne (return updated team)
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([updatedTeam]),
          }),
        }),
      });
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([]),
          }),
        }),
      });
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      const result = await service.update(1, dto);

      expect(result.name).toBe(dto.name);
      expect(result.description).toBe(dto.description);
    });

    it('should throw ConflictException if new slug already exists', async () => {
      const dto: UpdateTeamDto = {
        slug: 'existing-slug',
      };

      const existingTeam = {
        id: 1,
        name: 'Test Team',
        slug: 'old-slug',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const conflictingTeam = {
        id: 2,
        name: 'Other Team',
        slug: 'existing-slug',
      };

      // Mock findOne (verify team exists)
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([existingTeam]),
          }),
        }),
      });
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([]),
          }),
        }),
      });
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      // Mock slug conflict check (conflict found)
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([conflictingTeam]),
          }),
        }),
      });

      await expect(service.update(1, dto)).rejects.toThrow(ConflictException);
      await expect(service.update(1, dto)).rejects.toThrow(
        'Team with slug "existing-slug" already exists',
      );
    });

    it('should throw NotFoundException if team does not exist', async () => {
      const dto: UpdateTeamDto = {
        name: 'Updated Team',
      };

      db.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(service.update(999, dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a team without services', async () => {
      const mockTeam = {
        id: 1,
        name: 'Test Team',
        slug: 'test-team',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        members: [],
        services: [],
      };

      // Mock findOne
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockTeam]),
          }),
        }),
      });
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([]),
          }),
        }),
      });
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      // Mock delete
      db.delete.mockReturnValueOnce({
        where: jest.fn().mockResolvedValue(undefined),
      });

      const result = await service.remove(1);

      expect(result).toEqual({
        deleted: true,
        team: mockTeam,
      });
    });

    it('should throw BadRequestException if team has active services', async () => {
      const mockTeam = {
        id: 1,
        name: 'Test Team',
        slug: 'test-team',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockServices = [
        {
          id: 1,
          name: 'Service 1',
          teamId: 1,
          slug: 'service-1',
        },
      ];

      // Mock findOne - team query
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockTeam]),
          }),
        }),
      });

      // Mock findOne - members query
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Mock findOne - services query (has services)
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockServices),
        }),
      });

      await expect(service.remove(1)).rejects.toThrow(BadRequestException);
      await expect(service.remove(1)).rejects.toThrow(
        'Cannot delete team with active services',
      );
    });

    it('should throw NotFoundException if team does not exist', async () => {
      db.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('addMember', () => {
    it('should add a member to a team with default role', async () => {
      const dto: AddMemberDto = {
        userId: 101,
      };

      const mockTeam = {
        id: 1,
        name: 'Test Team',
        slug: 'test-team',
      };

      const mockUser = {
        id: 101,
        email: 'user@test.com',
        name: 'Test User',
      };

      const mockMember = {
        id: 1,
        teamId: 1,
        userId: 101,
        teamRole: 'member',
        createdAt: new Date(),
      };

      const mockMemberWithUser = {
        id: 1,
        teamId: 1,
        userId: 101,
        role: 'member',
        createdAt: new Date(),
        user: {
          id: 101,
          email: 'user@test.com',
          name: 'Test User',
          phoneNumber: null,
          timezone: 'UTC',
        },
      };

      // Mock findOne (verify team exists)
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockTeam]),
          }),
        }),
      });
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([]),
          }),
        }),
      });
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      // Mock user existence check
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      // Mock existing member check (not a member)
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Mock member insertion
      db.insert.mockReturnValueOnce({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockMember]),
        }),
      });

      // Mock member with user details
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([mockMemberWithUser]),
            }),
          }),
        }),
      });

      const result = await service.addMember(1, dto);

      expect(result).toMatchObject({
        userId: 101,
        role: 'member',
      });
    });

    it('should throw NotFoundException if user does not exist', async () => {
      const dto: AddMemberDto = {
        userId: 999,
      };

      const mockTeam = {
        id: 1,
        name: 'Test Team',
        slug: 'test-team',
      };

      let callCount = 0;
      db.select.mockImplementation(() => {
        callCount++;
        // First 3 calls: findOne (team, members, services)
        if (callCount <= 3) {
          if (callCount === 1) {
            return {
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue([mockTeam]),
                }),
              }),
            };
          } else if (callCount === 2) {
            return {
              from: jest.fn().mockReturnValue({
                innerJoin: jest.fn().mockReturnValue({
                  where: jest.fn().mockResolvedValue([]),
                }),
              }),
            };
          } else {
            return {
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockResolvedValue([]),
              }),
            };
          }
        }
        // 4th call: user doesn't exist
        return {
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]),
            }),
          }),
        };
      });

      await expect(service.addMember(1, dto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.addMember(1, dto)).rejects.toThrow(
        'User with ID 999 not found',
      );
    });

    it('should throw ConflictException if user is already a member', async () => {
      const dto: AddMemberDto = {
        userId: 101,
      };

      const mockTeam = {
        id: 1,
        name: 'Test Team',
        slug: 'test-team',
      };

      const mockUser = {
        id: 101,
        email: 'user@test.com',
        name: 'Test User',
      };

      const existingMember = {
        id: 1,
        teamId: 1,
        userId: 101,
        teamRole: 'member',
      };

      let callCount = 0;
      db.select.mockImplementation(() => {
        callCount++;
        // First 3 calls: findOne (team, members, services)
        if (callCount <= 3) {
          if (callCount === 1) {
            return {
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue([mockTeam]),
                }),
              }),
            };
          } else if (callCount === 2) {
            return {
              from: jest.fn().mockReturnValue({
                innerJoin: jest.fn().mockReturnValue({
                  where: jest.fn().mockResolvedValue([]),
                }),
              }),
            };
          } else {
            return {
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockResolvedValue([]),
              }),
            };
          }
        }
        // 4th call: user exists
        if (callCount === 4) {
          return {
            from: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue([mockUser]),
              }),
            }),
          };
        }
        // 5th call: user already a member
        return {
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([existingMember]),
            }),
          }),
        };
      });

      await expect(service.addMember(1, dto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.addMember(1, dto)).rejects.toThrow(
        'User is already a member of this team',
      );
    });
  });

  describe('removeMember', () => {
    it('should remove a non-admin member from team', async () => {
      const mockTeam = {
        id: 1,
        name: 'Test Team',
        slug: 'test-team',
        members: [
          {
            id: 1,
            teamId: 1,
            userId: 101,
            role: 'team_admin',
          },
          {
            id: 2,
            teamId: 1,
            userId: 102,
            role: 'member',
          },
        ],
        services: [],
      };

      const mockMember = {
        id: 2,
        teamId: 1,
        userId: 102,
        teamRole: 'member',
      };

      // Mock findOne (verify team exists)
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockTeam]),
          }),
        }),
      });
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([]),
          }),
        }),
      });
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      // Mock member query
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockMember]),
          }),
        }),
      });

      // Mock findOne (for admin count check)
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockTeam]),
          }),
        }),
      });
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(mockTeam.members),
          }),
        }),
      });
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      // Mock delete
      db.delete.mockReturnValueOnce({
        where: jest.fn().mockResolvedValue(undefined),
      });

      const result = await service.removeMember(1, 102);

      expect(result).toEqual({
        deleted: true,
        member: mockMember,
      });
    });

    it('should throw BadRequestException when removing the last admin', async () => {
      const mockTeam = {
        id: 1,
        name: 'Test Team',
        slug: 'test-team',
      };

      const mockMembers = [
        {
          id: 1,
          teamId: 1,
          userId: 101,
          role: 'team_admin',
        },
      ];

      const mockMember = {
        id: 1,
        teamId: 1,
        userId: 101,
        teamRole: 'team_admin',
      };

      let callCount = 0;
      db.select.mockImplementation(() => {
        callCount++;
        // First 3 calls: first findOne (team, members, services)
        if (callCount <= 3) {
          if (callCount === 1) {
            return {
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue([mockTeam]),
                }),
              }),
            };
          } else if (callCount === 2) {
            return {
              from: jest.fn().mockReturnValue({
                innerJoin: jest.fn().mockReturnValue({
                  where: jest.fn().mockResolvedValue([]),
                }),
              }),
            };
          } else {
            return {
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockResolvedValue([]),
              }),
            };
          }
        }
        // 4th call: member query
        if (callCount === 4) {
          return {
            from: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue([mockMember]),
              }),
            }),
          };
        }
        // 5-7 calls: second findOne (for admin count check)
        if (callCount === 5) {
          return {
            from: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue([mockTeam]),
              }),
            }),
          };
        } else if (callCount === 6) {
          return {
            from: jest.fn().mockReturnValue({
              innerJoin: jest.fn().mockReturnValue({
                where: jest.fn().mockResolvedValue(mockMembers),
              }),
            }),
          };
        } else {
          return {
            from: jest.fn().mockReturnValue({
              where: jest.fn().mockResolvedValue([]),
            }),
          };
        }
      });

      await expect(service.removeMember(1, 101)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.removeMember(1, 101)).rejects.toThrow(
        'Cannot remove the last admin from the team',
      );
    });

    it('should throw NotFoundException if user is not a member', async () => {
      const mockTeam = {
        id: 1,
        name: 'Test Team',
        slug: 'test-team',
        members: [],
        services: [],
      };

      let callCount = 0;
      db.select.mockImplementation(() => {
        callCount++;
        // First 3 calls: findOne (team, members, services)
        if (callCount <= 3) {
          if (callCount === 1) {
            return {
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue([mockTeam]),
                }),
              }),
            };
          } else if (callCount === 2) {
            return {
              from: jest.fn().mockReturnValue({
                innerJoin: jest.fn().mockReturnValue({
                  where: jest.fn().mockResolvedValue([]),
                }),
              }),
            };
          } else {
            return {
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockResolvedValue([]),
              }),
            };
          }
        }
        // 4th call: member not found
        return {
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]),
            }),
          }),
        };
      });

      await expect(service.removeMember(1, 999)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.removeMember(1, 999)).rejects.toThrow(
        'User is not a member of this team',
      );
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role from member to admin', async () => {
      const mockTeam = {
        id: 1,
        name: 'Test Team',
        slug: 'test-team',
        members: [
          {
            id: 1,
            teamId: 1,
            userId: 101,
            role: 'team_admin',
          },
          {
            id: 2,
            teamId: 1,
            userId: 102,
            role: 'member',
          },
        ],
        services: [],
      };

      const mockMember = {
        id: 2,
        teamId: 1,
        userId: 102,
        teamRole: 'member',
      };

      const mockUpdatedMember = {
        id: 2,
        teamId: 1,
        userId: 102,
        role: 'team_admin',
        createdAt: new Date(),
        user: {
          id: 102,
          email: 'member@test.com',
          name: 'Member',
          phoneNumber: null,
          timezone: 'UTC',
        },
      };

      // Mock findOne
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockTeam]),
          }),
        }),
      });
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([]),
          }),
        }),
      });
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      // Mock member query
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockMember]),
          }),
        }),
      });

      // Mock update
      db.update.mockReturnValueOnce({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined),
        }),
      });

      // Mock final select
      db.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([mockUpdatedMember]),
            }),
          }),
        }),
      });

      const result = await service.updateMemberRole(1, 102, 'team_admin');

      expect(result.role).toBe('team_admin');
    });

    it('should throw BadRequestException when demoting the last admin', async () => {
      const mockTeam = {
        id: 1,
        name: 'Test Team',
        slug: 'test-team',
      };

      const mockMembers = [
        {
          id: 1,
          teamId: 1,
          userId: 101,
          role: 'team_admin',
        },
      ];

      const mockMember = {
        id: 1,
        teamId: 1,
        userId: 101,
        teamRole: 'team_admin',
      };

      let callCount = 0;
      db.select.mockImplementation(() => {
        callCount++;
        // First 3 calls: first findOne (team, members, services)
        if (callCount <= 3) {
          if (callCount === 1) {
            return {
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue([mockTeam]),
                }),
              }),
            };
          } else if (callCount === 2) {
            return {
              from: jest.fn().mockReturnValue({
                innerJoin: jest.fn().mockReturnValue({
                  where: jest.fn().mockResolvedValue([]),
                }),
              }),
            };
          } else {
            return {
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockResolvedValue([]),
              }),
            };
          }
        }
        // 4th call: member query
        if (callCount === 4) {
          return {
            from: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue([mockMember]),
              }),
            }),
          };
        }
        // 5-7 calls: second findOne (for admin count check)
        if (callCount === 5) {
          return {
            from: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue([mockTeam]),
              }),
            }),
          };
        } else if (callCount === 6) {
          return {
            from: jest.fn().mockReturnValue({
              innerJoin: jest.fn().mockReturnValue({
                where: jest.fn().mockResolvedValue(mockMembers),
              }),
            }),
          };
        } else {
          return {
            from: jest.fn().mockReturnValue({
              where: jest.fn().mockResolvedValue([]),
            }),
          };
        }
      });

      await expect(service.updateMemberRole(1, 101, 'member')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.updateMemberRole(1, 101, 'member')).rejects.toThrow(
        'Cannot demote the last admin of the team',
      );
    });

    it('should throw NotFoundException if user is not a member', async () => {
      const mockTeam = {
        id: 1,
        name: 'Test Team',
        slug: 'test-team',
      };

      let callCount = 0;
      db.select.mockImplementation(() => {
        callCount++;
        // First 3 calls: findOne (team, members, services)
        if (callCount <= 3) {
          if (callCount === 1) {
            return {
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue([mockTeam]),
                }),
              }),
            };
          } else if (callCount === 2) {
            return {
              from: jest.fn().mockReturnValue({
                innerJoin: jest.fn().mockReturnValue({
                  where: jest.fn().mockResolvedValue([]),
                }),
              }),
            };
          } else {
            return {
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockResolvedValue([]),
              }),
            };
          }
        }
        // 4th call: member not found
        return {
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]),
            }),
          }),
        };
      });

      await expect(
        service.updateMemberRole(1, 999, 'member'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.updateMemberRole(1, 999, 'member'),
      ).rejects.toThrow('User is not a member of this team');
    });
  });
});
