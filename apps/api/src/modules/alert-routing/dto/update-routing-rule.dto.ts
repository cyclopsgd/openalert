import { IsString, IsInt, IsBoolean, IsObject, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateRoutingRuleDto {
  @ApiPropertyOptional({ description: 'Rule name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Rule priority (higher = evaluated first)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiPropertyOptional({ description: 'Whether the rule is enabled' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

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
