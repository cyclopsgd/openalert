import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSettingDto {
  @ApiProperty({ description: 'The value to set (can be any JSON-serializable type)' })
  @IsNotEmpty()
  value: any;

  @ApiProperty({ description: 'Optional description of the setting', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
