import { IsOptional, IsString, IsUrl, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateGeneralSettingsDto {
  @ApiProperty({ description: 'Organization name', required: false })
  @IsOptional()
  @IsString()
  organizationName?: string;

  @ApiProperty({ description: 'Organization logo URL', required: false })
  @IsOptional()
  @IsUrl()
  organizationLogoUrl?: string;

  @ApiProperty({ description: 'Default timezone (e.g., America/New_York)', required: false })
  @IsOptional()
  @IsString()
  defaultTimezone?: string;

  @ApiProperty({ description: 'Date/time format preference', required: false })
  @IsOptional()
  @IsString()
  dateTimeFormat?: string;

  @ApiProperty({ description: 'Language code (e.g., en, es, fr)', required: false })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiProperty({ description: 'Company website URL', required: false })
  @IsOptional()
  @IsUrl()
  companyWebsite?: string;

  @ApiProperty({ description: 'Support email address', required: false })
  @IsOptional()
  @IsEmail()
  supportEmail?: string;
}
