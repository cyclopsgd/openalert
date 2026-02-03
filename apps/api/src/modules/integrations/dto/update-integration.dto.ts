import { IsString, IsOptional, IsBoolean, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateIntegrationDto {
  @ApiProperty({ description: 'Integration name', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'Configuration options', required: false })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiProperty({ description: 'Is active', required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
