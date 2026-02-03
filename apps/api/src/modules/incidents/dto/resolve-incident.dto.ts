import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class ResolveIncidentDto {
  @ApiProperty({
    description: 'Resolution notes explaining how the incident was resolved',
    example: 'Restarted the service and cleared cache. Monitoring for recurrence.',
    required: false,
    maxLength: 1000,
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  resolution?: string;
}
