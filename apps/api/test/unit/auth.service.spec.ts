import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../../src/modules/auth/auth.service';
import { UsersService } from '../../src/modules/users/users.service';
import { MsalService } from '../../src/modules/auth/msal.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;
  let msalService: MsalService;

  const mockUser = {
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    externalId: 'ext-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        JWT_SECRET: 'test-secret',
        JWT_EXPIRES_IN: '7d',
        FRONTEND_URL: 'http://localhost:5173',
      };
      return config[key];
    }),
  };

  const mockUsersService = {
    findByExternalId: jest.fn(),
    findOrCreate: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
    verify: jest.fn(),
  };

  const mockMsalService = {
    isConfigured: jest.fn(),
    getAuthCodeUrl: jest.fn(),
    acquireTokenByCode: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: MsalService, useValue: mockMsalService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
    msalService = module.get<MsalService>(MsalService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getLoginUrl', () => {
    it('should return auth URL from MSAL service', async () => {
      const mockAuthUrl = 'https://login.microsoftonline.com/auth';
      const redirectUri = 'http://localhost:3000/api/auth/callback';
      mockMsalService.getAuthCodeUrl.mockResolvedValue(mockAuthUrl);

      const result = await service.getLoginUrl(redirectUri);

      expect(result).toBe(mockAuthUrl);
      expect(mockMsalService.getAuthCodeUrl).toHaveBeenCalledWith(redirectUri, undefined);
    });

    it('should pass state parameter when provided', async () => {
      const mockAuthUrl = 'https://login.microsoftonline.com/auth';
      const redirectUri = 'http://localhost:3000/api/auth/callback';
      const state = 'test-state';
      mockMsalService.getAuthCodeUrl.mockResolvedValue(mockAuthUrl);

      await service.getLoginUrl(redirectUri, state);

      expect(mockMsalService.getAuthCodeUrl).toHaveBeenCalledWith(redirectUri, state);
    });
  });

  describe('handleCallback', () => {
    const redirectUri = 'http://localhost:3000/api/auth/callback';

    it('should throw UnauthorizedException when token exchange fails', async () => {
      mockMsalService.acquireTokenByCode.mockRejectedValue(new Error('Token exchange failed'));

      await expect(service.handleCallback('auth-code', redirectUri)).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('should create new user and return JWT for first-time login', async () => {
      const mockTokenResponse = {
        account: {
          localAccountId: 'ext-456',
          homeAccountId: 'ext-456',
          username: 'newuser@example.com',
          name: 'New User',
        },
      };

      const newUser = {
        ...mockUser,
        id: 2,
        email: 'newuser@example.com',
        name: 'New User',
        externalId: 'ext-456',
      };

      mockMsalService.acquireTokenByCode.mockResolvedValue(mockTokenResponse);
      mockUsersService.findOrCreate.mockResolvedValue(newUser);

      const result = await service.handleCallback('auth-code', redirectUri);

      expect(mockUsersService.findOrCreate).toHaveBeenCalledWith({
        externalId: 'ext-456',
        email: 'newuser@example.com',
        name: 'New User',
      });
      expect(jwtService.sign).toHaveBeenCalled();
      expect(result).toEqual({
        accessToken: 'mock-jwt-token',
        user: {
          id: 2,
          email: 'newuser@example.com',
          name: 'New User',
        },
      });
    });

    it('should return JWT for existing user', async () => {
      const mockTokenResponse = {
        account: {
          localAccountId: 'ext-123',
          homeAccountId: 'ext-123',
          username: 'test@example.com',
          name: 'Test User',
        },
      };

      mockMsalService.acquireTokenByCode.mockResolvedValue(mockTokenResponse);
      mockUsersService.findOrCreate.mockResolvedValue(mockUser);

      const result = await service.handleCallback('auth-code', redirectUri);

      expect(mockUsersService.findOrCreate).toHaveBeenCalledWith({
        externalId: 'ext-123',
        email: 'test@example.com',
        name: 'Test User',
      });
      expect(jwtService.sign).toHaveBeenCalled();
      expect(result).toEqual({
        accessToken: 'mock-jwt-token',
        user: {
          id: 1,
          email: 'test@example.com',
          name: 'Test User',
        },
      });
    });
  });

  describe('generateDevToken', () => {
    it('should generate JWT for existing user', async () => {
      mockUsersService.findById.mockResolvedValue(mockUser);

      const result = await service.generateDevToken(1);

      expect(result).toBe('mock-jwt-token');
      expect(mockUsersService.findById).toHaveBeenCalledWith(1);
      expect(jwtService.sign).toHaveBeenCalled();
    });

    it('should throw Error when user not found', async () => {
      mockUsersService.findById.mockResolvedValue(null);

      await expect(service.generateDevToken(999)).rejects.toThrow(
        'User not found'
      );
    });

    it('should throw Error in production environment', async () => {
      mockConfigService.get.mockReturnValue('production');
      mockUsersService.findById.mockResolvedValue(mockUser);

      await expect(service.generateDevToken(1)).rejects.toThrow(
        'Dev tokens not allowed in production'
      );
    });
  });

  describe('validateToken', () => {
    const mockJwtPayload = {
      sub: '1',
      email: 'test@example.com',
      name: 'Test User',
      oid: 'ext-123',
    };

    it('should return user data when token is valid', async () => {
      mockJwtService.verify = jest.fn().mockReturnValue(mockJwtPayload);
      mockUsersService.findById.mockResolvedValue({ ...mockUser, isActive: true });

      const result = await service.validateToken('valid-token');

      expect(result).toEqual({
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        externalId: 'ext-123',
      });
    });

    it('should throw UnauthorizedException when user is inactive', async () => {
      mockJwtService.verify = jest.fn().mockReturnValue(mockJwtPayload);
      mockUsersService.findById.mockResolvedValue({ ...mockUser, isActive: false });

      await expect(service.validateToken('valid-token')).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockJwtService.verify = jest.fn().mockReturnValue(mockJwtPayload);
      mockUsersService.findById.mockResolvedValue(null);

      await expect(service.validateToken('valid-token')).rejects.toThrow(
        UnauthorizedException
      );
    });
  });
});
