import { IsString, IsInt, IsOptional, IsBoolean, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateIntegrationDto {
  @ApiProperty({ description: 'Integration name' })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Integration type',
    enum: ['prometheus', 'grafana', 'azure_monitor', 'datadog', 'webhook'],
  })
  @IsString()
  type: string;

  @ApiProperty({ description: 'Service ID' })
  @IsInt()
  serviceId: number;

  @ApiProperty({ description: 'Configuration options', required: false })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiProperty({ description: 'Is active', required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
