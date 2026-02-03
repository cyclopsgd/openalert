import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, Min, Max, IsString, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export enum IncidentStatusFilter {
  TRIGGERED = 'triggered',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
}

export enum SeverityFilter {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info',
}

export enum SortBy {
  NEWEST = 'newest',
  OLDEST = 'oldest',
  SEVERITY = 'severity',
  STATUS = 'status',
}

export class ListIncidentsDto {
  @ApiProperty({
    description: 'Filter by incident status (can be multiple)',
    enum: IncidentStatusFilter,
    required: false,
    isArray: true,
  })
  @IsEnum(IncidentStatusFilter, { each: true })
  @IsOptional()
  status?: IncidentStatusFilter | IncidentStatusFilter[];

  @ApiProperty({
    description: 'Filter by severity (can be multiple)',
    enum: SeverityFilter,
    required: false,
    isArray: true,
  })
  @IsEnum(SeverityFilter, { each: true })
  @IsOptional()
  severity?: SeverityFilter | SeverityFilter[];

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
    description: 'Filter by assignee user ID',
    example: 1,
    required: false,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(1)
  assigneeId?: number;

  @ApiProperty({
    description: 'Search query for title and description',
    example: 'database error',
    required: false,
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({
    description: 'Filter incidents from this date (ISO 8601)',
    example: '2024-01-01T00:00:00Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @ApiProperty({
    description: 'Filter incidents until this date (ISO 8601)',
    example: '2024-12-31T23:59:59Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  dateTo?: string;

  @ApiProperty({
    description: 'Sort order',
    enum: SortBy,
    default: SortBy.NEWEST,
    required: false,
  })
  @IsEnum(SortBy)
  @IsOptional()
  sortBy?: SortBy = SortBy.NEWEST;

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
