import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { DatabaseModule } from '../../database/database.module';
import { HealthController } from './health.controller';
import { MetricsController } from './metrics.controller';

@Module({
  imports: [TerminusModule, DatabaseModule],
  controllers: [HealthController, MetricsController],
})
export class HealthModule {}
