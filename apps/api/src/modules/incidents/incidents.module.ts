import { Module, forwardRef } from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { IncidentsController } from './incidents.controller';
import { QueuesModule } from '../../queues/queues.module';

@Module({
  imports: [forwardRef(() => QueuesModule)],
  controllers: [IncidentsController],
  providers: [IncidentsService],
  exports: [IncidentsService],
})
export class IncidentsModule {}
