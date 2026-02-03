import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class AcknowledgeIncidentDto {
  @ApiProperty({
    description: 'Optional note about the acknowledgment',
    example: 'Looking into this issue now',
    required: false,
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  note?: string;
}
