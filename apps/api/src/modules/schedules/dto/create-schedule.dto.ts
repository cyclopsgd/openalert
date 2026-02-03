import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, MaxLength, Min } from 'class-validator';

export class CreateScheduleDto {
  @ApiProperty({
    description: 'Schedule name',
    example: 'Primary On-Call Rotation',
    maxLength: 255,
  })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: 'Team ID that owns this schedule',
    example: 1,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  teamId: number;

  @ApiPropertyOptional({
    description: 'Timezone for the schedule (IANA timezone)',
    example: 'America/New_York',
    default: 'UTC',
  })
  @IsString()
  @IsOptional()
  timezone?: string = 'UTC';
}
