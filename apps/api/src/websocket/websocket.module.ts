import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { IncidentsGateway } from './incidents.gateway';
import { WsJwtGuard } from '../common/guards/ws-jwt.guard';
import { UsersModule } from '../modules/users/users.module';

/**
 * WebSocket Module
 *
 * Note: This module uses the 'redis' package for Socket.IO adapter (horizontal scaling).
 * BullMQ (queue system) uses 'ioredis' package. Both packages coexist intentionally:
 * - redis: Required by @socket.io/redis-adapter v8+
 * - ioredis: Required by BullMQ and used elsewhere in the app
 */
@Module({
  imports: [
    ConfigModule,
    UsersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET', 'dev-secret-change-in-production'),
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [IncidentsGateway, WsJwtGuard],
  exports: [IncidentsGateway],
})
export class WebSocketModule {}
