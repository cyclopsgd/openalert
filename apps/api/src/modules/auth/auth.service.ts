import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MsalService } from './msal.service';
import { UsersService } from '../users/users.service';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly msalService: MsalService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Get the Azure AD login URL
   */
  async getLoginUrl(redirectUri: string, state?: string): Promise<string> {
    return this.msalService.getAuthCodeUrl(redirectUri, state);
  }

  /**
   * Handle OAuth callback and create session
   */
  async handleCallback(code: string, redirectUri: string) {
    try {
      // Exchange code for token
      const tokenResponse = await this.msalService.acquireTokenByCode(code, redirectUri);

      if (!tokenResponse.account) {
        throw new UnauthorizedException('No account information in token response');
      }

      const { account } = tokenResponse;

      // Provision or update user
      const user = await this.usersService.findOrCreate({
        externalId: account.localAccountId || account.homeAccountId,
        email: account.username,
        name: account.name || account.username,
      });

      // Generate JWT token for API access
      const payload: JwtPayload = {
        sub: user.id.toString(),
        email: user.email,
        name: user.name,
        oid: user.externalId ?? undefined,
      };

      const accessToken = this.jwtService.sign(payload);

      this.logger.log(`User ${user.email} authenticated successfully`);

      return {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      };
    } catch (error) {
      this.logger.error('Error handling OAuth callback', error);
      throw new UnauthorizedException('Failed to authenticate');
    }
  }

  /**
   * Validate JWT token and return user
   */
  async validateToken(token: string) {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      const user = await this.usersService.findById(Number(payload.sub));

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        externalId: user.externalId,
      };
    } catch (error) {
      this.logger.error('Error validating token', error);
      throw new UnauthorizedException('Invalid token');
    }
  }

  /**
   * Generate a dev token for testing (development only)
   */
  async generateDevToken(userId: number) {
    if (this.config.get('NODE_ENV') === 'production') {
      throw new Error('Dev tokens not allowed in production');
    }

    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const payload: JwtPayload = {
      sub: user.id.toString(),
      email: user.email,
      name: user.name,
      oid: user.externalId ?? undefined,
    };

    return this.jwtService.sign(payload);
  }
}
