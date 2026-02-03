import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export enum IncidentStatusFilter {
  TRIGGERED = 'triggered',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
}

export class ListIncidentsDto {
  @ApiProperty({
    description: 'Filter by incident status',
    enum: IncidentStatusFilter,
    required: false,
  })
  @IsEnum(IncidentStatusFilter)
  @IsOptional()
  status?: IncidentStatusFilter;

  @ApiProperty({
    description: 'Filter by service ID',
    example: 1,
    required: false,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(1)
  serviceId?: number;

  @ApiProperty({
    description: 'Maximum number of incidents to return',
    example: 50,
    default: 50,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @ApiProperty({
    description: 'Number of incidents to skip (for pagination)',
    example: 0,
    default: 0,
    minimum: 0,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0)
  offset?: number = 0;
}
