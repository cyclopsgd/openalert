import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from '../../src/modules/auth/strategies/jwt.strategy';
import { UsersService } from '../../src/modules/users/users.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let usersService: UsersService;
  let configService: ConfigService;

  const mockUsersService = {
    findById: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-secret'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfigService.get.mockReturnValue('test-secret');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    usersService = module.get<UsersService>(UsersService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('validate', () => {
    it('should validate and return user data for valid JWT payload', async () => {
      const payload = {
        sub: '1',
        email: 'test@example.com',
        name: 'Test User',
      };

      const mockUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        isActive: true,
        externalId: null,
      };

      mockUsersService.findById.mockResolvedValue(mockUser);

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        externalId: null,
      });

      expect(usersService.findById).toHaveBeenCalledWith(1);
    });

    it('should include externalId in returned user data', async () => {
      const payload = {
        sub: '2',
        email: 'azure@example.com',
        name: 'Azure User',
        oid: 'azure-object-id',
      };

      const mockUser = {
        id: 2,
        email: 'azure@example.com',
        name: 'Azure User',
        isActive: true,
        externalId: 'azure-object-id',
      };

      mockUsersService.findById.mockResolvedValue(mockUser);

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        id: 2,
        email: 'azure@example.com',
        name: 'Azure User',
        externalId: 'azure-object-id',
      });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const payload = {
        sub: '999',
        email: 'nonexistent@example.com',
        name: 'Nonexistent User',
      };

      mockUsersService.findById.mockResolvedValue(null);

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
      await expect(strategy.validate(payload)).rejects.toThrow('User not found or inactive');
    });

    it('should throw UnauthorizedException if user is inactive', async () => {
      const payload = {
        sub: '3',
        email: 'inactive@example.com',
        name: 'Inactive User',
      };

      const mockUser = {
        id: 3,
        email: 'inactive@example.com',
        name: 'Inactive User',
        isActive: false,
        externalId: null,
      };

      mockUsersService.findById.mockResolvedValue(mockUser);

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
      await expect(strategy.validate(payload)).rejects.toThrow('User not found or inactive');
    });

    it('should convert string sub to number when calling findById', async () => {
      const payload = {
        sub: '123',
        email: 'test@example.com',
        name: 'Test User',
      };

      mockUsersService.findById.mockResolvedValue({
        id: 123,
        email: 'test@example.com',
        name: 'Test User',
        isActive: true,
        externalId: null,
      });

      await strategy.validate(payload);

      expect(usersService.findById).toHaveBeenCalledWith(123);
    });
  });
});
