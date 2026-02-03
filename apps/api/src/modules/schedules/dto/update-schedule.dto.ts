import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateScheduleDto {
  @ApiPropertyOptional({
    description: 'Schedule name',
    example: 'Primary On-Call Rotation',
    maxLength: 255,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    description: 'Timezone for the schedule (IANA timezone)',
    example: 'America/New_York',
  })
  @IsString()
  @IsOptional()
  timezone?: string;
}
