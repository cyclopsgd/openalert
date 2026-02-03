import { Module, forwardRef } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AlertsController, AlertsManagementController } from './alerts.controller';
import { WebhookTransformerService } from './webhook-transformer.service';
import { IncidentsModule } from '../incidents/incidents.module';
import { AlertRoutingModule } from '../alert-routing/alert-routing.module';

@Module({
  imports: [IncidentsModule, forwardRef(() => AlertRoutingModule)],
  controllers: [AlertsController, AlertsManagementController],
  providers: [AlertsService, WebhookTransformerService],
  exports: [AlertsService],
})
export class AlertsModule {}
