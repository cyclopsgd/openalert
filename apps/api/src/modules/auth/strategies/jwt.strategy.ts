import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { UsersService } from '../../users/users.service';

export interface JwtPayload {
  sub: string; // user ID
  email: string;
  name: string;
  oid?: string; // Azure AD object ID
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // Try Authorization header first (for API calls)
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        // Fall back to cookie (for browser requests after OAuth)
        (request: Request) => {
          return request?.cookies?.authToken || null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'dev-secret-change-in-production'),
      passReqToCallback: false,
    });
  }

  async validate(payload: JwtPayload) {
    // Payload comes from the JWT token
    const user = await this.usersService.findById(Number(payload.sub));

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // This will be attached to request.user
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      externalId: user.externalId,
    };
  }
}
