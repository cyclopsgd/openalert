import { IsString, IsInt, IsOptional, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class EscalationLevelDto {
  @ApiProperty({ description: 'Level number (1, 2, 3...)', example: 1 })
  @IsInt()
  @Min(1)
  level: number;

  @ApiProperty({ description: 'Delay in minutes before escalating to this level', example: 5 })
  @IsInt()
  @Min(0)
  delayMinutes: number;

  @ApiProperty({ description: 'Array of targets for this level' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EscalationTargetDto)
  targets: EscalationTargetDto[];
}

export class EscalationTargetDto {
  @ApiProperty({
    description: 'Target type: user, schedule, or team',
    enum: ['user', 'schedule', 'team'],
  })
  @IsString()
  targetType: 'user' | 'schedule' | 'team';

  @ApiProperty({ description: 'ID of the target (userId, scheduleId, or teamId)', example: 1 })
  @IsInt()
  targetId: number;
}

export class CreateEscalationPolicyDto {
  @ApiProperty({ description: 'Policy name', example: 'Primary Escalation' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Team ID this policy belongs to', example: 1 })
  @IsInt()
  teamId: number;

  @ApiProperty({
    description: 'Number of times to repeat the escalation',
    example: 3,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  repeatCount?: number;

  @ApiProperty({ description: 'Delay between repeats in minutes', example: 5, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  repeatDelayMinutes?: number;

  @ApiProperty({ description: 'Escalation levels', type: [EscalationLevelDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EscalationLevelDto)
  levels: EscalationLevelDto[];
}
