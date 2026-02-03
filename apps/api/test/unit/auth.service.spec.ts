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
      const config = {
        JWT_SECRET: 'test-secret',
        JWT_EXPIRES_IN: '7d',
        FRONTEND_URL: 'http://localhost:5173',
      };
      return config[key];
    }),
  };

  const mockUsersService = {
    findByExternalId: jest.fn(),
    create: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
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

  describe('login', () => {
    it('should throw UnauthorizedException when MSAL is not configured', async () => {
      mockMsalService.isConfigured.mockReturnValue(false);

      await expect(service.login()).rejects.toThrow(UnauthorizedException);
      await expect(service.login()).rejects.toThrow(
        'Azure Entra ID not configured'
      );
    });

    it('should return auth URL when MSAL is configured', async () => {
      const mockAuthUrl = 'https://login.microsoftonline.com/auth';
      mockMsalService.isConfigured.mockReturnValue(true);
      mockMsalService.getAuthCodeUrl.mockResolvedValue(mockAuthUrl);

      const result = await service.login();

      expect(result).toBe(mockAuthUrl);
      expect(mockMsalService.getAuthCodeUrl).toHaveBeenCalled();
    });
  });

  describe('handleCallback', () => {
    it('should throw UnauthorizedException when MSAL is not configured', async () => {
      mockMsalService.isConfigured.mockReturnValue(false);

      await expect(service.handleCallback('auth-code')).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('should create new user and return JWT for first-time login', async () => {
      const mockTokenResponse = {
        account: {
          homeAccountId: 'ext-456',
          username: 'newuser@example.com',
          name: 'New User',
        },
      };

      mockMsalService.isConfigured.mockReturnValue(true);
      mockMsalService.acquireTokenByCode.mockResolvedValue(mockTokenResponse);
      mockUsersService.findByExternalId.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue({
        ...mockUser,
        id: 2,
        email: 'newuser@example.com',
        name: 'New User',
        externalId: 'ext-456',
      });

      const result = await service.handleCallback('auth-code');

      expect(mockUsersService.findByExternalId).toHaveBeenCalledWith('ext-456');
      expect(mockUsersService.create).toHaveBeenCalledWith({
        email: 'newuser@example.com',
        name: 'New User',
        externalId: 'ext-456',
      });
      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: 2, email: 'newuser@example.com' },
        { expiresIn: '7d' }
      );
      expect(result).toEqual({
        accessToken: 'mock-jwt-token',
        user: expect.objectContaining({
          email: 'newuser@example.com',
        }),
      });
    });

    it('should return JWT for existing user', async () => {
      const mockTokenResponse = {
        account: {
          homeAccountId: 'ext-123',
          username: 'test@example.com',
          name: 'Test User',
        },
      };

      mockMsalService.isConfigured.mockReturnValue(true);
      mockMsalService.acquireTokenByCode.mockResolvedValue(mockTokenResponse);
      mockUsersService.findByExternalId.mockResolvedValue(mockUser);

      const result = await service.handleCallback('auth-code');

      expect(mockUsersService.findByExternalId).toHaveBeenCalledWith('ext-123');
      expect(mockUsersService.create).not.toHaveBeenCalled();
      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: 1, email: 'test@example.com' },
        { expiresIn: '7d' }
      );
      expect(result).toEqual({
        accessToken: 'mock-jwt-token',
        user: mockUser,
      });
    });
  });

  describe('generateDevToken', () => {
    it('should generate JWT for existing user', async () => {
      mockUsersService.findByExternalId.mockResolvedValue(mockUser);

      const result = await service.generateDevToken(1);

      expect(result).toEqual({
        accessToken: 'mock-jwt-token',
        user: mockUser,
      });
      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: 1, email: 'test@example.com' },
        { expiresIn: '7d' }
      );
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockUsersService.findByExternalId.mockResolvedValue(null);

      await expect(service.generateDevToken(999)).rejects.toThrow(
        UnauthorizedException
      );
    });
  });

  describe('validateUser', () => {
    it('should return user when found', async () => {
      mockUsersService.findByExternalId.mockResolvedValue(mockUser);

      const result = await service.validateUser(1);

      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      mockUsersService.findByExternalId.mockResolvedValue(null);

      const result = await service.validateUser(999);

      expect(result).toBeNull();
    });
  });
});
