import { IsString, IsEnum, IsOptional, IsObject, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AlertSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info',
}

export enum AlertStatus {
  FIRING = 'firing',
  RESOLVED = 'resolved',
}

export class CreateAlertDto {
  @ApiProperty({ description: 'Alert name or title' })
  @IsString()
  @IsOptional()
  alertName?: string;

  @ApiProperty({ description: 'Alert title' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({ description: 'Alert description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: AlertSeverity })
  @IsEnum(AlertSeverity)
  severity: AlertSeverity;

  @ApiPropertyOptional({ enum: AlertStatus, default: AlertStatus.FIRING })
  @IsEnum(AlertStatus)
  @IsOptional()
  status?: AlertStatus;

  @ApiPropertyOptional({ description: 'Source system' })
  @IsString()
  @IsOptional()
  source?: string;

  @ApiPropertyOptional({ description: 'Labels for grouping and routing' })
  @IsObject()
  @IsOptional()
  labels?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Annotations with additional context' })
  @IsObject()
  @IsOptional()
  annotations?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Alert start time' })
  @IsDateString()
  @IsOptional()
  startsAt?: string;

  @ApiPropertyOptional({ description: 'Alert end time' })
  @IsDateString()
  @IsOptional()
  endsAt?: string;

  @ApiPropertyOptional({ description: 'Generator URL' })
  @IsString()
  @IsOptional()
  generatorURL?: string;

  @ApiPropertyOptional({ description: 'Raw payload from source system' })
  @IsObject()
  @IsOptional()
  rawPayload?: Record<string, unknown>;
}
