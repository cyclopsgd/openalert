import { IsString, IsInt, IsBoolean, IsObject, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoutingRuleDto {
  @ApiProperty({ description: 'Rule name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Rule priority (higher = evaluated first)', default: 0 })
  @IsInt()
  @Min(0)
  priority: number = 0;

  @ApiProperty({ description: 'Whether the rule is enabled', default: true })
  @IsBoolean()
  enabled: boolean = true;

  @ApiProperty({ description: 'Team ID that owns this rule' })
  @IsInt()
  teamId: number;

  @ApiPropertyOptional({
    description: 'Conditions to match (JSONB)',
    example: {
      labels: { severity: 'critical' },
      source: 'grafana',
      severity: ['critical', 'high'],
    },
  })
  @IsOptional()
  @IsObject()
  conditions?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Actions to perform (JSONB)',
    example: {
      route_to_service_id: 1,
      set_severity: 'critical',
      suppress: false,
      add_tags: ['tag1'],
    },
  })
  @IsOptional()
  @IsObject()
  actions?: Record<string, unknown>;
}
