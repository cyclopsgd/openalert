import { Module } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AlertsController, AlertsManagementController } from './alerts.controller';
import { WebhookTransformerService } from './webhook-transformer.service';
import { IncidentsModule } from '../incidents/incidents.module';

@Module({
  imports: [IncidentsModule],
  controllers: [AlertsController, AlertsManagementController],
  providers: [AlertsService, WebhookTransformerService],
  exports: [AlertsService],
})
export class AlertsModule {}
