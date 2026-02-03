import { IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TestRoutingRuleDto {
  @ApiProperty({
    description: 'Sample alert to test against',
    example: {
      title: 'High CPU Usage',
      severity: 'critical',
      source: 'grafana',
      labels: { host: 'web-01', service: 'api' },
      description: 'CPU usage above 90%',
    },
  })
  @IsObject()
  sampleAlert: Record<string, unknown>;
}
