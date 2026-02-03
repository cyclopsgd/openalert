import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AlertRoutingController } from './alert-routing.controller';
import { AlertRoutingService } from './alert-routing.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AlertRoutingController],
  providers: [AlertRoutingService],
  exports: [AlertRoutingService],
})
export class AlertRoutingModule {}
