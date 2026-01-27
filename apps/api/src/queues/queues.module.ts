import { Module, forwardRef } from '@nestjs/common';
import { EscalationQueueService } from './escalation.queue';
import { NotificationQueueService } from './notification.queue';
import { EscalationWorkerService } from './escalation.worker';
import { NotificationWorkerService } from './notification.worker';
import { IncidentsModule } from '../modules/incidents/incidents.module';

@Module({
  imports: [forwardRef(() => IncidentsModule)],
  providers: [
    EscalationQueueService,
    NotificationQueueService,
    EscalationWorkerService,
    NotificationWorkerService,
  ],
  exports: [EscalationQueueService, NotificationQueueService],
})
export class QueuesModule {}
