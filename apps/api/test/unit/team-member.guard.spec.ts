import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TeamMemberGuard } from '../../src/common/guards/team-member.guard';
import { DatabaseService } from '../../src/database/database.service';

describe('TeamMemberGuard', () => {
  let guard: TeamMemberGuard;
  let reflector: Reflector;
  let dbService: DatabaseService;

  const mockReflector = {
    get: jest.fn(),
  };

  const mockDbService = {
    query: {
      teamMembers: {
        findFirst: jest.fn(),
      },
      services: {
        findFirst: jest.fn(),
      },
      incidents: {
        findFirst: jest.fn(),
      },
      schedules: {
        findFirst: jest.fn(),
      },
      statusPages: {
        findFirst: jest.fn(),
      },
    },
  };

  const createMockExecutionContext = (user: any, params: any): any => ({
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue({
        user,
        params,
      }),
    }),
    getHandler: jest.fn().mockReturnValue(() => {}),
    getClass: jest.fn(),
    getArgs: jest.fn(),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
    getType: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamMemberGuard,
        {
          provide: Reflector,
          useValue: mockReflector,
        },
        {
          provide: DatabaseService,
          useValue: mockDbService,
        },
      ],
    }).compile();

    guard = module.get<TeamMemberGuard>(TeamMemberGuard);
    reflector = module.get<Reflector>(Reflector);
    dbService = module.get<DatabaseService>(DatabaseService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should allow access if no resource type specified', async () => {
      mockReflector.get.mockReturnValueOnce(undefined); // No resource type

      const context = createMockExecutionContext({ id: 1 }, { id: '1' });
      const result = await guard.canActivate(context as ExecutionContext);

      expect(result).toBe(true);
    });

    it('should allow access for team member with correct permissions', async () => {
      mockReflector.get.mockReturnValueOnce(undefined); // No role requirement
      mockReflector.get.mockReturnValueOnce('incident'); // Resource type

      const service = { id: 1, teamId: 5 };
      const incident = { id: 1, serviceId: 1, service };
      const membership = { id: 1, teamId: 5, userId: 1, role: 'member' };

      mockDbService.query.incidents.findFirst.mockResolvedValue(incident);
      mockDbService.query.teamMembers.findFirst.mockResolvedValue(membership);

      const context = createMockExecutionContext({ id: 1 }, { id: '1' });
      const result = await guard.canActivate(context as ExecutionContext);

      expect(result).toBe(true);
    });

    it('should deny access if user is not team member', async () => {
      mockReflector.get.mockReturnValueOnce(undefined);
      mockReflector.get.mockReturnValueOnce('incident');

      const service = { id: 1, teamId: 5 };
      const incident = { id: 1, serviceId: 1, service };

      mockDbService.query.incidents.findFirst.mockResolvedValue(incident);
      mockDbService.query.teamMembers.findFirst.mockResolvedValue(null); // Not a member

      const context = createMockExecutionContext({ id: 1 }, { id: '1' });

      await expect(guard.canActivate(context as ExecutionContext)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context as ExecutionContext)).rejects.toThrow(
        'You do not have access to this resource',
      );
    });

    it('should deny access if user has insufficient role', async () => {
      mockReflector.get.mockReturnValueOnce(['admin', 'owner']); // Require admin or owner
      mockReflector.get.mockReturnValueOnce('schedule');

      const schedule = { id: 1, teamId: 5 };
      const membership = { id: 1, teamId: 5, userId: 1, role: 'member' }; // Only member

      mockDbService.query.schedules.findFirst.mockResolvedValue(schedule);
      mockDbService.query.teamMembers.findFirst.mockResolvedValue(membership);

      const context = createMockExecutionContext({ id: 1 }, { id: '1' });

      await expect(guard.canActivate(context as ExecutionContext)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context as ExecutionContext)).rejects.toThrow(
        'This action requires one of the following roles: admin, owner',
      );
    });

    it('should throw NotFoundException if resource does not exist', async () => {
      mockReflector.get.mockReturnValueOnce(undefined);
      mockReflector.get.mockReturnValueOnce('service');

      mockDbService.query.services.findFirst.mockResolvedValue(null); // Resource not found

      const context = createMockExecutionContext({ id: 1 }, { id: '999' });

      await expect(guard.canActivate(context as ExecutionContext)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should attach teamId and userRole to request', async () => {
      mockReflector.get.mockReturnValueOnce(undefined);
      mockReflector.get.mockReturnValueOnce('service');

      const service = { id: 1, teamId: 5 };
      const membership = { id: 1, teamId: 5, userId: 1, role: 'admin' };

      mockDbService.query.services.findFirst.mockResolvedValue(service);
      mockDbService.query.teamMembers.findFirst.mockResolvedValue(membership);

      const mockRequest = { user: { id: 1 }, params: { id: '1' } };
      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
        getHandler: () => ({}),
      };

      await guard.canActivate(context as ExecutionContext);

      expect(mockRequest).toHaveProperty('teamId', 5);
      expect(mockRequest).toHaveProperty('userRole', 'admin');
    });
  });
});
