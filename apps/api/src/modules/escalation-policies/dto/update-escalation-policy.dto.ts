import { PartialType } from '@nestjs/swagger';
import { CreateEscalationPolicyDto } from './create-escalation-policy.dto';

export class UpdateEscalationPolicyDto extends PartialType(CreateEscalationPolicyDto) {}
