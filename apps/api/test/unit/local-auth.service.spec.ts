import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { LocalAuthService } from '../../src/modules/auth/local-auth.service';
import { DatabaseService } from '../../src/database/database.service';

// Mock bcrypt
jest.mock('bcrypt');

describe('LocalAuthService', () => {
  let service: LocalAuthService;
  let db: DatabaseService;
  let jwtService: JwtService;
  let configService: ConfigService;

  // Mock database query builder
  const mockSelect = jest.fn().mockReturnThis();
  const mockFrom = jest.fn().mockReturnThis();
  const mockWhere = jest.fn().mockReturnThis();
  const mockLimit = jest.fn();
  const mockInsert = jest.fn().mockReturnThis();
  const mockValues = jest.fn().mockReturnThis();
  const mockReturning = jest.fn();
  const mockUpdate = jest.fn().mockReturnThis();
  const mockSet = jest.fn().mockReturnThis();

  const mockDb = {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    query: {
      systemSettings: {
        findMany: jest.fn(),
      },
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalAuthService,
        {
          provide: DatabaseService,
          useValue: { db: mockDb },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<LocalAuthService>(LocalAuthService);
    db = module.get<DatabaseService>(DatabaseService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);

    // Setup default chain
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit, returning: mockReturning });
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ returning: mockReturning });
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockWhere });
  });

  describe('register', () => {
    const registerDto = {
      email: 'test@example.com',
      password: 'SecurePass123!',
      name: 'Test User',
    };

    it('should successfully register a new user', async () => {
      // Mock registration enabled
      mockDb.query.systemSettings.findMany.mockResolvedValue([]);

      // Mock no existing user
      mockLimit.mockResolvedValue([]);

      // Mock password hashing
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');

      // Mock user creation
      const mockUser = {
        id: 1,
        email: registerDto.email,
        name: registerDto.name,
        passwordHash: 'hashed_password',
        authProvider: 'local',
        isActive: true,
        createdAt: new Date(),
      };
      mockReturning.mockResolvedValue([mockUser]);

      // Mock JWT generation
      (jwtService.sign as jest.Mock).mockReturnValue('mock_token');
      (configService.get as jest.Mock).mockReturnValue('7d');

      const result = await service.register(registerDto);

      expect(result).toEqual({
        accessToken: 'mock_token',
        user: {
          id: 1,
          email: registerDto.email,
          name: registerDto.name,
        },
      });

      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: 1, email: registerDto.email, name: registerDto.name },
        { expiresIn: '7d' }
      );
    });

    it('should throw ConflictException if user already exists', async () => {
      mockDb.query.systemSettings.findMany.mockResolvedValue([]);

      // Mock existing user
      mockLimit.mockResolvedValue([{ id: 1, email: registerDto.email }]);

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
      await expect(service.register(registerDto)).rejects.toThrow('User with this email already exists');
    });

    it('should throw UnauthorizedException if registration is disabled', async () => {
      // Mock registration disabled
      mockDb.query.systemSettings.findMany.mockResolvedValue([
        { key: 'registration_enabled', value: false },
      ]);

      await expect(service.register(registerDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.register(registerDto)).rejects.toThrow('User registration is disabled');
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'SecurePass123!',
    };

    it('should successfully login a valid user', async () => {
      const mockUser = {
        id: 1,
        email: loginDto.email,
        name: 'Test User',
        passwordHash: 'hashed_password',
        authProvider: 'local',
        isActive: true,
      };

      // Mock user lookup
      mockLimit.mockResolvedValue([mockUser]);

      // Mock password comparison
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Mock JWT generation
      (jwtService.sign as jest.Mock).mockReturnValue('mock_token');
      (configService.get as jest.Mock).mockReturnValue('7d');

      // Mock update last login
      mockReturning.mockResolvedValue([mockUser]);

      const result = await service.login(loginDto);

      expect(result).toEqual({
        accessToken: 'mock_token',
        user: {
          id: 1,
          email: loginDto.email,
          name: 'Test User',
        },
      });

      expect(bcrypt.compare).toHaveBeenCalledWith(loginDto.password, 'hashed_password');
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockLimit.mockResolvedValue([]);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('Invalid email or password');
    });

    it('should throw UnauthorizedException if user is inactive', async () => {
      mockLimit.mockResolvedValue([
        {
          id: 1,
          email: loginDto.email,
          isActive: false,
          authProvider: 'local',
          passwordHash: 'hashed_password',
        },
      ]);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('Account is inactive');
    });

    it('should throw UnauthorizedException if user uses different auth provider', async () => {
      mockLimit.mockResolvedValue([
        {
          id: 1,
          email: loginDto.email,
          isActive: true,
          authProvider: 'azure',
          passwordHash: 'hashed_password',
        },
      ]);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('This account uses azure authentication');
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      mockLimit.mockResolvedValue([
        {
          id: 1,
          email: loginDto.email,
          isActive: true,
          authProvider: 'local',
          passwordHash: 'hashed_password',
        },
      ]);

      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('Invalid email or password');
    });

    it('should throw UnauthorizedException if user has no password hash', async () => {
      mockLimit.mockResolvedValue([
        {
          id: 1,
          email: loginDto.email,
          isActive: true,
          authProvider: 'local',
          passwordHash: null,
        },
      ]);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('Invalid email or password');
    });
  });
});
