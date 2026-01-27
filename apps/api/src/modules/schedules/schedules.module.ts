import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';
import { RotationsService } from './rotations.service';
import { OverridesService } from './overrides.service';
import { OnCallResolverService } from './oncall-resolver.service';

@Module({
  imports: [DatabaseModule],
  controllers: [SchedulesController],
  providers: [
    SchedulesService,
    RotationsService,
    OverridesService,
    OnCallResolverService,
  ],
  exports: [
    SchedulesService,
    RotationsService,
    OverridesService,
    OnCallResolverService,
  ],
})
export class SchedulesModule {}
