import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { DatabaseModule } from './database/database.module';
import { CacheModule } from './modules/cache/cache.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { IncidentsModule } from './modules/incidents/incidents.module';
import { QueuesModule } from './queues/queues.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { SchedulesModule } from './modules/schedules/schedules.module';
import { EscalationPoliciesModule } from './modules/escalation-policies/escalation-policies.module';
import { WebSocketModule } from './websocket/websocket.module';
import { StatusPagesModule } from './modules/status-pages/status-pages.module';
import { HealthModule } from './modules/health/health.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { SystemSettingsModule } from './modules/system-settings/system-settings.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { ServicesModule } from './modules/services/services.module';
import { TeamsModule } from './modules/teams/teams.module';
import { AlertRoutingModule } from './modules/alert-routing/alert-routing.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    EventEmitterModule.forRoot(),
    // Rate limiting (uses in-memory storage by default)
    // TODO: For distributed deployments, consider implementing Redis storage
    // when @nestjs/throttler v6+ is available or using custom implementation
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: () => ({
        throttlers: [
          {
            name: 'default',
            ttl: 60000, // 60 seconds
            limit: 60, // 60 requests per minute (default for authenticated users)
          },
        ],
        // In-memory storage (default)
        // For horizontal scaling, implement custom Redis storage adapter
      }),
    }),
    DatabaseModule,
    CacheModule,
    AuthModule,
    UsersModule,
    QueuesModule,
    AlertsModule,
    IncidentsModule,
    SchedulesModule,
    EscalationPoliciesModule,
    WebSocketModule,
    StatusPagesModule,
    HealthModule,
    MetricsModule,
    SystemSettingsModule,
    IntegrationsModule,
    ServicesModule,
    TeamsModule,
    AlertRoutingModule,
  ],
  controllers: [],
  providers: [
    // Apply throttler guard globally
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
