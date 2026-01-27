import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
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
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'dev-secret-change-in-production'),
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
