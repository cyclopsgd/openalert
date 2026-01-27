import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { UsersService } from '../../modules/users/users.service';
import { ConfigService } from '@nestjs/config';

interface AuthenticatedSocket extends Socket {
  userId: number;
  teamIds: number[];
  user: {
    id: number;
    email: string;
    name: string;
  };
}

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: AuthenticatedSocket = context.switchToWs().getClient();

    try {
      // Extract token from handshake auth or query
      const token =
        client.handshake?.auth?.token ||
        client.handshake?.headers?.authorization?.replace('Bearer ', '') ||
        client.handshake?.query?.token;

      if (!token) {
        this.logger.warn(`WebSocket connection attempt without token: ${client.id}`);
        throw new WsException('Unauthorized: No token provided');
      }

      // Verify JWT token
      const secret = this.configService.get<string>('JWT_SECRET', 'dev-secret-change-in-production');
      const payload = this.jwtService.verify(token, { secret });

      // Load user data
      const user = await this.usersService.findById(Number(payload.sub));

      if (!user || !user.isActive) {
        this.logger.warn(`WebSocket connection attempt with invalid user: ${payload.sub}`);
        throw new WsException('Unauthorized: Invalid user');
      }

      // Attach user data to socket
      client.userId = user.id;
      client.user = {
        id: user.id,
        email: user.email,
        name: user.name,
      };

      // Load user's team IDs
      const teamMemberships = await this.usersService.getUserTeams(user.id);
      client.teamIds = teamMemberships.map((tm) => tm.teamId);

      this.logger.debug(`WebSocket authenticated: user ${user.id} (${user.email})`);

      return true;
    } catch (error) {
      this.logger.error(`WebSocket authentication failed: ${error.message}`);
      throw new WsException('Unauthorized: Invalid token');
    }
  }
}
