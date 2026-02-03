import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { users } from '../../database/schema';

export interface RegisterDto {
  email: string;
  password: string;
  name: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

@Injectable()
export class LocalAuthService {
  private readonly logger = new Logger(LocalAuthService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    // Check if registration is enabled
    const registrationEnabled = await this.isRegistrationEnabled();
    if (!registrationEnabled) {
      throw new UnauthorizedException('User registration is disabled');
    }

    // Check if user already exists
    const existingUser = await this.db.db
      .select()
      .from(users)
      .where(eq(users.email, dto.email))
      .limit(1);

    if (existingUser.length > 0) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Create user
    const [newUser] = await this.db.db
      .insert(users)
      .values({
        email: dto.email,
        name: dto.name,
        passwordHash,
        authProvider: 'local',
        isActive: true,
      })
      .returning();

    this.logger.log(`New user registered: ${newUser.email}`);

    // Generate JWT
    const accessToken = this.jwtService.sign(
      { sub: newUser.id, email: newUser.email, name: newUser.name },
      { expiresIn: this.config.get('JWT_EXPIRES_IN') || '7d' },
    );

    return {
      accessToken,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
      },
    };
  }

  async login(dto: LoginDto) {
    // Find user by email
    const [user] = await this.db.db.select().from(users).where(eq(users.email, dto.email)).limit(1);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    // Check if user uses local auth
    if (user.authProvider !== 'local') {
      throw new UnauthorizedException(
        `This account uses ${user.authProvider} authentication. Please sign in with ${user.authProvider}.`,
      );
    }

    // Verify password
    if (!user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Update last login time
    await this.db.db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

    this.logger.log(`User logged in: ${user.email}`);

    // Generate JWT
    const accessToken = this.jwtService.sign(
      { sub: user.id, email: user.email, name: user.name },
      { expiresIn: this.config.get('JWT_EXPIRES_IN') || '7d' },
    );

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  private async isRegistrationEnabled(): Promise<boolean> {
    try {
      const [setting] = await this.db.db.query.systemSettings.findMany({
        where: (systemSettings, { eq }) => eq(systemSettings.key, 'registration_enabled'),
      });

      if (!setting) return true; // Default to enabled
      return setting.value === true || setting.value === 'true';
    } catch (error) {
      this.logger.warn('Failed to check registration setting, defaulting to enabled');
      return true;
    }
  }
}
