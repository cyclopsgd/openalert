import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSSOConfigDto {
  @ApiProperty({ description: 'Azure AD Tenant ID', required: false })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiProperty({ description: 'Azure AD Client ID', required: false })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiProperty({ description: 'Azure AD Client Secret', required: false })
  @IsOptional()
  @IsString()
  clientSecret?: string;

  @ApiProperty({ description: 'Enable SSO enforcement', required: false })
  @IsOptional()
  @IsBoolean()
  ssoEnabled?: boolean;

  @ApiProperty({ description: 'Enable user registration', required: false })
  @IsOptional()
  @IsBoolean()
  registrationEnabled?: boolean;
}
