import { Module } from '@nestjs/common';
import { EscalationPoliciesController } from './escalation-policies.controller';
import { EscalationPoliciesService } from './escalation-policies.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [EscalationPoliciesController],
  providers: [EscalationPoliciesService],
  exports: [EscalationPoliciesService],
})
export class EscalationPoliciesModule {}
