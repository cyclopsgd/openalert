import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard, ROLES_KEY, type UserRole } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockExecutionContext = (user?: any): ExecutionContext => {
    const mockRequest = {
      user,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
      getHandler: jest.fn(),
    } as any;
  };

  describe('canActivate', () => {
    it('should allow access when no roles are required', () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const context = createMockExecutionContext({ role: 'observer' });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(reflector.get).toHaveBeenCalledWith(ROLES_KEY, context.getHandler());
    });

    it('should allow access when required roles array is empty', () => {
      jest.spyOn(reflector, 'get').mockReturnValue([]);
      const context = createMockExecutionContext({ role: 'observer' });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when user is not authenticated', () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['admin']);
      const context = createMockExecutionContext(undefined);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('User not authenticated');
    });

    it('should throw ForbiddenException when user is null', () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['admin']);
      const context = createMockExecutionContext(null);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('User not authenticated');
    });

    it('should allow access when user has required role - superadmin', () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['superadmin']);
      const context = createMockExecutionContext({ id: '1', role: 'superadmin', email: 'admin@test.com' });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access when user has required role - admin', () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['admin']);
      const context = createMockExecutionContext({ id: '2', role: 'admin', email: 'user@test.com' });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access when user has required role - responder', () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['responder']);
      const context = createMockExecutionContext({ id: '3', role: 'responder', email: 'responder@test.com' });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access when user has required role - observer', () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['observer']);
      const context = createMockExecutionContext({ id: '4', role: 'observer', email: 'observer@test.com' });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access when user has one of multiple required roles', () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['admin', 'superadmin']);
      const context = createMockExecutionContext({ id: '1', role: 'admin', email: 'admin@test.com' });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access when user is superadmin and multiple roles required', () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['admin', 'superadmin', 'responder']);
      const context = createMockExecutionContext({ id: '1', role: 'superadmin', email: 'superadmin@test.com' });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when user does not have required role', () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['admin']);
      const context = createMockExecutionContext({ id: '5', role: 'observer', email: 'observer@test.com' });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow(
        'This action requires one of the following roles: admin',
      );
    });

    it('should throw ForbiddenException with multiple roles in message', () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['admin', 'superadmin']);
      const context = createMockExecutionContext({ id: '6', role: 'observer', email: 'observer@test.com' });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow(
        'This action requires one of the following roles: admin, superadmin',
      );
    });

    it('should throw ForbiddenException when responder tries to access admin endpoint', () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['admin', 'superadmin']);
      const context = createMockExecutionContext({ id: '7', role: 'responder', email: 'responder@test.com' });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when observer tries to access responder endpoint', () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['responder', 'admin', 'superadmin']);
      const context = createMockExecutionContext({ id: '8', role: 'observer', email: 'observer@test.com' });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should handle user with undefined role', () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['admin']);
      const context = createMockExecutionContext({ id: '9', email: 'noRole@test.com' });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should handle user with null role', () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['admin']);
      const context = createMockExecutionContext({ id: '10', role: null, email: 'nullRole@test.com' });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should handle user with empty string role', () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['admin']);
      const context = createMockExecutionContext({ id: '11', role: '', email: 'emptyRole@test.com' });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should handle case-sensitive role matching', () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['admin']);
      const context = createMockExecutionContext({ id: '12', role: 'Admin', email: 'wrongCase@test.com' });

      // Should fail because role matching is case-sensitive
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should work with real execution context structure', () => {
      const mockHandler = jest.fn();
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: '1', role: 'admin', email: 'admin@test.com' },
          }),
          getResponse: jest.fn(),
          getNext: jest.fn(),
        }),
        getHandler: () => mockHandler,
        getClass: jest.fn(),
        getArgs: jest.fn(),
        getArgByIndex: jest.fn(),
        switchToRpc: jest.fn(),
        switchToWs: jest.fn(),
        getType: jest.fn(),
      } as any;

      jest.spyOn(reflector, 'get').mockReturnValue(['admin', 'superadmin']);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(reflector.get).toHaveBeenCalledWith(ROLES_KEY, mockHandler);
    });

    it('should correctly extract user from request in switchToHttp', () => {
      const testUser = {
        id: 'test-user-id',
        role: 'superadmin' as UserRole,
        email: 'test@example.com',
        name: 'Test User',
      };

      jest.spyOn(reflector, 'get').mockReturnValue(['superadmin']);
      const context = createMockExecutionContext(testUser);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should handle all valid UserRole types', () => {
      const roles: UserRole[] = ['superadmin', 'admin', 'responder', 'observer'];

      roles.forEach((role) => {
        jest.spyOn(reflector, 'get').mockReturnValue([role]);
        const context = createMockExecutionContext({ id: 'test', role, email: 'test@test.com' });

        const result = guard.canActivate(context);

        expect(result).toBe(true);
      });
    });
  });

  describe('ROLES_KEY constant', () => {
    it('should have the correct value', () => {
      expect(ROLES_KEY).toBe('roles');
    });
  });

  describe('Integration scenarios', () => {
    it('should work in typical admin-only endpoint scenario', () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['admin', 'superadmin']);

      // Admin should pass
      const adminContext = createMockExecutionContext({ id: '1', role: 'admin', email: 'admin@test.com' });
      expect(guard.canActivate(adminContext)).toBe(true);

      // Superadmin should pass
      const superadminContext = createMockExecutionContext({
        id: '2',
        role: 'superadmin',
        email: 'superadmin@test.com',
      });
      expect(guard.canActivate(superadminContext)).toBe(true);

      // Responder should fail
      const responderContext = createMockExecutionContext({
        id: '3',
        role: 'responder',
        email: 'responder@test.com',
      });
      expect(() => guard.canActivate(responderContext)).toThrow(ForbiddenException);

      // Observer should fail
      const observerContext = createMockExecutionContext({
        id: '4',
        role: 'observer',
        email: 'observer@test.com',
      });
      expect(() => guard.canActivate(observerContext)).toThrow(ForbiddenException);
    });

    it('should work in public endpoint scenario (no roles required)', () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);

      const roles: UserRole[] = ['superadmin', 'admin', 'responder', 'observer'];

      roles.forEach((role) => {
        const context = createMockExecutionContext({ id: 'test', role, email: 'test@test.com' });
        expect(guard.canActivate(context)).toBe(true);
      });
    });

    it('should work in responder+ endpoint scenario', () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['responder', 'admin', 'superadmin']);

      // These should pass
      ['responder', 'admin', 'superadmin'].forEach((role) => {
        const context = createMockExecutionContext({ id: 'test', role, email: 'test@test.com' });
        expect(guard.canActivate(context)).toBe(true);
      });

      // Observer should fail
      const observerContext = createMockExecutionContext({
        id: 'obs',
        role: 'observer',
        email: 'observer@test.com',
      });
      expect(() => guard.canActivate(observerContext)).toThrow(ForbiddenException);
    });
  });
});
